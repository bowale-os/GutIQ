import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/styles';
import { CONDITIONS } from './constants';

export function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function getInitialName(name, username) {
  if (name && name.trim()) return name.trim();
  if (!username) return '';
  return username.charAt(0).toUpperCase() + username.slice(1);
}

export function conditionLabel(id) {
  const found = CONDITIONS.find(c => c.id === id);
  return found ? found.label : id;
}

export const inputStyle = (focused) => ({
  width: '100%', boxSizing: 'border-box',
  padding: '13px 16px',
  border: `1.5px solid ${focused ? COLORS.orange : COLORS.border}`,
  borderRadius: 12, backgroundColor: COLORS.surface,
  fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text,
  outline: 'none', transition: 'border-color 0.15s ease',
});
