import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { COLORS } from '../constants/colors';
import { FONTS, STYLES } from '../constants/styles';
import { mockConversationHistory } from '../constants/mockData'; // used in demo mode only
import { askGutCheck } from '../api/gutCheck';

// ── Tool display labels ────────────────────────────────────────────────────────
const TOOL_DISPLAY = {
  query_logs:     'Searching your full history',
  fetch_research: 'Looking up clinical research',
};

// ── Demo mode mock (used when demoMode=true, no real API call) ─────────────────
const DEMO_QUESTIONS = [
  "Why was last week so bad?",
  "Is coffee actually causing this?",
  "How much is stress affecting me?",
  "What foods should I avoid?",
];

const DEMO_RESPONSES = {
  default: {
    tools: [],
    answer: "Looking at your last 14 days, your worst episodes share three things: coffee in the morning, under 6 hours of sleep the night before, and high stress. On your cleanest days — Feb 20, Feb 22, Feb 26, Mar 2 — you had none of those three together. Coffee alone lifts your average pain level from 2.1 to 5.8.",
  },
  stress: {
    tools: [],
    answer: "Stress is your strongest single trigger. On high-stress days your average pain level is 7.2 versus 2.8 on low-stress days, which is a bigger gap than coffee alone. The gut-brain axis research is direct on this: psychological stress increases visceral sensitivity and esophageal acid exposure time.",
  },
  coffee: {
    tools: ['fetch_research'],
    answer: "Coffee shows up on 10 of your 14 logged days, and on every day where your pain level hit 6 or above. On the 4 days without it, your average dropped to 2.1. Caffeine relaxes the lower oesophageal sphincter, which is the valve that keeps acid down, and this maps directly to your GERD pattern.",
  },
  sleep: {
    tools: [],
    answer: "Your 5 worst days all followed nights with 5 hours or less of sleep. When you got 7 or more, your next-day average was 2.8. Poor sleep slows mucosal recovery in your oesophagus, so acid damage compounds faster. The pattern in your logs is consistent.",
  },
  food: {
    tools: ['query_logs'],
    answer: "The foods that reliably precede your symptoms: coffee, spicy food, pizza, wine, and beer, all appearing within 3 hours before 9 of your 10 high-pain episodes. Your best days had herbal tea, vegetables, and grilled proteins.",
  },
};

function detectDemoKeyword(q) {
  const lq = q.toLowerCase();
  if (lq.includes('stress') || lq.includes('anxiety')) return 'stress';
  if (lq.includes('coffee') || lq.includes('caffeine')) return 'coffee';
  if (lq.includes('sleep') || lq.includes('tired'))    return 'sleep';
  if (lq.includes('food') || lq.includes('eat') || lq.includes('avoid')) return 'food';
  return 'default';
}

export default function GutCheck({ user, demoMode = false }) {
  const [phase, setPhase] = useState('idle');
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [toolCallStates, setToolCallStates] = useState([]);
  const [sessionId, setSessionId] = useState(null);   // persists across turns
  const [safetyLevel, setSafetyLevel] = useState('none'); // "none" | "see_doctor" | "emergency"
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [conversation.length, toolCallStates.length, phase, streamedAnswer]);

  async function runConversation(question) {
    if (busyRef.current) return;
    busyRef.current = true;

    // If previous exchange is done, archive it before starting the new one
    if (phase === 'done' && currentQuestion && streamedAnswer) {
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
    }

    setCurrentQuestion(question);
    setStreamedAnswer('');
    setSafetyLevel('none');
    setError(null);
    setPhase('thinking');
    setToolCallStates([]);

    if (demoMode) {
      // ── Demo path: simulate with local mock data ─────────────────────────
      const key = detectDemoKeyword(question);
      const { tools, answer } = DEMO_RESPONSES[key];

      setToolCallStates(tools.map(t => ({ name: t, state: 'pending' })));
      for (let i = 0; i < tools.length; i++) {
        await new Promise(r => setTimeout(r, 350));
        setToolCallStates(prev => prev.map((t, idx) => idx === i ? { ...t, state: 'active' } : t));
        await new Promise(r => setTimeout(r, 700));
        setToolCallStates(prev => prev.map((t, idx) => idx === i ? { ...t, state: 'done' } : t));
      }

      await new Promise(r => setTimeout(r, 200));
      setPhase('responding');
      let built = '';
      for (const word of answer.split(' ')) {
        await new Promise(r => setTimeout(r, 80));
        built += (built ? ' ' : '') + word;
        setStreamedAnswer(built);
      }
      setPhase('done');
      busyRef.current = false;
      return;
    }

    // ── Real path: SSE stream from backend ───────────────────────────────
    await askGutCheck(question, sessionId, {
      onSessionId: (id) => setSessionId(id),

      onToolStart: (tool) => {
        setToolCallStates(prev => {
          // avoid duplicate entries if tool fires more than once
          if (prev.some(t => t.name === tool && t.state !== 'done')) return prev;
          return [...prev, { name: tool, state: 'active' }];
        });
      },

      onToolDone: (tool) => {
        setToolCallStates(prev =>
          prev.map(t => t.name === tool && t.state === 'active' ? { ...t, state: 'done' } : t)
        );
      },

      onChunk: (text) => {
        setPhase('responding');
        setStreamedAnswer(prev => prev + text);
      },

      onSafety: (level) => {
        setSafetyLevel(level);
      },

      onDone: () => {
        setPhase('done');
        busyRef.current = false;
      },

      onError: (msg) => {
        setError(msg);
        setPhase('idle');
        busyRef.current = false;
      },
    });
  }

  function handleTextSubmit() {
    const q = inputText.trim();
    if (!q || (phase !== 'idle' && phase !== 'done')) return;
    setInputText('');
    runConversation(q);
  }

  function handleMicTap() {
    // Tap while listening → stop and submit
    if (phase === 'listening') {
      recognitionRef.current?.stop();
      return;
    }
    if (phase !== 'idle' && phase !== 'done') return;

    if (demoMode) {
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
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Voice input is not supported in this browser.'); return; }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += (finalText ? ' ' : '') + t;
        else interim = t;
      }
      setTranscript(finalText + (interim ? ' ' + interim : ''));
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') setError('Microphone access denied.');
      setPhase('idle');
      setTranscript('');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const question = finalText.trim();
      setTranscript('');
      if (question) {
        runConversation(question);
      } else {
        setPhase('idle');
      }
    };

    recognition.start();
    setPhase('listening');
    setTranscript('');
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
            <p style={{ ...STYLES.label, margin: 0 }}>Tiwa</p>
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
          }}>{user?.name?.charAt(0).toUpperCase() ?? '?'}</div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ padding: '16px 20px', paddingBottom: 200 }}>

        {/* Tiwa intro card */}
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
            }}>Tiwa · Ready</span>
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
            safetyLevel={safetyLevel}
            onAskAnother={handleAskAnother}
          />
        )}

        {/* Previous checks — demo shows mock history, real shows current session */}
        {(demoMode ? mockConversationHistory.length > 0 : conversation.length > 0) && (
          <>
            <div style={{ ...STYLES.divider, margin: '16px 0 12px' }} />
            <p style={{ ...STYLES.label, margin: '0 0 8px' }}>
              {demoMode ? 'Previous gut checks' : 'This session'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(demoMode ? mockConversationHistory : conversation).map((item, i) => (
                <div key={item.id ?? i} style={{
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
          </>
        )}
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
        {error && (
          <div style={{
            marginBottom: 8, padding: '7px 12px',
            backgroundColor: '#FEF2F2', borderRadius: 8,
            fontSize: 13, color: '#DC2626',
            animation: 'fadeIn 0.2s ease',
          }}>
            {error}
          </div>
        )}
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
            onChange={e => { if (phase === 'idle' || phase === 'done') setInputText(e.target.value); }}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
            placeholder={
              phase === 'listening' ? 'Listening...' :
              phase === 'thinking' || phase === 'responding' ? 'Tiwa is thinking...' :
              'Ask about your gut health...'
            }
            disabled={phase !== 'idle' && phase !== 'done'}
            style={{
              ...STYLES.input,
              flex: 1, fontSize: 14, padding: '10px 14px',
              backgroundColor: (phase !== 'idle' && phase !== 'done') ? COLORS.surfaceAlt : COLORS.surface,
              opacity: (phase !== 'idle' && phase !== 'done') ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          />

          {inputText.trim() && (phase === 'idle' || phase === 'done') ? (
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
              <button
                onClick={handleMicTap}
                disabled={phase === 'thinking' || phase === 'responding'}
                title={phase === 'listening' ? 'Listening…' : undefined}
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  backgroundColor: phase === 'listening' ? COLORS.orangeHover : COLORS.orange,
                  border: 'none',
                  cursor: (phase === 'thinking' || phase === 'responding') ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color 0.2s ease',
                }}
              >
                {phase === 'listening'
                  ? <MicOff size={18} color="#fff" strokeWidth={1.5} />
                  : <Mic    size={18} color="#fff" strokeWidth={1.5} />
                }
              </button>
            </div>
          )}
        </div>

        <p style={{
          margin: '5px 0 0', fontSize: 10, textAlign: 'center',
          color: COLORS.mutedLight, fontFamily: FONTS.mono,
          opacity: phase === 'idle' ? 1 : 0,
        }}>
          Type to ask · or tap mic for voice
        </p>
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
        <TiwaAvatar />
        <div style={{ flex: 1 }}>
          <div style={{
            backgroundColor: COLORS.surface,
            borderRadius: '4px 16px 16px 16px',
            padding: '12px 14px',
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.text, marginBottom: 8 }}>
              <ReactMarkdown
                components={{
                  p:      ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                  ul:     ({ children }) => <ul style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{children}</ul>,
                  ol:     ({ children }) => <ol style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{children}</ol>,
                  li:     ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                  h1: ({ children }) => <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{children}</p>,
                  h2: ({ children }) => <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{children}</p>,
                  h3: ({ children }) => <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{children}</p>,
                }}
              >
                {item.answer}
              </ReactMarkdown>
            </div>
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

const THINKING_THOUGHTS = [
  "Reading your recent logs...",
  "Looking for patterns in your data...",
  "Connecting the dots...",
  "Reviewing your symptom history...",
  "Thinking through what this means for you...",
  "Cross-referencing your entries...",
  "Pulling together what I know about you...",
  "Almost there...",
];

function ThinkingBubble({ toolCallStates }) {
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [visible, setVisible]       = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setThoughtIdx(i => (i + 1) % THINKING_THOUGHTS.length);
        setVisible(true);
      }, 300);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      backgroundColor: COLORS.darkBg,
      borderRadius: '4px 16px 16px 16px',
      padding: '16px 18px',
      border: `1px solid ${COLORS.darkBorder}`,
    }}>

      {/* Pulsing header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: COLORS.orange,
          animation: 'pulse 1.4s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
          color: COLORS.orange, letterSpacing: '0.09em', textTransform: 'uppercase',
        }}>
          Tiwa · thinking
        </span>
      </div>

      {/* Rotating thought */}
      <p style={{
        margin: '0 0 14px',
        fontSize: 13, color: COLORS.darkText, lineHeight: 1.5,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        minHeight: 20,
      }}>
        {THINKING_THOUGHTS[thoughtIdx]}
      </p>

      {/* Tool call states — only shown when tools fire */}
      {toolCallStates.length > 0 && (
        <div style={{
          borderTop: `1px solid ${COLORS.darkBorder}`,
          paddingTop: 12,
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
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
                  fontSize: 12, fontFamily: FONTS.mono,
                  color: isPending ? COLORS.darkMuted : COLORS.darkText,
                  transition: 'color 0.3s ease',
                  letterSpacing: '0.03em',
                }}>
                  {TOOL_DISPLAY[tc.name] ?? tc.name.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActiveExchange({ question, phase, toolCallStates, streamedAnswer, safetyLevel, onAskAnother }) {
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
        <TiwaAvatar />
        <div style={{ flex: 1 }}>
          {phase === 'thinking' && <ThinkingBubble toolCallStates={toolCallStates} />}

          {(phase === 'responding' || phase === 'done') && (
            <div>
              <div style={{
                backgroundColor: COLORS.surface,
                borderRadius: '4px 16px 16px 16px',
                padding: '12px 14px',
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.text }}>
                  <ReactMarkdown
                    components={{
                      p:      ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ fontWeight: 600, color: COLORS.text }}>{children}</strong>,
                      ul:     ({ children }) => <ul style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{children}</ul>,
                      ol:     ({ children }) => <ol style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{children}</ol>,
                      li:     ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                      h1: ({ children }) => <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{children}</p>,
                      h2: ({ children }) => <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{children}</p>,
                      h3: ({ children }) => <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{children}</p>,
                    }}
                  >
                    {streamedAnswer}
                  </ReactMarkdown>
                  {phase === 'responding' && (
                    <span style={{
                      display: 'inline-block', width: 2, height: 13,
                      backgroundColor: COLORS.orange, marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'pulse 0.7s ease-in-out infinite',
                    }} />
                  )}
                </div>
              </div>
              {phase === 'done' && (
                <>
                  {safetyLevel === 'see_doctor' && (
                    <div style={{
                      marginTop: 10, padding: '9px 12px', borderRadius: 8,
                      backgroundColor: '#fff7ed',
                      border: '1px solid #fed7aa',
                      fontFamily: FONTS.sans, fontSize: 12, color: '#92400e',
                      lineHeight: 1.5, animation: 'fadeSlideUp 0.25s ease both',
                    }}>
                      This is worth discussing with your doctor or a healthcare professional.
                    </div>
                  )}
                  {safetyLevel === 'emergency' && (
                    <div style={{
                      marginTop: 10, padding: '9px 12px', borderRadius: 8,
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      fontFamily: FONTS.sans, fontSize: 12, color: '#991b1b',
                      lineHeight: 1.5, animation: 'fadeSlideUp 0.25s ease both',
                    }}>
                      These symptoms need urgent medical attention. Please contact emergency services or go to your nearest emergency department now.
                    </div>
                  )}
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TiwaAvatar() {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      backgroundColor: COLORS.darkBg, flexShrink: 0, marginTop: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, color: COLORS.orange, fontFamily: FONTS.mono, fontWeight: 700,
    }}>T</div>
  );
}
