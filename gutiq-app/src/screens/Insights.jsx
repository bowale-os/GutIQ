import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import InsightCard from '../components/InsightCard';

export default function Insights({ insights, navigate }) {
  const firstInsight = insights[0];

  return (
    <div style={{ ...STYLES.page, paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ ...STYLES.labelTeal, marginBottom: 8 }}>Tiwa AI</p>
          <h1 style={{ ...STYLES.h1, fontSize: 30, marginBottom: 8 }}>Your Patterns</h1>
          <p style={{ ...STYLES.muted }}>
            14 days of data. Grounded in clinical research.
          </p>
        </div>

        {/* Key Discovery highlight */}
        {firstInsight && (
          <div style={{
            ...STYLES.card,
            background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.orangeLight} 100%)`,
            border: `1px solid ${COLORS.orangeBorder}`,
            marginBottom: 16,
          }}>
            <p style={{ ...STYLES.labelTeal, marginBottom: 10 }}>Key discovery</p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{firstInsight.icon}</span>
              <div>
                <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 15, color: COLORS.text, marginBottom: 6, lineHeight: 1.35 }}>
                  {firstInsight.title}
                </p>
                <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>{firstInsight.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer banner */}
        <div style={{
          backgroundColor: COLORS.tealLight,
          border: `1px solid ${COLORS.tealBorder}`,
          borderRadius: 10, padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 14 }}>🔬</span>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.teal, letterSpacing: '0.03em' }}>
            Pattern observations only · Not medical advice
          </p>
        </div>

        {/* All insight cards */}
        {insights.map((insight, i) => (
          <InsightCard key={insight.id} insight={insight} delay={i * 80} />
        ))}

        {/* Medical disclaimer */}
        <div style={{
          backgroundColor: COLORS.dangerDim,
          border: `1px solid ${COLORS.dangerBorder}`,
          borderRadius: 12, padding: '14px 16px', marginTop: 8, marginBottom: 12,
        }}>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.danger, letterSpacing: '0.06em', marginBottom: 6 }}>
            DISCLAIMER
          </p>
          <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6, fontStyle: 'italic' }}>
            GutIQ provides pattern insights for informational purposes only. These are observations
            from your self-reported data — not a diagnosis. Always consult a qualified healthcare
            professional before making any changes to your treatment or diet.
          </p>
        </div>

      </div>
    </div>
  );
}
