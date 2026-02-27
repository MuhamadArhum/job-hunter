/**
 * Digital FTE Agent
 * A single conversational agent that guides the user through the complete
 * job application process: CV upload → role capture → job search → CV tailoring
 * → approval → email finding → email drafting → approval → send applications
 */

const pdfParse = require('pdf-parse');
const fs = require('fs');
const Memory = require('../../models/Memory');
const Approval = require('../../models/Approval');
const Application = require('../../models/Application');
const Job = require('../../models/Job');
const { ResumeBuilderChains, ApplyChains, FTEChains, OrchestratorChains } = require('../../services/langchain/chains');
const { emailService } = require('../../services/emailService');
const { logAgentActivity } = require('../../services/langchain/langfuse');
const OrchestratorAgent = require('../orchestrator');

// ─── States ───────────────────────────────────────────────────────────────────
const STATES = {
  WAITING_CV: 'waiting_cv',
  CV_UPLOADED: 'cv_uploaded',
  ASKING_LOCATION: 'asking_location',
  SEARCHING: 'searching',
  GENERATING_CVS: 'generating_cvs',
  CV_REVIEW: 'cv_review',
  FINDING_EMAILS: 'finding_emails',
  EMAIL_REVIEW: 'email_review',
  SENDING: 'sending',
  DONE: 'done',
};

const ASYNC_STATES = new Set([
  STATES.SEARCHING,
  STATES.GENERATING_CVS,
  STATES.FINDING_EMAILS,
  STATES.SENDING,
]);

const DEFAULT_STATE = {
  state: STATES.WAITING_CV,
  role: null,
  location: null,
  jobs: [],
  cvResults: [],
  cvReviewApprovalId: null,
  emailDrafts: [],
  emailReviewApprovalId: null,
  sendResults: [],
  candidateProfile: null,
  cvFilePath: null,
};

// ─── Memory helpers ────────────────────────────────────────────────────────────
async function getState(userId) {
  const mem = await Memory.findOne({
    userId,
    memoryType: 'long_term',
    category: 'fte_state',
    key: 'current',
  });
  return mem?.value || { ...DEFAULT_STATE };
}

async function setState(userId, updates) {
  const existing = await Memory.findOne({
    userId,
    memoryType: 'long_term',
    category: 'fte_state',
    key: 'current',
  });
  const merged = { ...(existing?.value || DEFAULT_STATE), ...updates };
  await Memory.findOneAndUpdate(
    { userId, memoryType: 'long_term', category: 'fte_state', key: 'current' },
    {
      userId,
      memoryType: 'long_term',
      category: 'fte_state',
      key: 'current',
      value: merged,
    },
    { upsert: true, new: true }
  );
  return merged;
}

async function resetState(userId) {
  await Memory.findOneAndUpdate(
    { userId, memoryType: 'long_term', category: 'fte_state', key: 'current' },
    {
      userId,
      memoryType: 'long_term',
      category: 'fte_state',
      key: 'current',
      value: { ...DEFAULT_STATE },
    },
    { upsert: true, new: true }
  );
  return { ...DEFAULT_STATE };
}

// ─── Simple entity extraction (no LLM needed for location) ───────────────────
function extractLocationFromText(text) {
  // Common Pakistani cities + Remote
  const cities = [
    'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad', 'multan',
    'peshawar', 'quetta', 'sialkot', 'hyderabad', 'gujranwala', 'abbottabad',
    'remote', 'anywhere', 'pakistan',
  ];
  const lower = text.toLowerCase();
  for (const city of cities) {
    if (lower.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  // Fallback: use entire message as location if short
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length < 30) return trimmed;
  return null;
}

// ─── History helpers ──────────────────────────────────────────────────────────
async function saveToHistory(userId, fteState, successCount) {
  const key = `session_${Date.now()}`;
  const entry = {
    key,
    role: fteState.role,
    location: fteState.location,
    jobCount: (fteState.jobs || []).length,
    cvCount: (fteState.cvResults || []).length,
    emailCount: (fteState.emailDrafts || []).length,
    sentCount: successCount || 0,
    companies: (fteState.sendResults || [])
      .filter(r => r.success)
      .map(r => r.company)
      .filter(Boolean),
    completedAt: new Date().toISOString(),
  };
  await Memory.findOneAndUpdate(
    { userId, memoryType: 'long_term', category: 'fte_history', key },
    { userId, memoryType: 'long_term', category: 'fte_history', key, value: entry },
    { upsert: true }
  );
}

async function getHistoryList(userId) {
  const records = await Memory.find({
    userId,
    memoryType: 'long_term',
    category: 'fte_history',
  }).sort({ createdAt: -1 }).limit(20);
  return records.map(r => r.value);
}

// ─── Main FTE Agent ───────────────────────────────────────────────────────────
class FTEAgent {

  /**
   * Main chat entry point
   * Returns: { botMessage, state, data? }
   */
  async chat(userId, message, uploadedFile = null) {
    const fteState = await getState(userId);

    // Handle /reset command from any state
    if (message && message.trim().toLowerCase() === '/reset') {
      const fresh = await resetState(userId);
      return {
        botMessage: 'Reset ho gaya! Dobara shuru karte hain. Apni CV upload karein.',
        state: fresh.state,
      };
    }

    switch (fteState.state) {

      case STATES.WAITING_CV:
        if (uploadedFile) {
          return await this.handleCVUpload(userId, uploadedFile);
        }
        return {
          botMessage: 'Assalam o Alaikum! Main aapka Digital FTE hoon.\n\nMain aapke liye jobs dhundhonga, tailored CVs banaunga, aur automatically HR ko applications bhejunga.\n\nShuru karne ke liye — pehle apni **CV (PDF)** upload karein.',
          state: STATES.WAITING_CV,
        };

      case STATES.CV_UPLOADED:
        if (uploadedFile) {
          // User uploaded a new CV — re-parse it
          return await this.handleCVUpload(userId, uploadedFile);
        }
        return await this.handleRoleCapture(userId, message, fteState);

      case STATES.ASKING_LOCATION:
        if (uploadedFile) {
          return await this.handleCVUpload(userId, uploadedFile);
        }
        return await this.handleLocationCapture(userId, message, fteState);

      case STATES.CV_REVIEW:
        return {
          botMessage: 'Tailored CVs ready hain! Upar diye cards dekh kar **Approve** ya **Reject** karein.',
          state: fteState.state,
          data: { cvResults: fteState.cvResults, cvReviewApprovalId: fteState.cvReviewApprovalId },
        };

      case STATES.EMAIL_REVIEW:
        return {
          botMessage: 'Email drafts ready hain! Upar diye cards dekh kar edit karein ya seedha **Send All** press karein.',
          state: fteState.state,
          data: { emailDrafts: fteState.emailDrafts, emailReviewApprovalId: fteState.emailReviewApprovalId },
        };

      case STATES.DONE:
        return {
          botMessage: `Sab kuch ho gaya! ${fteState.sendResults?.filter(r => r.success).length || 0} companies ko applications bhej di gayi hain.\n\nDobara shuru karne ke liye **/reset** likhein.`,
          state: STATES.DONE,
          data: { sendResults: fteState.sendResults },
        };

      default:
        // Async states: SEARCHING, GENERATING_CVS, FINDING_EMAILS, SENDING
        return {
          botMessage: 'Kaam ho raha hai, thoda sabr karein...',
          state: fteState.state,
        };
    }
  }

  /**
   * Handle CV file upload
   */
  async handleCVUpload(userId, file) {
    logAgentActivity('fte', 'cv_upload_started', { userId, filename: file.originalname });
    try {
      // Parse PDF
      const pdfBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(pdfBuffer);
      const resumeText = pdfData.text;

      if (!resumeText || resumeText.trim().length < 50) {
        return {
          botMessage: 'CV parse nahi ho saki. Please ek proper PDF CV upload karein.',
          state: STATES.WAITING_CV,
        };
      }

      // Extract structured profile via LLM
      const parsed = await ResumeBuilderChains.parseCV(resumeText, userId);

      const candidateProfile = parsed.parsed || parsed;
      const cvFilePath = file.path;

      await setState(userId, {
        state: STATES.CV_UPLOADED,
        candidateProfile,
        cvFilePath,
      });

      // Also save to long-term preferences (used by other agents)
      await Memory.findOneAndUpdate(
        { userId, memoryType: 'long_term', category: 'preferences', key: 'candidate_profile' },
        { userId, memoryType: 'long_term', category: 'preferences', key: 'candidate_profile', value: candidateProfile },
        { upsert: true }
      );
      await Memory.findOneAndUpdate(
        { userId, memoryType: 'long_term', category: 'preferences', key: 'cv_file_path' },
        { userId, memoryType: 'long_term', category: 'preferences', key: 'cv_file_path', value: cvFilePath },
        { upsert: true }
      );

      const name = candidateProfile?.contactInfo?.name || candidateProfile?.name || 'aap';
      const rawSkills = candidateProfile?.skills || [];
      const skillCount = Array.isArray(rawSkills)
        ? rawSkills.length
        : Object.values(rawSkills).flat().length;

      logAgentActivity('fte', 'cv_uploaded', { userId, name, skillCount });

      return {
        botMessage: `CV mil gayi! ✓ **${name}** — ${skillCount} skills detect hui hain.\n\nAb ek hi message mein batayein — **kaunsi role** aur **kaunse city** mein job chahiye?\n\n_(misaal: "Software Engineer Karachi" ya "Data Analyst in Lahore")_`,
        state: STATES.CV_UPLOADED,
      };
    } catch (err) {
      logAgentActivity('fte', 'cv_upload_error', { error: err.message });
      return {
        botMessage: `CV parse karne mein masla aaya: ${err.message}. Dobara try karein.`,
        state: STATES.WAITING_CV,
      };
    }
  }

  /**
   * Handle role+location capture from user message (both in one shot)
   * Uses Orchestrator for intent detection + entity extraction
   */
  async handleRoleCapture(userId, message, fteState) {
    if (!message || message.trim().length === 0) {
      return {
        botMessage: 'Please role aur city batayein, jaise "Software Engineer Karachi".',
        state: STATES.CV_UPLOADED,
      };
    }

    const text = message.trim();
    let role = null;
    let location = null;

    // Use Orchestrator's intent detection to extract role + location entities
    try {
      const intentResult = await OrchestratorChains.detectIntent(text, userId);
      const entities = intentResult.entities || {};

      // Role = first keyword/skill extracted by orchestrator
      role = entities.keywords?.[0] || entities.skills?.[0] || null;
      // Location = first location entity
      location = entities.locations?.[0] || null;

      logAgentActivity('fte', 'orchestrator_intent_detected', {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        role,
        location,
      });
    } catch (err) {
      logAgentActivity('fte', 'orchestrator_fallback', { error: err.message });
      // Fallback to FTEChains.extractEntity
      try {
        const entities = await FTEChains.extractEntity(text, userId);
        role = entities.role || null;
        location = entities.location || null;
      } catch {
        role = text;
        location = extractLocationFromText(text);
      }
    }

    // Fallback role if LLM returns null
    if (!role) role = text;

    if (role && location) {
      // Both found — start search immediately
      await setState(userId, { state: STATES.SEARCHING, role, location, error: null });
      this.runPipelineAsync(userId).catch(err => {
        logAgentActivity('fte', 'pipeline_error', { error: err.message });
        console.error('[FTE] Pipeline crashed:', err);
        setState(userId, { state: STATES.CV_UPLOADED, error: err.message }).catch(console.error);
      });
      return {
        botMessage: `Theek hai! **${role}** jobs **${location}** mein dhundh raha hoon... _(15-30 seconds lag sakte hain)_`,
        state: STATES.SEARCHING,
      };
    }

    // Only role found — ask for city
    await setState(userId, { state: STATES.ASKING_LOCATION, role });
    return {
      botMessage: `**${role}** — acha choice!\n\nAb batayein — **kaunse city** mein job chahiye? (e.g., Karachi, Lahore, Islamabad, Remote)`,
      state: STATES.ASKING_LOCATION,
    };
  }

  /**
   * Handle location capture
   */
  async handleLocationCapture(userId, message, fteState) {
    const location = message ? message.trim() : '';
    if (!location) {
      return {
        botMessage: 'Please city ka naam batayein, jaise Karachi, Lahore, ya Remote.',
        state: STATES.ASKING_LOCATION,
      };
    }

    await setState(userId, { state: STATES.SEARCHING, location });

    // Fire and forget
    this.runPipelineAsync(userId).catch(err => {
      logAgentActivity('fte', 'pipeline_error', { error: err.message });
      console.error('[FTE] Pipeline crashed:', err);
      setState(userId, { state: STATES.CV_UPLOADED, error: err.message }).catch(console.error);
    });

    return {
      botMessage: `Theek hai! **${fteState.role}** jobs **${location}** mein dhundh raha hoon... (yeh 15-30 seconds le sakta hai)`,
      state: STATES.SEARCHING,
    };
  }

  /**
   * Async pipeline: Orchestrator coordinates jobSearch + resumeBuilder agents
   * → creates cv_review approval for HITL
   * Fire-and-forget, state updated in MongoDB
   */
  async runPipelineAsync(userId) {
    const fteState = await getState(userId);
    logAgentActivity('fte', 'pipeline_started', { userId, role: fteState.role, location: fteState.location });

    // ── STEP 1: Search Jobs via Orchestrator → jobSearch agent ──────────────
    const searchOrchestrator = new OrchestratorAgent(userId);
    await searchOrchestrator.initialize(`fte_search_${Date.now()}`);

    let jobs = [];
    try {
      logAgentActivity('fte', 'orchestrator_search_start', { role: fteState.role, location: fteState.location });

      const searchResults = await searchOrchestrator.executeTasks([{
        id: 1,
        agent: 'jobSearch',
        action: 'search_jobs',
        keywords: fteState.role,
        location: fteState.location,
        filters: {},
      }]);

      jobs = searchResults[1]?.data?.jobs || [];
      logAgentActivity('fte', 'orchestrator_search_done', { count: jobs.length });
    } catch (err) {
      logAgentActivity('fte', 'search_error', { error: err.message });
      await setState(userId, {
        state: STATES.CV_UPLOADED,
        jobs: [],
        error: `Job search fail: ${err.message}`,
      });
      return;
    }

    // Limit to 5 jobs max for CV generation
    const selectedJobs = jobs.slice(0, 5);

    if (selectedJobs.length === 0) {
      await setState(userId, {
        state: STATES.CV_UPLOADED,
        jobs: [],
        error: `"${fteState.role}" ke liye "${fteState.location}" mein koi job nahi mili. Role ya city badal kar dobara try karein.`,
      });
      return;
    }

    await setState(userId, { state: STATES.GENERATING_CVS, jobs: selectedJobs });

    // ── STEP 2: Generate Tailored CVs via Orchestrator → resumeBuilder agent ─
    const cvOrchestrator = new OrchestratorAgent(userId);
    await cvOrchestrator.initialize(`fte_cv_${Date.now()}`);

    const currentState = await getState(userId);
    const candidateProfile = currentState.candidateProfile;
    const cvResults = [];

    for (let i = 0; i < selectedJobs.length; i++) {
      const job = selectedJobs[i];
      try {
        const cvTaskResults = await cvOrchestrator.executeTasks([{
          id: i + 1,
          agent: 'resumeBuilder',
          action: 'generate_cv',
          originalCV: candidateProfile,
          targetJob: {
            title:       job.title,
            company:     job.company,
            location:    job.location,
            description: (job.description || '').substring(0, 800),
            requirements: job.requirements || [],
          },
        }]);

        // resumeBuilderAgent.generateCV returns { cv: generated, atsScore, recommendations }
        // generated = { sections: {...}, atsScore, matchedKeywords, suggestions }
        const cvData = cvTaskResults[i + 1]?.data;
        const raw = cvData?.cv || cvData || {};
        const sections = raw.sections || raw.cv?.sections || raw;
        const skillsRaw = sections.skills || [];
        const skillsFlat = Array.isArray(skillsRaw)
          ? skillsRaw
          : [
              ...(skillsRaw.technical || []),
              ...(skillsRaw.soft || []),
              ...(skillsRaw.tools || []),
            ];

        const normalizedCV = {
          contactInfo:    sections.contactInfo || {},
          summary:        sections.summary || sections.professionalSummary || sections.profile || '',
          experience:     sections.experience || [],
          education:      sections.education || [],
          skills:         skillsFlat,
          certifications: sections.certifications || [],
          languages:      sections.languages || [],
        };

        cvResults.push({
          jobId: job._id?.toString() || job.id || String(Math.random()),
          job: {
            title:       job.title,
            company:     job.company,
            location:    job.location,
            description: (job.description || '').substring(0, 400),
            sourceUrl:   job.sourceUrl || null,
            salary:      job.salary || null,
          },
          cv:              normalizedCV,
          atsScore:        cvData?.atsScore || raw.atsScore || null,
          recommendations: cvData?.recommendations || raw.suggestions || [],
          matchedKeywords: raw.matchedKeywords || [],
        });
      } catch (err) {
        logAgentActivity('fte', 'cv_generation_error', { job: job.title, error: err.message });
        cvResults.push({
          jobId: job._id?.toString() || String(Math.random()),
          job: { title: job.title, company: job.company, location: job.location, sourceUrl: job.sourceUrl || null },
          cv: null,
          atsScore: null,
          error: err.message,
        });
      }
    }

    logAgentActivity('fte', 'cvs_generated', { count: cvResults.length });

    // ── STEP 3: Create cv_review Approval ────────────────────────────────────
    const approval = await Approval.createPending({
      userId,
      approvalType: 'cv_review',
      taskId: `fte_cv_${Date.now()}`,
      agentId: 'fte',
      title: `Review Tailored CVs — ${fteState.role} in ${fteState.location}`,
      description: `${cvResults.length} tailored CVs ready for your review`,
      content: {
        original: {
          cvResults,
          role: fteState.role,
          location: fteState.location,
          pipelineType: 'fte',
        },
      },
      metadata: { urgency: 'medium', autoExpire: false },
    });

    await setState(userId, {
      state: STATES.CV_REVIEW,
      cvResults,
      cvReviewApprovalId: approval.approvalId,
    });

    logAgentActivity('fte', 'cv_review_ready', { approvalId: approval.approvalId });
  }

  /**
   * Approve CVs → trigger email finding async
   */
  async approveCVs(userId, approvalId, selectedJobIds) {
    // Mark approval as approved
    await Approval.findOneAndUpdate(
      { approvalId, userId },
      { status: 'approved', respondedAt: new Date() }
    );

    const fteState = await getState(userId);
    let cvResults = fteState.cvResults;

    // Filter to selected jobs if provided
    if (selectedJobIds && selectedJobIds.length > 0) {
      cvResults = cvResults.filter(r => selectedJobIds.includes(r.jobId));
    }

    await setState(userId, { state: STATES.FINDING_EMAILS, cvResults });

    // Fire and forget
    this.findEmailsAsync(userId).catch(err => {
      logAgentActivity('fte', 'email_find_error', { error: err.message });
      console.error('[FTE] findEmailsAsync crashed:', err);
      setState(userId, { state: STATES.CV_REVIEW, error: err.message }).catch(console.error);
    });

    return { botMessage: 'CVs approve ho gayi! HR emails dhundh raha hoon...', state: STATES.FINDING_EMAILS };
  }

  /**
   * Async: find HR emails + draft emails via Orchestrator → apply agent
   * → create email_review approval for HITL
   */
  async findEmailsAsync(userId) {
    const fteState = await getState(userId);
    const { cvResults, candidateProfile, cvFilePath, role } = fteState;

    logAgentActivity('fte', 'finding_emails', { count: cvResults.length });

    // Initialize Orchestrator for email drafting
    const emailOrchestrator = new OrchestratorAgent(userId);
    await emailOrchestrator.initialize(`fte_email_${Date.now()}`);

    const emailDrafts = [];

    for (let i = 0; i < cvResults.length; i++) {
      const cvResult = cvResults[i];
      if (!cvResult.cv) continue; // skip failed CVs
      const { job } = cvResult;
      try {
        // ── Extract HR email from real company domain ────────────────────────
        // Priority: companyApplyUrl > sourceUrl > company name slug
        const JOB_BOARDS = ['google.com', 'linkedin.com', 'indeed.com', 'glassdoor.com',
          'rozee.pk', 'bayt.com', 'monster.com', 'ziprecruiter.com'];

        const extractDomain = (url) => {
          if (!url) return null;
          try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            if (JOB_BOARDS.some(b => hostname.endsWith(b))) return null;
            // Strip subdomains like 'careers.' or 'jobs.' to get root domain
            const parts = hostname.split('.');
            if (parts.length > 2 && ['careers', 'jobs', 'apply', 'work', 'portal'].includes(parts[0])) {
              return parts.slice(1).join('.');
            }
            return hostname;
          } catch { return null; }
        };

        // Try company's own URL first, then sourceUrl
        const companyDomain = extractDomain(job.companyApplyUrl) || extractDomain(job.sourceUrl);

        let hrEmail = null;

        if (companyDomain) {
          // Try common HR email prefixes — use hr@ as primary (most universal)
          const candidates = ['hr', 'careers', 'jobs', 'recruiting', 'talent', 'recruitment'];
          hrEmail = `${candidates[0]}@${companyDomain}`;
          logAgentActivity('fte', 'email_from_domain', {
            company: job.company,
            email: hrEmail,
            domain: companyDomain,
            source: job.companyApplyUrl ? 'company_url' : 'source_url',
          });
        }

        // Last resort: derive domain from company name (better than nothing)
        if (!hrEmail) {
          const slug = (job.company || '').toLowerCase()
            .replace(/\s+(pvt|ltd|inc|corp|llc|private|limited|pakistan|pk)\.?\s*/gi, '')
            .replace(/[^a-z0-9]+/g, '')
            .substring(0, 25);
          if (slug) {
            hrEmail = `hr@${slug}.com`;
            logAgentActivity('fte', 'email_from_name_slug', { company: job.company, email: hrEmail });
          }
        }

        if (!hrEmail) {
          logAgentActivity('fte', 'email_not_found', { company: job.company });
          emailDrafts.push({
            jobId: cvResult.jobId,
            job,
            hrEmail: null,
            subject: null,
            body: null,
            cvPath: cvFilePath,
            atsScore: cvResult.atsScore,
            error: 'HR email derive nahi ho saki',
          });
          continue;
        }

        // ── Draft email via Orchestrator → apply agent ──────────────────────
        const emailTaskResults = await emailOrchestrator.executeTasks([{
          id: i + 1,
          agent: 'apply',
          action: 'draft_email',
          targetJob: {
            title:       job.title,
            company:     job.company,
            location:    job.location,
            description: job.description || '',
          },
          hrEmail,
          candidateInfo: candidateProfile,
        }]);

        const draft = emailTaskResults[i + 1]?.data;

        const candidateName = candidateProfile?.contactInfo?.name || 'Applicant';
        const fallbackBody = `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job.title} position at ${job.company}. With my background and experience, I believe I would be a valuable addition to your team.\n\nPlease find my CV attached for your review. I look forward to the opportunity to discuss how my skills align with your requirements.\n\nBest regards,\n${candidateName}`;
        emailDrafts.push({
          jobId: cvResult.jobId,
          job,
          hrEmail,
          subject: draft?.subject || `Application for ${job.title} — ${candidateName}`,
          body: draft?.body || draft?.emailBody || draft?.content || fallbackBody,
          cvPath: cvFilePath,
          atsScore: cvResult.atsScore,
        });
      } catch (err) {
        logAgentActivity('fte', 'draft_error', { company: job.company, error: err.message });
        emailDrafts.push({
          jobId: cvResult.jobId,
          job,
          hrEmail: null,
          subject: null,
          body: null,
          cvPath: cvFilePath,
          atsScore: cvResult.atsScore,
          error: `Draft error: ${err.message}`,
        });
      }
    }

    logAgentActivity('fte', 'emails_drafted', { count: emailDrafts.length });

    // Create email_send Approval
    const approval = await Approval.createPending({
      userId,
      approvalType: 'email_send',
      taskId: `fte_email_${Date.now()}`,
      agentId: 'fte',
      title: `Send ${emailDrafts.length} Job Applications`,
      description: `Review and approve ${emailDrafts.length} application emails before sending`,
      content: {
        original: {
          emailDrafts,
          role,
          pipelineType: 'fte',
        },
      },
      metadata: { urgency: 'high', autoExpire: false },
    });

    await setState(userId, {
      state: STATES.EMAIL_REVIEW,
      emailDrafts,
      emailReviewApprovalId: approval.approvalId,
    });
  }

  /**
   * Approve emails → send all
   */
  async approveEmails(userId, approvalId, modifiedEmails) {
    // Mark approval approved
    await Approval.findOneAndUpdate(
      { approvalId, userId },
      { status: 'approved', respondedAt: new Date() }
    );

    const fteState = await getState(userId);
    // Use modified emails if provided, else original drafts
    const emailsToSend = modifiedEmails && modifiedEmails.length > 0
      ? modifiedEmails
      : fteState.emailDrafts;

    await setState(userId, { state: STATES.SENDING });

    // Fire and forget
    this.sendEmailsAsync(userId, emailsToSend).catch(err => {
      logAgentActivity('fte', 'send_error', { error: err.message });
      console.error('[FTE] sendEmailsAsync crashed:', err);
      setState(userId, { state: STATES.EMAIL_REVIEW, error: err.message }).catch(console.error);
    });

    return { botMessage: 'Emails bhej raha hoon...', state: STATES.SENDING };
  }

  /**
   * Async: send all emails + create Application records
   */
  async sendEmailsAsync(userId, emailDrafts) {
    const fteState = await getState(userId);
    const candidateProfile = fteState.candidateProfile;
    const userName = candidateProfile?.contactInfo?.name || 'Applicant';

    logAgentActivity('fte', 'sending_emails', { count: emailDrafts.length });

    // Verify SMTP connection before attempting sends
    const smtpOk = await emailService.verifyConnection();
    if (!smtpOk) {
      console.error('[FTE] SMTP connection FAILED. Check EMAIL_USER and EMAIL_PASS in .env');
      console.error(`[FTE] EMAIL_USER=${process.env.EMAIL_USER}, EMAIL_HOST=${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
      await setState(userId, {
        state: STATES.DONE,
        sendResults: [{ success: false, error: 'Gmail SMTP connection failed. Check EMAIL_USER and EMAIL_PASS in .env (must be a Gmail App Password).' }],
      });
      return;
    }
    console.log('[FTE] SMTP connection verified. Starting email sends...');

    const sendResults = [];

    for (const draft of emailDrafts) {
      // Skip drafts where email was not found
      if (!draft.hrEmail || draft.error) {
        sendResults.push({
          jobId: draft.jobId,
          company: draft.job?.company,
          jobTitle: draft.job?.title,
          hrEmail: null,
          success: false,
          error: draft.error || 'HR email nahi mili',
        });
        continue;
      }

      try {
        // Ensure body is never empty — fallback to simple template
        const emailBody = draft.body || `Dear Hiring Manager,\n\nI am applying for the ${draft.job?.title || 'position'} role at ${draft.job?.company || 'your company'}. Please find my CV attached.\n\nBest regards,\n${userName}`;
        const emailSubject = draft.subject || `Application for ${draft.job?.title || 'Position'} — ${userName}`;

        console.log(`[FTE] Sending email to ${draft.hrEmail} for ${draft.job?.company}...`);
        const result = await emailService.sendApplicationEmail({
          to: draft.hrEmail,
          subject: emailSubject,
          body: emailBody,
          cvPath: draft.cvPath,
          userName,
          companyName: draft.job?.company,
        });

        // Save Job to DB if not already saved (for Application record)
        let savedJob;
        try {
          savedJob = await Job.findOneAndUpdate(
            { userId, title: draft.job.title, company: draft.job.company },
            {
              userId,
              title: draft.job.title,
              company: draft.job.company,
              location: draft.job.location,
              description: draft.job.description || '',
              source: 'api',
              sourceUrl: draft.job.sourceUrl || null,
              status: 'new',
            },
            { upsert: true, new: true }
          );
        } catch (e) {
          savedJob = null;
        }

        // Create Application record
        if (savedJob) {
          try {
            await Application.findOneAndUpdate(
              { userId, jobId: savedJob._id },
              {
                userId,
                jobId: savedJob._id,
                coverLetter: draft.body,
                status: 'sent',
                sentAt: new Date(),
              },
              { upsert: true }
            );
          } catch (e) {
            logAgentActivity('fte', 'application_save_error', { error: e.message });
          }
        }

        sendResults.push({
          jobId: draft.jobId,
          company: draft.job?.company,
          jobTitle: draft.job?.title,
          hrEmail: draft.hrEmail,
          success: true,
          messageId: result.messageId,
        });

        logAgentActivity('fte', 'email_sent', { company: draft.job?.company, to: draft.hrEmail });
      } catch (err) {
        console.error(`[FTE] Email send FAILED for ${draft.job?.company} → ${draft.hrEmail}:`, err.message);
        if (err.code) console.error(`[FTE] SMTP error code: ${err.code}, response: ${err.response || err.responseCode}`);
        logAgentActivity('fte', 'email_send_failed', { company: draft.job?.company, error: err.message, code: err.code });
        sendResults.push({
          jobId: draft.jobId,
          company: draft.job?.company,
          jobTitle: draft.job?.title,
          hrEmail: draft.hrEmail,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = sendResults.filter(r => r.success).length;

    await setState(userId, {
      state: STATES.DONE,
      sendResults,
    });

    // Save to history (non-critical — don't let this crash the pipeline)
    try {
      await saveToHistory(userId, await getState(userId), successCount);
    } catch (histErr) {
      console.error('[FTE] saveToHistory failed:', histErr.message);
    }

    logAgentActivity('fte', 'pipeline_done', {
      sent: successCount,
      failed: sendResults.filter(r => !r.success).length,
    });
  }

  // ── Exposed helpers for route layer ──────────────────────────────────────────
  getStateForUser(userId) { return getState(userId); }
  getHistory(userId) { return getHistoryList(userId); }
  resetUser(userId) { return resetState(userId); }
}

const fteAgent = new FTEAgent();
module.exports = fteAgent;
