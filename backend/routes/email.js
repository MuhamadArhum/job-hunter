const express = require('express');
const { body } = require('express-validator');
const { sendApplication, testEmailService } = require('../controllers/emailController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const sendApplicationValidation = [
  body('jobId')
    .isMongoId()
    .withMessage('Valid job ID is required'),
  body('coverLetter')
    .trim()
    .isLength({ min: 100 })
    .withMessage('Cover letter must be at least 100 characters long'),
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters')
];

// Routes
router.post('/send-application', authMiddleware, sendApplicationValidation, sendApplication);
router.post('/test', authMiddleware, testEmailService);

module.exports = router;