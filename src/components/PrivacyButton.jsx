import { useState } from 'react';

export default function PrivacyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} style={btnStyle}>
        🔒 Tus datos
      </button>

      {open && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <button onClick={() => setOpen(false)} style={closeBtnStyle} aria-label="Cerrar">
              ×
            </button>
            <h2 style={titleStyle}>Cómo usamos tus datos</h2>
            <div style={bodyStyle}>
              <p>
                <strong>Responsable del tratamiento:</strong> The Club Housse (Cra 26p10 93-60, Marroquín 1 - Comuna 14) es el
                único responsable del tratamiento de tus datos personales recogidos en esta página y en sus canales de
                atención (WhatsApp, chat web).
              </p>
              <p>
                <strong>¿Qué datos pedimos?</strong> Al hacer un pedido: tu nombre, dirección (si es a domicilio), teléfono y,
                si la dejas, una nota. Si inicias sesión con Google, guardamos tu correo para tu cuenta, y tu historial de
                pedidos queda asociado a ella (para mostrarte "Mis pedidos" y "Tus favoritos"). Si nos escribes por WhatsApp o
                el chat del sitio, guardamos esa conversación para atenderte.
              </p>
              <p>
                <strong>¿Para qué los usamos?</strong> Solo para preparar y entregar tu pedido, contactarte si hay algún
                problema, mostrarte tu propio historial y favoritos si tienes cuenta, y responder tus preguntas. No vendemos
                tus datos.
              </p>
              <p>
                <strong>Uso de inteligencia artificial.</strong> El chat de este sitio y de WhatsApp está atendido por un
                asistente de IA (no una persona) que lee tu mensaje para ayudarte a ver el menú y armar tu pedido. Si prefieres
                hablar con una persona, puedes pedirlo en cualquier momento.
              </p>
              <p>
                <strong>¿Con quién se comparten?</strong> Con estos terceros, únicamente para que el servicio funcione:
              </p>
              <ul style={{ margin: '4px 0 12px', paddingLeft: 20 }}>
                <li>
                  <strong>Google</strong> — verifica tu identidad cuando inicias sesión (nunca vemos tu contraseña de Google).
                </li>
                <li>
                  <strong>Forja / Cloudflare</strong> — procesa las conversaciones del chatbot de IA.
                </li>
                <li>
                  <strong>Resend</strong> — envía el correo de aviso al dueño del negocio cuando confirmas un pedido.
                </li>
                <li>
                  <strong>Easypanel</strong> — aloja el servidor donde vive esta página y tus datos.
                </li>
              </ul>
              <p>
                <strong>¿Cuánto tiempo los guardamos?</strong> El tiempo necesario para atenderte; después, puedes pedirnos que
                los eliminemos.
              </p>
              <p>
                <strong>Tus derechos</strong> (Ley 1581 de 2012 — Habeas Data, Colombia): puedes pedirnos en cualquier momento
                que te digamos qué datos tuyos tenemos, que los corrijamos, o que los eliminemos por completo. Si tienes
                cuenta, puedes eliminarla tú mismo desde "Mi cuenta → Eliminar mi cuenta"; si no, escríbenos por WhatsApp y lo
                hacemos tan pronto lo pidas.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btnStyle = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  zIndex: 40,
  background: '#fff',
  border: '1px solid var(--brand-card-border)',
  color: '#6b5a4d',
  borderRadius: 20,
  padding: '8px 14px',
  fontSize: 12,
  cursor: 'pointer',
};
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const cardStyle = { background: '#fff', border: '2px solid var(--brand-card-border)', borderRadius: 16, padding: '24px 28px', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', position: 'relative' };
const closeBtnStyle = { position: 'absolute', top: 10, right: 14, background: 'transparent', border: 'none', color: 'var(--brand-text-dark)', fontSize: 22, cursor: 'pointer' };
const titleStyle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 0, color: 'var(--brand-text-dark)' };
const bodyStyle = { fontSize: 14, lineHeight: 1.6, color: '#4a3c30' };
