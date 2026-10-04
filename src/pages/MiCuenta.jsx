import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMisPedidos, eliminarCuenta } from '../lib/api';
import { formatCurrency } from '../lib/format';

export default function MiCuenta() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMisPedidos()
      .then((r) => setData(r.success ? r : { pedidos: [], favoritos: [] }))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (
      !confirm(
        'Esto elimina tu cuenta: se borran tu nombre, dirección y teléfono de tu historial de pedidos, y pierdes el acceso con este correo. Si tienes un pedido en camino ahora mismo, complétalo primero. ¿Continuar?',
      )
    )
      return;
    setDeleting(true);
    const r = await eliminarCuenta();
    setDeleting(false);
    if (r.success) {
      alert('Tu cuenta fue eliminada.');
      await logout();
      navigate('/');
    } else {
      alert('No se pudo eliminar tu cuenta: ' + (r.error || 'error desconocido'));
    }
  };

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--brand-text-dark)', margin: 0 }}>
        Mi cuenta
      </h1>
      <p style={{ fontSize: 13, color: '#a68f78', marginTop: 4 }}>{user}</p>

      {loading && <p style={{ color: '#8a7a6a' }}>Cargando…</p>}

      {!loading && data && (
        <>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginTop: 28 }}>Tus favoritos</h2>
          {data.favoritos.length === 0 && (
            <p style={{ color: '#8a7a6a', fontSize: 13 }}>Todavía no tienes pedidos hechos con esta cuenta.</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {data.favoritos.map((f) => (
              <div key={f.dishId} className="dish-card" style={{ padding: '10px 14px', flex: '0 0 auto' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--brand-text-dark)' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 11, color: '#a68f78' }}>
                  Pedido {f.veces} {f.veces === 1 ? 'vez' : 'veces'}
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginTop: 28 }}>Tus pedidos</h2>
          {data.pedidos.length === 0 && <p style={{ color: '#8a7a6a', fontSize: 13 }}>Sin pedidos todavía.</p>}
          {data.pedidos.map((p) => (
            <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px dashed #eadfce' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <strong style={{ color: 'var(--brand-text-dark)' }}>#{p.id}</strong>
                <span style={{ color: 'var(--brand-orange)' }}>{formatCurrency(p.total)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#8a7a6a', marginTop: 2 }}>
                {p.items?.map((it, i) => (
                  <span key={i}>
                    {it.cantidad} x {it.name}{it.adiciones?.length ? ` (${it.adiciones.map((a) => `+ ${a.name}`).join(' ')})` : ''}
                    {i < p.items.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        <button className="btn-pill btn-dark" onClick={logout}>
          Cerrar sesión
        </button>
        <button
          className="btn-pill"
          style={{ background: 'transparent', border: '2px solid var(--brand-danger)', color: 'var(--brand-danger)' }}
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Eliminando…' : 'Eliminar mi cuenta'}
        </button>
      </div>
    </div>
  );
}
