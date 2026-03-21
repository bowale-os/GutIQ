import { useState } from 'react';
import { STYLES } from '../../constants/styles';
import { inputStyle } from '../helpers';

export default function ScreenName({ demoMode, displayName, setDisplayName, onNext, slideAnim }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ animation: slideAnim }}>
      <p style={{ ...STYLES.label, marginBottom: 8 }}>
        {demoMode ? 'Demo mode · ' : ''}Hi, I'm Tiwa.
      </p>
      <h1 style={{ ...STYLES.h1, fontSize: 'clamp(22px, 6vw, 28px)', marginBottom: 8 }}>
        What should I call you?
      </h1>
      <p style={{ ...STYLES.muted, marginBottom: 28 }}>
        This is how I'll address you throughout the app.
      </p>
      <input
        autoFocus
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => e.key === 'Enter' && displayName.trim() && onNext()}
        placeholder="Your first name or nickname"
        style={inputStyle(focused)}
      />
    </div>
  );
}
