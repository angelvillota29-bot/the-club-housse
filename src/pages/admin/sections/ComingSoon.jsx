import { card, heading } from '../adminStyles';

export default function ComingSoon({ title }) {
  return (
    <div style={card}>
      <h2 style={heading}>{title}</h2>
      <p style={{ color: '#8a7a6a', fontSize: 13 }}>Esta sección todavía no se migró a la nueva versión.</p>
    </div>
  );
}
