import { useState, useEffect } from 'react';
import { COLORS } from './constants/colors';
import { currentUser, mockLogs } from './constants/mockData';
import { isLoggedIn, getStoredUser, storeUser } from './api/client';
import { fetchRealLogs, apiLogToFrontend } from './api/logs';
import { getStatus } from './api/onboarding';
import { getUserData } from './api/user';

import NavBar      from './components/NavBar';
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
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { margin: 0; }
  button { transition: opacity 0.15s ease, transform 0.1s ease; }
  button:active { transform: scale(0.96) !important; opacity: 0.85; }
  input, textarea { box-sizing: border-box; }
  ::placeholder { color: #A8A29E; }
`;

const AUTH_SCREENS = ['dashboard', 'gutcheck', 'export', 'profile', 'lifestyles', 'pain_relief'];

export default function App() {
  const [currentScreen,  setCurrentScreen]  = useState(() => isLoggedIn() ? 'dashboard' : 'login');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [logModalOpen,   setLogModalOpen]   = useState(false);
  const [user,           setUser]           = useState(() => {
    if (isLoggedIn()) {
      const stored = getStoredUser();
      return stored.email ? { ...currentUser, ...stored } : currentUser;
    }
    return currentUser;
  });
  const [demoMode, setDemoMode] = useState(false);
  const [logs, setLogs] = useState([]);

  // On mount: fetch real name from backend and update state + localStorage.
  useEffect(() => {
    if (!isLoggedIn()) return;
    getUserData()
      .then(u => {
        if (u.name) {
          const stored = getStoredUser();
          storeUser(stored.email, stored.userId, u.name, stored.condition);
          setUser(prev => ({ ...prev, name: u.name }));
        }
      })
      .catch(() => {});
  }, []);

  // On refresh: re-check onboarding completion so a token-only isLoggedIn()
  // doesn't skip the onboarding gate when the user hasn't finished it yet.
  useEffect(() => {
    if (!isLoggedIn()) return;
    getStatus()
      .then(status => { if (!status.is_complete) navigate('onboarding'); })
      .catch(() => {}); // stay on dashboard if the check fails
  }, []);

  // Sync user state whenever we navigate, so storeUser() calls in Login/Signup/
  // Onboarding are reflected without a reload.
  useEffect(() => {
    if (isLoggedIn()) {
      const stored = getStoredUser();
      if (stored.email) setUser(u => ({ ...u, ...stored }));
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

  useEffect(() => {
    document.body.style.overflow = logModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [logModalOpen]);

  const openLog = () => setLogModalOpen(true);
  const closeLog = () => setLogModalOpen(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':      return <Login navigate={navigate} onDemo={() => { setDemoMode(true); navigate('dashboard'); }} onLogin={() => setDemoMode(false)} />;
      case 'signup':     return <Signup navigate={navigate} />;
      case 'onboarding': return <Onboarding step={onboardingStep} setStep={setOnboardingStep} navigate={navigate} />;
      case 'dashboard':  return <Dashboard user={user} logs={logs} navigate={navigate} openLog={openLog} />;
      case 'gutcheck':   return <GutCheck user={user} demoMode={demoMode} />;
      case 'export':     return <Export user={user} logs={logs} navigate={navigate} />;
      case 'profile':    return <Profile user={user} navigate={navigate} onUpdate={updated => setUser(u => ({ ...u, ...updated }))} />;
      case 'pain_relief': return <PainRelief navigate={navigate} logs={logs} demoMode={demoMode} />;
      default:            return <Login navigate={navigate} />;
    }
  };

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh' }}>
      <style>{GLOBAL_STYLES}</style>

      {AUTH_SCREENS.includes(currentScreen) && (
        <NavBar currentScreen={currentScreen} navigate={navigate} onLogClick={openLog} />
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
