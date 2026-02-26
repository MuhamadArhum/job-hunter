import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader2, CheckCircle, XCircle,
  AlertCircle, Clock, ChevronRight, AlertTriangle, Play, Ban,
} from 'lucide-react';
import { orchestratorApi } from '../../services/orchestratorApi';
import toast from 'react-hot-toast';

// ─── Plan Confirmation Card ──────────────────────────────────────────────────
// Shown when the orchestrator has irreversible tasks and wants user approval
const PlanConfirmCard = ({ planSummary, onConfirm, onCancel, isExecuting }) => {
  if (!planSummary) return null;

  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3 max-w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">📋</span>
        <div>
          <h3 className="font-semibold text-amber-900 text-sm">Here's My Plan</h3>
          <p className="text-xs text-amber-700">{planSummary.summary}</p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {planSummary.steps?.map((step) => (
          <div
            key={step.step}
            className={`rounded-lg p-3 border ${
              step.type === 'write'
                ? 'bg-red-50 border-red-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0">{step.agentIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs font-semibold text-gray-700">
                    Step {step.step}:
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {step.action.replace(/_/g, ' ')}
                  </span>
                  {step.type === 'write' && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                      ⚠️ Irreversible
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{step.description}</p>
                {step.warning && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {step.warning}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Warning summary */}
      {planSummary.hasIrreversible && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            {planSummary.irreversibleSteps?.length} step(s) will interact with external services and cannot be undone.
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isExecuting}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExecuting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isExecuting ? 'Running...' : 'Go Ahead'}
        </button>
        <button
          onClick={onCancel}
          disabled={isExecuting}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Ban className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Quick Start Chips ───────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { label: '🔍 Find jobs for me', message: 'Find me relevant job opportunities based on my profile' },
  { label: '📄 Tailor my CV', message: 'Help me tailor my CV for the best matching job' },
  { label: '📊 Check my applications', message: 'Show me the status of my job applications' },
  { label: '🎓 Prep for interview', message: 'Help me prepare for upcoming interviews' },
];

// ─── ChatPanel Component ─────────────────────────────────────────────────────
// embedded=true → renders inline (used in Orchestrator page)
// embedded=false → slide-out panel (legacy mode)
const ChatPanel = ({ isOpen, onClose, onApprovalRequest, embedded = false, onAgentStatusUpdate }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your AI Job Hunt Agent — your digital recruiter. Tell me what you want done and I'll plan it, show you the steps, and execute only after your approval.\n\nTry: \"Find me Software Engineer jobs in Lahore\" or \"Apply to the best job you found\"",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [pendingPlan, setPendingPlan] = useState(null); // Stores planSummary awaiting confirmation
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingPlan]);

  // Poll for agent statuses
  useEffect(() => {
    if (!embedded && !isOpen) return;

    const fetchStatuses = async () => {
      try {
        const response = await orchestratorApi.getAgents();
        if (response.data.success) {
          const statusMap = {};
          response.data.agents.forEach(agent => {
            statusMap[agent.agentId] = agent;
          });
          setAgentStatuses(statusMap);
          onAgentStatusUpdate?.(statusMap);
        }
      } catch (error) {
        // Silently fail — agents may not be initialized yet
      }
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, [isOpen, embedded]);

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  const handleSubmit = async (e, overrideMessage = null) => {
    e?.preventDefault();
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || isLoading) return;

    setInput('');
    setIsLoading(true);
    setPendingPlan(null); // Clear any previous pending plan

    addMessage({
      id: `user_${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await orchestratorApi.chat(userMessage);
      const data = response.data;

      if (data.success) {
        // Normalize response — backend may return string or {message: "..."}
        const normalizeResponse = (r) => {
          if (!r) return 'Done!';
          if (typeof r === 'string') return r;
          return r.message || r.response || r.text || r.reply || JSON.stringify(r);
        };

        // Digital FTE: Agent wants confirmation before irreversible steps
        if (data.requiresConfirmation && data.planSummary) {
          addMessage({
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: normalizeResponse(data.response),
            intent: data.intent,
            timestamp: new Date().toISOString(),
          });
          setPendingPlan(data.planSummary);
        } else {
          // Regular response — tasks executed immediately
          addMessage({
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: normalizeResponse(data.response),
            intent: data.intent,
            tasks: data.tasks,
            timestamp: new Date().toISOString(),
          });

          // Check for HITL approval requests (email sends, etc.)
          if (data.requiresApproval) {
            try {
              const approvals = await orchestratorApi.getApprovals();
              if (approvals.data.approvals?.length > 0) {
                onApprovalRequest?.(approvals.data.approvals[0]);
              }
            } catch (_) {}
          }
        }
      } else {
        addMessage({
          id: `error_${Date.now()}`,
          role: 'error',
          content: data.error || 'Something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      addMessage({
        id: `error_${Date.now()}`,
        role: 'error',
        content: error.response?.data?.error || 'Failed to send message. Please check your connection.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Plan confirmation handlers ────────────────────────────────────────────
  const handleConfirmPlan = async () => {
    if (!pendingPlan?.sessionId) return;
    setIsExecuting(true);

    addMessage({
      id: `user_confirm_${Date.now()}`,
      role: 'user',
      content: '✅ Go ahead with the plan.',
      timestamp: new Date().toISOString(),
    });
    setPendingPlan(null);

    try {
      const response = await orchestratorApi.executeConfirmed(pendingPlan.sessionId);
      const data = response.data;

      if (data.success) {
        const normalizeResponse = (r) => {
          if (!r) return 'Done!';
          if (typeof r === 'string') return r;
          return r.message || r.response || r.text || r.reply || JSON.stringify(r);
        };
        addMessage({
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: normalizeResponse(data.response),
          intent: data.intent,
          tasks: data.tasks,
          timestamp: new Date().toISOString(),
        });

        if (data.requiresApproval) {
          try {
            const approvals = await orchestratorApi.getApprovals();
            if (approvals.data.approvals?.length > 0) {
              onApprovalRequest?.(approvals.data.approvals[0]);
            }
          } catch (_) {}
        }
      } else {
        addMessage({
          id: `error_${Date.now()}`,
          role: 'error',
          content: data.error || 'Execution failed.',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      addMessage({
        id: `error_${Date.now()}`,
        role: 'error',
        content: error.response?.data?.error || 'Execution failed. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelPlan = () => {
    setPendingPlan(null);
    addMessage({
      id: `cancel_${Date.now()}`,
      role: 'assistant',
      content: "No problem! The plan has been cancelled. Nothing was sent or changed. What else can I help you with?",
      timestamp: new Date().toISOString(),
    });
  };

  // ── Status icon helper ───────────────────────────────────────────────────
  const getStatusIcon = (status) => {
    switch (status) {
      case 'working': return <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />;
      case 'waiting_approval': return <Clock className="w-3 h-3 text-amber-500" />;
      case 'completed': return <CheckCircle className="w-3 h-3 text-emerald-500" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-500" />;
      default: return <div className="w-2 h-2 rounded-full bg-gray-300" />;
    }
  };

  // ── Message renderer ────────────────────────────────────────────────────
  const renderMessage = (msg) => (
    <div
      key={msg.id}
      className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'error' ? 'justify-center' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-xl p-3 shadow-sm ${
          msg.role === 'user'
            ? 'bg-blue-600 text-white'
            : msg.role === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        <div className="flex items-start gap-2">
          {msg.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />}
          {msg.role === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          {msg.role === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {typeof msg.content === 'object'
              ? (msg.content?.message || msg.content?.response || msg.content?.text || JSON.stringify(msg.content))
              : msg.content}
          </p>
        </div>

        {/* Intent badge */}
        {msg.intent && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {msg.intent.intent}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round((msg.intent.confidence || 0) * 100)}% confidence
            </span>
          </div>
        )}

        {/* Tasks list */}
        {msg.tasks && msg.tasks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <span className="text-xs font-medium text-gray-500">Agent Actions:</span>
            {msg.tasks.map((task, idx) => (
              <div key={idx} className="flex items-center gap-1 text-xs text-gray-600">
                <ChevronRight className="w-3 h-3" />
                <span className="font-medium">{task.agent}:</span>
                <span>{task.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Inner content (shared between embedded and slide-out) ────────────────
  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Agent Status Bar */}
      {Object.keys(agentStatuses).length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b bg-gray-50 overflow-x-auto flex-shrink-0">
          {Object.entries(agentStatuses).map(([id, agent]) => (
            <div
              key={id}
              title={agent.currentTask || agent.agentName}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                agent.status === 'working' ? 'bg-emerald-100 text-emerald-700' :
                agent.status === 'waiting_approval' ? 'bg-amber-100 text-amber-700' :
                agent.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-500'
              }`}
            >
              {getStatusIcon(agent.status)}
              <span>{agent.agentName || id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(renderMessage)}

        {/* Plan confirmation card — appears after assistant message */}
        {pendingPlan && (
          <PlanConfirmCard
            planSummary={pendingPlan}
            onConfirm={handleConfirmPlan}
            onCancel={handleCancelPlan}
            isExecuting={isExecuting}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Agent is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick chips — only show when no pending plan and no loading */}
      {!pendingPlan && !isLoading && messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleSubmit(null, chip.message)}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Delegate a task to your agent..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isLoading || isExecuting}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isExecuting}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );

  // ── Embedded mode (used in Orchestrator page) ────────────────────────────
  if (embedded) {
    return <div className="h-full flex flex-col">{chatContent}</div>;
  }

  // ── Slide-out panel mode (legacy) ────────────────────────────────────────
  return (
    <div
      className={`fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h2 className="font-semibold text-sm">Job Hunt Agent</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      {chatContent}
    </div>
  );
};

export default ChatPanel;
