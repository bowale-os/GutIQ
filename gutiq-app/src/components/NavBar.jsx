import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/styles';

const TABS = [
  { id: 'dashboard', icon: '⌂',  label: 'Home'     },
  { id: 'gutcheck',  icon: '✦',  label: 'Gut Check' },
  { id: 'export',    icon: '↗',  label: 'Export'   },
  { id: 'profile',   icon: '○',  label: 'Profile'  },
];

export default function NavBar({ currentScreen, navigate, onLogClick, demoMode, onExitDemo }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      backgroundColor: 'rgba(250, 247, 242, 0.96)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid rgba(28, 25, 23, 0.10)`,
      height: 72,
      display: 'flex', alignItems: 'center',
      maxWidth: 480, margin: '0 auto', padding: '0 8px',
    }}>
      {/* Left tabs */}
      {TABS.slice(0, 2).map(tab => {
        const active = currentScreen === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 0',
              opacity: active ? 1 : 0.45,
              transition: 'opacity 0.15s ease',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, color: active ? COLORS.orange : COLORS.muted }}>{tab.icon}</span>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 10,
              fontWeight: active ? 600 : 400,
              color: active ? COLORS.orange : COLORS.muted,
              letterSpacing: '0.03em',
            }}>{tab.label}</span>
          </button>
        );
      })}

      {/* Center FAB */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={onLogClick}
          style={{
            width: 54, height: 54, borderRadius: '50%',
            backgroundColor: COLORS.orange, border: 'none', cursor: 'pointer',
            fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px ${COLORS.orange}44, 0 4px 12px rgba(0,0,0,0.2)`,
            marginBottom: 8, flexShrink: 0, color: '#fff',
          }}
          title="Tell me about it"
        >
          +
        </button>
      </div>

      {/* Right tabs: Export + Profile (or Exit demo) */}
      {TABS.slice(2).map(tab => {
        if (tab.id === 'profile' && demoMode) {
          return (
            <button
              key="exit-demo"
              onClick={onExitDemo}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 0',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, color: COLORS.orange }}>✕</span>
              <span style={{
                fontFamily: FONTS.sans, fontSize: 10, fontWeight: 600,
                color: COLORS.orange, letterSpacing: '0.03em',
              }}>Exit demo</span>
            </button>
          );
        }
        const active = currentScreen === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 0',
              opacity: active ? 1 : 0.45,
              transition: 'opacity 0.15s ease',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, color: active ? COLORS.orange : COLORS.muted }}>{tab.icon}</span>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 10,
              fontWeight: active ? 600 : 400,
              color: active ? COLORS.orange : COLORS.muted,
              letterSpacing: '0.03em',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
