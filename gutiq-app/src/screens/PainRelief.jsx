import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { submitPainSession, submitPainFeedback } from '../api/painRelief';
import { create as createLog } from '../api/logs';
import { mockCitations } from '../constants/mockData';

// ── Regional emergency numbers ────────────────────────────────────────────────────
// Detect locale from browser; default to international fallback.
const EMERGENCY_BY_REGION = {
  GB: { emergency: '999', nonemergency: '111', erLabel: 'A&E' },
  US: { emergency: '911', nonemergency: '811', erLabel: 'ER'  },
  CA: { emergency: '911', nonemergency: '811', erLabel: 'ER'  },
  AU: { emergency: '000', nonemergency: '1800 022 222', erLabel: 'ED' },
  IE: { emergency: '112', nonemergency: '1850 24 1850', erLabel: 'ED' },
};
const _getRegion = () => {
  if (typeof navigator === 'undefined') return null;
  const match = (navigator.language ?? '').match(/[-_]([A-Za-z]{2})$/);
  return match?.[1]?.toUpperCase() ?? null;
};
const EMERGENCY = EMERGENCY_BY_REGION[_getRegion()] ?? EMERGENCY_BY_REGION.GB;
const toTelHref = (value) => `tel:${String(value).replace(/[^\d+]/g, '')}`;

// ── Symptom chips ────────────────────────────────────────────────────────────────
const SYMPTOM_CHIPS = [
  { label: 'Burning / heartburn', region: 'throat_chest',  character: 'burning',  activeStyle: 'amber',
    searchTerms: 'burning sensation heartburn acid reflux GERD oesophagus' },
  { label: 'Acid rising',         region: 'upper_center',  character: 'burning',  activeStyle: 'amber',
    searchTerms: 'acid regurgitation rising sour taste reflux' },
  { label: 'Bloating',            region: 'central',       character: 'bloating', activeStyle: 'teal',
    searchTerms: 'abdominal bloating distension gas discomfort' },
  { label: 'Trapped gas',         region: 'upper_left',    character: 'bloating', activeStyle: 'teal',
    searchTerms: 'trapped gas flatulence wind distension bloating' },
  { label: 'Cramping',            region: 'lower_left',    character: 'cramping', activeStyle: 'orange',
    searchTerms: 'abdominal cramping spasms IBS pain waves' },
  { label: 'Nausea',              region: 'throat_chest',  character: 'dull',     activeStyle: 'teal',
    searchTerms: 'nausea nauseous sick queasy vomiting urge' },
  { label: 'Constipation',        region: 'lower_center',  character: 'pressure', activeStyle: 'muted',
    searchTerms: 'constipation hard stool difficulty bowel movement infrequent' },
  { label: 'Stomach ache',        region: 'whole_abdomen', character: 'dull',     activeStyle: 'muted',
    searchTerms: 'stomach ache generalised abdominal pain discomfort' },
  { label: 'Chest pain',          region: 'throat_chest',  character: 'sharp',    activeStyle: 'danger',
    softFlag: true, searchTerms: 'chest pain' },
];

// ── Chip active styles ────────────────────────────────────────────────────────────
function getChipActiveStyle(activeStyle) {
  switch (activeStyle) {
    case 'amber':  return { backgroundColor: COLORS.amberDim,    color: COLORS.amber,  border: `1px solid ${COLORS.amberBorder}`  };
    case 'teal':   return { backgroundColor: COLORS.tealLight,   color: COLORS.teal,   border: `1px solid ${COLORS.tealBorder}`   };
    case 'orange': return { backgroundColor: COLORS.orangeLight, color: COLORS.orange, border: `1px solid ${COLORS.orangeBorder}` };
    case 'danger': return { backgroundColor: COLORS.dangerDim,   color: COLORS.danger, border: `1px solid ${COLORS.dangerBorder}` };
    default:       return { backgroundColor: COLORS.surface, color: COLORS.text, border: `1.5px solid ${COLORS.text}` };
  }
}

// ── Request builder ───────────────────────────────────────────────────────────────
const _CHARACTER_PRIORITY = ['burning', 'cramping', 'pressure', 'bloating', 'sharp', 'dull'];

function buildRequest(chips, freeText, intensity) {
  const chipText   = chips.length ? `Experiencing: ${chips.map(c => c.label.toLowerCase()).join(', ')}.` : '';
  const enrichment = chips.map(c => c.searchTerms).filter(Boolean).join(' ');
  const description = [chipText, freeText.trim(), enrichment].filter(Boolean).join(' ')
    || `Gut discomfort, intensity ${intensity}/10.`;

  const seenRegions = new Set();
  const body_clicks = chips.length
    ? chips.filter(c => { if (seenRegions.has(c.region)) return false; seenRegions.add(c.region); return true; })
           .map(c => ({ region: c.region, view: 'anterior' }))
    : [{ region: 'central', view: 'anterior' }];

  const selectedChars  = chips.map(c => c.character).filter(Boolean);
  const pain_character = _CHARACTER_PRIORITY.find(p => selectedChars.includes(p)) || null;

  return { body_clicks, description, intensity, pain_character };
}

// ── Session timer ring ────────────────────────────────────────────────────────────
function TimerRing({ seconds, total, dark = false }) {
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? seconds / total : 0;
  const trackColor = dark ? 'rgba(255,255,255,0.12)' : COLORS.border;

  return (
    <div style={{ position: 'relative', width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke={trackColor} strokeWidth="3" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={COLORS.teal} strokeWidth="3"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONTS.mono, fontSize: 13, fontWeight: 500,
        color: COLORS.teal,
      }}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </div>
    </div>
  );
}

// ── Demo mock ─────────────────────────────────────────────────────────────────────
const MOCK_RELIEF = {
  primary: {
    action: 'Sit upright, shoulders back',
    instruction: 'Find a chair or sit on the edge of your bed. Keep your back straight and let gravity hold the acid down. Slouching makes it worse.',
    duration_minutes: 10,
  },
  maintain: ['Sip room-temperature water slowly', 'Breathe through your nose'],
  avoid: ['Lying down', 'Coffee or citrus', 'Tight clothing around your waist'],
  alternatives: [
    {
      action: 'Chew sugar-free gum',
      instruction: 'Chewing gum stimulates saliva production, which neutralises acid in your oesophagus. Keep going for at least 10 minutes.',
      duration_minutes: 10,
    },
    {
      action: 'Slow diaphragm breathing',
      instruction: 'Place one hand on your belly. Breathe in for 4 counts so your belly rises, hold 2, breathe out for 6. Repeat 8 times. This relaxes the lower oesophageal sphincter muscle.',
      duration_minutes: 8,
    },
  ],
  session_duration_minutes: 20,
  when_to_seek_care: 'Seek care if pain radiates to your arm or jaw, or if symptoms haven\'t eased after 20 minutes.',
};

// ── Citation row ──────────────────────────────────────────────────────────────────
function CitationRow({ citations }) {
  const [expanded, setExpanded] = useState(false);
  const top = citations[0];
  const rest = citations.slice(1);

  const pmidUrl = (pmid) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

  return (
    <div style={{ marginBottom: 20, animation: 'fadeIn 0.3s ease both' }}>
      {/* Collapsed pill */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          backgroundColor: COLORS.tealLight,
          border: `1px solid ${COLORS.tealBorder}`,
          borderRadius: 999, padding: '5px 12px 5px 9px',
          cursor: 'pointer', transition: 'background-color 0.15s ease',
        }}
      >
        <BookOpen size={12} color={COLORS.teal} />
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Based on research
        </span>
        {expanded
          ? <ChevronUp size={12} color={COLORS.teal} />
          : <ChevronDown size={12} color={COLORS.teal} />
        }
      </button>

      {/* Expanded citations */}
      {expanded && (
        <div style={{
          marginTop: 8,
          backgroundColor: COLORS.tealLight,
          border: `1px solid ${COLORS.tealBorder}`,
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'fadeSlideUp 0.2s ease both',
        }}>
          {[top, ...rest].map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, marginTop: 1, flexShrink: 0 }}>
                [{i + 1}]
              </span>
              <div>
                <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textSoft, margin: '0 0 2px', lineHeight: 1.4 }}>
                  {c.title}
                </p>
                <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, margin: 0 }}>
                  {c.source} · {c.year}
                  {c.pmid && (
                    <>
                      {' · '}
                      <a
                        href={pmidUrl(c.pmid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: COLORS.teal, textDecoration: 'underline', textUnderlineOffset: 2 }}
                      >
                        PMID {c.pmid}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────────
export default function PainRelief({ navigate, logs = [], demoMode = false }) {
  const [view, setView] = useState('intake');

  // Intake
  const [selectedChips, setSelectedChips] = useState([]);
  const [intensity,     setIntensity]     = useState(6);
  const [freeText,      setFreeText]      = useState('');
  const [showFreeText,  setShowFreeText]  = useState(false);
  const [isListening,   setIsListening]   = useState(false);
  const [error,         setError]         = useState(null);
  const recognitionRef = useRef(null);

  // Relief
  const [structured,        setStructured]       = useState(null);
  const [citations,         setCitations]        = useState([]);
  const [altIdx,            setAltIdx]           = useState(0);
  const [sessionTimeLeft,   setSessionTimeLeft]  = useState(0);
  const [sessionTotalTime,  setSessionTotalTime] = useState(0);
  const [sessionId,         setSessionId]        = useState(null);

  // Done
  const [rating,     setRating]     = useState(0);
  const [savingLog,  setSavingLog]  = useState(false);
  const [logSaved,   setLogSaved]   = useState(false);
  const [seekcareFrom, setSeekCareFrom] = useState('relief');

  // Red flag
  const [redFlagReason, setRedFlagReason] = useState(null);
  const [isSoftFlag,    setIsSoftFlag]    = useState(false);

  // Session timer
  useEffect(() => {
    if (view !== 'relief' || sessionTimeLeft <= 0) return;
    const t = setInterval(() => setSessionTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [view, sessionTimeLeft]);

  // ── Chip toggle ─────────────────────────────────────────────────────────────────
  const toggleChip = (chip) => {
    setSelectedChips(prev =>
      prev.find(c => c.label === chip.label)
        ? prev.filter(c => c.label !== chip.label)
        : [...prev, chip]
    );
  };

  // ── Voice ───────────────────────────────────────────────────────────────────────
  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Voice input not supported in this browser.'); return; }
    setShowFreeText(true);
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';
    let finalText = freeText;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += (finalText ? ' ' : '') + t;
        else interim = t;
      }
      setFreeText(finalText + (interim ? ' ' + interim : ''));
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') setError('Microphone access denied.');
      setIsListening(false); recognitionRef.current = null;
    };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.start();
    setIsListening(true);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────────
  const handleSubmit = async (bypassSoftFlag = false) => {
    const hasSoftFlag = selectedChips.some(c => c.softFlag);
    if (hasSoftFlag && !bypassSoftFlag) {
      setIsSoftFlag(true);
      setRedFlagReason('Chest pain alongside gut symptoms should be evaluated by a doctor today.');
      setView('redflag');
      return;
    }
    if (selectedChips.length === 0 && freeText.trim().length < 5) {
      setError('Please select a symptom or describe what you\'re feeling.');
      return;
    }
    setError(null);
    recognitionRef.current?.stop();
    setIsListening(false);
    setView('loading');

    if (demoMode) {
      await new Promise(r => setTimeout(r, 1800)); // simulate latency
      const totalSecs = MOCK_RELIEF.session_duration_minutes * 60;
      setStructured(MOCK_RELIEF);
      setCitations(mockCitations);
      setAltIdx(0);
      setSessionTimeLeft(totalSecs);
      setSessionTotalTime(totalSecs);
      setView('relief');
      return;
    }

    try {
      const req = buildRequest(selectedChips, freeText, intensity);
      const res = await submitPainSession(req);
      setSessionId(res.session_id);

      if (res.is_red_flag) {
        setIsSoftFlag(false);
        setRedFlagReason(res.red_flag_reason);
        setView('redflag');
        return;
      }

      const s = res.structured;
      if (!s || !s.primary) {
        setError('Could not generate relief steps. Please try again.');
        setView('intake');
        return;
      }

      const totalSecs = (s.session_duration_minutes || 15) * 60;
      setStructured(s);
      setCitations(res.citations || []);
      setAltIdx(0);
      setSessionTimeLeft(totalSecs);
      setSessionTotalTime(totalSecs);
      setView('relief');
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
      setView('intake');
    }
  };

  // ── Rating — UI only, submitted at commit time ──────────────────────────────────
  const handleRating = (r) => setRating(r);

  const submitFeedbackIfRated = async () => {
    if (!rating || !sessionId || demoMode) return;
    try {
      await submitPainFeedback({ session_id: sessionId, relief_rating: rating, steps_completed: altIdx + 1 });
    } catch (_) {}
  };

  // ── Save log ────────────────────────────────────────────────────────────────────
  const handleSaveLog = async () => {
    setSavingLog(true);
    try {
      await submitFeedbackIfRated();
      const symptoms    = selectedChips.map(c => ({ name: c.label, severity: intensity }));
      const symptomText = selectedChips.map(c => c.label).join(', ') || 'Gut discomfort';
      const summary     = `${symptomText}. Pain level ${intensity}/10.`;
      await createLog({
        source:           'text',
        raw_content:      summary,
        natural_summary:  summary,
        parsed_symptoms:  symptoms,
        overall_severity: intensity,
        confidence:       'high',
      });
      setLogSaved(true);
      navigate('dashboard');
    } catch (_) {
      navigate('dashboard');
    } finally {
      setSavingLog(false);
    }
  };

  // ── Shared wrap ─────────────────────────────────────────────────────────────────
  const wrap = (children) => (
    <div style={{ ...STYLES.page, paddingBottom: 90, minHeight: '100vh' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 0' }}>
        {children}
      </div>
    </div>
  );

  const BackBtn = ({ onBack }) => (
    <button onClick={onBack} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      ← Back
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // INTAKE
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'intake') return wrap(
    <>
      <BackBtn onBack={() => navigate('dashboard')} />
      <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        Tiwa · Pain Relief
      </p>
      <h1 style={{ fontFamily: FONTS.serif, fontSize: 'clamp(22px, 6vw, 28px)', color: COLORS.text, lineHeight: 1.25, marginBottom: 6 }}>
        Let me help you through this.
      </h1>
      <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, lineHeight: 1.5, marginBottom: 28 }}>
        What's happening right now?
      </p>

      {/* Chips */}
      <p style={{ ...STYLES.label, marginBottom: 12 }}>Select what you're feeling</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {SYMPTOM_CHIPS.map(chip => {
          const active = selectedChips.find(c => c.label === chip.label);
          return (
            <button key={chip.label} onClick={() => toggleChip(chip)} style={{
              ...STYLES.chip,
              ...(active ? getChipActiveStyle(chip.activeStyle) : STYLES.chipMuted),
              cursor: 'pointer', padding: '9px 16px', fontSize: 13,
              borderRadius: 10, transition: 'all 0.15s ease',
            }}>
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Intensity */}
      <div style={{ ...STYLES.card, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={STYLES.label}>How bad is it?</p>
          <span style={{ fontFamily: FONTS.mono, fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 500, color: COLORS.teal, lineHeight: 1 }}>
            {intensity}<span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 400 }}>/10</span>
          </span>
        </div>
        <input type="range" min={1} max={10} value={intensity}
          onChange={e => setIntensity(Number(e.target.value))}
          style={{ width: '100%', accentColor: COLORS.teal, cursor: 'pointer', margin: 0 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>Mild</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight }}>Severe</span>
        </div>
      </div>

      {/* Voice / describe */}
      {!showFreeText ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setShowFreeText(true)} style={{ ...STYLES.btnGhost, flex: 1, fontSize: 14 }}>
            Describe in your own words
          </button>
          <button onClick={toggleListening} style={{
            ...STYLES.btnGhost, width: 52, flexShrink: 0, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={18} color={COLORS.teal} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <>
          {isListening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS.teal, animation: 'pulse 1s ease infinite' }} />
              <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Listening — speak freely, tap mic to stop
              </p>
            </div>
          )}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <textarea
              placeholder="Describe what you're feeling — or tap the mic and speak..."
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              rows={4}
              style={{
                ...STYLES.input, resize: 'none', fontSize: 14, lineHeight: 1.6, paddingRight: 52,
                borderColor: isListening ? COLORS.teal : undefined,
                transition: 'border-color 0.2s ease',
              }}
            />
            <button onClick={toggleListening} style={{
              position: 'absolute', bottom: 10, right: 10,
              width: 34, height: 34, borderRadius: 8,
              border: `1px solid ${isListening ? COLORS.teal : COLORS.border}`,
              cursor: 'pointer',
              backgroundColor: isListening ? COLORS.teal : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}>
              {isListening ? <MicOff size={15} color="#fff" strokeWidth={2} /> : <Mic size={15} color={COLORS.teal} strokeWidth={2} />}
            </button>
          </div>
          <button onClick={() => { recognitionRef.current?.stop(); setIsListening(false); setFreeText(''); setShowFreeText(false); }}
            style={{ ...STYLES.btnGhost, fontSize: 13, padding: '10px 20px', marginBottom: 16 }}>
            ← Back
          </button>
        </>
      )}

      {error && <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.danger, marginBottom: 12 }}>{error}</p>}

      <button onClick={() => handleSubmit(false)} style={{ ...STYLES.btnPrimary, backgroundColor: COLORS.teal }}>
        Get my relief steps →
      </button>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'loading') return wrap(
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
      {/* Immediate first action — gives the user something to do while API responds */}
      <div style={{ ...STYLES.card, width: '100%', padding: '28px 24px', textAlign: 'center', marginBottom: 24, animation: 'fadeSlideUp 0.4s ease both' }}>
        <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          While I prepare your steps
        </p>
        <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 12, lineHeight: 1.4 }}>
          Sit upright and breathe slowly
        </p>
        <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.7 }}>
          Sit up straight, let gravity hold the acid down. Take three slow breaths in through your nose, out through your mouth. This alone helps.
        </p>
      </div>
      {/* Subtle spinner below — not the focus */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${COLORS.teal}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight }}>Preparing your relief plan...</p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RELIEF
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'relief' && structured) {
    const current     = altIdx === 0 ? structured.primary : structured.alternatives[altIdx - 1];
    const hasMoreAlts = altIdx < (structured.alternatives?.length ?? 0);

    return wrap(
      <>
        {/* Top row — leave + timer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <button onClick={() => navigate('dashboard')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}>
            ← Leave
          </button>
          <TimerRing seconds={sessionTimeLeft} total={sessionTotalTime} />
        </div>

        {/* Breathing circle — only shown when the action is a breathing exercise */}
        {/breath/i.test(current.action) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: `1.5px solid ${COLORS.tealBorder}`,
                animation: 'breatheSlow 5s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 16, borderRadius: '50%',
                border: `2px solid ${COLORS.teal}`,
                animation: 'breatheExpand 5s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 32, borderRadius: '50%',
                backgroundColor: COLORS.tealLight,
              }} />
            </div>
          </div>
        )}

        {/* Right now label — frames this as a moment, not a list */}
        <p style={{
          fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          textAlign: 'center', marginBottom: 10,
          animation: 'fadeIn 0.4s ease both',
        }}>
          Right now
        </p>

        {/* Action title */}
        <h1 style={{
          fontFamily: FONTS.serif, fontSize: 'clamp(26px, 8vw, 34px)', color: COLORS.text,
          lineHeight: 1.2, marginBottom: 14, textAlign: 'center',
          animation: 'fadeSlideUp 0.35s ease both',
        }}>
          {current.action}
        </h1>

        {/* Instruction — one clear sentence, centered, calm */}
        <p style={{
          fontFamily: FONTS.sans, fontSize: 15, color: COLORS.muted,
          lineHeight: 1.7, marginBottom: 36, textAlign: 'center',
          animation: 'fadeSlideUp 0.35s ease 0.06s both',
        }}>
          {current.instruction}
        </p>

        {/* Citations — small, expandable, below instruction */}
        {citations.length > 0 && (
          <CitationRow citations={citations} />
        )}

        {/* Maintain + Avoid — whisper level, not advice */}
        {(structured.maintain?.length > 0 || structured.avoid?.length > 0) && (
          <div style={{
            backgroundColor: COLORS.surfaceWarm, borderRadius: 12,
            padding: '12px 16px', marginBottom: 20, opacity: 0.7,
          }}>
            {structured.maintain?.length > 0 && (
              <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, lineHeight: 1.7, marginBottom: structured.avoid?.length ? 6 : 0 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.mutedLight, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 6 }}>While you rest</span>
                {structured.maintain.join(' · ')}
              </p>
            )}
            {structured.avoid?.length > 0 && (
              <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.mutedLight, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 6 }}>Step away from</span>
                {structured.avoid.join(' · ')}
              </p>
            )}
          </div>
        )}

        <div style={STYLES.divider} />

        <button onClick={() => setView('done')} style={{ ...STYLES.btnPrimary, backgroundColor: COLORS.teal, marginBottom: 10 }}>
          I'm feeling better
        </button>

        {hasMoreAlts ? (
          <button onClick={() => setAltIdx(i => i + 1)} style={{ ...STYLES.btnGhost }}>
            Still in pain — try something else
          </button>
        ) : (
          <button onClick={() => { setSeekCareFrom('done'); setView('seekcare'); }} style={{ ...STYLES.btnGhost }}>
            Pain isn't easing — when to seek care
          </button>
        )}

        <p style={{
          fontFamily: FONTS.sans, fontSize: 11, color: COLORS.mutedLight,
          textAlign: 'center', lineHeight: 1.5, marginTop: 16, opacity: 0.5,
        }}>
          <span
            onClick={() => { setSeekCareFrom('relief'); setView('seekcare'); }}
            style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', borderBottom: `1px dashed ${COLORS.border}` }}
          >
            When to seek care →
          </span>
        </p>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'done') return wrap(
    <>
      <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: COLORS.tealLight,
          border: `2px solid ${COLORS.tealBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          animation: 'greenPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <span style={{ fontSize: 26, color: COLORS.teal }}>✓</span>
        </div>
        <h2 style={{ ...STYLES.h2, marginBottom: 8 }}>You got through it.</h2>
        <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>Did the steps help?</p>
        <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.mutedLight, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Tap a star to rate
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} onClick={() => handleRating(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 38,
            color: i <= rating ? COLORS.amber : 'transparent',
            textShadow: i <= rating ? 'none' : `0 0 0 ${COLORS.border}`,
            WebkitTextStroke: i <= rating ? 'none' : `2px ${COLORS.amber}`,
            opacity: i <= rating ? 1 : 0.5,
            transition: 'opacity 0.15s ease, color 0.15s ease',
            padding: '4px 2px',
          }}>★</button>
        ))}
      </div>

      {logs.length >= 3 && (
        <div style={{
          backgroundColor: COLORS.tealLight, borderRadius: 12, padding: '12px 16px',
          marginBottom: 20, border: `1px solid ${COLORS.tealBorder}`,
        }}>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, letterSpacing: '0.06em', marginBottom: 4 }}>PATTERN DETECTED</p>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.teal, lineHeight: 1.5 }}>
            You've had {logs.filter(l => l.parsed_severity >= 5).length} significant episodes recently.
            Logging this one helps track what triggers your flares.
          </p>
        </div>
      )}

      <div style={{ ...STYLES.card, marginBottom: 16 }}>
        <p style={{ ...STYLES.label, marginBottom: 8 }}>Want to log this episode?</p>
        <div style={{ backgroundColor: COLORS.surfaceAlt, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textSoft }}>
            {selectedChips.map(c => c.label).join(' · ') || 'Gut discomfort'}
            {' · '} pain level {intensity} · today
          </p>
          <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.teal, marginTop: 4 }}>Pre-filled from your description →</p>
        </div>
        <button
          onClick={handleSaveLog}
          disabled={savingLog}
          style={{ ...STYLES.btnPrimary, backgroundColor: COLORS.teal, opacity: savingLog ? 0.6 : 1 }}
        >
          {savingLog ? 'Saving…' : 'Save & return to dashboard'}
        </button>
      </div>

      <button onClick={async () => { await submitFeedbackIfRated(); navigate('dashboard'); }} style={{ ...STYLES.btnGhost, marginBottom: 16 }}>
        Skip — don't log this
      </button>

      <div style={STYLES.divider} />
      <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.mutedLight, textAlign: 'center', lineHeight: 1.5 }}>
        If pain continues or worsens —&nbsp;
        <span onClick={() => { setSeekCareFrom('done'); setView('seekcare'); }} style={{ color: COLORS.muted, textDecoration: 'underline', cursor: 'pointer' }}>
          when to seek care →
        </span>
      </p>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SEEK CARE
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'seekcare') return wrap(
    <>
      <BackBtn onBack={() => setView(seekcareFrom)} />
      <h2 style={{ ...STYLES.h2, marginBottom: 16 }}>When to seek care</h2>
      {[
        { title: 'Go to A&E immediately', items: ['Chest pain radiating to your arm or jaw', 'Vomiting blood or passing blood', 'Severe sudden pain — worst you\'ve ever felt', 'Cannot stand or move due to pain', 'Difficulty breathing'] },
        { title: 'See your doctor today', items: ['Pain that hasn\'t improved after home care', 'Fever alongside abdominal pain', 'Symptoms you\'ve never had before', 'Unintended weight loss recently'] },
      ].map(section => (
        <div key={section.title} style={{ ...STYLES.card, marginBottom: 12 }}>
          <p style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 10 }}>{section.title}</p>
          {section.items.map(item => (
            <p key={item} style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, lineHeight: 1.5, marginBottom: 4 }}>· {item}</p>
          ))}
        </div>
      ))}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RED FLAG
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'redflag') return wrap(
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ ...STYLES.card, padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 12, lineHeight: 1.4 }}>
          Some symptoms need a doctor, not an app.
        </p>
        <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, marginBottom: 24, lineHeight: 1.6 }}>
          {redFlagReason || 'What you described should be evaluated by a healthcare professional.'}
        </p>
        <div style={STYLES.divider} />
        {!isSoftFlag ? (
          <>
            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.danger, letterSpacing: '0.06em', marginBottom: 16 }}>THIS MAY BE AN EMERGENCY</p>
            <button style={{ ...STYLES.btnPrimary, backgroundColor: COLORS.danger, marginBottom: 10 }} onClick={() => window.open(toTelHref(EMERGENCY.emergency))}>
              Call {EMERGENCY.emergency} / Go to {EMERGENCY.erLabel} now
            </button>
          </>
        ) : (
          <>
            <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.amber, letterSpacing: '0.06em', marginBottom: 16 }}>DON'T WAIT ON THIS</p>
            <button style={{ ...STYLES.btnPrimary, backgroundColor: COLORS.amber, marginBottom: 10 }} onClick={() => window.open(toTelHref(EMERGENCY.nonemergency))}>
              Call {EMERGENCY.nonemergency} or see your doctor today
            </button>
          </>
        )}
        {(isSoftFlag || logs.length > 0) && (
          <button onClick={() => handleSubmit(true)} style={{ ...STYLES.btnGhost, marginBottom: 10 }}>
            This is my usual reflux — continue anyway
          </button>
        )}
        <button onClick={() => navigate('dashboard')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: FONTS.mono, fontSize: 11, color: COLORS.mutedLight,
          letterSpacing: '0.05em', width: '100%', paddingTop: 8,
        }}>
          Back to dashboard
        </button>
      </div>
    </div>
  );

  return null;
}
