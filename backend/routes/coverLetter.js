const express = require('express');
const { body } = require('express-validator');
const {
  generateCoverLetter,
  generateMultipleCoverLetters,
  previewCoverLetter
} = require('../controllers/coverLetterController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const generateCoverLetterValidation = [
  body('jobDescription')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Job description must be at least 10 characters long'),
  body('jobTitle')
    .optional()
    .trim(),
  body('companyName')
    .optional()
    .trim()
];

const generateMultipleValidation = [
  ...generateCoverLetterValidation,
  body('count')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Count must be between 1 and 5')
];

const previewValidation = [
  body('userProfile')
    .isObject()
    .withMessage('User profile must be an object'),
  body('userProfile.name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('User name is required'),
  body('jobDescription')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Job description must be at least 10 characters long')
];

// Routes
router.post('/generate', authMiddleware, generateCoverLetter);
router.post('/generate-multiple', authMiddleware, generateMultipleCoverLetters);
router.post('/preview', previewValidation, previewCoverLetter);

module.exports = router;