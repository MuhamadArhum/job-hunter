const express = require('express');
const { body } = require('express-validator');
const {
  scrapeJobs,
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
} = require('../controllers/jobController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createJobValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and cannot exceed 200 characters'),
  body('company')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Company name is required and cannot exceed 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('description')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Description is required'),
  body('location')
    .optional()
    .trim(),
  body('salary')
    .optional()
    .trim(),
  body('jobType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'internship', 'remote'])
    .withMessage('Invalid job type')
];

const scrapeJobsValidation = [
  body('keywords')
    .optional()
    .trim(),
  body('location')
    .optional()
    .trim()
];

// Routes
router.post('/scrape', authMiddleware, scrapeJobsValidation, scrapeJobs);
router.get('/', getJobs);
router.get('/:id', getJobById);
router.post('/', authMiddleware, createJobValidation, createJob);
router.put('/:id', authMiddleware, createJobValidation, updateJob);
router.delete('/:id', authMiddleware, deleteJob);

module.exports = router;