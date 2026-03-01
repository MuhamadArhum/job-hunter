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
  Sparkles, Zap, Brain,
} from 'lucide-react';

const ASYNC_STATES = new Set(['searching', 'generating_cvs', 'finding_emails', 'sending', 'preparing_interview']);

const STATE_META = {
  waiting_cv:          { label: 'Upload CV',               color: '#6ee7b7', dot: '#6ee7b7' },
  cv_uploaded:         { label: 'Ready',                   color: '#34d399', dot: '#34d399' },
  ready:               { label: 'Ready',                   color: '#34d399', dot: '#34d399' },
  asking_location:     { label: 'Enter City',              color: '#60a5fa', dot: '#60a5fa' },
  searching:           { label: 'Searching Jobs...',       color: '#fbbf24', dot: '#fbbf24' },
  generating_cvs:      { label: 'Generating CVs...',       color: '#fbbf24', dot: '#fbbf24' },
  cv_review:           { label: 'Review CVs',              color: '#a78bfa', dot: '#a78bfa' },
  finding_emails:      { label: 'Finding HR Emails...',    color: '#fbbf24', dot: '#fbbf24' },
  email_review:        { label: 'Review Emails',           color: '#fb923c', dot: '#fb923c' },
  sending:             { label: 'Sending Applications...', color: '#fbbf24', dot: '#fbbf24' },
  preparing_interview: { label: 'Preparing Interview...',  color: '#a78bfa', dot: '#a78bfa' },
  done:                { label: 'Complete',                color: '#34d399', dot: '#34d399' },
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --bg-base:     #0a0e17;
    --bg-surface:  #0f1624;
    --bg-raised:   #141b2d;
    --bg-hover:    #1a2236;
    --bg-active:   #1e2940;
    --border:      rgba(255,255,255,0.07);
    --border-md:   rgba(255,255,255,0.1);
    --border-hi:   rgba(255,255,255,0.15);
    --accent:      #10b981;
    --accent-hi:   #34d399;
    --accent-dim:  rgba(16,185,129,0.15);
    --accent-glow: rgba(16,185,129,0.25);
    --text-1:      #f1f5f9;
    --text-2:      #94a3b8;
    --text-3:      #475569;
    --text-accent: #6ee7b7;
    --violet:      #7c3aed;
    --violet-hi:   #a78bfa;
    --violet-dim:  rgba(124,58,237,0.15);
    --blue:        #3b82f6;
    --blue-dim:    rgba(59,130,246,0.15);
    --radius-sm:   8px;
    --radius-md:   12px;
    --radius-lg:   16px;
    --radius-xl:   20px;
    --shadow-sm:   0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md:   0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3);
    --shadow-lg:   0 12px 40px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 20px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.4);
  }

  .fte-root * { font-family: 'DM Sans', system-ui, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
  .fte-root { height: 100vh; display: flex; flex-direction: column; background: var(--bg-base); overflow: hidden; color: var(--text-1); }

  /* ── Noise texture overlay ── */
  .fte-root::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.5;
  }

  /* ── Scrollbar ── */
  .fte-root ::-webkit-scrollbar { width: 4px; }
  .fte-root ::-webkit-scrollbar-track { background: transparent; }
  .fte-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  .fte-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

  /* ─────────── HEADER ─────────── */
  .fte-header {
    position: relative; z-index: 10;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 0 16px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; height: 56px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .fte-header::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
  }

  .fte-brand-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, var(--accent), #059669);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-glow);
    flex-shrink: 0;
    transition: transform 0.2s;
  }
  .fte-brand-icon:hover { transform: scale(1.05); }
  .fte-brand-name { color: var(--text-1); font-weight: 700; font-size: 0.9rem; letter-spacing: -0.02em; }
  .fte-brand-sub  { font-size: 0.62rem; color: var(--text-accent); font-weight: 600; letter-spacing: 0.01em; margin-top: 1px; display: flex; align-items: center; gap: 4px; }

  .fte-header-btn {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.72rem; font-weight: 600;
    background: var(--bg-raised);
    border: 1px solid var(--border-md);
    color: var(--text-2);
    border-radius: var(--radius-sm);
    padding: 6px 12px; cursor: pointer;
    transition: all 0.18s; font-family: inherit;
  }
  .fte-header-btn:hover { background: var(--bg-hover); color: var(--text-1); border-color: var(--border-hi); }

  .fte-icon-btn {
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    border-radius: var(--radius-sm);
    background: none; border: none; cursor: pointer;
    color: var(--text-3); transition: all 0.15s;
  }
  .fte-icon-btn:hover { background: var(--bg-hover); color: var(--text-2); }
  .fte-sidebar-header .fte-icon-btn, .fte-profile-header .fte-icon-btn { color: var(--text-3); }
  .fte-sidebar-header .fte-icon-btn:hover, .fte-profile-header .fte-icon-btn:hover { background: var(--bg-hover); color: var(--text-2); }

  /* ─────────── MESSAGES ─────────── */
  .fte-messages {
    flex: 1; overflow-y: auto; padding: 28px 18px;
    background: transparent; position: relative; z-index: 1;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .fte-messages-inner { max-width: 740px; margin: 0 auto; }

  /* ─────────── DOTS ─────────── */
  .fte-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); animation: fteBounce 1.2s infinite; }
  @keyframes fteBounce { 0%,80%,100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-6px); opacity: 1; } }

  /* ─────────── BOT BUBBLE ─────────── */
  .fte-bot-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; animation: fteFadeUp 0.3s ease both; }
  @keyframes fteFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .fte-bot-icon {
    width: 32px; height: 32px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), #059669);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    margin-top: 2px;
    box-shadow: 0 0 12px var(--accent-glow), 0 2px 6px rgba(0,0,0,0.4);
  }
  .fte-bot-bubble {
    background: var(--bg-raised);
    border: 1px solid var(--border-md);
    border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg);
    padding: 13px 16px;
    max-width: 86%;
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(8px);
  }

  /* ─────────── USER BUBBLE ─────────── */
  .fte-user-row { display: flex; justify-content: flex-end; margin-bottom: 20px; animation: fteFadeUp 0.25s ease both; }
  .fte-user-bubble {
    background: linear-gradient(135deg, #059669, #0d9488);
    border-radius: var(--radius-lg) 4px var(--radius-lg) var(--radius-lg);
    padding: 11px 16px; max-width: 72%;
    color: white; font-size: 0.875rem; font-weight: 500; line-height: 1.65;
    box-shadow: 0 2px 16px rgba(5,150,105,0.3), 0 0 0 1px rgba(255,255,255,0.08);
  }

  /* ─────────── STATUS PILL ─────────── */
  .fte-status-row { display: flex; justify-content: center; margin-bottom: 20px; animation: fteFadeUp 0.3s ease both; }
  .fte-status-pill {
    background: rgba(251,191,36,0.08);
    border: 1px solid rgba(251,191,36,0.25);
    color: #fcd34d;
    border-radius: 100px; padding: 7px 16px 7px 12px;
    font-size: 0.72rem; font-weight: 600;
    display: flex; align-items: center; gap: 7px;
    box-shadow: 0 0 12px rgba(251,191,36,0.08);
  }

  /* ─────────── BOT TEXT ─────────── */
  .fte-text { font-size: 0.875rem; line-height: 1.75; }
  .fte-text p { color: var(--text-1); font-weight: 400; }
  .fte-text p + p { margin-top: 5px; }
  .fte-text strong { color: #fff; font-weight: 700; }
  .fte-text em { color: var(--text-accent); font-style: normal; font-size: 0.78rem; font-weight: 600; background: var(--accent-dim); padding: 1px 7px; border-radius: 5px; }

  /* ─────────── EMPTY STATE ─────────── */
  .fte-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 380px; text-align: center; padding: 48px 16px; }
  .fte-empty-icon {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, var(--accent), #059669);
    border-radius: 20px; display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
    box-shadow: var(--shadow-glow);
    animation: ftePulseGlow 3s ease-in-out infinite;
  }
  @keyframes ftePulseGlow {
    0%,100% { box-shadow: 0 0 20px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.4); }
    50%      { box-shadow: 0 0 36px rgba(16,185,129,0.4), 0 4px 16px rgba(0,0,0,0.4); }
  }
  .fte-empty h2 { color: var(--text-1); font-size: 1.4rem; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.03em; }
  .fte-empty > p { color: var(--text-2); font-size: 0.84rem; max-width: 280px; margin-bottom: 28px; line-height: 1.65; }
  .fte-empty-steps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; max-width: 360px; }
  .fte-empty-step {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-raised); border: 1px solid var(--border);
    border-radius: var(--radius-md); padding: 10px 12px;
    text-align: left; box-shadow: var(--shadow-sm);
    transition: all 0.2s;
  }
  .fte-empty-step:hover { border-color: var(--border-hi); background: var(--bg-hover); transform: translateY(-1px); }
  .fte-empty-step-num {
    width: 24px; height: 24px;
    background: linear-gradient(135deg, var(--accent), #059669);
    border-radius: 7px; display: flex; align-items: center; justify-content: center;
    color: white; font-size: 0.64rem; font-weight: 800; flex-shrink: 0;
    font-family: 'DM Mono', monospace;
  }
  .fte-empty-step-text { font-size: 0.73rem; color: var(--text-2); font-weight: 500; line-height: 1.3; }

  /* ─────────── INPUT AREA ─────────── */
  .fte-input-area {
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    padding: 14px 18px 16px;
    flex-shrink: 0;
    position: relative; z-index: 10;
    backdrop-filter: blur(12px);
  }
  .fte-input-inner { max-width: 740px; margin: 0 auto; }

  .fte-cv-preview {
    display: flex; align-items: center; gap: 8px;
    background: var(--accent-dim);
    border: 1px solid rgba(16,185,129,0.3);
    border-radius: var(--radius-sm); padding: 6px 12px; margin-bottom: 10px;
    animation: fteFadeUp 0.2s ease;
  }
  .fte-cv-preview span { font-size: 0.75rem; color: var(--text-accent); font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .fte-input-row { display: flex; align-items: flex-end; gap: 8px; }

  .fte-attach-btn {
    width: 42px; height: 42px; border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    border: none; cursor: pointer; flex-shrink: 0; transition: all 0.2s;
  }
  .fte-attach-btn.pulse {
    background: linear-gradient(135deg, var(--accent), #059669);
    color: white;
    box-shadow: var(--shadow-glow);
    animation: ftePulseBtn 2s ease-in-out infinite;
  }
  @keyframes ftePulseBtn {
    0%,100% { box-shadow: 0 0 12px var(--accent-glow); }
    50%      { box-shadow: 0 0 24px rgba(16,185,129,0.45); }
  }
  .fte-attach-btn.idle {
    background: var(--bg-raised); border: 1px solid var(--border-md); color: var(--text-3);
  }
  .fte-attach-btn.idle:hover { background: var(--bg-hover); border-color: var(--border-hi); color: var(--text-2); }
  .fte-attach-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .fte-textarea {
    flex: 1;
    background: var(--bg-raised);
    border: 1px solid var(--border-md);
    border-radius: 11px;
    padding: 11px 15px;
    font-size: 0.875rem; font-weight: 400; color: var(--text-1);
    resize: none; outline: none; font-family: inherit;
    min-height: 44px; max-height: 128px;
    transition: all 0.18s;
    scrollbar-width: thin;
  }
  .fte-textarea::placeholder { color: var(--text-3); }
  .fte-textarea:focus { border-color: rgba(16,185,129,0.5); background: var(--bg-hover); box-shadow: 0 0 0 3px var(--accent-dim); }
  .fte-textarea:disabled { opacity: 0.4; cursor: not-allowed; }

  .fte-send-btn {
    width: 42px; height: 42px;
    background: linear-gradient(135deg, var(--accent), #059669);
    border: none; border-radius: 11px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: white; flex-shrink: 0;
    box-shadow: 0 2px 12px var(--accent-glow);
    transition: all 0.2s;
  }
  .fte-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(16,185,129,0.5); }
  .fte-send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
  .fte-input-hint { text-align: center; font-size: 0.64rem; color: var(--text-3); font-weight: 500; margin-top: 9px; letter-spacing: 0.01em; }

  /* ─────────── SIDEBAR ─────────── */
  .fte-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 20; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
  .fte-sidebar {
    position: fixed; top: 0; left: 0; height: 100%; width: 296px;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    z-index: 30; display: flex; flex-direction: column;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 12px 0 40px rgba(0,0,0,0.5);
  }
  .fte-sidebar.open { transform: translateX(0); }
  .fte-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
  .fte-sidebar-title { color: var(--text-1); font-weight: 700; font-size: 0.9rem; }
  .fte-sidebar-sub { color: var(--text-3); font-size: 0.68rem; font-weight: 500; margin-top: 2px; }
  .fte-sidebar-list { flex: 1; overflow-y: auto; padding: 10px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }

  .fte-session-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md); padding: 13px;
    background: var(--bg-raised);
    margin-bottom: 7px; transition: all 0.18s;
    box-shadow: var(--shadow-sm);
  }
  .fte-session-card-clickable { cursor: pointer; }
  .fte-session-card-clickable:hover { border-color: rgba(16,185,129,0.3); background: var(--bg-hover); transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .fte-session-role { color: var(--text-1); font-weight: 700; font-size: 0.82rem; }
  .fte-session-loc { color: var(--text-3); font-size: 0.69rem; font-weight: 500; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  .fte-session-badge { font-size: 0.62rem; font-weight: 700; padding: 2px 9px; border-radius: 100px; }
  .fte-session-badge.sent { background: var(--accent-dim); color: var(--text-accent); border: 1px solid rgba(16,185,129,0.25); }
  .fte-session-badge.none { background: var(--bg-hover); color: var(--text-3); border: 1px solid var(--border); }
  .fte-session-meta { color: var(--text-3); font-size: 0.65rem; font-weight: 500; display: flex; align-items: center; gap: 4px; margin-top: 8px; }
  .fte-company-chip { font-size: 0.62rem; background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.2); color: var(--text-accent); font-weight: 600; border-radius: 5px; padding: 1px 7px; }
  .fte-sidebar-empty { display: flex; flex-direction: column; align-items: center; padding: 52px 20px; text-align: center; }
  .fte-sidebar-empty p { color: var(--text-2); font-size: 0.82rem; font-weight: 500; margin: 10px 0 2px; }
  .fte-sidebar-empty small { color: var(--text-3); font-size: 0.72rem; }

  /* ─────────── CARDS ─────────── */
  .fte-card { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-raised); margin-bottom: 8px; box-shadow: var(--shadow-sm); transition: all 0.18s; }
  .fte-card:hover { border-color: var(--border-hi); }
  .fte-card-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; background: none; border: none; cursor: pointer; text-align: left; gap: 10px; transition: background 0.15s; font-family: inherit; }
  .fte-card-btn:hover { background: var(--bg-hover); }
  .fte-card-title { color: var(--text-1); font-weight: 700; font-size: 0.84rem; }
  .fte-card-meta { color: var(--text-3); font-size: 0.7rem; font-weight: 500; display: flex; align-items: center; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
  .fte-card-expand { border-top: 1px solid var(--border); background: var(--bg-surface); padding: 14px 15px; }

  .fte-section-label { font-size: 0.62rem; font-weight: 700; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 7px; font-family: 'DM Mono', monospace; }
  .fte-skill-chip { font-size: 0.67rem; font-weight: 600; background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.2); color: var(--text-accent); border-radius: 5px; padding: 2px 8px; }
  .fte-exp-item { padding-left: 11px; border-left: 2px solid rgba(16,185,129,0.4); margin-bottom: 9px; }
  .fte-exp-title { color: var(--text-1); font-size: 0.8rem; font-weight: 600; }
  .fte-exp-date { color: var(--text-3); font-size: 0.7rem; font-weight: 500; margin-top: 1px; }
  .fte-rec-item { display: flex; align-items: flex-start; gap: 6px; font-size: 0.76rem; font-weight: 400; color: var(--text-2); margin-bottom: 5px; line-height: 1.55; }
  .fte-job-link { color: var(--accent); font-size: 0.69rem; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; text-decoration: none; transition: color 0.15s; }
  .fte-job-link:hover { color: var(--accent-hi); }
  .fte-failed-badge { font-size: 0.62rem; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #f87171; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
  .fte-ats-score { font-size: 1.1rem; font-weight: 800; line-height: 1; font-family: 'DM Mono', monospace; }
  .fte-ats-label { font-size: 0.58rem; font-weight: 600; color: var(--text-3); margin-top: 2px; text-align: center; text-transform: uppercase; letter-spacing: 0.06em; }

  /* ─────────── BUTTONS ─────────── */
  .fte-approve-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    background: linear-gradient(135deg, var(--accent), #059669);
    color: white; font-weight: 700; font-size: 0.84rem; border: none;
    border-radius: var(--radius-sm); padding: 11px 16px; cursor: pointer;
    font-family: inherit; box-shadow: 0 2px 12px var(--accent-glow);
    transition: all 0.2s;
  }
  .fte-approve-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(16,185,129,0.45); }
  .fte-approve-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .fte-send-email-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    background: linear-gradient(135deg, #3b82f6, #4f46e5);
    color: white; font-weight: 700; font-size: 0.84rem; border: none;
    border-radius: var(--radius-sm); padding: 11px 16px; cursor: pointer;
    font-family: inherit; box-shadow: 0 2px 12px rgba(79,70,229,0.3);
    transition: all 0.2s;
  }
  .fte-send-email-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(79,70,229,0.45); }
  .fte-send-email-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .fte-cancel-btn {
    display: flex; align-items: center; gap: 5px; padding: 11px 14px;
    background: var(--bg-raised);
    border: 1px solid rgba(239,68,68,0.3); color: #f87171;
    font-weight: 600; font-size: 0.8rem; border-radius: var(--radius-sm);
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .fte-cancel-btn:hover:not(:disabled) { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.5); }
  .fte-cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ─────────── DRAFT INPUTS ─────────── */
  .fte-draft-label { font-size: 0.62rem; font-weight: 700; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; font-family: 'DM Mono', monospace; }
  .fte-draft-input { width: 100%; background: var(--bg-base); border: 1px solid var(--border-md); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.82rem; font-weight: 400; color: var(--text-1); outline: none; font-family: inherit; transition: all 0.15s; }
  .fte-draft-input::placeholder { color: var(--text-3); }
  .fte-draft-input:focus { border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 3px var(--accent-dim); }

  /* ─────────── RESULTS ─────────── */
  .fte-result-ok  { display: flex; align-items: center; justify-content: space-between; background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.25); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.75rem; margin-bottom: 6px; }
  .fte-result-fail{ display: flex; align-items: center; justify-content: space-between; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.75rem; margin-bottom: 6px; }
  .fte-result-company { color: var(--text-1); font-weight: 700; }
  .fte-result-detail { color: var(--text-3); font-size: 0.68rem; font-weight: 500; }

  .fte-approve-label { color: var(--text-1); font-weight: 700; font-size: 0.9rem; }
  .fte-new-chat-link {
    display: inline-flex; align-items: center; gap: 5px;
    color: var(--text-accent); font-size: 0.8rem; font-weight: 700;
    background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.3);
    border-radius: var(--radius-sm); cursor: pointer; margin-top: 14px;
    padding: 7px 14px; font-family: inherit; transition: all 0.2s;
  }
  .fte-new-chat-link:hover { background: rgba(16,185,129,0.2); border-color: rgba(16,185,129,0.5); }

  /* ─────────── ANIMATIONS ─────────── */
  .fte-spin { animation: fteSpin 1s linear infinite; }
  @keyframes fteSpin { to { transform: rotate(360deg); } }
  .fte-pulse-dot { animation: fteDotPulse 1.4s ease-in-out infinite; }
  @keyframes fteDotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }

  .fte-thinking { display: flex; align-items: center; gap: 8px; }
  .fte-thinking span { font-size: 0.78rem; font-weight: 500; color: var(--text-3); }

  /* ─────────── AVATAR BTN ─────────── */
  .fte-avatar-btn {
    width: 32px; height: 32px; border-radius: 9px;
    background: var(--bg-raised);
    border: 1px solid var(--border-md);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    color: var(--text-accent); font-size: 0.68rem; font-weight: 700; font-family: 'DM Mono', monospace;
    transition: all 0.2s; flex-shrink: 0;
  }
  .fte-avatar-btn:hover { background: var(--bg-hover); border-color: var(--border-hi); }

  /* ─────────── PROFILE PANEL ─────────── */
  .fte-profile {
    position: fixed; top: 0; right: 0; height: 100%; width: 320px;
    background: var(--bg-surface); border-left: 1px solid var(--border);
    z-index: 30; display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow: -12px 0 40px rgba(0,0,0,0.5);
  }
  .fte-profile.open { transform: translateX(0); }
  .fte-profile-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
  .fte-profile-title { color: var(--text-1); font-weight: 700; font-size: 0.9rem; }
  .fte-profile-body { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 18px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }

  .fte-profile-avatar { width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, var(--accent), #059669); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.4rem; font-weight: 700; font-family: 'DM Mono', monospace; box-shadow: var(--shadow-glow); flex-shrink: 0; }
  .fte-profile-name  { color: var(--text-1); font-size: 1rem; font-weight: 700; }
  .fte-profile-email { color: var(--text-3); font-size: 0.76rem; font-weight: 500; margin-top: 2px; }

  .fte-profile-section { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-raised); }
  .fte-profile-section-hdr { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--border); }
  .fte-profile-section-title { color: var(--text-1); font-weight: 700; font-size: 0.82rem; }
  .fte-profile-section-body { padding: 14px; display: flex; flex-direction: column; gap: 13px; }

  .fte-profile-label { display: block; font-size: 0.62rem; font-weight: 700; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; font-family: 'DM Mono', monospace; }
  .fte-profile-input { width: 100%; background: var(--bg-base); border: 1px solid var(--border-md); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 0.84rem; font-weight: 400; color: var(--text-1); outline: none; font-family: inherit; transition: all 0.15s; }
  .fte-profile-input::placeholder { color: var(--text-3); }
  .fte-profile-input:focus { border-color: rgba(16,185,129,0.5); background: var(--bg-raised); box-shadow: 0 0 0 3px var(--accent-dim); }
  .fte-profile-input:disabled { background: var(--bg-raised); color: var(--text-3); cursor: default; }

  .fte-profile-save { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: linear-gradient(135deg, var(--accent), #059669); color: white; font-weight: 700; font-size: 0.84rem; border: none; border-radius: var(--radius-sm); padding: 10px; cursor: pointer; font-family: inherit; box-shadow: 0 2px 10px var(--accent-glow); transition: all 0.2s; }
  .fte-profile-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 18px rgba(16,185,129,0.4); }
  .fte-profile-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .fte-profile-logout { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: var(--bg-raised); color: #f87171; font-weight: 700; font-size: 0.84rem; border: 1px solid rgba(239,68,68,0.25); border-radius: var(--radius-sm); padding: 10px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .fte-profile-logout:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.45); }

  .fte-pw-wrap { position: relative; }
  .fte-pw-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-3); padding: 0; transition: color 0.15s; }
  .fte-pw-eye:hover { color: var(--accent); }

  /* ─────────── HISTORY BANNER ─────────── */
  .fte-history-banner { display: flex; align-items: center; justify-content: space-between; background: rgba(251,191,36,0.07); border-bottom: 1px solid rgba(251,191,36,0.2); padding: 8px 18px; flex-shrink: 0; gap: 8px; z-index: 9; }
  .fte-history-banner-text { color: #fcd34d; font-size: 0.73rem; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fte-history-banner-btn { display: flex; align-items: center; gap: 4px; background: var(--bg-raised); border: 1px solid rgba(251,191,36,0.25); color: #fcd34d; font-size: 0.71rem; font-weight: 600; cursor: pointer; font-family: inherit; padding: 5px 11px; border-radius: 7px; transition: all 0.15s; flex-shrink: 0; }
  .fte-history-banner-btn:hover { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.4); }

  /* ─────────── MODE TOGGLE ─────────── */
  .fte-mode-toggle { display: flex; background: var(--bg-raised); border: 1px solid var(--border-md); border-radius: 10px; padding: 3px; gap: 2px; }
  .fte-mode-btn { padding: 5px 12px; border-radius: 7px; border: none; cursor: pointer; font-size: 0.7rem; font-weight: 600; font-family: inherit; background: none; color: var(--text-3); transition: all 0.2s; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .fte-mode-btn.active { background: var(--bg-hover); color: var(--text-1); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
  .fte-mode-btn:hover:not(.active) { color: var(--text-2); }

  /* ─────────── OLLAMA ─────────── */
  .fte-ollama-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .fte-ollama-dot.online  { background: var(--accent); box-shadow: 0 0 6px var(--accent-glow); }
  .fte-ollama-dot.offline { background: #ef4444; }
  .fte-ollama-dot.checking { background: #fbbf24; animation: fteDotPulse 1s infinite; }

  .fte-ollama-bot-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 18px; animation: fteFadeUp 0.3s ease both; }
  .fte-ollama-icon { width: 32px; height: 32px; flex-shrink: 0; background: linear-gradient(135deg, #7c3aed, #6d28d9); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-top: 2px; box-shadow: 0 0 12px var(--violet-dim), 0 2px 6px rgba(0,0,0,0.4); }
  .fte-ollama-bot-bubble { background: var(--bg-raised); border: 1px solid rgba(124,58,237,0.25); border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg); padding: 13px 16px; max-width: 85%; box-shadow: var(--shadow-sm); }
  .fte-ollama-bot-bubble .fte-text p { color: var(--text-1); }

  .fte-model-select { background: var(--bg-raised); border: 1px solid rgba(124,58,237,0.3); border-radius: 7px; padding: 5px 10px; font-size: 0.71rem; font-weight: 600; color: var(--violet-hi); outline: none; font-family: inherit; cursor: pointer; max-width: 200px; }
  .fte-model-select option { background: var(--bg-surface); color: var(--text-1); }
  .fte-model-select:focus { border-color: var(--violet); }
  .fte-model-bar { display: flex; align-items: center; gap: 8px; padding: 8px 18px; background: var(--bg-raised); border-bottom: 1px solid rgba(124,58,237,0.15); flex-shrink: 0; }
  .fte-model-bar-label { font-size: 0.67rem; font-weight: 700; color: var(--violet-hi); font-family: 'DM Mono', monospace; }

  .fte-ollama-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 280px; text-align: center; padding: 40px 0; }
  .fte-ollama-empty-icon { width: 64px; height: 64px; background: linear-gradient(135deg, #7c3aed, #6d28d9); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; box-shadow: 0 0 20px var(--violet-dim); }
  .fte-ollama-empty h2 { color: var(--text-1); font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em; }
  .fte-ollama-empty p { color: var(--text-2); font-size: 0.84rem; max-width: 300px; margin: 0; }
  .fte-ollama-offline-note { margin-top: 14px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 9px 16px; font-size: 0.75rem; color: #f87171; font-weight: 600; }
  .fte-ollama-offline-note code { background: rgba(239,68,68,0.1); border-radius: 4px; padding: 2px 6px; font-family: 'DM Mono', monospace; }

  /* ─────────── DIVIDER ─────────── */
  .fte-divider { height: 1px; background: var(--border); margin: 4px 0 10px; }
`;

/* ── Sub-components unchanged in logic, restyled via CSS vars ── */

function TypingDots() {
  return <div style={{display:'flex',gap:5,alignItems:'center',padding:'3px 2px'}}>{[0,1,2].map(i=><div key={i} className="fte-dot" style={{animationDelay:`${i*0.18}s`}}/>)}</div>;
}
function BotMessage({children,isLoading}) {
  return <div className="fte-bot-row"><div className="fte-bot-icon"><Bot style={{width:15,height:15,color:'white'}}/></div><div className="fte-bot-bubble">{isLoading?<TypingDots/>:children}</div></div>;
}
function UserMessage({children}) {
  return <div className="fte-user-row"><div className="fte-user-bubble">{children}</div></div>;
}
function StatusMessage({children}) {
  return <div className="fte-status-row"><div className="fte-status-pill"><Loader2 style={{width:13,height:13}} className="fte-spin"/>{children}</div></div>;
}
function BotText({text}) {
  if(!text) return null;
  return <div className="fte-text">{text.split('\n').map((line,i)=>{
    const parts=line.split(/(\*\*[^*]+\*\*)/g);
    const rendered=parts.map((p,j)=>p.startsWith('**')&&p.endsWith('**')?<strong key={j}>{p.slice(2,-2)}</strong>:p.startsWith('_(')&&p.endsWith(')_')?<em key={j}>{p.slice(2,-2)}</em>:p);
    return <p key={i} style={line===''?{height:6}:{}}>{rendered}</p>;
  })}</div>;
}
function ATSScore({score}) {
  if(score===null||score===undefined) return <div style={{textAlign:'center',minWidth:42}}><p style={{color:'var(--text-3)',fontSize:'0.7rem',fontWeight:700}}>N/A</p><p style={{color:'var(--text-3)',fontSize:'0.6rem',fontWeight:600}}>ATS</p></div>;
  const color=score>=80?'#34d399':score>=60?'#fbbf24':'#f87171';
  return <div style={{textAlign:'center',minWidth:42}}><p className="fte-ats-score" style={{color}}>{score}%</p><p className="fte-ats-label">ATS</p></div>;
}

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
      <p className="fte-approve-label">{valid.length} tailored CV{valid.length!==1?'s':''} {readOnly?'generated':'ready'}</p>
    </div>
    <div style={{marginBottom:12}}>
      {cvResults.map((result,idx)=>{
        const score=result.atsScore?.overall??result.atsScore?.format??null;
        const cv=result.cv||{}; const isOpen=expanded===idx;
        return <div key={idx} className="fte-card">
          <button className="fte-card-btn" onClick={()=>setExpanded(isOpen?null:idx)}>
            <div style={{flex:1,minWidth:0}}>
              <p className="fte-card-title">{result.job?.title||'Unknown Role'}</p>
              <div className="fte-card-meta">
                <Building2 style={{width:11,height:11}}/><span>{result.job?.company}</span>
                {result.job?.location&&<><MapPin style={{width:11,height:11}}/><span>{result.job.location}</span></>}
              </div>
              {result.job?.sourceUrl&&<a href={result.job.sourceUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="fte-job-link">View job <ExternalLink style={{width:10,height:10}}/></a>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              {result.error?<span className="fte-failed-badge">Failed</span>:<ATSScore score={score}/>}
              {isOpen?<ChevronUp style={{width:14,height:14,color:'var(--text-accent)'}}/>:<ChevronDown style={{width:14,height:14,color:'var(--text-3)'}}/>}
            </div>
          </button>
          {isOpen&&<div className="fte-card-expand">
            {result.error?<p style={{color:'#f87171',fontSize:'0.78rem',fontWeight:600}}>{result.error}</p>:<>
              {(cv.summary||cv.profile||cv.objective||cv.professionalSummary)&&<div style={{marginBottom:11}}>
                <p className="fte-section-label">Professional Summary</p>
                <p style={{color:'var(--text-2)',fontSize:'0.79rem',fontWeight:400,lineHeight:1.65}}>{cv.summary||cv.profile||cv.objective||cv.professionalSummary}</p>
              </div>}
              {cv.skills?.length>0&&<div style={{marginBottom:11}}>
                <p className="fte-section-label">Key Skills</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{(Array.isArray(cv.skills)?cv.skills:[]).slice(0,12).map((s,i)=><span key={i} className="fte-skill-chip">{typeof s==='string'?s:s.name||String(s)}</span>)}</div>
              </div>}
              {cv.experience?.length>0&&<div style={{marginBottom:11}}>
                <p className="fte-section-label">Experience</p>
                {cv.experience.slice(0,2).map((e,i)=><div key={i} className="fte-exp-item">
                  <p className="fte-exp-title">{e.role||e.title||e.position} @ {e.company||e.organization}</p>
                  <p className="fte-exp-date">{e.duration||e.period||e.dates||e.date}</p>
                </div>)}
              </div>}
              {result.recommendations?.length>0&&<div style={{marginBottom:10}}>
                <p className="fte-section-label">Improvements</p>
                {result.recommendations.slice(0,3).map((rec,i)=><div key={i} className="fte-rec-item">
                  <TrendingUp style={{width:11,height:11,color:'#fbbf24',flexShrink:0,marginTop:2}}/><span>{rec}</span>
                </div>)}
              </div>}
              {result.hasPdf&&<button onClick={()=>handleDownload(result)} disabled={!!downloading} style={{marginTop:8,display:'flex',alignItems:'center',gap:6,background:'var(--blue-dim)',border:'1px solid rgba(59,130,246,0.3)',color:'#60a5fa',borderRadius:'var(--radius-sm)',padding:'7px 14px',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',width:'fit-content',transition:'all 0.2s'}}>
                {downloading===result.jobId?<><Loader2 style={{width:13,height:13}} className="fte-spin"/>Downloading...</>:<><Download style={{width:13,height:13}}/>Download Tailored CV (PDF)</>}
              </button>}
            </>}
          </div>}
        </div>;
      })}
    </div>
    {readOnly
      ?<div style={{display:'flex',alignItems:'center',gap:7,background:'var(--accent-dim)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:'var(--radius-sm)',padding:'9px 14px'}}>
          <CheckCircle style={{width:14,height:14,color:'var(--accent)'}}/><span style={{color:'var(--text-accent)',fontSize:'0.8rem',fontWeight:700}}>Approved — {valid.length} CV{valid.length!==1?'s':''} generated</span>
        </div>
      :<div style={{display:'flex',gap:8}}>
          <button className="fte-approve-btn" onClick={()=>onApprove(approvalId)} disabled={loading||valid.length===0}>{loading?<><Loader2 style={{width:14,height:14}} className="fte-spin"/>Approving...</>:<><CheckCircle style={{width:14,height:14}}/>Approve {valid.length} CV{valid.length!==1?'s':''}</>}</button>
          <button className="fte-cancel-btn" onClick={()=>onReject()} disabled={loading}><XCircle style={{width:13,height:13}}/>Cancel</button>
        </div>
    }
  </div>;
}

function EmailApprovalCards({emailDrafts,approvalId,onSend,onReject,loading,readOnly}) {
  const valid=emailDrafts.filter(d=>d.hrEmail&&!d.error);
  const [drafts,setDrafts]=useState(valid.map(d=>({...d})));
  const [expanded,setExpanded]=useState(null);
  const skipped=emailDrafts.filter(d=>!d.hrEmail||d.error);
  const update=(idx,field,val)=>{if(readOnly)return;const u=[...drafts];u[idx]={...u[idx],[field]:val};setDrafts(u);};

  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
      <Mail style={{width:15,height:15,color:'#fb923c'}}/>
      <p className="fte-approve-label">{drafts.length} email draft{drafts.length!==1?'s':''} {readOnly?'sent':'ready'}</p>
    </div>
    {skipped.length>0&&<p style={{fontSize:'0.72rem',color:'var(--text-3)',fontWeight:500,marginBottom:10}}>{skipped.length} companies — HR email not found, skipped</p>}
    <div style={{marginBottom:12}}>
      {drafts.map((draft,idx)=><div key={idx} className="fte-card">
        <button className="fte-card-btn" onClick={()=>setExpanded(expanded===idx?null:idx)}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <p className="fte-card-title">{draft.job?.company}</p>
              {draft.emailVerified&&<span style={{fontSize:'0.6rem',fontWeight:800,background:'var(--accent-dim)',color:'var(--text-accent)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:6,padding:'1px 7px',flexShrink:0}}>✓ Deliverable</span>}
              {draft.emailSource==='hunter'&&!draft.emailVerified&&draft.emailVerifyResult==='risky'&&<span style={{fontSize:'0.6rem',fontWeight:800,background:'rgba(251,146,60,0.12)',color:'#fb923c',border:'1px solid rgba(251,146,60,0.3)',borderRadius:6,padding:'1px 7px',flexShrink:0}}>⚠ Risky</span>}
              {draft.emailSource==='hunter'&&!draft.emailVerified&&draft.emailVerifyResult!=='risky'&&<span style={{fontSize:'0.6rem',fontWeight:800,background:'var(--bg-hover)',color:'var(--text-3)',border:'1px solid var(--border)',borderRadius:6,padding:'1px 7px',flexShrink:0}}>? Unverified</span>}
              {draft.emailSource==='llm'&&<span style={{fontSize:'0.6rem',fontWeight:800,background:'rgba(251,191,36,0.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.25)',borderRadius:6,padding:'1px 7px',flexShrink:0}}>~ Estimated</span>}
            </div>
            <p style={{fontSize:'0.7rem',color:'var(--text-3)',fontWeight:500,marginTop:2}}>{draft.hrEmail} · {draft.job?.title}</p>
          </div>
          {expanded===idx?<ChevronUp style={{width:14,height:14,color:'var(--text-accent)',flexShrink:0}}/>:<ChevronDown style={{width:14,height:14,color:'var(--text-3)',flexShrink:0}}/>}
        </button>
        {expanded===idx&&<div className="fte-card-expand" style={{display:'flex',flexDirection:'column',gap:10}}>
          {[{label:'To (HR Email)',key:'hrEmail'},{label:'Subject',key:'subject'}].map(({label,key})=>
            <div key={key}><div className="fte-draft-label">{label}</div><input type="text" value={draft[key]||''} onChange={e=>update(idx,key,e.target.value)} readOnly={readOnly} className="fte-draft-input" style={{marginTop:4}}/></div>)}
          <div><div className="fte-draft-label">Email Body</div><textarea value={draft.body||''} onChange={e=>update(idx,'body',e.target.value)} readOnly={readOnly} rows={5} className="fte-draft-input" style={{marginTop:4,resize:'none',lineHeight:1.6}}/></div>
        </div>}
      </div>)}
    </div>
    {readOnly
      ?<div style={{display:'flex',alignItems:'center',gap:7,background:'var(--blue-dim)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:'var(--radius-sm)',padding:'9px 14px'}}>
          <Send style={{width:14,height:14,color:'#60a5fa'}}/><span style={{color:'#93c5fd',fontSize:'0.8rem',fontWeight:700}}>Sent — {drafts.length} application{drafts.length!==1?'s':''} dispatched</span>
        </div>
      :<div style={{display:'flex',gap:8}}>
          <button className="fte-send-email-btn" onClick={()=>onSend(approvalId,drafts)} disabled={loading||drafts.length===0}>{loading?<><Loader2 style={{width:14,height:14}} className="fte-spin"/>Sending...</>:<><Send style={{width:14,height:14}}/>Send {drafts.length} Application{drafts.length!==1?'s':''}</>}</button>
          <button className="fte-cancel-btn" onClick={()=>onReject()} disabled={loading}><XCircle style={{width:13,height:13}}/>Cancel</button>
        </div>
    }
  </div>;
}

function SendResults({results,onNewChat}) {
  const ok=results.filter(r=>r.success), fail=results.filter(r=>!r.success);
  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:11}}>
      {ok.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,color:'#34d399',fontSize:'0.84rem',fontWeight:800}}><CheckCircle style={{width:14,height:14}}/>{ok.length} sent</span>}
      {fail.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,color:'#f87171',fontSize:'0.84rem',fontWeight:800}}><XCircle style={{width:14,height:14}}/>{fail.length} failed</span>}
    </div>
    {results.map((r,idx)=><div key={idx} className={r.success?'fte-result-ok':'fte-result-fail'}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        {r.success?<CheckCircle style={{width:12,height:12,color:'var(--accent)',flexShrink:0}}/>:<XCircle style={{width:12,height:12,color:'#f87171',flexShrink:0}}/>}
        <span className="fte-result-company">{r.company}</span>
        {r.jobTitle&&<span className="fte-result-detail">— {r.jobTitle}</span>}
      </div>
      <span className="fte-result-detail">{r.hrEmail||r.error||''}</span>
    </div>)}
    <button className="fte-new-chat-link" onClick={onNewChat}><Plus style={{width:13,height:13}}/>New Chat shuru karein</button>
  </div>;
}

function PrepQuestionsCard({prepResults}) {
  const [expandedIdx,setExpandedIdx]=useState(0);
  if(!prepResults?.length) return null;
  const QSection=({title,color,items})=>{
    if(!items?.length) return null;
    return <div style={{marginBottom:11}}>
      <div style={{fontSize:'0.7rem',fontWeight:800,color,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,fontFamily:"'DM Mono',monospace"}}>{title}</div>
      <ul style={{margin:0,paddingLeft:16,display:'flex',flexDirection:'column',gap:5}}>
        {items.map((q,i)=><li key={i} style={{fontSize:'0.82rem',color:'var(--text-2)',fontWeight:400,lineHeight:1.5}}>{q.question||q}</li>)}
      </ul>
    </div>;
  };
  return <div style={{width:'100%'}}>
    <div style={{fontSize:'0.8rem',fontWeight:800,color:'#a78bfa',marginBottom:11,display:'flex',alignItems:'center',gap:7}}>
      <Brain style={{width:15,height:15,color:'#a78bfa'}}/> Interview Prep Questions
    </div>
    {prepResults.map((result,idx)=><div key={idx} style={{background:'var(--violet-dim)',border:'1px solid rgba(124,58,237,0.2)',borderRadius:'var(--radius-md)',marginBottom:8,overflow:'hidden'}}>
      <button onClick={()=>setExpandedIdx(expandedIdx===idx?-1:idx)} style={{width:'100%',background:'none',border:'none',padding:'11px 13px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',fontFamily:'inherit'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:1}}>
          <span style={{fontSize:'0.84rem',fontWeight:800,color:'var(--violet-hi)'}}>{result.company}</span>
          {result.jobTitle&&<span style={{fontSize:'0.72rem',color:'var(--text-3)',fontWeight:500}}>{result.jobTitle}</span>}
        </div>
        {expandedIdx===idx?<ChevronUp style={{width:14,height:14,color:'var(--violet-hi)',flexShrink:0}}/>:<ChevronDown style={{width:14,height:14,color:'var(--text-3)',flexShrink:0}}/>}
      </button>
      {expandedIdx===idx&&<div style={{padding:'0 13px 13px'}}>
        {result.error
          ?<p style={{fontSize:'0.8rem',color:'#f87171',margin:0}}>Could not generate: {result.error}</p>
          :<><QSection title="Technical" color="#60a5fa" items={result.questions?.technical}/>
             <QSection title="Behavioral" color="var(--accent)" items={result.questions?.behavioral}/>
             <QSection title="Situational" color="#fbbf24" items={result.questions?.situational}/></>
        }
      </div>}
    </div>)}
  </div>;
}

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
    {open&&<div className="fte-backdrop" onClick={onClose}/>}
    <div className={`fte-sidebar${open?' open':''}`}>
      <div className="fte-sidebar-header">
        <div><div className="fte-sidebar-title">Session History</div><div className="fte-sidebar-sub">Click a session to view</div></div>
        <button className="fte-icon-btn" onClick={onClose}><X style={{width:15,height:15}}/></button>
      </div>
      <div className="fte-sidebar-list">
        {loading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'48px 0',gap:8,color:'var(--text-3)',fontSize:'0.82rem',fontWeight:500}}><Loader2 style={{width:15,height:15}} className="fte-spin"/>Loading...</div>}
        {!loading&&history.length===0&&<div className="fte-sidebar-empty">
          <Clock style={{width:28,height:28,color:'var(--text-3)'}}/>
          <p>No history yet</p><small>Complete your first session!</small>
        </div>}
        {!loading&&history.map((s,idx)=><div key={idx} className="fte-session-card fte-session-card-clickable" onClick={()=>handleOpen(s)}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
            <div style={{minWidth:0}}>
              <div className="fte-session-role">{s.role||'Unknown Role'}</div>
              <div className="fte-session-loc"><MapPin style={{width:10,height:10}}/>{s.location||'—'}</div>
            </div>
            <span className={`fte-session-badge ${s.sentCount>0?'sent':'none'}`}>
              {loadingKey===s.key?<Loader2 style={{width:10,height:10}} className="fte-spin"/>:s.sentCount>0?`${s.sentCount} sent`:'No sends'}
            </span>
          </div>
          <div style={{display:'flex',gap:12,fontSize:'0.7rem',color:'var(--text-3)',fontWeight:500,marginBottom:8}}>
            <span style={{display:'flex',alignItems:'center',gap:3}}><FileText style={{width:10,height:10}}/>{s.cvCount||0} CVs</span>
            <span style={{display:'flex',alignItems:'center',gap:3}}><Mail style={{width:10,height:10}}/>{s.emailCount||0} emails</span>
          </div>
          {s.companies?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{s.companies.slice(0,3).map((c,i)=><span key={i} className="fte-company-chip">{c}</span>)}{s.companies.length>3&&<span style={{fontSize:'0.65rem',color:'var(--text-accent)',fontWeight:600}}>+{s.companies.length-3}</span>}</div>}
          <div className="fte-session-meta"><Clock style={{width:10,height:10}}/>{fmt(s.completedAt)}</div>
        </div>)}
      </div>
    </div>
  </>;
}

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
    {open&&<div className="fte-backdrop" onClick={onClose}/>}
    <div className={`fte-profile${open?' open':''}`}>
      <div className="fte-profile-header">
        <div className="fte-profile-title">My Profile</div>
        <button className="fte-icon-btn" onClick={onClose}><X style={{width:15,height:15}}/></button>
      </div>
      <div className="fte-profile-body">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="fte-profile-avatar">{initials}</div>
          <div>
            <p className="fte-profile-name">{user?.name||'—'}</p>
            <p className="fte-profile-email">{user?.email}</p>
            {memberSince&&<p style={{fontSize:'0.68rem',color:'var(--text-accent)',fontWeight:600,marginTop:4}}>Member since {memberSince}</p>}
          </div>
        </div>
        <div className="fte-profile-section">
          <div className="fte-profile-section-hdr"><User style={{width:14,height:14,color:'var(--accent)'}}/><span className="fte-profile-section-title">Personal Info</span></div>
          <div className="fte-profile-section-body">
            <div>
              <label className="fte-profile-label">Full Name</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Apna naam likhein" className="fte-profile-input"/>
            </div>
            <div>
              <label className="fte-profile-label">Email</label>
              <input type="email" value={user?.email||''} disabled className="fte-profile-input"/>
            </div>
            <button onClick={saveName} disabled={nameLoading||!name.trim()||name.trim()===user?.name} className="fte-profile-save">
              {nameLoading?<><Loader2 style={{width:13,height:13}} className="fte-spin"/>Saving...</>:<><Save style={{width:13,height:13}}/>Save Name</>}
            </button>
          </div>
        </div>
        <div className="fte-profile-section">
          <div className="fte-profile-section-hdr"><Key style={{width:14,height:14,color:'var(--accent)'}}/><span className="fte-profile-section-title">Change Password</span></div>
          <div className="fte-profile-section-body">
            <div>
              <label className="fte-profile-label">Current Password</label>
              <div className="fte-pw-wrap">
                <input type={showCur?'text':'password'} value={curPw} onChange={e=>setCurPw(e.target.value)} placeholder="Purana password" className="fte-profile-input" style={{paddingRight:36}}/>
                <button type="button" className="fte-pw-eye" onClick={()=>setShowCur(s=>!s)}><Shield style={{width:13,height:13}}/></button>
              </div>
            </div>
            <div>
              <label className="fte-profile-label">New Password</label>
              <div className="fte-pw-wrap">
                <input type={showNew?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Naya password (min 6)" className="fte-profile-input" style={{paddingRight:36}}/>
                <button type="button" className="fte-pw-eye" onClick={()=>setShowNew(s=>!s)}><Shield style={{width:13,height:13}}/></button>
              </div>
            </div>
            <button onClick={savePw} disabled={pwLoading||!curPw||!newPw} className="fte-profile-save">
              {pwLoading?<><Loader2 style={{width:13,height:13}} className="fte-spin"/>Updating...</>:<><Key style={{width:13,height:13}}/>Update Password</>}
            </button>
          </div>
        </div>
        <button className="fte-profile-logout" onClick={onLogout}><LogOut style={{width:14,height:14}}/> Logout</button>
      </div>
    </div>
  </>;
}

// ─── Main FTE Chat ─────────────────────────────────────────────────────────────
export default function FTEChat() {
  const {user,logout,updateUser}=useAuth();
  const [mode,setMode]=useState('fte');

  const [messages,setMessages]=useState([]);
  const [currentState,setCurrentState]=useState('waiting_cv');
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

  const messagesEndRef=useRef(null);const fileInputRef=useRef(null);const pollingRef=useRef(null);const textareaRef=useRef(null);

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

  useEffect(()=>{
    fteApi.getState().then(res=>{const s=res.data;setCurrentState(s.state||'waiting_cv');
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
      if(s.state===currentState){if(s.error){setCurrentState('cv_uploaded');addBotMessage('text',`Masla aaya: ${s.error}\n\n**New Chat** button se dobara try karein.`);}return;}
      setCurrentState(s.state);
      if(s.error&&!ASYNC_STATES.has(s.state)){addBotMessage('text',`${s.error}\n\nRole ya city change karke **New Chat** se dobara try karein.`);return;}
      if(s.state==='generating_cvs') addBotMessage('status',`${s.jobs?.length||0} jobs mili! Tailored CVs bana raha hoon...`);
      else if(s.state==='cv_review'&&s.cvResults?.length) addBotMessage('cv_approval',`${s.cvResults.length} tailored CVs tayyar!`,{cvResults:s.cvResults,cvReviewApprovalId:s.cvReviewApprovalId});
      else if(s.state==='finding_emails') addBotMessage('status','CVs approved! HR emails dhundh raha hoon...');
      else if(s.state==='email_review'){const v=(s.emailDrafts||[]).filter(d=>d.hrEmail);addBotMessage('email_approval',`${v.length} email drafts tayyar!`,{emailDrafts:s.emailDrafts||[],emailReviewApprovalId:s.emailReviewApprovalId});}
      else if(s.state==='done'&&currentState==='preparing_interview'&&s.prepResults?.length) addBotMessage('prep_questions','Interview prep tayyar!',{prepResults:s.prepResults});
      else if(s.state==='done') addBotMessage('result','Applications send ho gayi!',{sendResults:s.sendResults});
      else if(s.state==='preparing_interview') addBotMessage('status','Interview questions generate ho rahi hain...');
    }catch{}},2500);
    return()=>{if(pollingRef.current)clearInterval(pollingRef.current);};
  },[currentState,addBotMessage]);

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
    }catch(err){addBotMessage('text',`Masla aaya: ${err.response?.data?.error||err.message}`);}
    finally{setSending(false);}
  };

  const handleKeyDown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}};
  const handleNewChat=async()=>{try{await fteApi.reset();setMessages([]);setCurrentState('waiting_cv');setTimeout(()=>addBotMessage('text','Nayi chat shuru! Apni **CV (PDF)** upload karein.'),50);}catch{toast.error('Reset fail ho gaya');}};
  const handleApproveCVs=async(id)=>{setApprovalLoading(true);try{await fteApi.approveCVs(id);setCurrentState('finding_emails');addBotMessage('status','CVs approved! HR emails dhundh raha hoon...');}catch(err){toast.error(err.response?.data?.error||'Approve fail ho gaya');}finally{setApprovalLoading(false);}};
  const handleSendEmails=async(id,drafts)=>{setApprovalLoading(true);try{await fteApi.approveEmails(id,drafts);setCurrentState('sending');addBotMessage('status','Emails bhej raha hoon...');}catch(err){toast.error(err.response?.data?.error||'Send fail ho gaya');}finally{setApprovalLoading(false);}};
  const handleReject=async()=>{try{await fteApi.reset();setCurrentState('waiting_cv');addBotMessage('text','Cancel ho gaya. Dobara shuru karne ke liye CV upload karein.');}catch{toast.error('Cancel fail ho gaya');}};
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
      await fteApi.reset();setMessages([]);setCurrentState('waiting_cv');
      setTimeout(()=>{
        addBotMessage('text','Fresh start! Please upload your **CV (PDF)** to begin.');
        if(role&&location) setTimeout(()=>addBotMessage('text',`_Last session: **${role}** in **${location}**. After uploading your CV, I will search again!_`),300);
      },50);
    }catch{toast.error('Reset failed');}
  },[viewingHistory,addBotMessage]);

  const isDisabled=mode==='ollama'?(ollamaSending||!!viewingHistory):(sending||ASYNC_STATES.has(currentState)||!!viewingHistory);
  const meta=STATE_META[currentState]||STATE_META.waiting_cv;
  const isPulse=mode==='fte'&&ASYNC_STATES.has(currentState);

  return <>
    <style>{STYLES}</style>
    <div className="fte-root">
      <HistorySidebar open={historyOpen} onClose={()=>setHistoryOpen(false)} onLoad={handleLoadHistory}/>
      <ProfilePanel open={profileOpen} onClose={()=>setProfileOpen(false)} user={user} onUpdateUser={updateUser} onLogout={logout}/>

      {/* ── HEADER ── */}
      <header className="fte-header">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="fte-icon-btn" onClick={()=>setHistoryOpen(true)} title="Session history"><PanelLeft style={{width:16,height:16}}/></button>
          <div className="fte-brand-icon"><Zap style={{width:17,height:17,color:'white'}}/></div>
          <div>
            <div className="fte-brand-name">Talvion AI</div>
            {mode==='fte'&&<div className="fte-brand-sub">
              <span style={{width:6,height:6,borderRadius:'50%',background:meta.dot,display:'inline-block',flexShrink:0,boxShadow:`0 0 6px ${meta.dot}55`}} className={isPulse?'fte-pulse-dot':''}/>
              {meta.label}
            </div>}
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="fte-mode-toggle">
            <button className={`fte-mode-btn${mode==='fte'?' active':''}`} onClick={()=>setMode('fte')}>
              <Zap style={{width:11,height:11}}/>Talvion AI
            </button>
            <button className={`fte-mode-btn${mode==='ollama'?' active':''}`} onClick={()=>setMode('ollama')}>
              <span className={`fte-ollama-dot${ollamaOnline===true?' online':ollamaOnline===false?' offline':' checking'}`}/>
              Llama3 Local
            </button>
          </div>
          {mode==='fte'&&<button className="fte-header-btn" onClick={handleNewChat}><Plus style={{width:12,height:12}}/>New Chat</button>}
          <button className="fte-avatar-btn" onClick={()=>setProfileOpen(true)} title={user?.name||user?.email}>
            {(user?.name||user?.email||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </button>
        </div>
      </header>

      {/* ── SUB-BARS ── */}
      {mode==='ollama'&&ollamaOnline&&ollamaModels.length>0&&(
        <div className="fte-model-bar">
          <span className="fte-model-bar-label">Model:</span>
          <select className="fte-model-select" value={ollamaSelectedModel} onChange={e=>setOllamaSelectedModel(e.target.value)}>
            {ollamaModels.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{fontSize:'0.65rem',color:'var(--text-3)',fontWeight:500,marginLeft:4}}>running locally</span>
        </div>
      )}
      {viewingHistory&&(
        <div className="fte-history-banner">
          <span className="fte-history-banner-text">📂 {viewingHistory.role||'Session'}{viewingHistory.location?` · ${viewingHistory.location}`:''}</span>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <button className="fte-history-banner-btn" onClick={handleRestartFromHistory}>↩ New Search</button>
            <button className="fte-history-banner-btn" onClick={handleExitHistory}>← Back</button>
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <div className="fte-messages">
        <div className="fte-messages-inner">
          {mode==='ollama'?(
            <>
              {ollamaMessages.length===0&&(
                <div className="fte-ollama-empty">
                  <div className="fte-ollama-empty-icon"><Brain style={{width:30,height:30,color:'white'}}/></div>
                  <h2>Llama3 Local</h2>
                  <p>{ollamaOnline===false?'Ollama is not running on this machine':'Chat with your local Llama3 model — no internet needed'}</p>
                  {ollamaOnline===false&&<div className="fte-ollama-offline-note">Run: <code>ollama serve</code> then: <code>ollama pull llama3</code></div>}
                  {ollamaOnline===null&&<p style={{marginTop:10,fontSize:'0.76rem',color:'var(--text-3)'}}>Checking connection...</p>}
                </div>
              )}
              {ollamaMessages.map((msg,idx)=>
                msg.role==='user'
                  ?<UserMessage key={idx}>{msg.content}</UserMessage>
                  :<div key={idx} className="fte-ollama-bot-row">
                    <div className="fte-ollama-icon"><Brain style={{width:16,height:16,color:'white'}}/></div>
                    <div className="fte-ollama-bot-bubble"><BotText text={msg.content}/></div>
                  </div>
              )}
              {ollamaSending&&<div className="fte-ollama-bot-row"><div className="fte-ollama-icon"><Brain style={{width:16,height:16,color:'white'}}/></div><div className="fte-ollama-bot-bubble"><TypingDots/></div></div>}
            </>
          ):viewingHistory?(
            historyMessages.length===0
              ?<div className="fte-empty"><div className="fte-empty-icon"><Bot style={{width:30,height:30,color:'white'}}/></div><h2>No messages</h2><p>This session has no saved conversation.</p></div>
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
              {messages.length===0&&<div className="fte-empty">
                <div className="fte-empty-icon"><Zap style={{width:28,height:28,color:'white'}}/></div>
                <h2>Talvion AI</h2>
                <p>Your AI-powered job application engine — from CV to offer, fully automated</p>
                <div className="fte-empty-steps">
                  {[['1','Upload your CV'],['2','Tell role & city'],['3','AI finds jobs'],['4','Tailored CVs'],['5','HR emails found'],['6','Applications sent']].map(([n,t])=>
                    <div key={n} className="fte-empty-step">
                      <div className="fte-empty-step-num">{n}</div>
                      <span className="fte-empty-step-text">{t}</span>
                    </div>
                  )}
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
      <div className="fte-input-area">
        <div className="fte-input-inner">
          {cvFile&&<div className="fte-cv-preview">
            <FileText style={{width:13,height:13,color:'var(--accent)',flexShrink:0}}/>
            <span>{cvFile.name}</span>
            <button onClick={()=>{setCvFile(null);if(fileInputRef.current)fileInputRef.current.value='';}} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',flexShrink:0,padding:0}}><X style={{width:12,height:12}}/></button>
          </div>}
          <div className="fte-input-row">
            <input ref={fileInputRef} type="file" accept=".pdf" style={{display:'none'}} onChange={handleFileChange}/>
            {mode==='fte'&&<button onClick={()=>fileInputRef.current?.click()} disabled={isDisabled} className={`fte-attach-btn ${currentState==='waiting_cv'?'pulse':'idle'}`}><Paperclip style={{width:16,height:16}}/></button>}
            <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isDisabled} className="fte-textarea" rows={1}
              placeholder={
                mode==='ollama'
                  ?(ollamaOnline===false?'Ollama not running — start with "ollama serve"':ollamaSending?'Llama3 soch raha hai...':'Kuch bhi pucho Llama3 se...')
                  :viewingHistory?'Viewing history — click "Back" to resume'
                  :currentState==='waiting_cv'?'CV upload karein ya yahan likhein...'
                  :currentState==='cv_uploaded'||currentState==='asking_location'?'Role aur city likhein — e.g. "Software Engineer Karachi"'
                  :ASYNC_STATES.has(currentState)?'Kaam ho raha hai, thodi der wait karein...'
                  :'Yahan likhein... (Enter = send, Shift+Enter = newline)'
              }/>
            <button onClick={handleSend} disabled={isDisabled||(!input.trim()&&(mode==='ollama'||!cvFile))} className="fte-send-btn">
              {(mode==='ollama'?ollamaSending:sending)?<Loader2 style={{width:16,height:16}} className="fte-spin"/>:<Send style={{width:16,height:16}}/>}
            </button>
          </div>
          <p className="fte-input-hint">{mode==='ollama'?'Llama3 runs locally — no data sent to cloud':'CV → Role + City → Jobs → CVs → Approve → Emails → Send'}</p>
        </div>
      </div>
    </div>
  </>;
}