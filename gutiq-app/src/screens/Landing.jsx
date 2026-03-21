import { useState, useEffect, useRef } from 'react';
import { Mic, FlaskConical, ShieldCheck, ChevronDown, BookOpen, BarChart2, Zap } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/styles';

// ── Mock insight data (what the app actually shows users) ──────────────────────
const MOCK_TRIGGERS = [
  { trigger: 'Coffee', days: 10, total: 14, avgWith: 5.8, avgWithout: 2.1, delta: '+3.7' },
  { trigger: 'Stress',  days: 8,  total: 14, avgWith: 7.2, avgWithout: 2.8, delta: '+4.4' },
  { trigger: 'Poor sleep', days: 5, total: 14, avgWith: 6.9, avgWithout: 3.0, delta: '+3.9' },
];

const MOCK_CITATION = {
  title: 'Coffee and gastrointestinal function: facts and fiction',
  journal: 'Gut',
  year: 2007,
  pmid: '16940385',
};

const HOW_IT_WORKS = [
  {
    icon: Mic,
    step: '01',
    title: 'Log in 30 seconds',
    body: 'Speak or type what you ate, how you feel, and your stress level. No long forms.',
  },
  {
    icon: BarChart2,
    step: '02',
    title: 'AI finds your patterns',
    body: 'GutIQ looks for patterns across your food, sleep, and symptoms over time and highlights what might be worth paying attention to.',
  },
  {
    icon: BookOpen,
    step: '03',
    title: 'Research-backed answers',
    body: 'Pain relief suggestions are grounded in peer-reviewed GI research. Where a study exists, you see the source.',
  },
];

const RESEARCH_PILLS = [
  'American Journal of Gastroenterology',
  'Gut (BMJ)',
  'Neurogastroenterology & Motility',
  'Clinical Gastroenterology and Hepatology',
  'Journal of Gastroenterology',
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightCard() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx(i => (i + 1) % MOCK_TRIGGERS.length), 2800);
    return () => clearInterval(t);
  }, []);

  const item = MOCK_TRIGGERS[activeIdx];
  const barPct = (item.days / item.total) * 100;

  return (
    <div ref={ref} style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 20,
      padding: '24px',
      boxShadow: '0 8px 40px rgba(28,25,23,0.10)',
      maxWidth: 380,
      width: '100%',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'opacity 0.6s ease, transform 0.6s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: COLORS.orange,
          boxShadow: `0 0 0 3px ${COLORS.orangeLight}`,
        }} />
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.09em', color: COLORS.muted, textTransform: 'uppercase' }}>
          GutIQ · Trigger Analysis
        </span>
      </div>

      {/* Trigger tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {MOCK_TRIGGERS.map((t, i) => (
          <button key={t.trigger} onClick={() => setActiveIdx(i)} style={{
            padding: '4px 10px',
            borderRadius: 999,
            border: `1px solid ${i === activeIdx ? COLORS.orangeBorder : COLORS.border}`,
            backgroundColor: i === activeIdx ? COLORS.orangeLight : 'transparent',
            color: i === activeIdx ? COLORS.orange : COLORS.muted,
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: i === activeIdx ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}>
            {t.trigger}
          </button>
        ))}
      </div>

      {/* Main stat */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: FONTS.serif, fontSize: 28, color: COLORS.text, lineHeight: 1.2, margin: '0 0 6px' }}>
          {item.trigger} shows up on{' '}
          <span style={{ color: COLORS.orange }}>{item.days} of your {item.total}</span>{' '}
          worst days.
        </p>
      </div>

      {/* Bar visual */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Frequency
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.orange, fontWeight: 600 }}>
            {item.days}/{item.total} days
          </span>
        </div>
        <div style={{ height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: visible ? `${barPct}%` : '0%',
            backgroundColor: COLORS.orange,
            borderRadius: 3,
            transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        </div>
      </div>

      {/* Delta stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[
          { label: `Pain WITH ${item.trigger}`, val: item.avgWith, color: COLORS.danger },
          { label: `Pain WITHOUT`, val: item.avgWithout, color: COLORS.teal },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1,
            backgroundColor: COLORS.surfaceAlt,
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>
              {s.label}
            </p>
            <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: s.color, margin: 0 }}>
              {s.val}<span style={{ fontSize: 13, color: COLORS.muted, fontFamily: FONTS.sans }}>/10</span>
            </p>
          </div>
        ))}
      </div>

      {/* Citation */}
      <div style={{
        backgroundColor: COLORS.tealLight,
        border: `1px solid ${COLORS.tealBorder}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <BookOpen size={13} color={COLORS.teal} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>
            Source · PMID {MOCK_CITATION.pmid}
          </p>
          <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textSoft, margin: 0, lineHeight: 1.4 }}>
            {MOCK_CITATION.title}. <em>{MOCK_CITATION.journal}</em>, {MOCK_CITATION.year}
          </p>
        </div>
      </div>
    </div>
  );
}

function HowItWorksCard({ icon: Icon, step, title, body, delay }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      padding: '24px',
      flex: 1,
      minWidth: 220,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: COLORS.orangeLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <Icon size={18} color={COLORS.orange} />
      </div>
      <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 8px' }}>
        Step {step}
      </p>
      <p style={{ fontFamily: FONTS.serif, fontSize: 20, color: COLORS.text, margin: '0 0 8px', lineHeight: 1.25 }}>
        {title}
      </p>
      <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, margin: 0, lineHeight: 1.6 }}>
        {body}
      </p>
    </div>
  );
}

// ── Main Landing screen ────────────────────────────────────────────────────────

export default function Landing({ navigate, onDemo }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ backgroundColor: COLORS.background, fontFamily: FONTS.sans, color: COLORS.text, overflowX: 'hidden' }}>

      {/* ── Sticky nav ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: scrolled ? 'rgba(250,247,242,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${COLORS.border}` : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 clamp(16px, 4vw, 24px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{ fontFamily: FONTS.serif, fontSize: 26, color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1 }}>Gut</span>
            <span style={{ fontFamily: FONTS.serif, fontSize: 26, color: COLORS.orange, letterSpacing: '-0.02em', lineHeight: 1 }}>IQ</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('login')} style={{
              background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 10,
              padding: '7px 12px', cursor: 'pointer', fontFamily: FONTS.sans,
              fontSize: 13, color: COLORS.muted, fontWeight: 500,
              transition: 'border-color 0.15s',
            }}>
              Sign in
            </button>
            <button onClick={() => navigate('signup')} style={{
              backgroundColor: COLORS.orange, color: '#fff', border: 'none',
              borderRadius: 10, padding: '7px 14px', cursor: 'pointer',
              fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600,
            }}>
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 'clamp(90px, 14vh, 130px)', paddingBottom: 'clamp(48px, 8vh, 80px)', paddingLeft: 'clamp(16px, 4vw, 24px)', paddingRight: 'clamp(16px, 4vw, 24px)' }}>
        {/* Subtle radial glow behind hero */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 500,
          background: 'radial-gradient(ellipse at center, rgba(201,106,43,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 'clamp(24px, 5vw, 60px)', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Left: copy */}
          <div style={{ flex: '1 1 340px', animation: 'fadeSlideUp 0.6s ease both' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: COLORS.tealLight, border: `1px solid ${COLORS.tealBorder}`,
              borderRadius: 999, padding: '5px 12px', marginBottom: 24,
            }}>
              <FlaskConical size={12} color={COLORS.teal} />
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.teal, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Research-backed · Not diagnostic
              </span>
            </div>

            <h1 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(28px, 7vw, 60px)', fontWeight: 400, color: COLORS.text, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 20px' }}>
              Finally understand<br />
              <span style={{ color: COLORS.orange }}>what's wrecking</span><br />
              your gut.
            </h1>

            <p style={{ fontSize: 'clamp(14px, 4vw, 17px)', color: COLORS.muted, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 420 }}>
              GutIQ connects your food, stress, and sleep to your symptoms and shows you exactly which triggers are hitting hardest, backed by publicly-available, peer-reviewed research.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => navigate('signup')} style={{
                backgroundColor: COLORS.orange, color: '#fff', border: 'none',
                borderRadius: 12, padding: '13px 24px', cursor: 'pointer',
                fontFamily: FONTS.sans, fontSize: 15, fontWeight: 600,
                boxShadow: `0 4px 20px rgba(201,106,43,0.30)`,
                transition: 'transform 0.15s, box-shadow 0.15s',
                flex: '1 1 140px',
              }}>
                Start for free
              </button>
              <button onClick={onDemo} style={{
                backgroundColor: 'transparent', color: COLORS.teal,
                border: `1px solid ${COLORS.tealBorder}`, borderRadius: 12,
                padding: '13px 20px', cursor: 'pointer',
                fontFamily: FONTS.sans, fontSize: 14, fontWeight: 500,
                flex: '1 1 120px',
              }}>
                Try demo →
              </button>
            </div>

            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, letterSpacing: '0.05em' }}>
              Email is not required · Username only · Free to use
            </p>
          </div>

          {/* Right: live insight card */}
          <div style={{ flex: '1 1 340px', display: 'flex', justifyContent: 'center', animation: 'fadeSlideUp 0.6s ease 0.15s both' }}>
            <InsightCard />
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}>
          <ChevronDown size={20} color={COLORS.mutedLight} style={{ animation: 'pulse 2s ease infinite' }} />
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px, 10vh, 80px) clamp(16px, 4vw, 24px)', backgroundColor: COLORS.surfaceAlt }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 20 }}>
            The problem
          </p>
          <h2 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(22px, 5vw, 42px)', fontWeight: 400, color: COLORS.text, lineHeight: 1.2, margin: '0 0 20px' }}>
            You've been managing symptoms.<br />You should be managing{' '}
            <span style={{ color: COLORS.orange }}>triggers</span>.
          </h2>
          <p style={{ fontSize: 16, color: COLORS.muted, lineHeight: 1.8, margin: '0 0 40px' }}>
            Most people with IBS, GERD, or chronic gut issues track pain after the fact and that tells you nothing useful. GutIQ looks back across your entire history and shows you the patterns your doctor doesn't have time to find.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['IBS', 'GERD', 'Crohn\'s', 'Ulcerative colitis', 'Functional dyspepsia'].map(label => (
              <div key={label} style={{
                padding: '6px 14px', borderRadius: 999,
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted,
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px, 10vh, 80px) clamp(16px, 4vw, 24px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
              How it works
            </p>
            <h2 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(20px, 5vw, 38px)', fontWeight: 400, color: COLORS.text, margin: 0 }}>
              It is simple to start. You log and it gets smarter.
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {HOW_IT_WORKS.map((item, i) => (
              <HowItWorksCard key={item.step} {...item} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Research credibility ─────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px, 10vh, 80px) clamp(16px, 4vw, 24px)', backgroundColor: COLORS.surfaceAlt }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            backgroundColor: COLORS.tealLight, border: `1px solid ${COLORS.tealBorder}`,
            borderRadius: 999, padding: '6px 16px', marginBottom: 24,
          }}>
            <FlaskConical size={13} color={COLORS.teal} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.teal, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Research-grounded
            </span>
          </div>

          <h2 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(20px, 5vw, 40px)', fontWeight: 400, color: COLORS.text, margin: '0 0 16px' }}>
            Relief steps grounded in real research.
          </h2>
          <p style={{ fontSize: 16, color: COLORS.muted, lineHeight: 1.7, margin: '0 0 36px', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            GutIQ pulls relief steps from a database of peer-reviewed GI research. Where a supporting study exists, you see the source with the PubMed ID attached. Not every answer has one, but when it does, it is right there.
          </p>

          {/* Journal pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
            {RESEARCH_PILLS.map(j => (
              <div key={j} style={{
                padding: '6px 14px', borderRadius: 999,
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.tealBorder}`,
                fontFamily: FONTS.sans, fontSize: 13, color: COLORS.teal,
              }}>
                {j}
              </div>
            ))}
          </div>

          {/* Sample citation block */}
          <div style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.tealBorder}`,
            borderRadius: 14, padding: '18px 20px',
            display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
            maxWidth: 560, margin: '0 auto',
          }}>
            <BookOpen size={16} color={COLORS.teal} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>
                Example source · PMID 16940385
              </p>
              <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textSoft, margin: 0, lineHeight: 1.5 }}>
                "Coffee and gastrointestinal function: facts and fiction."{' '}
                <em>Gut (BMJ)</em>, 2007. Used when coffee appears in your trigger profile.
              </p>
            </div>
          </div>

          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, letterSpacing: '0.04em', marginTop: 20 }}>
            Pattern-based analysis only · Not a medical device · Always consult your physician
          </p>
        </div>
      </section>

      {/* ── Privacy promise ──────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px, 10vh, 80px) clamp(16px, 4vw, 24px)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
              Your data, your rules
            </p>
            <h2 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(20px, 5vw, 38px)', fontWeight: 400, color: COLORS.text, margin: '0 0 16px' }}>
              Email is not required.
            </h2>
            <p style={{ fontSize: 16, color: COLORS.muted, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              Health data is personal. Start with just a username, no email and no real name required. Your gut logs are private and only you can see them.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              {
                icon: ShieldCheck,
                title: 'Anonymous by default',
                body: 'Create an account with a username only. Add an email later if you want cross-device sync or account recovery.',
                color: COLORS.teal,
                bg: COLORS.tealLight,
                border: COLORS.tealBorder,
              },
              {
                icon: Zap,
                title: 'Your logs, never ours',
                body: "Personal logs are tied to your account alone. Community insights use anonymized aggregates and your data is never surfaced individually.",
                color: COLORS.orange,
                bg: COLORS.orangeLight,
                border: COLORS.orangeBorder,
              },
              {
                icon: FlaskConical,
                title: 'We don\'t sell health data',
                body: "We don't monetize your health information. GutIQ is free and your data is never sold.",
                color: COLORS.teal,
                bg: COLORS.tealLight,
                border: COLORS.tealBorder,
              },
            ].map(item => (
              <div key={item.title} style={{
                flex: '1 1 220px',
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16, padding: '22px',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: item.bg, border: `1px solid ${item.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                }}>
                  <item.icon size={16} color={item.color} />
                </div>
                <p style={{ fontFamily: FONTS.serif, fontSize: 18, color: COLORS.text, margin: '0 0 8px' }}>
                  {item.title}
                </p>
                <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, margin: 0, lineHeight: 1.6 }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px, 10vh, 80px) clamp(16px, 4vw, 24px) 100px', backgroundColor: COLORS.surfaceAlt }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(24px, 6vw, 46px)', fontWeight: 400, color: COLORS.text, margin: '0 0 16px', lineHeight: 1.15 }}>
            Start understanding<br />your gut today.
          </h2>
          <p style={{ fontSize: 16, color: COLORS.muted, lineHeight: 1.7, margin: '0 0 36px' }}>
            Email is not required. Takes 30 seconds to set up. Your first insight usually comes after three days of logging.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <button onClick={() => navigate('signup')} style={{
              backgroundColor: COLORS.orange, color: '#fff', border: 'none',
              borderRadius: 14, padding: '16px 40px', cursor: 'pointer',
              fontFamily: FONTS.sans, fontSize: 17, fontWeight: 600,
              boxShadow: `0 4px 24px rgba(201,106,43,0.30)`,
              width: '100%', maxWidth: 360,
            }}>
              Create free account
            </button>
            <button onClick={onDemo} style={{
              backgroundColor: 'transparent', color: COLORS.teal,
              border: `1px solid ${COLORS.tealBorder}`, borderRadius: 14,
              padding: '14px 40px', cursor: 'pointer',
              fontFamily: FONTS.sans, fontSize: 15, fontWeight: 500,
              width: '100%', maxWidth: 360,
            }}>
              Try demo first →
            </button>
            <button onClick={() => navigate('login')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: FONTS.mono, fontSize: 12, color: COLORS.mutedLight,
              letterSpacing: '0.04em', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              Already have an account? Sign in
            </button>
          </div>

          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight, letterSpacing: '0.05em', marginTop: 24 }}>
            Pattern-based insights only · Not a medical device · Always consult your physician
          </p>
        </div>
      </section>

    </div>
  );
}
