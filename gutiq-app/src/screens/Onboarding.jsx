import { useState } from 'react';
import { STYLES } from '../constants/styles';
import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/styles';
import { complete } from '../api/onboarding';
import { storeUser, getStoredUser } from '../api/client';
import { getInitialName, conditionLabel } from '../onboarding/helpers';

import BackButton      from '../onboarding/components/BackButton';
import DotIndicator    from '../onboarding/components/DotIndicator';
import ScreenName      from '../onboarding/steps/ScreenName';
import ScreenCondition from '../onboarding/steps/ScreenCondition';
import ScreenMedications from '../onboarding/steps/ScreenMedications';
import ScreenDiet      from '../onboarding/steps/ScreenDiet';
import ScreenAgeReminder from '../onboarding/steps/ScreenAgeReminder';

// ── Main orchestrator ─────────────────────────────────────────────────────────
// Diagnosed path:   0(name) → 1(condition) → 2(meds) → 3(diet) → 4(age+reminder)
// Undiagnosed path: 0(name) → 1(condition) → 4(age+reminder)

export default function Onboarding({ navigate, demoMode = false }) {
  const { username, name: storedName, userId, email } = getStoredUser();

  const [screen,      setScreen]      = useState(0);
  const [direction,   setDirection]   = useState('forward');
  const [isDiagnosed, setIsDiagnosed] = useState(null);

  // Screen 0 — name
  const [displayName, setDisplayName] = useState(() => getInitialName(storedName, username));

  // Screen 1 — condition
  const [condition,      setCondition]      = useState(null);
  const [conditionQuery, setConditionQuery] = useState('');

  // Screen 2 — medications
  const [medications, setMedications] = useState([]);

  // Screen 3 — dietary protocol
  const [dietaryProtocol, setDietaryProtocol] = useState('none');
  const [customProtocol,  setCustomProtocol]  = useState('');

  // Screen 4 — age + reminder
  const [ageRange,        setAgeRange]        = useState(null);
  const [timeHours,       setTimeHours]       = useState('');
  const [timeMins,        setTimeMins]        = useState('');
  const [timeAmPm,        setTimeAmPm]        = useState('AM');
  const [reminderChannel, setReminderChannel] = useState(null);

  // Submit state
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasEmail       = demoMode ? true : !!email;
  const finalCondition = condition === 'custom'
    ? conditionQuery.trim()
    : condition === 'undiagnosed'
      ? 'undiagnosed'
      : conditionLabel(condition);
  const _h12 = parseInt(timeHours, 10);
  const _m   = parseInt(timeMins,  10);
  const _validH = timeHours.length >= 1 && !isNaN(_h12) && _h12 >= 1 && _h12 <= 12;
  const _validM = timeMins.length  === 2 && !isNaN(_m)  && _m  >= 0 && _m  <= 59;
  let _h24 = null;
  if (_validH) {
    if (timeAmPm === 'PM' && _h12 !== 12) _h24 = _h12 + 12;
    else if (timeAmPm === 'AM' && _h12 === 12) _h24 = 0;
    else _h24 = _h12;
  }
  const reminderTime = (_validH && _validM && _h24 !== null)
    ? `${String(_h24).padStart(2, '0')}:${String(_m).padStart(2, '0')}`
    : null;

  const dotTotal   = isDiagnosed === false ? 3 : 5;
  const dotCurrent = isDiagnosed === false ? [0, 1, 4].indexOf(screen) : screen;

  const slideAnim = direction === 'back'
    ? 'slideInLeft 0.28s ease both'
    : 'slideInRight 0.28s ease both';

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goTo = (s, dir = 'forward') => { setDirection(dir); setScreen(s); };

  const goBack = () => {
    if (screen === 0) return;
    if (screen === 2) { goTo(1, 'back'); return; }
    if (screen === 3) { goTo(2, 'back'); return; }
    if (screen === 4) { goTo(isDiagnosed ? 3 : 1, 'back'); return; }
    goTo(screen - 1, 'back');
  };

  const handleConditionSelect = (id, customText = null) => {
    setCondition(id);
    const diagnosed = id !== 'undiagnosed';
    setIsDiagnosed(diagnosed);
    if (customText) setConditionQuery(customText);
    setTimeout(() => goTo(diagnosed ? 2 : 4, 'forward'), 180);
  };

  // ── Medications ────────────────────────────────────────────────────────────
  const addMed    = (name) => {
    const clean = name.trim();
    if (!clean || medications.includes(clean)) return;
    setMedications(prev => [...prev, clean]);
  };
  const removeMed = (name) => setMedications(prev => prev.filter(m => m !== name));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const canProceed = () => {
    if (screen === 0) return displayName.trim().length > 0;
    if (screen === 3) return dietaryProtocol !== 'other' || customProtocol.trim().length > 0;
    return true;
  };

  const handleNext = async () => {
    if (screen === 0) { goTo(1); return; }
    if (screen === 2) { goTo(3); return; }
    if (screen === 3) { goTo(4); return; }

    // Screen 4 — final submit
    if (reminderChannel === 'push' && !demoMode) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
    }

    if (demoMode) { navigate('gutcheck'); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const medsString = medications.length > 0 ? medications.join(', ') : null;
      const finalDiet  = dietaryProtocol === 'other'
        ? (customProtocol.trim() || null)
        : dietaryProtocol === 'none' ? null : dietaryProtocol;
      const goal = finalCondition === 'undiagnosed'
        ? 'Find patterns in my symptoms'
        : `Identify and manage ${finalCondition} triggers`;
      const nameToSave = displayName.trim() || username;

      await complete(finalCondition, goal, ageRange, reminderTime, reminderChannel, nameToSave, medsString, finalDiet);
      storeUser(username, userId, nameToSave, finalCondition);
      navigate('gutcheck');
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...STYLES.page }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'clamp(24px, 6vh, 44px) 20px 100px' }}>

        <BackButton onClick={screen === 0 ? () => navigate('landing') : goBack} />
        <DotIndicator current={Math.max(dotCurrent, 0)} total={dotTotal} />

        {screen === 0 && (
          <ScreenName
            demoMode={demoMode}
            displayName={displayName}
            setDisplayName={setDisplayName}
            onNext={handleNext}
            slideAnim={slideAnim}
          />
        )}

        {screen === 1 && (
          <ScreenCondition
            displayName={displayName}
            conditionQuery={conditionQuery}
            setConditionQuery={setConditionQuery}
            onSelect={handleConditionSelect}
            slideAnim={slideAnim}
          />
        )}

        {screen === 2 && (
          <ScreenMedications
            finalCondition={finalCondition}
            medications={medications}
            addMed={addMed}
            removeMed={removeMed}
            slideAnim={slideAnim}
          />
        )}

        {screen === 3 && (
          <ScreenDiet
            dietaryProtocol={dietaryProtocol}
            setDietaryProtocol={setDietaryProtocol}
            customProtocol={customProtocol}
            setCustomProtocol={setCustomProtocol}
            slideAnim={slideAnim}
          />
        )}

        {screen === 4 && (
          <ScreenAgeReminder
            isDiagnosed={isDiagnosed}
            ageRange={ageRange}
            setAgeRange={setAgeRange}
            timeHours={timeHours}
            setTimeHours={setTimeHours}
            timeMins={timeMins}
            setTimeMins={setTimeMins}
            timeAmPm={timeAmPm}
            setTimeAmPm={setTimeAmPm}
            reminderTime={reminderTime}
            reminderChannel={reminderChannel}
            setReminderChannel={setReminderChannel}
            hasEmail={hasEmail}
            slideAnim={slideAnim}
          />
        )}

        {saveError && (
          <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: '#e53e3e', marginTop: 16, textAlign: 'center' }}>
            {saveError}
          </p>
        )}

        {/* Hidden on condition screen — rows auto-advance */}
        {screen !== 1 && (
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            style={{ ...STYLES.btnPrimary, marginTop: 24, opacity: canProceed() && !saving ? 1 : 0.35 }}
          >
            {saving ? 'Saving...' : screen === 4 ? 'Start logging' : 'Continue'}
          </button>
        )}

        {/* Skip medications */}
        {screen === 2 && medications.length === 0 && (
          <button
            onClick={handleNext}
            style={{ ...STYLES.btnGhost, marginTop: 8, color: COLORS.muted, fontSize: 14 }}
          >
            Not on anything yet
          </button>
        )}

      </div>
    </div>
  );
}
