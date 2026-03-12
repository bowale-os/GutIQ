import { useState, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import { STYLES, FONTS } from '../constants/styles';
import { clearStoredUser } from '../api/client';
import { update, getUserData } from '../api/user';
import { DIGESTIVE_CONDITIONS as CONDITIONS, AGE_RANGES } from '../api/schemas';

const GOALS = ['Track symptoms', 'Identify triggers', 'Improve diet', 'Prepare for doctor visit', 'General wellness'];

function SelectPill({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500,
              padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
              border: active ? `1.5px solid ${COLORS.orange}` : `1px solid ${COLORS.border}`,
              backgroundColor: active ? COLORS.orangeLight : COLORS.surface,
              color: active ? COLORS.orange : COLORS.muted,
              transition: 'all 0.15s ease',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ ...STYLES.label, marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  );
}

export default function Profile({ user, navigate, onUpdate }) {
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved,     setSaved]     = useState(false);
  const [liveUser,  setLiveUser]  = useState(user);

  useEffect(() => {
    getUserData()
      .then(data => {
        setLiveUser(prev => ({ ...prev, ...data }));
        setDraft(d => ({
          email:               data.email               ?? d.email,
          digestive_condition: data.digestive_condition ?? d.digestive_condition,
          goal:                data.goal                ?? d.goal,
          age_range:           data.age_range           ?? d.age_range,
        }));
      })
      .catch(() => {}); // silently fall back to prop data
  }, []);

  const [draft, setDraft] = useState({
    email:               liveUser?.email               ?? '',
    digestive_condition: liveUser?.digestive_condition ?? '',
    goal:                liveUser?.goal                ?? '',
    age_range:           liveUser?.age_range           ?? '',
  });

  const initials = (liveUser?.name || liveUser?.email || 'U')
    .split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleCancel = () => {
    setDraft({
      email:               liveUser?.email               ?? '',
      digestive_condition: liveUser?.digestive_condition ?? '',
      goal:                liveUser?.goal                ?? '',
      age_range:           liveUser?.age_range           ?? '',
    });
    setSaveError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await update(draft);
      setLiveUser(prev => ({ ...prev, ...updated }));
      onUpdate?.(updated);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...STYLES.page, paddingBottom: 96 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            backgroundColor: COLORS.orangeLight,
            border: `1.5px solid ${COLORS.orangeBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONTS.serif, fontSize: 18, color: COLORS.orange,
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: FONTS.serif, fontSize: 26, color: COLORS.text, letterSpacing: '-0.01em', margin: '0 0 2px' }}>
              {liveUser?.name ?? 'Your Profile'}
            </h1>
            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, margin: 0 }}>
              {liveUser?.email}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {liveUser?.digestive_condition && (
            <span style={{ ...STYLES.chip, ...STYLES.chipOrange }}>
              {liveUser.digestive_condition}
            </span>
          )}
          {liveUser?.age_range && (
            <span style={{ ...STYLES.chip, ...STYLES.chipMuted }}>
              {liveUser.age_range}
            </span>
          )}
        </div>

        {/* Success banner */}
        {saved && (
          <div style={{
            backgroundColor: COLORS.tealLight, border: `1px solid ${COLORS.tealBorder}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            fontFamily: FONTS.sans, fontSize: 14, color: COLORS.teal,
            animation: 'fadeSlideUp 0.2s ease',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✓ Profile updated
          </div>
        )}

        {/* Error banner */}
        {saveError && (
          <div style={{
            backgroundColor: COLORS.dangerDim, border: `1px solid ${COLORS.dangerBorder}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            fontFamily: FONTS.sans, fontSize: 14, color: COLORS.danger,
            animation: 'fadeSlideUp 0.2s ease',
          }}>
            {saveError}
          </div>
        )}

        {/* Health profile card */}
        <div style={{ ...STYLES.card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ fontFamily: FONTS.serif, fontSize: 18, color: COLORS.text, margin: 0 }}>Health Profile</p>
            <button
              onClick={() => editing ? handleCancel() : setEditing(true)}
              style={{
                fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.07em',
                padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                border: editing ? `1px solid ${COLORS.dangerBorder}` : `1px solid ${COLORS.border}`,
                backgroundColor: 'transparent',
                color: editing ? COLORS.danger : COLORS.muted,
              }}
            >
              {editing ? 'CANCEL' : 'EDIT'}
            </button>
          </div>

          <Field label="Email">
            {editing ? (
              <input
                type="email"
                value={draft.email}
                onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                style={STYLES.input}
                onFocus={e => e.target.style.borderColor = COLORS.orange}
                onBlur={e => e.target.style.borderColor = COLORS.border}
              />
            ) : (
              <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text, margin: 0 }}>
                {liveUser?.email ?? '—'}
              </p>
            )}
          </Field>

          <div style={STYLES.divider} />

          <Field label="Digestive condition">
            {editing ? (
              <SelectPill options={CONDITIONS} value={draft.digestive_condition}
                onChange={v => setDraft(d => ({ ...d, digestive_condition: v }))} />
            ) : (
              <span style={{ ...STYLES.chip, ...STYLES.chipOrange }}>
                {liveUser?.digestive_condition ?? '—'}
              </span>
            )}
          </Field>

          <div style={STYLES.divider} />

          <Field label="Goal">
            {editing ? (
              <SelectPill options={GOALS} value={draft.goal}
                onChange={v => setDraft(d => ({ ...d, goal: v }))} />
            ) : (
              <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text, margin: 0 }}>
                {liveUser?.goal ?? '—'}
              </p>
            )}
          </Field>

          <div style={STYLES.divider} />

          <Field label="Age range">
            {editing ? (
              <SelectPill options={AGE_RANGES} value={draft.age_range}
                onChange={v => setDraft(d => ({ ...d, age_range: v }))} />
            ) : (
              <span style={{ ...STYLES.chip, ...STYLES.chipMuted }}>
                {liveUser?.age_range ?? '—'}
              </span>
            )}
          </Field>

          {editing && (
            <button onClick={handleSave} disabled={saving}
              style={{ ...STYLES.btnPrimary, marginTop: 4, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>

        {/* Account */}
        {!editing && (
          <div style={{ ...STYLES.card, marginBottom: 12 }}>
            <p style={{ ...STYLES.label, marginBottom: 14 }}>Account</p>
            <button
              onClick={() => { clearStoredUser(); navigate('login'); }}
              style={{
                fontFamily: FONTS.sans, fontSize: 14, fontWeight: 500,
                background: 'none', border: `1px solid ${COLORS.dangerBorder}`,
                borderRadius: 10, padding: '11px 16px',
                color: COLORS.danger, cursor: 'pointer', width: '100%',
              }}
            >
              Sign out
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
