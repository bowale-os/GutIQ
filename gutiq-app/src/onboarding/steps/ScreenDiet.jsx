import { STYLES } from '../../constants/styles';
import { DIETARY_PROTOCOLS } from '../constants';
import ProtocolRow from '../components/ProtocolRow';

export default function ScreenDiet({ dietaryProtocol, setDietaryProtocol, customProtocol, setCustomProtocol, slideAnim }) {
  return (
    <div style={{ animation: slideAnim }}>
      <p style={{ ...STYLES.label, marginBottom: 8 }}>One more thing.</p>
      <h1 style={{ ...STYLES.h1, fontSize: 'clamp(22px, 6vw, 28px)', marginBottom: 8 }}>
        Are you following any specific eating habits?
      </h1>
      <p style={{ ...STYLES.muted, marginBottom: 24 }}>
        This helps me eliminate false positives. I won't ever flag gluten as a trigger if you already avoid it.
      </p>
      {DIETARY_PROTOCOLS.map(p => (
        <ProtocolRow
          key={p.id} {...p}
          selected={dietaryProtocol === p.id}
          onClick={() => setDietaryProtocol(p.id)}
          customProtocol={customProtocol}
          onCustomChange={e => setCustomProtocol(e.target.value)}
        />
      ))}
    </div>
  );
}
