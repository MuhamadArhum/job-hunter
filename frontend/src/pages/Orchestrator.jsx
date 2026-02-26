/**
 * Orchestrator Page — Digital FTE Command Center
 *
 * Layout:
 *  ┌──────────────────────────────┬─────────────────────────┐
 *  │  CHAT (primary, 60%)         │  AGENT PANEL (40%)      │
 *  │  ─────────────────────────── │  ─────────────────────  │
 *  │  Embedded ChatPanel          │  🚀 Start Pipeline      │
 *  │  (plan cards, approval flow) │  🤖 Your AI Team        │
 *  │                              │  📋 Pending Approvals   │
 *  │                              │  📊 Recent Activity     │
 *  └──────────────────────────────┴─────────────────────────┘
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import {
  Bot, Loader2, CheckCircle, XCircle, Clock, AlertCircle,
  ChevronRight, ExternalLink, Zap, Eye, Upload, PlayCircle,
  FileText, X,
} from 'lucide-react';
import { orchestratorApi } from '../services/orchestratorApi';
import { pipelineApi } from '../services/pipelineApi';
import { jobsAPI } from '../services/api';
import ChatPanel from '../components/chat/ChatPanel';
import ApprovalModal from '../components/chat/ApprovalModal';
import toast from 'react-hot-toast';

// ─── Agent Status Card ────────────────────────────────────────────────────────
const AGENT_META = {
  orchestrator: { icon: '🎯', label: 'Orchestrator' },
  jobSearch:    { icon: '🔍', label: 'Job Search' },
  resumeBuilder:{ icon: '📄', label: 'Resume Builder' },
  apply:        { icon: '📧', label: 'Apply' },
  prep:         { icon: '🎓', label: 'Interview Prep' },
};

const AgentStatusCard = ({ agent }) => {
  const meta = AGENT_META[agent.agentId] || { icon: '🤖', label: agent.agentName };
  const statusConfig = {
    working:          { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-700', label: 'Working' },
    waiting_approval: { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500 animate-pulse',  text: 'text-amber-700',   label: 'Waiting' },
    completed:        { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500',              text: 'text-emerald-700', label: 'Done' },
    error:            { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',                  text: 'text-red-700',     label: 'Error' },
    idle:             { bg: 'bg-gray-50',    border: 'border-gray-200',    dot: 'bg-gray-300',                 text: 'text-gray-500',    label: 'Idle' },
  };
  const cfg = statusConfig[agent.status] || statusConfig.idle;

  return (
    <div className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{meta.label}</p>
            {agent.currentTask
              ? <p className="text-xs text-gray-500 truncate">{agent.currentTask}</p>
              : <p className="text-xs text-gray-400">Standby</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>
      {agent.progress?.current > 0 && (
        <div className="mt-2">
          <div className="w-full bg-white/70 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${agent.progress.current}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Pending Approval Banner ──────────────────────────────────────────────────
const ApprovalBanner = ({ approval, onReview }) => (
  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 min-w-0">
      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 truncate">{approval.title}</p>
        <p className="text-xs text-amber-700 truncate">{approval.description}</p>
      </div>
    </div>
    <button
      onClick={() => onReview(approval)}
      className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 flex items-center gap-1"
    >
      <Eye className="w-3 h-3" />
      Review
    </button>
  </div>
);

// ─── Activity Feed Item ───────────────────────────────────────────────────────
const ActivityItem = ({ activity }) => {
  const statusDot = {
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
    in_progress: 'bg-blue-500 animate-pulse',
    pending: 'bg-gray-300',
    cancelled: 'bg-gray-400',
  };
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-100 last:border-0">
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDot[activity.status] || 'bg-gray-300'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-700 truncate">
          <span className="text-blue-600">{activity.agentId}</span>
          {' → '}{activity.action}
        </p>
        <p className="text-xs text-gray-400">
          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <span className={`text-xs flex-shrink-0 ${activity.status === 'completed' ? 'text-emerald-600' : activity.status === 'failed' ? 'text-red-600' : 'text-gray-400'}`}>
        {activity.status}
      </span>
    </div>
  );
};

// ─── Pipeline Start Form ──────────────────────────────────────────────────────
const PIPELINE_STAGE_LABELS = {
  starting: 'Starting pipeline...',
  searching: 'Searching for jobs...',
  generating_cvs: 'Generating tailored CVs...',
  cv_review: 'CVs ready — check your approvals!',
  finding_emails: 'Finding HR emails & drafting emails...',
  email_review: 'Emails ready — check your approvals!',
  sending: 'Sending applications...',
  completed: 'Pipeline completed!',
  error: 'Pipeline failed.',
  cancelled: 'Pipeline cancelled.',
};

const PipelineStartForm = ({ onPipelineStarted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [jobRole, setJobRole] = useState('');
  const [location, setLocation] = useState('Pakistan');
  const [maxJobs, setMaxJobs] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [cvStatus, setCvStatus] = useState(null); // { hasCV, name }
  const [activePipeline, setActivePipeline] = useState(null); // { pipelineId, stage, message }
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  // Check if CV is already uploaded
  useEffect(() => {
    if (isOpen) {
      pipelineApi.getCVStatus()
        .then(res => setCvStatus(res.data))
        .catch(() => setCvStatus({ hasCV: false }));
    }
  }, [isOpen]);

  // Poll pipeline status
  useEffect(() => {
    if (activePipeline?.pipelineId && !['cv_review', 'email_review', 'completed', 'error', 'cancelled'].includes(activePipeline?.stage)) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await pipelineApi.getStatus(activePipeline.pipelineId);
          const { stage, error } = res.data;
          const label = PIPELINE_STAGE_LABELS[stage] || stage;
          setActivePipeline(prev => ({ ...prev, stage, message: label }));

          if (['cv_review', 'email_review', 'completed', 'error', 'cancelled'].includes(stage)) {
            clearInterval(pollRef.current);
            if (stage === 'cv_review' || stage === 'email_review') {
              toast.success(label + ' Check approvals panel.');
              onPipelineStarted?.();
            } else if (stage === 'completed') {
              toast.success('Pipeline completed!');
            } else if (stage === 'error') {
              toast.error('Pipeline error: ' + (error || 'Unknown'));
            }
          }
        } catch (e) {
          clearInterval(pollRef.current);
        }
      }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [activePipeline?.pipelineId, activePipeline?.stage]);

  const handleStart = async () => {
    if (!jobRole.trim()) {
      toast.error('Please enter a job role');
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Upload CV if a new one was selected
      if (cvFile) {
        const uploadRes = await pipelineApi.uploadCV(cvFile);
        setCvStatus({ hasCV: true, name: uploadRes.data.profile?.name });
        toast.success('CV uploaded: ' + (uploadRes.data.profile?.name || 'Done'));
      } else if (!cvStatus?.hasCV) {
        toast.error('Please upload your CV first');
        setIsLoading(false);
        return;
      }

      // Step 2: Start pipeline
      const startRes = await pipelineApi.start(jobRole, location, maxJobs);
      const { pipelineId, message } = startRes.data;

      setActivePipeline({
        pipelineId,
        stage: 'searching',
        message: message || 'Pipeline started!',
      });

      toast.success('Pipeline started!');
      setIsOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Active pipeline progress */}
      {activePipeline && (
        <div className={`mb-3 rounded-xl p-3 border ${
          activePipeline.stage === 'completed' ? 'bg-emerald-50 border-emerald-200' :
          activePipeline.stage === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {['completed', 'error', 'cancelled'].includes(activePipeline.stage) ? null : (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            )}
            <p className={`text-xs font-medium ${
              activePipeline.stage === 'completed' ? 'text-emerald-700' :
              activePipeline.stage === 'error' ? 'text-red-700' :
              'text-blue-700'
            }`}>
              {activePipeline.message}
            </p>
          </div>
          {activePipeline.stage !== 'completed' && activePipeline.stage !== 'error' && (
            <button
              className="mt-1 text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setActivePipeline(null)}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Start button */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-2 shadow-sm"
        >
          <PlayCircle className="w-4 h-4" />
          Start Job Application Pipeline
        </button>
      ) : (
        /* Pipeline form */
        <div className="border border-blue-200 rounded-xl bg-blue-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <PlayCircle className="w-4 h-4" />
              Configure Pipeline
            </p>
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-4 space-y-3">
            {/* CV Status / Upload */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Your CV</label>
              {cvStatus?.hasCV && !cvFile ? (
                <div className="mt-1 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-emerald-700 font-medium">{cvStatus.name || 'CV uploaded'}</span>
                  </div>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => fileRef.current?.click()}>
                    Change
                  </button>
                </div>
              ) : (
                <div
                  className="mt-1 border-2 border-dashed border-blue-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 bg-white"
                  onClick={() => fileRef.current?.click()}
                >
                  {cvFile ? (
                    <p className="text-xs text-emerald-600 font-medium">✅ {cvFile.name}</p>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-xs text-blue-600">Click to upload CV (PDF)</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => setCvFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Job Role */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Job Role</label>
              <input
                type="text"
                value={jobRole}
                onChange={e => setJobRole(e.target.value)}
                placeholder="e.g. Software Engineer, Frontend Dev"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Lahore, Pakistan"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Max Jobs */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">
                Top Jobs to Apply ({maxJobs})
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={maxJobs}
                onChange={e => setMaxJobs(Number(e.target.value))}
                className="w-full mt-1"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleStart}
              disabled={isLoading || (!cvStatus?.hasCV && !cvFile)}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
              ) : (
                <><PlayCircle className="w-4 h-4" /> Launch Pipeline</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Jobs Result Panel ────────────────────────────────────────────────────────
const JobsResultPanel = () => {
  const { data, isLoading } = useQuery('jobs-panel', () => jobsAPI.getJobs({ limit: 10 }), { staleTime: 30000, retry: false });
  const jobs = data?.data?.jobs || [];

  if (isLoading) return <div className="text-xs text-gray-400 py-2">Loading jobs...</div>;
  if (jobs.length === 0) return <p className="text-xs text-gray-400 italic py-1">No jobs found yet.</p>;

  return (
    <div className="space-y-2">
      {jobs.slice(0, 5).map(job => (
        <div key={job._id} className="bg-white border border-gray-200 rounded-lg p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{job.title}</p>
              <p className="text-xs text-gray-500 truncate">{job.company}</p>
            </div>
            <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
              job.matchScore > 0.7 ? 'bg-emerald-100 text-emerald-700' :
              job.matchScore > 0.4 ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {Math.round((job.matchScore || 0.5) * 100)}%
            </span>
          </div>
          {job.location && <p className="text-xs text-gray-400 mt-0.5">{job.location}</p>}
        </div>
      ))}
      {jobs.length > 5 && <p className="text-xs text-gray-400 text-center">+{jobs.length - 5} more jobs</p>}
    </div>
  );
};

// ─── Main Orchestrator Page ───────────────────────────────────────────────────
const Orchestrator = () => {
  const [pendingApproval, setPendingApproval] = useState(null);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [showJobs, setShowJobs] = useState(false);
  const queryClient = useQueryClient();

  // Poll pending approvals every 8s
  const { data: approvalsData } = useQuery(
    'approvals',
    () => orchestratorApi.getApprovals('pending'),
    { refetchInterval: 8000, retry: false }
  );

  // Poll recent activity every 8s
  const { data: activityData } = useQuery(
    'activity',
    () => orchestratorApi.getActivity(20),
    { refetchInterval: 8000, retry: false }
  );

  // Auto-surface first pending approval as modal
  useEffect(() => {
    const approvals = approvalsData?.data?.approvals || [];
    if (approvals.length > 0 && !pendingApproval) {
      setPendingApproval(approvals[0]);
    }
  }, [approvalsData]);

  const handleApprovalResolved = useCallback(() => {
    setPendingApproval(null);
    queryClient.invalidateQueries('approvals');
    queryClient.invalidateQueries('activity');
  }, [queryClient]);

  const handleAgentStatusUpdate = useCallback((statuses) => {
    setAgentStatuses(statuses);
  }, []);

  const handlePipelineStarted = useCallback(() => {
    queryClient.invalidateQueries('approvals');
  }, [queryClient]);

  const pendingApprovals = approvalsData?.data?.approvals || [];
  const activities = activityData?.data?.activities || [];
  const agentList = Object.values(agentStatuses);
  const hasActiveAgents = agentList.some(a => a.status === 'working' || a.status === 'waiting_approval');

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">

      {/* ── LEFT: Chat (60%) ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Job Hunt Agent</h1>
              <div className="flex items-center gap-1.5">
                {hasActiveAgents ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-white/80">Agent working...</span></>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-white/50" /><span className="text-xs text-white/70">Ready — delegate a task</span></>
                )}
              </div>
            </div>
          </div>
          {pendingApprovals.length > 0 && (
            <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pendingApprovals.length} Pending
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <ChatPanel
            embedded={true}
            onApprovalRequest={setPendingApproval}
            onAgentStatusUpdate={handleAgentStatusUpdate}
          />
        </div>
      </div>

      {/* ── RIGHT: Agent Panel (40%) ─────────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-gray-50 overflow-y-auto flex-shrink-0">

        {/* ── Pipeline Start ──────────────────────────────────────────────────── */}
        <section className="p-4 border-b border-gray-200">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5 text-blue-500" />
            Auto-Apply Pipeline
          </h2>
          <PipelineStartForm onPipelineStarted={handlePipelineStarted} />
        </section>

        {/* ── Your AI Team ────────────────────────────────────────────────────── */}
        <section className="p-4 border-b border-gray-200">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Your AI Team
          </h2>
          {agentList.length === 0 ? (
            <div className="space-y-2">
              {Object.entries(AGENT_META).filter(([id]) => id !== 'orchestrator').map(([id, meta]) => (
                <div key={id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{meta.label}</p>
                    <p className="text-xs text-gray-400">Standby</p>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full bg-gray-300" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {agentList.map(agent => <AgentStatusCard key={agent.agentId} agent={agent} />)}
            </div>
          )}
        </section>

        {/* ── Pending Approvals ────────────────────────────────────────────────── */}
        {pendingApprovals.length > 0 && (
          <section className="p-4 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Pending Your Approval
            </h2>
            <div className="space-y-2">
              {pendingApprovals.map(approval => (
                <ApprovalBanner key={approval._id} approval={approval} onReview={setPendingApproval} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Activity ──────────────────────────────────────────────────── */}
        <section className="p-4 border-b border-gray-200 flex-1">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5" />
            Recent Activity
          </h2>
          {activities.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No activity yet.</p>
          ) : (
            <div>
              {activities.slice(0, 10).map((activity, idx) => <ActivityItem key={idx} activity={activity} />)}
            </div>
          )}
        </section>

        {/* ── Jobs Found ───────────────────────────────────────────────────────── */}
        <section className="p-4">
          <button
            onClick={() => setShowJobs(prev => !prev)}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide mb-2"
          >
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Jobs Found by Agent
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showJobs ? 'rotate-90' : ''}`} />
          </button>
          {showJobs && <JobsResultPanel />}
        </section>
      </div>

      {/* ── Approval Modal (HITL) ─────────────────────────────────────────────── */}
      {pendingApproval && (
        <ApprovalModal
          approval={pendingApproval}
          onClose={() => setPendingApproval(null)}
          onApproved={handleApprovalResolved}
        />
      )}
    </div>
  );
};

export default Orchestrator;
