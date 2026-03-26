import { useState, useEffect, useMemo } from 'react';
import { HeartPulse, Mic } from 'lucide-react';
import { COLORS, getSeverityColor } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import LogCard from '../components/LogCard';

function Sparkline({ logs }) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(null);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 150); return () => clearTimeout(t); }, []);

  const days = useMemo(() => {
    const logsByDate = {};
    for (const l of logs) {
      if (!logsByDate[l.date]) logsByDate[l.date] = [];
      logsByDate[l.date].push(l);
    }
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayLogs = logsByDate[label] || [];
      if (dayLogs.length === 0) return { label, logs: [] };
      const withSev = dayLogs.filter(l => l.parsed_severity != null);
      if (withSev.length === 0) return { label, logs: dayLogs, avg: null };
      const avg = withSev.reduce((s, l) => s + l.parsed_severity, 0) / withSev.length;
      return { label, logs: dayLogs, avg };
    });
  }, [logs]);

  const W = 440, H = 52, gap = W / 14, barW = gap * 0.55;
  const hoveredDay = hovered !== null ? days[hovered] : null;
  const tooltipLeft = hovered !== null ? `${((hovered * gap + gap / 2) / W) * 100}%` : '0%';

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {days.map((day, i) => {
          const x = i * gap + gap / 2 - barW / 2;
          if (!day.logs.length || day.avg == null) {
            return (
              <g key={i}>
                <rect x={x} y={0} width={barW} height={H} rx={3} fill="#E7E5E4" fillOpacity={0.12} />
                <rect x={x} y={H - 4} width={barW} height={4} rx={2} fill="#E7E5E4" fillOpacity={0.5} />
              </g>
            );
          }
          const barH = Math.max((day.avg / 10) * H, 4);
          const y = H - barH;
          return (
            <rect
              key={i} x={x} y={y} width={barW} height={barH} rx={3}
              fill={getSeverityColor(day.avg)}
              fillOpacity={hovered === i ? 1 : 0.8}
              style={{
                cursor: 'pointer',
                transformOrigin: `${x + barW / 2}px ${H}px`,
                animationName: visible ? 'barGrow' : 'none',
                animationDuration: '0.45s',
                animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
                animationFillMode: 'both',
                animationDelay: `${i * 25}ms`,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>
      {hoveredDay?.logs.length > 0 && (() => {
        const barH = Math.max((hoveredDay.avg / 10) * H, 4);
        const barTopPct = ((H - barH) / H) * 100;
        return (
        <div style={{
          position: 'absolute',
          top: `calc(${barTopPct}% - 32px)`,
          left: tooltipLeft,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(28, 25, 23, 0.75)', color: '#FAFAF9',
          borderRadius: 8, padding: '5px 10px',
          fontFamily: FONTS.mono, fontSize: 11,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
          backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {hoveredDay.label} · avg {hoveredDay.avg.toFixed(1)}/10
          {hoveredDay.logs.length > 1 && ` · ${hoveredDay.logs.length} logs`}
        </div>
        );
      })()}
    </div>
  );
}



export default function Dashboard({ user, logs, navigate, openLog }) {
  if (logs.length === 0) return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>
        <h1 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(24px, 7vw, 32px)', color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 8 }}>
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
            <Mic size={20} color="#fff" strokeWidth={1.5} style={{ animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
            Log now
          </button>
        </div>
        <button
          onClick={() => navigate('pain_relief')}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            width: '100%', textAlign: 'left',
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.tealBorder}`,
            borderRadius: 16, padding: '16px 18px',
            marginTop: 12, cursor: 'pointer',
            boxShadow: COLORS.shadow,
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            backgroundColor: COLORS.tealLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HeartPulse size={20} color={COLORS.teal} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>
              Let me help you through this
            </p>
            <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted }}>
              Tiwa · guided relief steps for gut pain
            </p>
          </div>
          <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.teal }}>→</span>
        </button>
      </div>
    </div>
  );

  const lastLog    = logs[0];
  const recentLogs = logs.slice(0, 3);
  const logsWithSev = logs.filter(l => l.parsed_severity != null);
  const avgSev      = logsWithSev.length
    ? (logsWithSev.reduce((s, l) => s + l.parsed_severity, 0) / logsWithSev.length).toFixed(1)
    : '—';

  return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(24px, 7vw, 32px)', color: COLORS.text, letterSpacing: '-0.01em', marginBottom: 4 }}>
              Hi, {user.name?.split(' ')[0] ?? 'there'}
            </h1>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            backgroundColor: COLORS.teal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONTS.sans, fontWeight: 700, fontSize: 15, color: '#fff',
            flexShrink: 0,
          }}>
            {user.name?.charAt(0).toUpperCase() ?? '?'}
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
            {lastLog.date}: {lastLog.parsed_severity != null ? `pain level ${lastLog.parsed_severity}/10` : 'no symptoms'} · {lastLog.parsed_foods?.[0] ?? 'no food logged'}
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
            <Mic size={20} color="#fff" strokeWidth={1.5} style={{ animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
            Log now
          </button>
        </div>

        {/* Pain relief CTA */}
        <button
          onClick={() => navigate('pain_relief')}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            width: '100%', textAlign: 'left',
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.tealBorder}`,
            borderRadius: 16, padding: '16px 18px',
            marginBottom: 16, cursor: 'pointer',
            boxShadow: COLORS.shadow,
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            backgroundColor: COLORS.tealLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HeartPulse size={20} color={COLORS.teal} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>
              In pain right now?
            </p>
            <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}>
              Get evidence-based relief steps for your gut symptoms
            </p>
          </div>
          <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.teal }}>→</span>
        </button>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ ...STYLES.card, flex: 1, textAlign: 'center' }}>
            <p style={{ ...STYLES.labelTeal, marginBottom: 6 }}>Avg pain level</p>
            <p style={{ fontFamily: FONTS.mono, fontSize: 26, fontWeight: 500, color: getSeverityColor(parseFloat(avgSev)) }}>{avgSev}</p>
            <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>/ 10</p>
          </div>
          <div style={{ ...STYLES.card, flex: 1, textAlign: 'center' }}>
            <p style={{ ...STYLES.labelTeal, marginBottom: 6 }}>Last log</p>
            <p style={{ fontFamily: FONTS.mono, fontSize: 26, fontWeight: 500, color: COLORS.text }}>{lastLog.parsed_severity ?? '—'}</p>
            <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{lastLog.date}</p>
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
            <LogCard key={log._id ?? `${log.date}-${i}`} log={log} delay={i * 60} />
          ))}
        </div>

      </div>
    </div>
  );
}
