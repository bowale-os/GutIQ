import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { login }     from '../api/auth';
import { getStatus } from '../api/onboarding';
import { getUserData } from '../api/user';
import { setToken, storeUser } from '../api/client';

export default function Login({ navigate, onDemo, onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [focused,    setFocused]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || password.length < 6) {
      setError('Enter your username or email, and password (min 6 characters).');
      return;
    }
    setLoading(true);
    try {
      const data = await login(identifier.trim(), password);
      setToken(data.access_token);
      storeUser(identifier.trim(), data.user_id);
      try { const u = await getUserData(); if (u.name || u.username) storeUser(u.username || identifier.trim(), data.user_id, u.name, '', u.email || ''); } catch {}
      onLogin?.();
      try {
        const status = await getStatus();
        navigate(status.is_complete ? 'dashboard' : 'onboarding');
      } catch {
        navigate('dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...STYLES.page, ...STYLES.centeredAuth }}>

      {/* Logo + tagline */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 2, marginBottom: 12 }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 'clamp(38px, 12vw, 54px)', color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1 }}>Gut</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 'clamp(38px, 12vw, 54px)', color: COLORS.orange, letterSpacing: '-0.02em', lineHeight: 1 }}>IQ</span>
        </div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.muted, lineHeight: 1.6 }}>
          Understand your gut.<br />One voice note a day.
        </p>
      </div>

      {/* Form card */}
      <div style={{ ...STYLES.card, padding: 'clamp(18px, 4vw, 28px) clamp(16px, 4vw, 24px)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Username or email</p>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              onFocus={() => setFocused('identifier')}
              onBlur={() => setFocused('')}
              placeholder="your_username"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ ...STYLES.input, borderColor: focused === 'identifier' ? COLORS.orange : COLORS.border }}
            />
          </div>
          <div>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Password</p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused('')}
              placeholder="••••••••"
              style={{ ...STYLES.input, borderColor: focused === 'password' ? COLORS.orange : COLORS.border }}
            />
          </div>

          {error && (
            <p style={{
              fontSize: 13, color: COLORS.danger,
              backgroundColor: COLORS.dangerDim,
              border: `1px solid ${COLORS.dangerBorder}`,
              borderRadius: 8, padding: '8px 12px',
              animation: 'fadeSlideUp 0.2s ease',
            }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{ ...STYLES.btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: 14, color: COLORS.muted, marginTop: 24 }}>
        No account?{' '}
        <button onClick={() => navigate('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.orange, fontWeight: 600, fontSize: 14, fontFamily: FONTS.sans }}>
          Create one free
        </button>
      </p>
      <p style={{ textAlign: 'center', marginTop: 14 }}>
        <button onClick={() => navigate('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.mutedLight, fontSize: 12, fontFamily: FONTS.mono, letterSpacing: '0.04em', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          ← back to home
        </button>
      </p>
    </div>
  );
}
