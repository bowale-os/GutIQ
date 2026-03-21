import { useState, useEffect } from 'react';
import { COLORS } from './constants/colors';
import { FONTS } from './constants/styles';
import { currentUser, mockLogs } from './constants/mockData';
import { isLoggedIn, getStoredUser, storeUser } from './api/client';
import { fetchRealLogs, apiLogToFrontend } from './api/logs';
import { getStatus } from './api/onboarding';
import { getUserData } from './api/user';

import NavBar      from './components/NavBar';
import Landing     from './screens/Landing';
import Login       from './screens/Login';
import Signup      from './screens/Signup';
import Onboarding  from './screens/Onboarding';
import Dashboard   from './screens/Dashboard';
import GutCheck    from './screens/GutCheck';
import LogEntry    from './screens/LogEntry';
import Export      from './screens/Export';
import Profile     from './screens/Profile';
import PainRelief  from './screens/PainRelief';

const GLOBAL_STYLES = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes sonarPulse {
    0%   { transform: scale(1);   opacity: 0.55; }
    100% { transform: scale(2.6); opacity: 0; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes greenPop {
    0%   { transform: scale(0.5); opacity: 0; }
    70%  { transform: scale(1.15); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  @keyframes barGrow {
    from { transform: scaleY(0); }
    to   { transform: scaleY(1); }
  }
  @keyframes breatheExpand {
    0%, 100% { transform: scale(1);    opacity: 0.55; }
    50%       { transform: scale(1.18); opacity: 0.9;  }
  }
  @keyframes breatheSlow {
    0%, 100% { transform: scale(1);    opacity: 0.25; }
    50%       { transform: scale(1.28); opacity: 0.5;  }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(32px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-32px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { margin: 0; }
  button { transition: opacity 0.15s ease, transform 0.1s ease; }
  button:active { transform: scale(0.96) !important; opacity: 0.85; }
  input, textarea { box-sizing: border-box; }
  ::placeholder { color: #A8A29E; }
`;

const AUTH_SCREENS = ['dashboard', 'gutcheck', 'export', 'profile', 'lifestyles', 'pain_relief'];

// ── Non-intrusive demo banner ──────────────────────────────────────────────────
function DemoBanner({ navigate, onExit }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 72, // sits just above the NavBar
      left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      zIndex: 99,
      padding: '0 12px',
      pointerEvents: 'none', // let clicks fall through to app
    }}>
      <div style={{
        backgroundColor: COLORS.darkBg,
        border: `1px solid rgba(255,255,255,0.10)`,
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        pointerEvents: 'auto',
        animation: 'fadeSlideUp 0.35s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: COLORS.orange,
            animation: 'pulse 2s ease infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: FONTS.mono, fontSize: 11,
            color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em',
          }}>
            You're in demo mode. Nothing is saved.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('signup')}
            style={{
              backgroundColor: COLORS.orange, color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer',
              fontFamily: FONTS.sans, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Create account
          </button>
          <button
            onClick={onExit}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', fontSize: 18, lineHeight: 1,
              padding: '2px 4px',
            }}
            title="Exit demo"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentScreen,  setCurrentScreen]  = useState(() => isLoggedIn() ? 'dashboard' : 'landing');
  const [logModalOpen,   setLogModalOpen]   = useState(false);
  const [user,           setUser]           = useState(() => {
    if (isLoggedIn()) {
      const stored = getStoredUser();
      return stored.username ? { ...currentUser, ...stored } : currentUser;
    }
    return currentUser;
  });
  const [demoMode,       setDemoMode]       = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [logs,           setLogs]           = useState([]);

  // On mount: fetch real name from backend and update state + localStorage.
  useEffect(() => {
    if (!isLoggedIn()) return;
    getUserData()
      .then(u => {
        if (u.name || u.username) {
          const stored = getStoredUser();
          storeUser(u.username || stored.username, stored.userId, u.name, stored.condition, u.email || '');
          setUser(prev => ({ ...prev, name: u.name, username: u.username }));
        }
      })
      .catch(() => {});
  }, []);

  // On refresh: re-check onboarding completion.
  useEffect(() => {
    if (!isLoggedIn()) return;
    getStatus()
      .then(status => { if (!status.is_complete) navigate('onboarding'); })
      .catch(() => {});
  }, []);

  // Sync user state on navigation.
  useEffect(() => {
    if (isLoggedIn()) {
      const stored = getStoredUser();
      if (stored.username) setUser(u => ({ ...u, ...stored }));
    }
  }, [currentScreen]);

  const LOG_SCREENS = new Set(['dashboard', 'export', 'pain_relief']);
  useEffect(() => {
    if (!LOG_SCREENS.has(currentScreen)) return;
    if (demoMode) { setLogs(mockLogs); return; }
    if (!isLoggedIn()) return;
    let stale = false;
    fetchRealLogs().then(data => { if (!stale) setLogs(data); });
    return () => { stale = true; };
  }, [currentScreen, demoMode]);

  const navigate = (screen) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const startDemo = () => {
    setDemoMode(true);
    setBannerDismissed(false);
    navigate('onboarding');
  };

  const exitDemo = () => {
    setDemoMode(false);
    navigate('landing');
  };

  useEffect(() => {
    document.body.style.overflow = logModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [logModalOpen]);

  const openLog = () => setLogModalOpen(true);
  const closeLog = () => setLogModalOpen(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':     return <Landing navigate={navigate} onDemo={startDemo} />;
      case 'login':       return <Login navigate={navigate} onLogin={() => setDemoMode(false)} />;
      case 'signup':      return <Signup navigate={navigate} />;
      case 'onboarding':  return <Onboarding navigate={navigate} demoMode={demoMode} />;
      case 'dashboard':   return <Dashboard user={user} logs={logs} navigate={navigate} openLog={openLog} />;
      case 'gutcheck':    return <GutCheck user={user} demoMode={demoMode} />;
      case 'export':      return <Export user={user} logs={logs} navigate={navigate} />;
      case 'profile':     return <Profile user={user} navigate={navigate} onUpdate={updated => setUser(u => ({ ...u, ...updated }))} />;
      case 'pain_relief': return <PainRelief navigate={navigate} logs={logs} demoMode={demoMode} />;
      default:            return <Landing navigate={navigate} onDemo={startDemo} />;
    }
  };

  const showNav    = AUTH_SCREENS.includes(currentScreen);
  const showBanner = demoMode && showNav && !bannerDismissed;

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh' }}>
      <style>{GLOBAL_STYLES}</style>

      {showNav && (
        <NavBar currentScreen={currentScreen} navigate={navigate} onLogClick={openLog} demoMode={demoMode} onExitDemo={exitDemo} />
      )}

      {showBanner && (
        <DemoBanner navigate={navigate} onExit={() => setBannerDismissed(true)} />
      )}

      <div key={currentScreen} style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
        {renderScreen()}
      </div>

      {logModalOpen && (
        <LogEntry
          onClose={closeLog}
          onSave={newLog => setLogs(prev => [apiLogToFrontend(newLog), ...prev])}
          demoMode={demoMode}
        />
      )}
    </div>
  );
}
