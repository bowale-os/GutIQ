import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';

export default function Login({ navigate }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [focused,  setFocused]  = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@') || password.length < 6) {
      setError('Invalid email or password (min 6 characters).');
      return;
    }
    navigate('dashboard');
  };

  return (
    <div style={{ ...STYLES.page, ...STYLES.centeredAuth }}>

      {/* Logo + tagline */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 2, marginBottom: 12 }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 54, color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1 }}>Gut</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 54, color: COLORS.orange, letterSpacing: '-0.02em', lineHeight: 1 }}>IQ</span>
        </div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.muted, lineHeight: 1.6 }}>
          Understand your gut.<br />One voice note a day.
        </p>
      </div>

      {/* Form card */}
      <div style={{ ...STYLES.card, padding: '28px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Email</p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
              placeholder="you@example.com"
              style={{ ...STYLES.input, borderColor: focused === 'email' ? COLORS.orange : COLORS.border }}
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

          <button type="submit" style={{ ...STYLES.btnPrimary, marginTop: 4 }}>Sign in</button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: 14, color: COLORS.muted, marginTop: 24 }}>
        No account?{' '}
        <button onClick={() => navigate('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.orange, fontWeight: 600, fontSize: 14, fontFamily: FONTS.sans }}>
          Create one free
        </button>
      </p>
      <p style={{ textAlign: 'center', marginTop: 14 }}>
        <button onClick={() => navigate('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.mutedLight, fontSize: 12, fontFamily: FONTS.mono, letterSpacing: '0.04em', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          skip to demo →
        </button>
      </p>
    </div>
  );
}
