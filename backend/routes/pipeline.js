/**
 * Pipeline Routes
 * Full FTE pipeline: Search Jobs → Generate CVs → HITL CV Review → Find Emails
 * → Draft Emails → HITL Email Review → Send Applications
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const Memory = require('../models/Memory');
const Approval = require('../models/Approval');
const { emailService } = require('../services/emailService');
const { ResumeBuilderChains, ApplyChains } = require('../services/langchain/chains');

// ─── Multer setup ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/cvs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cv_${req.user._id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// ─── Save / Get pipeline state helpers ────────────────────────────────────────
async function savePipelineState(userId, pipelineId, updates) {
  const existing = await Memory.findOne({
    userId,
    memoryType: 'short_term',
    category: 'pipeline',
    key: pipelineId,
  });

  const newValue = { ...(existing?.value || {}), ...updates };

  await Memory.findOneAndUpdate(
    { userId, memoryType: 'short_term', category: 'pipeline', key: pipelineId },
    {
      userId,
      memoryType: 'short_term',
      category: 'pipeline',
      key: pipelineId,
      value: newValue,
      'metadata.expiresAt': new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    },
    { upsert: true, new: true }
  );
  return newValue;
}

async function getPipelineState(userId, pipelineId) {
  const mem = await Memory.findOne({
    userId,
    memoryType: 'short_term',
    category: 'pipeline',
    key: pipelineId,
  });
  return mem?.value || null;
}

// ─── Background pipeline runner ───────────────────────────────────────────────
async function runPipelineInBackground(userId, pipelineId, jobRole, location, maxJobs, candidateProfile, cvFilePath) {
  try {
    // Stage 1: Search jobs
    await savePipelineState(userId, pipelineId, { stage: 'searching' });

    const { getJson } = require('serpapi');
    let jobs = [];
    try {
      const searchResults = await getJson({
        engine: 'google_jobs',
        api_key: process.env.SERPAPI_KEY,
        q: jobRole,
        location: location || 'Pakistan',
        hl: 'en',
        gl: 'pk',
        num: maxJobs,
      });
      const rawJobs = searchResults?.jobs_results || [];
      jobs = rawJobs.slice(0, maxJobs).map((job, idx) => ({
        id: `job_${idx + 1}`,
        title: job.title || 'Unknown Title',
        company: job.company_name || 'Unknown Company',
        location: job.location || location,
        description: (job.description || '').substring(0, 2000),
        sourceUrl: job.share_link || job.apply_options?.[0]?.link || '',
        source: 'google_jobs',
      }));
    } catch (serpErr) {
      console.error('[Pipeline] SerpAPI error:', serpErr.message);
      // Fallback: create placeholder jobs so pipeline doesn't fail
      jobs = [{
        id: 'job_1',
        title: jobRole,
        company: 'Target Company',
        location: location || 'Pakistan',
        description: `Looking for ${jobRole} with strong skills.`,
        sourceUrl: '',
        source: 'fallback',
      }];
    }

    if (jobs.length === 0) {
      await savePipelineState(userId, pipelineId, {
        stage: 'error',
        error: 'No jobs found. Try a different search term or location.',
      });
      return;
    }

    await savePipelineState(userId, pipelineId, { jobs });

    // Stage 2: Generate tailored CVs for each job
    await savePipelineState(userId, pipelineId, { stage: 'generating_cvs' });

    const cvResults = [];
    for (const job of jobs) {
      try {
        const generated = await ResumeBuilderChains.generateCV(candidateProfile, job, userId);
        cvResults.push({
          jobId: job.id,
          job,
          cv: generated,
          atsScore: generated.atsScore || { overall: 75, format: 80, keywords: 70, content: 75 },
        });
      } catch (cvErr) {
        console.error(`[Pipeline] CV gen failed for ${job.company}:`, cvErr.message);
        cvResults.push({
          jobId: job.id,
          job,
          cv: null,
          atsScore: null,
          error: `CV generation failed: ${cvErr.message}`,
        });
      }
    }

    const successfulCVs = cvResults.filter(r => !r.error);
    if (successfulCVs.length === 0) {
      await savePipelineState(userId, pipelineId, {
        stage: 'error',
        error: 'Failed to generate CVs. Please try again.',
        cvResults,
      });
      return;
    }

    // Stage 3: Create HITL 1 — CV Review approval
    await savePipelineState(userId, pipelineId, {
      stage: 'cv_review',
      cvResults,
      cvFilePath,
      candidateProfile,
    });

    const approval = await Approval.createPending({
      userId,
      approvalType: 'cv_review',
      taskId: pipelineId,
      agentId: 'resumeBuilder',
      title: `Review ${successfulCVs.length} tailored CVs for "${jobRole}"`,
      description: 'AI generated a tailored CV for each job. Review and approve before emailing.',
      content: {
        original: {
          pipelineId,
          jobCount: jobs.length,
          cvs: cvResults.map(r => ({
            jobId: r.jobId,
            jobTitle: r.job.title,
            company: r.job.company,
            location: r.job.location,
            atsScore: r.atsScore,
            cv: r.cv,
            error: r.error,
          })),
        },
        modified: null,
      },
      metadata: { urgency: 'medium', autoExpire: true, expireAfter: 240 },
    });

    await savePipelineState(userId, pipelineId, {
      cvReviewApprovalId: approval.approvalId,
    });

    console.log(`[Pipeline] ${pipelineId} ready for CV review (${successfulCVs.length} CVs)`);
  } catch (err) {
    console.error('[Pipeline] Background run failed:', err.message);
    await savePipelineState(userId, pipelineId, {
      stage: 'error',
      error: err.message,
    });
  }
}

// ─── POST /api/pipeline/upload-cv ─────────────────────────────────────────────
router.post('/upload-cv', authMiddleware, upload.single('cv'), async (req, res) => {
  try {
    const userId = req.user._id;
    if (!req.file) return res.status(400).json({ error: 'No CV file uploaded' });

    const filePath = req.file.path;

    // Parse PDF
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const resumeText = data.text;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from PDF. Please ensure it is not scanned/image-only.' });
    }

    // Use LLM to parse CV
    const parsed = await ResumeBuilderChains.parseCV(resumeText, userId);

    // Save parsed profile to memory (long_term)
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'long_term', category: 'preferences', key: 'candidate_profile' },
      {
        userId,
        memoryType: 'long_term',
        category: 'preferences',
        key: 'candidate_profile',
        value: parsed,
      },
      { upsert: true, new: true }
    );

    // Save CV file path
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'long_term', category: 'preferences', key: 'cv_file_path' },
      {
        userId,
        memoryType: 'long_term',
        category: 'preferences',
        key: 'cv_file_path',
        value: filePath,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'CV uploaded and parsed successfully',
      profile: {
        name: parsed.contactInfo?.name || 'Unknown',
        email: parsed.contactInfo?.email || '',
        sections: Object.keys(parsed),
        skillCount: (parsed.skills?.technical?.length || 0) + (parsed.skills?.soft?.length || 0),
      },
    });
  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/pipeline/cv-status ──────────────────────────────────────────────
router.get('/cv-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const profile = await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'candidate_profile',
    });
    res.json({
      hasCV: !!profile,
      name: profile?.value?.contactInfo?.name || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pipeline/start ─────────────────────────────────────────────────
// Returns immediately, runs pipeline in background
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobRole, location = 'Pakistan', maxJobs = 5 } = req.body;

    if (!jobRole) return res.status(400).json({ error: 'jobRole is required' });

    // Get candidate profile
    const profileMemory = await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'candidate_profile',
    });
    if (!profileMemory) {
      return res.status(400).json({ error: 'Please upload your CV first before starting a pipeline.' });
    }

    const cvFileMemory = await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'cv_file_path',
    });

    const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Save initial state
    await savePipelineState(userId, pipelineId, {
      pipelineId,
      stage: 'starting',
      jobRole,
      location,
      maxJobs: parseInt(maxJobs),
      createdAt: new Date().toISOString(),
    });

    // Return immediately
    res.json({
      success: true,
      pipelineId,
      stage: 'starting',
      message: `Pipeline started! Searching for "${jobRole}" jobs in ${location}...`,
    });

    // Run in background (no await)
    runPipelineInBackground(
      userId,
      pipelineId,
      jobRole,
      location,
      parseInt(maxJobs),
      profileMemory.value,
      cvFileMemory?.value || null
    );
  } catch (error) {
    console.error('Pipeline start error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/pipeline/status/:pipelineId ─────────────────────────────────────
router.get('/status/:pipelineId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { pipelineId } = req.params;
    const pipeline = await getPipelineState(userId, pipelineId);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    res.json({
      success: true,
      stage: pipeline.stage,
      jobRole: pipeline.jobRole,
      location: pipeline.location,
      jobCount: pipeline.jobs?.length || 0,
      cvCount: pipeline.cvResults?.filter(r => !r.error).length || 0,
      error: pipeline.error || null,
      cvReviewApprovalId: pipeline.cvReviewApprovalId || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pipeline/approve-cvs ───────────────────────────────────────────
// Called after user approves CV review → finds HR emails + drafts emails → HITL 2
router.post('/approve-cvs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { approvalId, pipelineId, selectedJobIds } = req.body;

    if (!pipelineId) return res.status(400).json({ error: 'pipelineId is required' });

    const pipeline = await getPipelineState(userId, pipelineId);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    // Mark CV approval as approved
    if (approvalId) {
      await Approval.findOneAndUpdate(
        { approvalId, userId },
        { status: 'approved', respondedAt: new Date() }
      );
    }

    // Filter selected jobs
    const targetCVs = (pipeline.cvResults || []).filter(r =>
      !r.error && (!selectedJobIds || selectedJobIds.includes(r.jobId))
    );

    if (targetCVs.length === 0) {
      return res.status(400).json({ error: 'No valid CVs to proceed with' });
    }

    await savePipelineState(userId, pipelineId, { stage: 'finding_emails' });

    // Return immediately, run email drafting in background
    res.json({
      success: true,
      message: `CVs approved! Finding HR emails and drafting applications for ${targetCVs.length} companies...`,
      stage: 'finding_emails',
    });

    // Background: find emails + draft emails + create HITL 2
    (async () => {
      try {
        const emailDrafts = [];

        for (const cvResult of targetCVs) {
          const { job } = cvResult;
          try {
            // Find HR email
            const emailResult = await ApplyChains.findEmails(
              job.company,
              job.sourceUrl || '',
              null,
              userId
            );
            const hrEmail = emailResult?.emails?.[0]?.email
              || `hr@${(job.company || 'company').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}.com`;

            // Draft email
            const emailDraft = await ApplyChains.draftEmail(
              pipeline.candidateProfile,
              job,
              job.company,
              hrEmail,
              userId
            );

            emailDrafts.push({
              jobId: job.id,
              job,
              hrEmail,
              subject: emailDraft.subject || `Application for ${job.title} - ${pipeline.candidateProfile?.contactInfo?.name || 'Applicant'}`,
              body: emailDraft.body || `Dear HR Team,\n\nI am interested in the ${job.title} position at ${job.company}.\n\nBest regards`,
              cvPath: pipeline.cvFilePath,
              atsScore: cvResult.atsScore,
            });
          } catch (err) {
            console.error(`[Pipeline] Email draft failed for ${job.company}:`, err.message);
            emailDrafts.push({ jobId: job.id, job, error: err.message });
          }
        }

        const validEmails = emailDrafts.filter(e => !e.error);

        await savePipelineState(userId, pipelineId, {
          stage: 'email_review',
          emailDrafts,
        });

        // Create HITL 2 — Email Review
        const emailApproval = await Approval.createPending({
          userId,
          approvalType: 'email_send',
          taskId: pipelineId,
          agentId: 'apply',
          title: `Review ${validEmails.length} application email${validEmails.length !== 1 ? 's' : ''}`,
          description: 'Review the drafted emails before sending to HR. You can edit each email.',
          content: {
            original: {
              pipelineId,
              emails: emailDrafts.map(e => ({
                jobId: e.jobId,
                company: e.job?.company,
                jobTitle: e.job?.title,
                hrEmail: e.hrEmail,
                subject: e.subject,
                body: e.body,
                error: e.error,
              })),
            },
            modified: null,
          },
          metadata: { urgency: 'high', autoExpire: true, expireAfter: 120 },
        });

        await savePipelineState(userId, pipelineId, {
          emailReviewApprovalId: emailApproval.approvalId,
        });

        console.log(`[Pipeline] ${pipelineId} ready for email review (${validEmails.length} emails)`);
      } catch (bgErr) {
        console.error('[Pipeline] Email drafting background error:', bgErr.message);
        await savePipelineState(userId, pipelineId, {
          stage: 'error',
          error: `Email drafting failed: ${bgErr.message}`,
        });
      }
    })();
  } catch (error) {
    console.error('Approve CVs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pipeline/approve-emails ────────────────────────────────────────
// Called after user approves email review → sends emails via Nodemailer
router.post('/approve-emails', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { approvalId, pipelineId, modifiedEmails } = req.body;

    if (!pipelineId) return res.status(400).json({ error: 'pipelineId is required' });

    const pipeline = await getPipelineState(userId, pipelineId);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    // Use modified emails if provided, else original drafts
    const emailsToSend = modifiedEmails || pipeline.emailDrafts || [];

    // Mark email approval as approved
    if (approvalId) {
      await Approval.findOneAndUpdate(
        { approvalId, userId },
        { status: 'approved', respondedAt: new Date() }
      );
    }

    await savePipelineState(userId, pipelineId, { stage: 'sending' });

    // Send emails
    const Application = require('../models/Application');
    const sendResults = [];

    for (const emailDraft of emailsToSend) {
      if (emailDraft.error || !emailDraft.hrEmail) continue;

      try {
        const result = await emailService.sendApplicationEmail({
          to: emailDraft.hrEmail,
          subject: emailDraft.subject,
          body: emailDraft.body,
          cvPath: emailDraft.cvPath || null,
          companyName: emailDraft.job?.company,
          userName: pipeline.candidateProfile?.contactInfo?.name,
        });

        // Save application record
        await Application.create({
          userId,
          company: emailDraft.job?.company,
          position: emailDraft.job?.title,
          hrEmail: emailDraft.hrEmail,
          emailContent: { subject: emailDraft.subject, body: emailDraft.body },
          status: 'applied',
          appliedAt: new Date(),
          emailMessageId: result.messageId,
        }).catch(() => {}); // non-critical

        sendResults.push({
          jobId: emailDraft.jobId,
          company: emailDraft.job?.company,
          jobTitle: emailDraft.job?.title,
          hrEmail: emailDraft.hrEmail,
          success: true,
          messageId: result.messageId,
        });
      } catch (err) {
        sendResults.push({
          jobId: emailDraft.jobId,
          company: emailDraft.job?.company,
          jobTitle: emailDraft.job?.title,
          hrEmail: emailDraft.hrEmail,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = sendResults.filter(r => r.success).length;
    const failCount = sendResults.filter(r => !r.success).length;

    await savePipelineState(userId, pipelineId, {
      stage: 'completed',
      sendResults,
    });

    res.json({
      success: true,
      message: `Sent ${successCount} application${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}!`,
      results: sendResults,
      successCount,
      failCount,
      stage: 'completed',
    });
  } catch (error) {
    console.error('Approve emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pipeline/reject ────────────────────────────────────────────────
router.post('/reject', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { approvalId, pipelineId } = req.body;

    if (approvalId) {
      await Approval.findOneAndUpdate(
        { approvalId, userId },
        { status: 'rejected', respondedAt: new Date() }
      );
    }

    if (pipelineId) {
      await savePipelineState(userId, pipelineId, { stage: 'cancelled' });
    }

    res.json({ success: true, message: 'Pipeline cancelled.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
