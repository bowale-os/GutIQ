import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { getInsights } from '../api/user';

function SignalRow({ signal, direction }) {
  const isUp = direction === 'trigger';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 0',
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        backgroundColor: isUp ? COLORS.dangerDim : COLORS.tealLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        {isUp
          ? <TrendingUp size={15} color={COLORS.danger} strokeWidth={2} />
          : <TrendingDown size={15} color={COLORS.teal} strokeWidth={2} />
        }
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text, lineHeight: 1.45, marginBottom: 4 }}>
          {signal.text}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted }}>
            {signal.label} · {signal.sample_size} logs · {isUp ? '+' : ''}{signal.delta?.toFixed(1)} pts
          </span>
          {signal.confirmable && (
            <span style={{
              backgroundColor: isUp ? COLORS.dangerDim : COLORS.tealLight,
              color: isUp ? COLORS.danger : COLORS.teal,
              borderRadius: 4, padding: '1px 6px',
              fontFamily: FONTS.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
            }}>CONFIRMED</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Findings({ user, logs, navigate }) {
  const [insights, setInsights] = useState(null);
  const logCount = logs.length;

  useEffect(() => {
    getInsights().then(setInsights).catch(() => {});
  }, []);

  // ── State 1: too few logs ──────────────────────────────────────────────────
  if (logCount < 10) {
    const remaining = 10 - logCount;
    return (
      <div style={{ ...STYLES.page, paddingBottom: 90 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px 0' }}>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.1em', marginBottom: 12 }}>FINDINGS</p>
          <h1 style={{ fontFamily: FONTS.serif, fontSize: 28, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 12 }}>
            Your picture is building.
          </h1>
          <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.muted, lineHeight: 1.6, marginBottom: 32 }}>
            Log {remaining} more {remaining === 1 ? 'time' : 'times'} and your data will be deep enough for us to start finding patterns.
          </p>

          <div style={{ ...STYLES.card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                backgroundColor: COLORS.tealLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 18, color: COLORS.teal, fontWeight: 700 }}>{logCount}</span>
              </div>
              <div>
                <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text }}>
                  You've logged {logCount} {logCount !== 1 ? 'times' : 'time'} so far
                </p>
                <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted }}>
                  You need a minimum of 10 to get accurate findings
                </p>
              </div>
            </div>
            <div style={{ height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                backgroundColor: COLORS.teal,
                width: `${Math.min((logCount / 10) * 100, 100)}%`,
                transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── State 2: enough logs but patterns still forming (10–14, no confirmed) ──
  const triggers   = insights?.triggers   || [];
  const protective = insights?.protective || [];
  const confirmed  = insights?.confirmed_triggers || [];
  const hasSignals = triggers.length > 0 || protective.length > 0;

  if (!hasSignals) {
    return (
      <div style={{ ...STYLES.page, paddingBottom: 90 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px 0' }}>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.1em', marginBottom: 12 }}>FINDINGS</p>
          <h1 style={{ fontFamily: FONTS.serif, fontSize: 28, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 12 }}>
            Keep logging.
          </h1>
          <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.muted, lineHeight: 1.6 }}>
            We have {logCount} logs. Patterns are starting to form. A few more and we'll have something to show you.
          </p>
        </div>
      </div>
    );
  }

  // ── State 3: signals exist ─────────────────────────────────────────────────
  return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px 0' }}>

        <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.1em', marginBottom: 12 }}>FINDINGS</p>
        <h1 style={{ fontFamily: FONTS.serif, fontSize: 28, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 6 }}>
          What your data shows.
        </h1>
        <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginBottom: 28 }}>
          Based on {logCount} logs · updated every 5 entries
        </p>

        {triggers.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.danger, letterSpacing: '0.08em', marginBottom: 4 }}>RAISE YOUR PAIN</p>
            <div style={{ ...STYLES.card, padding: '0 16px' }}>
              {triggers.map((s, i) => <SignalRow key={i} signal={s} direction="trigger" />)}
            </div>
          </div>
        )}

        {protective.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.08em', marginBottom: 4 }}>LOWER YOUR PAIN</p>
            <div style={{ ...STYLES.card, padding: '0 16px' }}>
              {protective.map((s, i) => <SignalRow key={i} signal={s} direction="protective" />)}
            </div>
          </div>
        )}

        {/* Export */}
        <button
          onClick={() => navigate('export')}
          style={{
            ...STYLES.btnGhost, width: '100%', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          ↗ Export for your doctor
        </button>

      </div>
    </div>
  );
}
