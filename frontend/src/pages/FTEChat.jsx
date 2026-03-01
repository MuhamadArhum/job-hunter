import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fteApi } from '../services/fteApi';
import { authAPI, userAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Send, Paperclip, PanelLeft, LogOut, Bot,
  Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Mail, FileText, Plus, X,
  Building2, MapPin, Clock, TrendingUp,
  User, Key, Save, Edit3, Shield, Download,
  Sparkles, Zap, Brain, Activity, Search,
  FileCheck, AtSign, Rocket, ArrowRight, AlertTriangle,
} from 'lucide-react';

const ASYNC_STATES = new Set(['searching', 'generating_cvs', 'finding_emails', 'sending', 'preparing_interview']);

const PIPELINE_STEPS = [
  { key: 'waiting_cv',          label: 'CV Upload',    icon: FileText },
  { key: 'searching',           label: 'Job Search',   icon: Search },
  { key: 'generating_cvs',      label: 'CV Gen',       icon: FileCheck },
  { key: 'finding_emails',      label: 'HR Emails',    icon: AtSign },
  { key: 'email_review',        label: 'Review',       icon: Mail },
  { key: 'done',                label: 'Sent!',        icon: Rocket },
];

const STATE_STEP_MAP = {
  waiting_cv: 0, cv_uploaded: 0, ready: 0,
  asking_location: 1, searching: 1,
  generating_cvs: 2, cv_review: 2,
  finding_emails: 3,
  email_review: 4, sending: 4,
  done: 5, preparing_interview: 5,
};

const STATE_META = {
  waiting_cv:          { label: 'Upload CV',               color: '#6366f1' },
  cv_uploaded:         { label: 'Ready',                   color: '#10b981' },
  ready:               { label: 'Ready',                   color: '#10b981' },
  asking_location:     { label: 'Enter City',              color: '#6366f1' },
  searching:           { label: 'Searching Jobs...',       color: '#f59e0b' },
  generating_cvs:      { label: 'Generating CVs...',       color: '#f59e0b' },
  cv_review:           { label: 'Review CVs',              color: '#8b5cf6' },
  finding_emails:      { label: 'Finding Emails...',       color: '#f59e0b' },
  email_review:        { label: 'Review Emails',           color: '#ec4899' },
  sending:             { label: 'Sending...',              color: '#f59e0b' },
  preparing_interview: { label: 'Prep Interview...',       color: '#8b5cf6' },
  done:                { label: 'Complete!',               color: '#10b981' },
};

// ─── Activity icon mapping ────────────────────────────────────────────────────
function getActivityIcon(msg) {
  if (msg.startsWith('✅') || msg.startsWith('🎉')) return 'success';
  if (msg.startsWith('❌') || msg.startsWith('✗')) return 'error';
  if (msg.startsWith('⚠️')) return 'warn';
  if (msg.startsWith('🔍') || msg.startsWith('🔎')) return 'search';
  if (msg.startsWith('📄') || msg.startsWith('📝') || msg.startsWith('🖨️')) return 'cv';
  if (msg.startsWith('✉️') || msg.startsWith('📧') || msg.startsWith('📬') || msg.startsWith('📤')) return 'email';
  if (msg.startsWith('🤖')) return 'ai';
  return msg.type === 'success' ? 'success' : msg.type === 'error' ? 'error' : 'info';
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Complete redesign (Deep Space + Indigo palette)
═══════════════════════════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --bg-base:      #05070f;
    --bg-surface:   #0b0e1a;
    --bg-card:      #0f1425;
    --bg-raised:    #141929;
    --bg-hover:     #1a2038;
    --bg-active:    #1f273f;
    --border:       rgba(255,255,255,0.06);
    --border-md:    rgba(255,255,255,0.09);
    --border-hi:    rgba(255,255,255,0.14);
    --accent:       #6366f1;
    --accent-hi:    #818cf8;
    --accent-dim:   rgba(99,102,241,0.12);
    --accent-glow:  rgba(99,102,241,0.25);
    --accent-line:  rgba(99,102,241,0.5);
    --gold:         #f59e0b;
    --gold-dim:     rgba(245,158,11,0.1);
    --gold-border:  rgba(245,158,11,0.25);
    --success:      #10b981;
    --success-dim:  rgba(16,185,129,0.1);
    --success-border: rgba(16,185,129,0.25);
    --error:        #ef4444;
    --error-dim:    rgba(239,68,68,0.1);
    --error-border: rgba(239,68,68,0.25);
    --violet:       #8b5cf6;
    --violet-dim:   rgba(139,92,246,0.12);
    --blue:         #3b82f6;
    --blue-dim:     rgba(59,130,246,0.12);
    --pink:         #ec4899;
    --text-1:       #f1f5f9;
    --text-2:       #94a3b8;
    --text-3:       #475569;
    --text-accent:  #a5b4fc;
    --text-gold:    #fcd34d;
    --radius-xs:    6px;
    --radius-sm:    8px;
    --radius-md:    12px;
    --radius-lg:    16px;
    --radius-xl:    20px;
    --shadow-sm:    0 1px 4px rgba(0,0,0,0.5);
    --shadow-md:    0 4px 20px rgba(0,0,0,0.5);
    --shadow-lg:    0 12px 48px rgba(0,0,0,0.6);
    --shadow-glow:  0 0 24px var(--accent-glow), 0 4px 20px rgba(0,0,0,0.5);
  }

  .t-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
  .t-root { height: 100vh; display: flex; flex-direction: column; background: var(--bg-base); overflow: hidden; color: var(--text-1); }

  /* ── Ambient glow ── */
  .t-root::before {
    content: ''; position: fixed; top: -20%; left: 30%; width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }
  .t-root::after {
    content: ''; position: fixed; bottom: -10%; right: 10%; width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }

  /* ── Scrollbars ── */
  .t-root ::-webkit-scrollbar { width: 4px; }
  .t-root ::-webkit-scrollbar-track { background: transparent; }
  .t-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
  .t-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

  /* ══════════════ HEADER ══════════════ */
  .t-header {
    position: relative; z-index: 10;
    background: rgba(11,14,26,0.95);
    border-bottom: 1px solid var(--border);
    padding: 0 20px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; height: 58px;
    backdrop-filter: blur(20px);
  }
  .t-header::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, var(--accent-line) 30%, var(--violet) 70%, transparent 100%);
    opacity: 0.4;
  }

  .t-logo-wrap { display: flex; align-items: center; gap: 11px; }
  .t-logo-icon {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), var(--violet));
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-glow); transition: transform 0.2s;
  }
  .t-logo-icon:hover { transform: scale(1.05); }
  .t-logo-name { color: var(--text-1); font-weight: 800; font-size: 0.96rem; letter-spacing: -0.02em; }
  .t-logo-badge {
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em;
    background: var(--accent-dim); border: 1px solid var(--accent-line);
    color: var(--text-accent); border-radius: 5px; padding: 2px 7px;
    text-transform: uppercase;
  }

  .t-status-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--success); box-shadow: 0 0 8px var(--success);
  }
  .t-status-dot.pulse { animation: tDotPulse 1.4s ease-in-out infinite; }
  @keyframes tDotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
  .t-status-label { font-size: 0.65rem; font-weight: 600; color: var(--text-3); }

  .t-btn {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.01em;
    background: var(--bg-raised); border: 1px solid var(--border-md);
    color: var(--text-2); border-radius: var(--radius-sm);
    padding: 6px 13px; cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .t-btn:hover { background: var(--bg-hover); color: var(--text-1); border-color: var(--border-hi); }
  .t-btn.primary {
    background: linear-gradient(135deg, var(--accent), var(--violet));
    border-color: transparent; color: white;
    box-shadow: 0 2px 12px var(--accent-glow);
  }
  .t-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }

  .t-icon-btn {
    width: 34px; height: 34px; border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    color: var(--text-3); transition: all 0.15s;
  }
  .t-icon-btn:hover { background: var(--bg-hover); color: var(--text-2); }

  .t-avatar {
    width: 32px; height: 32px; border-radius: 9px;
    background: linear-gradient(135deg, var(--accent-dim), var(--violet-dim));
    border: 1px solid var(--accent-line);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    color: var(--text-accent); font-size: 0.65rem; font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    transition: all 0.2s; flex-shrink: 0;
  }
  .t-avatar:hover { border-color: var(--accent); box-shadow: 0 0 10px var(--accent-glow); }

  .t-mode-toggle {
    display: flex; background: var(--bg-raised);
    border: 1px solid var(--border-md); border-radius: 9px; padding: 3px; gap: 2px;
  }
  .t-mode-btn {
    padding: 4px 11px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 0.69rem; font-weight: 600; font-family: inherit;
    background: none; color: var(--text-3); transition: all 0.18s;
    display: flex; align-items: center; gap: 4px; white-space: nowrap;
  }
  .t-mode-btn.active {
    background: var(--accent-dim); color: var(--text-accent);
    border: 1px solid var(--accent-line);
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .t-mode-btn:hover:not(.active) { color: var(--text-2); }

  /* ══════════════ BODY ══════════════ */
  .t-body { flex: 1; display: flex; overflow: hidden; position: relative; z-index: 1; }

  /* ══════════════ CHAT AREA ══════════════ */
  .t-chat { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  .t-messages {
    flex: 1; overflow-y: auto; padding: 28px 20px;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent;
  }
  .t-messages-inner { max-width: 720px; margin: 0 auto; }

  /* ── Bot bubble ── */
  .t-bot-row { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 22px; animation: tFadeUp 0.3s ease both; }
  @keyframes tFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

  .t-bot-icon {
    width: 32px; height: 32px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), var(--violet));
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    margin-top: 2px;
    box-shadow: 0 0 16px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.5);
  }
  .t-bot-bubble {
    background: var(--bg-card);
    border: 1px solid var(--border-md);
    border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg);
    padding: 13px 17px; max-width: 88%;
    box-shadow: var(--shadow-sm);
  }

  /* ── User bubble ── */
  .t-user-row { display: flex; justify-content: flex-end; margin-bottom: 22px; animation: tFadeUp 0.25s ease both; }
  .t-user-bubble {
    background: linear-gradient(135deg, var(--accent), var(--violet));
    border-radius: var(--radius-lg) 4px var(--radius-lg) var(--radius-lg);
    padding: 11px 16px; max-width: 74%;
    color: white; font-size: 0.875rem; font-weight: 500; line-height: 1.65;
    box-shadow: 0 2px 20px var(--accent-glow);
  }

  /* ── Status pill ── */
  .t-status-row { display: flex; justify-content: center; margin-bottom: 22px; animation: tFadeUp 0.3s ease both; }
  .t-status-pill {
    background: var(--gold-dim); border: 1px solid var(--gold-border);
    color: var(--text-gold); border-radius: 100px; padding: 7px 16px 7px 12px;
    font-size: 0.73rem; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
    box-shadow: 0 0 16px rgba(245,158,11,0.1);
  }

  /* ── Typing dots ── */
  .t-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); animation: tBounce 1.2s infinite; }
  @keyframes tBounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-6px); opacity: 1; } }

  /* ── Bot text ── */
  .t-text { font-size: 0.875rem; line-height: 1.78; }
  .t-text p { color: var(--text-1); font-weight: 400; }
  .t-text p + p { margin-top: 6px; }
  .t-text strong { color: #fff; font-weight: 700; }
  .t-text em { color: var(--text-accent); font-style: normal; font-size: 0.8rem; font-weight: 600; background: var(--accent-dim); padding: 2px 8px; border-radius: 5px; }

  /* ══════════════ EMPTY STATE ══════════════ */
  .t-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 420px; text-align: center; padding: 48px 16px; }
  .t-empty-icon {
    width: 72px; height: 72px; border-radius: 22px;
    background: linear-gradient(135deg, var(--accent), var(--violet));
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 22px; box-shadow: var(--shadow-glow);
    animation: tPulseGlow 3s ease-in-out infinite;
  }
  @keyframes tPulseGlow {
    0%,100% { box-shadow: 0 0 24px var(--accent-glow), 0 4px 20px rgba(0,0,0,0.5); }
    50%      { box-shadow: 0 0 48px rgba(99,102,241,0.45), 0 4px 20px rgba(0,0,0,0.5); }
  }
  .t-empty h2 { color: var(--text-1); font-size: 1.5rem; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.03em; }
  .t-empty-sub { color: var(--text-2); font-size: 0.84rem; max-width: 300px; margin-bottom: 32px; line-height: 1.65; }

  .t-empty-flow { display: flex; align-items: center; gap: 0; flex-wrap: wrap; justify-content: center; max-width: 500px; gap: 4px; }
  .t-empty-step {
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-md); padding: 11px 13px; min-width: 70px;
    transition: all 0.2s;
  }
  .t-empty-step:hover { border-color: var(--accent-line); background: var(--bg-raised); transform: translateY(-2px); box-shadow: 0 4px 16px var(--accent-glow); }
  .t-empty-step-num { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, var(--accent), var(--violet)); display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 800; color: white; font-family: 'JetBrains Mono', monospace; }
  .t-empty-step-text { font-size: 0.66rem; font-weight: 600; color: var(--text-2); text-align: center; line-height: 1.3; }
  .t-flow-arrow { color: var(--text-3); flex-shrink: 0; }

  /* ══════════════ INPUT AREA ══════════════ */
  .t-input-area {
    background: rgba(11,14,26,0.95);
    border-top: 1px solid var(--border); padding: 14px 20px 18px;
    flex-shrink: 0; position: relative; z-index: 10;
    backdrop-filter: blur(20px);
  }
  .t-input-inner { max-width: 720px; margin: 0 auto; }

  .t-cv-tag {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--accent-dim); border: 1px solid var(--accent-line);
    border-radius: 7px; padding: 5px 11px; margin-bottom: 10px;
    animation: tFadeUp 0.2s ease;
  }
  .t-cv-tag span { font-size: 0.74rem; color: var(--text-accent); font-weight: 600; }

  .t-input-box {
    display: flex; align-items: flex-end; gap: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-md);
    border-radius: var(--radius-md); padding: 8px 8px 8px 12px;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
  }
  .t-input-box:focus-within {
    border-color: var(--accent-line);
    box-shadow: 0 0 0 3px var(--accent-dim), var(--shadow-sm);
  }

  .t-textarea {
    flex: 1; background: none; border: none; outline: none;
    font-size: 0.875rem; font-weight: 400; color: var(--text-1);
    resize: none; font-family: inherit;
    min-height: 38px; max-height: 128px; padding: 4px 0;
    scrollbar-width: thin;
  }
  .t-textarea::placeholder { color: var(--text-3); }
  .t-textarea:disabled { opacity: 0.4; cursor: not-allowed; }

  .t-attach-btn {
    width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border: none; cursor: pointer; transition: all 0.2s;
  }
  .t-attach-btn.pulse {
    background: linear-gradient(135deg, var(--accent), var(--violet));
    color: white; box-shadow: var(--shadow-glow);
    animation: tPulseBtn 2s ease-in-out infinite;
  }
  @keyframes tPulseBtn { 0%,100% { box-shadow: 0 0 12px var(--accent-glow); } 50% { box-shadow: 0 0 24px rgba(99,102,241,0.5); } }
  .t-attach-btn.idle { background: var(--bg-raised); color: var(--text-3); }
  .t-attach-btn.idle:hover { background: var(--bg-hover); color: var(--text-2); }
  .t-attach-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .t-send-btn {
    width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), var(--violet));
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: white; box-shadow: 0 2px 12px var(--accent-glow);
    transition: all 0.2s;
  }
  .t-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
  .t-send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

  .t-hint { text-align: center; font-size: 0.63rem; color: var(--text-3); font-weight: 500; margin-top: 9px; }

  /* ══════════════ ACTIVITY PANEL ══════════════ */
  .t-activity {
    width: 300px; flex-shrink: 0;
    background: var(--bg-surface);
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow: hidden; position: relative;
  }

  .t-activity-header {
    padding: 13px 14px 12px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
    background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-surface) 100%);
  }
  .t-activity-title { display: flex; align-items: center; gap: 8px; }
  .t-activity-title-icon { width: 26px; height: 26px; border-radius: 7px; background: var(--accent-dim); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; }
  .t-activity-title-text { font-size: 0.78rem; font-weight: 700; color: var(--text-1); }
  .t-activity-live {
    font-size: 0.57rem; font-weight: 700; letter-spacing: 0.06em;
    color: var(--gold); background: var(--gold-dim);
    border: 1px solid var(--gold-border);
    border-radius: 5px; padding: 3px 7px; text-transform: uppercase;
    display: flex; align-items: center; gap: 4px;
  }
  .t-activity-idle {
    font-size: 0.57rem; font-weight: 600; color: var(--text-3);
    background: var(--bg-raised); border: 1px solid var(--border);
    border-radius: 5px; padding: 3px 7px;
  }
  .t-live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--gold); animation: tDotPulse 1s infinite; }

  /* Pipeline progress */
  .t-pipeline { padding: 14px 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .t-pipeline-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .t-pipeline-label { font-size: 0.58rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace; }
  .t-pipeline-step-count { font-size: 0.58rem; font-weight: 700; color: var(--text-accent); background: var(--accent-dim); border: 1px solid rgba(99,102,241,0.2); border-radius: 4px; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; }

  .t-pipeline-track { display: flex; align-items: flex-start; }
  .t-pipe-node { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
  .t-pipe-connector {
    position: absolute; top: 10px; left: calc(-50% + 12px); right: calc(50% + 12px);
    height: 1.5px; background: var(--bg-active); z-index: 0; transition: background 0.5s;
  }
  .t-pipe-connector.done { background: var(--success); }
  .t-pipe-circle {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid var(--bg-active); background: var(--bg-raised);
    color: var(--text-3); transition: all 0.4s; z-index: 1; position: relative;
    margin-bottom: 6px;
  }
  .t-pipe-circle.done { background: rgba(16,185,129,0.12); border-color: var(--success); color: var(--success); }
  .t-pipe-circle.active {
    background: var(--accent-dim); border-color: var(--accent); color: var(--text-accent);
    box-shadow: 0 0 10px var(--accent-glow);
    animation: tNodePulse 1.8s ease-in-out infinite;
  }
  @keyframes tNodePulse { 0%,100% { box-shadow: 0 0 6px var(--accent-glow); } 50% { box-shadow: 0 0 18px rgba(99,102,241,0.55); } }
  .t-pipe-label { font-size: 0.5rem; font-weight: 600; color: var(--text-3); text-align: center; line-height: 1.25; transition: color 0.4s; max-width: 100%; padding: 0 1px; word-break: break-word; }
  .t-pipe-label.active { color: var(--text-accent); }
  .t-pipe-label.done { color: var(--success); }

  /* Activity log */
  .t-activity-log { flex: 1; overflow-y: auto; padding: 10px 10px 16px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; }

  .t-activity-empty { display: flex; flex-direction: column; align-items: center; padding: 36px 16px; text-align: center; }
  .t-activity-empty-icon { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, var(--bg-card), var(--bg-raised)); border: 1px solid var(--border-md); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: var(--shadow-sm); }
  .t-activity-empty p { color: var(--text-3); font-size: 0.74rem; font-weight: 500; line-height: 1.5; }

  .t-log-item {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 8px 10px; border-radius: var(--radius-sm);
    margin-bottom: 4px; transition: background 0.15s;
    animation: tSlideIn 0.25s ease both;
  }
  @keyframes tSlideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
  .t-log-item:hover { background: var(--bg-raised); }

  .t-log-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .t-log-icon.success { background: var(--success-dim); border: 1px solid var(--success-border); }
  .t-log-icon.error   { background: var(--error-dim);   border: 1px solid var(--error-border); }
  .t-log-icon.warn    { background: var(--gold-dim);    border: 1px solid var(--gold-border); }
  .t-log-icon.info    { background: var(--accent-dim);  border: 1px solid rgba(99,102,241,0.2); }
  .t-log-icon.search  { background: var(--blue-dim);    border: 1px solid rgba(59,130,246,0.2); }
  .t-log-icon.cv      { background: var(--violet-dim);  border: 1px solid rgba(139,92,246,0.2); }
  .t-log-icon.email   { background: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.2); }
  .t-log-icon.ai      { background: var(--accent-dim);  border: 1px solid rgba(99,102,241,0.2); }

  .t-log-msg { font-size: 0.72rem; font-weight: 500; color: var(--text-2); line-height: 1.5; flex: 1; word-break: break-word; }
  .t-log-time { font-size: 0.58rem; color: var(--text-3); flex-shrink: 0; font-family: 'JetBrains Mono', monospace; margin-top: 3px; opacity: 0.7; }

  /* ══════════════ SIDEBARS ══════════════ */
  .t-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 40; backdrop-filter: blur(4px); }

  .t-sidebar {
    position: fixed; top: 0; left: 0; height: 100%; width: 300px;
    background: var(--bg-surface); border-right: 1px solid var(--border);
    z-index: 50; display: flex; flex-direction: column;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 16px 0 48px rgba(0,0,0,0.6);
  }
  .t-sidebar.open { transform: translateX(0); }
  .t-sidebar-hdr { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
  .t-sidebar-title { color: var(--text-1); font-weight: 700; font-size: 0.9rem; }
  .t-sidebar-sub { color: var(--text-3); font-size: 0.67rem; margin-top: 2px; }
  .t-sidebar-list { flex: 1; overflow-y: auto; padding: 10px; scrollbar-width: thin; }

  .t-session {
    border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 13px; background: var(--bg-card); margin-bottom: 7px;
    cursor: pointer; transition: all 0.18s;
  }
  .t-session:hover { border-color: var(--accent-line); background: var(--bg-raised); transform: translateY(-1px); box-shadow: 0 4px 16px var(--accent-glow); }
  .t-session-role { color: var(--text-1); font-weight: 700; font-size: 0.82rem; }
  .t-session-loc { color: var(--text-3); font-size: 0.68rem; display: flex; align-items: center; gap: 3px; margin-top: 2px; }
  .t-badge { font-size: 0.61rem; font-weight: 700; padding: 2px 9px; border-radius: 100px; }
  .t-badge.sent { background: var(--success-dim); color: var(--success); border: 1px solid var(--success-border); }
  .t-badge.none { background: var(--bg-hover); color: var(--text-3); border: 1px solid var(--border); }
  .t-company-chip { font-size: 0.61rem; font-weight: 600; background: var(--accent-dim); border: 1px solid rgba(99,102,241,0.2); color: var(--text-accent); border-radius: 4px; padding: 1px 7px; }

  .t-sidebar-empty { display: flex; flex-direction: column; align-items: center; padding: 52px 20px; text-align: center; }
  .t-sidebar-empty p { color: var(--text-2); font-size: 0.82rem; margin: 10px 0 2px; }
  .t-sidebar-empty small { color: var(--text-3); font-size: 0.72rem; }

  /* ══════════════ PROFILE PANEL ══════════════ */
  .t-profile {
    position: fixed; top: 0; right: 0; height: 100%; width: 320px;
    background: var(--bg-surface); border-left: 1px solid var(--border);
    z-index: 60; display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow: -16px 0 48px rgba(0,0,0,0.6);
  }
  .t-profile.open { transform: translateX(0); }
  .t-profile-hdr { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
  .t-profile-title { color: var(--text-1); font-weight: 700; font-size: 0.9rem; }
  .t-profile-body { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 18px; scrollbar-width: thin; }
  .t-profile-avatar { width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, var(--accent), var(--violet)); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.4rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; box-shadow: var(--shadow-glow); }
  .t-profile-name  { color: var(--text-1); font-size: 1rem; font-weight: 700; }
  .t-profile-email { color: var(--text-3); font-size: 0.74rem; margin-top: 2px; }
  .t-section { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-card); }
  .t-section-hdr { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--border); }
  .t-section-title { color: var(--text-1); font-weight: 700; font-size: 0.82rem; }
  .t-section-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .t-label { display: block; font-size: 0.6rem; font-weight: 700; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; font-family: 'JetBrains Mono', monospace; }
  .t-input-f { width: 100%; background: var(--bg-base); border: 1px solid var(--border-md); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.84rem; color: var(--text-1); outline: none; font-family: inherit; transition: all 0.15s; }
  .t-input-f::placeholder { color: var(--text-3); }
  .t-input-f:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-dim); }
  .t-input-f:disabled { color: var(--text-3); cursor: default; }
  .t-pw-wrap { position: relative; }
  .t-pw-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-3); padding: 0; transition: color 0.15s; }
  .t-pw-eye:hover { color: var(--accent); }
  .t-save-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: linear-gradient(135deg, var(--accent), var(--violet)); color: white; font-weight: 700; font-size: 0.84rem; border: none; border-radius: var(--radius-sm); padding: 10px; cursor: pointer; font-family: inherit; box-shadow: 0 2px 12px var(--accent-glow); transition: all 0.2s; }
  .t-save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
  .t-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .t-logout-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: var(--bg-card); color: var(--error); font-weight: 700; font-size: 0.84rem; border: 1px solid var(--error-border); border-radius: var(--radius-sm); padding: 10px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .t-logout-btn:hover { background: var(--error-dim); border-color: rgba(239,68,68,0.45); }

  /* ══════════════ CARDS ══════════════ */
  .t-card { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-card); margin-bottom: 8px; box-shadow: var(--shadow-sm); transition: border-color 0.18s; }
  .t-card:hover { border-color: var(--border-hi); }
  .t-card-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; background: none; border: none; cursor: pointer; text-align: left; gap: 10px; font-family: inherit; transition: background 0.15s; }
  .t-card-btn:hover { background: var(--bg-raised); }
  .t-card-title { color: var(--text-1); font-weight: 700; font-size: 0.84rem; }
  .t-card-meta { color: var(--text-3); font-size: 0.69rem; display: flex; align-items: center; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
  .t-card-expand { border-top: 1px solid var(--border); background: var(--bg-surface); padding: 14px 15px; }

  .t-section-label { font-size: 0.61rem; font-weight: 700; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 7px; font-family: 'JetBrains Mono', monospace; }
  .t-skill-chip { font-size: 0.66rem; font-weight: 600; background: var(--accent-dim); border: 1px solid rgba(99,102,241,0.2); color: var(--text-accent); border-radius: 5px; padding: 2px 8px; }
  .t-exp-item { padding-left: 11px; border-left: 2px solid var(--accent-line); margin-bottom: 9px; }
  .t-exp-title { color: var(--text-1); font-size: 0.8rem; font-weight: 600; }
  .t-exp-date { color: var(--text-3); font-size: 0.69rem; margin-top: 1px; }
  .t-rec-item { display: flex; align-items: flex-start; gap: 6px; font-size: 0.75rem; color: var(--text-2); margin-bottom: 5px; line-height: 1.55; }
  .t-job-link { color: var(--accent-hi); font-size: 0.68rem; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; text-decoration: none; transition: color 0.15s; }
  .t-job-link:hover { color: white; }
  .t-fail-badge { font-size: 0.61rem; background: var(--error-dim); border: 1px solid var(--error-border); color: #f87171; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
  .t-ats-score { font-size: 1.1rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
  .t-ats-label { font-size: 0.57rem; font-weight: 700; color: var(--text-3); text-align: center; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; }

  /* ── Action Buttons ── */
  .t-approve-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    background: linear-gradient(135deg, var(--success), #059669);
    color: white; font-weight: 700; font-size: 0.84rem; border: none;
    border-radius: var(--radius-sm); padding: 11px 16px; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 12px rgba(16,185,129,0.3); transition: all 0.2s;
  }
  .t-approve-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(16,185,129,0.45); }
  .t-approve-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .t-send-email-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    background: linear-gradient(135deg, var(--accent), var(--violet));
    color: white; font-weight: 700; font-size: 0.84rem; border: none;
    border-radius: var(--radius-sm); padding: 11px 16px; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 12px var(--accent-glow); transition: all 0.2s;
  }
  .t-send-email-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
  .t-send-email-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .t-cancel-btn {
    display: flex; align-items: center; gap: 5px; padding: 11px 14px;
    background: var(--bg-card); border: 1px solid var(--error-border); color: #f87171;
    font-weight: 600; font-size: 0.8rem; border-radius: var(--radius-sm);
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .t-cancel-btn:hover:not(:disabled) { background: var(--error-dim); }
  .t-cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Draft inputs ── */
  .t-draft-label { font-size: 0.6rem; font-weight: 700; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; font-family: 'JetBrains Mono', monospace; }
  .t-draft-input { width: 100%; background: var(--bg-base); border: 1px solid var(--border-md); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.82rem; color: var(--text-1); outline: none; font-family: inherit; transition: all 0.15s; }
  .t-draft-input::placeholder { color: var(--text-3); }
  .t-draft-input:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-dim); }

  /* ── Results ── */
  .t-result-ok  { display: flex; align-items: center; justify-content: space-between; background: var(--success-dim); border: 1px solid var(--success-border); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.75rem; margin-bottom: 6px; }
  .t-result-fail{ display: flex; align-items: center; justify-content: space-between; background: var(--error-dim); border: 1px solid var(--error-border); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.75rem; margin-bottom: 6px; }
  .t-result-co { color: var(--text-1); font-weight: 700; }
  .t-result-det { color: var(--text-3); font-size: 0.68rem; }

  .t-new-chat-btn {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 14px;
    color: var(--text-accent); font-size: 0.8rem; font-weight: 700;
    background: var(--accent-dim); border: 1px solid var(--accent-line);
    border-radius: var(--radius-sm); cursor: pointer; padding: 7px 14px;
    font-family: inherit; transition: all 0.2s;
  }
  .t-new-chat-btn:hover { background: rgba(99,102,241,0.2); }

  /* ── Email badges ── */
  .t-email-verified { font-size: 0.59rem; font-weight: 800; background: var(--success-dim); color: var(--success); border: 1px solid var(--success-border); border-radius: 6px; padding: 1px 7px; flex-shrink: 0; }
  .t-email-risky    { font-size: 0.59rem; font-weight: 800; background: var(--gold-dim); color: var(--gold); border: 1px solid var(--gold-border); border-radius: 6px; padding: 1px 7px; flex-shrink: 0; }
  .t-email-est      { font-size: 0.59rem; font-weight: 800; background: var(--error-dim); color: #fca5a5; border: 1px solid var(--error-border); border-radius: 6px; padding: 1px 7px; flex-shrink: 0; }

  /* ── History banner ── */
  .t-hist-banner { display: flex; align-items: center; justify-content: space-between; background: var(--gold-dim); border-bottom: 1px solid var(--gold-border); padding: 8px 20px; flex-shrink: 0; gap: 8px; }
  .t-hist-banner-text { color: var(--text-gold); font-size: 0.73rem; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Ollama ── */
  .t-ollama-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .t-ollama-dot.online  { background: var(--success); box-shadow: 0 0 6px var(--success); }
  .t-ollama-dot.offline { background: var(--error); }
  .t-ollama-dot.checking { background: var(--gold); animation: tDotPulse 1s infinite; }
  .t-ollama-row { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 18px; animation: tFadeUp 0.3s ease both; }
  .t-ollama-icon { width: 32px; height: 32px; flex-shrink: 0; background: linear-gradient(135deg, var(--violet), #6d28d9); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-top: 2px; box-shadow: 0 0 12px var(--violet-dim); }
  .t-ollama-bubble { background: var(--bg-card); border: 1px solid rgba(139,92,246,0.2); border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg); padding: 13px 17px; max-width: 85%; }
  .t-model-bar { display: flex; align-items: center; gap: 8px; padding: 8px 20px; background: var(--bg-card); border-bottom: 1px solid rgba(139,92,246,0.12); flex-shrink: 0; }
  .t-model-select { background: var(--bg-raised); border: 1px solid rgba(139,92,246,0.3); border-radius: 7px; padding: 5px 10px; font-size: 0.71rem; font-weight: 600; color: #c4b5fd; outline: none; font-family: inherit; cursor: pointer; max-width: 200px; }
  .t-model-select option { background: var(--bg-surface); }

  /* ── Animations ── */
  .t-spin { animation: tSpin 1s linear infinite; }
  @keyframes tSpin { to { transform: rotate(360deg); } }
  .t-divider { height: 1px; background: var(--border); margin: 4px 0 10px; }

  /* ── Approve label ── */
  .t-approve-label { color: var(--text-1); font-weight: 700; font-size: 0.9rem; }
`;

/* ─── Tiny helpers ───────────────────────────────────────────────────────────── */
function TypingDots() {
  return <div style={{display:'flex',gap:5,alignItems:'center',padding:'3px 2px'}}>{[0,1,2].map(i=><div key={i} className="t-dot" style={{animationDelay:`${i*0.18}s`}}/>)}</div>;
}
function BotMessage({children,isLoading}) {
  return <div className="t-bot-row"><div className="t-bot-icon"><Bot style={{width:15,height:15,color:'white'}}/></div><div className="t-bot-bubble">{isLoading?<TypingDots/>:children}</div></div>;
}
function UserMessage({children}) {
  return <div className="t-user-row"><div className="t-user-bubble">{children}</div></div>;
}
function StatusMessage({children}) {
  return <div className="t-status-row"><div className="t-status-pill"><Loader2 style={{width:13,height:13}} className="t-spin"/>{children}</div></div>;
}
function BotText({text}) {
  if(!text) return null;
  return <div className="t-text">{text.split('\n').map((line,i)=>{
    const parts=line.split(/(\*\*[^*]+\*\*)/g);
    const rendered=parts.map((p,j)=>p.startsWith('**')&&p.endsWith('**')?<strong key={j}>{p.slice(2,-2)}</strong>:p.startsWith('_(')&&p.endsWith(')_')?<em key={j}>{p.slice(2,-2)}</em>:p);
    return <p key={i} style={line===''?{height:6}:{}}>{rendered}</p>;
  })}</div>;
}
function ATSScore({score}) {
  if(score===null||score===undefined) return <div style={{textAlign:'center',minWidth:42}}><p style={{color:'var(--text-3)',fontSize:'0.7rem',fontWeight:700}}>N/A</p><p style={{color:'var(--text-3)',fontSize:'0.6rem',fontWeight:600}}>ATS</p></div>;
  const color=score>=80?'var(--success)':score>=60?'var(--gold)':'var(--error)';
  return <div style={{textAlign:'center',minWidth:42}}><p className="t-ats-score" style={{color}}>{score}%</p><p className="t-ats-label">ATS</p></div>;
}

/* ─── Pipeline Progress ──────────────────────────────────────────────────────── */
function PipelineProgress({currentState}) {
  const active = STATE_STEP_MAP[currentState] ?? 0;
  return (
    <div className="t-pipeline">
      <div className="t-pipeline-header">
        <span className="t-pipeline-label">Pipeline</span>
        <span className="t-pipeline-step-count">{active + 1} / {PIPELINE_STEPS.length}</span>
      </div>
      <div className="t-pipeline-track">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < active;
          const isActive = i === active;
          return (
            <div key={i} className="t-pipe-node">
              {i > 0 && <div className={`t-pipe-connector ${i <= active ? 'done' : ''}`}/>}
              <div className={`t-pipe-circle ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                {isDone
                  ? <CheckCircle style={{width:10,height:10}} strokeWidth={2.5}/>
                  : <Icon style={{width:10,height:10}} strokeWidth={2}/>
                }
              </div>
              <div className={`t-pipe-label ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Activity Panel ─────────────────────────────────────────────────────────── */
function ActivityPanel({activityLog, currentState, isAsync}) {
  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[activityLog]);

  const fmtTime = (ts) => {
    if(!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  };

  const iconConfig = {
    success: { Icon: CheckCircle,    color: '#10b981' },
    error:   { Icon: XCircle,        color: '#ef4444' },
    warn:    { Icon: AlertTriangle,  color: '#f59e0b' },
    search:  { Icon: Search,         color: '#3b82f6' },
    cv:      { Icon: FileText,       color: '#8b5cf6' },
    email:   { Icon: Mail,           color: '#ec4899' },
    ai:      { Icon: Brain,          color: '#818cf8' },
    info:    { Icon: Zap,            color: '#818cf8' },
  };

  return (
    <div className="t-activity">
      <div className="t-activity-header">
        <div className="t-activity-title">
          <div className="t-activity-title-icon">
            <Activity style={{width:13,height:13,color:'var(--text-accent)'}}/>
          </div>
          <span className="t-activity-title-text">Agent Activity</span>
        </div>
        {isAsync ? (
          <div className="t-activity-live">
            <div className="t-live-dot"/>
            LIVE
          </div>
        ) : (
          <div className="t-activity-idle">Idle</div>
        )}
      </div>

      <PipelineProgress currentState={currentState}/>

      <div className="t-activity-log">
        {activityLog.length === 0 ? (
          <div className="t-activity-empty">
            <div className="t-activity-empty-icon">
              <Activity style={{width:22,height:22,color:'var(--text-3)'}}/>
            </div>
            <p>Agent activity yahan dikhega</p>
            <p style={{marginTop:6,fontSize:'0.67rem',color:'var(--text-3)'}}>CV upload karein to shuru ho jayega</p>
          </div>
        ) : (
          activityLog.map((item, idx) => {
            const iconType = getActivityIcon(item.message);
            const cfg = iconConfig[iconType] || iconConfig.info;
            const { Icon: LogIcon } = cfg;
            return (
              <div key={item.id || idx} className="t-log-item">
                <div className={`t-log-icon ${iconType}`}>
                  <LogIcon style={{width:14,height:14,color:cfg.color}} strokeWidth={2.5}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="t-log-msg">{item.message}</div>
                  <div className="t-log-time">{fmtTime(item.ts)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef}/>
      </div>
    </div>
  );
}

/* ─── CV Approval Cards ──────────────────────────────────────────────────────── */
function CVApprovalCards({cvResults,approvalId,onApprove,onReject,loading,readOnly}) {
  const [expanded,setExpanded]=useState(null);
  const [downloading,setDownloading]=useState(null);
  const valid=cvResults.filter(r=>!r.error);

  const handleDownload=async(result)=>{
    if(downloading||!result.hasPdf) return;
    setDownloading(result.jobId);
    try{
      const res=await fteApi.downloadCV(result.jobId);
      const url=URL.createObjectURL(new Blob([res.data],{type:'application/pdf'}));
      const a=document.createElement('a');
      a.href=url;
      a.download=`CV_${result.job?.company||'tailored'}_${result.job?.title||'cv'}.pdf`.replace(/[^a-z0-9._-]/gi,'_');
      a.click(); URL.revokeObjectURL(url);
    }catch{toast.error('Download failed');}
    finally{setDownloading(null);}
  };

  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
      <Sparkles style={{width:15,height:15,color:'#a78bfa'}}/>
      <p className="t-approve-label">{valid.length} tailored CV{valid.length!==1?'s':''} {readOnly?'generated':'ready'}</p>
    </div>
    <div style={{marginBottom:12}}>
      {cvResults.map((result,idx)=>{
        const score=result.atsScore?.overall??result.atsScore?.format??null;
        const cv=result.cv||{}; const isOpen=expanded===idx;
        return <div key={idx} className="t-card">
          <button className="t-card-btn" onClick={()=>setExpanded(isOpen?null:idx)}>
            <div style={{flex:1,minWidth:0}}>
              <p className="t-card-title">{result.job?.title||'Unknown Role'}</p>
              <div className="t-card-meta">
                <Building2 style={{width:11,height:11}}/><span>{result.job?.company}</span>
                {result.job?.location&&<><MapPin style={{width:11,height:11}}/><span>{result.job.location}</span></>}
              </div>
              {result.job?.sourceUrl&&<a href={result.job.sourceUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="t-job-link">View job <ExternalLink style={{width:10,height:10}}/></a>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              {result.error?<span className="t-fail-badge">Failed</span>:<ATSScore score={score}/>}
              {isOpen?<ChevronUp style={{width:14,height:14,color:'var(--text-accent)'}}/>:<ChevronDown style={{width:14,height:14,color:'var(--text-3)'}}/>}
            </div>
          </button>
          {isOpen&&<div className="t-card-expand">
            {result.error?<p style={{color:'#f87171',fontSize:'0.78rem',fontWeight:600}}>{result.error}</p>:<>
              {(cv.summary||cv.profile||cv.objective||cv.professionalSummary)&&<div style={{marginBottom:11}}>
                <p className="t-section-label">Professional Summary</p>
                <p style={{color:'var(--text-2)',fontSize:'0.79rem',lineHeight:1.65}}>{cv.summary||cv.profile||cv.objective||cv.professionalSummary}</p>
              </div>}
              {cv.skills?.length>0&&<div style={{marginBottom:11}}>
                <p className="t-section-label">Key Skills</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{(Array.isArray(cv.skills)?cv.skills:[]).slice(0,12).map((s,i)=><span key={i} className="t-skill-chip">{typeof s==='string'?s:s.name||String(s)}</span>)}</div>
              </div>}
              {cv.experience?.length>0&&<div style={{marginBottom:11}}>
                <p className="t-section-label">Experience</p>
                {cv.experience.slice(0,2).map((e,i)=><div key={i} className="t-exp-item">
                  <p className="t-exp-title">{e.role||e.title||e.position} @ {e.company||e.organization}</p>
                  <p className="t-exp-date">{e.duration||e.period||e.dates||e.date}</p>
                </div>)}
              </div>}
              {result.recommendations?.length>0&&<div style={{marginBottom:10}}>
                <p className="t-section-label">Improvements</p>
                {result.recommendations.slice(0,3).map((rec,i)=><div key={i} className="t-rec-item">
                  <TrendingUp style={{width:11,height:11,color:'var(--gold)',flexShrink:0,marginTop:2}}/><span>{rec}</span>
                </div>)}
              </div>}
              {result.hasPdf&&<button onClick={()=>handleDownload(result)} disabled={!!downloading} style={{marginTop:8,display:'flex',alignItems:'center',gap:6,background:'var(--blue-dim)',border:'1px solid rgba(59,130,246,0.3)',color:'#60a5fa',borderRadius:'var(--radius-sm)',padding:'7px 14px',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',width:'fit-content',transition:'all 0.2s'}}>
                {downloading===result.jobId?<><Loader2 style={{width:13,height:13}} className="t-spin"/>Downloading...</>:<><Download style={{width:13,height:13}}/>Download Tailored CV</>}
              </button>}
            </>}
          </div>}
        </div>;
      })}
    </div>
    {readOnly
      ?<div style={{display:'flex',alignItems:'center',gap:7,background:'var(--success-dim)',border:'1px solid var(--success-border)',borderRadius:'var(--radius-sm)',padding:'9px 14px'}}>
          <CheckCircle style={{width:14,height:14,color:'var(--success)'}}/><span style={{color:'var(--success)',fontSize:'0.8rem',fontWeight:700}}>Approved — {valid.length} CV{valid.length!==1?'s':''} generated</span>
        </div>
      :<div style={{display:'flex',gap:8}}>
          <button className="t-approve-btn" onClick={()=>onApprove(approvalId)} disabled={loading||valid.length===0}>{loading?<><Loader2 style={{width:14,height:14}} className="t-spin"/>Approving...</>:<><CheckCircle style={{width:14,height:14}}/>Approve {valid.length} CV{valid.length!==1?'s':''}</>}</button>
          <button className="t-cancel-btn" onClick={()=>onReject()} disabled={loading}><XCircle style={{width:13,height:13}}/>Cancel</button>
        </div>
    }
  </div>;
}

/* ─── Email Approval Cards ───────────────────────────────────────────────────── */
function EmailApprovalCards({emailDrafts,approvalId,onSend,onReject,loading,readOnly}) {
  const valid=emailDrafts.filter(d=>d.hrEmail&&!d.error);
  const [drafts,setDrafts]=useState(valid.map(d=>({...d})));
  const [expanded,setExpanded]=useState(null);
  const skipped=emailDrafts.filter(d=>!d.hrEmail||d.error);
  const update=(idx,field,val)=>{if(readOnly)return;const u=[...drafts];u[idx]={...u[idx],[field]:val};setDrafts(u);};

  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
      <Mail style={{width:15,height:15,color:'var(--pink)'}}/>
      <p className="t-approve-label">{drafts.length} email draft{drafts.length!==1?'s':''} {readOnly?'sent':'ready'}</p>
    </div>
    {skipped.length>0&&<p style={{fontSize:'0.72rem',color:'var(--text-3)',fontWeight:500,marginBottom:10}}>{skipped.length} companies — HR email not found, skipped</p>}
    <div style={{marginBottom:12}}>
      {drafts.map((draft,idx)=><div key={idx} className="t-card">
        <button className="t-card-btn" onClick={()=>setExpanded(expanded===idx?null:idx)}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <p className="t-card-title">{draft.job?.company}</p>
              {draft.emailVerified&&<span className="t-email-verified">✓ Verified</span>}
              {draft.emailSource==='hunter'&&!draft.emailVerified&&draft.emailVerifyResult==='risky'&&<span className="t-email-risky">⚠ Risky</span>}
              {draft.emailSource==='llm'&&<span className="t-email-est">~ Estimated</span>}
            </div>
            <p style={{fontSize:'0.7rem',color:'var(--text-3)',fontWeight:500,marginTop:2}}>{draft.hrEmail} · {draft.job?.title}</p>
          </div>
          {expanded===idx?<ChevronUp style={{width:14,height:14,color:'var(--text-accent)',flexShrink:0}}/>:<ChevronDown style={{width:14,height:14,color:'var(--text-3)',flexShrink:0}}/>}
        </button>
        {expanded===idx&&<div className="t-card-expand" style={{display:'flex',flexDirection:'column',gap:10}}>
          {[{label:'To (HR Email)',key:'hrEmail'},{label:'Subject',key:'subject'}].map(({label,key})=>
            <div key={key}><div className="t-draft-label">{label}</div><input type="text" value={draft[key]||''} onChange={e=>update(idx,key,e.target.value)} readOnly={readOnly} className="t-draft-input" style={{marginTop:4}}/></div>)}
          <div><div className="t-draft-label">Email Body</div><textarea value={draft.body||''} onChange={e=>update(idx,'body',e.target.value)} readOnly={readOnly} rows={5} className="t-draft-input" style={{marginTop:4,resize:'none',lineHeight:1.6}}/></div>
        </div>}
      </div>)}
    </div>
    {readOnly
      ?<div style={{display:'flex',alignItems:'center',gap:7,background:'var(--blue-dim)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:'var(--radius-sm)',padding:'9px 14px'}}>
          <Send style={{width:14,height:14,color:'#60a5fa'}}/><span style={{color:'#93c5fd',fontSize:'0.8rem',fontWeight:700}}>Sent — {drafts.length} application{drafts.length!==1?'s':''} dispatched</span>
        </div>
      :<div style={{display:'flex',gap:8}}>
          <button className="t-send-email-btn" onClick={()=>onSend(approvalId,drafts)} disabled={loading||drafts.length===0}>{loading?<><Loader2 style={{width:14,height:14}} className="t-spin"/>Sending...</>:<><Send style={{width:14,height:14}}/>Send {drafts.length} Application{drafts.length!==1?'s':''}</>}</button>
          <button className="t-cancel-btn" onClick={()=>onReject()} disabled={loading}><XCircle style={{width:13,height:13}}/>Cancel</button>
        </div>
    }
  </div>;
}

/* ─── Send Results ───────────────────────────────────────────────────────────── */
function SendResults({results,onNewChat}) {
  const ok=results.filter(r=>r.success), fail=results.filter(r=>!r.success);
  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:11}}>
      {ok.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,color:'var(--success)',fontSize:'0.84rem',fontWeight:800}}><CheckCircle style={{width:14,height:14}}/>{ok.length} sent</span>}
      {fail.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,color:'var(--error)',fontSize:'0.84rem',fontWeight:800}}><XCircle style={{width:14,height:14}}/>{fail.length} failed</span>}
    </div>
    {results.map((r,idx)=><div key={idx} className={r.success?'t-result-ok':'t-result-fail'}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        {r.success?<CheckCircle style={{width:12,height:12,color:'var(--success)',flexShrink:0}}/>:<XCircle style={{width:12,height:12,color:'var(--error)',flexShrink:0}}/>}
        <span className="t-result-co">{r.company}</span>
        {r.jobTitle&&<span className="t-result-det">— {r.jobTitle}</span>}
      </div>
      <span className="t-result-det">{r.hrEmail||r.error||''}</span>
    </div>)}
    <button className="t-new-chat-btn" onClick={onNewChat}><Plus style={{width:13,height:13}}/>New Chat shuru karein</button>
  </div>;
}

/* ─── Interview Prep ─────────────────────────────────────────────────────────── */
function PrepQuestionsCard({prepResults}) {
  const [expandedIdx,setExpandedIdx]=useState(0);
  if(!prepResults?.length) return null;
  const QSection=({title,color,items})=>{
    if(!items?.length) return null;
    return <div style={{marginBottom:11}}>
      <div style={{fontSize:'0.7rem',fontWeight:800,color,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>{title}</div>
      <ul style={{margin:0,paddingLeft:16,display:'flex',flexDirection:'column',gap:5}}>
        {items.map((q,i)=><li key={i} style={{fontSize:'0.82rem',color:'var(--text-2)',lineHeight:1.5}}>{q.question||q}</li>)}
      </ul>
    </div>;
  };
  return <div style={{width:'100%'}}>
    <div style={{fontSize:'0.8rem',fontWeight:800,color:'#a78bfa',marginBottom:11,display:'flex',alignItems:'center',gap:7}}>
      <Brain style={{width:15,height:15,color:'#a78bfa'}}/> Interview Prep Questions
    </div>
    {prepResults.map((result,idx)=><div key={idx} style={{background:'var(--violet-dim)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'var(--radius-md)',marginBottom:8,overflow:'hidden'}}>
      <button onClick={()=>setExpandedIdx(expandedIdx===idx?-1:idx)} style={{width:'100%',background:'none',border:'none',padding:'11px 13px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',fontFamily:'inherit'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:1}}>
          <span style={{fontSize:'0.84rem',fontWeight:800,color:'#c4b5fd'}}>{result.company}</span>
          {result.jobTitle&&<span style={{fontSize:'0.72rem',color:'var(--text-3)'}}>{result.jobTitle}</span>}
        </div>
        {expandedIdx===idx?<ChevronUp style={{width:14,height:14,color:'#c4b5fd',flexShrink:0}}/>:<ChevronDown style={{width:14,height:14,color:'var(--text-3)',flexShrink:0}}/>}
      </button>
      {expandedIdx===idx&&<div style={{padding:'0 13px 13px'}}>
        {result.error
          ?<p style={{fontSize:'0.8rem',color:'var(--error)',margin:0}}>Could not generate: {result.error}</p>
          :<><QSection title="Technical" color="#60a5fa" items={result.questions?.technical}/>
             <QSection title="Behavioral" color="var(--success)" items={result.questions?.behavioral}/>
             <QSection title="Situational" color="var(--gold)" items={result.questions?.situational}/></>
        }
      </div>}
    </div>)}
  </div>;
}

/* ─── History Sidebar ────────────────────────────────────────────────────────── */
function HistorySidebar({open,onClose,onLoad}) {
  const [history,setHistory]=useState([]);const [loading,setLoading]=useState(false);const [loadingKey,setLoadingKey]=useState(null);
  useEffect(()=>{if(!open)return;setLoading(true);fteApi.getHistory().then(res=>setHistory(res.data.history||[])).catch(()=>setHistory([])).finally(()=>setLoading(false));},[open]);
  const fmt=(iso)=>{if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('en-PK',{day:'numeric',month:'short'})+' · '+d.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'});};
  const handleOpen=async(s)=>{
    if(loadingKey)return;setLoadingKey(s.key);
    try{const res=await fteApi.getHistorySession(s.key);onLoad&&onLoad(res.data.session);onClose();}
    catch{toast.error('Could not load session');}
    finally{setLoadingKey(null);}
  };
  return <>
    {open&&<div className="t-backdrop" onClick={onClose}/>}
    <div className={`t-sidebar${open?' open':''}`}>
      <div className="t-sidebar-hdr">
        <div><div className="t-sidebar-title">Session History</div><div className="t-sidebar-sub">Click a session to view</div></div>
        <button className="t-icon-btn" onClick={onClose}><X style={{width:15,height:15}}/></button>
      </div>
      <div className="t-sidebar-list">
        {loading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'48px 0',gap:8,color:'var(--text-3)',fontSize:'0.82rem'}}><Loader2 style={{width:15,height:15}} className="t-spin"/>Loading...</div>}
        {!loading&&history.length===0&&<div className="t-sidebar-empty">
          <Clock style={{width:28,height:28,color:'var(--text-3)'}}/>
          <p>No history yet</p><small>Complete your first session!</small>
        </div>}
        {!loading&&history.map((s,idx)=><div key={idx} className="t-session" onClick={()=>handleOpen(s)}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
            <div style={{minWidth:0}}>
              <div className="t-session-role">{s.role||'Unknown Role'}</div>
              <div className="t-session-loc"><MapPin style={{width:10,height:10}}/>{s.location||'—'}</div>
            </div>
            <span className={`t-badge ${s.sentCount>0?'sent':'none'}`}>
              {loadingKey===s.key?<Loader2 style={{width:10,height:10}} className="t-spin"/>:s.sentCount>0?`${s.sentCount} sent`:'No sends'}
            </span>
          </div>
          <div style={{display:'flex',gap:12,fontSize:'0.7rem',color:'var(--text-3)',marginBottom:8}}>
            <span style={{display:'flex',alignItems:'center',gap:3}}><FileText style={{width:10,height:10}}/>{s.cvCount||0} CVs</span>
            <span style={{display:'flex',alignItems:'center',gap:3}}><Mail style={{width:10,height:10}}/>{s.emailCount||0} emails</span>
          </div>
          {s.companies?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{s.companies.slice(0,3).map((c,i)=><span key={i} className="t-company-chip">{c}</span>)}{s.companies.length>3&&<span style={{fontSize:'0.65rem',color:'var(--text-accent)',fontWeight:600}}>+{s.companies.length-3}</span>}</div>}
          <div style={{color:'var(--text-3)',fontSize:'0.65rem',display:'flex',alignItems:'center',gap:4}}><Clock style={{width:10,height:10}}/>{fmt(s.completedAt)}</div>
        </div>)}
      </div>
    </div>
  </>;
}

/* ─── Profile Panel ──────────────────────────────────────────────────────────── */
function ProfilePanel({open,onClose,user,onUpdateUser,onLogout}) {
  const [name,setName]=useState(user?.name||'');
  const [nameLoading,setNameLoading]=useState(false);
  const [curPw,setCurPw]=useState('');const [newPw,setNewPw]=useState('');
  const [showCur,setShowCur]=useState(false);const [showNew,setShowNew]=useState(false);
  const [pwLoading,setPwLoading]=useState(false);
  useEffect(()=>{setName(user?.name||'');},[user]);
  const initials=(user?.name||user?.email||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const saveName=async()=>{
    if(!name.trim()||name.trim()===user?.name) return;
    setNameLoading(true);
    try{const res=await userAPI.updateProfile({name:name.trim()});onUpdateUser(res.data.user);toast.success('Name updated!');}
    catch(err){toast.error(err.response?.data?.error||'Update failed');}
    finally{setNameLoading(false);}
  };
  const savePw=async()=>{
    if(!curPw||!newPw){toast.error('Dono fields fill karein');return;}
    if(newPw.length<6){toast.error('New password min 6 characters');return;}
    setPwLoading(true);
    try{await authAPI.updatePassword({currentPassword:curPw,newPassword:newPw});toast.success('Password update ho gaya!');setCurPw('');setNewPw('');}
    catch(err){toast.error(err.response?.data?.error||'Password update failed');}
    finally{setPwLoading(false);}
  };
  const memberSince=user?.createdAt?new Date(user.createdAt).toLocaleDateString('en-PK',{month:'long',year:'numeric'}):null;
  return <>
    {open&&<div className="t-backdrop" onClick={onClose}/>}
    <div className={`t-profile${open?' open':''}`}>
      <div className="t-profile-hdr">
        <div className="t-profile-title">My Profile</div>
        <button className="t-icon-btn" onClick={onClose}><X style={{width:15,height:15}}/></button>
      </div>
      <div className="t-profile-body">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="t-profile-avatar">{initials}</div>
          <div>
            <p className="t-profile-name">{user?.name||'—'}</p>
            <p className="t-profile-email">{user?.email}</p>
            {memberSince&&<p style={{fontSize:'0.68rem',color:'var(--text-accent)',fontWeight:600,marginTop:4}}>Member since {memberSince}</p>}
          </div>
        </div>
        <div className="t-section">
          <div className="t-section-hdr"><User style={{width:14,height:14,color:'var(--accent)'}}/><span className="t-section-title">Personal Info</span></div>
          <div className="t-section-body">
            <div><label className="t-label">Full Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Apna naam likhein" className="t-input-f"/></div>
            <div><label className="t-label">Email</label><input type="email" value={user?.email||''} disabled className="t-input-f"/></div>
            <button onClick={saveName} disabled={nameLoading||!name.trim()||name.trim()===user?.name} className="t-save-btn">
              {nameLoading?<><Loader2 style={{width:13,height:13}} className="t-spin"/>Saving...</>:<><Save style={{width:13,height:13}}/>Save Name</>}
            </button>
          </div>
        </div>
        <div className="t-section">
          <div className="t-section-hdr"><Key style={{width:14,height:14,color:'var(--accent)'}}/><span className="t-section-title">Change Password</span></div>
          <div className="t-section-body">
            <div><label className="t-label">Current Password</label>
              <div className="t-pw-wrap">
                <input type={showCur?'text':'password'} value={curPw} onChange={e=>setCurPw(e.target.value)} placeholder="Purana password" className="t-input-f" style={{paddingRight:36}}/>
                <button type="button" className="t-pw-eye" onClick={()=>setShowCur(s=>!s)}><Shield style={{width:13,height:13}}/></button>
              </div>
            </div>
            <div><label className="t-label">New Password</label>
              <div className="t-pw-wrap">
                <input type={showNew?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Naya password (min 6)" className="t-input-f" style={{paddingRight:36}}/>
                <button type="button" className="t-pw-eye" onClick={()=>setShowNew(s=>!s)}><Shield style={{width:13,height:13}}/></button>
              </div>
            </div>
            <button onClick={savePw} disabled={pwLoading||!curPw||!newPw} className="t-save-btn">
              {pwLoading?<><Loader2 style={{width:13,height:13}} className="t-spin"/>Updating...</>:<><Key style={{width:13,height:13}}/>Update Password</>}
            </button>
          </div>
        </div>
        <button className="t-logout-btn" onClick={onLogout}><LogOut style={{width:14,height:14}}/> Logout</button>
      </div>
    </div>
  </>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN FTE CHAT COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function FTEChat() {
  const {user,logout,updateUser}=useAuth();
  const [mode,setMode]=useState('fte');

  const [messages,setMessages]=useState([]);
  const [currentState,setCurrentState]=useState('waiting_cv');
  const [activityLog,setActivityLog]=useState([]);
  const [input,setInput]=useState('');
  const [cvFile,setCvFile]=useState(null);
  const [sending,setSending]=useState(false);
  const [approvalLoading,setApprovalLoading]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const [viewingHistory,setViewingHistory]=useState(null);
  const [historyMessages,setHistoryMessages]=useState([]);

  const [ollamaMessages,setOllamaMessages]=useState([]);
  const [ollamaSending,setOllamaSending]=useState(false);
  const [ollamaOnline,setOllamaOnline]=useState(null);
  const [ollamaModels,setOllamaModels]=useState([]);
  const [ollamaSelectedModel,setOllamaSelectedModel]=useState('');

  const messagesEndRef=useRef(null);const fileInputRef=useRef(null);
  const pollingRef=useRef(null);const textareaRef=useRef(null);

  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages,ollamaMessages]);
  useEffect(()=>{if(textareaRef.current){textareaRef.current.style.height='auto';textareaRef.current.style.height=Math.min(textareaRef.current.scrollHeight,128)+'px';}},[input]);

  useEffect(()=>{
    if(mode!=='ollama')return;
    setOllamaOnline(null);
    fteApi.ollamaStatus().then(res=>{
      const d=res.data; setOllamaOnline(d.running);
      if(d.running&&d.availableModels?.length){
        setOllamaModels(d.availableModels);
        const preferred=d.availableModels.find(m=>m===d.activeModel)||d.availableModels[0];
        setOllamaSelectedModel(prev=>prev&&d.availableModels.includes(prev)?prev:preferred);
      }
    }).catch(()=>setOllamaOnline(false));
  },[mode]);

  const addBotMessage=useCallback((type,content,data=null)=>{setMessages(prev=>[...prev,{id:Date.now()+Math.random(),role:'bot',type,content,data,ts:new Date()}]);},[]);
  const addUserMessage=useCallback((text)=>{setMessages(prev=>[...prev,{id:Date.now()+Math.random(),role:'user',type:'text',content:text,ts:new Date()}]);},[]);

  // Merge activity log from backend poll (avoid duplicates by id)
  const mergeActivityLog = useCallback((newLog) => {
    if(!newLog?.length) return;
    setActivityLog(prev => {
      const existingIds = new Set(prev.map(i=>i.id));
      const fresh = newLog.filter(i=>!existingIds.has(i.id));
      if(!fresh.length) return prev;
      return [...prev, ...fresh].slice(-80);
    });
  }, []);

  // Push a local activity entry (for frontend-driven events: errors, user actions)
  const pushLocalActivity = useCallback((message, type = 'info') => {
    setActivityLog(prev => [...prev, {
      id: Date.now() + Math.random(),
      message,
      type,
      ts: new Date().toISOString(),
    }].slice(-80));
  }, []);

  useEffect(()=>{
    fteApi.getState().then(res=>{const s=res.data;setCurrentState(s.state||'waiting_cv');
      if(s.activityLog) mergeActivityLog(s.activityLog);
      if(!s.state||s.state==='waiting_cv') addBotMessage('text','Assalam o Alaikum! Main aapka **Talvion AI** hoon.\n\nMain automatically:\n• Jobs dhundhta hoon (SerpAPI)\n• Tailored CVs banata hoon (AI)\n• HR ko emails bhejta hoon\n\nShuru karne ke liye — apni **CV (PDF)** upload karein.');
      else if(s.state==='cv_uploaded') addBotMessage('text','CV already upload hai. Batayein — **kaunsi role aur kaunse city** mein job chahiye?\n_(misaal: "Software Engineer Karachi")_');
      else if(s.state==='asking_location') addBotMessage('text',`Role: **${s.role}**\n\nAb **kaunse city** mein job chahiye?`);
      else if(ASYNC_STATES.has(s.state)) addBotMessage('status',STATE_META[s.state]?.label||'Kaam ho raha hai...');
      else if(s.state==='cv_review'&&s.cvResults?.length) addBotMessage('cv_approval','CVs tayyar hain!',{cvResults:s.cvResults,cvReviewApprovalId:s.cvReviewApprovalId});
      else if(s.state==='email_review'&&s.emailDrafts?.length) addBotMessage('email_approval','Email drafts tayyar hain!',{emailDrafts:s.emailDrafts,emailReviewApprovalId:s.emailReviewApprovalId});
      else if(s.state==='done') addBotMessage('result','Sab ho gaya!',{sendResults:s.sendResults});
    }).catch(()=>addBotMessage('text','Assalam o Alaikum! Apni **CV (PDF)** upload karein.'));
  },[]); // eslint-disable-line

  useEffect(()=>{
    if(!ASYNC_STATES.has(currentState)){if(pollingRef.current){clearInterval(pollingRef.current);pollingRef.current=null;}return;}
    pollingRef.current=setInterval(async()=>{try{const res=await fteApi.getState();const s=res.data;
      if(s.activityLog) mergeActivityLog(s.activityLog);
      if(s.state===currentState){if(s.error){setCurrentState('cv_uploaded');pushLocalActivity(`❌ Error: ${s.error}`,'error');addBotMessage('text',`Masla aaya: ${s.error}\n\n**New Chat** button se dobara try karein.`);}return;}
      setCurrentState(s.state);
      if(s.error&&!ASYNC_STATES.has(s.state)){pushLocalActivity(`❌ Pipeline error: ${s.error}`,'error');addBotMessage('text',`${s.error}\n\nRole ya city change karke **New Chat** se dobara try karein.`);return;}
      if(s.state==='generating_cvs') addBotMessage('status',`${s.jobs?.length||0} jobs mili! Tailored CVs bana raha hoon...`);
      else if(s.state==='cv_review'&&s.cvResults?.length) addBotMessage('cv_approval',`${s.cvResults.length} tailored CVs tayyar!`,{cvResults:s.cvResults,cvReviewApprovalId:s.cvReviewApprovalId});
      else if(s.state==='finding_emails') addBotMessage('status','CVs approved! HR emails dhundh raha hoon...');
      else if(s.state==='email_review'){const v=(s.emailDrafts||[]).filter(d=>d.hrEmail);addBotMessage('email_approval',`${v.length} email drafts tayyar!`,{emailDrafts:s.emailDrafts||[],emailReviewApprovalId:s.emailReviewApprovalId});}
      else if(s.state==='done'&&currentState==='preparing_interview'&&s.prepResults?.length) addBotMessage('prep_questions','Interview prep tayyar!',{prepResults:s.prepResults});
      else if(s.state==='done') addBotMessage('result','Applications send ho gayi!',{sendResults:s.sendResults});
      else if(s.state==='preparing_interview') addBotMessage('status','Interview questions generate ho rahi hain...');
    }catch{}},2500);
    return()=>{if(pollingRef.current)clearInterval(pollingRef.current);};
  },[currentState,addBotMessage,mergeActivityLog,pushLocalActivity]);

  const handleOllamaSend=async()=>{
    const text=input.trim();if(!text||ollamaSending)return;
    setOllamaMessages(prev=>[...prev,{id:Date.now(),role:'user',content:text}]);
    setInput(''); setOllamaSending(true);
    try{
      const history=ollamaMessages.slice(-20).map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
      const res=await fteApi.ollamaChat(text,history,ollamaSelectedModel);
      setOllamaMessages(prev=>[...prev,{id:Date.now()+1,role:'bot',content:res.data.reply}]);
    }catch(err){
      const errMsg=err.response?.data?.error||err.message;
      setOllamaMessages(prev=>[...prev,{id:Date.now()+1,role:'bot',content:`Error: ${errMsg}`}]);
    }finally{setOllamaSending(false);}
  };

  const handleSend=async(override)=>{
    if(mode==='ollama'){handleOllamaSend();return;}
    const text=typeof override==='string'?override:input.trim();const file=cvFile;
    if(!text&&!file)return;if(sending)return;
    if(text)addUserMessage(text);if(file)addUserMessage(`Uploading: ${file.name}`);
    setSending(true);setCvFile(null);setInput('');if(fileInputRef.current)fileInputRef.current.value='';
    try{const res=await fteApi.chat(text,file);const{botMessage,state,data}=res.data;setCurrentState(state);
      if(state==='cv_review'&&data?.cvResults?.length) addBotMessage('cv_approval',botMessage,data);
      else if(state==='email_review'&&data?.emailDrafts?.length) addBotMessage('email_approval',botMessage,data);
      else if(state==='done'&&data?.sendResults) addBotMessage('result',botMessage,data);
      else if(ASYNC_STATES.has(state)) addBotMessage('status',botMessage);
      else addBotMessage('text',botMessage);
    }catch(err){const errMsg=err.response?.data?.error||err.message;pushLocalActivity(`❌ Request error: ${errMsg}`,'error');addBotMessage('text',`Masla aaya: ${errMsg}`);}
    finally{setSending(false);}
  };

  const handleKeyDown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}};
  const handleNewChat=async()=>{try{await fteApi.reset();setMessages([]);setActivityLog([]);setCurrentState('waiting_cv');setTimeout(()=>addBotMessage('text','Nayi chat shuru! Apni **CV (PDF)** upload karein.'),50);}catch{toast.error('Reset fail ho gaya');}};
  const handleApproveCVs=async(id)=>{setApprovalLoading(true);try{await fteApi.approveCVs(id);pushLocalActivity('✅ CVs approve ho gayi — HR emails dhundh raha hoon...','success');setCurrentState('finding_emails');addBotMessage('status','CVs approved! HR emails dhundh raha hoon...');}catch(err){const msg=err.response?.data?.error||'Approve fail ho gaya';pushLocalActivity(`❌ CV approve error: ${msg}`,'error');toast.error(msg);}finally{setApprovalLoading(false);}};
  const handleSendEmails=async(id,drafts)=>{setApprovalLoading(true);try{await fteApi.approveEmails(id,drafts);pushLocalActivity('📤 Emails approved — bhejna shuru ho gaya...','info');setCurrentState('sending');addBotMessage('status','Emails bhej raha hoon...');}catch(err){const msg=err.response?.data?.error||'Send fail ho gaya';pushLocalActivity(`❌ Email send error: ${msg}`,'error');toast.error(msg);}finally{setApprovalLoading(false);}};
  const handleReject=async()=>{try{await fteApi.reset();setCurrentState('waiting_cv');pushLocalActivity('⚠️ Cancel ho gaya — naya session shuru...','warn');addBotMessage('text','Cancel ho gaya. Dobara shuru karne ke liye CV upload karein.');}catch{toast.error('Cancel fail ho gaya');}};
  const handleFileChange=(e)=>{const f=e.target.files[0];if(f){setCvFile(f);setTimeout(()=>handleSend(''),100);}};

  const handleLoadHistory=useCallback((session)=>{
    if(!session)return;
    const converted=(session.messages||[]).map((m,i)=>({id:`hist_${i}_${Date.now()}`,role:m.role,type:m.type||'text',content:m.content,data:m.data||null,ts:m.ts?new Date(m.ts):new Date()}));
    setHistoryMessages(converted);
    setViewingHistory({role:session.role,location:session.location,completedAt:session.completedAt});
  },[]);
  const handleExitHistory=useCallback(()=>{setViewingHistory(null);setHistoryMessages([]);},[]);
  const handleRestartFromHistory=useCallback(async()=>{
    const role=viewingHistory?.role;const location=viewingHistory?.location;
    setViewingHistory(null);setHistoryMessages([]);
    try{
      await fteApi.reset();setMessages([]);setActivityLog([]);setCurrentState('waiting_cv');
      setTimeout(()=>{
        addBotMessage('text','Fresh start! Please upload your **CV (PDF)** to begin.');
        if(role&&location) setTimeout(()=>addBotMessage('text',`_Last session: **${role}** in **${location}**. After uploading your CV, I will search again!_`),300);
      },50);
    }catch{toast.error('Reset failed');}
  },[viewingHistory,addBotMessage]);

  const isDisabled=mode==='ollama'?(ollamaSending||!!viewingHistory):(sending||ASYNC_STATES.has(currentState)||!!viewingHistory);
  const meta=STATE_META[currentState]||STATE_META.waiting_cv;
  const isPulse=mode==='fte'&&ASYNC_STATES.has(currentState);
  const initials=(user?.name||user?.email||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  return <>
    <style>{STYLES}</style>
    <div className="t-root">
      <HistorySidebar open={historyOpen} onClose={()=>setHistoryOpen(false)} onLoad={handleLoadHistory}/>
      <ProfilePanel open={profileOpen} onClose={()=>setProfileOpen(false)} user={user} onUpdateUser={updateUser} onLogout={logout}/>

      {/* ══ HEADER ══ */}
      <header className="t-header">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="t-icon-btn" onClick={()=>setHistoryOpen(true)} title="History">
            <PanelLeft style={{width:16,height:16}}/>
          </button>
          <div className="t-logo-wrap">
            <div className="t-logo-icon"><Sparkles style={{width:17,height:17,color:'white'}}/></div>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <span className="t-logo-name">Talvion AI</span>
                <span className="t-logo-badge">Beta</span>
              </div>
              {mode==='fte'&&<div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                <div className={`t-status-dot ${isPulse?'pulse':''}`} style={{background:meta.color,boxShadow:`0 0 8px ${meta.color}55`}}/>
                <span className="t-status-label">{meta.label}</span>
              </div>}
            </div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="t-mode-toggle">
            <button className={`t-mode-btn${mode==='fte'?' active':''}`} onClick={()=>setMode('fte')}>
              <Sparkles style={{width:11,height:11}}/>Talvion AI
            </button>
            <button className={`t-mode-btn${mode==='ollama'?' active':''}`} onClick={()=>setMode('ollama')}>
              <span className={`t-ollama-dot${ollamaOnline===true?' online':ollamaOnline===false?' offline':' checking'}`}/>
              Llama3 Local
            </button>
          </div>
          {mode==='fte'&&<button className="t-btn" onClick={handleNewChat}><Plus style={{width:12,height:12}}/>New Chat</button>}
          <button className="t-avatar" onClick={()=>setProfileOpen(true)} title={user?.name||user?.email}>{initials}</button>
        </div>
      </header>

      {/* ══ SUB-BARS ══ */}
      {mode==='ollama'&&ollamaOnline&&ollamaModels.length>0&&(
        <div className="t-model-bar">
          <span style={{fontSize:'0.67rem',fontWeight:700,color:'#c4b5fd',fontFamily:"'JetBrains Mono',monospace"}}>Model:</span>
          <select className="t-model-select" value={ollamaSelectedModel} onChange={e=>setOllamaSelectedModel(e.target.value)}>
            {ollamaModels.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{fontSize:'0.64rem',color:'var(--text-3)',marginLeft:4}}>running locally</span>
        </div>
      )}
      {viewingHistory&&(
        <div className="t-hist-banner">
          <span className="t-hist-banner-text">History: {viewingHistory.role||'Session'}{viewingHistory.location?` · ${viewingHistory.location}`:''}</span>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <button className="t-btn" onClick={handleRestartFromHistory}>New Search</button>
            <button className="t-btn" onClick={handleExitHistory}>Back</button>
          </div>
        </div>
      )}

      {/* ══ BODY ══ */}
      <div className="t-body">

        {/* ── CHAT ── */}
        <div className="t-chat">
          <div className="t-messages">
            <div className="t-messages-inner">
              {mode==='ollama'?(
                <>
                  {ollamaMessages.length===0&&(
                    <div className="t-empty">
                      <div className="t-empty-icon"><Brain style={{width:32,height:32,color:'white'}}/></div>
                      <h2>Llama3 Local</h2>
                      <p className="t-empty-sub">{ollamaOnline===false?'Ollama is not running on this machine':'Chat with your local Llama3 model — no internet needed'}</p>
                      {ollamaOnline===false&&<div style={{marginTop:14,background:'var(--error-dim)',border:'1px solid var(--error-border)',borderRadius:10,padding:'9px 16px',fontSize:'0.75rem',color:'#f87171',fontWeight:600}}>Run: <code style={{background:'rgba(239,68,68,0.1)',borderRadius:4,padding:'2px 6px'}}>ollama serve</code> then: <code style={{background:'rgba(239,68,68,0.1)',borderRadius:4,padding:'2px 6px'}}>ollama pull llama3</code></div>}
                      {ollamaOnline===null&&<p style={{marginTop:10,fontSize:'0.76rem',color:'var(--text-3)'}}>Checking connection...</p>}
                    </div>
                  )}
                  {ollamaMessages.map((msg,idx)=>
                    msg.role==='user'
                      ?<UserMessage key={idx}>{msg.content}</UserMessage>
                      :<div key={idx} className="t-ollama-row">
                        <div className="t-ollama-icon"><Brain style={{width:16,height:16,color:'white'}}/></div>
                        <div className="t-ollama-bubble"><BotText text={msg.content}/></div>
                      </div>
                  )}
                  {ollamaSending&&<div className="t-ollama-row"><div className="t-ollama-icon"><Brain style={{width:16,height:16,color:'white'}}/></div><div className="t-ollama-bubble"><TypingDots/></div></div>}
                </>
              ):viewingHistory?(
                historyMessages.length===0
                  ?<div className="t-empty"><div className="t-empty-icon"><Bot style={{width:30,height:30,color:'white'}}/></div><h2>No messages</h2><p className="t-empty-sub">This session has no saved conversation.</p></div>
                  :historyMessages.map(msg=>{
                    if(msg.role==='user') return <UserMessage key={msg.id}>{msg.content}</UserMessage>;
                    if(msg.type==='cv_approval'&&msg.data?.cvResults) return <BotMessage key={msg.id}><CVApprovalCards cvResults={msg.data.cvResults} approvalId={msg.data.cvReviewApprovalId} readOnly/></BotMessage>;
                    if(msg.type==='email_approval'&&msg.data?.emailDrafts) return <BotMessage key={msg.id}><EmailApprovalCards emailDrafts={msg.data.emailDrafts} approvalId={msg.data.emailReviewApprovalId} readOnly/></BotMessage>;
                    if(msg.type==='result'&&msg.data?.sendResults) return <BotMessage key={msg.id}><SendResults results={msg.data.sendResults}/></BotMessage>;
                    if(msg.type==='prep_questions'&&msg.data?.prepResults) return <BotMessage key={msg.id}><PrepQuestionsCard prepResults={msg.data.prepResults}/></BotMessage>;
                    if(msg.type==='status') return <StatusMessage key={msg.id}>{msg.content}</StatusMessage>;
                    return <BotMessage key={msg.id}><BotText text={msg.content}/></BotMessage>;
                  })
              ):(
                <>
                  {messages.length===0&&<div className="t-empty">
                    <div className="t-empty-icon"><Sparkles style={{width:30,height:30,color:'white'}}/></div>
                    <h2>Talvion AI</h2>
                    <p className="t-empty-sub">AI-powered job application engine — CV se leke application tak, sab automatic</p>
                    <div className="t-empty-flow">
                      {[['1','CV Upload'],['2','Role + City'],['3','AI Jobs'],['4','Tailored CVs'],['5','HR Emails'],['6','Apply!']].map(([n,t],i,arr)=>(
                        <div key={n} style={{display:'flex',alignItems:'center',gap:4}}>
                          <div className="t-empty-step">
                            <div className="t-empty-step-num">{n}</div>
                            <span className="t-empty-step-text">{t}</span>
                          </div>
                          {i<arr.length-1&&<ArrowRight style={{width:12,height:12,color:'var(--text-3)',flexShrink:0}} className="t-flow-arrow"/>}
                        </div>
                      ))}
                    </div>
                  </div>}
                  {messages.map(msg=>{
                    if(msg.role==='user') return <UserMessage key={msg.id}>{msg.content}</UserMessage>;
                    if(msg.type==='status') return <StatusMessage key={msg.id}>{msg.content}</StatusMessage>;
                    if(msg.type==='cv_approval'&&msg.data?.cvResults) return <BotMessage key={msg.id}><CVApprovalCards cvResults={msg.data.cvResults} approvalId={msg.data.cvReviewApprovalId} onApprove={handleApproveCVs} onReject={handleReject} loading={approvalLoading}/></BotMessage>;
                    if(msg.type==='email_approval'&&msg.data?.emailDrafts) return <BotMessage key={msg.id}><EmailApprovalCards emailDrafts={msg.data.emailDrafts} approvalId={msg.data.emailReviewApprovalId} onSend={handleSendEmails} onReject={handleReject} loading={approvalLoading}/></BotMessage>;
                    if(msg.type==='result'&&msg.data?.sendResults) return <BotMessage key={msg.id}><SendResults results={msg.data.sendResults} onNewChat={handleNewChat}/></BotMessage>;
                    if(msg.type==='prep_questions'&&msg.data?.prepResults) return <BotMessage key={msg.id}><PrepQuestionsCard prepResults={msg.data.prepResults}/></BotMessage>;
                    return <BotMessage key={msg.id}><BotText text={msg.content}/></BotMessage>;
                  })}
                  {sending&&<BotMessage isLoading/>}
                </>
              )}
              <div ref={messagesEndRef}/>
            </div>
          </div>

          {/* ── INPUT ── */}
          <div className="t-input-area">
            <div className="t-input-inner">
              {cvFile&&<div className="t-cv-tag">
                <FileText style={{width:13,height:13,color:'var(--accent)',flexShrink:0}}/>
                <span>{cvFile.name}</span>
                <button onClick={()=>{setCvFile(null);if(fileInputRef.current)fileInputRef.current.value='';}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--error)',flexShrink:0,padding:0}}><X style={{width:12,height:12}}/></button>
              </div>}
              <div className="t-input-box">
                <input ref={fileInputRef} type="file" accept=".pdf" style={{display:'none'}} onChange={handleFileChange}/>
                {mode==='fte'&&<button onClick={()=>fileInputRef.current?.click()} disabled={isDisabled} className={`t-attach-btn ${currentState==='waiting_cv'?'pulse':'idle'}`}><Paperclip style={{width:16,height:16}}/></button>}
                <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isDisabled} className="t-textarea" rows={1}
                  placeholder={
                    mode==='ollama'
                      ?(ollamaOnline===false?'Ollama not running — start with "ollama serve"':ollamaSending?'Llama3 soch raha hai...':'Kuch bhi pucho Llama3 se...')
                      :viewingHistory?'Viewing history — click "Back" to resume'
                      :currentState==='waiting_cv'?'CV upload karein ya yahan likhein...'
                      :currentState==='cv_uploaded'||currentState==='asking_location'?'Role aur city likhein — e.g. "Software Engineer Karachi"'
                      :ASYNC_STATES.has(currentState)?'Kaam ho raha hai, thodi der wait karein...'
                      :'Yahan likhein... (Enter = send, Shift+Enter = newline)'
                  }/>
                <button onClick={handleSend} disabled={isDisabled||(!input.trim()&&(mode==='ollama'||!cvFile))} className="t-send-btn">
                  {(mode==='ollama'?ollamaSending:sending)?<Loader2 style={{width:16,height:16}} className="t-spin"/>:<Send style={{width:16,height:16}}/>}
                </button>
              </div>
              <p className="t-hint">{mode==='ollama'?'Llama3 runs locally — no data sent to cloud':'CV → Role + City → Jobs → CVs → Approve → Emails → Send'}</p>
            </div>
          </div>
        </div>

        {/* ── ACTIVITY PANEL (right side, always visible) ── */}
        {mode==='fte'&&(
          <ActivityPanel
            activityLog={activityLog}
            currentState={currentState}
            isAsync={ASYNC_STATES.has(currentState)}
          />
        )}
      </div>
    </div>
  </>;
}
