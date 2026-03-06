import { useState, useEffect } from 'react';
import { COLORS } from './constants/colors';
import { currentUser, mockLogs } from './constants/mockData';

import NavBar     from './components/NavBar';
import Login      from './screens/Login';
import Signup     from './screens/Signup';
import Onboarding from './screens/Onboarding';
import Dashboard  from './screens/Dashboard';
import GutCheck  from './screens/GutCheck';
import LogEntry   from './screens/LogEntry';
import Export     from './screens/Export';
import Profile    from './screens/Profile';

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
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { margin: 0; }
  button { transition: opacity 0.15s ease, transform 0.1s ease; }
  button:active { transform: scale(0.96) !important; opacity: 0.85; }
  input, textarea { box-sizing: border-box; }
  ::placeholder { color: #A8A29E; }
`;

const AUTH_SCREENS = ['dashboard', 'gutcheck', 'export', 'profile'];

export default function App() {
  const [currentScreen,  setCurrentScreen]  = useState('login');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [logModalOpen,   setLogModalOpen]   = useState(false);
  const [user,           setUser]           = useState(currentUser);

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
      case 'login':      return <Login navigate={navigate} />;
      case 'signup':     return <Signup navigate={navigate} />;
      case 'onboarding': return <Onboarding step={onboardingStep} setStep={setOnboardingStep} navigate={navigate} />;
      case 'dashboard':  return <Dashboard user={user} logs={mockLogs} navigate={navigate} openLog={openLog} />;
      case 'gutcheck':   return <GutCheck />;
      case 'export':     return <Export user={user} logs={mockLogs} navigate={navigate} />;
      case 'profile':    return <Profile user={user} navigate={navigate} onUpdate={updated => setUser(u => ({ ...u, ...updated }))} />;
      default:           return <Login navigate={navigate} />;
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
        <LogEntry onClose={closeLog} userStreak={user.streak} />
      )}
    </div>
  );
}
