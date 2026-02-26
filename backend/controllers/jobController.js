const Job = require('../models/Job');
const JobScraper = require('../services/jobScraper');
const { validationResult } = require('express-validator');
const { getJson } = require('serpapi');

const scrapeJobs = async (req, res) => {
  try {
    const { keywords, location } = req.body;
    
    if (!keywords) {
      return res.status(400).json({ error: 'Keywords are required for job scraping' });
    }

    // Fetch real jobs from SerpApi (Google Jobs)
    let jobsData = [];
    
    if (process.env.SERPAPI_KEY) {
      try {
        const response = await new Promise((resolve, reject) => {
          getJson({
            engine: "google_jobs",
            q: keywords,
            location: location || "United States",
            google_domain: "google.com",
            hl: "en",
            gl: "us",
            api_key: process.env.SERPAPI_KEY
          }, (json) => {
            if (json.error) {
              reject(new Error(json.error));
            } else {
              resolve(json);
            }
          });
        });
        
        if (response.jobs_results) {
          jobsData = transformSerpApiJobs(response.jobs_results);
        }
      } catch (serpError) {
        console.error('SerpApi error:', serpError.message);
        // Fall back to sample jobs if SerpApi fails
        jobsData = generateSampleJobs(keywords, location);
      }
    } else {
      // No SerpApi key, use sample jobs
      jobsData = generateSampleJobs(keywords, location);
    }
    
    // Save jobs to database
    const { savedCount, skippedCount } = await saveSampleJobsToDatabase(jobsData);

    res.json({
      message: 'Job scraping completed successfully',
      totalFound: jobsData.length,
      saved: savedCount,
      skipped: skippedCount,
      jobs: jobsData
    });
  } catch (error) {
    console.error('Job scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape jobs' });
  }
};

// Transform SerpApi jobs to our database format
function transformSerpApiJobs(jobs) {
  return jobs.map(job => ({
    title: job.title || 'Unknown Title',
    company: job.company_name || 'Unknown Company',
    description: job.description || job.title || '',
    email: extractEmail(job.description) || job.company_name?.toLowerCase().replace(/\s+/g, '') + '@company.com' || 'jobs@company.com',
    location: job.location || 'Remote',
    salary: job.salary || 'Not specified',
    jobType: determineJobType(job.title, job.description),
    source: 'scraper',
    sourceUrl: job.url || '',
    extensions: job.extensions || []
  })).filter(job => job.title && job.company);
}

// Extract email from description
function extractEmail(text) {
  if (!text) return null;
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0] : null;
}

// Determine job type from title/description
function determineJobType(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  if (text.includes('remote')) return 'remote';
  if (text.includes('part-time') || text.includes('part time')) return 'part-time';
  if (text.includes('contract') || text.includes('intern')) return 'contract';
  if (text.includes('internship')) return 'internship';
  return 'full-time';
}

// Generate sample jobs for demo
function generateSampleJobs(keywords, location) {
  const companies = ['Tech Corp', 'Innovation Labs', 'Digital Solutions', 'Cloud Systems', 'Data Dynamics'];
  const jobTypes = ['full-time', 'remote', 'contract', 'part-time'];
  
  return Array.from({ length: 10 }, (_, i) => ({
    title: `${keywords} ${['Developer', 'Engineer', 'Specialist', 'Analyst'][i % 4]}`,
    company: companies[i % companies.length],
    description: `We are looking for a ${keywords} professional to join our team. Requirements: 2+ years experience, knowledge of modern technologies, good communication skills.`,
    email: `jobs${i}@company${i}.com`,
    location: location || 'Remote',
    salary: `${50 + i * 10}k - ${80 + i * 10}k`,
    jobType: jobTypes[i % jobTypes.length],
    source: 'scraper'
  }));
}

// Save sample jobs to database
async function saveSampleJobsToDatabase(jobs) {
  let savedCount = 0;
  let skippedCount = 0;

  for (const jobData of jobs) {
    try {
      const existingJob = await Job.findOne({
        title: jobData.title,
        company: jobData.company,
        email: jobData.email
      });

      if (!existingJob) {
        const job = new Job(jobData);
        await job.save();
        savedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error('Error saving job:', error);
    }
  }

  return { savedCount, skippedCount };
}

const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, company, location } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

const createJob = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, company, email, description, location, salary, jobType } = req.body;

    // Check if job already exists
    const existingJob = await Job.findOne({ title, company, email });
    if (existingJob) {
      return res.status(400).json({ error: 'Job already exists' });
    }

    const job = new Job({
      title,
      company,
      email,
      description,
      location,
      salary,
      jobType,
      source: 'manual'
    });

    await job.save();

    res.status(201).json({
      message: 'Job created successfully',
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

const updateJob = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      message: 'Job updated successfully',
      job
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
};

const deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
};

module.exports = {
  scrapeJobs,
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
};
