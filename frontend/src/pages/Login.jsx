import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Bot, ArrowRight, Loader2, Search, FileText, Zap, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = [
  { icon: <FileText className="w-4 h-4" />, title: 'Upload your CV', desc: 'Drop your PDF and we parse it instantly.' },
  { icon: <Search className="w-4 h-4" />, title: 'Auto Job Search', desc: 'SerpAPI scours the web for matching roles.' },
  { icon: <Zap className="w-4 h-4" />, title: 'AI-Tailored CVs', desc: 'Every application gets an optimized CV.' },
  { icon: <Send className="w-4 h-4" />, title: 'Automated Emails', desc: 'HR emails sent with your approval.' },
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .login-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
        .login-root { min-height: 100vh; display: flex; background: #f7fdf9; }

        /* Left panel */
        .ln-left {
          display: none; width: 50%;
          background: linear-gradient(160deg, #f0faf5 0%, #e8f7ef 60%, #f0faf5 100%);
          border-right: 1px solid #d4ede2;
          flex-direction: column; justify-content: space-between;
          padding: 3rem; position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .ln-left { display: flex; } }

        .ln-glow-1 { position: absolute; top: -60px; left: -60px; width: 320px; height: 320px; background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 65%); border-radius: 50%; }
        .ln-glow-2 { position: absolute; bottom: -60px; right: -60px; width: 280px; height: 280px; background: radial-gradient(circle, rgba(13,148,136,0.09) 0%, transparent 65%); border-radius: 50%; }

        .ln-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .ln-brand-icon { width: 44px; height: 44px; background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
        .ln-brand-name { color: #0f2d20; font-weight: 800; font-size: 1.15rem; }
        .ln-brand-sub  { color: #10b981; font-size: 0.72rem; margin-top: 1px; font-weight: 600; }

        .ln-hero { position: relative; z-index: 1; }
        .ln-headline { color: #0f2d20; font-size: 2rem; font-weight: 800; line-height: 1.2; margin-bottom: 10px; }
        .ln-accent { background: linear-gradient(90deg,#10b981,#0d9488); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ln-sub { color: #6a9e82; font-size: 0.85rem; line-height: 1.65; margin-bottom: 2rem; }

        .ln-step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
        .ln-step-icon { width: 38px; height: 38px; flex-shrink: 0; background: #fff; border: 1px solid #c8e8d8; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #10b981; box-shadow: 0 1px 4px rgba(16,185,129,0.1); }
        .ln-step-title { color: #0f2d20; font-weight: 700; font-size: 0.875rem; }
        .ln-step-desc  { color: #7dba9a; font-size: 0.75rem; margin-top: 2px; }
        .ln-footer { color: #b2d9c5; font-size: 0.7rem; position: relative; z-index: 1; }

        /* Right panel */
        .ln-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 3rem 1.5rem; background: #fff; }
        .ln-card { width: 100%; max-width: 400px; }

        .ln-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 2.5rem; }
        .ln-mobile-icon { width: 36px; height: 36px; background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(16,185,129,0.25); }
        @media (min-width: 1024px) { .ln-mobile-brand { display: none; } }

        .ln-title { color: #0f2d20; font-size: 1.6rem; font-weight: 800; margin-bottom: 6px; }
        .ln-subtitle { color: #7dba9a; font-size: 0.85rem; margin-bottom: 2rem; }
        .ln-subtitle a { color: #10b981; font-weight: 700; text-decoration: none; transition: color 0.2s; }
        .ln-subtitle a:hover { color: #0d9488; }

        .ln-label { display: block; font-size: 0.7rem; font-weight: 700; color: #6a9e82; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .ln-wrap { position: relative; }
        .ln-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: #b2d9c5; }
        .ln-input {
          width: 100%; background: #f7fdf9; border: 1px solid #c8e8d8; border-radius: 12px;
          padding: 11px 44px; font-size: 0.875rem; color: #0f2d20; outline: none;
          transition: all 0.2s; font-family: inherit;
        }
        .ln-input::placeholder { color: #b2d9c5; }
        .ln-input:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
        .ln-input.err { border-color: #fca5a5; }
        .ln-input.err:focus { box-shadow: 0 0 0 3px rgba(252,165,165,0.15); }
        .ln-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #b2d9c5; transition: color 0.2s; }
        .ln-eye:hover { color: #10b981; }
        .ln-err { font-size: 0.72rem; color: #ef4444; margin-top: 5px; }

        .ln-btn {
          width: 100%; background: linear-gradient(135deg,#10b981,#0d9488);
          color: #fff; font-weight: 700; font-family: inherit; font-size: 0.9rem;
          border: none; border-radius: 12px; padding: 12px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 3px 14px rgba(16,185,129,0.28); transition: all 0.2s; margin-top: 6px;
        }
        .ln-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.36); }
        .ln-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .ln-spin { animation: lnSpin 1s linear infinite; }
        @keyframes lnSpin { to { transform: rotate(360deg); } }
        .ln-form-footer { margin-top: 1.5rem; text-align: center; color: #c8e8d8; font-size: 0.7rem; }
        .ln-fields { display: flex; flex-direction: column; gap: 16px; }
      `}</style>

      <div className="login-root">

        {/* Left */}
        <div className="ln-left">
          <div className="ln-glow-1" /><div className="ln-glow-2" />
          <div className="ln-brand">
            <div className="ln-brand-icon"><Bot style={{width:22,height:22,color:'white'}} /></div>
            <div><div className="ln-brand-name">Job Hunt Agent</div><div className="ln-brand-sub">AI-powered application engine</div></div>
          </div>

          <div className="ln-hero">
            <h2 className="ln-headline">Your personal<br /><span className="ln-accent">job hunting agent</span></h2>
            <p className="ln-sub">Upload your CV once. We handle the rest — automatically.</p>
            {STEPS.map((step, i) => (
              <div key={i} className="ln-step">
                <div className="ln-step-icon">{step.icon}</div>
                <div><p className="ln-step-title">{step.title}</p><p className="ln-step-desc">{step.desc}</p></div>
              </div>
            ))}
          </div>

          <p className="ln-footer">© {new Date().getFullYear()} Job Hunt Agent. All rights reserved.</p>
        </div>

        {/* Right */}
        <div className="ln-right">
          <div className="ln-card">
            <div className="ln-mobile-brand">
              <div className="ln-mobile-icon"><Bot style={{width:18,height:18,color:'white'}} /></div>
              <span style={{color:'#0f2d20',fontWeight:700,fontSize:'1.05rem'}}>Job Hunt Agent</span>
            </div>

            <h1 className="ln-title">Welcome back</h1>
            <p className="ln-subtitle">Don't have an account? <Link to="/register">Sign up for free</Link></p>

            <form onSubmit={handleSubmit(onSubmit)} className="ln-fields">
              <div>
                <label className="ln-label">Email address</label>
                <div className="ln-wrap">
                  <Mail className="ln-icon" />
                  <input {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' } })}
                    type="email" placeholder="you@example.com" className={`ln-input${errors.email ? ' err' : ''}`} />
                </div>
                {errors.email && <p className="ln-err">{errors.email.message}</p>}
              </div>

              <div>
                <label className="ln-label">Password</label>
                <div className="ln-wrap">
                  <Lock className="ln-icon" />
                  <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                    type={showPassword ? 'text' : 'password'} placeholder="••••••••" className={`ln-input${errors.password ? ' err' : ''}`} />
                  <button type="button" className="ln-eye" onClick={() => setShowPassword(s => !s)}>
                    {showPassword ? <EyeOff style={{width:16,height:16}} /> : <Eye style={{width:16,height:16}} />}
                  </button>
                </div>
                {errors.password && <p className="ln-err">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className="ln-btn">
                {isLoading
                  ? <><Loader2 style={{width:16,height:16}} className="ln-spin" /> Signing in...</>
                  : <><span>Sign in</span><ArrowRight style={{width:16,height:16}} /></>}
              </button>
            </form>
            <p className="ln-form-footer">By signing in you agree to our Terms of Service.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;