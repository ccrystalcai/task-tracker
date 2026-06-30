import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Envelope, Lock, Eye, EyeSlash } from '@phosphor-icons/react';

/* ── Notion-template inspired cosmic login ── */

const COLORS = {
  midnight: '#2b1e3e',
  darkPurple: '#1a1028',
  cosmic: '#4a4e8f',
  lavender: '#a490c2',
  lavenderLight: '#c4b8d8',
  silver: '#e6e6fa',
} as const;

export default function Login() {
  const { user, loading, signInWithEmail, signUpWithEmail } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.midnight} 0%, ${COLORS.darkPurple} 50%, ${COLORS.cosmic} 100%)` }}>
        <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!email.trim() || !password) {
      setMsg({ type: 'error', text: '请输入邮箱和密码' });
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setMsg({ type: 'error', text: '两次密码输入不一致' });
      return;
    }

    if (password.length < 6) {
      setMsg({ type: 'error', text: '密码至少 6 位' });
      return;
    }

    setBusy(true);
    const result = isSignUp
      ? await signUpWithEmail(email.trim(), password)
      : await signInWithEmail(email.trim(), password);

    if (result.error) {
      setMsg({ type: 'error', text: result.error });
    } else if (isSignUp) {
      setMsg({ type: 'success', text: '注册成功！请查看邮箱确认，或直接登录。' });
      setIsSignUp(false);
    }
    setBusy(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${COLORS.midnight} 0%, ${COLORS.darkPurple} 50%, ${COLORS.cosmic} 100%)` }}
    >
      {/* Stars / sparkles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{
        background: [
          `radial-gradient(1px 1px at 10% 15%, rgba(230,230,250,0.40), transparent)`,
          `radial-gradient(1px 1px at 25% 70%, rgba(230,230,250,0.35), transparent)`,
          `radial-gradient(1.5px 1.5px at 40% 30%, rgba(230,230,250,0.30), transparent)`,
          `radial-gradient(1px 1px at 55% 80%, rgba(230,230,250,0.40), transparent)`,
          `radial-gradient(1.5px 1.5px at 70% 20%, rgba(230,230,250,0.25), transparent)`,
          `radial-gradient(2px 2px at 85% 55%, rgba(230,230,250,0.35), transparent)`,
          `radial-gradient(1px 1px at 15% 90%, rgba(230,230,250,0.20), transparent)`,
          `radial-gradient(1px 1px at 60% 45%, rgba(230,230,250,0.30), transparent)`,
          `radial-gradient(1.5px 1.5px at 90% 10%, rgba(230,230,250,0.40), transparent)`,
          `radial-gradient(1px 1px at 35% 60%, rgba(230,230,250,0.25), transparent)`,
          `radial-gradient(1px 1px at 75% 85%, rgba(230,230,250,0.20), transparent)`,
          `radial-gradient(1.5px 1.5px at 5% 40%, rgba(230,230,250,0.30), transparent)`,
        ].join(', '),
      }} />

      <div className="w-full max-w-md relative z-10" style={{ animation: 'loginSlideUp 0.5s ease-out' }}>
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `rgba(164,144,194,0.12)`, border: '1px solid rgba(164,144,194,0.18)' }}>
            <span className="text-2xl" style={{ color: COLORS.lavender }}>✦</span>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.silver }}>TaskTracker</h1>
          <p className="text-sm" style={{ color: 'rgba(230,230,250,0.45)' }}>
            拆解目标 · 管理任务 · 追踪成长
          </p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(74,78,143,0.12)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(164,144,194,0.14)',
          }}
        >
          <h2 className="text-lg font-semibold text-center mb-5" style={{ color: COLORS.silver }}>
            {isSignUp ? '成为会员' : '会员登录'}
          </h2>

          {/* Badges (sign up only) */}
          {isSignUp && (
            <div className="flex items-center justify-center gap-3 mb-5 text-xs" style={{ color: 'rgba(230,230,250,0.4)' }}>
              <span>✦ 云端同步</span>
              <span>✦ 跨设备访问</span>
              <span>✦ 免费使用</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'rgba(230,230,250,0.55)' }}>邮箱</label>
              <div className="relative">
                <Envelope size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(230,230,250,0.25)' }} />
                <input
                  type="email"
                  className="login-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{
                    background: 'rgba(74,78,143,0.25)',
                    border: '1px solid rgba(164,144,194,0.15)',
                    color: COLORS.silver,
                  }}
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(164,144,194,0.45)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(164,144,194,0.15)'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'rgba(230,230,250,0.55)' }}>密码</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(230,230,250,0.25)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{
                    background: 'rgba(74,78,143,0.25)',
                    border: '1px solid rgba(164,144,194,0.15)',
                    color: COLORS.silver,
                  }}
                  placeholder={isSignUp ? '至少 6 位' : '输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(164,144,194,0.45)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(164,144,194,0.15)'; }}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(230,230,250,0.35)' }}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (sign up only) */}
            {isSignUp && (
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'rgba(230,230,250,0.55)' }}>确认密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(230,230,250,0.25)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                    style={{
                      background: 'rgba(74,78,143,0.25)',
                      border: '1px solid rgba(164,144,194,0.15)',
                      color: COLORS.silver,
                    }}
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(164,144,194,0.45)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(164,144,194,0.15)'; }}
                  />
                </div>
              </div>
            )}

            {/* Message */}
            {msg && (
              <div
                className="text-xs px-3 py-2 rounded-lg"
                style={msg.type === 'success'
                  ? { background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }
                  : { background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }
                }
              >
                {msg.text}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-full font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: COLORS.lavender,
                color: COLORS.darkPurple,
              }}
              onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = COLORS.lavenderLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.lavender; }}
            >
              {busy ? '处理中…' : isSignUp ? '注册' : '登录'}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-sm text-center mt-5" style={{ color: 'rgba(230,230,250,0.35)' }}>
            {isSignUp ? '已有账号？' : '没有账号？'}
            {' '}
            <button
              type="button"
              className="font-medium transition-colors"
              style={{ color: 'rgba(164,144,194,0.70)' }}
              onClick={() => { setIsSignUp(!isSignUp); setMsg(null); }}
              onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.lavender; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(164,144,194,0.70)'; }}
            >
              {isSignUp ? '去登录' : '去注册'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-center mt-5" style={{ color: 'rgba(230,230,250,0.25)' }}>
          登录即表示同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
