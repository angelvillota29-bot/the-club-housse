import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { uploadImage } from '../../../lib/api';
import { card, input, label, row, heading } from '../adminStyles';

export default function Customize() {
  const { state, save } = useData();
  const branding = state.brandingConfig || {};
  const [logoFile, setLogoFile] = useState(null);
  const [savingLogo, setSavingLogo] = useState(false);

  const patch = async (fields) => save({ brandingConfig: { ...state.brandingConfig, ...fields } });

  const saveIdentity = async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    let logoUrl = branding.logoUrl;
    if (logoFile) {
      setSavingLogo(true);
      const url = await uploadImage(logoFile);
      if (url) logoUrl = url;
      setSavingLogo(false);
    }
    await patch({ name, logoUrl });
    setLogoFile(null);
  };

  const saveWhatsapp = async (e) => {
    e.preventDefault();
    await patch({ whatsappNumber: e.target.number.value.trim(), whatsappMessage: e.target.message.value.trim() });
  };

  const saveSocial = async (e) => {
    e.preventDefault();
    await patch({ telegramUrl: e.target.telegram.value.trim(), xUrl: e.target.x.value.trim(), instagramUrl: e.target.instagram.value.trim() });
  };

  return (
    <div>
      <div style={card}>
        <h2 style={heading}>Identidad y Logo</h2>
        <form onSubmit={saveIdentity}>
          <label style={label}>
            Nombre
            <input name="name" style={input} defaultValue={branding.name || ''} required />
          </label>
          <label style={label}>
            Logo
            {branding.logoUrl && <img src={branding.logoUrl} alt="Logo actual" style={{ height: 40, margin: '4px 0' }} />}
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0] || null)} />
          </label>
          <button type="submit" className="btn-pill btn-orange" disabled={savingLogo}>
            {savingLogo ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>

      <div style={card}>
        <h2 style={heading}>Contacto WhatsApp</h2>
        <form onSubmit={saveWhatsapp}>
          <div style={row}>
            <label style={{ ...label, flex: 1 }}>
              Número
              <input name="number" style={input} defaultValue={branding.whatsappNumber || ''} placeholder="573187628155" />
            </label>
            <label style={{ ...label, flex: 1 }}>
              Mensaje predeterminado
              <input name="message" style={input} defaultValue={branding.whatsappMessage || ''} />
            </label>
          </div>
          <button type="submit" className="btn-pill btn-orange">Guardar</button>
        </form>
      </div>

      <div style={card}>
        <h2 style={heading}>Redes Sociales</h2>
        <form onSubmit={saveSocial}>
          <label style={label}>Telegram<input name="telegram" style={input} defaultValue={branding.telegramUrl || ''} /></label>
          <label style={label}>X / Twitter<input name="x" style={input} defaultValue={branding.xUrl || ''} /></label>
          <label style={label}>Instagram<input name="instagram" style={input} defaultValue={branding.instagramUrl || ''} /></label>
          <button type="submit" className="btn-pill btn-orange">Guardar</button>
        </form>
      </div>

      <p style={{ fontSize: 12, color: '#a68f78' }}>
        Los ajustes de color/tipografía/fondo del panel anterior ya no aplican — el sitio nuevo tiene una sola identidad
        visual (naranja/marrón, inspirada en tus flyers reales).
      </p>
    </div>
  );
}
