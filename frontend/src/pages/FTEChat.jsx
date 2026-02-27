import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fteApi } from '../services/fteApi';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const ASYNC_STATES = new Set(['searching', 'generating_cvs', 'finding_emails', 'sending']);

const STATE_LABELS = {
  waiting_cv:     'Upload CV',
  cv_uploaded:    'Enter Role & City',
  asking_location:'Enter City',
  searching:      'Searching Jobs...',
  generating_cvs: 'Generating CVs...',
  cv_review:      'Review CVs',
  finding_emails: 'Finding HR Emails...',
  email_review:   'Review Emails',
  sending:        'Sending Applications...',
  done:           'Done ✓',
};

const STATE_COLORS = {
  waiting_cv:     'bg-gray-400',
  cv_uploaded:    'bg-blue-500',
  asking_location:'bg-blue-500',
  searching:      'bg-yellow-500 animate-pulse',
  generating_cvs: 'bg-yellow-500 animate-pulse',
  cv_review:      'bg-purple-500',
  finding_emails: 'bg-yellow-500 animate-pulse',
  email_review:   'bg-orange-500',
  sending:        'bg-yellow-500 animate-pulse',
  done:           'bg-green-500',
};

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}

// ─── Message bubbles ──────────────────────────────────────────────────────────
function BotMessage({ children, isLoading }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
        FTE
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%] shadow-sm text-gray-800">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Spinner /> <span className="text-sm">Soch raha hoon...</span>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function UserMessage({ children }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[80%] shadow-sm text-sm">
        {children}
      </div>
    </div>
  );
}

function StatusMessage({ children }) {
  return (
    <div className="flex justify-center mb-4">
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full px-4 py-1.5 text-sm flex items-center gap-2">
        <Spinner /> {children}
      </div>
    </div>
  );
}

// ─── Markdown-like text renderer ──────────────────────────────────────────────
function BotText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : p.startsWith('_(') && p.endsWith(')_')
            ? <em key={j} className="text-gray-400 text-xs">{p.slice(2, -2)}</em>
            : p
        );
        return <p key={i} className={line === '' ? 'h-1' : ''}>{rendered}</p>;
      })}
    </div>
  );
}

// ─── CV Approval Cards ────────────────────────────────────────────────────────
function CVApprovalCards({ cvResults, approvalId, onApprove, onReject, loading }) {
  const [expanded, setExpanded] = useState(null);
  const validCVs = cvResults.filter(r => !r.error);

  return (
    <div className="w-full">
      <p className="text-sm font-semibold text-gray-800 mb-3">
        {validCVs.length} tailored CVs tayyar hain — review karein:
      </p>
      <div className="space-y-2 mb-4">
        {cvResults.map((result, idx) => {
          const score = result.atsScore?.overall ?? result.atsScore?.format ?? null;
          const scoreColor = score === null ? 'text-gray-400' : score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500';
          const cv = result.cv || {};
          const isOpen = expanded === idx;

          return (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {/* ── Card Header ── */}
              <button
                className="w-full flex items-start justify-between p-3 hover:bg-gray-50 transition-colors text-left gap-2"
                onClick={() => setExpanded(isOpen ? null : idx)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-900 truncate">{result.job?.title || 'Unknown Role'}</p>
                  <p className="text-xs text-gray-500 truncate">{result.job?.company} · {result.job?.location}</p>
                  {result.job?.sourceUrl && (
                    <a
                      href={result.job.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-indigo-500 hover:underline mt-0.5 inline-block"
                    >
                      Job link ↗
                    </a>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {result.error ? (
                    <span className="text-xs text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Failed</span>
                  ) : (
                    <>
                      <p className={`text-xl font-bold leading-none ${scoreColor}`}>
                        {score !== null ? `${score}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-400">ATS Score</p>
                    </>
                  )}
                  <span className="text-gray-300 text-xs mt-1 block">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* ── Expanded CV Content ── */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3 text-xs">
                  {result.error ? (
                    <p className="text-red-500">{result.error}</p>
                  ) : (
                    <>
                      {/* Professional Summary */}
                      {(cv.summary || cv.profile || cv.objective || cv.professionalSummary) && (
                        <div>
                          <p className="font-semibold text-gray-600 mb-1">📋 Professional Summary</p>
                          <p className="text-gray-700 leading-relaxed">
                            {cv.summary || cv.profile || cv.objective || cv.professionalSummary}
                          </p>
                        </div>
                      )}

                      {/* Skills */}
                      {cv.skills?.length > 0 && (
                        <div>
                          <p className="font-semibold text-gray-600 mb-1.5">⚡ Key Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(cv.skills) ? cv.skills : []).slice(0, 12).map((skill, i) => (
                              <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md px-2 py-0.5 font-medium">
                                {typeof skill === 'string' ? skill : skill.name || String(skill)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Experience */}
                      {cv.experience?.length > 0 && (
                        <div>
                          <p className="font-semibold text-gray-600 mb-1">💼 Experience</p>
                          {cv.experience.slice(0, 2).map((exp, i) => (
                            <div key={i} className="mb-1.5 pl-2 border-l-2 border-indigo-200">
                              <p className="font-medium text-gray-800">
                                {exp.role || exp.title || exp.position} @ {exp.company || exp.organization}
                              </p>
                              <p className="text-gray-500">{exp.duration || exp.period || exp.dates || exp.date}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ATS Score Breakdown */}
                      {result.atsScore && Object.keys(result.atsScore).length > 1 && (
                        <div>
                          <p className="font-semibold text-gray-600 mb-1">📊 ATS Breakdown</p>
                          <div className="flex flex-wrap gap-3 text-gray-600">
                            {Object.entries(result.atsScore).map(([k, v]) => (
                              <span key={k} className="capitalize">
                                {k}: <strong className={v >= 80 ? 'text-green-600' : v >= 60 ? 'text-yellow-600' : 'text-red-500'}>{v}%</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {result.recommendations?.length > 0 && (
                        <div>
                          <p className="font-semibold text-gray-600 mb-1">💡 Improvements</p>
                          <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                            {result.recommendations.slice(0, 3).map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(approvalId)}
          disabled={loading || validCVs.length === 0}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><Spinner /> Approving...</span>
            : `✓ Approve ${validCVs.length} CVs`}
        </button>
        <button
          onClick={() => onReject()}
          disabled={loading}
          className="px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Email Approval Cards ─────────────────────────────────────────────────────
function EmailApprovalCards({ emailDrafts, approvalId, onSend, onReject, loading }) {
  const validDrafts = emailDrafts.filter(d => d.hrEmail && !d.error);
  const [drafts, setDrafts] = useState(validDrafts.map(d => ({ ...d })));
  const [expanded, setExpanded] = useState(null);

  const updateDraft = (idx, field, value) => {
    const updated = [...drafts];
    updated[idx] = { ...updated[idx], [field]: value };
    setDrafts(updated);
  };

  const skipped = emailDrafts.filter(d => !d.hrEmail || d.error);

  return (
    <div className="w-full">
      <p className="text-sm font-semibold text-gray-800 mb-1">
        {drafts.length} email drafts tayyar hain:
      </p>
      {skipped.length > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          ({skipped.length} companies ki HR email nahi mili — skip ho jayengi)
        </p>
      )}

      <div className="space-y-2 mb-4">
        {drafts.map((draft, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
            >
              <div>
                <p className="font-semibold text-sm text-gray-900">{draft.job?.company}</p>
                <p className="text-xs text-gray-500">{draft.hrEmail} · {draft.job?.title}</p>
              </div>
              <span className="text-gray-300 text-xs">{expanded === idx ? '▲' : '▼'}</span>
            </button>
            {expanded === idx && (
              <div className="p-3 border-t border-gray-100 space-y-2 bg-gray-50">
                <div>
                  <label className="text-xs text-gray-500 font-medium">To (HR Email)</label>
                  <input
                    type="email"
                    value={draft.hrEmail}
                    onChange={e => updateDraft(idx, 'hrEmail', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Subject</label>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={e => updateDraft(idx, 'subject', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Email Body</label>
                  <textarea
                    value={draft.body}
                    onChange={e => updateDraft(idx, 'body', e.target.value)}
                    rows={5}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSend(approvalId, drafts)}
          disabled={loading || drafts.length === 0}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><Spinner /> Sending...</span>
            : `✉ Send ${drafts.length} Applications`}
        </button>
        <button
          onClick={() => onReject()}
          disabled={loading}
          className="px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Send Results ─────────────────────────────────────────────────────────────
function SendResults({ results }) {
  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return (
    <div className="w-full">
      <div className="flex gap-3 mb-3">
        <span className="text-sm font-semibold text-green-600">✓ {success.length} sent</span>
        {failed.length > 0 && <span className="text-sm text-red-500">✗ {failed.length} failed</span>}
      </div>
      <div className="space-y-1.5">
        {results.map((r, idx) => (
          <div key={idx} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            <span className="font-medium">{r.success ? '✓' : '✗'} {r.company} — {r.jobTitle}</span>
            <span className="opacity-60">{r.hrEmail || r.error || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History Sidebar ──────────────────────────────────────────────────────────
function HistorySidebar({ open, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fteApi.getHistory()
      .then(res => setHistory(res.data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open]);

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-20" onClick={onClose} />}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-30 flex flex-col transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-indigo-50">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Session History</h2>
            <p className="text-xs text-gray-500">Past job application sessions</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-indigo-100 text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <Spinner /> Loading...
            </div>
          )}
          {!loading && history.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              Abhi koi history nahi.<br />
              Pehla session complete karo!
            </div>
          )}
          {!loading && history.map((session, idx) => (
            <div key={idx} className="border border-gray-100 rounded-xl p-3 bg-gray-50 hover:bg-indigo-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{session.role || 'Unknown Role'}</p>
                  <p className="text-xs text-gray-500">{session.location || '—'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${session.sentCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {session.sentCount > 0 ? `${session.sentCount} sent` : 'No sends'}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 mb-2">
                <span>🔍 {session.jobCount || 0} jobs</span>
                <span>📄 {session.cvCount || 0} CVs</span>
                <span>✉ {session.emailCount || 0} emails</span>
              </div>
              {session.companies?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {session.companies.slice(0, 4).map((c, i) => (
                    <span key={i} className="text-xs bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-gray-600">{c}</span>
                  ))}
                  {session.companies.length > 4 && (
                    <span className="text-xs text-gray-400">+{session.companies.length - 4} more</span>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">{formatDate(session.completedAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Main FTE Chat Page ───────────────────────────────────────────────────────
export default function FTEChat() {
  const { user, logout } = useAuth();

  const [messages, setMessages] = useState([]);
  const [currentState, setCurrentState] = useState('waiting_cv');
  const [input, setInput] = useState('');
  const [cvFile, setCvFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Add messages ─────────────────────────────────────────────────────────────
  const addBotMessage = useCallback((type, content, data = null) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'bot', type, content, data, ts: new Date() }]);
  }, []);

  const addUserMessage = useCallback((text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', type: 'text', content: text, ts: new Date() }]);
  }, []);

  // ── Initial load — restore state ────────────────────────────────────────────
  useEffect(() => {
    fteApi.getState()
      .then(res => {
        const s = res.data;
        setCurrentState(s.state || 'waiting_cv');

        if (!s.state || s.state === 'waiting_cv') {
          addBotMessage('text', 'Assalam o Alaikum! Main aapka **Digital FTE** hoon.\n\nMain automatically:\n• Jobs dhundhta hoon (SerpAPI)\n• Tailored CVs banata hoon (AI)\n• HR ko emails bhejta hoon\n\nShuru karne ke liye — apni **CV (PDF)** upload karein.');
        } else if (s.state === 'cv_uploaded') {
          addBotMessage('text', 'CV already upload hai. Batayein — **kaunsi role aur kaunse city** mein job chahiye?\n_(misaal: "Software Engineer Karachi")_');
        } else if (s.state === 'asking_location') {
          addBotMessage('text', `Role: **${s.role}**\n\nAb **kaunse city** mein job chahiye?`);
        } else if (ASYNC_STATES.has(s.state)) {
          addBotMessage('status', STATE_LABELS[s.state] || 'Kaam ho raha hai...');
        } else if (s.state === 'cv_review' && s.cvResults?.length) {
          addBotMessage('cv_approval', 'CVs tayyar hain!', { cvResults: s.cvResults, cvReviewApprovalId: s.cvReviewApprovalId });
        } else if (s.state === 'email_review' && s.emailDrafts?.length) {
          addBotMessage('email_approval', 'Email drafts tayyar hain!', { emailDrafts: s.emailDrafts, emailReviewApprovalId: s.emailReviewApprovalId });
        } else if (s.state === 'done') {
          addBotMessage('result', 'Sab ho gaya!', { sendResults: s.sendResults });
        }
      })
      .catch(() => {
        addBotMessage('text', 'Assalam o Alaikum! Apni **CV (PDF)** upload karein.');
      });
  }, []); // eslint-disable-line

  // ── Polling for async states ────────────────────────────────────────────────
  useEffect(() => {
    if (!ASYNC_STATES.has(currentState)) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fteApi.getState();
        const s = res.data;

        // State hasn't changed — still check if a new error appeared in background
        if (s.state === currentState) {
          if (s.error) {
            // Error appeared while in same async state — show and stop polling
            setCurrentState('cv_uploaded');
            addBotMessage('text', `❌ Masla aaya: ${s.error}\n\n**New Chat** button se dobara try karein.`);
          }
          return;
        }

        // State changed
        setCurrentState(s.state);

        // If new state is non-async AND has error → job search / pipeline failed
        if (s.error && !ASYNC_STATES.has(s.state)) {
          addBotMessage('text', `❌ ${s.error}\n\nRole ya city change karke **New Chat** se dobara try karein.`);
          return;
        }

        if (s.state === 'generating_cvs') {
          addBotMessage('status', `🔍 ${s.jobs?.length || 0} jobs mili! Tailored CVs bana raha hoon...`);
        } else if (s.state === 'cv_review' && s.cvResults?.length) {
          addBotMessage('cv_approval', `${s.cvResults.length} tailored CVs tayyar hain! Review karein:`, {
            cvResults: s.cvResults, cvReviewApprovalId: s.cvReviewApprovalId,
          });
        } else if (s.state === 'finding_emails') {
          addBotMessage('status', '✓ CVs approved! HR emails dhundh raha hoon...');
        } else if (s.state === 'email_review') {
          const validDrafts = (s.emailDrafts || []).filter(d => d.hrEmail);
          addBotMessage('email_approval', `${validDrafts.length} email drafts tayyar hain! Review karein:`, {
            emailDrafts: s.emailDrafts || [], emailReviewApprovalId: s.emailReviewApprovalId,
          });
        } else if (s.state === 'done') {
          addBotMessage('result', '✅ Applications send ho gayi!', { sendResults: s.sendResults });
        }
      } catch {
        // ignore transient polling errors
      }
    }, 2500);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [currentState, addBotMessage]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async (overrideMessage) => {
    const text = typeof overrideMessage === 'string' ? overrideMessage : input.trim();
    const file = cvFile;
    if (!text && !file) return;
    if (sending) return;

    if (text) addUserMessage(text);
    if (file) addUserMessage(`📎 ${file.name}`);

    setSending(true);
    setCvFile(null);
    setInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const res = await fteApi.chat(text, file);
      const { botMessage, state, data } = res.data;
      setCurrentState(state);

      if (state === 'cv_review' && data?.cvResults?.length) {
        addBotMessage('cv_approval', botMessage, data);
      } else if (state === 'email_review' && data?.emailDrafts?.length) {
        addBotMessage('email_approval', botMessage, data);
      } else if (state === 'done' && data?.sendResults) {
        addBotMessage('result', botMessage, data);
      } else if (ASYNC_STATES.has(state)) {
        addBotMessage('status', botMessage);
      } else {
        addBotMessage('text', botMessage);
      }
    } catch (err) {
      addBotMessage('text', `Masla aaya: ${err.response?.data?.error || err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── New Chat ─────────────────────────────────────────────────────────────────
  const handleNewChat = async () => {
    try {
      await fteApi.reset();
      setMessages([]);
      setCurrentState('waiting_cv');
      setTimeout(() => {
        addBotMessage('text', 'Nayi chat shuru! Apni **CV (PDF)** upload karein.');
      }, 50);
    } catch {
      toast.error('Reset fail ho gaya');
    }
  };

  // ── CV Approval ──────────────────────────────────────────────────────────────
  const handleApproveCVs = async (approvalId) => {
    setApprovalLoading(true);
    try {
      await fteApi.approveCVs(approvalId);
      setCurrentState('finding_emails');
      addBotMessage('status', 'CVs approved! HR emails dhundh raha hoon...');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approve fail ho gaya');
    } finally {
      setApprovalLoading(false);
    }
  };

  // ── Email Approval ───────────────────────────────────────────────────────────
  const handleSendEmails = async (approvalId, modifiedDrafts) => {
    setApprovalLoading(true);
    try {
      await fteApi.approveEmails(approvalId, modifiedDrafts);
      setCurrentState('sending');
      addBotMessage('status', 'Emails bhej raha hoon...');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send fail ho gaya');
    } finally {
      setApprovalLoading(false);
    }
  };

  // ── Reject / Cancel ──────────────────────────────────────────────────────────
  const handleReject = async () => {
    try {
      await fteApi.reset();
      setCurrentState('waiting_cv');
      addBotMessage('text', 'Cancel ho gaya. Dobara shuru karne ke liye CV upload karein.');
    } catch {
      toast.error('Cancel fail ho gaya');
    }
  };

  // ── File upload ──────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setCvFile(f);
      setTimeout(() => handleSend(''), 100);
    }
  };

  const isInputDisabled = sending || ASYNC_STATES.has(currentState);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      <HistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          {/* History */}
          <button
            onClick={() => setHistoryOpen(true)}
            title="Session History"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-600 transition-colors"
          >
            ☰
          </button>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            FTE
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">Digital FTE</h1>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${STATE_COLORS[currentState] || 'bg-gray-400'}`} />
              <span className="text-xs text-gray-500">{STATE_LABELS[currentState] || currentState}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* New Chat button */}
          <button
            onClick={handleNewChat}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            + New Chat
          </button>
          <span className="text-xs text-gray-400 hidden sm:block">{user?.name || user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {messages.map(msg => {
            if (msg.role === 'user') {
              return <UserMessage key={msg.id}>{msg.content}</UserMessage>;
            }
            if (msg.type === 'status') {
              return <StatusMessage key={msg.id}>{msg.content}</StatusMessage>;
            }
            if (msg.type === 'cv_approval' && msg.data?.cvResults) {
              return (
                <BotMessage key={msg.id}>
                  <CVApprovalCards
                    cvResults={msg.data.cvResults}
                    approvalId={msg.data.cvReviewApprovalId}
                    onApprove={handleApproveCVs}
                    onReject={handleReject}
                    loading={approvalLoading}
                  />
                </BotMessage>
              );
            }
            if (msg.type === 'email_approval' && msg.data?.emailDrafts) {
              return (
                <BotMessage key={msg.id}>
                  <EmailApprovalCards
                    emailDrafts={msg.data.emailDrafts}
                    approvalId={msg.data.emailReviewApprovalId}
                    onSend={handleSendEmails}
                    onReject={handleReject}
                    loading={approvalLoading}
                  />
                </BotMessage>
              );
            }
            if (msg.type === 'result' && msg.data?.sendResults) {
              return (
                <BotMessage key={msg.id}>
                  <SendResults results={msg.data.sendResults} />
                  <button
                    onClick={handleNewChat}
                    className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 underline block"
                  >
                    + New Chat shuru karein
                  </button>
                </BotMessage>
              );
            }
            return (
              <BotMessage key={msg.id}>
                <BotText text={msg.content} />
              </BotMessage>
            );
          })}

          {sending && <BotMessage isLoading />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2">
            {/* CV Upload */}
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isInputDisabled}
              title="Upload CV (PDF)"
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40
                ${currentState === 'waiting_cv'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                }`}
            >
              📎
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              {cvFile && (
                <div className="absolute -top-8 left-0 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                  📎 {cvFile.name}
                  <button onClick={() => { setCvFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-1 hover:text-red-500">✕</button>
                </div>
              )}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isInputDisabled}
                placeholder={
                  currentState === 'waiting_cv'
                    ? 'CV upload karein (📎 button se)...'
                    : currentState === 'cv_uploaded' || currentState === 'asking_location'
                    ? 'Role aur city likhein, e.g. "Software Engineer Karachi"...'
                    : ASYNC_STATES.has(currentState)
                    ? 'Kaam ho raha hai, intezaar karein...'
                    : 'Yahan likhein... (Enter = send)'
                }
                rows={1}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
              />
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={isInputDisabled || (!input.trim() && !cvFile)}
              className="flex-shrink-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors"
            >
              {sending ? <Spinner /> : '→'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            Digital FTE — CV upload → role+city → auto jobs → auto CVs → approve → auto emails → send
          </p>
        </div>
      </div>
    </div>
  );
}
