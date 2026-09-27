import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { fechaHoyBogota } from '../../../lib/format';
import { card, input, label, row, listItem, smallBtn, heading } from '../adminStyles';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Schedule() {
  const { state, save } = useData();
  const [assignDish, setAssignDish] = useState('');
  const [assignDay, setAssignDay] = useState('Lunes');
  const [assignDishUnico, setAssignDishUnico] = useState('');

  const dishName = (id) => state.dishes.find((d) => d.id === id)?.name || '?';

  const assignWeekly = async (e) => {
    e.preventDefault();
    const dishId = Number(assignDish);
    if (!dishId || state.schedule.some((s) => s.day === assignDay && s.dishId === dishId)) return;
    await save({ schedule: [...state.schedule, { id: Date.now(), day: assignDay, dishId, available: true, stock: null }] });
  };

  const assignUnico = async (e) => {
    e.preventDefault();
    const dishId = Number(assignDishUnico);
    if (!dishId || state.singleMenuSchedule.some((s) => s.dishId === dishId)) return;
    await save({ singleMenuSchedule: [...state.singleMenuSchedule, { id: Date.now(), dishId, available: true, stock: null, stockDefinido: null, stockResetDate: fechaHoyBogota() }] });
  };

  const updateRow = async (listKey, id, patch) => {
    await save({ [listKey]: state[listKey].map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };
  const removeRow = async (listKey, id) => {
    await save({ [listKey]: state[listKey].filter((s) => s.id !== id) });
  };
  const setMenuMode = async (mode) => save({ menuMode: mode });
  const setTakeout = async (patch) => save({ takeoutConfig: { ...state.takeoutConfig, ...patch } });

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Modo de menú</h2>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={state.menuMode === 'semanal'} onChange={() => setMenuMode('semanal')} /> Menú de la semana
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={state.menuMode === 'unico'} onChange={() => setMenuMode('unico')} /> Menú único
          </label>
        </div>
      </div>

      {state.menuMode === 'semanal' ? (
        <div style={card}>
          <h2 style={heading}>Asignar al horario</h2>
          <form onSubmit={assignWeekly} style={row}>
            <select style={{ ...input, flex: 1 }} value={assignDish} onChange={(e) => setAssignDish(e.target.value)}>
              <option value="">-- Platillo --</option>
              {state.dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select style={{ ...input, flex: 1 }} value={assignDay} onChange={(e) => setAssignDay(e.target.value)}>
              {DIAS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button type="submit" className="btn-pill btn-orange">Agregar</button>
          </form>

          <div style={{ marginTop: 16 }}>
            {DIAS.map((day) => {
              const rows = state.schedule.filter((s) => s.day === day);
              if (rows.length === 0) return null;
              return (
                <div key={day} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--brand-orange)' }}>{day}</div>
                  {rows.map((s) => (
                    <ScheduleRow key={s.id} item={s} name={dishName(s.dishId)} onUpdate={(p) => updateRow('schedule', s.id, p)} onRemove={() => removeRow('schedule', s.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={card}>
          <h2 style={heading}>Platillos del menú único</h2>
          <form onSubmit={assignUnico} style={row}>
            <select style={{ ...input, flex: 1 }} value={assignDishUnico} onChange={(e) => setAssignDishUnico(e.target.value)}>
              <option value="">-- Platillo --</option>
              {state.dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="btn-pill btn-orange">Agregar</button>
          </form>
          <div style={{ marginTop: 16 }}>
            {state.singleMenuSchedule.map((s) => (
              <ScheduleRow key={s.id} item={s} name={dishName(s.dishId)} onUpdate={(p) => updateRow('singleMenuSchedule', s.id, p)} onRemove={() => removeRow('singleMenuSchedule', s.id)} />
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <h2 style={heading}>Cargos de entrega</h2>
        <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!state.takeoutConfig.enabled} onChange={(e) => setTakeout({ enabled: e.target.checked })} /> Habilitar cargos de empaque/domicilio
        </label>
        <div style={row}>
          <label style={{ ...label, flex: 1 }}>
            Empaque (por platillo)
            <input style={input} value={state.takeoutConfig.fee || ''} onChange={(e) => setTakeout({ fee: Number(e.target.value) || 0 })} />
          </label>
          <label style={{ ...label, flex: 1 }}>
            Domicilio (una vez por pedido)
            <input style={input} value={state.takeoutConfig.domicilioFee || ''} onChange={(e) => setTakeout({ domicilioFee: Number(e.target.value) || 0 })} />
          </label>
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({ item, name, onUpdate, onRemove }) {
  return (
    <div style={{ ...listItem, alignItems: 'center' }}>
      <span style={{ color: item.available ? '#2f6b2f' : 'var(--brand-danger)' }}>{name}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={smallBtn} onClick={() => onUpdate({ available: !item.available })}>{item.available ? 'Disponible' : 'Agotado'}</button>
        <span style={{ fontSize: 12 }}>Stock:</span>
        <input
          type="number"
          min="0"
          defaultValue={item.stock ?? ''}
          onBlur={(e) => {
            const v = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0);
            onUpdate({ stock: v, stockDefinido: v, stockResetDate: fechaHoyBogota() });
          }}
          style={{ ...input, width: 64, padding: '3px 6px' }}
        />
        <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={onRemove}>X</button>
      </span>
    </div>
  );
}
