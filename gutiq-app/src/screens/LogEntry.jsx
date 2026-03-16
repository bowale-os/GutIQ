import { useEffect, useMemo, useRef, useState } from 'react';
import { Utensils, Activity, Brain, Moon, Dumbbell } from 'lucide-react';
import { COLORS, getSeverityColor } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { preview, create } from '../api/logs';

const TRANSCRIPT_LINES = [
  'Had coffee this morning...',
  'Lunch was takeout, pretty greasy...',
  'Heartburn started around 8pm...',
  'Stress was medium today, work was okay...',
  'Slept about 6 hours last night.',
];

const MOCK_PREVIEW = {
  log_categories: ['food', 'symptom', 'stress', 'sleep'],
  parsed_foods: ['coffee', 'takeout', 'dessert'],
  parsed_symptoms: [
    { name: 'heartburn', severity: 6 },
    { name: 'bloating',  severity: null },
  ],
  overall_severity: null,
  parsed_stress: 'medium',
  parsed_sleep: 6,
  parsed_exercise: null,
  confidence: 'medium',
  natural_summary: 'Coffee and takeout, reflux mid-evening, moderate stress',
  missing_critical_field: null,
};

const SEV_COLOR = getSeverityColor;
const STRESS_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const EXERCISE_LABELS = { none: 'None', light: 'Light', moderate: 'Moderate', intense: 'Intense' };
const STRESS_OPTIONS = Object.entries(STRESS_LABELS);
const EXERCISE_OPTIONS = Object.entries(EXERCISE_LABELS);
const SEVERITY_NUMS = [1,2,3,4,5,6,7,8,9,10];

function computeMissing(c) {
  const cats = c.log_categories || [];
  const symptoms = c.parsed_symptoms || [];
  const hasAnySeverity = symptoms.some(s => s.severity != null) || c.overall_severity != null;
  if (cats.includes('symptom') && !hasAnySeverity) return 'overall_severity';
  if (cats.includes('sleep') && c.parsed_sleep == null) return 'parsed_sleep';
  if (cats.includes('food') && !(c.parsed_foods?.length)) return 'parsed_foods';
  if (cats.includes('stress') && !c.parsed_stress) return 'parsed_stress';
  return null;
}

function DataRow({ icon, label, value, unit = '', color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.darkMuted, display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
      <span style={{
        fontFamily: FONTS.mono, fontSize: 14,
        color: value != null ? (color || COLORS.darkText) : COLORS.darkMuted,
        opacity: value != null ? 1 : 0.4,
      }}>
        {value != null ? `${value}${unit}` : '—'}
      </span>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: '7px 14px', borderRadius: 8,
          border: `1px solid ${value === v ? COLORS.orange : COLORS.darkBorder}`,
          backgroundColor: value === v ? COLORS.orangeLight : 'transparent',
          color: value === v ? COLORS.orange : COLORS.darkMuted,
          fontFamily: FONTS.sans, fontSize: 13, cursor: 'pointer',
          fontWeight: value === v ? 600 : 400,
        }}>{label}</button>
      ))}
    </div>
  );
}

function MissingOptIn({ label, onAdd, onSkip }) {
  return (
    <div>
      <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onAdd} style={{ ...STYLES.btnPrimary, width: 'auto', padding: '10px 20px' }}>Add</button>
        <button onClick={onSkip} style={{ ...STYLES.btnGhost, width: 'auto', padding: '10px 20px', backgroundColor: COLORS.darkSurface, borderColor: COLORS.darkBorder, color: COLORS.darkMuted }}>Skip</button>
      </div>
    </div>
  );
}

function EditRow({ label, children }) {
  return (
    <div style={{ padding: '10px 0' }}>
      <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.darkMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  );
}

export default function LogEntry({ onClose, onSave, demoMode = false }) {
  const [phase, setPhase] = useState('idle');
  const [source, setSource] = useState('voice');
  const [rawContent, setRawContent] = useState('');
  const [confirmed, setConfirmed] = useState({});
  const [transcript, setTranscript] = useState('');
  const [textFocused, setTextFocused] = useState(false);
  const [discardGuard, setDiscardGuard] = useState(false);
  const [addFoodInput, setAddFoodInput] = useState('');
  const [showAddFood, setShowAddFood] = useState(false);
  const [missingInput, setMissingInput] = useState('');
  const [missingAccepted, setMissingAccepted] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [saveError,    setSaveError]    = useState(null);

  const lineRef = useRef(0);
  const discardTimer = useRef(null);
  const logTime = useRef(new Date());
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (phase !== 'capturing' || source !== 'voice') return;
    lineRef.current = 0;
    setTranscript('');

    if (demoMode) {
      const addLine = () => {
        if (lineRef.current < TRANSCRIPT_LINES.length) {
          setTranscript(prev => prev + (prev ? '\n' : '') + TRANSCRIPT_LINES[lineRef.current++]);
          setTimeout(addLine, 420);
        }
      };
      const t = setTimeout(addLine, 300);
      return () => clearTimeout(t);
    }

    // Real voice capture via Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setPreviewError('Voice input is not supported in this browser. Please type instead.');
      setPhase('capturing');
      setSource('text');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += (finalText ? ' ' : '') + text;
        } else {
          interim = text;
        }
      }
      setTranscript(finalText + (interim ? ' ' + interim : ''));
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setPreviewError('Microphone access denied. Please allow microphone permission and try again.');
        setPhase('idle');
      }
    };

    recognition.start();
    return () => { recognition.stop(); recognitionRef.current = null; };
  }, [phase, source, demoMode]);

  useEffect(() => {
    setDiscardGuard(false);
    clearTimeout(discardTimer.current);
    setMissingInput('');
    setMissingAccepted(false);
  }, [phase]);

  const upd = (field, val) => setConfirmed(prev => ({ ...prev, [field]: val }));

  const callPreview = async (content) => {
    const rc = content ?? rawContent;
    logTime.current = new Date();
    setPreviewError(null);
    setPhase('previewing');
    if (demoMode) {
      await new Promise(r => setTimeout(r, 900));
      setConfirmed({ ...MOCK_PREVIEW });
      setPhase('reviewing');
    } else {
      try {
        const data = await preview(rc);
        setConfirmed({ ...data });
        setPhase('reviewing');
      } catch (err) {
        const msg = err.message?.toLowerCase().includes('raw_content')
          ? 'You left the log empty. Say or type something first.'
          : err.message || 'Parsing failed. Please try again.';
        setPreviewError(msg);
        setPhase('capturing');
      }
    }
  };

  const callSave = async (extra = {}) => {
    const final = { ...confirmed, ...extra };
    setSaveError(null);
    setPhase('saving');
    try {
      if (!demoMode) {
        const result = await create({
          source,
          raw_content:     rawContent,
          transcript:      transcript || null,
          natural_summary: final.natural_summary,
          confidence:      final.confidence,
          parsed_foods:    final.parsed_foods,
          parsed_symptoms: final.parsed_symptoms,
          overall_severity: final.overall_severity,
          parsed_stress:   final.parsed_stress,
          parsed_sleep:    final.parsed_sleep,
          parsed_exercise: final.parsed_exercise,
        });
        onSave?.(result.log);
      }
      setPhase('saved');
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setSaveError(err.message || 'Save failed. Please try again.');
      setPhase('reviewing');
    }
  };

  const handleClose = () => {
    if (['idle', 'capturing', 'saved'].includes(phase)) { onClose(); return; }
    if (discardGuard) { clearTimeout(discardTimer.current); onClose(); return; }
    setDiscardGuard(true);
    discardTimer.current = setTimeout(() => setDiscardGuard(false), 2500);
  };

  const missing = useMemo(() => computeMissing(confirmed), [confirmed]);
  const timeStr = logTime.current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const skipMissing = () => {
    const cats = (confirmed.log_categories || []).filter(c => c !== ({
      overall_severity: 'symptom',
      parsed_stress:    'stress',
      parsed_sleep:     'sleep',
      parsed_foods:     'food',
    }[missing]));
    upd('log_categories', cats);
    setMissingAccepted(false);
    setMissingInput('');
  };

  const backBtn = (
    <button onClick={() => { setMissingAccepted(false); setMissingInput(''); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.darkMuted, marginTop: 8, padding: 0 }}>
      ← back
    </button>
  );


  const fillMissing = (field, value) => {
    upd(field, value);
    setMissingAccepted(false);
    setMissingInput('');
  };

  const renderMissingPrompt = () => {
    if (missing === 'overall_severity') {
      if (!missingAccepted) return <MissingOptIn label="Want to rate your pain level?" onAdd={() => setMissingAccepted(true)} onSkip={skipMissing} />;
      return (
        <div>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 12 }}>Pain level (1–10)</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {SEVERITY_NUMS.map(n => {
              const c = SEV_COLOR(n);
              return (
                <button key={n} onClick={() => fillMissing('overall_severity', n)} style={{
                  flex: 1, height: 40, borderRadius: 8,
                  border: `1.5px solid ${c}55`,
                  backgroundColor: `${c}22`,
                  color: c,
                  fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>{n}</button>
              );
            })}
          </div>
          {backBtn}
        </div>
      );
    }

    if (missing === 'parsed_stress') {
      if (!missingAccepted) return <MissingOptIn label="Want to add your stress level?" onAdd={() => setMissingAccepted(true)} onSkip={skipMissing} />;
      return (
        <div>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>How was your stress?</p>
          <ToggleGroup
            options={STRESS_OPTIONS}
            value={null}
            onChange={v => fillMissing('parsed_stress', v)}
          />
          {backBtn}
        </div>
      );
    }

    if (missing === 'parsed_sleep') {
      if (!missingAccepted) return <MissingOptIn label="Want to add your sleep hours?" onAdd={() => setMissingAccepted(true)} onSkip={skipMissing} />;
      return (
        <div>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>How many hours did you sleep?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" min="0" max="24" step="0.5"
              value={missingInput} onChange={e => setMissingInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && missingInput) fillMissing('parsed_sleep', parseFloat(missingInput)); }}
              placeholder="hrs"
              style={{ ...STYLES.input, backgroundColor: COLORS.darkSurface, border: `1.5px solid ${COLORS.darkBorder}`, color: COLORS.darkText, width: 90, textAlign: 'center' }}
            />
            <button onClick={() => { if (missingInput) fillMissing('parsed_sleep', parseFloat(missingInput)); }} disabled={!missingInput}
              style={{ ...STYLES.btnPrimary, width: 'auto', padding: '12px 20px', opacity: missingInput ? 1 : 0.4 }}>Done</button>
          </div>
          {backBtn}
        </div>
      );
    }

    if (missing === 'parsed_foods') {
      if (!missingAccepted) return <MissingOptIn label="Want to add what you ate or drank?" onAdd={() => setMissingAccepted(true)} onSkip={skipMissing} />;
      return (
        <div>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>What did you eat or drink?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={missingInput} onChange={e => setMissingInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && missingInput.trim()) fillMissing('parsed_foods', missingInput.trim().split(',').map(s => s.trim())); }}
              placeholder="coffee, pizza..."
              style={{ ...STYLES.input, backgroundColor: COLORS.darkSurface, border: `1.5px solid ${COLORS.darkBorder}`, color: COLORS.darkText, flex: 1 }}
            />
            <button onClick={() => { if (missingInput.trim()) fillMissing('parsed_foods', missingInput.trim().split(',').map(s => s.trim())); }} disabled={!missingInput.trim()}
              style={{ ...STYLES.btnPrimary, width: 'auto', padding: '12px 20px', opacity: missingInput.trim() ? 1 : 0.4 }}>Done</button>
          </div>
          {backBtn}
        </div>
      );
    }

    return null;
  };

  const renderContent = () => {
    switch (phase) {

      case 'idle': return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            .sonar-idle {
              position: absolute; inset: 0; margin: auto;
              width: 88px; height: 88px; border-radius: 50%;
              background: ${COLORS.orange};
              animation: sonarPulse 1.8s ease-out infinite;
            }
          `}</style>
          <div style={{ position: 'relative', width: 150, height: 150, marginBottom: 20 }}>
            <div className="sonar-idle" style={{ animationDelay: '0s' }} />
            <div className="sonar-idle" style={{ animationDelay: '0.6s' }} />
            <div className="sonar-idle" style={{ animationDelay: '1.2s' }} />
            <button
              onClick={() => { setSource('voice'); setPhase('capturing'); }}
              style={{
                position: 'absolute', inset: 0, margin: 'auto', width: 88, height: 88,
                borderRadius: '50%', backgroundColor: COLORS.orange, border: 'none', cursor: 'pointer',
                fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 32px ${COLORS.orange}44, 0 4px 16px rgba(0,0,0,0.3)`, zIndex: 1,
              }}
            >🎙️</button>
          </div>
          <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.darkText, fontWeight: 400, marginBottom: 8 }}>
            Just talk
          </p>
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, textAlign: 'center', lineHeight: 1.5, marginBottom: 14, maxWidth: 260 }}>
            Include what you ate, any symptoms, stress, sleep, and exercise — the more detail, the better Tiwa can help.
          </p>
          <button
            onClick={() => { setSource('text'); setPhase('capturing'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 13, color: COLORS.darkMuted }}
          >
            type instead →
          </button>
        </div>
      );

      case 'capturing': {
        if (source === 'voice') return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20 }}>
            <style>{`
              .sonar-cap {
                position: absolute; inset: 0; margin: auto;
                width: 88px; height: 88px; border-radius: 50%;
                background: ${COLORS.orange};
                animation: sonarPulse 1.5s ease-out infinite;
              }
            `}</style>
            <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 20, flexShrink: 0 }}>
              <div className="sonar-cap" style={{ animationDelay: '0s' }} />
              <div className="sonar-cap" style={{ animationDelay: '0.5s' }} />
              <div className="sonar-cap" style={{ animationDelay: '1s' }} />
              <div style={{
                position: 'absolute', inset: 0, margin: 'auto', width: 88, height: 88, borderRadius: '50%',
                backgroundColor: COLORS.orange, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, zIndex: 1, boxShadow: `0 0 40px ${COLORS.orange}66`,
              }}>🎙️</div>
            </div>
            <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.orange, animation: 'pulse 1.2s ease infinite', marginBottom: 14, flexShrink: 0 }}>
              Listening...
            </p>
            <div style={{
              width: '100%', backgroundColor: COLORS.darkSurface, borderRadius: 14, padding: '12px 14px',
              fontFamily: FONTS.mono, fontSize: 12, color: COLORS.darkMuted, lineHeight: 1.7, whiteSpace: 'pre-line',
              flex: 1, border: `1px solid ${COLORS.darkBorder}`,
            }}>
              {transcript}
              {transcript && <span style={{ animation: 'pulse 0.8s ease infinite', color: COLORS.orange }}>|</span>}
            </div>
            {previewError && (
              <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.danger, textAlign: 'center', marginTop: 10, flexShrink: 0 }}>
                {previewError}
              </p>
            )}
            <button
              onClick={() => { recognitionRef.current?.stop(); setRawContent(transcript); callPreview(transcript); }}
              style={{ marginTop: 14, fontFamily: FONTS.mono, fontSize: 13, color: COLORS.darkMuted, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, paddingBottom: 8 }}
            >
              tap to finish →
            </button>
          </div>
        );

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={rawContent}
              onChange={e => setRawContent(e.target.value)}
              onFocus={() => setTextFocused(true)}
              onBlur={() => setTextFocused(false)}
              autoFocus
              placeholder="What did you eat? Any symptoms, stress, sleep, exercise? The more detail, the better."
              style={{
                ...STYLES.input,
                backgroundColor: COLORS.darkSurface,
                border: `1.5px solid ${textFocused ? COLORS.orange : COLORS.darkBorder}`,
                color: COLORS.darkText, caretColor: COLORS.orange, flex: 1, resize: 'none', lineHeight: 1.6, marginBottom: 14,
              }}
            />
            {previewError && (
              <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.danger, marginBottom: 8 }}>
                {previewError}
              </p>
            )}
            <button
              onClick={() => callPreview()}
              disabled={!rawContent.trim()}
              style={{ ...STYLES.btnPrimary, opacity: rawContent.trim() ? 1 : 0.4, marginBottom: 8 }}
            >
              Parse →
            </button>
          </div>
        );
      }

      case 'previewing': return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: FONTS.serif, fontSize: 20, color: COLORS.darkText, fontWeight: 400, animation: 'pulse 1.5s ease infinite' }}>
            ✦ Tiwa is reading your log...
          </p>
        </div>
      );

      case 'reviewing': {
        const foods    = confirmed.parsed_foods    || [];
        const symptoms = confirmed.parsed_symptoms || [];
        const stress   = confirmed.parsed_stress;
        const sleep    = confirmed.parsed_sleep;
        const exercise = confirmed.parsed_exercise;
        const isLowConf = confirmed.confidence === 'low';

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeSlideUp 0.3s ease' }}>

            {/* Scrollable content */}
            <style>{`
              .log-scroll::-webkit-scrollbar { width: 3px; }
              .log-scroll::-webkit-scrollbar-track { background: transparent; }
              .log-scroll::-webkit-scrollbar-thumb { background: ${COLORS.darkBorder}; border-radius: 99px; }
              .log-scroll::-webkit-scrollbar-thumb:hover { background: ${COLORS.darkMuted}; }
            `}</style>
            <div className="log-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: 6 }}>

              {/* Voice transcript */}
              {source === 'voice' && transcript && (
                <div style={{ backgroundColor: COLORS.darkSurfaceAlt, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange, letterSpacing: '0.08em', marginBottom: 4 }}>🎙️ TIWA HEARD</p>
                  <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.darkMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{transcript.replace(/\n/g, ' ')}"
                  </p>
                </div>
              )}

              {/* Summary */}
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange, letterSpacing: '0.08em', marginBottom: 6 }}>✦ TIWA CAPTURED</p>
                <p style={{ fontFamily: FONTS.serif, fontSize: 17, color: COLORS.darkText, fontWeight: 400, lineHeight: 1.35, marginBottom: 4 }}>
                  "{confirmed.natural_summary}"
                </p>
                <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.darkMuted }}>at {timeStr}</p>
              </div>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder, marginBottom: 12 }} />

              {/* Category chips — always visible, tap to add or remove */}
              <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.darkMuted, marginBottom: 8 }}>
                Tap to add or remove from your log
              </p>
              <style>{`
                .chip-scroll::-webkit-scrollbar { display: none; }
                .chip-scroll { -ms-overflow-style: none; scrollbar-width: none; }
              `}</style>
              <div className="chip-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', marginBottom: 14, paddingBottom: 2 }}>
                {[
                  ['food',     Utensils, 'Food'],
                  ['symptom',  Activity, 'Symptoms'],
                  ['stress',   Brain,    'Stress'],
                  ['sleep',    Moon,     'Sleep'],
                  ['exercise', Dumbbell, 'Exercise'],
                ].map(([cat, Icon, label]) => {
                  const active = (confirmed.log_categories || []).includes(cat);
                  return (
                    <button key={cat} onClick={() => {
                      const cats = confirmed.log_categories || [];
                      if (active) {
                        upd('log_categories', cats.filter(c => c !== cat));
                      } else {
                        upd('log_categories', [...cats, cat]);
                        setMissingAccepted(false);
                        setMissingInput('');
                      }
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      padding: '6px 12px', borderRadius: 20,
                      border: `1.5px solid ${active ? COLORS.orange : COLORS.darkBorder}`,
                      borderStyle: active ? 'solid' : 'dashed',
                      backgroundColor: active ? COLORS.orangeLight : 'transparent',
                      color: active ? COLORS.orange : COLORS.darkMuted,
                      fontFamily: FONTS.sans, fontSize: 12, cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}>
                      <Icon size={13} strokeWidth={active ? 2.5 : 1.8} />
                      {active ? null : <span style={{ fontSize: 10, opacity: 0.6 }}>+</span>}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Foods */}
              {foods.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {foods.map(f => (
                    <span key={f} style={{ ...STYLES.chip, backgroundColor: COLORS.orangeLight, color: COLORS.orange, border: `1px solid ${COLORS.orangeBorder}` }}>{f}</span>
                  ))}
                </div>
              )}

              {/* Symptoms with per-symptom pain level */}
              {symptoms.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {symptoms.map(s => {
                    const sev = s.severity ?? confirmed.overall_severity ?? null;
                    return (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
                        <span style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.darkMuted, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14} strokeWidth={1.8} />{s.name}</span>
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 14,
                          color: sev != null ? SEV_COLOR(sev) : COLORS.darkMuted,
                          opacity: sev != null ? 1 : 0.4,
                        }}>
                          {sev != null ? `${sev}/10` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Data rows — only shown when category is active */}
              <div>
                {(confirmed.log_categories || []).includes('stress') && (
                  <DataRow icon={<Brain size={14} strokeWidth={1.8} />}    label="Stress"   value={stress   ? STRESS_LABELS[stress]     : null} />
                )}
                {(confirmed.log_categories || []).includes('sleep') && (
                  <DataRow icon={<Moon size={14} strokeWidth={1.8} />}     label="Sleep"    value={sleep}   unit="h" />
                )}
                {(confirmed.log_categories || []).includes('exercise') && (
                  <DataRow icon={<Dumbbell size={14} strokeWidth={1.8} />} label="Exercise" value={exercise ? EXERCISE_LABELS[exercise] : null} />
                )}
              </div>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder, margin: '12px 0' }} />

              {/* Low confidence banner */}
              {isLowConf && (
                <div style={{ backgroundColor: COLORS.amberDim, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                  <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.amber }}>⚠ Tiwa wasn't certain — please review carefully</p>
                </div>
              )}

              {/* Missing field prompt */}
              {missing && (
                <div style={{ marginBottom: 12 }}>
                  {renderMissingPrompt()}
                </div>
              )}

            </div>

            {/* Pinned bottom — always visible */}
            {discardGuard && (
              <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.amber, textAlign: 'center', marginBottom: 8, animation: 'fadeIn 0.2s ease' }}>
                Tap × again to discard
              </p>
            )}

            {/* Actions — only show Save when nothing is missing */}
            {!missing && (
              <div style={{ paddingBottom: 32, flexShrink: 0 }}>
                {saveError && (
                  <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.danger, textAlign: 'center', marginBottom: 8 }}>
                    {saveError}
                  </p>
                )}
                <button
                  onClick={() => callSave()}
                  style={{ ...STYLES.btnPrimary, width: '100%' }}
                >
                  Save ✓
                </button>
              </div>
            )}
          </div>
        );
      }

      case 'editing': {
        const foods    = confirmed.parsed_foods    || [];
        const sev      = confirmed.overall_severity ?? null;
        const stress   = confirmed.parsed_stress;
        const sleep    = confirmed.parsed_sleep;
        const exercise = confirmed.parsed_exercise;

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>

              <EditRow label="Foods">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {foods.map(f => (
                    <span
                      key={f}
                      onClick={() => upd('parsed_foods', foods.filter(x => x !== f))}
                      style={{ ...STYLES.chip, backgroundColor: COLORS.orangeLight, color: COLORS.orange, border: `1px solid ${COLORS.orangeBorder}`, cursor: 'pointer', gap: 4 }}
                    >
                      {f} <span style={{ opacity: 0.6 }}>×</span>
                    </span>
                  ))}
                  {!showAddFood ? (
                    <span
                      onClick={() => setShowAddFood(true)}
                      style={{ ...STYLES.chip, border: `1px dashed ${COLORS.darkBorder}`, color: COLORS.darkMuted, backgroundColor: 'transparent', cursor: 'pointer' }}
                    >
                      + add food
                    </span>
                  ) : (
                    <input
                      value={addFoodInput}
                      autoFocus
                      onChange={e => setAddFoodInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && addFoodInput.trim()) {
                          upd('parsed_foods', [...foods, addFoodInput.trim()]);
                          setAddFoodInput('');
                          setShowAddFood(false);
                        }
                        if (e.key === 'Escape') { setShowAddFood(false); setAddFoodInput(''); }
                      }}
                      placeholder="add..."
                      style={{ ...STYLES.input, backgroundColor: COLORS.darkSurface, border: `1.5px solid ${COLORS.orange}`, color: COLORS.darkText, width: 110, padding: '4px 10px', fontSize: 13 }}
                    />
                  )}
                </div>
              </EditRow>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder }} />

              <EditRow label="Pain level">
                <div style={{ display: 'flex', gap: 6 }}>
                  {SEVERITY_NUMS.map(n => {
                    const c = SEV_COLOR(n);
                    const selected = sev === n;
                    return (
                      <button key={n} onClick={() => upd('overall_severity', n)} style={{
                        flex: 1, height: 40, borderRadius: 8,
                        border: `1.5px solid ${selected ? c : `${c}44`}`,
                        backgroundColor: selected ? c : `${c}18`,
                        color: selected ? '#fff' : c,
                        fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>{n}</button>
                    );
                  })}
                </div>
              </EditRow>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder }} />

              <EditRow label="Stress">
                <ToggleGroup
                  options={STRESS_OPTIONS}
                  value={stress}
                  onChange={v => upd('parsed_stress', v)}
                />
              </EditRow>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder }} />

              <EditRow label="Sleep">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" min="0" max="24" step="0.5"
                    value={sleep ?? ''}
                    onChange={e => upd('parsed_sleep', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="—"
                    style={{ ...STYLES.input, backgroundColor: COLORS.darkSurface, border: `1.5px solid ${COLORS.darkBorder}`, color: COLORS.darkText, width: 80, textAlign: 'center', padding: '8px 12px' }}
                  />
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.darkMuted }}>hrs</span>
                </div>
              </EditRow>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder }} />

              <EditRow label="Exercise">
                <ToggleGroup
                  options={EXERCISE_OPTIONS}
                  value={exercise}
                  onChange={v => upd('parsed_exercise', v)}
                />
              </EditRow>

            </div>

            <div style={{ height: 1, backgroundColor: COLORS.darkBorder, margin: '12px 0', flexShrink: 0 }} />
            <button onClick={() => setPhase('reviewing')} style={{ ...STYLES.btnPrimary, marginBottom: 32, flexShrink: 0 }}>
              Done ✓
            </button>
          </div>
        );
      }

      case 'saving': return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: FONTS.serif, fontSize: 20, color: COLORS.darkText, fontWeight: 400, animation: 'pulse 1s ease infinite' }}>
            Saving...
          </p>
        </div>
      );

      case 'saved': return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: COLORS.tealLight, border: `2px solid ${COLORS.tealBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, animation: 'greenPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            color: COLORS.teal,
          }}>✓</div>
          <p style={{ fontFamily: FONTS.serif, fontSize: 26, color: COLORS.darkText, fontWeight: 400 }}>Logged</p>
        </div>
      );

      default: return null;
    }
  };

  const showX = !['saving', 'saved'].includes(phase);
  const headerContent = {
    idle: <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.darkText, fontWeight: 400 }}>Log today</h2>,
    capturing: source === 'text' ? <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.darkText, fontWeight: 400 }}>Log today</h2> : <span />,
    previewing: <span />,
    reviewing: <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange, letterSpacing: '0.1em' }}>REVIEW</p>,
    editing: <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange, letterSpacing: '0.1em' }}>ADJUSTING</p>,
    saving: <span />,
    saved: <span />,
  }[phase] ?? <span />;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: COLORS.overlay, zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          backgroundColor: COLORS.darkBg, borderRadius: '24px 24px 0 0',
          padding: '20px 20px 0',
          height: 'min(580px, 86vh)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.darkBorder, margin: '0 auto 16px', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          {headerContent}
          {showX && (
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.darkMuted, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
