import { useData } from '../../../context/DataContext';
import { card, input, label, row, heading } from '../adminStyles';

export default function Availability() {
  const { state, save } = useData();
  const open = state.businessOpenConfig;
  const zone = state.deliveryZoneConfig;

  const setOpen = (patch) => save({ businessOpenConfig: { ...open, ...patch } });
  const setHorario = (patch) => save({ businessOpenConfig: { ...open, horario: { ...open.horario, ...patch } } });
  const setZone = (patch) => save({ deliveryZoneConfig: { ...zone, ...patch } });

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Abierto / Cerrado</h2>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={open.mode === 'manual'} onChange={() => setOpen({ mode: 'manual' })} /> Manual
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={open.mode === 'horario'} onChange={() => setOpen({ mode: 'horario' })} /> Por horario
          </label>
        </div>
        {open.mode === 'manual' ? (
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!open.abiertoManual} onChange={(e) => setOpen({ abiertoManual: e.target.checked })} /> Abierto ahora
          </label>
        ) : (
          <div style={row}>
            <label style={{ ...label, flex: 1 }}>
              Inicio
              <input type="time" style={input} value={open.horario?.start || ''} onChange={(e) => setHorario({ start: e.target.value })} />
            </label>
            <label style={{ ...label, flex: 1 }}>
              Fin
              <input type="time" style={input} value={open.horario?.end || ''} onChange={(e) => setHorario({ end: e.target.value })} />
            </label>
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={heading}>Restricción de zona para domicilio (opcional)</h2>
        <p style={{ fontSize: 12, color: '#8a7a6a' }}>Este dato nunca se muestra ni se aplica en la página pública — solo viaja protegido en la API para que n8n decida si el domicilio aplica.</p>
        <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!zone.enabled} onChange={(e) => setZone({ enabled: e.target.checked })} /> Habilitar restricción de zona
        </label>
        <label style={label}>
          Dirección del local
          <input style={input} value={zone.address || ''} onChange={(e) => setZone({ address: e.target.value })} />
        </label>
        <div style={row}>
          <label style={{ ...label, flex: 1 }}>Carrera desde<input style={input} value={zone.carreraFrom || ''} onChange={(e) => setZone({ carreraFrom: e.target.value })} /></label>
          <label style={{ ...label, flex: 1 }}>Carrera hasta<input style={input} value={zone.carreraTo || ''} onChange={(e) => setZone({ carreraTo: e.target.value })} /></label>
        </div>
        <div style={row}>
          <label style={{ ...label, flex: 1 }}>Calle desde<input style={input} value={zone.calleFrom || ''} onChange={(e) => setZone({ calleFrom: e.target.value })} /></label>
          <label style={{ ...label, flex: 1 }}>Calle hasta<input style={input} value={zone.calleTo || ''} onChange={(e) => setZone({ calleTo: e.target.value })} /></label>
        </div>
      </div>
    </div>
  );
}
