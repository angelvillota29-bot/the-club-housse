import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { card, input, heading, listItem, smallBtn } from '../adminStyles';

export default function Salsas() {
  const { state, save } = useData();
  const opciones = state.salsasConfig.opciones;
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState('');

  const guardar = (lista) => save({ salsasConfig: { opciones: lista } });

  const agregar = async (e) => {
    e.preventDefault();
    const nombre = nueva.trim();
    if (!nombre) return;
    if (opciones.some((o) => o.toLowerCase() === nombre.toLowerCase())) {
      setError('Esa salsa ya está en la lista.');
      return;
    }
    setError('');
    await guardar([...opciones, nombre]);
    setNueva('');
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Salsas para elegir</h2>
        <p style={{ fontSize: 13, color: '#6b5a4d' }}>
          Son las salsas que el cliente puede elegir (sin costo) en las salchipapas, al revisar su pedido. La cocina las ve en el ticket. Las hamburguesas, perros y colitas llevan sus salsas de la casa y no piden elegir.
        </p>
        <p style={{ fontSize: 12, color: '#8a7a6a' }}>
          Para cambiar qué categorías piden salsas, ve a <strong>Categorías</strong> y marca "Sus productos piden salsas".
        </p>
        <form onSubmit={agregar} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <input style={{ ...input, flex: 1, minWidth: 200 }} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Ej. BBQ" maxLength={40} />
          <button type="submit" className="btn-pill btn-orange">Agregar salsa</button>
        </form>
        {error && <p style={{ color: 'var(--brand-danger)', fontSize: 13, marginTop: 0 }}>{error}</p>}
        {opciones.length === 0 && <p style={{ color: '#8a7a6a', fontSize: 13 }}>No hay salsas. Los clientes no podrán elegir.</p>}
        {opciones.map((o) => (
          <div key={o} style={listItem}>
            <span>• <strong style={{ color: 'var(--brand-text-dark)' }}>{o}</strong></span>
            <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => guardar(opciones.filter((x) => x !== o))}>Quitar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
