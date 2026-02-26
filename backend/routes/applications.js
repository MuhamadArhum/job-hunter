const express = require('express');
const { body } = require('express-validator');
const {
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats
} = require('../controllers/applicationController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const updateStatusValidation = [
  body('status')
    .isIn(['pending', 'sent', 'failed', 'rejected', 'interviewed', 'hired'])
    .withMessage('Invalid status'),
  body('emailResponse')
    .optional()
    .trim(),
  body('errorMessage')
    .optional()
    .trim()
];

// Routes
router.get('/', authMiddleware, getApplications);
router.get('/stats', authMiddleware, getApplicationStats);
router.get('/:id', authMiddleware, getApplicationById);
router.put('/:id/status', authMiddleware, updateStatusValidation, updateApplicationStatus);
router.delete('/:id', authMiddleware, deleteApplication);

module.exports = router;