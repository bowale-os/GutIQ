import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';

export default function Signup({ navigate }) {
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors,  setErrors]  = useState({});
  const [focused, setFocused] = useState('');

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())              e.name     = 'Name is required.';
    if (!form.email.includes('@'))      e.email    = 'Enter a valid email.';
    if (form.password.length < 8)       e.password = 'Password must be at least 8 characters.';
    if (form.confirm !== form.password) e.confirm  = 'Passwords do not match.';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    navigate('onboarding');
  };

  const fields = [
    { key: 'name',     label: 'Full name',       type: 'text',     placeholder: 'Alex Rivera' },
    { key: 'email',    label: 'Email',            type: 'email',    placeholder: 'you@example.com' },
    { key: 'password', label: 'Password',         type: 'password', placeholder: '8+ characters' },
    { key: 'confirm',  label: 'Confirm password', type: 'password', placeholder: 'Repeat password' },
  ];

  return (
    <div style={{ ...STYLES.page, ...STYLES.centeredAuth }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 2, marginBottom: 8 }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 48, color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1 }}>Gut</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 48, color: COLORS.orange, letterSpacing: '-0.02em', lineHeight: 1 }}>IQ</span>
        </div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted }}>Create your account</p>
      </div>

      {/* Form card */}
      <div style={{ ...STYLES.card, padding: '28px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <p style={{ ...STYLES.label, marginBottom: 6 }}>{label}</p>
              <input
                type={type}
                value={form[key]}
                onChange={e => update(key, e.target.value)}
                onFocus={() => setFocused(key)}
                onBlur={() => setFocused('')}
                placeholder={placeholder}
                style={{
                  ...STYLES.input,
                  borderColor: errors[key] ? COLORS.danger : focused === key ? COLORS.orange : COLORS.border,
                }}
              />
              {errors[key] && (
                <p style={{ fontSize: 12, color: COLORS.danger, marginTop: 4, animation: 'fadeSlideUp 0.2s ease' }}>
                  {errors[key]}
                </p>
              )}
            </div>
          ))}
          <button type="submit" style={{ ...STYLES.btnPrimary, marginTop: 4 }}>Create account</button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: 14, color: COLORS.muted, marginTop: 24 }}>
        Already have an account?{' '}
        <button onClick={() => navigate('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.orange, fontWeight: 600, fontSize: 14, fontFamily: FONTS.sans }}>
          Sign in
        </button>
      </p>
    </div>
  );
}
