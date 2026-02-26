const CoverLetterGenerator = require('../services/coverLetterGenerator');
const User = require('../models/User');
const { validationResult } = require('express-validator');

const generateCoverLetter = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobDescription, jobTitle, companyName } = req.body;

    // Get user profile
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Set default skills if not available
    const userProfile = {
      name: user.name || 'Candidate',
      skills: user.skills || [],
      experience: user.experience || [],
      projects: user.projects || [],
      education: user.education || [],
      keywords: user.keywords || []
    };

    // Generate cover letter
    const generator = new CoverLetterGenerator();
    const coverLetter = await generator.generateCoverLetter(user, jobDescription);

    res.json({
      message: 'Cover letter generated successfully',
      coverLetter,
      jobDetails: {
        title: jobTitle,
        company: companyName
      }
    });
  } catch (error) {
    console.error('Generate cover letter error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate cover letter' 
    });
  }
};

const generateMultipleCoverLetters = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobDescription, jobTitle, companyName, count = 3 } = req.body;

    // Get user profile
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Set default skills if not available
    const userProfile = {
      name: user.name || 'Candidate',
      skills: user.skills || [],
      experience: user.experience || [],
      projects: user.projects || [],
      education: user.education || [],
      keywords: user.keywords || []
    };

    // Generate multiple cover letter versions
    const generator = new CoverLetterGenerator();
    const versions = await generator.generateMultipleVersions(user, jobDescription, count);

    res.json({
      message: 'Multiple cover letters generated successfully',
      versions,
      jobDetails: {
        title: jobTitle,
        company: companyName
      }
    });
  } catch (error) {
    console.error('Generate multiple cover letters error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate cover letters' 
    });
  }
};

const previewCoverLetter = async (req, res) => {
  try {
    const { userProfile, jobDescription } = req.body;

    if (!userProfile || !jobDescription) {
      return res.status(400).json({ 
        error: 'User profile and job description are required' 
      });
    }

    const generator = new CoverLetterGenerator();
    const coverLetter = await generator.generateCoverLetter(userProfile, jobDescription);

    res.json({
      message: 'Cover letter preview generated successfully',
      coverLetter
    });
  } catch (error) {
    console.error('Preview cover letter error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate cover letter preview' 
    });
  }
};

module.exports = {
  generateCoverLetter,
  generateMultipleCoverLetters,
  previewCoverLetter
};