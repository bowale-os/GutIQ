import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { signup, checkUsername } from '../api/auth';
import { setToken, storeUser } from '../api/client';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// Debounce helper
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Signup({ navigate }) {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [email,     setEmail]     = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [focused,   setFocused]   = useState('');
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);

  // Username availability check
  const [usernameStatus, setUsernameStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const debouncedUsername = useDebounce(username, 500);

  useEffect(() => {
    if (!debouncedUsername) { setUsernameStatus('idle'); return; }
    if (!USERNAME_RE.test(debouncedUsername)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    checkUsername(debouncedUsername)
      .then(({ available }) => setUsernameStatus(available ? 'available' : 'taken'))
      .catch(() => setUsernameStatus('idle'));
  }, [debouncedUsername]);

  const validate = () => {
    const e = {};
    if (!USERNAME_RE.test(username))       e.username = 'Letters, numbers, underscores only. 3–30 chars.';
    if (usernameStatus === 'taken')        e.username = 'That username is taken.';
    if (password.length < 8)              e.password = 'At least 8 characters.';
    if (confirm !== password)             e.confirm  = 'Passwords do not match.';
    if (email && !email.includes('@'))    e.email    = 'Enter a valid email address.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = await signup(username.toLowerCase(), password, email || null);
      setToken(data.access_token);
      storeUser(username.toLowerCase(), data.user_id);
      navigate('onboarding');
    } catch (err) {
      setErrors({ general: err.message || 'Signup failed. Try a different username.' });
    } finally {
      setLoading(false);
    }
  };

  // Username status indicator
  const UsernameIndicator = () => {
    if (!username) return null;
    if (usernameStatus === 'checking') return <Loader size={14} color={COLORS.muted} style={{ animation: 'spin 0.8s linear infinite' }} />;
    if (usernameStatus === 'available') return <CheckCircle size={14} color={COLORS.teal} />;
    if (usernameStatus === 'taken')    return <XCircle size={14} color={COLORS.danger} />;
    if (usernameStatus === 'invalid')  return <XCircle size={14} color={COLORS.mutedLight} />;
    return null;
  };

  const usernameBorderColor = () => {
    if (focused === 'username') return COLORS.orange;
    if (usernameStatus === 'available') return COLORS.teal;
    if (usernameStatus === 'taken' || (errors.username && usernameStatus !== 'available')) return COLORS.danger;
    return COLORS.border;
  };

  return (
    <div style={{ ...STYLES.page, ...STYLES.centeredAuth }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 2, marginBottom: 8 }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 48, color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1 }}>Gut</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 48, color: COLORS.orange, letterSpacing: '-0.02em', lineHeight: 1 }}>IQ</span>
        </div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted }}>Create your account</p>
      </div>

      <div style={{ ...STYLES.card, padding: '28px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Username */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={STYLES.label}>Username</p>
              <UsernameIndicator />
            </div>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setErrors(ev => ({ ...ev, username: undefined })); }}
              onFocus={() => setFocused('username')}
              onBlur={() => setFocused('')}
              placeholder="gut_warrior"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ ...STYLES.input, borderColor: usernameBorderColor(), transition: 'border-color 0.2s ease' }}
            />
            {usernameStatus === 'available' && (
              <p style={{ fontSize: 12, color: COLORS.teal, marginTop: 4 }}>@{username.toLowerCase()} is available</p>
            )}
            {usernameStatus === 'taken' && (
              <p style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>That username is taken</p>
            )}
            {usernameStatus === 'invalid' && username.length > 0 && (
              <p style={{ fontSize: 12, color: COLORS.mutedLight, marginTop: 4 }}>Letters, numbers, underscores · 3–30 characters</p>
            )}
          </div>

          {/* Password */}
          <div>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Password</p>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(ev => ({ ...ev, password: undefined })); }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused('')}
              placeholder="8+ characters"
              style={{ ...STYLES.input, borderColor: errors.password ? COLORS.danger : focused === 'password' ? COLORS.orange : COLORS.border }}
            />
            {errors.password && <p style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{errors.password}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Confirm password</p>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setErrors(ev => ({ ...ev, confirm: undefined })); }}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused('')}
              placeholder="Repeat password"
              style={{ ...STYLES.input, borderColor: errors.confirm ? COLORS.danger : focused === 'confirm' ? COLORS.orange : COLORS.border }}
            />
            {errors.confirm && <p style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{errors.confirm}</p>}
          </div>

          {/* Email — optional, collapsed by default */}
          {!showEmail ? (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight,
                letterSpacing: '0.05em', textAlign: 'left',
                textDecoration: 'underline', textDecorationColor: 'transparent',
                borderBottom: `1px dashed ${COLORS.border}`, width: 'fit-content',
              }}
            >
              + Add email for account recovery (optional)
            </button>
          ) : (
            <div style={{ animation: 'fadeSlideUp 0.2s ease both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={STYLES.label}>Email <span style={{ color: COLORS.mutedLight, fontWeight: 400 }}>(optional)</span></p>
                <button type="button" onClick={() => { setShowEmail(false); setEmail(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>remove</button>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(ev => ({ ...ev, email: undefined })); }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused('')}
                placeholder="you@example.com"
                style={{ ...STYLES.input, borderColor: errors.email ? COLORS.danger : focused === 'email' ? COLORS.orange : COLORS.border }}
              />
              {errors.email && <p style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{errors.email}</p>}
              <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight, marginTop: 6 }}>
                Only used for account recovery. Never shared.
              </p>
            </div>
          )}

          {errors.general && (
            <p style={{
              fontSize: 13, color: COLORS.danger,
              backgroundColor: COLORS.dangerDim, border: `1px solid ${COLORS.dangerBorder}`,
              borderRadius: 8, padding: '8px 12px', animation: 'fadeSlideUp 0.2s ease',
            }}>
              {errors.general}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken'}
            style={{ ...STYLES.btnPrimary, marginTop: 4, opacity: (loading || usernameStatus === 'taken') ? 0.5 : 1 }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>

      <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, textAlign: 'center', marginTop: 16, letterSpacing: '0.04em' }}>
        No email required · Your data is yours
      </p>

      <p style={{ textAlign: 'center', fontSize: 14, color: COLORS.muted, marginTop: 16 }}>
        Already have an account?{' '}
        <button onClick={() => navigate('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.orange, fontWeight: 600, fontSize: 14, fontFamily: FONTS.sans }}>
          Sign in
        </button>
      </p>
    </div>
  );
}
