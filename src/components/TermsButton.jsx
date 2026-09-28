import { useState } from 'react';

export default function TermsButton({ inline, onClose: onCloseProp }) {
  const [open, setOpen] = useState(!!inline);

  const close = () => {
    setOpen(false);
    onCloseProp?.();
  };

  return (
    <>
      {!inline && (
        <button onClick={() => setOpen(true)} style={btnStyle}>
          📋 Términos y condiciones
        </button>
      )}

      {open && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <button onClick={close} style={closeBtnStyle} aria-label="Cerrar">
              ×
            </button>
            <h2 style={titleStyle}>Términos y condiciones de uso</h2>
            <div style={bodyStyle}>
              <p>
                Al hacer un pedido en esta página, por WhatsApp o por cualquier chat asistido por el bot de The Club Housse,
                aceptas estas condiciones.
              </p>
              <p>
                <strong>1. El pedido.</strong> Precios, disponibilidad y stock son los vigentes al momento de confirmar; un
                platillo puede agotarse entre que lo ves y lo confirmas, en cuyo caso te avisamos antes de cobrarlo.
              </p>
              <p>
                <strong>2. Tipo de entrega.</strong> Domicilio, recoger en el local, o comer en el sitio — cada uno con sus
                propios cargos, mostrados antes de confirmar.
              </p>
              <p>
                <strong>3. Tiempos.</strong> Los tiempos de entrega o preparación son estimados, no garantizados — pueden
                variar por volumen de pedidos.
              </p>
              <p>
                <strong>4. Pago.</strong> Efectivo o Nequi al momento de la entrega, salvo que se indique otro método.
              </p>
              <p>
                <strong>5. Cancelaciones.</strong> Puedes cancelar escribiéndonos por WhatsApp antes de que tu pedido salga a
                reparto o entre en preparación.
              </p>
              <p>
                <strong>6. Datos personales.</strong> Se rige por nuestro aviso de privacidad — botón "Tus datos".
              </p>
              <p>
                <strong>7. Chat y bots.</strong> Si pides a través de nuestro chatbot, este es el mismo documento que el bot te
                pide aceptar antes de confirmar tu pedido. Ese chat lo atiende un asistente de inteligencia artificial, no una
                persona.
              </p>
              <p>
                <strong>8. Tu cuenta.</strong> Iniciar sesión con Google es opcional. Si lo haces, puedes eliminar tu cuenta
                cuando quieras desde "Mi cuenta" — ver el botón "Tus datos" para el detalle de qué se guarda y con quién se
                comparte.
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
  bottom: 60,
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
