import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { STYLES, FONTS } from '../constants/styles';

const CONDITIONS = ['IBS', "Crohn's Disease", 'Ulcerative Colitis', 'GERD', 'Celiac Disease', 'Other'];
const GOALS = ['Track symptoms', 'Identify triggers', 'Improve diet', 'Prepare for doctor visit', 'General wellness'];
const AGE_RANGES = ['Under 20', '20–30', '30–40', '40–50', '50+'];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ ...STYLES.label, marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );
}

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

export default function Profile({ user, navigate, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [draft, setDraft] = useState({
    email: user?.email ?? '',
    digestive_condition: user?.digestive_condition ?? '',
    goal: user?.goal ?? '',
    age_range: user?.age_range ?? '',
  });

  const initials = (user?.name ?? user?.email ?? 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleCancel = () => {
    setDraft({
      email: user?.email ?? '',
      digestive_condition: user?.digestive_condition ?? '',
      goal: user?.goal ?? '',
      age_range: user?.age_range ?? '',
    });
    setSaveError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // PATCH /api/v1/users/me
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: draft.email || undefined,
          digestive_condition: draft.digestive_condition || undefined,
          goal: draft.goal || undefined,
          age_range: draft.age_range || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }

      const updated = await res.json();
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
      {/* Header */}
      <div style={{
        padding: '56px 24px 24px',
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.surface,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            backgroundColor: COLORS.orangeLight,
            border: `2px solid ${COLORS.orangeBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONTS.serif, fontSize: 22, color: COLORS.orange,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ ...STYLES.h2, fontSize: 22, margin: 0 }}>
              {user?.name ?? 'Your Profile'}
            </h2>
            <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={() => editing ? handleCancel() : setEditing(true)}
            style={{
              fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500,
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${COLORS.border}`,
              backgroundColor: editing ? COLORS.surfaceAlt : COLORS.surface,
              color: editing ? COLORS.muted : COLORS.text,
              flexShrink: 0,
            }}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 24px 0' }}>

        {/* Success banner */}
        {saved && (
          <div style={{
            backgroundColor: COLORS.tealLight,
            border: `1px solid ${COLORS.tealBorder}`,
            borderRadius: 12, padding: '12px 16px',
            fontFamily: FONTS.sans, fontSize: 14, color: COLORS.teal,
            marginBottom: 20, animation: 'fadeIn 0.2s ease',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✓ Profile updated
          </div>
        )}

        {/* Error banner */}
        {saveError && (
          <div style={{
            backgroundColor: COLORS.dangerDim,
            border: `1px solid ${COLORS.dangerBorder}`,
            borderRadius: 12, padding: '12px 16px',
            fontFamily: FONTS.sans, fontSize: 14, color: COLORS.danger,
            marginBottom: 20,
          }}>
            {saveError}
          </div>
        )}

        {/* Email */}
        <div style={{ ...STYLES.card, marginBottom: 16 }}>
          <Section title="Email">
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
                {user?.email ?? '—'}
              </p>
            )}
          </Section>
        </div>

        {/* Health profile */}
        <div style={{ ...STYLES.card, marginBottom: 16 }}>
          <p style={{ fontFamily: FONTS.serif, fontSize: 18, color: COLORS.text, margin: '0 0 20px' }}>
            Health Profile
          </p>

          <Section title="Digestive condition">
            {editing ? (
              <SelectPill
                options={CONDITIONS}
                value={draft.digestive_condition}
                onChange={v => setDraft(d => ({ ...d, digestive_condition: v }))}
              />
            ) : (
              <span style={{ ...STYLES.chip, ...STYLES.chipOrange }}>
                {user?.digestive_condition ?? '—'}
              </span>
            )}
          </Section>

          <div style={STYLES.divider} />

          <Section title="Goal">
            {editing ? (
              <SelectPill
                options={GOALS}
                value={draft.goal}
                onChange={v => setDraft(d => ({ ...d, goal: v }))}
              />
            ) : (
              <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text, margin: 0 }}>
                {user?.goal ?? '—'}
              </p>
            )}
          </Section>

          <div style={STYLES.divider} />

          <Section title="Age range">
            {editing ? (
              <SelectPill
                options={AGE_RANGES}
                value={draft.age_range}
                onChange={v => setDraft(d => ({ ...d, age_range: v }))}
              />
            ) : (
              <span style={{ ...STYLES.chip, ...STYLES.chipMuted }}>
                {user?.age_range ?? '—'}
              </span>
            )}
          </Section>
        </div>

        {/* Save button */}
        {editing && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...STYLES.btnPrimary,
              opacity: saving ? 0.6 : 1,
              marginBottom: 16,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}

        {/* Danger zone */}
        {!editing && (
          <div style={{ ...STYLES.card, marginBottom: 16 }}>
            <p style={{ ...STYLES.label, marginBottom: 14 }}>Account</p>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                navigate('login');
              }}
              style={{
                fontFamily: FONTS.sans, fontSize: 14, fontWeight: 500,
                background: 'none', border: `1px solid ${COLORS.dangerBorder}`,
                borderRadius: 10, padding: '10px 16px',
                color: COLORS.danger, cursor: 'pointer',
                width: '100%',
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
