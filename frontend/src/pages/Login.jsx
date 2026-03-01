import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Bot, ArrowRight, Loader2, Search, FileText, Zap, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = [
  { icon: <FileText size={15} />, title: 'Upload your CV', desc: 'Drop your PDF — we parse it instantly.' },
  { icon: <Search size={15} />, title: 'Auto Job Search', desc: 'AI scours the web for matching roles.' },
  { icon: <Zap size={15} />, title: 'AI-Tailored CVs', desc: 'Every application gets an optimised CV.' },
  { icon: <Send size={15} />, title: 'Automated Emails', desc: 'HR emails sent with your approval.' },
];

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.success) { toast.success('Welcome back!'); navigate('/chat'); }
      else toast.error(result.error);
    } catch { toast.error('An unexpected error occurred'); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .auth-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        .auth-root { min-height: 100vh; display: flex; background: #f1f5f9; }

        /* Left panel — dark */
        .auth-left {
          display: none; width: 44%;
          background: #0f172a;
          flex-direction: column; justify-content: space-between;
          padding: 2.5rem 3rem; position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .auth-left { display: flex; } }

        .auth-glow { position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 65%); border-radius: 50%; top: -100px; left: -100px; pointer-events: none; }
        .auth-glow-2 { top: auto; left: auto; bottom: -150px; right: -100px; background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%); }

        .auth-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .auth-brand-icon { width: 40px; height: 40px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1px rgba(16,185,129,0.4), 0 4px 14px rgba(16,185,129,0.25); }
        .auth-brand-name { color: #f0fdf4; font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; }
        .auth-brand-sub { color: #10b981; font-size: 0.68rem; margin-top: 1px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }

        .auth-hero { position: relative; z-index: 1; }
        .auth-headline { color: #f8fafc; font-size: 1.9rem; font-weight: 800; line-height: 1.18; margin-bottom: 10px; letter-spacing: -0.03em; }
        .auth-accent { background: linear-gradient(90deg,#10b981,#34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .auth-sub { color: #64748b; font-size: 0.83rem; line-height: 1.65; margin-bottom: 2.5rem; font-weight: 400; }

        .auth-step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
        .auth-step-icon { width: 36px; height: 36px; flex-shrink: 0; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #10b981; }
        .auth-step-title { color: #e2e8f0; font-weight: 600; font-size: 0.83rem; }
        .auth-step-desc { color: #475569; font-size: 0.73rem; margin-top: 2px; font-weight: 400; }

        .auth-footer { color: #334155; font-size: 0.68rem; position: relative; z-index: 1; font-weight: 500; }

        /* Right panel */
        .auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; background: #f1f5f9; }
        .auth-card { width: 100%; max-width: 400px; }

        .auth-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 2rem; }
        .auth-mobile-icon { width: 34px; height: 34px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(16,185,129,0.25); }
        @media (min-width: 1024px) { .auth-mobile-brand { display: none; } }

        .auth-form-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .auth-title { color: #0f172a; font-size: 1.5rem; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em; }
        .auth-subtitle { color: #64748b; font-size: 0.83rem; margin: 0 0 1.75rem; font-weight: 400; }
        .auth-subtitle a { color: #10b981; font-weight: 600; text-decoration: none; }
        .auth-subtitle a:hover { text-decoration: underline; }

        .auth-label { display: block; font-size: 0.67rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .auth-wrap { position: relative; }
        .auth-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .auth-input {
          width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
          padding: 11px 44px; font-size: 0.875rem; color: #0f172a; outline: none;
          transition: all 0.15s; font-family: inherit; font-weight: 400;
        }
        .auth-input::placeholder { color: #94a3b8; }
        .auth-input:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.08); }
        .auth-input.err { border-color: #fca5a5; }
        .auth-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #94a3b8; transition: color 0.2s; }
        .auth-eye:hover { color: #10b981; }
        .auth-err { font-size: 0.71rem; color: #ef4444; margin-top: 5px; }

        .auth-btn {
          width: 100%; background: linear-gradient(135deg,#10b981,#059669);
          color: #fff; font-weight: 700; font-family: inherit; font-size: 0.875rem;
          border: none; border-radius: 10px; padding: 12px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 10px rgba(16,185,129,0.3); transition: all 0.2s; margin-top: 4px;
        }
        .auth-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(16,185,129,0.4); }
        .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .auth-spin { animation: authSpin 1s linear infinite; }
        @keyframes authSpin { to { transform: rotate(360deg); } }
        .auth-form-footer { margin-top: 1.25rem; text-align: center; color: #94a3b8; font-size: 0.68rem; }
        .auth-fields { display: flex; flex-direction: column; gap: 16px; }
        .auth-divider { height: 1px; background: #f1f5f9; margin: 4px 0; }
      `}</style>

      <div className="auth-root">

        {/* Left — dark panel */}
        <div className="auth-left">
          <div className="auth-glow" /><div className="auth-glow auth-glow-2" />
          <div className="auth-brand">
            <div className="auth-brand-icon"><Bot size={20} color="white" /></div>
            <div>
              <div className="auth-brand-name">Talvion AI</div>
              <div className="auth-brand-sub">AI-powered engine</div>
            </div>
          </div>

          <div className="auth-hero">
            <h2 className="auth-headline">Your personal<br /><span className="auth-accent">job hunting agent</span></h2>
            <p className="auth-sub">Upload your CV once. We handle the rest — automatically searching, applying, and following up.</p>
            {STEPS.map((step, i) => (
              <div key={i} className="auth-step">
                <div className="auth-step-icon">{step.icon}</div>
                <div>
                  <p className="auth-step-title">{step.title}</p>
                  <p className="auth-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="auth-footer">© {new Date().getFullYear()} Talvion AI · All rights reserved</p>
        </div>

        {/* Right — form */}
        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-mobile-brand">
              <div className="auth-mobile-icon"><Bot size={17} color="white" /></div>
              <span style={{color:'#0f172a',fontWeight:700,fontSize:'1rem'}}>Talvion AI</span>
            </div>

            <div className="auth-form-box">
              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-subtitle">No account? <Link to="/register">Create one free</Link></p>
              <div className="auth-divider" />

              <form onSubmit={handleSubmit(onSubmit)} className="auth-fields" style={{marginTop:'1.25rem'}}>
                <div>
                  <label className="auth-label">Email address</label>
                  <div className="auth-wrap">
                    <Mail className="auth-icon" size={15} />
                    <input {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' } })}
                      type="email" placeholder="you@example.com" className={`auth-input${errors.email ? ' err' : ''}`} />
                  </div>
                  {errors.email && <p className="auth-err">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="auth-label">Password</label>
                  <div className="auth-wrap">
                    <Lock className="auth-icon" size={15} />
                    <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                      type={showPassword ? 'text' : 'password'} placeholder="••••••••" className={`auth-input${errors.password ? ' err' : ''}`} />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="auth-err">{errors.password.message}</p>}
                </div>

                <button type="submit" disabled={isLoading} className="auth-btn">
                  {isLoading
                    ? <><Loader2 size={15} className="auth-spin" /> Signing in...</>
                    : <><span>Sign in</span><ArrowRight size={15} /></>}
                </button>
              </form>
              <p className="auth-form-footer">By signing in you agree to our Terms of Service</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
