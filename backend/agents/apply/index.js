/**
 * Apply Agent
 * Handles job applications, HR email finding, and Gmail integration
 */

const { logAgentActivity, createTrace } = require('../../services/langchain/langfuse');
const { ApplyChains } = require('../../services/langchain/chains');
const Agent = require('../../models/Agent');
const Application = require('../../models/Application');
const Job = require('../../models/Job');
const Memory = require('../../models/Memory');
const Approval = require('../../models/Approval');
const { emailService } = require('../../services/emailService');

class ApplyAgent {
  constructor() {
    this.emailTemplates = {
      application: {
        subject: 'Application for {{position}} - {{name}}',
        body: `Dear {{greeting}},

I am writing to express my strong interest in the {{position}} position at {{company}}. With my {{years}} years of experience in {{skills}}, I believe I would be a valuable addition to your team.

{{highlights}}

I am particularly drawn to {{company}} because {{company_interest}}. I am excited about the opportunity to contribute to your team and help drive {{company_goals}}.

Thank you for considering my application. I look forward to the opportunity to discuss how my background and skills would benefit {{company}}.

Best regards,
{{name}}
{{contact_info}}`,
      },
      followUp: {
        subject: 'Follow-up: {{position}} Application - {{name}}',
        body: `Dear {{greeting}},

I wanted to follow up on my application for the {{position}} position at {{company}} submitted on {{application_date}}.

I remain very excited about this opportunity and would love to discuss how my experience in {{skills}} aligns with your team's needs.

Please let me know if you need any additional information.

Best regards,
{{name}}`,
      },
    };
  }

  /**
   * Execute an apply task
   */
  async execute(userId, task, sessionId) {
    const trace = createTrace('apply', userId);
    const span = trace?.span({ name: 'apply_execution' });

    try {
      logAgentActivity('apply', 'task_started', { task, userId });

      await this.updateAgentStatus(userId, 'working', 'Processing application');

      const { action, tools, ...params } = task;

      switch (action) {
        case 'find_emails':
          return await this.findHREmails(userId, params, trace);
        case 'draft_email':
          return await this.draftEmail(userId, params, trace);
        case 'send_application':
          return await this.sendApplication(userId, params, trace);
        case 'track_applications':
          return await this.trackApplications(userId, params, trace);
        case 'send_follow_up':
          return await this.sendFollowUp(userId, params, trace);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      logAgentActivity('apply', 'error', { error: error.message, userId });
      await this.updateAgentStatus(userId, 'error', error.message);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Find HR/recruiter email addresses for a company
   */
  async findHREmails(userId, params, trace) {
    const { companyName, website, linkedin } = params;

    await this.updateAgentStatus(userId, 'working', `Finding HR emails for ${companyName}`);

    // Use LLM to research email patterns
    const result = await ApplyChains.findEmails(companyName, website, linkedin, userId);

    // Also try to find specific emails
    const additionalEmails = await this.searchEmailPatterns(companyName, website);

    // Merge results
    const allEmails = [...(result.emails || []), ...additionalEmails];

    // Remove duplicates
    const uniqueEmails = allEmails.filter((email, index, self) =>
      index === self.findIndex(e => e.email === email.email)
    );

    logAgentActivity('apply', 'emails_found', { 
      company: companyName, 
      count: uniqueEmails.length 
    });

    await this.updateAgentStatus(userId, 'completed', `Found ${uniqueEmails.length} email addresses`);

    return {
      emails: uniqueEmails,
      research: result.research,
    };
  }

  /**
   * Search for email patterns
   */
  async searchEmailPatterns(companyName, website) {
    const emails = [];
    
    // Extract domain from website
    const domain = website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    if (domain) {
      const companyNameNormalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Common email patterns
      const patterns = [
        `hr@${domain}`,
        `recruiting@${domain}`,
        `careers@${domain}`,
        `jobs@${domain}`,
        `recruiter@${domain}`,
        `hiring@${domain}`,
      ];

      // Verify each email (simplified - in production use an email verification service)
      for (const email of patterns) {
        emails.push({
          email,
          type: this.determineEmailType(email),
          confidence: 0.7,
          source: 'pattern_matching',
        });
      }
    }

    return emails;
  }

  /**
   * Determine email type
   */
  determineEmailType(email) {
    const emailLower = email.toLowerCase();
    if (emailLower.includes('hr')) return 'hr_general';
    if (emailLower.includes('recruit')) return 'recruiting';
    if (emailLower.includes('career')) return 'careers';
    if (emailLower.includes('hiring')) return 'hiring';
    if (emailLower.includes('jobs')) return 'jobs';
    return 'general';
  }

  /**
   * Draft an application email
   */
  async draftEmail(userId, params, trace) {
    const { targetJob, candidateInfo, hrEmail } = params;

    await this.updateAgentStatus(userId, 'working', 'Drafting application email');

    // Get candidate profile
    const candidateProfile = await this.getCandidateProfile(userId);

    // Generate email using LLM
    const result = await ApplyChains.draftEmail(
      candidateProfile || candidateInfo,
      targetJob,
      targetJob.company,
      hrEmail,
      userId
    );

    // Apply template if LLM fails
    if (!result.subject || !result.body) {
      const template = this.emailTemplates.application;
      result.subject = this.fillTemplate(template.subject, { ...candidateProfile, ...targetJob });
      result.body = this.fillTemplate(template.body, { ...candidateProfile, ...targetJob });
    }

    logAgentActivity('apply', 'email_drafted', { 
      subject: result.subject,
      company: targetJob.company 
    });

    await this.updateAgentStatus(userId, 'completed', 'Email drafted');

    return result;
  }

  /**
   * Fill email template
   */
  fillTemplate(template, data) {
    let result = template;
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data[key] || '');
    });
    return result;
  }

  /**
   * Send application (requires HITL approval)
   */
  async sendApplication(userId, params, trace) {
    const { targetJob, hrEmail, emailContent, cvAttachment } = params;

    await this.updateAgentStatus(userId, 'waiting_approval', 'Awaiting approval to send');

    // Get Gmail credentials from user
    const gmailCredentials = await this.getGmailCredentials(userId);

    if (!gmailCredentials) {
      throw new Error('Gmail not connected. Please connect your Gmail account first.');
    }

    // Create approval request
    const approval = await Approval.createPending({
      userId,
      approvalType: 'email_send',
      taskId: `apply_${Date.now()}`,
      agentId: 'apply',
      title: `Send application to ${targetJob.company}`,
      description: `Application for ${targetJob.title}`,
      content: {
        modified: {
          to: hrEmail,
          subject: emailContent.subject,
          body: emailContent.body,
          attachments: cvAttachment ? ['resume.pdf'] : [],
        },
      },
      metadata: {
        urgency: 'medium',
        autoExpire: true,
        expireAfter: 30,
      },
      traceUrl: trace ? `https://langfuse.cloud/traces/${trace.traceId}` : null,
    });

    logAgentActivity('apply', 'approval_requested', { 
      approvalId: approval.approvalId,
      company: targetJob.company 
    });

    // Update agent status
    await this.updateAgentStatus(userId, 'waiting_approval', 'Waiting for your approval');

    return {
      requiresApproval: true,
      approvalId: approval.approvalId,
      preview: {
        to: hrEmail,
        subject: emailContent.subject,
        body: emailContent.body,
      },
      message: 'Please review and approve this application before sending.',
    };
  }

  /**
   * Actually send the application (called after approval)
   */
  async sendApplicationConfirmed(userId, params, trace) {
    const { targetJob, hrEmail, emailContent, cvPath } = params;

    // Send email using email service
    const emailResult = await emailService.sendApplicationEmail({
      to: hrEmail,
      subject: emailContent.subject,
      body: emailContent.body,
      cvPath: cvPath || null,
      userName: null,
      companyName: targetJob.company,
    });

    // Create application record
    const application = await Application.create({
      userId,
      jobId: targetJob._id,
      company: targetJob.company,
      position: targetJob.title,
      hrEmail,
      emailContent: {
        subject: emailContent.subject,
        body: emailContent.body,
      },
      status: 'applied',
      appliedAt: new Date(),
      emailMessageId: emailResult.messageId,
    });

    // Update job status
    await Job.findByIdAndUpdate(targetJob._id, {
      status: 'applied',
      appliedAt: new Date(),
    });

    logAgentActivity('apply', 'application_sent', { 
      applicationId: application._id,
      company: targetJob.company 
    });

    await this.updateAgentStatus(userId, 'completed', 'Application sent');

    return {
      success: true,
      applicationId: application._id,
      message: `Application sent to ${hrEmail}`,
    };
  }

  /**
   * Track applications
   */
  async trackApplications(userId, params, trace) {
    const { status, dateRange } = params;

    const query = { userId };
    if (status) query.status = status;
    if (dateRange) {
      query.appliedAt = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    }

    const applications = await Application.find(query).sort({ appliedAt: -1 });

    // Calculate statistics
    const stats = {
      total: applications.length,
      applied: applications.filter(a => a.status === 'applied').length,
      viewed: applications.filter(a => a.status === 'viewed').length,
      interview: applications.filter(a => a.status === 'interview').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      accepted: applications.filter(a => a.status === 'accepted').length,
    };

    // Calculate response rate
    const responded = stats.viewed + stats.interview + stats.rejected + stats.accepted;
    stats.responseRate = stats.total > 0 ? (responded / stats.total) * 100 : 0;

    logAgentActivity('apply', 'applications_tracked', stats);

    return {
      applications,
      stats,
    };
  }

  /**
   * Send follow-up email
   */
  async sendFollowUp(userId, params, trace) {
    const { applicationId, followUpType } = params;

    const application = await Application.findOne({ _id: applicationId, userId });
    
    if (!application) {
      throw new Error('Application not found');
    }

    // Get original job
    const job = await Job.findById(application.jobId);

    // Generate follow-up email
    const template = this.emailTemplates.followUp;
    const emailContent = {
      subject: this.fillTemplate(template.subject, {
        position: application.position,
        name: application.candidateName || 'Candidate',
      }),
      body: this.fillTemplate(template.body, {
        greeting: 'Hiring Manager',
        position: application.position,
        company: application.company,
        application_date: application.appliedAt?.toLocaleDateString(),
        skills: 'relevant skills',
        name: application.candidateName || 'Candidate',
      }),
    };

    // Create approval request
    const approval = await Approval.createPending({
      userId,
      approvalType: 'follow_up',
      taskId: `followup_${Date.now()}`,
      agentId: 'apply',
      title: `Send follow-up to ${application.company}`,
      description: `Follow-up for ${application.position} application`,
      content: { modified: emailContent },
      metadata: { urgency: 'low', autoExpire: true, expireAfter: 60 },
    });

    return {
      requiresApproval: true,
      approvalId: approval.approvalId,
      preview: emailContent,
    };
  }

  /**
   * Get candidate profile from memory
   */
  async getCandidateProfile(userId) {
    const profile = await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'candidate_profile',
    });
    return profile?.value || null;
  }

  /**
   * Get Gmail credentials from user
   */
  async getGmailCredentials(userId) {
    const User = require('../../models/User');
    const user = await User.findById(userId);
    return user?.gmailCredentials || null;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(userId, status, currentTask) {
    await Agent.findOneAndUpdate(
      { userId, agentId: 'apply' },
      {
        status,
        currentTask,
        lastActive: new Date(),
        $push: {
          activityLog: {
            timestamp: new Date(),
            action: `status_changed_to_${status}`,
            details: { currentTask },
          },
        },
      }
    );
  }
}

// Export singleton instance
module.exports = new ApplyAgent();
