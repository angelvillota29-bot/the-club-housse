import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { uploadImage } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';
import { card, input, label, row, listItem, smallBtn, heading } from '../adminStyles';

const EMPTY = { categoryId: '', name: '', desc: '', price: '' };

export default function Dishes() {
  const { state, save } = useData();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.categoryId) return;
    setSaving(true);
    const dishData = { categoryId: Number(form.categoryId), name: form.name.trim(), desc: form.desc.trim(), price: formatCurrency(form.price) };
    if (file) {
      const url = await uploadImage(file);
      if (url) dishData.imageUrl = url;
    } else if (removeImage) {
      dishData.imageUrl = '';
    }
    const dishes = editId ? state.dishes.map((d) => (d.id === editId ? { ...d, ...dishData } : d)) : [...state.dishes, { id: Date.now(), ...dishData }];
    await save({ dishes });
    setForm(EMPTY);
    setEditId(null);
    setFile(null);
    setRemoveImage(false);
    setSaving(false);
  };

  const edit = (dish) => {
    setForm({ categoryId: String(dish.categoryId), name: dish.name, desc: dish.desc || '', price: String(dish.price).replace(/\D/g, '') });
    setEditId(dish.id);
    setFile(null);
    setRemoveImage(false);
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar platillo?')) return;
    await save({
      dishes: state.dishes.filter((d) => d.id !== id),
      schedule: state.schedule.filter((s) => s.dishId !== id),
      singleMenuSchedule: state.singleMenuSchedule.filter((s) => s.dishId !== id),
    });
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>{editId ? 'Modificar platillo' : 'Crear platillo'}</h2>
        <form onSubmit={submit}>
          <div style={row}>
            <label style={{ ...label, flex: 1 }}>
              Categoría
              <select style={input} value={form.categoryId} onChange={set('categoryId')} required>
                <option value="">-- Seleccionar --</option>
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label style={{ ...label, flex: 1 }}>
              Precio
              <input style={input} value={form.price} onChange={set('price')} required placeholder="15000" />
            </label>
          </div>
          <label style={label}>
            Nombre
            <input style={input} value={form.name} onChange={set('name')} required />
          </label>
          <label style={label}>
            Descripción
            <input style={input} value={form.desc} onChange={set('desc')} />
          </label>
          <label style={label}>
            Imagen (opcional)
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
          <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} /> Quitar imagen actual
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-pill btn-orange" disabled={saving}>
              {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Guardar'}
            </button>
            {editId && (
              <button type="button" className="btn-pill btn-outline" onClick={() => { setForm(EMPTY); setEditId(null); setFile(null); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={card}>
        {state.dishes.length === 0 && <p style={{ color: '#8a7a6a' }}>Sin platillos.</p>}
        {state.dishes.map((dish) => {
          const catName = state.categories.find((c) => c.id === dish.categoryId)?.name || 'Sin categoría';
          return (
            <div key={dish.id} style={listItem}>
              <span>
                • <strong style={{ color: 'var(--brand-text-dark)' }}>{dish.name}</strong> ({catName}) - {dish.price}
              </span>
              <span>
                <button style={smallBtn} onClick={() => edit(dish)}>Editar</button>
                <button style={{ ...smallBtn, color: 'var(--brand-danger)' }} onClick={() => remove(dish.id)}>X</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
