import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/adminApi';
import toast from 'react-hot-toast';
import {
  Users, Activity, Mail, TrendingUp, LogOut, Sparkles,
  Search, X, ChevronLeft, ChevronRight, Shield, User,
  Loader2, AlertCircle, ToggleLeft, ToggleRight, Clock, Calendar
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

  :root {
    --adm-base:    #071812;
    --adm-surface: #0c2118;
    --adm-card:    #112a1f;
    --adm-raised:  #163525;
    --adm-hover:   #1b3f2b;
    --adm-border:  rgba(34,197,94,0.09);
    --adm-bmd:     rgba(34,197,94,0.14);
    --adm-bhi:     rgba(34,197,94,0.24);
    --adm-accent:  #22c55e;
    --adm-ahi:     #4ade80;
    --adm-adim:    rgba(34,197,94,0.13);
    --adm-violet:  #34d399;
    --adm-success: #4ade80;
    --adm-sdim:    rgba(74,222,128,0.12);
    --adm-sborder: rgba(74,222,128,0.28);
    --adm-error:   #f87171;
    --adm-edim:    rgba(248,113,113,0.10);
    --adm-eborder: rgba(248,113,113,0.28);
    --adm-gold:    #fbbf24;
    --adm-gdim:    rgba(251,191,36,0.10);
    --adm-t1:      #ecfdf5;
    --adm-t2:      #86efac;
    --adm-t3:      #4d7c6b;
    --adm-r-sm:    8px;
    --adm-r-md:    12px;
    --adm-r-lg:    16px;
  }

  .adm-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
  .adm-root { min-height: 100vh; background: var(--adm-base); color: var(--adm-t1); }

  .adm-root::before {
    content: ''; position: fixed; top: -10%; left: 20%; width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }

  .adm-root ::-webkit-scrollbar { width: 4px; }
  .adm-root ::-webkit-scrollbar-track { background: transparent; }
  .adm-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

  /* ── Header ── */
  .adm-header {
    position: sticky; top: 0; z-index: 20;
    background: rgba(7,24,18,0.97); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--adm-border);
    padding: 0 28px; height: 60px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .adm-header::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(34,197,94,0.5), rgba(52,211,153,0.4), transparent);
    opacity: 0.6;
  }
  .adm-brand { display: flex; align-items: center; gap: 12px; }
  .adm-brand-icon { width: 36px; height: 36px; background: linear-gradient(135deg,#22c55e,#34d399); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(34,197,94,0.32); }
  .adm-brand-name { font-weight: 800; font-size: 1rem; color: var(--adm-t1); }
  .adm-brand-badge { font-size: 0.6rem; font-weight: 700; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: var(--adm-t2); border-radius: 5px; padding: 2px 8px; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'JetBrains Mono', monospace; }
  .adm-logout-btn { display: flex; align-items: center; gap: 6px; background: var(--adm-raised); border: 1px solid var(--adm-bmd); color: var(--adm-t3); font-family: inherit; font-size: 0.8rem; font-weight: 600; border-radius: var(--adm-r-sm); padding: 7px 14px; cursor: pointer; transition: all 0.2s; }
  .adm-logout-btn:hover { border-color: var(--adm-bhi); color: var(--adm-t1); }

  /* ── Main container ── */
  .adm-main { max-width: 1280px; margin: 0 auto; padding: 32px 28px; position: relative; z-index: 1; }

  /* ── Stats grid ── */
  .adm-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 28px; }
  @media (max-width: 900px) { .adm-stats { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 520px) { .adm-stats { grid-template-columns: 1fr; } }

  .adm-stat-card {
    background: var(--adm-card); border: 1px solid var(--adm-border);
    border-radius: var(--adm-r-lg); padding: 20px 22px;
    display: flex; flex-direction: column; gap: 10px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    animation: admFadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }
  .adm-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(34,197,94,0.18); }
  @keyframes admFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

  .adm-stat-top { display: flex; align-items: center; justify-content: space-between; }
  .adm-stat-label { font-size: 0.72rem; font-weight: 700; color: var(--adm-t3); text-transform: uppercase; letter-spacing: 0.07em; font-family: 'JetBrains Mono', monospace; }
  .adm-stat-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .adm-stat-val { font-size: 2rem; font-weight: 800; color: var(--adm-t1); line-height: 1; }
  .adm-stat-sub { font-size: 0.72rem; color: var(--adm-t3); font-weight: 500; margin-top: 2px; }

  /* ── Toolbar ── */
  .adm-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
  .adm-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 380px; }
  .adm-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--adm-t3); }
  .adm-search { width: 100%; background: var(--adm-card); border: 1px solid var(--adm-bmd); border-radius: var(--adm-r-sm); padding: 9px 12px 9px 38px; color: var(--adm-t1); font-family: inherit; font-size: 0.85rem; outline: none; transition: all 0.15s; }
  .adm-search::placeholder { color: var(--adm-t3); }
  .adm-search:focus { border-color: rgba(34,197,94,0.45); box-shadow: 0 0 0 3px rgba(34,197,94,0.10); }
  .adm-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--adm-t3); padding: 2px; transition: color 0.15s; }
  .adm-search-clear:hover { color: var(--adm-t1); }

  .adm-filter-select { background: var(--adm-card); border: 1px solid var(--adm-bmd); border-radius: var(--adm-r-sm); padding: 9px 12px; color: var(--adm-t1); font-family: inherit; font-size: 0.82rem; outline: none; cursor: pointer; }
  .adm-filter-select:focus { border-color: rgba(34,197,94,0.45); }

  .adm-total-label { font-size: 0.75rem; color: var(--adm-t3); font-weight: 600; margin-left: auto; }

  /* ── Table card ── */
  .adm-table-card { background: var(--adm-card); border: 1px solid var(--adm-border); border-radius: var(--adm-r-lg); overflow: hidden; }
  .adm-table { width: 100%; border-collapse: collapse; }
  .adm-th { padding: 12px 16px; text-align: left; font-size: 0.67rem; font-weight: 700; color: var(--adm-t3); text-transform: uppercase; letter-spacing: 0.07em; border-bottom: 1px solid var(--adm-border); font-family: 'JetBrains Mono', monospace; white-space: nowrap; }
  .adm-tr { cursor: pointer; transition: background 0.15s; border-bottom: 1px solid var(--adm-border); }
  .adm-tr:last-child { border-bottom: none; }
  .adm-tr:hover { background: var(--adm-hover); }
  .adm-td { padding: 13px 16px; font-size: 0.84rem; color: var(--adm-t2); vertical-align: middle; white-space: nowrap; }
  .adm-td-name { color: var(--adm-t1); font-weight: 600; }
  .adm-td-email { font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; color: var(--adm-t3); }

  .adm-role-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 700; border-radius: 5px; padding: 3px 9px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em; }
  .adm-role-admin { background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.35); color: #6ee7b7; }
  .adm-role-user  { background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.20); color: var(--adm-t2); }

  /* Toggle switch */
  .adm-toggle { display: inline-flex; align-items: center; gap: 6px; }
  .adm-toggle-track { width: 36px; height: 20px; border-radius: 10px; background: var(--adm-raised); border: 1px solid var(--adm-bmd); position: relative; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
  .adm-toggle-track.on { background: var(--adm-success); border-color: rgba(74,222,128,0.5); }
  .adm-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
  .adm-toggle-track.on .adm-toggle-thumb { transform: translateX(16px); }

  /* Empty / loading */
  .adm-empty { padding: 48px; text-align: center; color: var(--adm-t3); }
  .adm-empty-icon { width: 52px; height: 52px; background: var(--adm-raised); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
  .adm-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 48px; color: var(--adm-t3); font-size: 0.84rem; }
  .adm-spin { animation: admSpin 1s linear infinite; }
  @keyframes admSpin { to { transform: rotate(360deg); } }

  /* ── Pagination ── */
  .adm-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-top: 1px solid var(--adm-border); }
  .adm-page-info { font-size: 0.78rem; color: var(--adm-t3); }
  .adm-page-btns { display: flex; align-items: center; gap: 6px; }
  .adm-page-btn { background: var(--adm-raised); border: 1px solid var(--adm-bmd); color: var(--adm-t2); font-family: inherit; font-size: 0.8rem; font-weight: 600; border-radius: var(--adm-r-sm); padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.18s; }
  .adm-page-btn:hover:not(:disabled) { border-color: var(--adm-bhi); color: var(--adm-t1); }
  .adm-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .adm-page-current { font-size: 0.78rem; color: var(--adm-t2); font-weight: 600; padding: 0 6px; }

  /* ── Side Panel (user detail) ── */
  .adm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; display: flex; justify-content: flex-end; animation: admFadeIn 0.2s ease; }
  @keyframes admFadeIn { from{opacity:0} to{opacity:1} }
  .adm-panel { width: 380px; height: 100%; background: var(--adm-surface); border-left: 1px solid var(--adm-bmd); overflow-y: auto; display: flex; flex-direction: column; animation: admSlideIn 0.25s cubic-bezier(0.16,1,0.3,1); }
  @keyframes admSlideIn { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
  @media (max-width: 480px) { .adm-panel { width: 100%; } }

  .adm-panel-hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--adm-border); flex-shrink: 0; }
  .adm-panel-title { font-size: 0.95rem; font-weight: 800; color: var(--adm-t1); }
  .adm-panel-close { background: var(--adm-raised); border: 1px solid var(--adm-bmd); color: var(--adm-t3); border-radius: var(--adm-r-sm); padding: 5px; cursor: pointer; display: flex; align-items: center; transition: all 0.15s; }
  .adm-panel-close:hover { color: var(--adm-t1); border-color: var(--adm-bhi); }
  .adm-panel-body { padding: 22px; flex: 1; display: flex; flex-direction: column; gap: 18px; }

  .adm-info-row { display: flex; flex-direction: column; gap: 3px; }
  .adm-info-lbl { font-size: 0.62rem; font-weight: 700; color: var(--adm-t3); text-transform: uppercase; letter-spacing: 0.07em; font-family: 'JetBrains Mono', monospace; }
  .adm-info-val { font-size: 0.85rem; color: var(--adm-t1); font-weight: 600; word-break: break-all; }
  .adm-info-val.mono { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--adm-t2); }
  .adm-divider { height: 1px; background: var(--adm-border); }

  .adm-panel-stat { display: flex; align-items: center; justify-content: space-between; background: var(--adm-card); border: 1px solid var(--adm-border); border-radius: var(--adm-r-sm); padding: 11px 14px; }
  .adm-panel-stat-lbl { font-size: 0.75rem; color: var(--adm-t3); font-weight: 600; }
  .adm-panel-stat-val { font-size: 1.1rem; font-weight: 800; color: var(--adm-t1); }

  .adm-fte-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; font-weight: 700; background: var(--adm-adim); border: 1px solid var(--adm-bmd); color: #4ade80; border-radius: 6px; padding: 4px 10px; font-family: 'JetBrains Mono', monospace; }

  .adm-toggle-wrap { display: flex; align-items: center; justify-content: space-between; background: var(--adm-card); border: 1px solid var(--adm-border); border-radius: var(--adm-r-sm); padding: 12px 14px; }
  .adm-toggle-lbl { font-size: 0.82rem; color: var(--adm-t2); font-weight: 600; }
  .adm-toggle-sub { font-size: 0.7rem; color: var(--adm-t3); margin-top: 2px; }
`;

/* ─── Helpers ── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtRelative(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
}

function Toggle({ on, onToggle, disabled }) {
  return (
    <div
      className={`adm-toggle-track${on ? ' on' : ''}`}
      onClick={!disabled ? onToggle : undefined}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <div className="adm-toggle-thumb" />
    </div>
  );
}

/* ─── User detail side panel ── */
function UserPanel({ userId, onClose, onToggleStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    adminAPI.getUserById(userId)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load user'))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleToggle = async () => {
    if (!data?.user || toggling) return;
    setToggling(true);
    try {
      const res = await adminAPI.toggleStatus(data.user._id, !data.user.isActive);
      setData(prev => ({ ...prev, user: res.data.user }));
      onToggleStatus(res.data.user);
      toast.success(`User ${res.data.user.isActive ? 'activated' : 'deactivated'}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-panel" onClick={e => e.stopPropagation()}>
        <div className="adm-panel-hdr">
          <span className="adm-panel-title">User Detail</span>
          <button className="adm-panel-close" onClick={onClose}><X style={{ width: 14, height: 14 }} /></button>
        </div>
        <div className="adm-panel-body">
          {loading ? (
            <div className="adm-loading"><Loader2 style={{ width: 16, height: 16 }} className="adm-spin" />Loading...</div>
          ) : data ? (
            <>
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {data.user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--adm-t1)' }}>{data.user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--adm-t3)', fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{data.user.email}</div>
                </div>
              </div>
              <div className="adm-divider" />
              {/* Info rows */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="adm-info-row">
                  <span className="adm-info-lbl">Role</span>
                  <span className={`adm-role-badge adm-role-${data.user.role}`}>
                    {data.user.role === 'admin' ? <Shield style={{ width: 10, height: 10 }} /> : <User style={{ width: 10, height: 10 }} />}
                    {data.user.role}
                  </span>
                </div>
                <div className="adm-info-row">
                  <span className="adm-info-lbl">Joined</span>
                  <span className="adm-info-val">{fmtDate(data.user.createdAt)}</span>
                </div>
                <div className="adm-info-row">
                  <span className="adm-info-lbl">Last Login</span>
                  <span className="adm-info-val">{fmtRelative(data.user.lastLogin)}</span>
                </div>
                <div className="adm-info-row">
                  <span className="adm-info-lbl">FTE State</span>
                  <span className="adm-fte-badge">{data.fteState || 'no session'}</span>
                </div>
              </div>
              <div className="adm-divider" />
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="adm-panel-stat">
                  <span className="adm-panel-stat-lbl">Emails Sent</span>
                  <span className="adm-panel-stat-val">{data.user.emailSentCount || 0}</span>
                </div>
                <div className="adm-panel-stat">
                  <span className="adm-panel-stat-lbl">History</span>
                  <span className="adm-panel-stat-val">{data.historyCount || 0}</span>
                </div>
              </div>
              <div className="adm-divider" />
              {/* Active toggle */}
              <div className="adm-toggle-wrap">
                <div>
                  <div className="adm-toggle-lbl">Account Status</div>
                  <div className="adm-toggle-sub">{data.user.isActive ? 'Active — can login' : 'Deactivated — login blocked'}</div>
                </div>
                <Toggle on={data.user.isActive} onToggle={handleToggle} disabled={toggling} />
              </div>
            </>
          ) : (
            <div className="adm-empty">
              <div className="adm-empty-icon"><AlertCircle style={{ width: 24, height: 24, color: 'var(--adm-error)' }} /></div>
              <p>Could not load user</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const LIMIT = 20;
  const debounceRef = useRef(null);

  // Fetch stats
  useEffect(() => {
    adminAPI.getStats()
      .then(r => setStats(r.data.stats))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoadingStats(false));
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Fetch users
  useEffect(() => {
    setLoadingUsers(true);
    adminAPI.getUsers({ search: debouncedSearch, status: statusFilter, page, limit: LIMIT })
      .then(r => { setUsers(r.data.users); setTotal(r.data.pagination.total); })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoadingUsers(false));
  }, [debouncedSearch, statusFilter, page]);

  const handleToggleStatus = useCallback(async (userId, currentActive) => {
    try {
      const res = await adminAPI.toggleStatus(userId, !currentActive);
      setUsers(prev => prev.map(u => u._id === userId ? res.data.user : u));
      toast.success(`User ${res.data.user.isActive ? 'activated' : 'deactivated'}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  }, []);

  const handleUserPanelToggle = useCallback((updatedUser) => {
    setUsers(prev => prev.map(u => u._id === updatedUser._id ? updatedUser : u));
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const totalPages = Math.ceil(total / LIMIT);

  const STAT_CARDS = [
    { label: 'Total Users', value: stats?.totalUsers ?? '—', icon: Users, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', sub: 'All registered accounts' },
    { label: 'Active Users', value: stats?.activeUsers ?? '—', icon: Activity, color: '#4ade80', bg: 'rgba(74,222,128,0.12)', sub: 'Currently active' },
    { label: 'Emails Sent', value: stats?.emailsSent ?? '—', icon: Mail, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', sub: 'Total applications sent' },
    { label: 'New This Week', value: stats?.newUsersThisWeek ?? '—', icon: TrendingUp, color: '#34d399', bg: 'rgba(52,211,153,0.12)', sub: 'Signups last 7 days' },
  ];

  return (
    <div className="adm-root">
      <style>{STYLES}</style>

      {/* Header */}
      <header className="adm-header">
        <div className="adm-brand">
          <div className="adm-brand-icon"><Sparkles style={{ width: 18, height: 18, color: 'white' }} /></div>
          <span className="adm-brand-name">Talvion AI</span>
          <span className="adm-brand-badge">Admin Panel</span>
        </div>
        <button className="adm-logout-btn" onClick={handleLogout}>
          <LogOut style={{ width: 14, height: 14 }} />Logout
        </button>
      </header>

      <main className="adm-main">

        {/* Stats */}
        <div className="adm-stats">
          {STAT_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="adm-stat-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="adm-stat-top">
                  <span className="adm-stat-label">{card.label}</span>
                  <div className="adm-stat-icon" style={{ background: card.bg }}>
                    <Icon style={{ width: 16, height: 16, color: card.color }} />
                  </div>
                </div>
                <div className="adm-stat-val">
                  {loadingStats ? <Loader2 style={{ width: 20, height: 20 }} className="adm-spin" /> : card.value.toLocaleString?.() || card.value}
                </div>
                <div className="adm-stat-sub">{card.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="adm-toolbar">
          <div className="adm-search-wrap">
            <Search className="adm-search-icon" style={{ width: 15, height: 15 }} />
            <input
              className="adm-search"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="adm-search-clear" onClick={() => setSearch('')}>
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>
          <select
            className="adm-filter-select"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="adm-total-label">{total} user{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="adm-table-card">
          {loadingUsers ? (
            <div className="adm-loading">
              <Loader2 style={{ width: 16, height: 16 }} className="adm-spin" />Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="adm-empty">
              <div className="adm-empty-icon"><Users style={{ width: 24, height: 24, color: 'var(--adm-t3)' }} /></div>
              <p style={{ fontSize: '0.85rem' }}>No users found</p>
            </div>
          ) : (
            <>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="adm-th">Name</th>
                    <th className="adm-th">Email</th>
                    <th className="adm-th">Role</th>
                    <th className="adm-th">Status</th>
                    <th className="adm-th">Joined</th>
                    <th className="adm-th">Last Login</th>
                    <th className="adm-th">Emails</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr
                      key={user._id}
                      className="adm-tr"
                      onClick={() => setSelectedUserId(user._id)}
                    >
                      <td className="adm-td adm-td-name">{user.name}</td>
                      <td className="adm-td adm-td-email">{user.email}</td>
                      <td className="adm-td">
                        <span className={`adm-role-badge adm-role-${user.role}`}>
                          {user.role === 'admin' ? <Shield style={{ width: 9, height: 9 }} /> : <User style={{ width: 9, height: 9 }} />}
                          {user.role}
                        </span>
                      </td>
                      <td className="adm-td" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Toggle
                            on={user.isActive}
                            onToggle={() => handleToggleStatus(user._id, user.isActive)}
                          />
                          <span style={{ fontSize: '0.74rem', color: user.isActive ? 'var(--adm-success)' : 'var(--adm-error)', fontWeight: 600 }}>
                            {user.isActive ? 'Active' : 'Off'}
                          </span>
                        </div>
                      </td>
                      <td className="adm-td">{fmtDate(user.createdAt)}</td>
                      <td className="adm-td">{fmtRelative(user.lastLogin)}</td>
                      <td className="adm-td">{user.emailSentCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="adm-pagination">
                <span className="adm-page-info">
                  Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
                </span>
                <div className="adm-page-btns">
                  <button className="adm-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft style={{ width: 14, height: 14 }} />Prev
                  </button>
                  <span className="adm-page-current">{page} / {totalPages}</span>
                  <button className="adm-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next<ChevronRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* User detail side panel */}
      {selectedUserId && (
        <UserPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onToggleStatus={handleUserPanelToggle}
        />
      )}
    </div>
  );
}
