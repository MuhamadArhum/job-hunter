import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, Bot, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PERKS = [
  'Automated job search across 100+ boards',
  'AI-tailored CV for every application',
  'Smart HR email finding & verification',
  'Full session history & interview prep',
];

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const result = await registerUser({ name: data.name, email: data.email, password: data.password });
      if (result.success) { toast.success('Account created! Welcome aboard!'); navigate('/chat'); }
      else toast.error(result.error);
    } catch { toast.error('An unexpected error occurred'); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .auth-reg-root * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        .auth-reg-root { min-height: 100vh; display: flex; background: #f1f5f9; }

        /* Left panel — dark */
        .rg-left {
          display: none; width: 42%;
          background: #0f172a;
          flex-direction: column; justify-content: space-between;
          padding: 2.5rem 3rem; position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .rg-left { display: flex; } }

        .rg-glow { position: absolute; width: 450px; height: 450px; background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 65%); border-radius: 50%; top: -80px; right: -80px; pointer-events: none; }
        .rg-glow-2 { top: auto; right: auto; bottom: -100px; left: -80px; background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%); }

        .rg-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .rg-brand-icon { width: 40px; height: 40px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1px rgba(16,185,129,0.4), 0 4px 14px rgba(16,185,129,0.2); }
        .rg-brand-name { color: #f0fdf4; font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; }
        .rg-brand-sub { color: #10b981; font-size: 0.68rem; margin-top: 1px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }

        .rg-hero { position: relative; z-index: 1; }
        .rg-headline { color: #f8fafc; font-size: 1.9rem; font-weight: 800; line-height: 1.18; margin-bottom: 10px; letter-spacing: -0.03em; }
        .rg-accent { background: linear-gradient(90deg,#10b981,#34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .rg-sub { color: #64748b; font-size: 0.83rem; line-height: 1.65; margin-bottom: 2rem; font-weight: 400; }

        .rg-perk { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .rg-perk-text { color: #94a3b8; font-size: 0.83rem; font-weight: 400; }

        .rg-footer { color: #334155; font-size: 0.68rem; position: relative; z-index: 1; font-weight: 500; }

        /* Right */
        .rg-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem 1.5rem; background: #f1f5f9; overflow-y: auto; }
        .rg-card { width: 100%; max-width: 400px; }

        .rg-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; }
        .rg-mobile-icon { width: 34px; height: 34px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        @media (min-width: 1024px) { .rg-mobile-brand { display: none; } }

        .rg-form-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.75rem; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .rg-title { color: #0f172a; font-size: 1.45rem; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em; }
        .rg-sub-link { color: #64748b; font-size: 0.83rem; margin: 0 0 1.25rem; font-weight: 400; }
        .rg-sub-link a { color: #10b981; font-weight: 600; text-decoration: none; }
        .rg-sub-link a:hover { text-decoration: underline; }

        .rg-label { display: block; font-size: 0.67rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; }
        .rg-wrap { position: relative; }
        .rg-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .rg-input {
          width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
          padding: 10px 44px; font-size: 0.875rem; color: #0f172a; outline: none;
          transition: all 0.15s; font-family: inherit; font-weight: 400;
        }
        .rg-input::placeholder { color: #94a3b8; }
        .rg-input:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.08); }
        .rg-input.err { border-color: #fca5a5; }
        .rg-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #94a3b8; transition: color 0.2s; }
        .rg-eye:hover { color: #10b981; }
        .rg-err { font-size: 0.71rem; color: #ef4444; margin-top: 4px; }

        .rg-btn {
          width: 100%; background: linear-gradient(135deg,#10b981,#059669);
          color: #fff; font-weight: 700; font-family: inherit; font-size: 0.875rem;
          border: none; border-radius: 10px; padding: 11px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 10px rgba(16,185,129,0.3); transition: all 0.2s; margin-top: 4px;
        }
        .rg-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(16,185,129,0.4); }
        .rg-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .rg-spin { animation: rgSpin 1s linear infinite; }
        @keyframes rgSpin { to { transform: rotate(360deg); } }
        .rg-form-footer { margin-top: 1rem; text-align: center; color: #94a3b8; font-size: 0.67rem; line-height: 1.5; }
        .rg-fields { display: flex; flex-direction: column; gap: 13px; }
        .rg-divider { height: 1px; background: #f1f5f9; margin: 2px 0 6px; }
      `}</style>

      <div className="auth-reg-root">

        {/* Left — dark panel */}
        <div className="rg-left">
          <div className="rg-glow" /><div className="rg-glow rg-glow-2" />
          <div className="rg-brand">
            <div className="rg-brand-icon"><Bot size={20} color="white" /></div>
            <div>
              <div className="rg-brand-name">Talvion AI</div>
              <div className="rg-brand-sub">AI-powered engine</div>
            </div>
          </div>

          <div className="rg-hero">
            <h2 className="rg-headline">Land your dream job<br /><span className="rg-accent">on autopilot</span></h2>
            <p className="rg-sub">Create a free account and let your AI agent handle the entire job application process from start to finish.</p>
            {PERKS.map((perk, i) => (
              <div key={i} className="rg-perk">
                <CheckCircle size={16} color="#10b981" style={{flexShrink:0}} />
                <span className="rg-perk-text">{perk}</span>
              </div>
            ))}
          </div>

          <p className="rg-footer">© {new Date().getFullYear()} Talvion AI · All rights reserved</p>
        </div>

        {/* Right — form */}
        <div className="rg-right">
          <div className="rg-card">
            <div className="rg-mobile-brand">
              <div className="rg-mobile-icon"><Bot size={17} color="white" /></div>
              <span style={{color:'#0f172a',fontWeight:700,fontSize:'1rem'}}>Talvion AI</span>
            </div>

            <div className="rg-form-box">
              <h1 className="rg-title">Create your account</h1>
              <p className="rg-sub-link">Already have one? <Link to="/login">Sign in</Link></p>
              <div className="rg-divider" />

              <form onSubmit={handleSubmit(onSubmit)} className="rg-fields">
                <div>
                  <label className="rg-label">Full Name</label>
                  <div className="rg-wrap">
                    <User className="rg-icon" size={15} />
                    <input {...register('name', { required: 'Full name is required', minLength: { value: 2, message: 'Minimum 2 characters' } })}
                      type="text" placeholder="John Doe" className={`rg-input${errors.name ? ' err' : ''}`} />
                  </div>
                  {errors.name && <p className="rg-err">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="rg-label">Email address</label>
                  <div className="rg-wrap">
                    <Mail className="rg-icon" size={15} />
                    <input {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' } })}
                      type="email" placeholder="you@example.com" className={`rg-input${errors.email ? ' err' : ''}`} />
                  </div>
                  {errors.email && <p className="rg-err">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="rg-label">Password</label>
                  <div className="rg-wrap">
                    <Lock className="rg-icon" size={15} />
                    <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                      type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" className={`rg-input${errors.password ? ' err' : ''}`} />
                    <button type="button" className="rg-eye" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="rg-err">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="rg-label">Confirm Password</label>
                  <div className="rg-wrap">
                    <Lock className="rg-icon" size={15} />
                    <input {...register('confirmPassword', { required: 'Please confirm your password', validate: v => v === watch('password') || 'Passwords do not match' })}
                      type="password" placeholder="Re-enter password" className={`rg-input${errors.confirmPassword ? ' err' : ''}`} />
                  </div>
                  {errors.confirmPassword && <p className="rg-err">{errors.confirmPassword.message}</p>}
                </div>

                <button type="submit" disabled={isLoading} className="rg-btn">
                  {isLoading
                    ? <><Loader2 size={15} className="rg-spin" /> Creating account...</>
                    : <><span>Create free account</span><ArrowRight size={15} /></>}
                </button>
              </form>
              <p className="rg-form-footer">By creating an account you agree to our Terms of Service and Privacy Policy</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
