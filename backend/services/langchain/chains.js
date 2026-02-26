/**
 * LangChain LLM Chains
 * Provides chain execution utilities for agents
 */

const { getGroqClient, createTrace, logAgentActivity } = require('./langfuse');
const { ORCHESTRATOR_PROMPTS, JOB_SEARCH_PROMPTS, RESUME_BUILDER_PROMPTS, APPLY_PROMPTS, PREP_PROMPTS } = require('./prompts');

/**
 * Run a prompt through the LLM
 * @param {string} prompt - The prompt template
 * @param {Object} params - Parameters to fill in prompt
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Parsed LLM response
 */
const runPrompt = async (prompt, params = {}, options = {}) => {
  const { agentName = 'system', userId = 'unknown' } = options;
  
  // Replace template variables
  let filledPrompt = prompt;
  Object.keys(params).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    filledPrompt = filledPrompt.replace(regex, JSON.stringify(params[key], null, 2));
  });

  logAgentActivity(agentName, 'prompt_execution', { 
    promptLength: filledPrompt.length,
    params: Object.keys(params)
  });

  try {
    const groq = getGroqClient();
    const trace = createTrace(`${agentName}_prompt`, userId);

    const generation = trace.generation({
      name: `${agentName}_generation`,
      model: 'llama-3.3-70b-versatile',
    });

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant for a job hunting system. Always respond with valid JSON only. No markdown, no code blocks, just raw JSON.' },
        { role: 'user', content: filledPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content.trim();

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse LLM response as JSON: ${content.substring(0, 200)}`);
      }
    }

    generation.end({
      output: parsed,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      }
    });
    trace.end();

    logAgentActivity(agentName, 'prompt_completed', { success: true });

    return parsed;
  } catch (error) {
    logAgentActivity(agentName, 'prompt_error', { error: error.message });
    throw error;
  }
};


/**
 * Orchestrator Chains
 */
const OrchestratorChains = {
  detectIntent: (message, userId) => 
    runPrompt(ORCHESTRATOR_PROMPTS.intentDetection, { message }, { agentName: 'orchestrator', userId }),

  planTasks: (intent, message, entities, userId) =>
    runPrompt(ORCHESTRATOR_PROMPTS.taskPlanning, { intent, message, entities }, { agentName: 'orchestrator', userId }),

  generateResponse: (agentStatuses, message, recentActions, taskResults, userId) =>
    runPrompt(ORCHESTRATOR_PROMPTS.responseGeneration, { agentStatuses, message, recentActions, taskResults }, { agentName: 'orchestrator', userId }),
};

/**
 * Job Search Chains
 */
const JobSearchChains = {
  scrapeJobs: (preferences, userId) =>
    runPrompt(JOB_SEARCH_PROMPTS.jobScraping, { ...preferences }, { agentName: 'jobSearch', userId }),

  deduplicate: (jobs, userId) =>
    runPrompt(JOB_SEARCH_PROMPTS.deduplication, { jobs }, { agentName: 'jobSearch', userId }),

  matchJobs: (candidateProfile, jobs, userId) =>
    runPrompt(JOB_SEARCH_PROMPTS.jobMatching, { candidateProfile, jobs }, { agentName: 'jobSearch', userId }),
};

/**
 * Resume Builder Chains
 */
const ResumeBuilderChains = {
  parseCV: (resumeText, userId) =>
    runPrompt(RESUME_BUILDER_PROMPTS.cvParsing, { resumeText }, { agentName: 'resumeBuilder', userId }),

  generateCV: (originalCV, targetJob, userId) =>
    runPrompt(RESUME_BUILDER_PROMPTS.cvGeneration, { originalCV, targetJob }, { agentName: 'resumeBuilder', userId }),

  generateCoverLetter: (candidateProfile, targetJob, userId) =>
    runPrompt(RESUME_BUILDER_PROMPTS.coverLetter, { candidateProfile, targetJob }, { agentName: 'resumeBuilder', userId }),
};

/**
 * Apply Agent Chains
 */
const ApplyChains = {
  findEmails: (companyName, website, linkedin, userId) =>
    runPrompt(APPLY_PROMPTS.emailFinder, { companyName, website, linkedin }, { agentName: 'apply', userId }),

  draftEmail: (candidateInfo, targetJob, companyName, hrEmail, userId) =>
    runPrompt(APPLY_PROMPTS.emailDrafting, { candidateInfo, targetJob, companyName, hrEmail }, { agentName: 'apply', userId }),
};

/**
 * Prep Agent Chains
 */
const PrepChains = {
  generateQuestions: (targetJob, companyName, candidateExperience, userId) =>
    runPrompt(PREP_PROMPTS.interviewQuestions, { targetJob, companyName, candidateExperience }, { agentName: 'prep', userId }),

  analyzeSkillGap: (candidateSkills, jobRequirements, userId) =>
    runPrompt(PREP_PROMPTS.skillGapAnalysis, { candidateSkills, jobRequirements }, { agentName: 'prep', userId }),

  evaluateAnswer: (question, answer, userId) =>
    runPrompt(PREP_PROMPTS.mockInterviewFeedback, { question, answer }, { agentName: 'prep', userId }),
};

module.exports = {
  runPrompt,
  OrchestratorChains,
  JobSearchChains,
  ResumeBuilderChains,
  ApplyChains,
  PrepChains,
};
