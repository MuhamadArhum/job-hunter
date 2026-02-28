import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader2, CheckCircle, XCircle,
  AlertCircle, Clock, ChevronRight, AlertTriangle, Play, Ban,
} from 'lucide-react';
import { orchestratorApi } from '../../services/orchestratorApi';
import toast from 'react-hot-toast';

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .cp-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }

  /* ── Plan Card ── */
  .cp-plan-card {
    border: 1px solid #fde68a;
    background: #fffbeb;
    border-radius: 14px;
    padding: 14px;
    max-width: 100%;
  }
  .cp-plan-title { color: #92400e; font-weight: 700; font-size: 0.82rem; }
  .cp-plan-sub   { color: #b45309; font-size: 0.72rem; margin-top: 2px; opacity: 0.75; }

  .cp-step {
    border-radius: 10px; padding: 10px 12px; margin-bottom: 8px;
    border: 1px solid #d4ede2; background: #f7fdf9;
  }
  .cp-step.write { background: #fef2f2; border-color: #fecaca; }

  .cp-step-num    { color: #7dba9a; font-size: 0.7rem; font-weight: 700; }
  .cp-step-action { color: #9ca3af; font-size: 0.7rem; }
  .cp-step-desc   { color: #4d7a65; font-size: 0.75rem; margin-top: 3px; }
  .cp-step-warn   { color: #ef4444; font-size: 0.7rem; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

  .cp-irr-badge {
    font-size: 0.63rem; background: #fef2f2; color: #ef4444;
    border: 1px solid #fecaca; padding: 1px 7px; border-radius: 20px; font-weight: 600;
  }
  .cp-irr-warning {
    background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
    padding: 8px 10px; font-size: 0.72rem; color: #ef4444;
    display: flex; align-items: center; gap: 8px;
    margin-top: 8px; margin-bottom: 10px;
  }

  .cp-confirm-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 12px;
    background: linear-gradient(135deg, #10b981, #0d9488);
    color: white; font-weight: 700; font-size: 0.8rem;
    border: none; border-radius: 10px; cursor: pointer;
    box-shadow: 0 2px 10px rgba(16,185,129,0.22);
    transition: all 0.2s; font-family: inherit;
  }
  .cp-confirm-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.32); }
  .cp-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .cp-cancel-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 12px;
    background: #fff; border: 1px solid #fecaca;
    color: #ef4444; font-weight: 600; font-size: 0.8rem;
    border-radius: 10px; cursor: pointer;
    transition: all 0.2s; font-family: inherit;
  }
  .cp-cancel-btn:hover:not(:disabled) { background: #fef2f2; }
  .cp-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Quick Chips ── */
  .cp-chip {
    font-size: 0.72rem; padding: 6px 12px;
    background: #f0faf5; border: 1px solid #c8e8d8;
    color: #4d7a65; border-radius: 20px;
    cursor: pointer; transition: all 0.2s; font-family: inherit;
  }
  .cp-chip:hover { background: #e8f7ef; color: #0d7a56; border-color: #10b981; }

  /* ── Status bar ── */
  .cp-status-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-bottom: 1px solid #e6f4ee;
    background: #f7fdf9; overflow-x: auto; flex-shrink: 0;
  }
  .cp-status-pill {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 0.68rem; font-weight: 600; white-space: nowrap;
  }
  .cp-status-pill.working { background: #e8f7ef; color: #10b981; border: 1px solid #c8e8d8; }
  .cp-status-pill.waiting { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .cp-status-pill.error   { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
  .cp-status-pill.idle    { background: #f3f4f6; color: #9ca3af; border: 1px solid #e5e7eb; }

  /* ── Messages ── */
  .cp-messages {
    flex: 1; overflow-y: auto; background: #f7fdf9;
    padding: 16px; display: flex; flex-direction: column; gap: 12px;
    scrollbar-width: thin; scrollbar-color: #c8e8d8 transparent;
  }
  .cp-messages::-webkit-scrollbar { width: 4px; }
  .cp-messages::-webkit-scrollbar-thumb { background: #c8e8d8; border-radius: 4px; }

  /* User bubble */
  .cp-bubble-user {
    max-width: 82%;
    background: linear-gradient(135deg, #10b981, #0d9488);
    color: white; border-radius: 16px 16px 4px 16px;
    padding: 10px 14px; box-shadow: 0 2px 10px rgba(16,185,129,0.2);
  }
  .cp-bubble-user p { font-size: 0.85rem; line-height: 1.55; white-space: pre-wrap; }

  /* Assistant bubble */
  .cp-bubble-bot {
    max-width: 82%; background: #fff;
    border: 1px solid #e6f4ee; color: #2d6048;
    border-radius: 16px 16px 16px 4px;
    padding: 10px 14px; box-shadow: 0 1px 4px rgba(16,185,129,0.06);
  }
  .cp-bubble-bot p { font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap; }

  /* Error bubble */
  .cp-bubble-error {
    max-width: 82%; background: #fef2f2;
    border: 1px solid #fecaca; color: #ef4444;
    border-radius: 12px; padding: 10px 14px;
  }
  .cp-bubble-error p { font-size: 0.82rem; line-height: 1.5; }

  /* Intent + tasks */
  .cp-intent-badge {
    display: inline-flex; align-items: center;
    margin-top: 8px; padding-top: 8px;
    border-top: 1px solid #e6f4ee;
    gap: 6px; flex-wrap: wrap; width: 100%;
  }
  .cp-intent-tag {
    font-size: 0.65rem; background: #e8f7ef; color: #0d7a56;
    border: 1px solid #c8e8d8;
    padding: 2px 8px; border-radius: 20px; font-weight: 600;
  }
  .cp-intent-conf { font-size: 0.65rem; color: #b2d9c5; }

  .cp-tasks { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e6f4ee; }
  .cp-tasks-label { font-size: 0.63rem; font-weight: 700; color: #7dba9a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .cp-task-row { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: #9ca3af; margin-top: 3px; }
  .cp-task-agent { font-weight: 700; color: #4d7a65; }

  /* Thinking */
  .cp-thinking {
    display: flex; align-items: center; gap: 8px;
    background: #fff; border: 1px solid #e6f4ee;
    border-radius: 14px; padding: 10px 14px; width: fit-content;
    box-shadow: 0 1px 4px rgba(16,185,129,0.06);
  }
  .cp-thinking span { font-size: 0.8rem; color: #7dba9a; }

  /* Typing dots */
  .cp-dot { width: 6px; height: 6px; border-radius: 50%; background: #b2d9c5; animation: cpBounce 0.9s infinite; }
  @keyframes cpBounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }

  /* ── Input area ── */
  .cp-input-area {
    padding: 12px 14px; border-top: 1px solid #e6f4ee;
    background: #fff; flex-shrink: 0;
  }
  .cp-input-row { display: flex; gap: 8px; }
  .cp-input {
    flex: 1; background: #f7fdf9; border: 1px solid #c8e8d8;
    border-radius: 12px; padding: 10px 14px;
    font-size: 0.875rem; color: #0f2d20; outline: none;
    transition: all 0.2s; font-family: inherit;
  }
  .cp-input::placeholder { color: #b2d9c5; }
  .cp-input:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
  .cp-input:disabled { opacity: 0.5; }

  .cp-send-btn {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #10b981, #0d9488);
    border: none; border-radius: 12px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: white; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(16,185,129,0.25); transition: all 0.2s;
  }
  .cp-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.35); }
  .cp-send-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

  .cp-chips-wrap { padding: 0 14px 10px; display: flex; flex-wrap: wrap; gap: 6px; }

  /* ── Slide-out panel ── */
  .cp-slide-panel {
    position: fixed; right: 0; top: 0; height: 100%;
    width: 100%; max-width: 420px;
    background: #fff;
    box-shadow: -4px 0 30px rgba(16,185,129,0.1), -1px 0 0 #e6f4ee;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    z-index: 50; display: flex; flex-direction: column;
  }
  .cp-slide-panel.open { transform: translateX(0); }

  /* ── Header ── */
  .cp-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; flex-shrink: 0;
    background: #fff; border-bottom: 1px solid #e6f4ee;
    box-shadow: 0 1px 6px rgba(16,185,129,0.06);
  }
  .cp-header-brand { display: flex; align-items: center; gap: 10px; }
  .cp-header-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #10b981, #0d9488);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(16,185,129,0.25);
  }
  .cp-header-title { color: #0f2d20; font-weight: 800; font-size: 0.9rem; }
  .cp-header-sub   { color: #7dba9a; font-size: 0.65rem; margin-top: 1px; }
  .cp-close-btn {
    width: 30px; height: 30px;
    background: #f0faf5; border: 1px solid #c8e8d8;
    color: #7dba9a; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s;
  }
  .cp-close-btn:hover { background: #fef2f2; border-color: #fecaca; color: #ef4444; }

  .cp-spin { animation: cpSpin 1s linear infinite; }
  @keyframes cpSpin { to { transform: rotate(360deg); } }

  /* Bot icon in bubble */
  .cp-bot-icon {
    width: 22px; height: 22px;
    background: #e8f7ef; border: 1px solid #c8e8d8;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
`;

// ─── Quick Chips ──────────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { label: '🔍 Find jobs for me',    message: 'Find me relevant job opportunities based on my profile' },
  { label: '📄 Tailor my CV',        message: 'Help me tailor my CV for the best matching job' },
  { label: '📊 Check my applications', message: 'Show me the status of my job applications' },
  { label: '🎓 Prep for interview',  message: 'Help me prepare for upcoming interviews' },
];

// ─── Plan Confirmation Card ───────────────────────────────────────────────────
const PlanConfirmCard = ({ planSummary, onConfirm, onCancel, isExecuting }) => {
  if (!planSummary) return null;
  return (
    <div className="cp-plan-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: '1.1rem' }}>📋</span>
        <div>
          <div className="cp-plan-title">Here's My Plan</div>
          <div className="cp-plan-sub">{planSummary.summary}</div>
        </div>
      </div>

      {planSummary.steps?.map((step) => (
        <div key={step.step} className={`cp-step${step.type === 'write' ? ' write' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{step.agentIcon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="cp-step-num">Step {step.step}:</span>
                <span className="cp-step-action">{step.action.replace(/_/g, ' ')}</span>
                {step.type === 'write' && <span className="cp-irr-badge">⚠️ Irreversible</span>}
              </div>
              <p className="cp-step-desc">{step.description}</p>
              {step.warning && (
                <p className="cp-step-warn">
                  <AlertTriangle style={{ width: 11, height: 11, flexShrink: 0 }} />
                  {step.warning}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {planSummary.hasIrreversible && (
        <div className="cp-irr-warning">
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span>{planSummary.irreversibleSteps?.length} step(s) will interact with external services and cannot be undone.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cp-confirm-btn" onClick={onConfirm} disabled={isExecuting}>
          {isExecuting
            ? <><Loader2 style={{ width: 14, height: 14 }} className="cp-spin" /> Running...</>
            : <><Play style={{ width: 14, height: 14 }} /> Go Ahead</>}
        </button>
        <button className="cp-cancel-btn" onClick={onCancel} disabled={isExecuting}>
          <Ban style={{ width: 14, height: 14 }} /> Cancel
        </button>
      </div>
    </div>
  );
};

// ─── ChatPanel ────────────────────────────────────────────────────────────────
const ChatPanel = ({ isOpen, onClose, onApprovalRequest, embedded = false, onAgentStatusUpdate }) => {
  const [messages, setMessages] = useState([{
    id: 'welcome', role: 'assistant',
    content: "Hello! I'm your AI Job Hunt Agent — your digital recruiter. Tell me what you want done and I'll plan it, show you the steps, and execute only after your approval.\n\nTry: \"Find me Software Engineer jobs in Lahore\" or \"Apply to the best job you found\"",
    timestamp: new Date().toISOString(),
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [pendingPlan, setPendingPlan] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, pendingPlan]);

  useEffect(() => {
    if (!embedded && !isOpen) return;
    const fetch = async () => {
      try {
        const res = await orchestratorApi.getAgents();
        if (res.data.success) {
          const map = {};
          res.data.agents.forEach(a => { map[a.agentId] = a; });
          setAgentStatuses(map);
          onAgentStatusUpdate?.(map);
        }
      } catch (_) {}
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [isOpen, embedded]);

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  const handleSubmit = async (e, overrideMessage = null) => {
    e?.preventDefault();
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || isLoading) return;
    setInput(''); setIsLoading(true); setPendingPlan(null);

    addMessage({ id: `user_${Date.now()}`, role: 'user', content: userMessage, timestamp: new Date().toISOString() });

    try {
      const response = await orchestratorApi.chat(userMessage);
      const data = response.data;
      const normalize = (r) => { if (!r) return 'Done!'; if (typeof r === 'string') return r; return r.message || r.response || r.text || r.reply || JSON.stringify(r); };

      if (data.success) {
        if (data.requiresConfirmation && data.planSummary) {
          addMessage({ id: `assistant_${Date.now()}`, role: 'assistant', content: normalize(data.response), intent: data.intent, timestamp: new Date().toISOString() });
          setPendingPlan(data.planSummary);
        } else {
          addMessage({ id: `assistant_${Date.now()}`, role: 'assistant', content: normalize(data.response), intent: data.intent, tasks: data.tasks, timestamp: new Date().toISOString() });
          if (data.requiresApproval) {
            try { const approvals = await orchestratorApi.getApprovals(); if (approvals.data.approvals?.length > 0) onApprovalRequest?.(approvals.data.approvals[0]); } catch (_) {}
          }
        }
      } else {
        addMessage({ id: `error_${Date.now()}`, role: 'error', content: data.error || 'Something went wrong.', timestamp: new Date().toISOString() });
      }
    } catch (err) {
      addMessage({ id: `error_${Date.now()}`, role: 'error', content: err.response?.data?.error || 'Failed to send message.', timestamp: new Date().toISOString() });
    } finally { setIsLoading(false); }
  };

  const handleConfirmPlan = async () => {
    if (!pendingPlan?.sessionId) return;
    setIsExecuting(true);
    addMessage({ id: `user_confirm_${Date.now()}`, role: 'user', content: '✅ Go ahead with the plan.', timestamp: new Date().toISOString() });
    const saved = pendingPlan; setPendingPlan(null);
    try {
      const response = await orchestratorApi.executeConfirmed(saved.sessionId);
      const data = response.data;
      const normalize = (r) => { if (!r) return 'Done!'; if (typeof r === 'string') return r; return r.message || r.response || r.text || r.reply || JSON.stringify(r); };
      if (data.success) {
        addMessage({ id: `assistant_${Date.now()}`, role: 'assistant', content: normalize(data.response), intent: data.intent, tasks: data.tasks, timestamp: new Date().toISOString() });
        if (data.requiresApproval) {
          try { const approvals = await orchestratorApi.getApprovals(); if (approvals.data.approvals?.length > 0) onApprovalRequest?.(approvals.data.approvals[0]); } catch (_) {}
        }
      } else {
        addMessage({ id: `error_${Date.now()}`, role: 'error', content: data.error || 'Execution failed.', timestamp: new Date().toISOString() });
      }
    } catch (err) {
      addMessage({ id: `error_${Date.now()}`, role: 'error', content: err.response?.data?.error || 'Execution failed.', timestamp: new Date().toISOString() });
    } finally { setIsExecuting(false); }
  };

  const handleCancelPlan = () => {
    setPendingPlan(null);
    addMessage({ id: `cancel_${Date.now()}`, role: 'assistant', content: "No problem! The plan has been cancelled. Nothing was sent or changed. What else can I help you with?", timestamp: new Date().toISOString() });
  };

  const getStatusIcon = (status) => {
    if (status === 'working')         return <Loader2 style={{ width: 11, height: 11, color: '#10b981' }} className="cp-spin" />;
    if (status === 'waiting_approval') return <Clock style={{ width: 11, height: 11, color: '#f59e0b' }} />;
    if (status === 'completed')        return <CheckCircle style={{ width: 11, height: 11, color: '#10b981' }} />;
    if (status === 'error')            return <XCircle style={{ width: 11, height: 11, color: '#ef4444' }} />;
    return <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#d1d5db' }} />;
  };

  const renderMessage = (msg) => {
    const content = typeof msg.content === 'object'
      ? (msg.content?.message || msg.content?.response || msg.content?.text || JSON.stringify(msg.content))
      : msg.content;

    if (msg.role === 'user') return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="cp-bubble-user"><p>{content}</p></div>
      </div>
    );

    if (msg.role === 'error') return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="cp-bubble-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <p>{content}</p>
        </div>
      </div>
    );

    return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div className="cp-bubble-bot">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div className="cp-bot-icon"><Bot style={{ width: 12, height: 12, color: '#10b981' }} /></div>
            <div style={{ flex: 1 }}>
              <p>{content}</p>
              {msg.intent && (
                <div className="cp-intent-badge">
                  <span className="cp-intent-tag">{msg.intent.intent}</span>
                  <span className="cp-intent-conf">{Math.round((msg.intent.confidence || 0) * 100)}% confidence</span>
                </div>
              )}
              {msg.tasks && msg.tasks.length > 0 && (
                <div className="cp-tasks">
                  <div className="cp-tasks-label">Agent Actions</div>
                  {msg.tasks.map((task, idx) => (
                    <div key={idx} className="cp-task-row">
                      <ChevronRight style={{ width: 10, height: 10 }} />
                      <span className="cp-task-agent">{task.agent}:</span>
                      <span>{task.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const chatContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Agent Status Bar */}
      {Object.keys(agentStatuses).length > 0 && (
        <div className="cp-status-bar">
          {Object.entries(agentStatuses).map(([id, agent]) => (
            <div key={id} title={agent.currentTask || agent.agentName}
              className={`cp-status-pill ${agent.status === 'working' ? 'working' : agent.status === 'waiting_approval' ? 'waiting' : agent.status === 'error' ? 'error' : 'idle'}`}>
              {getStatusIcon(agent.status)}
              <span>{agent.agentName || id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="cp-messages">
        {messages.map(renderMessage)}
        {pendingPlan && (
          <PlanConfirmCard planSummary={pendingPlan} onConfirm={handleConfirmPlan} onCancel={handleCancelPlan} isExecuting={isExecuting} />
        )}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="cp-thinking">
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0,1,2].map(i => <div key={i} className="cp-dot" style={{ animationDelay: `${i*0.18}s` }} />)}
              </div>
              <span>Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chips */}
      {!pendingPlan && !isLoading && messages.length <= 1 && (
        <div className="cp-chips-wrap">
          {QUICK_CHIPS.map(chip => (
            <button key={chip.label} className="cp-chip" onClick={() => handleSubmit(null, chip.message)}>
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="cp-input-area">
        <form className="cp-input-row" onSubmit={handleSubmit}>
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Delegate a task to your agent..."
            className="cp-input" disabled={isLoading || isExecuting}
          />
          <button type="submit" className="cp-send-btn" disabled={!input.trim() || isLoading || isExecuting}>
            <Send style={{ width: 15, height: 15 }} />
          </button>
        </form>
      </div>
    </div>
  );

  // Embedded mode
  if (embedded) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="cp-root" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f7fdf9' }}>
          {chatContent}
        </div>
      </>
    );
  }

  // Slide-out panel
  return (
    <>
      <style>{STYLES}</style>
      <div className={`cp-root cp-slide-panel${isOpen ? ' open' : ''}`}>
        <div className="cp-header">
          <div className="cp-header-brand">
            <div className="cp-header-icon">
              <Bot style={{ width: 18, height: 18, color: 'white' }} />
            </div>
            <div>
              <div className="cp-header-title">Job Hunt Agent</div>
              <div className="cp-header-sub">AI-powered recruiter</div>
            </div>
          </div>
          <button className="cp-close-btn" onClick={onClose}>
            <XCircle style={{ width: 15, height: 15 }} />
          </button>
        </div>
        {chatContent}
      </div>
    </>
  );
};

export default ChatPanel;