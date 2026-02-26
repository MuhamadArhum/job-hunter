const EmailService = require('../services/emailService');
const Application = require('../models/Application');
const User = require('../models/User');
const Job = require('../models/Job');
const { validationResult } = require('express-validator');
const path = require('path');

const sendApplication = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId, coverLetter, subject } = req.body;

    // Get user and job details
    const user = await User.findById(req.user._id);
    const job = await Job.findById(jobId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user has already applied to this job
    const existingApplication = await Application.findOne({
      userId: req.user._id,
      jobId: jobId
    });

    if (existingApplication) {
      return res.status(400).json({ 
        error: 'You have already applied to this job' 
      });
    }

    // Check daily email limit
    const today = new Date();
    const lastEmailSent = user.lastEmailSent ? new Date(user.lastEmailSent) : null;
    const isSameDay = lastEmailSent && 
                     today.getDate() === lastEmailSent.getDate() &&
                     today.getMonth() === lastEmailSent.getMonth() &&
                     today.getFullYear() === lastEmailSent.getFullYear();

    if (isSameDay && user.emailSentCount >= (parseInt(process.env.MAX_EMAILS_PER_DAY) || 20)) {
      return res.status(429).json({ 
        error: 'Daily email limit reached. You can send up to 20 emails per day.' 
      });
    }

    // Send application email
    const emailService = new EmailService();
    
    const emailResult = await emailService.sendApplicationEmail({
      to: job.email,
      subject: subject || `Application for ${job.title} Position`,
      body: coverLetter,
      cvPath: user.cvPath ? path.join(__dirname, '..', user.cvPath) : null,
      userName: user.name,
      companyName: job.company
    });

    // Create application record
    const application = new Application({
      userId: req.user._id,
      jobId: jobId,
      coverLetter: coverLetter,
      status: emailResult.success ? 'sent' : 'failed',
      sentAt: new Date(),
      emailResponse: emailResult.success ? 'Email sent successfully' : emailResult.error
    });

    await application.save();

    // Update user's email sent count
    if (isSameDay) {
      user.emailSentCount += 1;
    } else {
      user.emailSentCount = 1;
    }
    user.lastEmailSent = new Date();
    await user.save();

    res.json({
      message: emailResult.success ? 'Application sent successfully' : 'Failed to send application',
      application: {
        id: application._id,
        status: application.status,
        sentAt: application.sentAt,
        job: {
          title: job.title,
          company: job.company,
          email: job.email
        }
      }
    });
  } catch (error) {
    console.error('Send application error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to send application' 
    });
  }
};

const testEmailService = async (req, res) => {
  try {
    const emailService = new EmailService();
    
    // Test connection
    const isConnected = await emailService.verifyConnection();
    
    if (!isConnected) {
      return res.status(500).json({ 
        error: 'Email service connection failed. Please check your email configuration.' 
      });
    }

    // Send test email
    const testResult = await emailService.testEmail();

    res.json({
      message: 'Email service test completed successfully',
      connection: isConnected,
      testResult
    });
  } catch (error) {
    console.error('Email service test error:', error);
    res.status(500).json({ 
      error: error.message || 'Email service test failed' 
    });
  }
};

module.exports = {
  sendApplication,
  testEmailService
};