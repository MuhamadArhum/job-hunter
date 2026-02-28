import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, Bot, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PERKS = [
  'Automated job search across 100+ boards',
  'AI-tailored CV for every application',
  'Smart HR email finding & sending',
  'Full session history & tracking',
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .reg-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
        .reg-root { min-height: 100vh; display: flex; background: #f7fdf9; }

        .rg-left {
          display: none; width: 50%;
          background: linear-gradient(160deg, #f0faf5 0%, #e8f7ef 60%, #f0faf5 100%);
          border-right: 1px solid #d4ede2;
          flex-direction: column; justify-content: space-between;
          padding: 3rem; position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .rg-left { display: flex; } }

        .rg-glow-1 { position: absolute; top: -60px; right: -60px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(16,185,129,0.11) 0%, transparent 65%); border-radius: 50%; }
        .rg-glow-2 { position: absolute; bottom: -60px; left: -60px; width: 270px; height: 270px; background: radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 65%); border-radius: 50%; }

        .rg-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .rg-brand-icon { width: 44px; height: 44px; background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
        .rg-brand-name { color: #0f2d20; font-weight: 800; font-size: 1.15rem; }
        .rg-brand-sub  { color: #10b981; font-size: 0.72rem; margin-top: 1px; font-weight: 600; }

        .rg-hero { position: relative; z-index: 1; }
        .rg-headline { color: #0f2d20; font-size: 2rem; font-weight: 800; line-height: 1.2; margin-bottom: 10px; }
        .rg-accent { background: linear-gradient(90deg,#10b981,#0d9488); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .rg-sub { color: #6a9e82; font-size: 0.85rem; line-height: 1.65; margin-bottom: 2rem; }

        .rg-perk { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .rg-perk-text { color: #2d6048; font-size: 0.875rem; font-weight: 500; }
        .rg-footer { color: #b2d9c5; font-size: 0.7rem; position: relative; z-index: 1; }

        /* Right */
        .rg-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; background: #fff; }
        .rg-card { width: 100%; max-width: 400px; }

        .rg-mobile-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 2.2rem; }
        .rg-mobile-icon { width: 36px; height: 36px; background: linear-gradient(135deg,#10b981,#0d9488); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(16,185,129,0.25); }
        @media (min-width: 1024px) { .rg-mobile-brand { display: none; } }

        .rg-title { color: #0f2d20; font-size: 1.6rem; font-weight: 800; margin-bottom: 6px; }
        .rg-sub-link { color: #7dba9a; font-size: 0.85rem; margin-bottom: 1.8rem; }
        .rg-sub-link a { color: #10b981; font-weight: 700; text-decoration: none; }
        .rg-sub-link a:hover { color: #0d9488; }

        .rg-label { display: block; font-size: 0.7rem; font-weight: 700; color: #6a9e82; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .rg-wrap { position: relative; }
        .rg-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: #b2d9c5; }
        .rg-input {
          width: 100%; background: #f7fdf9; border: 1px solid #c8e8d8; border-radius: 12px;
          padding: 11px 44px; font-size: 0.875rem; color: #0f2d20; outline: none;
          transition: all 0.2s; font-family: inherit;
        }
        .rg-input::placeholder { color: #b2d9c5; }
        .rg-input:focus { border-color: #10b981; background: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
        .rg-input.err { border-color: #fca5a5; }
        .rg-input.err:focus { box-shadow: 0 0 0 3px rgba(252,165,165,0.15); }
        .rg-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: #b2d9c5; transition: color 0.2s; }
        .rg-eye:hover { color: #10b981; }
        .rg-err { font-size: 0.72rem; color: #ef4444; margin-top: 5px; }

        .rg-btn {
          width: 100%; background: linear-gradient(135deg,#10b981,#0d9488);
          color: #fff; font-weight: 700; font-family: inherit; font-size: 0.9rem;
          border: none; border-radius: 12px; padding: 12px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 3px 14px rgba(16,185,129,0.28); transition: all 0.2s; margin-top: 6px;
        }
        .rg-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.36); }
        .rg-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .rg-spin { animation: rgSpin 1s linear infinite; }
        @keyframes rgSpin { to { transform: rotate(360deg); } }
        .rg-form-footer { margin-top: 1.4rem; text-align: center; color: #c8e8d8; font-size: 0.7rem; }
        .rg-fields { display: flex; flex-direction: column; gap: 14px; }
      `}</style>

      <div className="reg-root">

        {/* Left */}
        <div className="rg-left">
          <div className="rg-glow-1" /><div className="rg-glow-2" />
          <div className="rg-brand">
            <div className="rg-brand-icon"><Bot style={{width:22,height:22,color:'white'}} /></div>
            <div><div className="rg-brand-name">Job Hunt Agent</div><div className="rg-brand-sub">AI-powered application engine</div></div>
          </div>

          <div className="rg-hero">
            <h2 className="rg-headline">Land your dream job<br /><span className="rg-accent">on autopilot</span></h2>
            <p className="rg-sub">Create a free account and let your AI agent handle the entire job application process.</p>
            {PERKS.map((perk, i) => (
              <div key={i} className="rg-perk">
                <CheckCircle style={{width:17,height:17,color:'#10b981',flexShrink:0}} />
                <span className="rg-perk-text">{perk}</span>
              </div>
            ))}
          </div>

          <p className="rg-footer">© {new Date().getFullYear()} Job Hunt Agent. All rights reserved.</p>
        </div>

        {/* Right */}
        <div className="rg-right">
          <div className="rg-card">
            <div className="rg-mobile-brand">
              <div className="rg-mobile-icon"><Bot style={{width:18,height:18,color:'white'}} /></div>
              <span style={{color:'#0f2d20',fontWeight:700,fontSize:'1.05rem'}}>Job Hunt Agent</span>
            </div>

            <h1 className="rg-title">Create your account</h1>
            <p className="rg-sub-link">Already have an account? <Link to="/login">Sign in</Link></p>

            <form onSubmit={handleSubmit(onSubmit)} className="rg-fields">
              <div>
                <label className="rg-label">Full Name</label>
                <div className="rg-wrap">
                  <User className="rg-icon" />
                  <input {...register('name', { required: 'Full name is required', minLength: { value: 2, message: 'Minimum 2 characters' } })}
                    type="text" placeholder="John Doe" className={`rg-input${errors.name ? ' err' : ''}`} />
                </div>
                {errors.name && <p className="rg-err">{errors.name.message}</p>}
              </div>

              <div>
                <label className="rg-label">Email address</label>
                <div className="rg-wrap">
                  <Mail className="rg-icon" />
                  <input {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' } })}
                    type="email" placeholder="you@example.com" className={`rg-input${errors.email ? ' err' : ''}`} />
                </div>
                {errors.email && <p className="rg-err">{errors.email.message}</p>}
              </div>

              <div>
                <label className="rg-label">Password</label>
                <div className="rg-wrap">
                  <Lock className="rg-icon" />
                  <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                    type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" className={`rg-input${errors.password ? ' err' : ''}`} />
                  <button type="button" className="rg-eye" onClick={() => setShowPassword(s => !s)}>
                    {showPassword ? <EyeOff style={{width:16,height:16}} /> : <Eye style={{width:16,height:16}} />}
                  </button>
                </div>
                {errors.password && <p className="rg-err">{errors.password.message}</p>}
              </div>

              <div>
                <label className="rg-label">Confirm Password</label>
                <div className="rg-wrap">
                  <Lock className="rg-icon" />
                  <input {...register('confirmPassword', { required: 'Please confirm your password', validate: v => v === watch('password') || 'Passwords do not match' })}
                    type="password" placeholder="Re-enter password" className={`rg-input${errors.confirmPassword ? ' err' : ''}`} />
                </div>
                {errors.confirmPassword && <p className="rg-err">{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className="rg-btn">
                {isLoading
                  ? <><Loader2 style={{width:16,height:16}} className="rg-spin" /> Creating account...</>
                  : <><span>Create free account</span><ArrowRight style={{width:16,height:16}} /></>}
              </button>
            </form>
            <p className="rg-form-footer">By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;