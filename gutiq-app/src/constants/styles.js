import { COLORS } from './colors';

export const FONTS = {
  serif: "'DM Serif Display', serif",
  mono:  "'IBM Plex Mono', monospace",
  sans:  "'DM Sans', sans-serif",
};

export const STYLES = {
  // ── Layout ────────────────────────────────────────────
  page: {
    minHeight: '100vh',
    backgroundColor: COLORS.background,
    fontFamily: FONTS.sans,
    color: COLORS.text,
  },
  centeredAuth: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '60px 24px 40px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },

  // ── Cards ─────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: '20px',
    border: `1px solid ${COLORS.border}`,
    boxShadow: COLORS.shadow,
  },
  cardAccent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: '20px',
    border: `1px solid ${COLORS.orangeBorder}`,
    boxShadow: COLORS.shadow,
  },
  cardSmall: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: '16px',
    border: `1px solid ${COLORS.border}`,
    boxShadow: COLORS.shadow,
  },

  // ── Buttons ───────────────────────────────────────────
  btnPrimary: {
    backgroundColor: COLORS.orange,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontFamily: FONTS.sans,
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    width: '100%',
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s ease, transform 0.1s ease',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '14px 20px',
    fontFamily: FONTS.sans,
    fontWeight: 500,
    fontSize: 15,
    cursor: 'pointer',
    width: '100%',
    transition: 'border-color 0.15s ease, color 0.15s ease',
  },

  // ── Inputs ────────────────────────────────────────────
  input: {
    backgroundColor: COLORS.surface,
    border: `1.5px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: '13px 16px',
    color: COLORS.text,
    fontFamily: FONTS.sans,
    fontSize: 15,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
  },

  // ── Typography ────────────────────────────────────────
  h1: {
    fontFamily: FONTS.serif,
    fontSize: 36,
    fontWeight: 400,
    color: COLORS.text,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  h2: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: 400,
    color: COLORS.text,
    lineHeight: 1.25,
  },
  h3: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    fontWeight: 600,
    color: COLORS.text,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 500,
    color: COLORS.muted,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
  labelTeal: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 500,
    color: COLORS.teal,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
  mono: {
    fontFamily: FONTS.mono,
    color: COLORS.text,
  },
  muted: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 1.5,
  },

  // ── Chips ─────────────────────────────────────────────
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  chipOrange: {
    backgroundColor: COLORS.orangeLight,
    color: COLORS.orange,
    border: `1px solid ${COLORS.orangeBorder}`,
  },
  chipTeal: {
    backgroundColor: COLORS.tealLight,
    color: COLORS.teal,
    border: `1px solid ${COLORS.tealBorder}`,
  },
  chipDanger: {
    backgroundColor: COLORS.dangerDim,
    color: COLORS.danger,
    border: `1px solid ${COLORS.dangerBorder}`,
  },
  chipAmber: {
    backgroundColor: COLORS.amberDim,
    color: COLORS.amber,
    border: `1px solid ${COLORS.amberBorder}`,
  },
  chipMuted: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
  },

  // ── Dividers ──────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    margin: '16px 0',
  },
};
