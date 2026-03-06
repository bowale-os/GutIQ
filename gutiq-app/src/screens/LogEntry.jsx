import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  parsed_symptoms: ['heartburn', 'bloating'],
  parsed_severity: 6,
  parsed_stress: 'medium',
  parsed_sleep: 6,
  parsed_exercise: null,
  confidence: 'medium',
  natural_summary: 'Coffee and takeout, reflux mid-evening, moderate stress',
  missing_critical_field: null,
};

const SEV_COLOR = (v) => v <= 3 ? COLORS.teal : v <= 6 ? COLORS.amber : COLORS.danger;
const STRESS_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const EXERCISE_LABELS = { none: 'None', light: 'Light', moderate: 'Moderate', intense: 'Intense' };

function computeMissing(c) {
  const cats = c.log_categories || [];
  if (cats.includes('symptom') && !c.parsed_severity) return 'parsed_severity';
  if (cats.includes('sleep') && !c.parsed_sleep) return 'parsed_sleep';
  if (cats.includes('food') && !(c.parsed_foods?.length)) return 'parsed_foods';
  if (cats.includes('stress') && !c.parsed_stress) return 'parsed_stress';
  return null;
}

function DataRow({ icon, label, value, unit = '', color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.darkMuted }}>{icon} {label}</span>
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

function EditRow({ label, children }) {
  return (
    <div style={{ padding: '10px 0' }}>
      <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.darkMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  );
}

export default function LogEntry({ onClose, userStreak = 4 }) {
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

  const lineRef = useRef(0);
  const discardTimer = useRef(null);
  const logTime = useRef(new Date());

  useEffect(() => {
    if (phase !== 'capturing' || source !== 'voice') return;
    lineRef.current = 0;
    setTranscript('');
    const addLine = () => {
      if (lineRef.current < TRANSCRIPT_LINES.length) {
        setTranscript(prev => prev + (prev ? '\n' : '') + TRANSCRIPT_LINES[lineRef.current++]);
        setTimeout(addLine, 420);
      }
    };
    const t = setTimeout(addLine, 300);
    return () => clearTimeout(t);
  }, [phase, source]);

  useEffect(() => {
    setDiscardGuard(false);
    clearTimeout(discardTimer.current);
    setMissingInput('');
  }, [phase]);

  const upd = (field, val) => setConfirmed(prev => ({ ...prev, [field]: val }));

  const callPreview = async (content) => {
    const rc = content ?? rawContent;
    logTime.current = new Date();
    setPhase('previewing');
    try {
      const token = localStorage.getItem('gutiq_token');
      const res = await fetch(`${BASE_URL}/logs/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ source, raw_content: rc }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConfirmed({ ...data });
    } catch {
      setConfirmed({ ...MOCK_PREVIEW });
    }
    setPhase('reviewing');
  };

  const callSave = async (extra = {}) => {
    const final = { ...confirmed, ...extra };
    setPhase('saving');
    try {
      const token = localStorage.getItem('gutiq_token');
      await fetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source,
          raw_content: rawContent,
          log_categories: final.log_categories,
          parsed_foods: final.parsed_foods,
          parsed_symptoms: final.parsed_symptoms,
          parsed_severity: final.parsed_severity,
          parsed_stress: final.parsed_stress,
          parsed_sleep: final.parsed_sleep,
          parsed_exercise: final.parsed_exercise,
        }),
      });
    } catch { /* proceed while backend isn't ready */ }
    setPhase('saved');
    setTimeout(() => onClose(), 1500);
  };

  const handleClose = () => {
    if (['idle', 'capturing', 'saved'].includes(phase)) { onClose(); return; }
    if (discardGuard) { clearTimeout(discardTimer.current); onClose(); return; }
    setDiscardGuard(true);
    discardTimer.current = setTimeout(() => setDiscardGuard(false), 2500);
  };

  const missing = computeMissing(confirmed);
  const timeStr = logTime.current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderMissingPrompt = () => {
    const numBtn = (n) => (
      <button key={n} onClick={() => callSave({ parsed_severity: n })} style={{
        width: 36, height: 36, borderRadius: 8,
        border: `1px solid ${COLORS.darkBorder}`,
        backgroundColor: 'transparent', color: COLORS.darkText,
        fontFamily: FONTS.mono, fontSize: 13, cursor: 'pointer',
      }}>{n}</button>
    );

    if (missing === 'parsed_severity') return (
      <div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>How bad was it?</p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(numBtn)}
        </div>
      </div>
    );

    if (missing === 'parsed_stress') return (
      <div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>How was your stress?</p>
        <ToggleGroup
          options={[['low','Low'],['medium','Medium'],['high','High']]}
          value={null}
          onChange={v => callSave({ parsed_stress: v })}
        />
      </div>
    );

    if (missing === 'parsed_sleep') return (
      <div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>How many hours did you sleep?</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number" min="0" max="24" step="0.5"
            value={missingInput} onChange={e => setMissingInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && missingInput) callSave({ parsed_sleep: parseFloat(missingInput) }); }}
            placeholder="hrs"
            style={{ ...STYLES.input, backgroundColor: COLORS.darkSurface, border: `1.5px solid ${COLORS.darkBorder}`, color: COLORS.darkText, width: 90, textAlign: 'center' }}
          />
          <button
            onClick={() => { if (missingInput) callSave({ parsed_sleep: parseFloat(missingInput) }); }}
            disabled={!missingInput}
            style={{ ...STYLES.btnPrimary, width: 'auto', padding: '12px 20px', opacity: missingInput ? 1 : 0.4 }}
          >Save</button>
        </div>
      </div>
    );

    if (missing === 'parsed_foods') return (
      <div>
        <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.darkMuted, marginBottom: 10 }}>What did you eat or drink?</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={missingInput} onChange={e => setMissingInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && missingInput.trim()) callSave({ parsed_foods: missingInput.trim().split(',').map(s => s.trim()) }); }}
            placeholder="coffee, pizza..."
            style={{ ...STYLES.input, backgroundColor: COLORS.darkSurface, border: `1.5px solid ${COLORS.darkBorder}`, color: COLORS.darkText, flex: 1 }}
          />
          <button
            onClick={() => { if (missingInput.trim()) callSave({ parsed_foods: missingInput.trim().split(',').map(s => s.trim()) }); }}
            disabled={!missingInput.trim()}
            style={{ ...STYLES.btnPrimary, width: 'auto', padding: '12px 20px', opacity: missingInput.trim() ? 1 : 0.4 }}
          >Save</button>
        </div>
      </div>
    );

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
          <p style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.darkText, fontWeight: 400, marginBottom: 14 }}>
            Just talk
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
            <button
              onClick={() => { setRawContent(transcript); callPreview(transcript); }}
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
              placeholder="What's going on? Just describe it naturally."
              style={{
                ...STYLES.input,
                backgroundColor: COLORS.darkSurface,
                border: `1.5px solid ${textFocused ? COLORS.orange : COLORS.darkBorder}`,
                color: COLORS.darkText, flex: 1, resize: 'none', lineHeight: 1.6, marginBottom: 14,
              }}
            />
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
            ✦ Nova is reading your log...
          </p>
        </div>
      );

      case 'reviewing': {
        const foods = confirmed.parsed_foods || [];
        const sev = confirmed.parsed_severity;
        const stress = confirmed.parsed_stress;
        const sleep = confirmed.parsed_sleep;
        const exercise = confirmed.parsed_exercise;
        const isLowConf = confirmed.confidence === 'low';

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeSlideUp 0.3s ease' }}>

            {/* Voice transcript */}
            {source === 'voice' && transcript && (
              <div style={{ backgroundColor: COLORS.darkSurfaceAlt, borderRadius: 10, padding: '10px 12px', marginBottom: 12, flexShrink: 0 }}>
                <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange, letterSpacing: '0.08em', marginBottom: 4 }}>🎙️ NOVA HEARD</p>
                <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.darkMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{transcript.replace(/\n/g, ' ')}"
                </p>
              </div>
            )}

            {/* Summary */}
            <div style={{ marginBottom: 12, flexShrink: 0 }}>
              <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange, letterSpacing: '0.08em', marginBottom: 6 }}>✦ NOVA CAPTURED</p>
              <p style={{ fontFamily: FONTS.serif, fontSize: 17, color: COLORS.darkText, fontWeight: 400, lineHeight: 1.35, marginBottom: 4 }}>
                "{confirmed.natural_summary}"
              </p>
              <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.darkMuted }}>at {timeStr}</p>
            </div>

            <div style={{ height: 1, backgroundColor: COLORS.darkBorder, marginBottom: 12, flexShrink: 0 }} />

            {/* Foods */}
            {foods.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, flexShrink: 0 }}>
                {foods.map(f => (
                  <span key={f} style={{ ...STYLES.chip, backgroundColor: COLORS.orangeLight, color: COLORS.orange, border: `1px solid ${COLORS.orangeBorder}` }}>{f}</span>
                ))}
              </div>
            )}

            {/* Data rows */}
            <div style={{ flexShrink: 0 }}>
              <DataRow icon="🔥" label="Severity" value={sev} unit="/10" color={sev ? SEV_COLOR(sev) : null} />
              <DataRow icon="🧠" label="Stress" value={stress ? STRESS_LABELS[stress] : null} />
              <DataRow icon="😴" label="Sleep" value={sleep} unit="h" />
              <DataRow icon="💪" label="Exercise" value={exercise ? EXERCISE_LABELS[exercise] : null} />
            </div>

            <div style={{ height: 1, backgroundColor: COLORS.darkBorder, margin: '12px 0', flexShrink: 0 }} />

            {/* Low confidence banner */}
            {isLowConf && (
              <div style={{ backgroundColor: COLORS.amberDim, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10, flexShrink: 0 }}>
                <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.amber }}>⚠ Nova wasn't certain — please review carefully</p>
              </div>
            )}

            {/* Missing field prompt */}
            {missing && (
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                {renderMissingPrompt()}
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Discard hint */}
            {discardGuard && (
              <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.amber, textAlign: 'center', marginBottom: 8, animation: 'fadeIn 0.2s ease' }}>
                Tap × again to discard
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, paddingBottom: 32, flexShrink: 0 }}>
              <button
                onClick={() => { setShowAddFood(false); setAddFoodInput(''); setPhase('editing'); }}
                style={{ ...STYLES.btnGhost, flex: 1, backgroundColor: COLORS.darkSurface, borderColor: COLORS.darkBorder, color: COLORS.darkMuted }}
              >
                ✏ Adjust
              </button>
              <button
                onClick={() => callSave()}
                disabled={!!missing}
                style={{ ...STYLES.btnPrimary, flex: 1, opacity: missing ? 0.3 : 1, cursor: missing ? 'not-allowed' : 'pointer' }}
              >
                Save ✓
              </button>
            </div>
          </div>
        );
      }

      case 'editing': {
        const foods = confirmed.parsed_foods || [];
        const sev = confirmed.parsed_severity;
        const stress = confirmed.parsed_stress;
        const sleep = confirmed.parsed_sleep;
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

              <EditRow label="Severity">
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => upd('parsed_severity', n)} style={{
                      width: 34, height: 34, borderRadius: 8,
                      border: `1px solid ${sev === n ? COLORS.orange : COLORS.darkBorder}`,
                      backgroundColor: sev === n ? COLORS.orange : 'transparent',
                      color: sev === n ? '#fff' : COLORS.darkMuted,
                      fontFamily: FONTS.mono, fontSize: 13, cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>
              </EditRow>

              <div style={{ height: 1, backgroundColor: COLORS.darkBorder }} />

              <EditRow label="Stress">
                <ToggleGroup
                  options={[['low','Low'],['medium','Medium'],['high','High']]}
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
                  options={[['none','None'],['light','Light'],['moderate','Moderate'],['intense','Intense']]}
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
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            backgroundColor: COLORS.amberDim, border: `1px solid ${COLORS.amberBorder}`,
            borderRadius: 999, padding: '4px 12px',
            fontFamily: FONTS.mono, fontSize: 12, color: COLORS.amber,
          }}>
            🔥 {userStreak}-day streak
          </span>
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
