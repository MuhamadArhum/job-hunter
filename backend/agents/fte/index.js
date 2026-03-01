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
const { ResumeBuilderChains, ApplyChains, FTEChains, OrchestratorChains, PrepChains, runPrompt } = require('../../services/langchain/chains');
const { FTE_PROMPTS } = require('../../services/langchain/prompts');
const { generateCVPdfs } = require('../../services/cvPdfService');
const { emailService } = require('../../services/emailService');
const { logAgentActivity } = require('../../services/langchain/langfuse');
const OrchestratorAgent = require('../orchestrator');

// ─── States ───────────────────────────────────────────────────────────────────
const STATES = {
  WAITING_CV:           'waiting_cv',
  CV_UPLOADED:          'cv_uploaded',         // kept for backward compat
  READY:                'ready',               // has CV, free to give any command
  ASKING_LOCATION:      'asking_location',
  SEARCHING:            'searching',
  GENERATING_CVS:       'generating_cvs',
  CV_REVIEW:            'cv_review',
  FINDING_EMAILS:       'finding_emails',
  EMAIL_REVIEW:         'email_review',
  SENDING:              'sending',
  PREPARING_INTERVIEW:  'preparing_interview',
  DONE:                 'done',
};

const ASYNC_STATES = new Set([
  STATES.SEARCHING,
  STATES.GENERATING_CVS,
  STATES.FINDING_EMAILS,
  STATES.SENDING,
  STATES.PREPARING_INTERVIEW,
]);

const DEFAULT_STATE = {
  state: STATES.WAITING_CV,
  role: null,
  location: null,
  lastRole: null,       // remembered for follow-up searches
  lastLocation: null,   // remembered for follow-up searches
  jobs: [],
  cvResults: [],
  cvReviewApprovalId: null,
  emailDrafts: [],
  emailReviewApprovalId: null,
  sendResults: [],
  prepResults: [],      // interview questions per applied company
  candidateProfile: null,
  cvFilePath: null,
  history: [],          // conversation history — last 10 messages
  activityLog: [],      // real-time agent activity for frontend panel
};

const DEFAULT_SETTINGS = {
  // Job Preferences
  maxJobs:        5,          // 1–10
  defaultRole:    '',
  defaultCity:    '',
  jobType:        'any',      // 'any' | 'remote' | 'onsite' | 'hybrid'
  // Email Settings
  emailSignature: '',
  ccMyself:       false,
  emailLanguage:  'english',  // 'english' | 'urdu'
  // Pipeline Settings
  minAtsScore:    0,          // filter CVs below this ATS%
  autoApproveCvs: false,
  autoApproveAts: 80,
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

async function getSettings(userId) {
  const mem = await Memory.findOne({
    userId,
    memoryType: 'long_term',
    category: 'preferences',
    key: 'settings',
  });
  return { ...DEFAULT_SETTINGS, ...(mem?.value || {}) };
}

async function saveSettings(userId, updates) {
  const current = await getSettings(userId);
  const merged = { ...current, ...updates };
  await Memory.findOneAndUpdate(
    { userId, memoryType: 'long_term', category: 'preferences', key: 'settings' },
    { userId, memoryType: 'long_term', category: 'preferences', key: 'settings', value: merged },
    { upsert: true, new: true }
  );
  return merged;
}

// ─── Activity log helper ───────────────────────────────────────────────────────
async function pushActivity(userId, message, type = 'info') {
  try {
    const current = await getState(userId);
    const log = Array.isArray(current.activityLog) ? current.activityLog : [];
    log.push({ id: Date.now() + Math.random(), message, type, ts: new Date().toISOString() });
    // Keep last 80 items
    if (log.length > 80) log.splice(0, log.length - 80);
    await setState(userId, { activityLog: log });
  } catch (e) {
    // Non-critical — don't crash pipeline if activity log fails
    console.warn('[FTE] pushActivity error:', e.message);
  }
}

// ─── Known cities list (used by both intent detection and entity extraction) ──
const KNOWN_CITIES = [
  'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad', 'multan',
  'peshawar', 'quetta', 'sialkot', 'hyderabad', 'gujranwala', 'abbottabad',
  'remote', 'anywhere', 'pakistan', 'dubai', 'riyadh', 'london', 'toronto',
];

// ─── Keyword-based intent detection (fast, no LLM, works for Roman Urdu) ─────
function detectIntentFromKeywords(text) {
  const t = text.toLowerCase();

  // APPLY keywords (check first — "email bhejo" = apply, not job search)
  if (/\b(apply|bhejo|bhej|send|emails?|application|submit|laga\s*do|bhejna|applications)\b/.test(t)) return 'APPLY';

  // RESUME keywords
  if (/\b(cv|resume|bana|generate|tayyar|create|banao|bio\s*data)\b/.test(t)) return 'RESUME';

  // JOB_SEARCH keywords (jobs, dhundho, naukri, vacancy etc.)
  if (/\b(job|jobs|dhundh|search|naukri|position|vacancy|opening|hire|hiring|rozgar|career)\b/.test(t)) return 'JOB_SEARCH';

  // If message contains a KNOWN city → likely "Role City" pattern → JOB_SEARCH
  // Use strict city matching to avoid false positives ("hello", "kya hal hai")
  if (text.trim().length < 80 && extractKnownCity(text)) return 'JOB_SEARCH';

  return null; // Let LLM decide
}

// ─── Extract only KNOWN cities (strict — no fallback to arbitrary text) ──────
function extractKnownCity(text) {
  const lower = text.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (lower.includes(city)) return city.charAt(0).toUpperCase() + city.slice(1);
  }
  return null;
}

// ─── Simple entity extraction (no LLM needed for location) ───────────────────
function extractLocationFromText(text) {
  // Try known cities first
  const known = extractKnownCity(text);
  if (known) return known;
  // Fallback: use entire message as location if short (for ASKING_LOCATION state)
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length < 30) return trimmed;
  return null;
}

// ─── Extract explicit job count from user message ─────────────────────────────
function extractJobCountFromText(text) {
  const patterns = [
    /\b(\d+)\s*jobs?\b/i,
    /\bsirf\s*(\d+)\b/i,
    /\bfind\s*(?:me\s*)?(\d+)\b/i,
    /\b(\d+)\s*results?\b/i,
    /\b(\d+)\s*positions?\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseInt(m[1]);
      if (n >= 1 && n <= 10) return n;
    }
  }
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
    messages: fteState.history || [],
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

async function getHistorySession(userId, key) {
  const record = await Memory.findOne({
    userId,
    memoryType: 'long_term',
    category: 'fte_history',
    key,
  });
  return record?.value || null;
}

// ─── Main FTE Agent ───────────────────────────────────────────────────────────
class FTEAgent {

  /**
   * Main chat entry point — intent-based routing (Phase 1)
   * User can type anything freely; system figures out what to do.
   * Returns: { botMessage, state, data? }
   */
  async chat(userId, message, uploadedFile = null) {
    const fteState = await getState(userId);

    // ── /reset works from any state ─────────────────────────────────────────
    if (message && message.trim().toLowerCase() === '/reset') {
      const fresh = await resetState(userId);
      return {
        botMessage: 'Reset complete! Starting fresh.\n\nPlease upload your **CV (PDF)** to begin.',
        state: fresh.state,
      };
    }

    // ── Async ops in progress → just inform ─────────────────────────────────
    if (ASYNC_STATES.has(fteState.state)) {
      const msgs = {
        searching:            'Searching for jobs, please wait... _(polling in progress)_',
        generating_cvs:       'Generating tailored CVs, please wait...',
        finding_emails:       'Finding HR emails and drafting applications...',
        sending:              'Sending emails...',
        preparing_interview:  'Generating interview questions, please wait...',
      };
      await pushActivity(userId, `⚠️ Prompt ignore kiya — agent abhi busy hai: ${fteState.state}`, 'warn');
      return { botMessage: msgs[fteState.state] || 'Working on it...', state: fteState.state };
    }

    // ── New CV upload → always accept ────────────────────────────────────────
    if (uploadedFile) {
      return await this.handleCVUpload(userId, uploadedFile);
    }

    // ── Pending HITL approvals → remind ─────────────────────────────────────
    if (fteState.state === STATES.CV_REVIEW) {
      await pushActivity(userId, '⚠️ Action blocked — CVs pending aapke review ka intezaar hai', 'warn');
      return {
        botMessage: 'Your tailored CVs are ready! Review the cards below and click **Approve** or **Reject**.',
        state: fteState.state,
        data: { cvResults: fteState.cvResults, cvReviewApprovalId: fteState.cvReviewApprovalId },
      };
    }
    if (fteState.state === STATES.EMAIL_REVIEW) {
      await pushActivity(userId, '⚠️ Action blocked — Email drafts pending aapke review ka intezaar hai', 'warn');
      return {
        botMessage: 'Email drafts are ready! Review them below and click **Send All** to proceed.',
        state: fteState.state,
        data: { emailDrafts: fteState.emailDrafts, emailReviewApprovalId: fteState.emailReviewApprovalId },
      };
    }

    // ── No CV yet → welcome + ask ────────────────────────────────────────────
    // ── Empty message ────────────────────────────────────────────────────────
    if (!message || message.trim().length === 0) {
      if (!fteState.candidateProfile) {
        return {
          botMessage: `Hello! I am your **Digital FTE** — your personal job hunting assistant.\n\nHere is what I do for you:\n• **Find jobs** (Google Jobs via SerpAPI)\n• **Generate a tailored CV** for each job (with ATS score)\n• **Automatically email HR** with your application\n\nTo get started, please upload your **CV (PDF)**.`,
          state: STATES.WAITING_CV,
        };
      }
      return this.readyMessage(fteState);
    }

    const text = message.trim();

    // ── Save user message to history ─────────────────────────────────────────
    await this.addToHistory(userId, fteState, 'user', text);

    // ── LLM Brain: one call decides reply + action ────────────────────────────
    return await this.thinkAndAct(userId, text, fteState);
  }

  /** Ready state welcome — shows what the user can do */
  readyMessage(fteState) {
    const name = fteState.candidateProfile?.contactInfo?.name || 'there';
    const parts = [];
    if (fteState.jobs?.length)        parts.push(`• **Jobs found:** ${fteState.jobs.length}`);
    if (fteState.cvResults?.length)   parts.push(`• **CVs generated:** ${fteState.cvResults.length}`);
    if (fteState.emailDrafts?.length) parts.push(`• **Email drafts:** ${fteState.emailDrafts.length}`);
    const summary = parts.length ? '\n\n**Pipeline status:**\n' + parts.join('\n') : '';
    return {
      botMessage: `CV received, **${name}**! What would you like to do?${summary}\n\n**Try these commands:**\n• _"Software Engineer Karachi"_ → search jobs\n• _"Generate CVs"_ → create tailored CVs\n• _"Apply now"_ → send emails\n• _"/reset"_ → start over`,
      state: fteState.state || STATES.READY,
    };
  }

  /**
   * Brain method: LLM reads full context → decides reply + action
   * Replaces: keyword detection + intent detection + handleGeneralChat
   */
  async thinkAndAct(userId, text, fteState) {
    // Build context for LLM
    const context = {
      hasCv:         fteState.candidateProfile ? 'Yes' : 'No',
      candidateName: fteState.candidateProfile?.contactInfo?.name || 'Unknown',
      jobCount:      fteState.jobs?.length || 0,
      role:          fteState.lastRole || fteState.role || 'none',
      location:      fteState.lastLocation || fteState.location || 'none',
      cvCount:       fteState.cvResults?.filter(r => r.cv)?.length || 0,
      emailCount:    fteState.emailDrafts?.filter(r => !r.error)?.length || 0,
      sentCount:     fteState.sendResults?.filter(r => r.success)?.length || 0,
      history:       (fteState.history || []).slice(-12)
                       .map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.content}`)
                       .join('\n') || '(no history)',
      message:       text,
    };

    let brain;
    try {
      brain = await FTEChains.think(context, userId);
      logAgentActivity('fte', 'brain_result', {
        thinking: brain.thinking,
        action: brain.action,
        actionParams: brain.actionParams,
      });
    } catch (err) {
      logAgentActivity('fte', 'brain_error', { error: err.message });
      // Fallback: safe generic reply
      return {
        botMessage: 'What would you like to do?\n• _"Software Engineer Karachi"_ → search jobs\n• _"Generate CVs"_ → tailored CVs\n• _"Apply now"_ → send emails\n• _"/reset"_ → reset',
        state: fteState.state || STATES.READY,
      };
    }

    const reply = brain.message || 'I did not understand that. Please try again.';
    const action = brain.action || 'none';

    // ── Execute the action the LLM chose ─────────────────────────────────────
    if (action === 'search_jobs') {
      const settings = await getSettings(userId);
      const role     = brain.actionParams?.role     || fteState.lastRole || settings.defaultRole;
      const location = brain.actionParams?.location || fteState.lastLocation || settings.defaultCity;
      const promptJobCount = extractJobCountFromText(text);

      if (!role || !location) {
        const needRole = !role;
        await this.addToHistory(userId, await getState(userId), 'bot', reply);
        return {
          botMessage: reply || (needRole
            ? 'Kaunsi role ke liye jobs chahiye?'
            : 'Kaunse city mein job chahiye?'),
          state: fteState.state,
        };
      }

      await setState(userId, {
        state: STATES.SEARCHING, role, location,
        lastRole: role, lastLocation: location,
        jobs: [], cvResults: [], emailDrafts: [], sendResults: [],
      });
      this.runPipelineAsync(userId, promptJobCount).catch(async err => {
        console.error('[FTE] Pipeline crashed:', err);
        await pushActivity(userId, `❌ Pipeline crash: ${err.message}`, 'error');
        setState(userId, { state: STATES.READY, error: err.message }).catch(console.error);
      });
      await this.addToHistory(userId, await getState(userId), 'bot', reply);
      return { botMessage: reply, state: STATES.SEARCHING };
    }

    if (action === 'generate_cvs') {
      if (!fteState.jobs?.length) {
        await this.addToHistory(userId, await getState(userId), 'bot', reply);
        return { botMessage: reply, state: fteState.state };
      }
      await setState(userId, { state: STATES.GENERATING_CVS, cvResults: [] });
      this.runCVGenerationAsync(userId).catch(async err => {
        await pushActivity(userId, `❌ CV generation crash: ${err.message}`, 'error');
        setState(userId, { state: STATES.READY, error: err.message }).catch(console.error);
      });
      await this.addToHistory(userId, await getState(userId), 'bot', reply);
      return { botMessage: reply, state: STATES.GENERATING_CVS };
    }

    if (action === 'find_emails') {
      if (fteState.emailDrafts?.length) {
        await this.addToHistory(userId, await getState(userId), 'bot', reply);
        return {
          botMessage: reply,
          state: STATES.EMAIL_REVIEW,
          data: { emailDrafts: fteState.emailDrafts, emailReviewApprovalId: fteState.emailReviewApprovalId },
        };
      }
      if (!fteState.cvResults?.length) {
        await this.addToHistory(userId, await getState(userId), 'bot', reply);
        return { botMessage: reply, state: fteState.state };
      }
      await setState(userId, { state: STATES.FINDING_EMAILS });
      this.findEmailsAsync(userId).catch(async err => {
        await pushActivity(userId, `❌ Email finding crash: ${err.message}`, 'error');
        setState(userId, { state: STATES.READY, error: err.message }).catch(console.error);
      });
      await this.addToHistory(userId, await getState(userId), 'bot', reply);
      return { botMessage: reply, state: STATES.FINDING_EMAILS };
    }

    if (action === 'prepare_interview') {
      await setState(userId, { state: STATES.PREPARING_INTERVIEW });
      this.prepInterviewAsync(userId).catch(async err => {
        console.error('[FTE] prepInterviewAsync crashed:', err);
        await pushActivity(userId, `❌ Interview prep crash: ${err.message}`, 'error');
        setState(userId, { state: STATES.DONE, error: err.message }).catch(console.error);
      });
      await this.addToHistory(userId, await getState(userId), 'bot', reply);
      return { botMessage: reply, state: STATES.PREPARING_INTERVIEW };
    }

    // action === 'none' — just reply
    await this.addToHistory(userId, await getState(userId), 'bot', reply);
    return { botMessage: reply, state: fteState.state || STATES.READY };
  }

  /** Add a message to conversation history (max 20 messages) */
  async addToHistory(userId, fteState, role, content, type = 'text', data = null) {
    const history = Array.isArray(fteState.history) ? fteState.history : [];
    const entry = { role, type, content, ts: Date.now() };
    if (data !== null) entry.data = data;
    history.push(entry);
    // Keep last 20 messages only
    if (history.length > 20) history.splice(0, history.length - 20);
    await setState(userId, { history });
  }

  /**
   * Run ONLY the CV generation step (STEP 2 of pipeline)
   * Used when user says "CVs banao" and jobs already exist
   */
  async runCVGenerationAsync(userId) {
    const fteState = await getState(userId);
    const { jobs, candidateProfile } = fteState;

    if (!jobs?.length) {
      await setState(userId, { state: STATES.READY, error: 'Please search for jobs first.' });
      return;
    }

    logAgentActivity('fte', 'cv_generation_only', { jobCount: jobs.length });
    const cvOrchestrator = new OrchestratorAgent(userId);
    await cvOrchestrator.initialize(`fte_cv_only_${Date.now()}`);

    const selectedJobs = jobs.slice(0, 5);
    const cvResults = [];

    for (let i = 0; i < selectedJobs.length; i++) {
      const job = selectedJobs[i];
      try {
        const cvTaskResults = await cvOrchestrator.executeTasks([{
          id: i + 1, agent: 'resumeBuilder', action: 'generate_cv',
          originalCV: candidateProfile,
          targetJob: {
            title: job.title, company: job.company,
            location: job.location,
            description: (job.description || '').substring(0, 800),
            requirements: job.requirements || [],
          },
        }]);

        const cvData = cvTaskResults[i + 1]?.data;
        const raw = cvData?.cv || cvData || {};
        const sections = raw.sections || raw.cv?.sections || raw;
        const skillsRaw = sections.skills || [];
        const skillsFlat = Array.isArray(skillsRaw)
          ? skillsRaw
          : [...(skillsRaw.technical || []), ...(skillsRaw.soft || []), ...(skillsRaw.tools || [])];

        cvResults.push({
          jobId: job._id?.toString() || `job_${i}`,
          job,
          cv: { ...sections, skills: skillsFlat },
          atsScore: raw.atsScore || cvData?.atsScore || { overall: 70 },
          matchedKeywords: raw.matchedKeywords || [],
          recommendations: raw.suggestions || [],
        });
      } catch (err) {
        cvResults.push({ jobId: job._id?.toString() || `job_${i}`, job, cv: null, error: err.message });
      }
    }

    // Generate tailored PDFs
    const cvResultsWithPdf = await generateCVPdfs(cvResults, userId);

    // Create cv_review approval (reuse existing logic)
    const Approval = require('../../models/Approval');
    const approval = await Approval.createPending({
      userId, approvalType: 'cv_review',
      taskId: `fte_cv_only_${Date.now()}`, agentId: 'fte',
      title: `Review ${cvResultsWithPdf.filter(r => r.cv).length} Tailored CVs`,
      description: 'Review generated CVs before applying',
      content: { original: { cvResults: cvResultsWithPdf, pipelineType: 'fte' } },
      metadata: { urgency: 'normal', autoExpire: false },
    });

    await setState(userId, { state: STATES.CV_REVIEW, cvResults: cvResultsWithPdf, cvReviewApprovalId: approval.approvalId });

    // Save to conversation history
    const stateAfterCVGen = await getState(userId);
    const validGenCVs = cvResultsWithPdf.filter(r => r.cv).length;
    await this.addToHistory(
      userId, stateAfterCVGen, 'bot',
      `${validGenCVs} tailored CV${validGenCVs !== 1 ? 's' : ''} are ready! Review and approve to continue.`,
      'cv_approval',
      { cvResults: cvResultsWithPdf, cvReviewApprovalId: approval.approvalId }
    );
  }

  /**
   * Handle CV file upload
   */
  async handleCVUpload(userId, file) {
    logAgentActivity('fte', 'cv_upload_started', { userId, filename: file.originalname });
    await pushActivity(userId, `📄 CV mil gayi "${file.originalname}" — parse ho rahi hai...`, 'info');
    try {
      // Parse PDF
      const pdfBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(pdfBuffer);
      const resumeText = pdfData.text;

      if (!resumeText || resumeText.trim().length < 50) {
        await pushActivity(userId, '❌ CV parse nahi ho saki — valid PDF chahiye', 'error');
        return {
          botMessage: 'Could not parse the CV. Please upload a valid PDF resume.',
          state: STATES.WAITING_CV,
        };
      }

      await pushActivity(userId, '🤖 CV text extract ho gaya — AI se profile bana raha hoon...', 'info');
      // Extract structured profile via LLM
      const parsed = await ResumeBuilderChains.parseCV(resumeText, userId);

      const candidateProfile = parsed.parsed || parsed;
      const cvFilePath = file.path;

      await setState(userId, {
        state: STATES.READY,
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
      await pushActivity(userId, `✅ CV parse ho gayi! Naam: ${name} | ${skillCount} skills detect hue`, 'success');

      return {
        botMessage: `CV received! ✓ **${name}** — ${skillCount} skills detected.\n\nNow tell me in one message — **what role** and **which city** are you looking for?\n\n_(e.g. "Software Engineer Karachi" or "Data Analyst in Lahore")_`,
        state: STATES.READY,
      };
    } catch (err) {
      logAgentActivity('fte', 'cv_upload_error', { error: err.message });
      await pushActivity(userId, `❌ CV parse error: ${err.message}`, 'error');
      return {
        botMessage: `Failed to parse CV: ${err.message}. Please try again with a valid PDF.`,
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
        botMessage: 'Please tell me the role and city, e.g. "Software Engineer Karachi".',
        state: STATES.READY,
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
      this.runPipelineAsync(userId).catch(async err => {
        logAgentActivity('fte', 'pipeline_error', { error: err.message });
        console.error('[FTE] Pipeline crashed:', err);
        await pushActivity(userId, `❌ Pipeline crash: ${err.message}`, 'error');
        setState(userId, { state: STATES.READY, error: err.message }).catch(console.error);
      });
      return {
        botMessage: `Searching for **${role}** jobs in **${location}**... _(this may take 15-30 seconds)_`,
        state: STATES.SEARCHING,
      };
    }

    // Only role found — ask for city
    await setState(userId, { state: STATES.ASKING_LOCATION, role });
    return {
      botMessage: `**${role}** — great choice!\n\nWhich city are you looking for? (e.g. Karachi, Lahore, Islamabad, Remote)`,
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
        botMessage: 'Please provide a city name, e.g. Karachi, Lahore, or Remote.',
        state: STATES.ASKING_LOCATION,
      };
    }

    await setState(userId, { state: STATES.SEARCHING, location });

    // Fire and forget
    this.runPipelineAsync(userId).catch(async err => {
      logAgentActivity('fte', 'pipeline_error', { error: err.message });
      console.error('[FTE] Pipeline crashed:', err);
      await pushActivity(userId, `❌ Pipeline crash: ${err.message}`, 'error');
      setState(userId, { state: STATES.CV_UPLOADED, error: err.message }).catch(console.error);
    });

    return {
      botMessage: `Searching for **${fteState.role}** jobs in **${location}**... (this may take 15-30 seconds)`,
      state: STATES.SEARCHING,
    };
  }

  /**
   * Async pipeline: Orchestrator coordinates jobSearch + resumeBuilder agents
   * → creates cv_review approval for HITL
   * Fire-and-forget, state updated in MongoDB
   */
  async runPipelineAsync(userId, promptJobCount = null) {
    const fteState = await getState(userId);
    const settings = await getSettings(userId);
    const maxJobs = Math.min(promptJobCount || settings.maxJobs || 5, 10);
    logAgentActivity('fte', 'pipeline_started', { userId, role: fteState.role, location: fteState.location, maxJobs });
    await pushActivity(userId, `🔍 Jobs dhundh raha hoon: "${fteState.role}" in "${fteState.location}" (max ${maxJobs})...`, 'info');

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
      await pushActivity(userId, `✅ ${jobs.length} jobs mili "${fteState.role}" ke liye!`, 'success');
    } catch (err) {
      logAgentActivity('fte', 'search_error', { error: err.message });
      await pushActivity(userId, `❌ Job search fail: ${err.message}`, 'error');
      await setState(userId, {
        state: STATES.READY,
        jobs: [],
        error: `Job search failed: ${err.message}`,
      });
      return;
    }

    // Limit to maxJobs for CV generation
    const selectedJobs = jobs.slice(0, maxJobs);

    if (selectedJobs.length === 0) {
      await pushActivity(userId, `⚠️ Koi job nahi mili "${fteState.role}" in "${fteState.location}"`, 'error');
      await setState(userId, {
        state: STATES.READY,
        jobs: [],
        error: `No jobs found for "${fteState.role}" in "${fteState.location}". Try a different role or city.`,
      });
      return;
    }

    await pushActivity(userId, `📝 ${selectedJobs.length} jobs select ki gayi — tailored CVs bana raha hoon...`, 'info');
    await setState(userId, { state: STATES.GENERATING_CVS, jobs: selectedJobs });

    // ── STEP 2: Generate Tailored CVs via Orchestrator → resumeBuilder agent ─
    const cvOrchestrator = new OrchestratorAgent(userId);
    await cvOrchestrator.initialize(`fte_cv_${Date.now()}`);

    const currentState = await getState(userId);
    const candidateProfile = currentState.candidateProfile;
    const cvResults = [];

    for (let i = 0; i < selectedJobs.length; i++) {
      const job = selectedJobs[i];
      await pushActivity(userId, `📝 CV bana raha hoon [${i+1}/${selectedJobs.length}]: ${job.company} — ${job.title}`, 'info');
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

        const ats = cvData?.atsScore || raw.atsScore || null;
        const atsStr = ats?.overall ? ` — ATS: ${ats.overall}%` : '';
        await pushActivity(userId, `✅ CV ready: ${job.company}${atsStr}`, 'success');

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
          atsScore:        ats,
          recommendations: cvData?.recommendations || raw.suggestions || [],
          matchedKeywords: raw.matchedKeywords || [],
        });
      } catch (err) {
        logAgentActivity('fte', 'cv_generation_error', { job: job.title, error: err.message });
        await pushActivity(userId, `❌ CV failed: ${job.company} — ${err.message}`, 'error');
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

    // ── STEP 2b: Generate tailored PDF for each CV ────────────────────────────
    await pushActivity(userId, '🖨️ Tailored PDF CVs generate ho rahi hain...', 'info');
    const cvResultsWithPdf = await generateCVPdfs(cvResults, userId);
    logAgentActivity('fte', 'pdfs_generated', { count: cvResultsWithPdf.filter(r => r.hasPdf).length });
    await pushActivity(userId, `📄 ${cvResultsWithPdf.filter(r=>r.hasPdf).length} PDFs ready!`, 'success');

    // Filter by minAtsScore if set
    let filteredCVs = cvResultsWithPdf;
    if (settings.minAtsScore > 0) {
      filteredCVs = cvResultsWithPdf.filter(r => {
        if (r.error || !r.cv) return false;
        const score = r.atsScore?.overall ?? r.atsScore?.format ?? 0;
        return score >= settings.minAtsScore;
      });
      if (filteredCVs.length < cvResultsWithPdf.length) {
        await pushActivity(userId, `🔍 ATS filter (${settings.minAtsScore}%): ${filteredCVs.length} CVs pass, ${cvResultsWithPdf.length - filteredCVs.length} removed`, 'info');
      }
      if (!filteredCVs.length) filteredCVs = cvResultsWithPdf; // fallback: keep all if all filtered out
    }

    // Auto-approve if setting is on and all valid CVs meet threshold
    if (settings.autoApproveCvs) {
      const validCVs = filteredCVs.filter(r => r.cv && !r.error);
      const allPass = validCVs.every(r => {
        const score = r.atsScore?.overall ?? r.atsScore?.format ?? 0;
        return score >= (settings.autoApproveAts || 80);
      });
      if (validCVs.length > 0 && allPass) {
        await pushActivity(userId, `✅ Auto-approve: sab CVs ATS ${settings.autoApproveAts}%+ hain — HR emails dhundh raha hoon...`, 'success');
        await setState(userId, { state: STATES.FINDING_EMAILS, cvResults: filteredCVs });
        this.findEmailsAsync(userId).catch(async err => {
          await pushActivity(userId, `❌ Email finding crash: ${err.message}`, 'error');
          setState(userId, { state: STATES.CV_REVIEW, error: err.message }).catch(console.error);
        });
        return;
      }
    }

    await pushActivity(userId, '⏳ Aapke approval ka intezaar hai...', 'info');

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
      cvResults: filteredCVs,
      cvReviewApprovalId: approval.approvalId,
    });

    // Save to conversation history so reopened sessions show the CV cards
    const stateAfterCV = await getState(userId);
    const validCVCount = filteredCVs.filter(r => r.cv).length;
    await this.addToHistory(
      userId, stateAfterCV, 'bot',
      `${validCVCount} tailored CV${validCVCount !== 1 ? 's' : ''} are ready! Review and approve to continue.`,
      'cv_approval',
      { cvResults: filteredCVs, cvReviewApprovalId: approval.approvalId }
    );

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
    this.findEmailsAsync(userId).catch(async err => {
      logAgentActivity('fte', 'email_find_error', { error: err.message });
      console.error('[FTE] findEmailsAsync crashed:', err);
      await pushActivity(userId, `❌ Email finding crash: ${err.message}`, 'error');
      setState(userId, { state: STATES.CV_REVIEW, error: err.message }).catch(console.error);
    });

    return { botMessage: 'CVs approved! Finding HR emails and drafting applications...', state: STATES.FINDING_EMAILS };
  }

  /**
   * Async: find HR emails + draft emails via Orchestrator → apply agent
   * → create email_review approval for HITL
   */
  async findEmailsAsync(userId) {
    const fteState = await getState(userId);
    const { cvResults, candidateProfile, cvFilePath, role } = fteState;

    logAgentActivity('fte', 'finding_emails', { count: cvResults.length });
    await pushActivity(userId, `📧 HR emails dhundh raha hoon ${cvResults.filter(r=>r.cv).length} companies ke liye...`, 'info');

    // Initialize Orchestrator for email drafting
    const emailOrchestrator = new OrchestratorAgent(userId);
    await emailOrchestrator.initialize(`fte_email_${Date.now()}`);

    const emailDrafts = [];

    for (let i = 0; i < cvResults.length; i++) {
      const cvResult = cvResults[i];
      if (!cvResult.cv) continue; // skip failed CVs
      const { job } = cvResult;
      await pushActivity(userId, `🔎 HR email dhundh raha hoon: ${job.company}...`, 'info');
      try {
        const { findHREmail } = require('../../services/hunterService');
        const siteUrl = job.companyApplyUrl || job.sourceUrl || null;

        // ── STEP 1: Hunter.io — real verified emails ──────────────────────────
        let hrEmail    = null;
        let emailSource     = 'none';
        let emailVerified   = false;
        let emailVerifyResult = null;
        try {
          const hunterResult = await findHREmail(job.company, siteUrl);
          if (hunterResult.email) {
            hrEmail           = hunterResult.email;
            emailSource       = 'hunter';
            emailVerified     = hunterResult.verified || false;
            emailVerifyResult = hunterResult.verifyResult || 'unknown';
            logAgentActivity('fte', 'hunter_email_found', {
              company: job.company,
              email: hrEmail,
              verified: emailVerified,
              verifyResult: emailVerifyResult,
              domain: hunterResult.domain,
            });
            await pushActivity(userId, `✅ Email mila [Hunter.io]: ${job.company} → ${hrEmail}${emailVerified?' ✓':' ?'}`, 'success');
          } else {
            logAgentActivity('fte', 'hunter_email_not_found', { company: job.company, domain: hunterResult.domain });
          }
        } catch (hunterErr) {
          logAgentActivity('fte', 'hunter_error', { company: job.company, error: hunterErr.message });
        }

        // ── STEP 2: LLM fallback — only if Hunter.io found nothing ───────────
        if (!hrEmail) {
          await pushActivity(userId, `🤖 Hunter.io se nahi mila — AI se estimate kar raha hoon: ${job.company}...`, 'info');
          try {
            const websiteHint = siteUrl || null;
            const emailResult = await ApplyChains.findEmails(job.company, websiteHint, null, userId);
            const emails = emailResult?.emails || [];
            const best = emails.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
            hrEmail = best?.email || null;
            if (hrEmail) {
              emailSource = 'llm';
              await pushActivity(userId, `~ Email estimated [AI]: ${job.company} → ${hrEmail}`, 'info');
            }
            logAgentActivity('fte', 'llm_email_fallback', {
              company: job.company, email: hrEmail, candidates: emails.length,
            });
          } catch (emailErr) {
            logAgentActivity('fte', 'llm_email_error', { company: job.company, error: emailErr.message });
          }
        }

        if (!hrEmail) {
          logAgentActivity('fte', 'email_not_found', { company: job.company });
          await pushActivity(userId, `⚠️ ${job.company} ka HR email nahi mila — skip kar raha hoon`, 'error');
          emailDrafts.push({
            jobId: cvResult.jobId,
            job,
            hrEmail: null,
            subject: null,
            body: null,
            cvPath: cvResult.cvPdfPath || cvFilePath,
            atsScore: cvResult.atsScore,
            error: 'Could not find HR email for this company',
          });
          continue;
        }

        // ── Draft email via Orchestrator → apply agent ──────────────────────
        await pushActivity(userId, `✉️ Email draft bana raha hoon: ${job.company}...`, 'info');
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

        emailDrafts.push({
          jobId: cvResult.jobId,
          job,
          hrEmail,
          emailSource,       // 'hunter' | 'llm' | 'none'
          emailVerified,     // true if Hunter.io confirmed deliverable
          emailVerifyResult, // 'deliverable' | 'risky' | 'unknown'
          subject: draft?.subject || `Application for ${job.title} — ${candidateName}`,
          body: draft?.body || draft?.emailBody || draft?.content || null,
          cvPath: cvResult.cvPdfPath || cvFilePath,  // use tailored PDF, fall back to original
          atsScore: cvResult.atsScore,
        });
      } catch (err) {
        logAgentActivity('fte', 'draft_error', { company: job.company, error: err.message });
        await pushActivity(userId, `❌ Email draft fail: ${job.company} — ${err.message}`, 'error');
        emailDrafts.push({
          jobId: cvResult.jobId,
          job,
          hrEmail: null,
          subject: null,
          body: null,
          cvPath: cvResult.cvPdfPath || cvFilePath,
          atsScore: cvResult.atsScore,
          error: `Draft error: ${err.message}`,
        });
      }
    }

    logAgentActivity('fte', 'emails_drafted', { count: emailDrafts.length });
    await pushActivity(userId, `📬 ${emailDrafts.filter(d=>d.hrEmail).length} email drafts tayyar! Aapke review ka intezaar...`, 'success');

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

    // Save to conversation history so reopened sessions show the email cards
    const stateAfterEmail = await getState(userId);
    const validDrafts = emailDrafts.filter(d => d.hrEmail && !d.error).length;
    await this.addToHistory(
      userId, stateAfterEmail, 'bot',
      `${validDrafts} email draft${validDrafts !== 1 ? 's' : ''} ready! Review and approve to send.`,
      'email_approval',
      { emailDrafts, emailReviewApprovalId: approval.approvalId }
    );
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
    this.sendEmailsAsync(userId, emailsToSend).catch(async err => {
      logAgentActivity('fte', 'send_error', { error: err.message });
      console.error('[FTE] sendEmailsAsync crashed:', err);
      await pushActivity(userId, `❌ Email send crash: ${err.message}`, 'error');
      setState(userId, { state: STATES.EMAIL_REVIEW, error: err.message }).catch(console.error);
    });

    return { botMessage: 'Sending emails now...', state: STATES.SENDING };
  }

  /**
   * Async: send all emails + create Application records
   */
  async sendEmailsAsync(userId, emailDrafts) {
    const fteState = await getState(userId);
    const candidateProfile = fteState.candidateProfile;
    const userName = candidateProfile?.contactInfo?.name || 'Applicant';

    logAgentActivity('fte', 'sending_emails', { count: emailDrafts.length });
    await pushActivity(userId, `📤 ${emailDrafts.filter(d=>d.hrEmail).length} emails bhej raha hoon — SMTP verify kar raha hoon...`, 'info');

    // Verify SMTP connection before attempting sends
    const smtpOk = await emailService.verifyConnection();
    if (!smtpOk) {
      console.error('[FTE] SMTP connection FAILED. Check EMAIL_USER and EMAIL_PASS in .env');
      console.error(`[FTE] EMAIL_USER=${process.env.EMAIL_USER}, EMAIL_HOST=${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
      await pushActivity(userId, '❌ Gmail SMTP connection fail — EMAIL_USER/EMAIL_PASS check karein', 'error');
      await setState(userId, {
        state: STATES.DONE,
        sendResults: [{ success: false, error: 'Gmail SMTP connection failed. Check EMAIL_USER and EMAIL_PASS in .env (must be a Gmail App Password).' }],
      });
      return;
    }
    await pushActivity(userId, '✅ SMTP ready — emails bhej raha hoon...', 'success');
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
          error: draft.error || 'HR email not found',
        });
        continue;
      }

      try {
        const emailBody = draft.body;
        const emailSubject = draft.subject || `Application for ${draft.job?.title || 'Position'} — ${userName}`;

        if (!emailBody) {
          sendResults.push({ jobId: draft.jobId, company: draft.job?.company, success: false, error: 'Email body missing — LLM draft failed' });
          continue;
        }

        await pushActivity(userId, `📤 Bhej raha hoon: ${draft.job?.company} → ${draft.hrEmail}`, 'info');
        console.log(`[FTE] Sending email to ${draft.hrEmail} for ${draft.job?.company}...`);
        const settings = await getSettings(userId);
        const finalBody = settings.emailSignature
          ? `${emailBody}\n\n--\n${settings.emailSignature}`
          : emailBody;
        const result = await emailService.sendApplicationEmail({
          to: draft.hrEmail,
          cc: settings.ccMyself ? process.env.EMAIL_USER : undefined,
          subject: emailSubject,
          body: finalBody,
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
        await pushActivity(userId, `✅ Sent: ${draft.job?.company} (${draft.hrEmail})`, 'success');
      } catch (err) {
        console.error(`[FTE] Email send FAILED for ${draft.job?.company} → ${draft.hrEmail}:`, err.message);
        if (err.code) console.error(`[FTE] SMTP error code: ${err.code}, response: ${err.response || err.responseCode}`);
        logAgentActivity('fte', 'email_send_failed', { company: draft.job?.company, error: err.message, code: err.code });
        await pushActivity(userId, `❌ Failed: ${draft.job?.company} — ${err.message}`, 'error');
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
    await pushActivity(userId, `🎉 Done! ${successCount} applications sent, ${sendResults.length - successCount} failed`, successCount > 0 ? 'success' : 'error');

    await setState(userId, {
      state: STATES.DONE,
      sendResults,
    });

    // Save result message to conversation history
    const stateAfterDone = await getState(userId);
    await this.addToHistory(
      userId, stateAfterDone, 'bot',
      `Done! ${successCount} application${successCount !== 1 ? 's' : ''} sent successfully.`,
      'result',
      { sendResults }
    );

    // Offer interview prep if any emails were sent
    if (successCount > 0) {
      const appliedCompanies = sendResults.filter(r => r.success).map(r => r.company).filter(Boolean);
      const companyList = appliedCompanies.slice(0, 3).join(', ');
      const extra = appliedCompanies.length > 3 ? '...' : '';
      const prepOffer = `Want me to prepare **interview questions** for your applications (**${companyList}${extra}**)?\n\nJust say _"yes"_ or _"prepare interview"_.`;
      const stateForPrep = await getState(userId);
      await this.addToHistory(userId, stateForPrep, 'bot', prepOffer);
    }

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

  /**
   * Async: generate interview questions for each successfully applied company
   * → saves results to state + history as 'prep_questions' message
   * State: preparing_interview → done
   */
  async prepInterviewAsync(userId) {
    const fteState = await getState(userId);
    const { sendResults, candidateProfile, role } = fteState;
    const successfulApps = (sendResults || []).filter(r => r.success);

    if (!successfulApps.length) {
      await setState(userId, { state: STATES.DONE });
      return;
    }

    logAgentActivity('fte', 'prep_started', { count: successfulApps.length });

    const prepResults = [];

    // Limit to 3 companies to keep LLM usage reasonable
    for (const app of successfulApps.slice(0, 3)) {
      try {
        const experienceSummary = JSON.stringify(
          (candidateProfile?.experience || []).slice(0, 2)
        );
        const questions = await PrepChains.generateQuestions(
          app.jobTitle || role || 'Software Engineer',
          app.company,
          experienceSummary,
          userId
        );
        prepResults.push({
          company:  app.company,
          jobTitle: app.jobTitle || role,
          questions: {
            technical:   (questions.technical   || []).slice(0, 4),
            behavioral:  (questions.behavioral  || []).slice(0, 4),
            situational: (questions.situational || []).slice(0, 3),
          },
        });
        logAgentActivity('fte', 'prep_questions_generated', { company: app.company });
      } catch (err) {
        logAgentActivity('fte', 'prep_error', { company: app.company, error: err.message });
        prepResults.push({ company: app.company, jobTitle: app.jobTitle || role, error: err.message });
      }
    }

    await setState(userId, { state: STATES.DONE, prepResults });

    // Save to conversation history
    const stateAfterPrep = await getState(userId);
    const successPrep = prepResults.filter(p => !p.error).length;
    const companies = prepResults.filter(p => !p.error).map(p => p.company).join(', ');
    const summaryMsg = successPrep > 0
      ? `Interview prep ready for **${companies}**! Here are the questions to practice:`
      : 'Sorry, could not generate interview questions at this time.';

    await this.addToHistory(
      userId, stateAfterPrep, 'bot',
      summaryMsg,
      'prep_questions',
      { prepResults }
    );

    logAgentActivity('fte', 'prep_done', { count: prepResults.length });
  }

  // ── Exposed helpers for route layer ──────────────────────────────────────────
  getStateForUser(userId) { return getState(userId); }
  getHistory(userId) { return getHistoryList(userId); }
  getHistorySession(userId, key) { return getHistorySession(userId, key); }
  resetUser(userId) { return resetState(userId); }
  getUserSettings(userId) { return getSettings(userId); }
  updateUserSettings(userId, updates) { return saveSettings(userId, updates); }
  async getCVPdfPath(userId, jobId) {
    const state = await getState(userId);
    const result = (state.cvResults || []).find(r => r.jobId === jobId);
    return result?.cvPdfPath || null;
  }
}

const fteAgent = new FTEAgent();
module.exports = fteAgent;
