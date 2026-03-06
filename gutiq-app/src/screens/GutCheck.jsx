import { useState, useRef, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { mockConversationHistory } from '../constants/mockData';

const delay = ms => new Promise(r => setTimeout(r, ms));

const TOOL_DISPLAY = {
  query_logs:          'Searching your logs',
  get_preceding_foods: 'Checking what you ate before symptoms',
  correlate:           'Finding correlations in your data',
  fetch_research:      'Looking up clinical research',
};

const MOCK_RESPONSES = {
  default: {
    tools: ['query_logs', 'correlate', 'fetch_research'],
    answer: "Looking at your last 14 days, your worst episodes share three things: coffee in the morning, under 6 hours of sleep the night before, and high stress. On your cleanest days — Feb 20, Feb 22, Feb 26, Mar 2 — you had none of those three together. Coffee alone lifts your average severity from 2.1 to 5.8.",
  },
  stress: {
    tools: ['correlate', 'fetch_research'],
    answer: "Stress is your strongest single trigger. On high-stress days your average severity is 7.2 versus 2.8 on low-stress days — a bigger gap than coffee alone. The gut-brain axis research is direct on this: psychological stress increases visceral sensitivity and esophageal acid exposure time.",
  },
  coffee: {
    tools: ['get_preceding_foods', 'correlate', 'fetch_research'],
    answer: "Coffee shows up on 10 of your 14 logged days, and on every day where severity hit 6 or above. On the 4 days without it, your average dropped to 2.1. Caffeine relaxes the lower esophageal sphincter — the valve that keeps acid down — which maps directly to your GERD pattern.",
  },
  sleep: {
    tools: ['query_logs', 'correlate', 'fetch_research'],
    answer: "Your 5 worst days all followed nights with 5 hours or less of sleep. When you got 7 or more, your next-day average was 2.8. Poor sleep slows mucosal recovery in your esophagus, so acid damage compounds faster. It's less dramatic than coffee but the pattern in your logs is consistent.",
  },
  food: {
    tools: ['get_preceding_foods', 'correlate', 'fetch_research'],
    answer: "The foods that reliably precede your symptoms: coffee, spicy food, pizza, wine, and beer — all appearing within 3 hours before 9 of your 10 high-severity episodes. Your best days had herbal tea, vegetables, and grilled proteins. The contrast in your data is stark.",
  },
};

const DEMO_QUESTIONS = [
  "Why was last week so bad?",
  "Is coffee actually causing this?",
  "How much is stress affecting me?",
  "What foods should I avoid?",
];

function detectKeyword(q) {
  const lq = q.toLowerCase();
  if (lq.includes('stress') || lq.includes('anxiety') || lq.includes('work')) return 'stress';
  if (lq.includes('coffee') || lq.includes('caffeine')) return 'coffee';
  if (lq.includes('sleep') || lq.includes('tired')) return 'sleep';
  if (lq.includes('food') || lq.includes('eat') || lq.includes('avoid') || lq.includes('trigger')) return 'food';
  return 'default';
}

export default function GutCheck() {
  const [phase, setPhase] = useState('idle');
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [toolCallStates, setToolCallStates] = useState([]);

  const inputRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, [conversation.length, streamedAnswer.length, toolCallStates.length, phase]);

  async function runConversation(question) {
    if (busyRef.current) return;
    busyRef.current = true;

    const key = detectKeyword(question);
    const { tools, answer } = MOCK_RESPONSES[key];

    setCurrentQuestion(question);
    setPhase('thinking');
    setToolCallStates(tools.map(t => ({ name: t, state: 'pending' })));

    for (let i = 0; i < tools.length; i++) {
      await delay(350);
      setToolCallStates(prev => prev.map((t, idx) => idx === i ? { ...t, state: 'active' } : t));
      await delay(i === 1 ? 900 : 700);
      setToolCallStates(prev => prev.map((t, idx) => idx === i ? { ...t, state: 'done' } : t));
    }

    await delay(200);
    setPhase('responding');
    setStreamedAnswer('');

    const words = answer.split(' ');
    let built = '';
    for (const word of words) {
      await delay(90);
      built += (built ? ' ' : '') + word;
      setStreamedAnswer(built);
    }

    setPhase('done');
    busyRef.current = false;
  }

  function handleTextSubmit() {
    const q = inputText.trim();
    if (!q || phase !== 'idle') return;
    setInputText('');
    runConversation(q);
  }

  function handleMicTap() {
    if (phase !== 'idle') return;
    setPhase('listening');
    const question = DEMO_QUESTIONS[Math.floor(Math.random() * DEMO_QUESTIONS.length)];
    const words = question.split(' ');
    let idx = 0, built = '';
    const iv = setInterval(() => {
      if (idx < words.length) {
        built += (built ? ' ' : '') + words[idx++];
        setTranscript(built);
      } else {
        clearInterval(iv);
        setTimeout(() => { setTranscript(''); runConversation(question); }, 400);
      }
    }, 200);
  }

  function handleAskAnother() {
    const ts = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
    setConversation(prev => [...prev, {
      id: Date.now(),
      question: currentQuestion,
      answer: streamedAnswer,
      timestamp: ts,
      tools_used: toolCallStates.map(t => t.name),
    }]);
    setPhase('idle');
    setCurrentQuestion('');
    setStreamedAnswer('');
    setToolCallStates([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const showActiveExchange = ['thinking', 'responding', 'done'].includes(phase);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.background,
      fontFamily: FONTS.sans,
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.background,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ ...STYLES.label, margin: 0 }}>Nova</p>
            <h1 style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 400, margin: '2px 0 0', color: COLORS.text }}>
              Gut Check
            </h1>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            backgroundColor: COLORS.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: '#fff',
            letterSpacing: '0.05em',
          }}>AR</div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ padding: '16px 20px', paddingBottom: 200 }}>

        {/* Nova intro card */}
        <div style={{
          backgroundColor: COLORS.darkBg,
          borderRadius: 16, padding: '18px 20px',
          marginBottom: 20,
          border: `1px solid ${COLORS.darkBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              backgroundColor: COLORS.orange,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
              color: COLORS.orange, letterSpacing: '0.09em', textTransform: 'uppercase',
            }}>Nova · Ready</span>
          </div>
          <p style={{ margin: 0, color: COLORS.darkText, fontSize: 15, lineHeight: 1.5 }}>
            Ask me anything about your gut health. I've analysed your last 14 days of logs.
          </p>
          <p style={{ margin: '8px 0 0', color: COLORS.darkMuted, fontSize: 12, fontFamily: FONTS.mono, lineHeight: 1.5 }}>
            Try: "Why was last week so bad?" or "What's triggering my symptoms?"
          </p>
        </div>

        {/* Completed conversation items */}
        {conversation.map(item => (
          <ConversationItem key={item.id} item={item} />
        ))}

        {/* Active exchange */}
        {showActiveExchange && (
          <ActiveExchange
            question={currentQuestion}
            phase={phase}
            toolCallStates={toolCallStates}
            streamedAnswer={streamedAnswer}
            onAskAnother={handleAskAnother}
          />
        )}

        {/* Previous checks */}
        <div style={{ ...STYLES.divider, margin: '16px 0 12px' }} />
        <p style={{ ...STYLES.label, margin: '0 0 8px' }}>Previous gut checks</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {mockConversationHistory.map(item => (
            <div key={item.id} style={{
              backgroundColor: COLORS.surface,
              borderRadius: 10, padding: '11px 14px',
              border: `1px solid ${COLORS.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 500, color: COLORS.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  "{item.question}"
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: COLORS.mutedLight, fontFamily: FONTS.mono }}>
                  {item.timestamp}
                </p>
              </div>
              <span style={{ color: COLORS.mutedLight, fontSize: 14, flexShrink: 0 }}>&#8594;</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed input area */}
      <div style={{
        position: 'fixed',
        bottom: 72,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        backgroundColor: COLORS.background,
        borderTop: `1px solid ${COLORS.border}`,
        padding: '10px 16px 12px',
        zIndex: 10,
      }}>
        {phase === 'listening' && transcript && (
          <div style={{
            marginBottom: 8, padding: '7px 12px',
            backgroundColor: COLORS.surfaceAlt, borderRadius: 8,
            fontSize: 13, color: COLORS.text, fontStyle: 'italic',
            animation: 'fadeIn 0.2s ease',
          }}>
            "{transcript}..."
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={phase === 'listening' ? '' : inputText}
            onChange={e => { if (phase === 'idle') setInputText(e.target.value); }}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
            placeholder={
              phase === 'listening' ? 'Listening...' :
              phase === 'thinking' || phase === 'responding' ? 'Nova is thinking...' :
              'Ask about your gut health...'
            }
            disabled={phase !== 'idle'}
            style={{
              ...STYLES.input,
              flex: 1, fontSize: 14, padding: '10px 14px',
              backgroundColor: phase !== 'idle' ? COLORS.surfaceAlt : COLORS.surface,
              opacity: phase !== 'idle' ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          />

          {inputText.trim() && phase === 'idle' ? (
            <button
              onClick={handleTextSubmit}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                backgroundColor: COLORS.orange, border: 'none',
                cursor: 'pointer', color: '#fff', fontSize: 18,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              &#8599;
            </button>
          ) : (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {phase === 'listening' && (
                <div style={{
                  position: 'absolute', inset: -5, borderRadius: '50%',
                  border: `2px solid ${COLORS.orange}`,
                  animation: 'sonarPulse 1.2s ease-out infinite',
                  pointerEvents: 'none',
                }} />
              )}
              <button
                onClick={handleMicTap}
                disabled={phase !== 'idle' && phase !== 'listening'}
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  backgroundColor: phase === 'listening' ? COLORS.orangeHover : COLORS.orange,
                  border: 'none',
                  cursor: phase !== 'idle' && phase !== 'listening' ? 'default' : 'pointer',
                  fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color 0.2s ease',
                }}
              >
                &#127897;
              </button>
            </div>
          )}
        </div>

        {phase === 'idle' && (
          <p style={{
            margin: '5px 0 0', fontSize: 10, textAlign: 'center',
            color: COLORS.mutedLight, fontFamily: FONTS.mono,
          }}>
            Type to ask · or tap mic for voice
          </p>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ item }) {
  return (
    <div style={{ marginBottom: 20, animation: 'fadeSlideUp 0.3s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{
          backgroundColor: COLORS.orange,
          borderRadius: '16px 16px 4px 16px',
          padding: '11px 16px', maxWidth: '80%',
          color: '#fff', fontSize: 15, lineHeight: 1.4,
        }}>
          {item.question}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <NovaAvatar />
        <div style={{ flex: 1 }}>
          <div style={{
            backgroundColor: COLORS.surface,
            borderRadius: '4px 16px 16px 16px',
            padding: '12px 14px',
            border: `1px solid ${COLORS.border}`,
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.55, color: COLORS.text }}>
              {item.answer}
            </p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {item.tools_used.map(t => (
                <span key={t} style={{
                  ...STYLES.chip, ...STYLES.chipMuted,
                  fontSize: 10, padding: '2px 7px', fontFamily: FONTS.mono,
                }}>
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: COLORS.mutedLight, fontFamily: FONTS.mono }}>
            {item.timestamp}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActiveExchange({ question, phase, toolCallStates, streamedAnswer, onAskAnother }) {
  return (
    <div style={{ marginBottom: 20, animation: 'fadeSlideUp 0.3s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{
          backgroundColor: COLORS.orange,
          borderRadius: '16px 16px 4px 16px',
          padding: '11px 16px', maxWidth: '80%',
          color: '#fff', fontSize: 15, lineHeight: 1.4,
        }}>
          {question}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <NovaAvatar />
        <div style={{ flex: 1 }}>
          {phase === 'thinking' && (
            <div style={{
              backgroundColor: COLORS.darkBg,
              borderRadius: '4px 16px 16px 16px',
              padding: '14px 16px',
              border: `1px solid ${COLORS.darkBorder}`,
            }}>
              <p style={{
                margin: '0 0 12px',
                fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
                color: COLORS.orange, letterSpacing: '0.09em', textTransform: 'uppercase',
              }}>
                Nova is checking your data...
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {toolCallStates.map(tc => {
                  const isDone    = tc.state === 'done';
                  const isActive  = tc.state === 'active';
                  const isPending = tc.state === 'pending';
                  return (
                    <div key={tc.name} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      opacity: isPending ? 0.35 : 1,
                      transition: 'opacity 0.3s ease',
                    }}>
                      <span style={{
                        fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0,
                        color: isDone ? '#4ADE80' : isActive ? COLORS.orange : COLORS.darkMuted,
                        display: 'inline-block',
                        animation: isActive ? 'spin 1s linear infinite' : isDone ? 'greenPop 0.3s ease both' : 'none',
                      }}>
                        {isDone ? '✓' : isActive ? '⟳' : '○'}
                      </span>
                      <span style={{
                        fontSize: 13, fontFamily: FONTS.sans,
                        color: isPending ? COLORS.darkMuted : COLORS.darkText,
                        transition: 'color 0.3s ease',
                      }}>
                        {TOOL_DISPLAY[tc.name]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(phase === 'responding' || phase === 'done') && (
            <div>
              <div style={{
                backgroundColor: COLORS.surface,
                borderRadius: '4px 16px 16px 16px',
                padding: '12px 14px',
                border: `1px solid ${COLORS.border}`,
              }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: COLORS.text }}>
                  {streamedAnswer}
                  {phase === 'responding' && (
                    <span style={{
                      display: 'inline-block', width: 2, height: 13,
                      backgroundColor: COLORS.orange, marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'pulse 0.7s ease-in-out infinite',
                    }} />
                  )}
                </p>
              </div>
              {phase === 'done' && (
                <button
                  onClick={onAskAnother}
                  style={{
                    marginTop: 8, background: 'none',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8, padding: '7px 14px',
                    fontSize: 13, fontFamily: FONTS.sans, fontWeight: 500,
                    color: COLORS.muted, cursor: 'pointer',
                  }}
                >
                  Ask another &#8594;
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NovaAvatar() {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      backgroundColor: COLORS.darkBg, flexShrink: 0, marginTop: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, color: COLORS.orange, fontFamily: FONTS.mono, fontWeight: 700,
    }}>N</div>
  );
}
