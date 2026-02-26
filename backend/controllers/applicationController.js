const Application = require('../models/Application');
const Job = require('../models/Job');
const { validationResult } = require('express-validator');

const getApplications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = { userId: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { 'job.title': { $regex: search, $options: 'i' } },
        { 'job.company': { $regex: search, $options: 'i' } }
      ];
    }

    const applications = await Application.find(query)
      .populate('jobId', 'title company email description location salary')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments({ userId: req.user._id });
    const filteredTotal = await Application.countDocuments(query);

    // Transform applications to include job details
    const transformedApplications = applications.map(app => ({
      id: app._id,
      status: app.status,
      coverLetter: app.coverLetter,
      appliedAt: app.appliedAt,
      sentAt: app.sentAt,
      emailResponse: app.emailResponse,
      errorMessage: app.errorMessage,
      job: {
        id: app.jobId._id,
        title: app.jobId.title,
        company: app.jobId.company,
        email: app.jobId.email,
        description: app.jobId.description,
        location: app.jobId.location,
        salary: app.jobId.salary
      }
    }));

    res.json({
      applications: transformedApplications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit),
        allTimeTotal: total
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('jobId', 'title company email description location salary');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const transformedApplication = {
      id: application._id,
      status: application.status,
      coverLetter: application.coverLetter,
      appliedAt: application.appliedAt,
      sentAt: application.sentAt,
      emailResponse: application.emailResponse,
      errorMessage: application.errorMessage,
      job: {
        id: application.jobId._id,
        title: application.jobId.title,
        company: application.jobId.company,
        email: application.jobId.email,
        description: application.jobId.description,
        location: application.jobId.location,
        salary: application.jobId.salary
      }
    };

    res.json({ application: transformedApplication });
  } catch (error) {
    console.error('Get application by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, emailResponse, errorMessage } = req.body;

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        status,
        emailResponse,
        errorMessage: errorMessage || undefined
      },
      { new: true, runValidators: true }
    ).populate('jobId', 'title company email');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({
      message: 'Application status updated successfully',
      application: {
        id: application._id,
        status: application.status,
        emailResponse: application.emailResponse,
        errorMessage: application.errorMessage,
        job: {
          title: application.jobId.title,
          company: application.jobId.company
        }
      }
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application status' });
  }
};

const deleteApplication = async (req, res) => {
  try {
    const application = await Application.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
};

const getApplicationStats = async (req, res) => {
  try {
    const stats = await Application.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      rejected: 0,
      interviewed: 0,
      hired: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    // Get recent activity
    const recentApplications = await Application.find({ userId: req.user._id })
      .populate('jobId', 'title company')
      .sort({ appliedAt: -1 })
      .limit(5);

    res.json({
      stats: formattedStats,
      recentActivity: recentApplications.map(app => ({
        id: app._id,
        status: app.status,
        appliedAt: app.appliedAt,
        job: {
          title: app.jobId.title,
          company: app.jobId.company
        }
      }))
    });
  } catch (error) {
    console.error('Get application stats error:', error);
    res.status(500).json({ error: 'Failed to fetch application statistics' });
  }
};

module.exports = {
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats
};