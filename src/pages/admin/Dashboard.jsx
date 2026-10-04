import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Categories from './sections/Categories';
import Dishes from './sections/Dishes';
import Schedule from './sections/Schedule';
import Availability from './sections/Availability';
import Customize from './sections/Customize';
import Orders from './sections/Orders';
import Users from './sections/Users';
import N8n from './sections/N8n';
import Envio from './sections/Envio';

const TABS = [
  { key: 'categories', label: 'Categorías' },
  { key: 'availability', label: 'Disponibilidad' },
  { key: 'customize', label: 'Personalizar' },
  { key: 'dishes', label: 'Platillos' },
  { key: 'schedule', label: 'Horario y Stock' },
  { key: 'envio', label: 'Domicilio', superOnly: true },
  { key: 'orders', label: 'Pedidos', superOnly: true },
  { key: 'n8n', label: 'Conexión N8N', superOnly: true },
  { key: 'users', label: 'Usuarios', superOnly: true },
];

export default function AdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState(null);
  const visibleTabs = TABS.filter((t) => !t.superOnly || isSuperAdmin);

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`chip-tab ${tab === t.key ? 'active' : ''}`} style={{ flex: '0 0 auto' }}>
            {t.label}
          </button>
        ))}
      </div>

      {!tab && (
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--brand-text-dark)' }}>¡Bienvenido!</h1>
          <p style={{ color: '#6b5a4d' }}>Selecciona una opción arriba.</p>
        </div>
      )}

      {tab === 'categories' && <Categories />}
      {tab === 'dishes' && <Dishes />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'availability' && <Availability />}
      {tab === 'customize' && <Customize />}
      {tab === 'envio' && <Envio />}
      {tab === 'orders' && <Orders />}
      {tab === 'users' && <Users />}
      {tab === 'n8n' && <N8n />}
    </div>
  );
}
