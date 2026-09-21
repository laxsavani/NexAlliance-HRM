const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  uploadEmployeeDocuments,
  deleteEmployee,
  getUnmaskedSensitiveFields
} = require('../controllers/employeeController');
const { submitSensitiveFieldChange } = require('../controllers/sensitiveChangeRequestController');
const { protect, checkPermission } = require('../middlewares/auth');
const { employeeDocUpload } = require('../middlewares/upload');
const salaryStructureRoutes = require('./salaryStructureRoutes');

/**
 * @swagger
 * tags:
 *   name: Employee Master
 *   description: Employee Profile, Bank Details, KYC Documents (Aadhaar, PAN), and Academic Marksheets (10th, 12th/Diploma)
 */

router.use(protect);

// Re-route into salary structure router
router.use('/:userId/salary-structure', salaryStructureRoutes);

/**
 * @swagger
 * /api/employees/me/sensitive-field:
 *   put:
 *     summary: Submit a sensitive field change request (Bank Account, PAN, Aadhaar) awaiting Super Admin approval
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field, new_value]
 *             properties:
 *               field: { type: string, enum: [bank_account, pan, aadhaar], example: 'bank_account' }
 *               new_value: { type: string, example: '987654321098' }
 *     responses:
 *       201:
 *         description: Change request created in Pending status
 *       400:
 *         description: Invalid field or missing value
 */
router.put('/me/sensitive-field', submitSensitiveFieldChange);

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get list of employees (Scope-enforced ALL / DEPT / OWN, Masked bank/PAN/Aadhaar)
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, email, or employee code
 *       - in: query
 *         name: department_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of employees
 *   post:
 *     summary: Create a new employee with Bank Details and KYC (Super Admin only)
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeCreateRequest'
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       400:
 *         description: Validation error or duplicate email/employee_code
 */
router.route('/')
  .get(checkPermission('EMPLOYEE', 'VIEW'), getEmployees)
  .post(checkPermission('EMPLOYEE', 'CREATE'), createEmployee);

/**
 * @swagger
 * /api/employees/{id}/sensitive-fields/unmask:
 *   get:
 *     summary: Get decrypted plaintext bank/PAN/Aadhaar data (Super Admin ONLY with mandatory SENSITIVE_VIEW audit log)
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Unmasked sensitive data
 *       403:
 *         description: Access Denied (Super Admin only)
 *       404:
 *         description: Employee not found
 */
router.get('/:id/sensitive-fields/unmask', getUnmaskedSensitiveFields);

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get full employee profile by ID (Scope-aware, Masked sensitive fields)
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Complete employee profile including Bank, KYC, and Education info
 *       403:
 *         description: Access Denied (Scope violation)
 *       404:
 *         description: Employee not found
 *   put:
 *     summary: "Update employee profile (Super Admin: full, Employee: own whitelisted fields)"
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               address: { type: string }
 *               emergency_contact: { type: string }
 *               bank_details: { $ref: '#/components/schemas/BankDetails' }
 *               identity_documents: { $ref: '#/components/schemas/IdentityDocuments' }
 *               education_documents: { $ref: '#/components/schemas/EducationDocuments' }
 *     responses:
 *       200:
 *         description: Employee updated
 *       403:
 *         description: Unauthorized edit attempt
 *   delete:
 *     summary: "Deactivate employee (Soft-delete, Super Admin only, last Super Admin guarded)"
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Employee deactivated
 *       400:
 *         description: Cannot deactivate last active Super Admin
 */
router.route('/:id')
  .get(checkPermission('EMPLOYEE', 'VIEW'), getEmployeeById)
  .put(checkPermission('EMPLOYEE', 'EDIT'), updateEmployee)
  .delete(checkPermission('EMPLOYEE', 'DELETE'), deleteEmployee);

/**
 * @swagger
 * /api/employees/{id}/upload-documents:
 *   post:
 *     summary: Upload Photo, Aadhaar, PAN, 10th marksheet, 12th/Diploma marksheets, and Degree certificates
 *     tags: [Employee Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo: { type: string, format: binary, description: 'Profile Photo (JPG/PNG)' }
 *               aadhar_card: { type: string, format: binary, description: 'Aadhaar Card (PDF/Image)' }
 *               pan_card: { type: string, format: binary, description: 'PAN Card (PDF/Image)' }
 *               tenth_marksheet: { type: string, format: binary, description: '10th Marksheet (PDF/Image)' }
 *               twelfth_marksheet: { type: string, format: binary, description: '12th Marksheet (PDF/Image)' }
 *               diploma_marksheet: { type: string, format: binary, description: 'Diploma Marksheet (PDF/Image)' }
 *               graduation_certificate: { type: string, format: binary, description: 'Graduation Degree (PDF/Image)' }
 *     responses:
 *       200:
 *         description: Files uploaded and URLs attached to employee record
 *       400:
 *         description: Invalid file format or size exceeded
 */
router.post(
  '/:id/upload-documents',
  checkPermission('EMPLOYEE', 'EDIT'),
  employeeDocUpload,
  uploadEmployeeDocuments
);

module.exports = router;
