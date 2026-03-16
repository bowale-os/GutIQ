import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { STYLES, FONTS } from '../constants/styles';

// ── Mock data ──────────────────────────────────────────────────────────────────

const SCREEN_TABS = [
  { id: 'profile',    label: 'My Profile' },
  { id: 'lifestyles', label: 'Lifestyles' },
  { id: 'challenges', label: 'Challenges' },
];

const FILTER_CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'food',     label: 'Food' },
  { id: 'sleep',    label: 'Sleep' },
  { id: 'stress',   label: 'Stress' },
  { id: 'habit',    label: 'Habit' },
  { id: 'exercise', label: 'Exercise' },
];

const DIFFICULTY_META = {
  easy:   { label: 'Easy',   chip: { ...STYLES.chip, ...STYLES.chipTeal   } },
  medium: { label: 'Medium', chip: { ...STYLES.chip, ...STYLES.chipAmber  } },
  hard:   { label: 'Hard',   chip: { ...STYLES.chip, ...STYLES.chipDanger } },
};

const MOCK_PROFILE = {
  condition: 'GERD',
  triggers: [
    { name: 'Coffee',     confidence: 92, icon: '☕' },
    { name: 'Poor sleep', confidence: 87, icon: '😴' },
    { name: 'Stress',     confidence: 71, icon: '😤' },
    { name: 'Late meals', confidence: 65, icon: '🌙' },
    { name: 'Spicy food', confidence: 48, icon: '🌶️' },
  ],
  avg_severity:    5.8,
  total_logs:      34,
  days_tracked:    21,
  community_match: 847,
};

const INITIAL_LIFESTYLES = [
  {
    id: 'ww1',
    title: 'Switch to half-caf before noon',
    category: 'food',
    icon: '☕',
    trigger: 'Coffee',
    people_count: 340,
    avg_improvement: 2.1,
    difficulty: 'easy',
    description: 'Replacing morning coffee with half-caf or weak tea. Most people kept one cup but reduced strength.',
    user_tried: false,
  },
  {
    id: 'ww2',
    title: 'Stop eating 3 hours before bed',
    category: 'habit',
    icon: '🌙',
    trigger: 'Late meals',
    people_count: 445,
    avg_improvement: 1.8,
    difficulty: 'medium',
    description: 'Moving last meal earlier. Most found 7pm cutoff sustainable long-term.',
    user_tried: true,
  },
  {
    id: 'ww3',
    title: '10-minute walk after meals',
    category: 'exercise',
    icon: '🚶',
    trigger: 'General digestion',
    people_count: 201,
    avg_improvement: 1.4,
    difficulty: 'easy',
    description: 'Short walk within 30 minutes of eating. Even 5–10 minutes showed benefit in community reports.',
    user_tried: false,
  },
  {
    id: 'ww4',
    title: 'Elevate bed head by 6 inches',
    category: 'sleep',
    icon: '🛏️',
    trigger: 'Poor sleep',
    people_count: 289,
    avg_improvement: 1.6,
    difficulty: 'easy',
    description: 'Using a wedge pillow or raising the head of the bed. Helps gravity keep acid down overnight.',
    user_tried: false,
  },
  {
    id: 'ww5',
    title: '5-minute breathing before meals',
    category: 'stress',
    icon: '🧘',
    trigger: 'Stress',
    people_count: 178,
    avg_improvement: 1.2,
    difficulty: 'easy',
    description: 'Box breathing or slow deep breaths before eating. Activates the parasympathetic nervous system.',
    user_tried: false,
  },
  {
    id: 'ww6',
    title: 'Consistent sleep and wake time',
    category: 'sleep',
    icon: '⏰',
    trigger: 'Poor sleep',
    people_count: 312,
    avg_improvement: 2.0,
    difficulty: 'hard',
    description: 'Same bedtime and wake time every day including weekends. Regulates cortisol and digestion together.',
    user_tried: false,
  },
  {
    id: 'ww7',
    title: 'Smaller meals, more often',
    category: 'food',
    icon: '🍽️',
    trigger: 'General digestion',
    people_count: 389,
    avg_improvement: 1.9,
    difficulty: 'medium',
    description: '4–5 smaller meals instead of 3 large ones. Reduces pressure on the lower esophageal sphincter.',
    user_tried: false,
  },
];

const INITIAL_CHALLENGES = [
  {
    id: 'ch1',
    title: '7-day half-caf',
    icon: '☕',
    trigger: 'Coffee',
    duration_days: 7,
    people_count: 340,
    avg_improvement: 2.1,
    description: 'Replace your morning coffee with half-caf or weak tea for 7 days. Log how you feel each day.',
    difficulty: 'easy',
    active: false,
    completed: false,
    day_current: 0,
  },
  {
    id: 'ch2',
    title: 'No eating after 7pm',
    icon: '🌙',
    trigger: 'Late meals',
    duration_days: 7,
    people_count: 445,
    avg_improvement: 1.8,
    description: 'Finish all eating by 7pm for a week. Tiwa will ask about your symptoms each morning.',
    difficulty: 'medium',
    active: true,
    completed: false,
    day_current: 3,
  },
  {
    id: 'ch3',
    title: 'Post-meal walks',
    icon: '🚶',
    trigger: 'General digestion',
    duration_days: 5,
    people_count: 201,
    avg_improvement: 1.4,
    description: 'Take a 10-minute walk within 30 minutes of each meal for 5 days.',
    difficulty: 'easy',
    active: false,
    completed: true,
    day_current: 5,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function barColor(confidence) {
  if (confidence >= 80) return COLORS.orange;
  if (confidence >= 60) return COLORS.amber;
  return COLORS.mutedLight;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Lifestyles() {
  const [activeTab,    setActiveTab]    = useState('profile');
  const [activeFilter, setActiveFilter] = useState('all');
  const [lifestyles,   setLifestyles]   = useState(INITIAL_LIFESTYLES);
  const [challenges,   setChallenges]   = useState(INITIAL_CHALLENGES);
  const [conflictId,   setConflictId]   = useState(null);

  const toggleTried = (id) =>
    setLifestyles(prev => prev.map(item =>
      item.id === id ? { ...item, user_tried: !item.user_tried } : item
    ));

  const startChallenge = (id) => {
    if (challenges.some(c => c.active)) { setConflictId(id); return; }
    setConflictId(null);
    setChallenges(prev => prev.map(c =>
      c.id === id ? { ...c, active: true, day_current: 1 } : c
    ));
  };

  const abandonChallenge = (id) => {
    setChallenges(prev => prev.map(c =>
      c.id === id ? { ...c, active: false, day_current: 0 } : c
    ));
    setConflictId(null);
  };

  const filtered = [...lifestyles]
    .filter(item => activeFilter === 'all' || item.category === activeFilter)
    .sort((a, b) => b.avg_improvement - a.avg_improvement);

  const activeChallenge    = challenges.find(c => c.active);
  const completedList      = challenges.filter(c => c.completed && !c.active);
  const availableList      = challenges.filter(c => !c.active && !c.completed);

  return (
    <div style={{ ...STYLES.page, maxWidth: 480, margin: '0 auto', paddingBottom: 100 }}>

      {/* ── Page header ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: COLORS.orange, fontSize: 20, lineHeight: 1 }}>◈</span>
          <span style={{ ...STYLES.h2, margin: 0 }}>Lifestyle</span>
        </div>
        <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, margin: 0 }}>
          {MOCK_PROFILE.total_logs} logs · {MOCK_PROFILE.days_tracked} days · {MOCK_PROFILE.community_match} people like you
        </p>
      </div>

      {/* ── Inner tab bar ── */}
      <div style={{ display: 'flex', gap: 6, padding: '16px 20px 0' }}>
        {SCREEN_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, border: 'none', borderRadius: 10, padding: '9px 4px',
              fontFamily: FONTS.sans, fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              backgroundColor: activeTab === tab.id ? COLORS.orange : COLORS.surfaceAlt,
              color: activeTab === tab.id ? '#fff' : COLORS.muted,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div key={activeTab} style={{ animation: 'fadeSlideUp 0.25s ease both' }}>

        {/* ────── Profile tab ────── */}
        {activeTab === 'profile' && (
          <div style={{ padding: '20px 20px 0' }}>
            {/* Condition badge */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ ...STYLES.chip, ...STYLES.chipOrange, fontFamily: FONTS.mono }}>
                {MOCK_PROFILE.condition}
              </span>
            </div>

            {/* Trigger list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {MOCK_PROFILE.triggers.map(trigger => (
                <div key={trigger.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>
                    {trigger.icon}
                  </span>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text, flex: 1, minWidth: 0 }}>
                    {trigger.name}
                  </span>
                  {/* Bar */}
                  <div style={{
                    width: 80, height: 6, borderRadius: 999,
                    backgroundColor: COLORS.surfaceWarm, flexShrink: 0, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${trigger.confidence}%`, height: '100%',
                      borderRadius: 999, backgroundColor: barColor(trigger.confidence),
                    }} />
                  </div>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted, width: 34, textAlign: 'right', flexShrink: 0 }}>
                    {trigger.confidence}%
                  </span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <p style={{ fontFamily: FONTS.serif, fontSize: 15, color: COLORS.muted, textAlign: 'center', marginTop: 28 }}>
              Your average pain level: <span style={{ color: COLORS.text, fontWeight: 600 }}>{MOCK_PROFILE.avg_severity}/10</span>
            </p>
          </div>
        )}

        {/* ────── Lifestyles tab ────── */}
        {activeTab === 'lifestyles' && (
          <div style={{ padding: '20px 20px 0' }}>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {FILTER_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveFilter(cat.id)}
                  style={{
                    ...STYLES.chip,
                    ...(activeFilter === cat.id ? STYLES.chipOrange : STYLES.chipMuted),
                    border: 'none', cursor: 'pointer',
                    fontFamily: FONTS.sans, fontSize: 12,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            {filtered.length === 0 ? (
              <p style={{ ...STYLES.muted, textAlign: 'center', marginTop: 40 }}>
                No lifestyle tips for this category yet.<br />
                More coming as the community grows.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filtered.map(item => (
                  <div key={item.id} style={{ ...STYLES.card, animation: 'fadeSlideUp 0.3s ease both' }}>
                    {/* Title row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontFamily: FONTS.serif, fontSize: 16, color: COLORS.text, lineHeight: 1.3 }}>
                        {item.title}
                      </span>
                    </div>

                    {/* Trigger label */}
                    <p style={{ ...STYLES.label, color: COLORS.orange, margin: '0 0 6px' }}>
                      For people with: {item.trigger} trigger
                    </p>

                    {/* Description */}
                    <p style={{ ...STYLES.muted, fontSize: 13, margin: '0 0 12px' }}>
                      {item.description}
                    </p>

                    {/* Stats */}
                    <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted, margin: '0 0 14px' }}>
                      {item.people_count} people · avg −{item.avg_improvement} pain pts
                    </p>

                    {/* Footer row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={DIFFICULTY_META[item.difficulty].chip}>
                        {DIFFICULTY_META[item.difficulty].label}
                      </span>
                      <button
                        onClick={() => toggleTried(item.id)}
                        style={item.user_tried ? {
                          ...STYLES.btnGhost, width: 'auto', padding: '8px 14px', fontSize: 13,
                          backgroundColor: COLORS.tealLight, color: COLORS.teal, borderColor: COLORS.tealBorder,
                        } : {
                          ...STYLES.btnGhost, width: 'auto', padding: '8px 14px', fontSize: 13,
                        }}
                      >
                        {item.user_tried ? '✓ Tried' : "I've tried this"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────── Challenges tab ────── */}
        {activeTab === 'challenges' && (
          <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Active challenge */}
            {activeChallenge && (
              <div style={{ ...STYLES.cardAccent }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{activeChallenge.icon}</span>
                    <span style={{ fontFamily: FONTS.serif, fontSize: 16, color: COLORS.text }}>
                      {activeChallenge.title}
                    </span>
                  </div>
                  <span style={{ ...STYLES.chip, ...STYLES.chipOrange, flexShrink: 0 }}>ACTIVE</span>
                </div>

                <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.orange, margin: '0 0 8px' }}>
                  Day {activeChallenge.day_current} of {activeChallenge.duration_days}
                </p>

                {/* Progress bar */}
                <div style={{
                  width: '100%', height: 6, borderRadius: 999,
                  backgroundColor: COLORS.surfaceWarm, marginBottom: 6, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(activeChallenge.day_current / activeChallenge.duration_days) * 100}%`,
                    height: '100%', borderRadius: 999, backgroundColor: COLORS.orange,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.muted, margin: '0 0 12px', textAlign: 'right' }}>
                  {activeChallenge.day_current}/{activeChallenge.duration_days}
                </p>

                <p style={{ ...STYLES.muted, fontSize: 13, margin: '0 0 14px' }}>
                  {activeChallenge.description}
                </p>

                <button
                  onClick={() => abandonChallenge(activeChallenge.id)}
                  style={{ ...STYLES.btnGhost, fontSize: 13, padding: '10px 16px' }}
                >
                  Abandon challenge
                </button>
              </div>
            )}

            {/* Completed challenges */}
            {completedList.map(c => (
              <div key={c.id} style={{
                ...STYLES.cardSmall,
                borderColor: COLORS.tealBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  <div>
                    <p style={{ fontFamily: FONTS.sans, fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0 }}>
                      {c.title}
                    </p>
                    <p style={{ ...STYLES.muted, fontSize: 12, margin: 0 }}>
                      Completed · {c.day_current} of {c.duration_days} days
                    </p>
                  </div>
                </div>
                <span style={{ ...STYLES.chip, ...STYLES.chipTeal, flexShrink: 0 }}>✓ Done</span>
              </div>
            ))}

            {/* Available challenges */}
            {availableList.map(c => (
              <div key={c.id} style={{ ...STYLES.card }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span style={{ fontFamily: FONTS.serif, fontSize: 16, color: COLORS.text }}>{c.title}</span>
                </div>

                <p style={{ ...STYLES.label, color: COLORS.muted, margin: '0 0 4px' }}>
                  For: {c.trigger} trigger
                </p>
                <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted, margin: '0 0 8px' }}>
                  {c.people_count} people · avg −{c.avg_improvement} pts
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={DIFFICULTY_META[c.difficulty].chip}>
                    {DIFFICULTY_META[c.difficulty].label}
                  </span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.muted }}>
                    · {c.duration_days} days
                  </span>
                </div>

                <p style={{ ...STYLES.muted, fontSize: 13, margin: '0 0 14px' }}>{c.description}</p>

                <button
                  onClick={() => startChallenge(c.id)}
                  style={{ ...STYLES.btnPrimary, fontSize: 14 }}
                >
                  Start challenge
                </button>

                {conflictId === c.id && (
                  <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.amber, margin: '8px 0 0', textAlign: 'center' }}>
                    Finish your current challenge first.
                  </p>
                )}
              </div>
            ))}

            {!activeChallenge && completedList.length === 0 && availableList.length === 0 && (
              <p style={{ ...STYLES.muted, textAlign: 'center', marginTop: 40 }}>
                No challenges available yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Disclaimer ── */}
      <div style={{ padding: '32px 20px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, lineHeight: 1.7, margin: 0 }}>
          ◈ Community-reported experiences only.<br />
          Not medical advice. Talk to your doctor.
        </p>
      </div>
    </div>
  );
}
