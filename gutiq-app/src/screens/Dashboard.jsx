import { useState, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import LogCard from '../components/LogCard';

const getSeverityColor = (v) => v <= 3 ? COLORS.teal : v <= 6 ? COLORS.amber : COLORS.danger;

function Sparkline({ logs }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 150); return () => clearTimeout(t); }, []);
  const W = 440, H = 52;
  const barW = (W / logs.length) * 0.55;
  const gap  = W / logs.length;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {logs.map((log, i) => {
        const x = i * gap + gap / 2 - barW / 2;
        const barH = (log.parsed_severity / 10) * H;
        const y = H - barH;
        return (
          <rect key={log.date} x={x} y={y} width={barW} height={barH} rx={3}
            fill={getSeverityColor(log.parsed_severity)} fillOpacity={0.8}
            style={{
              transformOrigin: `${x + barW / 2}px ${H}px`,
              animation: visible ? 'barGrow 0.45s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
              animationDelay: `${i * 25}ms`,
            }}
          />
        );
      })}
    </svg>
  );
}

export default function Dashboard({ user, logs, navigate, openLog }) {
  if (logs.length === 0) return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>
        <h1 style={{ fontFamily: FONTS.serif, fontSize: 32, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 8 }}>
          Hi, {user.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, marginBottom: 32 }}>
          Your dashboard will fill in as you log.
        </p>
        <div style={{ ...STYLES.card, padding: '28px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 8 }}>No logs yet</p>
          <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24 }}>
            Log your first meal or symptom to start building your gut profile.
          </p>
          <button onClick={openLog} style={{ ...STYLES.btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
            <span style={{ animation: 'pulse 2s ease infinite', fontSize: 18 }}>🎙️</span>
            Log now
          </button>
        </div>
      </div>
    </div>
  );

  const lastLog    = logs[logs.length - 1];
  const recentLogs = logs.slice(-3).reverse();
  const avgSev     = (logs.reduce((s, l) => s + l.parsed_severity, 0) / logs.length).toFixed(1);

  return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: FONTS.serif, fontSize: 32, color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 4 }}>
              Hi, {user.name?.split(' ')[0] ?? 'there'}
            </h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: COLORS.amberDim, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 999, padding: '3px 10px', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.amber }}>
              🔥 {user.streak}-day streak
            </span>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            backgroundColor: COLORS.teal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONTS.sans, fontWeight: 700, fontSize: 15, color: '#fff',
            flexShrink: 0,
          }}>
            {user.initials}
          </div>
        </div>

        {/* Voice log CTA */}
        <div style={{
          backgroundColor: COLORS.darkBg,
          borderRadius: 20,
          padding: '24px 20px',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', backgroundColor: COLORS.orange, opacity: 0.08 }} />
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 4, letterSpacing: '0.02em' }}>
            {user.condition} · daily check-in
          </p>
          <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.darkText, marginBottom: 16, lineHeight: 1.3 }}>
            How are you feeling today?
          </p>
          <p style={{ fontSize: 12, color: COLORS.darkMuted, marginBottom: 20 }}>
            Yesterday: severity {lastLog.parsed_severity}/10 · {lastLog.parsed_foods[0]}
          </p>
          <button
            onClick={openLog}
            style={{
              backgroundColor: COLORS.orange, color: '#fff',
              border: 'none', borderRadius: 12,
              padding: '13px 20px', width: '100%',
              fontFamily: FONTS.sans, fontWeight: 600, fontSize: 15,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <span style={{ animation: 'pulse 2s ease infinite', fontSize: 18 }}>🎙️</span>
            Log now
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ ...STYLES.card, flex: 1, textAlign: 'center' }}>
            <p style={{ ...STYLES.labelTeal, marginBottom: 6 }}>Avg severity</p>
            <p style={{ fontFamily: FONTS.mono, fontSize: 26, fontWeight: 500, color: getSeverityColor(parseFloat(avgSev)) }}>{avgSev}</p>
            <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>/ 10</p>
          </div>
          <div style={{ ...STYLES.card, flex: 1, textAlign: 'center' }}>
            <p style={{ ...STYLES.labelTeal, marginBottom: 6 }}>Last log</p>
            <p style={{ fontFamily: FONTS.mono, fontSize: 26, fontWeight: 500, color: COLORS.text }}>{lastLog.parsed_severity}</p>
            <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{lastLog.date.slice(-5)}</p>
          </div>
        </div>

        {/* 14-day chart */}
        <div style={{ ...STYLES.card, padding: '16px 16px 12px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={STYLES.label}>14-day trend</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['low', COLORS.teal], ['mid', COLORS.amber], ['high', COLORS.danger]].map(([l, c]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: COLORS.muted, fontFamily: FONTS.mono }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c, display: 'inline-block' }} />{l}
                </span>
              ))}
            </div>
          </div>
          <Sparkline logs={logs} />
        </div>

        {/* Recent logs */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={STYLES.label}>Recent</p>
            <button
              onClick={() => navigate('export')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.teal }}
            >
              ALL →
            </button>
          </div>
          {recentLogs.map((log, i) => (
            <LogCard key={log.date} log={log} delay={i * 60} />
          ))}
        </div>

      </div>
    </div>
  );
}
