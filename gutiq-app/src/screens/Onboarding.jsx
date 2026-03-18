import { useState } from 'react';
import { Bell, Mail, BellOff, CheckCircle } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import StepIndicator from '../components/StepIndicator';
import { complete } from '../api/onboarding';
import { storeUser, getStoredUser } from '../api/client';
import { AGE_RANGES } from '../api/schemas';

// ── Condition list ─────────────────────────────────────────────────────────────
const CONDITIONS = [
  { id: 'GERD',   color: '#e07b39', label: 'GERD / Acid Reflux',   desc: 'Frequent heartburn, regurgitation, chest discomfort' },
  { id: 'IBS',    color: '#2c7a7b', label: 'IBS',                   desc: 'Cramping, bloating, irregular bowel habits' },
  { id: 'Crohns', color: '#7c3aed', label: "Crohn's Disease",       desc: 'Chronic inflammation anywhere along the digestive tract' },
  { id: 'UC',     color: '#0369a1', label: 'Ulcerative Colitis',    desc: 'Inflammation and ulcers in the colon and rectum' },
  { id: 'Celiac', color: '#15803d', label: 'Celiac Disease',        desc: 'Gluten sensitivity causing intestinal damage' },
];

// ── Reminder quick picks ───────────────────────────────────────────────────────
const QUICK_TIMES = [
  { label: '8:00 AM',  value: '08:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '7:00 PM',  value: '19:00' },
  { label: '9:00 PM',  value: '21:00' },
];

// Format "19:00" → "7:00 PM"
function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Parse typed input like "8pm", "8:30 PM", "20:30" → "HH:MM" or null
function parseTimeInput(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2] || '0', 10);
  const ampm = match[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConditionCard({ color, label, desc, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        backgroundColor: selected ? COLORS.orangeLight : COLORS.surface,
        border: `1.5px solid ${selected ? COLORS.orange : COLORS.border}`,
        borderRadius: 14, padding: '14px 16px',
        cursor: 'pointer', marginBottom: 8,
        boxShadow: selected ? `0 0 0 3px ${COLORS.orangeLight}` : COLORS.shadow,
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, margin: 0 }}>{label}</p>
          {desc && <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, margin: '2px 0 0', lineHeight: 1.4 }}>{desc}</p>}
        </div>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${selected ? COLORS.orange : COLORS.borderMid}`,
          backgroundColor: selected ? COLORS.orange : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}>
          {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#fff' }} />}
        </div>
      </div>
    </button>
  );
}

function TimeChip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px', borderRadius: 10,
        border: `1.5px solid ${selected ? COLORS.teal : COLORS.border}`,
        backgroundColor: selected ? COLORS.tealLight : COLORS.surface,
        color: selected ? COLORS.teal : COLORS.muted,
        fontFamily: FONTS.mono, fontSize: 13,
        fontWeight: selected ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.15s ease',
        boxShadow: COLORS.shadow,
      }}
    >
      {label}
    </button>
  );
}

function ChannelCard({ icon: Icon, title, desc, selected, onClick, accent = COLORS.teal }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        backgroundColor: selected ? `${accent}12` : COLORS.surface,
        border: `1.5px solid ${selected ? accent : COLORS.border}`,
        borderRadius: 14, padding: '14px 16px',
        cursor: 'pointer', marginBottom: 8,
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          backgroundColor: selected ? `${accent}20` : COLORS.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background-color 0.15s ease',
        }}>
          <Icon size={16} color={selected ? accent : COLORS.muted} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, margin: 0 }}>{title}</p>
          <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, margin: '2px 0 0', lineHeight: 1.4 }}>{desc}</p>
        </div>
        {selected && <CheckCircle size={16} color={accent} />}
      </div>
    </button>
  );
}

const inputStyle = (focused) => ({
  width: '100%', boxSizing: 'border-box',
  padding: '13px 16px',
  border: `1.5px solid ${focused ? COLORS.orange : COLORS.border}`,
  borderRadius: 12,
  backgroundColor: COLORS.surface,
  fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text,
  outline: 'none',
  transition: 'border-color 0.15s ease',
});

// ── Main component ─────────────────────────────────────────────────────────────

export default function Onboarding({ step, setStep, navigate, demoMode = false }) {
  const { username, name, userId, email } = getStoredUser();

  // Step 1
  const [condition,       setCondition]       = useState(null);
  const [customCondition, setCustomCondition] = useState('');
  const [customFocused,   setCustomFocused]   = useState(false);

  // Step 2
  const [ageRange, setAgeRange] = useState(null);

  // Step 3
  const [reminderTime,    setReminderTime]    = useState(null);
  const [timeInput,       setTimeInput]       = useState('');
  const [reminderChannel, setReminderChannel] = useState(null);

  // Submission
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState(null);

  const finalCondition = condition === 'Other' ? customCondition.trim() : condition;

  // In demo mode we pretend the user has an email for channel display purposes
  const hasEmail = demoMode ? true : !!email;

  const canProceed = () => {
    if (step === 1) return condition === 'Other' ? customCondition.trim().length > 0 : !!condition;
    if (step === 2) return !!ageRange;
    return true; // step 3 — time + channel are optional, user can skip
  };

  const requestPushPermission = async () => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    return Notification.requestPermission();
  };

  const handleNext = async () => {
    if (step < 3) { setStep(step + 1); return; }

    // Step 3 submit — request push permission if that channel was chosen
    if (reminderChannel === 'push' && !demoMode) {
      await requestPushPermission();
    }

    if (demoMode) {
      navigate('dashboard');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const goal = `Identify and manage ${finalCondition} triggers`;
      await complete(finalCondition, goal, ageRange, reminderTime, reminderChannel);
      storeUser(username, userId, name, finalCondition);
      navigate('gutcheck');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = name || username;

  return (
    <div style={{ ...STYLES.page }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px 100px' }}>

        <StepIndicator current={step} total={3} />

        {/* ── Step 1 — Condition ── */}
        {step === 1 && (
          <div key="step1" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>
              {demoMode ? 'Demo mode · ' : ''}Hi{displayName ? `, ${displayName}` : ''}. I'm Tiwa.
            </p>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 24 }}>What are you managing?</h1>
            {CONDITIONS.map(c => (
              <ConditionCard
                key={c.id} {...c}
                selected={condition === c.id}
                onClick={() => setCondition(c.id)}
              />
            ))}
            <ConditionCard
              color="#6b7280"
              label="Something else"
              desc={null}
              selected={condition === 'Other'}
              onClick={() => setCondition('Other')}
            />
            {condition === 'Other' && (
              <input
                autoFocus
                value={customCondition}
                onChange={e => setCustomCondition(e.target.value)}
                onFocus={() => setCustomFocused(true)}
                onBlur={() => setCustomFocused(false)}
                placeholder="e.g. Gastroparesis, Diverticulitis…"
                style={{ ...inputStyle(customFocused), marginTop: 4, marginBottom: 8 }}
              />
            )}
          </div>
        )}

        {/* ── Step 2 — Age range ── */}
        {step === 2 && (
          <div key="step2" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>Almost there.</p>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>Help Tiwa understand your context.</h1>
            <p style={{ ...STYLES.muted, marginBottom: 28 }}>This helps personalise your insights over time.</p>

            <p style={{ ...STYLES.label, marginBottom: 10 }}>Age range</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {AGE_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setAgeRange(r)}
                  style={{
                    padding: '10px 20px', borderRadius: 10,
                    border: `1.5px solid ${ageRange === r ? COLORS.orange : COLORS.border}`,
                    backgroundColor: ageRange === r ? COLORS.orangeLight : COLORS.surface,
                    color: ageRange === r ? COLORS.orange : COLORS.muted,
                    fontFamily: FONTS.mono, fontWeight: ageRange === r ? 600 : 400,
                    fontSize: 14, cursor: 'pointer',
                    boxShadow: COLORS.shadow,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3 — Reminders ── */}
        {step === 3 && (
          <div key="step3" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <p style={{ ...STYLES.label, marginBottom: 6 }}>One last thing.</p>
            <h1 style={{ ...STYLES.h1, fontSize: 28, marginBottom: 6 }}>
              When do you want to log each day?
            </h1>
            <p style={{ ...STYLES.muted, marginBottom: 28 }}>
              A daily log takes 30 seconds. Set any time that fits your routine — you can always change it later.
            </p>

            {/* Time input — primary control */}
            <div style={{
              backgroundColor: COLORS.surface,
              border: `1.5px solid ${reminderTime ? COLORS.teal : COLORS.border}`,
              borderRadius: 14, padding: '16px 20px',
              marginBottom: 16, transition: 'border-color 0.2s ease',
              cursor: 'text',
            }}
              onClick={e => e.currentTarget.querySelector('input')?.focus()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ ...STYLES.label, margin: 0 }}>Set your time</p>
                {reminderTime && (
                  <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.05em' }}>
                    {formatTime(reminderTime)}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={timeInput}
                onChange={e => {
                  const raw = e.target.value;
                  setTimeInput(raw);
                  setReminderTime(parseTimeInput(raw));
                }}
                placeholder="e.g. 8:30 PM"
                style={{
                  width: '100%', border: 'none', outline: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: FONTS.mono, fontSize: 30, fontWeight: 500,
                  color: reminderTime ? COLORS.teal : COLORS.text,
                  letterSpacing: '0.04em',
                  caretColor: COLORS.teal,
                }}
              />
            </div>

            {/* Quick picks */}
            <p style={{ ...STYLES.label, marginBottom: 10 }}>Quick picks</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
              {QUICK_TIMES.map(t => (
                <TimeChip
                  key={t.value}
                  label={t.label}
                  selected={reminderTime === t.value}
                  onClick={() => {
                    const toggled = reminderTime === t.value;
                    setReminderTime(toggled ? null : t.value);
                    setTimeInput(toggled ? '' : t.label);
                  }}
                />
              ))}
            </div>

            {/* Channel picker — only shown once a time is selected */}
            {reminderTime && (
              <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
                <p style={{ ...STYLES.label, marginBottom: 12 }}>How should we remind you?</p>

                {hasEmail && (
                  <ChannelCard
                    icon={Mail}
                    title="Email reminder"
                    desc={`We'll send a quick nudge at ${formatTime(reminderTime)}`}
                    selected={reminderChannel === 'email'}
                    onClick={() => setReminderChannel(c => c === 'email' ? null : 'email')}
                    accent={COLORS.orange}
                  />
                )}

                <ChannelCard
                  icon={Bell}
                  title="Browser notification"
                  desc="Works on desktop and most mobile browsers when the app is open"
                  selected={reminderChannel === 'push'}
                  onClick={() => setReminderChannel(c => c === 'push' ? null : 'push')}
                  accent={COLORS.teal}
                />

                <ChannelCard
                  icon={BellOff}
                  title="No reminders"
                  desc="I'll remember on my own"
                  selected={reminderChannel === 'none'}
                  onClick={() => setReminderChannel(c => c === 'none' ? null : 'none')}
                  accent={COLORS.muted}
                />

                {!hasEmail && reminderChannel !== 'none' && !demoMode && (
                  <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, marginTop: 10, letterSpacing: '0.04em' }}>
                    Want email reminders?{' '}
                    <span style={{ color: COLORS.orange, cursor: 'pointer', textDecoration: 'underline' }}>
                      Add your email in Profile after setup.
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Skip nudge */}
            {!reminderTime && (
              <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, marginTop: 4, letterSpacing: '0.04em' }}>
                You can set this in Profile anytime — or skip for now.
              </p>
            )}
          </div>
        )}

        {saveError && (
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: '#e53e3e', marginTop: 16, textAlign: 'center' }}>
            {saveError}
          </p>
        )}

        <button
          onClick={handleNext}
          disabled={!canProceed() || saving}
          style={{ ...STYLES.btnPrimary, marginTop: 24, opacity: (canProceed() && !saving) ? 1 : 0.35 }}
        >
          {saving ? 'Saving…' : step === 3
            ? (reminderTime && reminderChannel && reminderChannel !== 'none')
              ? 'Start tracking →'
              : step === 3 ? 'Start tracking →' : 'Continue'
            : 'Continue'
          }
        </button>

        {step === 3 && !saving && (reminderTime && !reminderChannel) && (
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, textAlign: 'center', marginTop: 10 }}>
            Pick how you'd like to be reminded, or tap Start tracking to skip
          </p>
        )}

        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ ...STYLES.btnGhost, marginTop: 10 }}>
            ← Back
          </button>
        )}

      </div>
    </div>
  );
}
