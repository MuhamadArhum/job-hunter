/**
 * Dashboard — Mission Control (Digital FTE Style)
 *
 * This is NOT a feature dashboard. It is a mission status page:
 *  - Shows what your AI agents have done for you
 *  - Shows actions pending your approval (HITL)
 *  - Primary CTA: "Start a Mission" → Orchestrator page
 *
 * The user doesn't "do" things here. They review and delegate.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot, Send, CheckCircle, Clock, XCircle, TrendingUp,
  Briefcase, AlertCircle, ChevronRight, Zap, Eye,
  FileText, Search, GraduationCap,
} from 'lucide-react';
import { applicationsAPI } from '../services/api';
import { orchestratorApi } from '../services/orchestratorApi';
import ApprovalModal from '../components/chat/ApprovalModal';
import toast from 'react-hot-toast';

// ─── Stat Card ─────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color, sub }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm`}>
    <div className="flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

// ─── Application Status Badge ───────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const config = {
    applied:   { cls: 'bg-blue-100 text-blue-700',   label: 'Applied' },
    viewed:    { cls: 'bg-purple-100 text-purple-700', label: 'Viewed' },
    interview: { cls: 'bg-emerald-100 text-emerald-700', label: 'Interview' },
    rejected:  { cls: 'bg-red-100 text-red-700',     label: 'Rejected' },
    accepted:  { cls: 'bg-emerald-100 text-emerald-700', label: 'Accepted' },
    pending:   { cls: 'bg-amber-100 text-amber-700', label: 'Pending' },
  };
  const c = config[status] || { cls: 'bg-gray-100 text-gray-600', label: status };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.cls}`}>
      {c.label}
    </span>
  );
};

// ─── Pending Approval Card ──────────────────────────────────────────────────
const PendingApprovalCard = ({ approval, onReview }) => (
  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Clock className="w-4 h-4 text-amber-700" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-amber-900">{approval.title}</p>
        <p className="text-xs text-amber-700 mt-0.5">{approval.description}</p>
        <p className="text-xs text-amber-500 mt-1">
          {approval.approvalType?.replace(/_/g, ' ')} •{' '}
          {new Date(approval.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
    <button
      onClick={() => onReview(approval)}
      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
    >
      <Eye className="w-3.5 h-3.5" />
      Review
    </button>
  </div>
);

// ─── Agent Activity Item ────────────────────────────────────────────────────
const AgentActivityItem = ({ activity }) => {
  const AGENT_ICONS = {
    jobSearch: '🔍', resumeBuilder: '📄', apply: '📧',
    prep: '🎓', orchestrator: '🎯',
  };
  const icon = AGENT_ICONS[activity.agentId] || '🤖';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate">
          <span className="font-medium">{activity.agentId}</span>
          {' '}ran{' '}
          <span className="text-blue-600">{activity.action?.replace(/_/g, ' ')}</span>
        </p>
        <p className="text-xs text-gray-400">
          {new Date(activity.timestamp).toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </p>
      </div>
      <span className={`text-xs flex-shrink-0 font-medium ${
        activity.status === 'completed' ? 'text-emerald-600' :
        activity.status === 'failed' ? 'text-red-500' :
        'text-gray-400'
      }`}>
        {activity.status}
      </span>
    </div>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingApproval, setPendingApproval] = useState(null);

  const { data: statsData, isLoading: statsLoading } = useQuery(
    'applications-stats',
    applicationsAPI.getStats,
    { staleTime: 60000, retry: false }
  );

  const { data: approvalsData } = useQuery(
    'dashboard-approvals',
    () => orchestratorApi.getApprovals('pending'),
    { refetchInterval: 10000, retry: false }
  );

  const { data: activityData } = useQuery(
    'dashboard-activity',
    () => orchestratorApi.getActivity(15),
    { refetchInterval: 15000, retry: false }
  );

  const { data: appsData } = useQuery(
    'recent-applications',
    () => applicationsAPI.getApplications({ limit: 5, sort: '-appliedAt' }),
    { staleTime: 30000, retry: false }
  );

  useEffect(() => {
    const approvals = approvalsData?.data?.approvals || [];
    if (approvals.length > 0 && !pendingApproval) {
      // Just surface the badge — modal only on explicit click
    }
  }, [approvalsData]);

  const stats = statsData?.data || {};
  const pendingApprovals = approvalsData?.data?.approvals || [];
  const activities = activityData?.data?.activities || [];
  const recentApps = appsData?.data?.applications || [];

  const totalApplications = stats.total || 0;
  const interviews = stats.interview || 0;
  const responseRate = totalApplications > 0
    ? Math.round(((stats.viewed || 0) + (stats.interview || 0)) / totalApplications * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">

      {/* ── Mission Briefing Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🎯</span> Mission Control
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Review what your agents have done — and delegate what's next.
          </p>
        </div>
        <button
          onClick={() => navigate('/orchestrator')}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Bot className="w-4 h-4" />
          Talk to Agent
        </button>
      </div>

      {/* ── Pending Approvals (most important — shown first) ──────────────── */}
      {pendingApprovals.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-gray-900">
              Pending Your Approval
            </h2>
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingApprovals.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingApprovals.map(approval => (
              <PendingApprovalCard
                key={approval._id}
                approval={approval}
                onReview={setPendingApproval}
              />
            ))}
          </div>
        </section>
      )}

      {pendingApprovals.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            All caught up! No pending approvals — your agents are operating smoothly.
          </p>
        </div>
      )}

      {/* ── Mission Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Send className="w-5 h-5 text-blue-600" />}
          color="bg-blue-100"
          label="Applications Sent"
          value={totalApplications}
          sub="by your agent"
        />
        <StatCard
          icon={<Briefcase className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-100"
          label="Interviews"
          value={interviews}
          sub="scheduled"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          color="bg-purple-100"
          label="Response Rate"
          value={`${responseRate}%`}
          sub={totalApplications > 0 ? `${totalApplications} applications` : 'no data yet'}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          color="bg-amber-100"
          label="Pending Review"
          value={pendingApprovals.length}
          sub="awaiting you"
        />
      </div>

      {/* ── Two Column: Activity + Recent Applications ─────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Agent Activity */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            What Your Agents Did
          </h3>
          {activities.length === 0 ? (
            <div className="text-center py-6">
              <Bot className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No activity yet.</p>
              <button
                onClick={() => navigate('/orchestrator')}
                className="mt-3 text-sm text-blue-600 font-medium hover:underline"
              >
                Start your first mission →
              </button>
            </div>
          ) : (
            <div>
              {activities.map((a, idx) => (
                <AgentActivityItem key={idx} activity={a} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Applications */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Recent Applications
            </h3>
            <Link
              to="/applications"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              View all →
            </Link>
          </div>
          {recentApps.length === 0 ? (
            <div className="text-center py-6">
              <Send className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No applications yet.</p>
              <button
                onClick={() => navigate('/orchestrator')}
                className="mt-3 text-sm text-blue-600 font-medium hover:underline"
              >
                Ask agent to apply →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApps.map(app => (
                <div key={app._id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{app.position}</p>
                    <p className="text-xs text-gray-500 truncate">{app.company}</p>
                    {app.appliedAt && (
                      <p className="text-xs text-gray-400">
                        {new Date(app.appliedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Delegate CTAs ────────────────────────────────────────────── */}
      <div>
        <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide text-gray-500">
          Delegate to Your Agent
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: '🔍', label: 'Find Jobs', desc: 'Search & match new roles', msg: 'Find me relevant job opportunities' },
            { icon: '📄', label: 'Tailor CV',  desc: 'Optimize for a specific job', msg: 'Tailor my CV for the best matching job' },
            { icon: '🎓', label: 'Interview Prep', desc: 'Practice before the interview', msg: 'Help me prepare for upcoming interviews' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => navigate('/orchestrator')}
              className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm"
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 ml-auto" />
            </button>
          ))}
        </div>
      </div>

      {/* Approval Modal */}
      {pendingApproval && (
        <ApprovalModal
          approval={pendingApproval}
          onClose={() => setPendingApproval(null)}
          onApproved={() => {
            setPendingApproval(null);
            queryClient.invalidateQueries('dashboard-approvals');
            queryClient.invalidateQueries('applications-stats');
            toast.success('Action approved!');
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
