import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { card, input, label, listItem, smallBtn, heading } from '../adminStyles';
import { categoryKind } from '../../../lib/menu';

const EMPTY = { name: '', deliveryEnabled: true, exentoEmpaque: false, agrupada: false, personalizable: false, esAdicion: false, esBebida: false };

export default function Categories() {
  const { state, save } = useData();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const categories = editId
      ? state.categories.map((c) => (c.id === editId ? { ...c, ...form } : c))
      : [...state.categories, { id: Date.now(), ...form }];
    await save({ categories });
    setForm(EMPTY);
    setEditId(null);
  };

  const edit = (cat) => {
    setForm({ name: cat.name, deliveryEnabled: cat.deliveryEnabled !== false, exentoEmpaque: !!cat.exentoEmpaque, ...categoryKind(cat) });
    setEditId(cat.id);
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar categoría?')) return;
    await save({ categories: state.categories.filter((c) => c.id !== id) });
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>{editId ? 'Editar categoría' : 'Crear nueva categoría'}</h2>
        <form onSubmit={submit}>
          <label style={label}>
            Nombre
            <input style={input} value={form.name} onChange={set('name')} required />
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.deliveryEnabled} onChange={set('deliveryEnabled')} /> Disponible a domicilio
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.exentoEmpaque} onChange={set('exentoEmpaque')} /> Exenta de cargo de empaque
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.agrupada} onChange={set('agrupada')} /> Mostrar sus productos en una sola tarjeta con una sola foto (variantes)
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.personalizable} onChange={set('personalizable')} /> Sus productos se pueden pedir con adicionales
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.esAdicion} onChange={set('esAdicion')} /> Esta categoría es la lista de adicionales
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.esBebida} onChange={set('esBebida')} /> Son bebidas (se ofrecen al confirmar el pedido)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-pill btn-orange">
              {editId ? 'Actualizar' : 'Agregar'}
            </button>
            {editId && (
              <button type="button" className="btn-pill btn-outline" onClick={() => { setForm(EMPTY); setEditId(null); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={card}>
        {state.categories.length === 0 && <p style={{ color: '#8a7a6a' }}>Sin categorías.</p>}
        {state.categories.map((cat) => (
          <div key={cat.id} style={listItem}>
            <span>
              • <strong style={{ color: 'var(--brand-text-dark)' }}>{cat.name}</strong>
              {cat.exentoEmpaque ? ' · exenta de empaque' : ''}
            </span>
            <span>
              <button style={smallBtn} onClick={() => edit(cat)}>Editar</button>
              <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => remove(cat.id)}>X</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
