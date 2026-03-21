import { useRef } from 'react';
import { Bell, Mail, BellOff } from 'lucide-react';
import { COLORS } from '../../constants/colors';
import { FONTS, STYLES } from '../../constants/styles';
import { AGE_RANGES, QUICK_TIMES } from '../constants';
import { formatTime } from '../helpers';
import ChannelButton from '../components/ChannelButton';

export default function ScreenAgeReminder({
  isDiagnosed,
  ageRange, setAgeRange,
  timeHours, setTimeHours,
  timeMins,  setTimeMins,
  timeAmPm,  setTimeAmPm,
  reminderTime,
  reminderChannel, setReminderChannel,
  hasEmail,
  slideAnim,
}) {
  const timeHoursRef = useRef(null);
  const timeMinsRef  = useRef(null);

  return (
    <div style={{ animation: slideAnim }}>
      {isDiagnosed === false ? (
        <>
          <p style={{ ...STYLES.label, marginBottom: 8 }}>You're all set.</p>
          <h1 style={{ ...STYLES.h1, fontSize: 'clamp(22px, 6vw, 28px)', marginBottom: 8 }}>
            One last thing before you start.
          </h1>
          <p style={{ ...STYLES.muted, marginBottom: 28 }}>
            Since you're still figuring things out, I'll focus on finding patterns in your symptoms. The kind of picture that helps a doctor understand what's going on.
          </p>
        </>
      ) : (
        <>
          <p style={{ ...STYLES.label, marginBottom: 8 }}>Almost there.</p>
          <h1 style={{ ...STYLES.h1, fontSize: 'clamp(22px, 6vw, 28px)', marginBottom: 8 }}>
            Two last things, both optional.
          </h1>
          <p style={{ ...STYLES.muted, marginBottom: 28 }}>
            These help me give you better context over time.
          </p>
        </>
      )}

      {/* Age range */}
      <p style={{ ...STYLES.label, marginBottom: 10 }}>
        Age range{' '}
        <span style={{ color: COLORS.mutedLight, fontWeight: 400 }}>(optional)</span>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        {AGE_RANGES.map(r => (
          <button
            key={r}
            onClick={() => setAgeRange(prev => prev === r ? null : r)}
            style={{
              padding: '10px 20px', borderRadius: 10,
              border: `1.5px solid ${ageRange === r ? COLORS.orange : COLORS.border}`,
              backgroundColor: ageRange === r ? COLORS.orangeLight : COLORS.surface,
              color: ageRange === r ? COLORS.orange : COLORS.muted,
              fontFamily: FONTS.mono, fontWeight: ageRange === r ? 600 : 400,
              fontSize: 14, cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Reminder time */}
      <p style={{ ...STYLES.label, marginBottom: 10 }}>
        Daily reminder{' '}
        <span style={{ color: COLORS.mutedLight, fontWeight: 400 }}>(optional)</span>
      </p>
      <div
        style={{
          backgroundColor: COLORS.surface,
          border: `1.5px solid ${reminderTime ? COLORS.teal : COLORS.border}`,
          borderRadius: 14, padding: '16px 20px',
          marginBottom: 12, transition: 'border-color 0.2s ease', cursor: 'text',
        }}
        onClick={e => { if (e.target.tagName !== 'INPUT') timeHoursRef.current?.focus(); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ ...STYLES.label, margin: 0, fontSize: 11 }}>Set your time</p>
          {reminderTime && (
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.05em' }}>
              {formatTime(reminderTime)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            ref={timeHoursRef}
            type="text"
            inputMode="numeric"
            value={timeHours}
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, '');
              if (!raw) { setTimeHours(''); return; }

              const first = parseInt(raw[0], 10);

              if (raw.length === 1) {
                setTimeHours(raw);
                // 2–9 can't start a valid 12h hour (20+ > 12), jump immediately
                if (first >= 2) timeMinsRef.current?.focus();
                return;
              }

              // 2 digits — validate range 01–12
              const h = parseInt(raw.slice(0, 2), 10);
              if (h < 1 || h > 12) {
                // Out of range — keep only first digit
                setTimeHours(raw[0]);
                return;
              }

              setTimeHours(raw.slice(0, 2));
              timeMinsRef.current?.focus();
            }}
            placeholder="12"
            style={{
              width: '2.2ch', border: 'none', outline: 'none',
              backgroundColor: 'transparent', textAlign: 'center',
              fontFamily: FONTS.mono, fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 500,
              color: reminderTime ? COLORS.teal : COLORS.text,
              letterSpacing: '0.04em', caretColor: COLORS.teal,
            }}
          />
          <span style={{
            fontFamily: FONTS.mono, fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 500,
            color: reminderTime ? COLORS.teal : COLORS.borderMid, lineHeight: 1,
          }}>:</span>
          <input
            ref={timeMinsRef}
            type="text"
            inputMode="numeric"
            value={timeMins}
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, '');
              if (!raw) { setTimeMins(''); return; }

              if (raw.length === 1) {
                setTimeMins(raw);
                return;
              }

              // 2 digits — validate range 00–59
              const m = parseInt(raw.slice(0, 2), 10);
              if (m > 59) {
                setTimeMins(raw[0]);
                return;
              }

              setTimeMins(raw.slice(0, 2));
            }}
            onBlur={() => {
              if (timeMins.length === 1) setTimeMins(prev => prev.padStart(2, '0'));
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace' && timeMins === '') {
                e.preventDefault();
                setTimeHours(prev => prev.slice(0, -1));
                timeHoursRef.current?.focus();
              }
            }}
            placeholder="00"
            style={{
              width: '2.2ch', border: 'none', outline: 'none',
              backgroundColor: 'transparent', textAlign: 'center',
              fontFamily: FONTS.mono, fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 500,
              color: reminderTime ? COLORS.teal : COLORS.text,
              letterSpacing: '0.04em', caretColor: COLORS.teal,
            }}
          />

          {/* AM / PM toggle */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 10,
          }}>
            {['AM', 'PM'].map(period => (
              <button
                key={period}
                onClick={() => setTimeAmPm(period)}
                style={{
                  padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.05em', transition: 'all 0.15s ease',
                  backgroundColor: timeAmPm === period
                    ? (reminderTime ? COLORS.teal : COLORS.orange)
                    : COLORS.border,
                  color: timeAmPm === period ? '#fff' : COLORS.muted,
                }}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {QUICK_TIMES.map(t => (
          <button
            key={t.value}
            onClick={() => {
              const toggled = reminderTime === t.value;
              if (toggled) {
                setTimeHours(''); setTimeMins(''); setTimeAmPm('AM');
              } else {
                const h24 = parseInt(t.value.split(':')[0], 10);
                const mins = t.value.split(':')[1];
                const period = h24 >= 12 ? 'PM' : 'AM';
                const h12 = h24 % 12 || 12;
                setTimeHours(String(h12));
                setTimeMins(mins);
                setTimeAmPm(period);
              }
            }}
            style={{
              padding: '9px 16px', borderRadius: 10,
              border: `1.5px solid ${reminderTime === t.value ? COLORS.teal : COLORS.border}`,
              backgroundColor: reminderTime === t.value ? COLORS.tealLight : COLORS.surface,
              color: reminderTime === t.value ? COLORS.teal : COLORS.muted,
              fontFamily: FONTS.mono, fontSize: 13,
              fontWeight: reminderTime === t.value ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reminderTime && (
        <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
          <p style={{ ...STYLES.label, marginBottom: 12 }}>How should I remind you?</p>
          {hasEmail && (
            <ChannelButton
              icon={Mail} title="Email reminder (coming soon)"
              desc={`A nudge at ${formatTime(reminderTime)}`}
              selected={reminderChannel === 'email'}
              onClick={() => setReminderChannel(c => c === 'email' ? null : 'email')}
              accent={COLORS.orange}
            />
          )}
          <ChannelButton
            icon={Bell} title="Browser notification (coming soon)"
            desc="Works on desktop and most mobile browsers"
            selected={reminderChannel === 'push'}
            onClick={() => setReminderChannel(c => c === 'push' ? null : 'push')}
            accent={COLORS.teal}
          />
          <ChannelButton
            icon={BellOff} title="No reminders"
            desc="I'll remember on my own"
            selected={reminderChannel === 'none'}
            onClick={() => setReminderChannel(c => c === 'none' ? null : 'none')}
            accent={COLORS.muted}
          />
          {!hasEmail && (
            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, marginTop: 8 }}>
              Add your email in Profile later to enable email reminders.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
