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
  User, Key, Save, Edit3, Shield,
} from 'lucide-react';

const ASYNC_STATES = new Set(['searching', 'generating_cvs', 'finding_emails', 'sending']);

const STATE_META = {
  waiting_cv:     { label: 'Upload CV',               color: '#b2d9c5', dot: '#c8e8d8' },
  cv_uploaded:    { label: 'Ready',                   color: '#10b981', dot: '#10b981' },
  ready:          { label: 'Ready',                   color: '#10b981', dot: '#10b981' },
  asking_location:{ label: 'Enter City',              color: '#3b82f6', dot: '#3b82f6' },
  searching:      { label: 'Searching Jobs...',       color: '#f59e0b', dot: '#f59e0b' },
  generating_cvs: { label: 'Generating CVs...',       color: '#f59e0b', dot: '#f59e0b' },
  cv_review:      { label: 'Review CVs',              color: '#8b5cf6', dot: '#8b5cf6' },
  finding_emails: { label: 'Finding HR Emails...',    color: '#f59e0b', dot: '#f59e0b' },
  email_review:   { label: 'Review Emails',           color: '#f97316', dot: '#f97316' },
  sending:        { label: 'Sending Applications...', color: '#f59e0b', dot: '#f59e0b' },
  done:           { label: 'Complete',                color: '#10b981', dot: '#10b981' },
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .fte-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
  .fte-root { height: 100vh; display: flex; flex-direction: column; background: #f7fdf9; overflow: hidden; }

  /* Header */
  .fte-header { background: #fff; border-bottom: 1px solid #e6f4ee; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; box-shadow: 0 1px 8px rgba(16,185,129,0.06); }
  .fte-brand-icon { width: 34px; height: 34px; background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(16,185,129,0.25); }
  .fte-brand-name { color: #071a10; font-weight: 800; font-size: 0.9rem; }

  .fte-header-btn { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; background: #f0faf5; border: 1px solid #c8e8d8; color: #2a5c41; border-radius: 10px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; font-family: inherit; }
  .fte-header-btn:hover { background: #e8f7ef; color: #0d7a56; }
  .fte-icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: none; border: none; cursor: pointer; color: #7dba9a; transition: all 0.2s; }
  .fte-icon-btn:hover { background: #f0faf5; color: #1a5c3a; }
  .fte-icon-btn.logout:hover { background: #fef2f2; color: #ef4444; }

  /* Messages */
  .fte-messages { flex: 1; overflow-y: auto; padding: 20px 16px; background: #f7fdf9; scrollbar-width: thin; scrollbar-color: #c8e8d8 transparent; }
  .fte-messages::-webkit-scrollbar { width: 4px; }
  .fte-messages::-webkit-scrollbar-thumb { background: #c8e8d8; border-radius: 4px; }
  .fte-messages-inner { max-width: 680px; margin: 0 auto; }

  /* Dots */
  .fte-dot { width: 7px; height: 7px; border-radius: 50%; background: #7dba9a; animation: fteBounce 0.9s infinite; }
  @keyframes fteBounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }

  /* Bot bubble */
  .fte-bot-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 18px; }
  .fte-bot-icon { width: 32px; height: 32px; flex-shrink: 0; background: #e8f7ef; border: 1px solid #c8e8d8; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
  .fte-bot-bubble { background: #fff; border: 1px solid #e6f4ee; border-radius: 16px 16px 16px 4px; padding: 12px 16px; max-width: 85%; color: #0f2d1e; font-weight: 500; box-shadow: 0 1px 6px rgba(16,185,129,0.06); }

  /* User bubble */
  .fte-user-row { display: flex; justify-content: flex-end; margin-bottom: 18px; }
  .fte-user-bubble { background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 16px 16px 4px 16px; padding: 10px 16px; max-width: 80%; color: white; font-size: 0.875rem; font-weight: 600; line-height: 1.55; box-shadow: 0 2px 10px rgba(16,185,129,0.22); }

  /* Status */
  .fte-status-row { display: flex; justify-content: center; margin-bottom: 18px; }
  .fte-status-pill { background: #fffbeb; border: 1px solid #fde68a; color: #78350f; border-radius: 20px; padding: 6px 16px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }

  /* Bot text */
  .fte-text { font-size: 0.875rem; line-height: 1.65; }
  .fte-text p { margin: 0; color: #0f2d1e; font-weight: 500; }
  .fte-text p + p { margin-top: 4px; }
  .fte-text strong { color: #071a10; font-weight: 800; }
  .fte-text em { color: #4d9a6a; font-style: normal; font-size: 0.8rem; font-weight: 600; }

  /* Empty state */
  .fte-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 240px; text-align: center; padding: 40px 0; }
  .fte-empty-icon { width: 64px; height: 64px; background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 6px 20px rgba(16,185,129,0.25); }
  .fte-empty h2 { color: #071a10; font-size: 1.3rem; font-weight: 800; margin: 0 0 6px; }
  .fte-empty p { color: #3a7055; font-size: 0.85rem; font-weight: 500; max-width: 280px; margin: 0; }

  /* Input */
  .fte-input-area { background: #fff; border-top: 1px solid #e6f4ee; padding: 12px 16px; flex-shrink: 0; }
  .fte-input-inner { max-width: 680px; margin: 0 auto; }
  .fte-cv-preview { display: flex; align-items: center; gap: 8px; background: #f0faf5; border: 1px solid #c8e8d8; border-radius: 10px; padding: 6px 12px; margin-bottom: 8px; }
  .fte-cv-preview span { font-size: 0.75rem; color: #0d7a56; font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fte-input-row { display: flex; align-items: flex-end; gap: 8px; }

  .fte-attach-btn { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; flex-shrink: 0; transition: all 0.2s; }
  .fte-attach-btn.pulse { background: linear-gradient(135deg,#10b981,#0d9488); color: white; box-shadow: 0 2px 10px rgba(16,185,129,0.28); animation: ftePulse 2s infinite; }
  @keyframes ftePulse { 0%,100% { box-shadow: 0 2px 10px rgba(16,185,129,0.28); } 50% { box-shadow: 0 2px 20px rgba(16,185,129,0.45); } }
  .fte-attach-btn.idle { background: #f0faf5; border: 1px solid #c8e8d8; color: #4d9a6a; }
  .fte-attach-btn.idle:hover { background: #e8f7ef; color: #10b981; }
  .fte-attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .fte-textarea { flex: 1; background: #f7fdf9; border: 1px solid #c8e8d8; border-radius: 12px; padding: 10px 14px; font-size: 0.875rem; font-weight: 500; color: #071a10; resize: none; outline: none; font-family: inherit; min-height: 42px; max-height: 128px; transition: all 0.2s; }
  .fte-textarea::placeholder { color: #7dba9a; font-weight: 400; }
  .fte-textarea:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
  .fte-textarea:disabled { opacity: 0.5; background: #f0faf5; }

  .fte-send-btn { width: 40px; height: 40px; background: linear-gradient(135deg,#10b981,#0d9488); border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; box-shadow: 0 2px 10px rgba(16,185,129,0.25); transition: all 0.2s; }
  .fte-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.35); }
  .fte-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .fte-input-hint { text-align: center; font-size: 0.68rem; color: #7dba9a; font-weight: 600; margin-top: 8px; }

  /* Sidebar */
  .fte-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.25); z-index: 20; backdrop-filter: blur(2px); }
  .fte-sidebar { position: fixed; top: 0; left: 0; height: 100%; width: 280px; background: #fff; border-right: 1px solid #e6f4ee; z-index: 30; display: flex; flex-direction: column; transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow: 4px 0 24px rgba(16,185,129,0.08); }
  .fte-sidebar.open { transform: translateX(0); }
  .fte-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e6f4ee; }
  .fte-sidebar-title { color: #071a10; font-weight: 800; font-size: 0.875rem; }
  .fte-sidebar-sub { color: #4d9a6a; font-size: 0.7rem; font-weight: 500; margin-top: 2px; }
  .fte-sidebar-list { flex: 1; overflow-y: auto; padding: 10px; scrollbar-width: thin; }
  .fte-session-card { border: 1px solid #e6f4ee; border-radius: 12px; padding: 12px; background: #f7fdf9; margin-bottom: 8px; transition: background 0.15s; }
  .fte-session-card:hover { background: #f0faf5; }
  .fte-session-role { color: #071a10; font-weight: 800; font-size: 0.8rem; }
  .fte-session-loc { color: #3a7055; font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  .fte-session-badge { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
  .fte-session-badge.sent { background: #e8f7ef; color: #0d7a56; border: 1px solid #c8e8d8; }
  .fte-session-badge.none { background: #f3f4f6; color: #6b7280; }
  .fte-session-meta { color: #3a7055; font-size: 0.68rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 8px; }
  .fte-company-chip { font-size: 0.65rem; background: #f0faf5; border: 1px solid #c8e8d8; color: #1a5c3a; font-weight: 700; border-radius: 6px; padding: 1px 7px; }
  .fte-sidebar-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; text-align: center; }
  .fte-sidebar-empty p { color: #4d9a6a; font-size: 0.8rem; font-weight: 600; margin: 8px 0 2px; }
  .fte-sidebar-empty small { color: #7dba9a; font-size: 0.7rem; font-weight: 500; }

  /* Cards shared */
  .fte-card { border: 1px solid #e6f4ee; border-radius: 12px; overflow: hidden; background: #fff; margin-bottom: 8px; box-shadow: 0 1px 4px rgba(16,185,129,0.05); }
  .fte-card-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: none; border: none; cursor: pointer; text-align: left; gap: 10px; transition: background 0.15s; font-family: inherit; }
  .fte-card-btn:hover { background: #f7fdf9; }
  .fte-card-title { color: #071a10; font-weight: 800; font-size: 0.82rem; }
  .fte-card-meta { color: #3a7055; font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 2px; flex-wrap: wrap; }
  .fte-card-expand { border-top: 1px solid #e6f4ee; background: #f7fdf9; padding: 12px 14px; }

  .fte-section-label { font-size: 0.65rem; font-weight: 800; color: #1a7a4a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .fte-skill-chip { font-size: 0.68rem; font-weight: 700; background: #e8f7ef; border: 1px solid #c8e8d8; color: #0d5c3a; border-radius: 6px; padding: 2px 8px; }
  .fte-exp-item { padding-left: 10px; border-left: 2px solid #c8e8d8; margin-bottom: 8px; }
  .fte-exp-title { color: #0f2d1e; font-size: 0.78rem; font-weight: 700; }
  .fte-exp-date { color: #3a7055; font-size: 0.7rem; font-weight: 600; }
  .fte-rec-item { display: flex; align-items: flex-start; gap: 5px; font-size: 0.75rem; font-weight: 500; color: #2a6048; margin-bottom: 4px; }

  .fte-job-link { color: #0d7a56; font-size: 0.68rem; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; margin-top: 3px; text-decoration: none; }
  .fte-job-link:hover { color: #0d9488; }
  .fte-failed-badge { font-size: 0.65rem; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-weight: 700; padding: 1px 8px; border-radius: 20px; }

  .fte-ats-score { font-size: 1.15rem; font-weight: 800; line-height: 1; }
  .fte-ats-label { font-size: 0.62rem; font-weight: 700; color: #3a7055; margin-top: 1px; text-align: center; }

  /* Buttons */
  .fte-approve-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg,#10b981,#0d9488); color: white; font-weight: 800; font-size: 0.82rem; border: none; border-radius: 12px; padding: 10px 14px; cursor: pointer; font-family: inherit; box-shadow: 0 2px 10px rgba(16,185,129,0.22); transition: all 0.2s; }
  .fte-approve-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.32); }
  .fte-approve-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .fte-send-email-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg,#3b82f6,#6366f1); color: white; font-weight: 800; font-size: 0.82rem; border: none; border-radius: 12px; padding: 10px 14px; cursor: pointer; font-family: inherit; box-shadow: 0 2px 10px rgba(99,102,241,0.2); transition: all 0.2s; }
  .fte-send-email-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .fte-send-email-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .fte-cancel-btn { display: flex; align-items: center; gap: 5px; padding: 10px 14px; background: #fff; border: 1px solid #fecaca; color: #dc2626; font-weight: 700; font-size: 0.8rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; font-family: inherit; }
  .fte-cancel-btn:hover:not(:disabled) { background: #fef2f2; }
  .fte-cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Draft inputs */
  .fte-draft-label { font-size: 0.65rem; font-weight: 800; color: #1a7a4a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .fte-draft-input { width: 100%; background: #fff; border: 1px solid #c8e8d8; border-radius: 8px; padding: 8px 12px; font-size: 0.8rem; font-weight: 500; color: #071a10; outline: none; font-family: inherit; transition: all 0.2s; }
  .fte-draft-input::placeholder { color: #7dba9a; }
  .fte-draft-input:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.1); }

  /* Results */
  .fte-result-ok { display: flex; align-items: center; justify-content: space-between; background: #f0faf5; border: 1px solid #c8e8d8; border-radius: 10px; padding: 8px 12px; font-size: 0.75rem; margin-bottom: 6px; }
  .fte-result-fail { display: flex; align-items: center; justify-content: space-between; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 8px 12px; font-size: 0.75rem; margin-bottom: 6px; }
  .fte-result-company { color: #071a10; font-weight: 800; }
  .fte-result-detail { color: #3a7055; font-size: 0.68rem; font-weight: 600; }

  .fte-new-chat-link { display: inline-flex; align-items: center; gap: 5px; color: #0d7a56; font-size: 0.78rem; font-weight: 800; background: none; border: none; cursor: pointer; margin-top: 14px; padding: 0; font-family: inherit; transition: color 0.2s; }
  .fte-new-chat-link:hover { color: #0d9488; }

  .fte-approve-label { color: #071a10; font-weight: 800; font-size: 0.85rem; }

  .fte-spin { animation: fteSpin 1s linear infinite; }
  @keyframes fteSpin { to { transform: rotate(360deg); } }
  .fte-pulse-dot { animation: fteDotPulse 1.5s infinite; }
  @keyframes fteDotPulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }

  .fte-thinking { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e6f4ee; border-radius: 14px; padding: 10px 14px; width: fit-content; box-shadow: 0 1px 4px rgba(16,185,129,0.06); }
  .fte-thinking span { font-size: 0.8rem; font-weight: 600; color: #2a6048; }

  /* User avatar button in header */
  .fte-avatar-btn { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg,#10b981,#0d9488); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.72rem; font-weight: 800; font-family: inherit; box-shadow: 0 2px 8px rgba(16,185,129,0.25); transition: all 0.2s; flex-shrink: 0; }
  .fte-avatar-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,0.35); }

  /* Profile panel (slides from right) */
  .fte-profile { position: fixed; top: 0; right: 0; height: 100%; width: 320px; background: #fff; border-left: 1px solid #e6f4ee; z-index: 30; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow: -4px 0 24px rgba(16,185,129,0.08); }
  .fte-profile.open { transform: translateX(0); }
  .fte-profile-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e6f4ee; }
  .fte-profile-title { color: #071a10; font-weight: 800; font-size: 0.875rem; }
  .fte-profile-body { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; }

  /* Avatar circle */
  .fte-profile-avatar { width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg,#10b981,#0d9488); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: 800; box-shadow: 0 4px 16px rgba(16,185,129,0.3); flex-shrink: 0; }
  .fte-profile-name { color: #071a10; font-size: 1.05rem; font-weight: 800; margin: 0; }
  .fte-profile-email { color: #3a7055; font-size: 0.78rem; font-weight: 600; margin: 2px 0 0; }

  /* Section */
  .fte-profile-section { border: 1px solid #e6f4ee; border-radius: 14px; overflow: hidden; }
  .fte-profile-section-hdr { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #f7fdf9; border-bottom: 1px solid #e6f4ee; }
  .fte-profile-section-title { color: #071a10; font-weight: 800; font-size: 0.8rem; }
  .fte-profile-section-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

  /* Profile input */
  .fte-profile-label { display: block; font-size: 0.65rem; font-weight: 800; color: #4d9a6a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
  .fte-profile-input { width: 100%; background: #f7fdf9; border: 1px solid #c8e8d8; border-radius: 10px; padding: 9px 12px; font-size: 0.82rem; font-weight: 500; color: #071a10; outline: none; font-family: inherit; transition: all 0.2s; }
  .fte-profile-input::placeholder { color: #7dba9a; font-weight: 400; }
  .fte-profile-input:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
  .fte-profile-input:disabled { background: #f0faf5; color: #4d9a6a; cursor: default; }

  /* Profile save btn */
  .fte-profile-save { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: linear-gradient(135deg,#10b981,#0d9488); color: white; font-weight: 800; font-size: 0.82rem; border: none; border-radius: 10px; padding: 10px; cursor: pointer; font-family: inherit; box-shadow: 0 2px 10px rgba(16,185,129,0.22); transition: all 0.2s; }
  .fte-profile-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.32); }
  .fte-profile-save:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Logout */
  .fte-profile-logout { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: #fff; color: #dc2626; font-weight: 800; font-size: 0.82rem; border: 1px solid #fecaca; border-radius: 10px; padding: 10px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
  .fte-profile-logout:hover { background: #fef2f2; }

  /* Password toggle */
  .fte-pw-wrap { position: relative; }
  .fte-pw-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #7dba9a; padding: 0; }
  .fte-pw-eye:hover { color: #10b981; }
`;

function TypingDots() {
  return <div style={{display:'flex',gap:5,alignItems:'center',padding:'4px 2px'}}>{[0,1,2].map(i=><div key={i} className="fte-dot" style={{animationDelay:`${i*0.18}s`}}/>)}</div>;
}
function BotMessage({children,isLoading}) {
  return <div className="fte-bot-row"><div className="fte-bot-icon"><Bot style={{width:16,height:16,color:'#10b981'}}/></div><div className="fte-bot-bubble">{isLoading?<TypingDots/>:children}</div></div>;
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
  if(score===null||score===undefined) return <div style={{textAlign:'center',minWidth:42}}><p style={{color:'#3a7055',fontSize:'0.7rem',fontWeight:700}}>N/A</p><p style={{color:'#3a7055',fontSize:'0.62rem',fontWeight:600}}>ATS</p></div>;
  const color=score>=80?'#059669':score>=60?'#d97706':'#dc2626';
  return <div style={{textAlign:'center',minWidth:42}}><p className="fte-ats-score" style={{color}}>{score}%</p><p className="fte-ats-label">ATS</p></div>;
}

function CVApprovalCards({cvResults,approvalId,onApprove,onReject,loading}) {
  const [expanded,setExpanded]=useState(null);
  const valid=cvResults.filter(r=>!r.error);
  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><FileText style={{width:15,height:15,color:'#8b5cf6'}}/><p className="fte-approve-label">{valid.length} tailored CV{valid.length!==1?'s':''} ready</p></div>
    <div style={{marginBottom:12}}>{cvResults.map((result,idx)=>{
      const score=result.atsScore?.overall??result.atsScore?.format??null;
      const cv=result.cv||{};const isOpen=expanded===idx;
      return <div key={idx} className="fte-card">
        <button className="fte-card-btn" onClick={()=>setExpanded(isOpen?null:idx)}>
          <div style={{flex:1,minWidth:0}}>
            <p className="fte-card-title">{result.job?.title||'Unknown Role'}</p>
            <div className="fte-card-meta"><Building2 style={{width:11,height:11}}/><span>{result.job?.company}</span>{result.job?.location&&<><MapPin style={{width:11,height:11}}/><span>{result.job.location}</span></>}</div>
            {result.job?.sourceUrl&&<a href={result.job.sourceUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="fte-job-link">View job <ExternalLink style={{width:10,height:10}}/></a>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            {result.error?<span className="fte-failed-badge">Failed</span>:<ATSScore score={score}/>}
            {isOpen?<ChevronUp style={{width:14,height:14,color:'#3a7055'}}/>:<ChevronDown style={{width:14,height:14,color:'#3a7055'}}/>}
          </div>
        </button>
        {isOpen&&<div className="fte-card-expand">
          {result.error?<p style={{color:'#dc2626',fontSize:'0.78rem',fontWeight:600}}>{result.error}</p>:<>
            {(cv.summary||cv.profile||cv.objective||cv.professionalSummary)&&<div style={{marginBottom:10}}><p className="fte-section-label">Professional Summary</p><p style={{color:'#0f2d1e',fontSize:'0.78rem',fontWeight:500,lineHeight:1.6}}>{cv.summary||cv.profile||cv.objective||cv.professionalSummary}</p></div>}
            {cv.skills?.length>0&&<div style={{marginBottom:10}}><p className="fte-section-label">Key Skills</p><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{(Array.isArray(cv.skills)?cv.skills:[]).slice(0,12).map((s,i)=><span key={i} className="fte-skill-chip">{typeof s==='string'?s:s.name||String(s)}</span>)}</div></div>}
            {cv.experience?.length>0&&<div style={{marginBottom:10}}><p className="fte-section-label">Experience</p>{cv.experience.slice(0,2).map((e,i)=><div key={i} className="fte-exp-item"><p className="fte-exp-title">{e.role||e.title||e.position} @ {e.company||e.organization}</p><p className="fte-exp-date">{e.duration||e.period||e.dates||e.date}</p></div>)}</div>}
            {result.recommendations?.length>0&&<div><p className="fte-section-label">Improvements</p>{result.recommendations.slice(0,3).map((rec,i)=><div key={i} className="fte-rec-item"><TrendingUp style={{width:11,height:11,color:'#d97706',flexShrink:0,marginTop:1}}/><span>{rec}</span></div>)}</div>}
          </>}
        </div>}
      </div>;
    })}</div>
    <div style={{display:'flex',gap:8}}>
      <button className="fte-approve-btn" onClick={()=>onApprove(approvalId)} disabled={loading||valid.length===0}>{loading?<><Loader2 style={{width:14,height:14}} className="fte-spin"/>Approving...</>:<><CheckCircle style={{width:14,height:14}}/>Approve {valid.length} CV{valid.length!==1?'s':''}</>}</button>
      <button className="fte-cancel-btn" onClick={()=>onReject()} disabled={loading}><XCircle style={{width:13,height:13}}/>Cancel</button>
    </div>
  </div>;
}

function EmailApprovalCards({emailDrafts,approvalId,onSend,onReject,loading}) {
  const valid=emailDrafts.filter(d=>d.hrEmail&&!d.error);
  const [drafts,setDrafts]=useState(valid.map(d=>({...d})));
  const [expanded,setExpanded]=useState(null);
  const skipped=emailDrafts.filter(d=>!d.hrEmail||d.error);
  const update=(idx,field,val)=>{const u=[...drafts];u[idx]={...u[idx],[field]:val};setDrafts(u);};
  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><Mail style={{width:15,height:15,color:'#f97316'}}/><p className="fte-approve-label">{drafts.length} email draft{drafts.length!==1?'s':''} ready</p></div>
    {skipped.length>0&&<p style={{fontSize:'0.72rem',color:'#3a7055',fontWeight:600,marginBottom:10}}>{skipped.length} companies ki HR email nahi mili — skip hongi</p>}
    <div style={{marginBottom:12}}>{drafts.map((draft,idx)=><div key={idx} className="fte-card">
      <button className="fte-card-btn" onClick={()=>setExpanded(expanded===idx?null:idx)}>
        <div style={{flex:1,minWidth:0}}><p className="fte-card-title">{draft.job?.company}</p><p style={{fontSize:'0.7rem',color:'#3a7055',fontWeight:600,marginTop:2}}>{draft.hrEmail} · {draft.job?.title}</p></div>
        {expanded===idx?<ChevronUp style={{width:14,height:14,color:'#3a7055',flexShrink:0}}/>:<ChevronDown style={{width:14,height:14,color:'#3a7055',flexShrink:0}}/>}
      </button>
      {expanded===idx&&<div className="fte-card-expand" style={{display:'flex',flexDirection:'column',gap:10}}>
        {[{label:'To (HR Email)',key:'hrEmail'},{label:'Subject',key:'subject'}].map(({label,key})=><div key={key}><div className="fte-draft-label">{label}</div><input type="text" value={draft[key]||''} onChange={e=>update(idx,key,e.target.value)} className="fte-draft-input" style={{marginTop:4}}/></div>)}
        <div><div className="fte-draft-label">Email Body</div><textarea value={draft.body||''} onChange={e=>update(idx,'body',e.target.value)} rows={5} className="fte-draft-input" style={{marginTop:4,resize:'none',lineHeight:1.55}}/></div>
      </div>}
    </div>)}</div>
    <div style={{display:'flex',gap:8}}>
      <button className="fte-send-email-btn" onClick={()=>onSend(approvalId,drafts)} disabled={loading||drafts.length===0}>{loading?<><Loader2 style={{width:14,height:14}} className="fte-spin"/>Sending...</>:<><Send style={{width:14,height:14}}/>Send {drafts.length} Application{drafts.length!==1?'s':''}</>}</button>
      <button className="fte-cancel-btn" onClick={()=>onReject()} disabled={loading}><XCircle style={{width:13,height:13}}/>Cancel</button>
    </div>
  </div>;
}

function SendResults({results,onNewChat}) {
  const ok=results.filter(r=>r.success),fail=results.filter(r=>!r.success);
  return <div style={{width:'100%'}}>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
      {ok.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,color:'#059669',fontSize:'0.82rem',fontWeight:800}}><CheckCircle style={{width:14,height:14}}/>{ok.length} sent</span>}
      {fail.length>0&&<span style={{display:'flex',alignItems:'center',gap:5,color:'#dc2626',fontSize:'0.82rem',fontWeight:800}}><XCircle style={{width:14,height:14}}/>{fail.length} failed</span>}
    </div>
    {results.map((r,idx)=><div key={idx} className={r.success?'fte-result-ok':'fte-result-fail'}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>{r.success?<CheckCircle style={{width:12,height:12,color:'#059669',flexShrink:0}}/>:<XCircle style={{width:12,height:12,color:'#dc2626',flexShrink:0}}/>}<span className="fte-result-company">{r.company}</span>{r.jobTitle&&<span className="fte-result-detail">— {r.jobTitle}</span>}</div>
      <span className="fte-result-detail">{r.hrEmail||r.error||''}</span>
    </div>)}
    <button className="fte-new-chat-link" onClick={onNewChat}><Plus style={{width:13,height:13}}/>New Chat shuru karein</button>
  </div>;
}

function HistorySidebar({open,onClose}) {
  const [history,setHistory]=useState([]);const [loading,setLoading]=useState(false);
  useEffect(()=>{if(!open)return;setLoading(true);fteApi.getHistory().then(res=>setHistory(res.data.history||[])).catch(()=>setHistory([])).finally(()=>setLoading(false));},[open]);
  const fmt=(iso)=>{if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('en-PK',{day:'numeric',month:'short'})+' · '+d.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'});};
  return <>
    {open&&<div className="fte-backdrop" onClick={onClose}/>}
    <div className={`fte-sidebar${open?' open':''}`}>
      <div className="fte-sidebar-header">
        <div><div className="fte-sidebar-title">Session History</div><div className="fte-sidebar-sub">Past job application sessions</div></div>
        <button className="fte-icon-btn" onClick={onClose}><X style={{width:15,height:15}}/></button>
      </div>
      <div className="fte-sidebar-list">
        {loading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 0',gap:8,color:'#3a7055',fontSize:'0.82rem',fontWeight:600}}><Loader2 style={{width:15,height:15}} className="fte-spin"/>Loading...</div>}
        {!loading&&history.length===0&&<div className="fte-sidebar-empty"><Clock style={{width:28,height:28,color:'#7dba9a'}}/><p>No history yet</p><small>Complete your first session!</small></div>}
        {!loading&&history.map((s,idx)=><div key={idx} className="fte-session-card">
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
            <div style={{minWidth:0}}><div className="fte-session-role">{s.role||'Unknown Role'}</div><div className="fte-session-loc"><MapPin style={{width:10,height:10}}/>{s.location||'—'}</div></div>
            <span className={`fte-session-badge ${s.sentCount>0?'sent':'none'}`}>{s.sentCount>0?`${s.sentCount} sent`:'No sends'}</span>
          </div>
          <div style={{display:'flex',gap:12,fontSize:'0.7rem',color:'#3a7055',fontWeight:600,marginBottom:8}}>
            <span style={{display:'flex',alignItems:'center',gap:3}}><FileText style={{width:10,height:10}}/>{s.cvCount||0} CVs</span>
            <span style={{display:'flex',alignItems:'center',gap:3}}><Mail style={{width:10,height:10}}/>{s.emailCount||0} emails</span>
          </div>
          {s.companies?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{s.companies.slice(0,3).map((c,i)=><span key={i} className="fte-company-chip">{c}</span>)}{s.companies.length>3&&<span style={{fontSize:'0.65rem',color:'#3a7055',fontWeight:600}}>+{s.companies.length-3}</span>}</div>}
          <div className="fte-session-meta"><Clock style={{width:10,height:10}}/>{fmt(s.completedAt)}</div>
        </div>)}
      </div>
    </div>
  </>;
}

// ─── Profile Panel ────────────────────────────────────────────────────────────
function ProfilePanel({ open, onClose, user, onUpdateUser, onLogout }) {
  const [name, setName]       = useState(user?.name || '');
  const [nameLoading, setNameLoading] = useState(false);

  const [curPw, setCurPw]     = useState('');
  const [newPw, setNewPw]     = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Sync name when user changes
  useEffect(() => { setName(user?.name || ''); }, [user]);

  const initials = (user?.name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const saveName = async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setNameLoading(true);
    try {
      const res = await userAPI.updateProfile({ name: name.trim() });
      onUpdateUser(res.data.user);
      toast.success('Name updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setNameLoading(false); }
  };

  const savePw = async () => {
    if (!curPw || !newPw) { toast.error('Dono fields fill karein'); return; }
    if (newPw.length < 6) { toast.error('New password min 6 characters'); return; }
    setPwLoading(true);
    try {
      await authAPI.updatePassword({ currentPassword: curPw, newPassword: newPw });
      toast.success('Password update ho gaya!');
      setCurPw(''); setNewPw('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password update failed');
    } finally { setPwLoading(false); }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })
    : null;

  return <>
    {open && <div className="fte-backdrop" onClick={onClose} />}
    <div className={`fte-profile${open ? ' open' : ''}`}>
      {/* Header */}
      <div className="fte-profile-header">
        <div className="fte-profile-title">My Profile</div>
        <button className="fte-icon-btn" onClick={onClose}><X style={{width:15,height:15}}/></button>
      </div>

      <div className="fte-profile-body">
        {/* Avatar + info */}
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="fte-profile-avatar">{initials}</div>
          <div>
            <p className="fte-profile-name">{user?.name || '—'}</p>
            <p className="fte-profile-email">{user?.email}</p>
            {memberSince && (
              <p style={{fontSize:'0.68rem',color:'#7dba9a',fontWeight:600,marginTop:3}}>
                Member since {memberSince}
              </p>
            )}
          </div>
        </div>

        {/* Edit Name */}
        <div className="fte-profile-section">
          <div className="fte-profile-section-hdr">
            <User style={{width:14,height:14,color:'#10b981'}}/>
            <span className="fte-profile-section-title">Personal Info</span>
          </div>
          <div className="fte-profile-section-body">
            <div>
              <label className="fte-profile-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Apna naam likhein"
                className="fte-profile-input"
              />
            </div>
            <div>
              <label className="fte-profile-label">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="fte-profile-input"
              />
            </div>
            <button
              onClick={saveName}
              disabled={nameLoading || !name.trim() || name.trim() === user?.name}
              className="fte-profile-save"
            >
              {nameLoading
                ? <><Loader2 style={{width:13,height:13}} className="fte-spin"/>Saving...</>
                : <><Save style={{width:13,height:13}}/>Save Name</>
              }
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="fte-profile-section">
          <div className="fte-profile-section-hdr">
            <Key style={{width:14,height:14,color:'#10b981'}}/>
            <span className="fte-profile-section-title">Change Password</span>
          </div>
          <div className="fte-profile-section-body">
            <div>
              <label className="fte-profile-label">Current Password</label>
              <div className="fte-pw-wrap">
                <input
                  type={showCur ? 'text' : 'password'}
                  value={curPw}
                  onChange={e => setCurPw(e.target.value)}
                  placeholder="Purana password"
                  className="fte-profile-input"
                  style={{paddingRight:36}}
                />
                <button type="button" className="fte-pw-eye" onClick={() => setShowCur(s => !s)}>
                  <Shield style={{width:13,height:13}}/>
                </button>
              </div>
            </div>
            <div>
              <label className="fte-profile-label">New Password</label>
              <div className="fte-pw-wrap">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Naya password (min 6)"
                  className="fte-profile-input"
                  style={{paddingRight:36}}
                />
                <button type="button" className="fte-pw-eye" onClick={() => setShowNew(s => !s)}>
                  <Shield style={{width:13,height:13}}/>
                </button>
              </div>
            </div>
            <button
              onClick={savePw}
              disabled={pwLoading || !curPw || !newPw}
              className="fte-profile-save"
            >
              {pwLoading
                ? <><Loader2 style={{width:13,height:13}} className="fte-spin"/>Updating...</>
                : <><Key style={{width:13,height:13}}/>Update Password</>
              }
            </button>
          </div>
        </div>

        {/* Logout */}
        <button className="fte-profile-logout" onClick={onLogout}>
          <LogOut style={{width:14,height:14}}/> Logout
        </button>
      </div>
    </div>
  </>;
}

// ─── Main FTE Chat ─────────────────────────────────────────────────────────────
export default function FTEChat() {
  const {user,logout,updateUser}=useAuth();
  const [messages,setMessages]=useState([]);
  const [currentState,setCurrentState]=useState('waiting_cv');
  const [input,setInput]=useState('');
  const [cvFile,setCvFile]=useState(null);
  const [sending,setSending]=useState(false);
  const [approvalLoading,setApprovalLoading]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const messagesEndRef=useRef(null);const fileInputRef=useRef(null);const pollingRef=useRef(null);const textareaRef=useRef(null);

  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);
  useEffect(()=>{if(textareaRef.current){textareaRef.current.style.height='auto';textareaRef.current.style.height=Math.min(textareaRef.current.scrollHeight,128)+'px';}},[input]);

  const addBotMessage=useCallback((type,content,data=null)=>{setMessages(prev=>[...prev,{id:Date.now()+Math.random(),role:'bot',type,content,data,ts:new Date()}]);},[]);
  const addUserMessage=useCallback((text)=>{setMessages(prev=>[...prev,{id:Date.now()+Math.random(),role:'user',type:'text',content:text,ts:new Date()}]);},[]);

  useEffect(()=>{
    fteApi.getState().then(res=>{const s=res.data;setCurrentState(s.state||'waiting_cv');
      if(!s.state||s.state==='waiting_cv') addBotMessage('text','Assalam o Alaikum! Main aapka **Digital FTE** hoon.\n\nMain automatically:\n• Jobs dhundhta hoon (SerpAPI)\n• Tailored CVs banata hoon (AI)\n• HR ko emails bhejta hoon\n\nShuru karne ke liye — apni **CV (PDF)** upload karein.');
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
      else if(s.state==='done') addBotMessage('result','Applications send ho gayi!',{sendResults:s.sendResults});
    }catch{}},2500);
    return()=>{if(pollingRef.current)clearInterval(pollingRef.current);};
  },[currentState,addBotMessage]);

  const handleSend=async(override)=>{
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

  const isDisabled=sending||ASYNC_STATES.has(currentState);
  const meta=STATE_META[currentState]||STATE_META.waiting_cv;
  const isPulse=ASYNC_STATES.has(currentState);

  return <>
    <style>{STYLES}</style>
    <div className="fte-root">
      <HistorySidebar open={historyOpen} onClose={()=>setHistoryOpen(false)}/>
      <ProfilePanel
        open={profileOpen}
        onClose={()=>setProfileOpen(false)}
        user={user}
        onUpdateUser={updateUser}
        onLogout={logout}
      />

      <header className="fte-header">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="fte-icon-btn" onClick={()=>setHistoryOpen(true)}><PanelLeft style={{width:16,height:16}}/></button>
          <div className="fte-brand-icon"><Bot style={{width:18,height:18,color:'white'}}/></div>
          <div>
            <div className="fte-brand-name">Digital FTE</div>
            <div style={{display:'flex',alignItems:'center',gap:5,marginTop:1}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:meta.dot,display:'inline-block'}} className={isPulse?'fte-pulse-dot':''}/>
              <span style={{fontSize:'0.68rem',color:meta.color,fontWeight:700}}>{meta.label}</span>
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="fte-header-btn" onClick={handleNewChat}><Plus style={{width:13,height:13}}/>New Chat</button>
          <button
            className="fte-avatar-btn"
            onClick={()=>setProfileOpen(true)}
            title={user?.name||user?.email}
          >
            {(user?.name||user?.email||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </button>
        </div>
      </header>

      <div className="fte-messages">
        <div className="fte-messages-inner">
          {messages.length===0&&<div className="fte-empty"><div className="fte-empty-icon"><Bot style={{width:32,height:32,color:'white'}}/></div><h2>Digital FTE</h2><p>Aapka AI job application assistant — CV se lekar email tak sab kuch automatic</p></div>}
          {messages.map(msg=>{
            if(msg.role==='user') return <UserMessage key={msg.id}>{msg.content}</UserMessage>;
            if(msg.type==='status') return <StatusMessage key={msg.id}>{msg.content}</StatusMessage>;
            if(msg.type==='cv_approval'&&msg.data?.cvResults) return <BotMessage key={msg.id}><CVApprovalCards cvResults={msg.data.cvResults} approvalId={msg.data.cvReviewApprovalId} onApprove={handleApproveCVs} onReject={handleReject} loading={approvalLoading}/></BotMessage>;
            if(msg.type==='email_approval'&&msg.data?.emailDrafts) return <BotMessage key={msg.id}><EmailApprovalCards emailDrafts={msg.data.emailDrafts} approvalId={msg.data.emailReviewApprovalId} onSend={handleSendEmails} onReject={handleReject} loading={approvalLoading}/></BotMessage>;
            if(msg.type==='result'&&msg.data?.sendResults) return <BotMessage key={msg.id}><SendResults results={msg.data.sendResults} onNewChat={handleNewChat}/></BotMessage>;
            return <BotMessage key={msg.id}><BotText text={msg.content}/></BotMessage>;
          })}
          {sending&&<BotMessage isLoading/>}
          <div ref={messagesEndRef}/>
        </div>
      </div>

      <div className="fte-input-area">
        <div className="fte-input-inner">
          {cvFile&&<div className="fte-cv-preview"><FileText style={{width:13,height:13,color:'#10b981',flexShrink:0}}/><span>{cvFile.name}</span><button onClick={()=>{setCvFile(null);if(fileInputRef.current)fileInputRef.current.value='';}} style={{background:'none',border:'none',cursor:'pointer',color:'#fca5a5',flexShrink:0,padding:0}}><X style={{width:12,height:12}}/></button></div>}
          <div className="fte-input-row">
            <input ref={fileInputRef} type="file" accept=".pdf" style={{display:'none'}} onChange={handleFileChange}/>
            <button onClick={()=>fileInputRef.current?.click()} disabled={isDisabled} className={`fte-attach-btn ${currentState==='waiting_cv'?'pulse':'idle'}`}><Paperclip style={{width:16,height:16}}/></button>
            <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isDisabled} className="fte-textarea" rows={1}
              placeholder={currentState==='waiting_cv'?'CV upload karein ya yahan likhein...':currentState==='cv_uploaded'||currentState==='asking_location'?'Role aur city likhein — e.g. "Software Engineer Karachi"':ASYNC_STATES.has(currentState)?'Kaam ho raha hai, thodi der wait karein...':'Yahan likhein... (Enter = send, Shift+Enter = newline)'}/>
            <button onClick={handleSend} disabled={isDisabled||(!input.trim()&&!cvFile)} className="fte-send-btn">{sending?<Loader2 style={{width:16,height:16}} className="fte-spin"/>:<Send style={{width:16,height:16}}/>}</button>
          </div>
          <p className="fte-input-hint">CV → Role + City → Jobs → CVs → Approve → Emails → Send</p>
        </div>
      </div>
    </div>
  </>;
}