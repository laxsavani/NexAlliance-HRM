const AuditLog = require('../models/AuditLog');

/**
 * Global Audit Middleware Factory
 * Automatically captures and logs write operations (POST, PUT, PATCH, DELETE)
 * Deduplicates automatically if the controller has already called AuditLog.record(..., req).
 * 
 * @param {string} moduleName - Target module (e.g. 'EMPLOYEE', 'ROLE', 'LEAVE', 'PAYROLL')
 * @param {string} actionName - Target action (e.g. 'CREATE', 'UPDATE', 'DELETE')
 */
const auditWrapper = (moduleName, actionName) => {
  return async (req, res, next) => {
    // Only wrap mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const oldValue = req.body ? { ...req.body } : null;

    let isHandled = false;

    const handleAuditLog = async (responseBody) => {
      if (isHandled) return;
      isHandled = true;

      // Only audit successful 2xx responses and authenticated requests
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user && req.user._id) {
        // Skip if already manually logged by controller/service
        if (req._auditLogged) {
          return;
        }

        const resolvedModule = moduleName || req.baseUrl?.replace('/api/', '').toUpperCase() || 'SYSTEM';
        const resolvedAction = actionName || (
          req.method === 'POST' ? 'CREATE' :
          req.method === 'DELETE' ? 'DELETE' : 'UPDATE'
        );

        let parsedResponse = responseBody;
        if (typeof responseBody === 'string') {
          try {
            parsedResponse = JSON.parse(responseBody);
          } catch (e) {
            parsedResponse = { message: responseBody };
          }
        }

        await AuditLog.record(
          req.user._id,
          resolvedModule,
          resolvedAction,
          oldValue,
          parsedResponse?.data || parsedResponse || null,
          req
        );
      }
    };

    res.json = function(body) {
      handleAuditLog(body).finally(() => {
        originalJson(body);
      });
    };

    res.send = function(body) {
      handleAuditLog(body).finally(() => {
        originalSend(body);
      });
    };

    next();
  };
};

module.exports = auditWrapper;
