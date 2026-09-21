/**
 * In-Memory Sliding Window Rate Limiter Middleware
 */

const ipRequestMap = new Map();

/**
 * Creates an Express rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default 1 min)
 * @param {number} options.max - Max number of requests allowed per window
 * @param {string} options.message - Custom error message
 */
const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 100,
  message = 'Too many requests, please try again later.'
} = {}) => {
  return (req, res, next) => {
    // In test environment, allow bypassing if desired
    if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit']) {
      return next();
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    const key = `${req.baseUrl || ''}_${ip}`;
    const now = Date.now();

    let record = ipRequestMap.get(key);
    if (!record) {
      record = { timestamps: [] };
      ipRequestMap.set(key, record);
    }

    // Filter out timestamps older than the window
    record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);

    if (record.timestamps.length >= max) {
      const oldest = record.timestamps[0];
      const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec > 0 ? retryAfterSec : 1);
      return res.status(429).json({
        success: false,
        message,
        retry_after_seconds: retryAfterSec > 0 ? retryAfterSec : 1
      });
    }

    record.timestamps.push(now);
    next();
  };
};

// Login-specific rate limiter: max 20 requests per minute per IP
const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many login attempts from this IP. Please try again after 1 minute.'
});

// General API rate limiter: max 100 requests per minute per IP
const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many API requests from this IP. Please slow down.'
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  generalApiRateLimiter
};
