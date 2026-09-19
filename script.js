const SUPREME_ADMIN_EMAIL = "angelvillota4@gmail.com";
let currentUser = null;

let categoriesData = [];
let dishesData = [];
let scheduleData = []; 
let takeoutConfig = { enabled: false, fee: 0, domicilioFee: 0 };
// 'manual' = el dueño prende/apaga con un switch · 'horario' = se calcula
// solo contra la hora actual, todos los días igual (soporta cruzar medianoche,
// ej. 18:00 a 00:00 -- "end" menor o igual a "start" se toma como "hasta el
// día siguiente").
let businessOpenConfig = { mode: 'manual', abiertoManual: true, horario: { start: "18:00", end: "00:00" } };
function estaAbiertoAhora(cfg) {
  const c = cfg || businessOpenConfig;
  if (c.mode !== 'horario') return c.abiertoManual !== false;
  const { start, end } = c.horario || {};
  if (!start || !end) return true;
  const now = new Date().toTimeString().slice(0, 5);
  return start <= end ? (now >= start && now < end) : (now >= start || now < end);
}
let deliveryZoneConfig = { enabled: false, address: '', carreraFrom: '', carreraTo: '', calleFrom: '', calleTo: '' };
let brandingConfig = {};
let usersData = [];
let n8nConfig = { apiKey: "" };
let ordersData = [];
let notifyConfig = { resendApiKey: "", ownerEmail: "" };
let cartData = []; // { key, dishId, scheduleId, name, price(number), cantidad, day }
let cartExpanded = false;
// 'semanal' = horario por día (el de siempre) · 'unico' = un solo menú fijo,
// todos los días igual (independiente del horario semanal, no lo borra).
let menuMode = 'semanal';
// Igual que scheduleData pero SIN día -- vive aparte para que activar/desactivar
// "menú único" nunca toque ni borre el horario semanal ya armado.
let singleMenuSchedule = [];
function nombreDiaHoy() {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dias[new Date().getDay()];
}
// Fecha de hoy en la zona horaria del restaurante (America/Bogota), como
// "YYYY-MM-DD" -- se usa para saber si el stock de un platillo ya cruzó la
// medianoche y toca reiniciarlo a su valor definido.
function fechaHoyBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}
// El stock de un platillo (schedule o menú único) se define UNA vez
// (stockDefinido) y cada día se reinicia solo a ese valor -- así el dueño no
// tiene que acordarse de resetearlo a mano cada mañana. Devuelve true si
// cambió algo (para saber si hace falta guardar).
function reiniciarStockDiario(filas) {
  const hoy = fechaHoyBogota();
  let cambio = false;
  filas.forEach(f => {
    if (f.stockDefinido !== null && f.stockDefinido !== undefined && f.stockResetDate !== hoy) {
      f.stock = f.stockDefinido;
      f.stockResetDate = hoy;
      cambio = true;
    }
  });
  return cambio;
}

let pendingDeleteAction = null;

// PHP no distingue entre un objeto vacío {} y un arreglo vacío [], así
// que al guardar/leer un objeto de configuración vacío puede volver
// convertido en []. Esta función se asegura de que siempre trabajemos
// con un objeto real, nunca con un arreglo "disfrazado" de objeto.
function ensureObject(val, fallback) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  return fallback;
}

async function loadAllData() {
  try {
    const response = await fetch('api/load-data.php?_=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();
    categoriesData = data.categories || [];
    if (categoriesData.length === 0) {
      categoriesData = [{ id: 1, name: "Sopas / Sancocho / Caldo" }];
    }
    // Compatibilidad con categorías creadas antes de esta función. Los
    // acompañamientos por defecto (arroz, ensalada, principio a elegir) se
    // configuran UNA vez por categoría (típicamente "Proteína") y aplican a
    // TODOS sus platillos, toda la semana -- así no hay que repetirlo plato
    // por plato.
    categoriesData.forEach(c => {
      if (c.deliveryEnabled === undefined) c.deliveryEnabled = true;
    });
    dishesData = data.dishes || [];
    scheduleData = data.schedule || [];
    scheduleData.forEach(s => {
      if (s.stockDefinido === undefined) s.stockDefinido = s.stock ?? null;
      if (s.stockResetDate === undefined) s.stockResetDate = fechaHoyBogota();
    });
    menuMode = data.menuMode === 'unico' ? 'unico' : 'semanal';
    singleMenuSchedule = Array.isArray(data.singleMenuSchedule) ? data.singleMenuSchedule : [];
    singleMenuSchedule.forEach(s => {
      if (s.stockDefinido === undefined) s.stockDefinido = s.stock ?? null;
      if (s.stockResetDate === undefined) s.stockResetDate = fechaHoyBogota();
    });
    takeoutConfig = ensureObject(data.takeoutConfig, { enabled: false, fee: 0, domicilioFee: 0 });
    businessOpenConfig = ensureObject(data.businessOpenConfig, { mode: 'manual', abiertoManual: true, horario: { start: "18:00", end: "00:00" } });
    businessOpenConfig.horario = ensureObject(businessOpenConfig.horario, { start: "18:00", end: "00:00" });
    deliveryZoneConfig = ensureObject(data.deliveryZoneConfig, { enabled: false, address: '', carreraFrom: '', carreraTo: '', calleFrom: '', calleTo: '' });
    brandingConfig = ensureObject(data.brandingConfig, {});
    usersData = data.usersData || [];
    n8nConfig = ensureObject(data.n8nConfig, { apiKey: "" });
    ordersData = data.ordersData || [];
    notifyConfig = ensureObject(data.notifyConfig, { resendApiKey: "", ownerEmail: "" });

    // Reinicio diario de stock -- si algún platillo (horario semanal o menú
    // único) cruzó la medianoche desde la última vez que se consultó, vuelve
    // solo a su "stock definido". Si algo cambió, se guarda de una vez para
    // que quede al día en el servidor (lo vería cualquiera que consulte
    // después: otro cliente, el bot, N8N).
    const cambioSemanal = reiniciarStockDiario(scheduleData);
    const cambioUnico = reiniciarStockDiario(singleMenuSchedule);
    if (cambioSemanal || cambioUnico) await saveAllData();
  } catch (error) { console.error('Error cargando:', error); }
}

async function saveAllData() {
  const payload = { categories: categoriesData, dishes: dishesData, schedule: scheduleData, menuMode, singleMenuSchedule, takeoutConfig, businessOpenConfig, deliveryZoneConfig, brandingConfig, usersData, n8nConfig, ordersData, notifyConfig };
  try {
    const response = await fetch('api/save-data.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!result.success) {
      console.error('Error guardando:', result.error);
      alert('⚠️ No se pudo guardar en el servidor: ' + (result.error || 'error desconocido') + '\nRevisa los permisos de la carpeta /data en tu servidor.');
    }
    return result.success;
  } catch (error) {
    console.error('Error al guardar:', error);
    alert('⚠️ No se pudo conectar con el servidor para guardar los cambios. Revisa tu conexión o la configuración del servidor.');
    return false;
  }
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch('api/upload-image.php', { method: 'POST', body: formData });
  const result = await response.json();
  return result.success ? result.url : null;
}

function formatCurrency(input) {
  let digits = String(input).replace(/\D/g, "");
  return `$ ${parseInt(digits || 0, 10).toLocaleString('es-CO')}`;
}
function parseCurrencyNumber(formattedString) { return parseInt(String(formattedString).replace(/\D/g, ""), 10) || 0; }
function getCurrentDayName() { return ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][new Date().getDay()]; }

function applyBrandingSettings() {
  const root = document.documentElement;
  root.style.setProperty('--accent', brandingConfig.accentColor || '#f59e0b');
  root.style.setProperty('--title-color', brandingConfig.titleColor || '#f59e0b');
  root.style.setProperty('--bg', brandingConfig.bgColor || '#0f172a');
  root.style.setProperty('--card-bg', brandingConfig.cardBgColor || '#1e293b');
  root.style.setProperty('--desc-color', brandingConfig.descColor || '#94a3b8');
  root.style.setProperty('--title-font', brandingConfig.titleFont || 'system-ui, sans-serif');
  root.style.setProperty('--body-font', brandingConfig.bodyFont || 'system-ui, sans-serif');

  if (brandingConfig.bgImageUrl) document.body.style.backgroundImage = `url('${brandingConfig.bgImageUrl}')`;
  else document.body.style.backgroundImage = 'none';

  document.getElementById('bg-overlay').classList.toggle('hidden', !(brandingConfig.bgOverlayEnabled !== false && brandingConfig.bgImageUrl));

  const brandTitle = document.getElementById('brand-title');
  const brandLogo = document.getElementById('brand-logo');
  if (brandingConfig.logoUrl) { brandLogo.src = brandingConfig.logoUrl; brandLogo.classList.remove('hidden'); brandTitle.classList.add('hidden'); }
  else { brandTitle.textContent = brandingConfig.name || "Restaurante"; brandTitle.classList.remove('hidden'); brandLogo.classList.add('hidden'); }

  const whatsappFloatBtn = document.getElementById('whatsapp-float-btn');
  if (brandingConfig.whatsappNumber) {
    whatsappFloatBtn.href = `https://wa.me/${brandingConfig.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(brandingConfig.whatsappMessage || "")}`;
    whatsappFloatBtn.classList.remove('hidden');
  } else whatsappFloatBtn.classList.add('hidden');

  const telegramFloatBtn = document.getElementById('telegram-float-btn');
  if (brandingConfig.telegramUrl) { telegramFloatBtn.href = brandingConfig.telegramUrl; telegramFloatBtn.classList.remove('hidden'); }
  else telegramFloatBtn.classList.add('hidden');

  const xFloatBtn = document.getElementById('x-float-btn');
  if (brandingConfig.xUrl) { xFloatBtn.href = brandingConfig.xUrl; xFloatBtn.classList.remove('hidden'); }
  else xFloatBtn.classList.add('hidden');

  const instagramFloatBtn = document.getElementById('instagram-float-btn');
  if (brandingConfig.instagramUrl) { instagramFloatBtn.href = brandingConfig.instagramUrl; instagramFloatBtn.classList.remove('hidden'); }
  else instagramFloatBtn.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
  applyBrandingSettings();

  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const errorMsg = document.getElementById('error-msg');
  const logoutBtn = document.getElementById('logout-btn');
  const menuView = document.getElementById('menu-view');
  const dashboardView = document.getElementById('dashboard-view');
  const userDisplay = document.getElementById('user-display');
  const navUsersBtn = document.getElementById('nav-users-btn');
  const navN8nBtn = document.getElementById('nav-n8n-btn');
  const navOrdersBtn = document.getElementById('nav-orders-btn');

  document.getElementById('open-login-btn').addEventListener('click', () => loginModal.classList.remove('hidden'));
  document.getElementById('close-modal-btn').addEventListener('click', () => loginModal.classList.add('hidden'));

  document.getElementById('privacy-notice-btn').addEventListener('click', () => document.getElementById('privacy-modal').classList.remove('hidden'));
  document.getElementById('close-privacy-modal-btn').addEventListener('click', () => document.getElementById('privacy-modal').classList.add('hidden'));

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const user = usersData.find(u => u.email === email && u.password === password);
    
    if (user || (email === SUPREME_ADMIN_EMAIL && password === "1234")) {
      currentUser = email;
      errorMsg.textContent = '';
      loginModal.classList.add('hidden');
      document.getElementById('guest-actions').classList.add('hidden');
      document.getElementById('user-actions').classList.remove('hidden');
      userDisplay.textContent = email;
      menuView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      
      if (currentUser === SUPREME_ADMIN_EMAIL) {
        navUsersBtn.classList.remove('hidden');
        navN8nBtn.classList.remove('hidden');
        navOrdersBtn.classList.remove('hidden');
      } else {
        navUsersBtn.classList.add('hidden');
        navN8nBtn.classList.add('hidden');
        navOrdersBtn.classList.add('hidden');
      }
      showWelcomeSection();
    } else {
      errorMsg.textContent = 'Credenciales inválidas.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    document.getElementById('guest-actions').classList.remove('hidden');
    document.getElementById('user-actions').classList.add('hidden');
    dashboardView.classList.add('hidden');
    menuView.classList.remove('hidden');
    renderPublicMenu();
  });

  function showWelcomeSection() { ['section-categories', 'section-mealtimes', 'section-customize', 'section-dishes', 'section-schedule', 'section-orders', 'section-n8n', 'section-users'].forEach(id => document.getElementById(id).classList.add('hidden')); document.getElementById('welcome-section').classList.remove('hidden'); }
  function showSection(id) { showWelcomeSection(); document.getElementById('welcome-section').classList.add('hidden'); document.getElementById(id).classList.remove('hidden'); }

  document.getElementById('nav-categories-btn').addEventListener('click', () => { showSection('section-categories'); renderCategoriesSection(); });
  document.getElementById('nav-mealtimes-btn').addEventListener('click', () => { showSection('section-mealtimes'); loadOpenStatusFields(); loadDeliveryZoneFields(); });
  document.getElementById('nav-customize-btn').addEventListener('click', () => { showSection('section-customize'); loadCustomizeFields(); });
  document.getElementById('nav-new-dish-btn').addEventListener('click', () => { showSection('section-dishes'); renderDishesSection(); });
  document.getElementById('nav-schedule-btn').addEventListener('click', () => { showSection('section-schedule'); renderScheduleMatrixSection(); loadTakeoutFields(); });
  document.getElementById('nav-orders-btn').addEventListener('click', () => { showSection('section-orders'); renderOrdersSection(); loadNotifyConfigFields(); });
  document.getElementById('nav-n8n-btn').addEventListener('click', () => { showSection('section-n8n'); loadConfigStatus(); });
  document.getElementById('nav-users-btn').addEventListener('click', () => { showSection('section-users'); renderUsersSection(); });

  document.getElementById('create-category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-category-id').value;
    const name = document.getElementById('category-name-input').value.trim();
    const deliveryEnabled = document.getElementById('category-delivery-input').checked;
    const exentoEmpaque = document.getElementById('category-exento-input').checked;
    if (!name) return;
    const campos = { name, deliveryEnabled, exentoEmpaque };
    if (editId) {
      const cat = categoriesData.find(c => c.id === Number(editId));
      if (cat) Object.assign(cat, campos);
      await saveAllData();
      renderCategoriesSection();
      renderDishesSection();
      renderPublicMenu();
      resetCategoryForm();
      alert("Categoría actualizada");
    } else {
      categoriesData.push({ id: Date.now(), ...campos });
      await saveAllData();
      renderCategoriesSection();
      renderDishesSection();
      resetCategoryForm();
      alert("Categoría agregada");
    }
  });
  function resetCategoryForm() {
    document.getElementById('create-category-form').reset();
    document.getElementById('edit-category-id').value = '';
    document.getElementById('category-form-title').textContent = 'Crear Nueva Categoría';
    document.getElementById('btn-save-category').textContent = 'Agregar';
    document.getElementById('btn-cancel-edit-category').classList.add('hidden');
    document.getElementById('category-delivery-input').checked = true;
  }
  window.editCategory = (id) => {
    const cat = categoriesData.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('edit-category-id').value = cat.id;
    document.getElementById('category-name-input').value = cat.name;
    document.getElementById('category-delivery-input').checked = cat.deliveryEnabled !== false;
    document.getElementById('category-exento-input').checked = !!cat.exentoEmpaque;
    document.getElementById('category-form-title').textContent = `Editando: ${cat.name}`;
    document.getElementById('btn-save-category').textContent = 'Actualizar';
    document.getElementById('btn-cancel-edit-category').classList.remove('hidden');
    document.getElementById('create-category-form').scrollIntoView({ behavior: 'smooth' });
  };
  document.getElementById('btn-cancel-edit-category').addEventListener('click', resetCategoryForm);
  window.deleteCategory = async (id) => {
    requestDelete('¿Eliminar categoría y sus platillos?', async () => {
      categoriesData = categoriesData.filter(c => c.id !== id);
      dishesData = dishesData.filter(d => d.categoryId !== id);
      scheduleData = scheduleData.filter(s => dishesData.some(d => d.id === s.dishId));
      await saveAllData();
      renderCategoriesSection();
      renderDishesSection();
      renderPublicMenu();
    });
  };
  window.toggleExentoEmpaque = async (id) => {
    const cat = categoriesData.find(c => c.id === id);
    if (!cat) return;
    cat.exentoEmpaque = !cat.exentoEmpaque;
    await saveAllData();
    renderCategoriesSection();
    renderPublicMenu();
  };
  window.toggleDeliveryEnabled = async (id) => {
    const cat = categoriesData.find(c => c.id === id);
    if (!cat) return;
    cat.deliveryEnabled = !cat.deliveryEnabled;
    await saveAllData();
    renderCategoriesSection();
    renderPublicMenu();
  };
  function renderCategoriesSection() {
    const list = document.getElementById('categories-management-list');
    list.innerHTML = '';
    categoriesData.forEach(cat => list.innerHTML += `<div class="preview-category">
      <div class="preview-category-header"><h4>${cat.name} (${dishesData.filter(d => d.categoryId === cat.id).length} platillos)</h4><div class="action-btns"><button class="btn-edit-sm" onclick="editCategory(${cat.id})">Editar</button><button class="btn-danger-sm" onclick="deleteCategory(${cat.id})">Eliminar</button></div></div>
      <div class="category-options-row">
        <label class="checkbox-label"><input type="checkbox" onchange="toggleDeliveryEnabled(${cat.id})" ${cat.deliveryEnabled !== false ? 'checked' : ''}> Disponible a domicilio</label>
        <label class="checkbox-label"><input type="checkbox" onchange="toggleExentoEmpaque(${cat.id})" ${cat.exentoEmpaque ? 'checked' : ''}> Exenta de cargo de empaque</label>
      </div>
    </div>`);
  }

  function loadOpenStatusFields() {
    document.getElementById('open-status-mode').value = businessOpenConfig.mode || 'manual';
    document.getElementById('open-status-manual-checkbox').checked = businessOpenConfig.abiertoManual !== false;
    document.getElementById('open-status-start').value = businessOpenConfig.horario?.start || '18:00';
    document.getElementById('open-status-end').value = businessOpenConfig.horario?.end || '00:00';
    toggleOpenStatusMode();
  }
  function toggleOpenStatusMode() {
    const esHorario = document.getElementById('open-status-mode').value === 'horario';
    document.getElementById('open-status-manual-wrap').classList.toggle('hidden', esHorario);
    document.getElementById('open-status-horario-wrap').classList.toggle('hidden', !esHorario);
  }
  document.getElementById('open-status-mode').addEventListener('change', toggleOpenStatusMode);
  document.getElementById('open-status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    businessOpenConfig = {
      mode: document.getElementById('open-status-mode').value,
      abiertoManual: document.getElementById('open-status-manual-checkbox').checked,
      horario: {
        start: document.getElementById('open-status-start').value || '18:00',
        end: document.getElementById('open-status-end').value || '00:00',
      },
    };
    await saveAllData();
    renderPublicMenu();
    alert("Estado guardado");
  });


  function loadDeliveryZoneFields() {
    document.getElementById('delivery-zone-enable-checkbox').checked = !!deliveryZoneConfig.enabled;
    document.getElementById('delivery-zone-address-input').value = deliveryZoneConfig.address || '';
    document.getElementById('delivery-zone-carrera-from-input').value = deliveryZoneConfig.carreraFrom ?? '';
    document.getElementById('delivery-zone-carrera-to-input').value = deliveryZoneConfig.carreraTo ?? '';
    document.getElementById('delivery-zone-calle-from-input').value = deliveryZoneConfig.calleFrom ?? '';
    document.getElementById('delivery-zone-calle-to-input').value = deliveryZoneConfig.calleTo ?? '';
  }
  document.getElementById('delivery-zone-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    deliveryZoneConfig = {
      enabled: document.getElementById('delivery-zone-enable-checkbox').checked,
      address: document.getElementById('delivery-zone-address-input').value.trim(),
      carreraFrom: document.getElementById('delivery-zone-carrera-from-input').value.trim(),
      carreraTo: document.getElementById('delivery-zone-carrera-to-input').value.trim(),
      calleFrom: document.getElementById('delivery-zone-calle-from-input').value.trim(),
      calleTo: document.getElementById('delivery-zone-calle-to-input').value.trim()
    };
    await saveAllData();
    alert("Zona de domicilio guardada (solo visible para la API)");
  });

  function loadCustomizeFields() {
    document.getElementById('restaurant-name-input').value = brandingConfig.name || "";
    document.getElementById('restaurant-logo-input').value = brandingConfig.logoUrl || "";
    document.getElementById('whatsapp-number-input').value = brandingConfig.whatsappNumber || "";
    document.getElementById('whatsapp-message-input').value = brandingConfig.whatsappMessage || "";
    document.getElementById('telegram-url-input').value = brandingConfig.telegramUrl || "";
    document.getElementById('x-url-input').value = brandingConfig.xUrl || "";
    document.getElementById('instagram-url-input').value = brandingConfig.instagramUrl || "";
    document.getElementById('bg-image-url-input').value = brandingConfig.bgImageUrl || "";
    document.getElementById('bg-overlay-checkbox').checked = brandingConfig.bgOverlayEnabled !== false;
    document.getElementById('title-font-select').value = brandingConfig.titleFont || "system-ui, sans-serif";
    document.getElementById('body-font-select').value = brandingConfig.bodyFont || "system-ui, sans-serif";
    document.getElementById('accent-color-input').value = brandingConfig.accentColor || "#f59e0b";
    document.getElementById('title-color-input').value = brandingConfig.titleColor || "#f59e0b";
    document.getElementById('bg-color-input').value = brandingConfig.bgColor || "#0f172a";
    document.getElementById('card-bg-color-input').value = brandingConfig.cardBgColor || "#1e293b";
    document.getElementById('desc-color-input').value = brandingConfig.descColor || "#94a3b8";
  }

  document.getElementById('customize-identity-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    brandingConfig.name = document.getElementById('restaurant-name-input').value;
    let url = document.getElementById('restaurant-logo-input').value;
    if (document.getElementById('restaurant-logo-file').files[0]) url = await uploadImage(document.getElementById('restaurant-logo-file').files[0]);
    if (url) brandingConfig.logoUrl = url;
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('customize-whatsapp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    brandingConfig.whatsappNumber = document.getElementById('whatsapp-number-input').value;
    brandingConfig.whatsappMessage = document.getElementById('whatsapp-message-input').value;
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('customize-social-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    brandingConfig.telegramUrl = document.getElementById('telegram-url-input').value.trim();
    brandingConfig.xUrl = document.getElementById('x-url-input').value.trim();
    brandingConfig.instagramUrl = document.getElementById('instagram-url-input').value.trim();
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('customize-bg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let url = document.getElementById('bg-image-url-input').value;
    if (document.getElementById('bg-image-file').files[0]) url = await uploadImage(document.getElementById('bg-image-file').files[0]);
    brandingConfig.bgImageUrl = url;
    brandingConfig.bgOverlayEnabled = document.getElementById('bg-overlay-checkbox').checked;
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('customize-fonts-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    brandingConfig.titleFont = document.getElementById('title-font-select').value;
    brandingConfig.bodyFont = document.getElementById('body-font-select').value;
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('customize-colors-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    brandingConfig.accentColor = document.getElementById('accent-color-input').value;
    brandingConfig.titleColor = document.getElementById('title-color-input').value;
    brandingConfig.bgColor = document.getElementById('bg-color-input').value;
    brandingConfig.cardBgColor = document.getElementById('card-bg-color-input').value;
    brandingConfig.descColor = document.getElementById('desc-color-input').value;
    await saveAllData(); applyBrandingSettings();
  });

  document.getElementById('remove-logo-btn').addEventListener('click', async () => {
    brandingConfig.logoUrl = '';
    document.getElementById('restaurant-logo-input').value = '';
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('remove-whatsapp-btn').addEventListener('click', async () => {
    brandingConfig.whatsappNumber = '';
    brandingConfig.whatsappMessage = '';
    document.getElementById('whatsapp-number-input').value = '';
    document.getElementById('whatsapp-message-input').value = '';
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('remove-social-btn').addEventListener('click', async () => {
    brandingConfig.telegramUrl = '';
    brandingConfig.xUrl = '';
    brandingConfig.instagramUrl = '';
    document.getElementById('telegram-url-input').value = '';
    document.getElementById('x-url-input').value = '';
    document.getElementById('instagram-url-input').value = '';
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('remove-bg-btn').addEventListener('click', async () => {
    brandingConfig.bgImageUrl = '';
    document.getElementById('bg-image-url-input').value = '';
    document.getElementById('bg-image-file').value = '';
    await saveAllData(); applyBrandingSettings();
  });
  document.getElementById('reset-colors-btn').addEventListener('click', async () => {
    brandingConfig.accentColor = '#f59e0b';
    brandingConfig.titleColor = '#f59e0b';
    brandingConfig.bgColor = '#0f172a';
    brandingConfig.cardBgColor = '#1e293b';
    brandingConfig.descColor = '#94a3b8';
    loadCustomizeFields();
    await saveAllData(); applyBrandingSettings();
  });

  document.getElementById('create-dish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-dish-id').value;
    const dishData = {
      categoryId: Number(document.getElementById('select-category').value),
      name: document.getElementById('dish-name').value.trim(),
      desc: document.getElementById('dish-desc').value.trim(),
      price: formatCurrency(document.getElementById('dish-price').value),
    };

    const imageFile = document.getElementById('dish-image-file').files[0];
    const removeImage = document.getElementById('dish-image-remove-checkbox').checked;
    if (imageFile) {
      const url = await uploadImage(imageFile);
      if (url) dishData.imageUrl = url;
    } else if (removeImage) {
      dishData.imageUrl = '';
    }

    if (id) {
      const dish = dishesData.find(d => d.id === Number(id));
      Object.assign(dish, dishData);
    } else {
      dishesData.push({ id: Date.now(), ...dishData });
    }
    await saveAllData();
    document.getElementById('edit-dish-id').value = '';
    document.getElementById('btn-save-dish').textContent = 'Guardar';
    document.getElementById('dish-image-file').value = '';
    document.getElementById('dish-image-remove-checkbox').checked = false;
    document.getElementById('dish-image-preview-wrap').classList.add('hidden');
    renderDishesSection();
    renderPublicMenu();
  });
  window.editDish = (id) => {
    const dish = dishesData.find(d => d.id === id);
    document.getElementById('edit-dish-id').value = dish.id;
    document.getElementById('select-category').value = dish.categoryId;
    document.getElementById('dish-name').value = dish.name;
    document.getElementById('dish-desc').value = dish.desc || "";
    document.getElementById('dish-price').value = dish.price.replace(/\D/g, "");
    document.getElementById('dish-image-file').value = '';
    document.getElementById('dish-image-remove-checkbox').checked = false;
    const previewWrap = document.getElementById('dish-image-preview-wrap');
    if (dish.imageUrl) {
      document.getElementById('dish-image-preview').src = dish.imageUrl;
      previewWrap.classList.remove('hidden');
    } else {
      previewWrap.classList.add('hidden');
    }
    document.getElementById('btn-save-dish').textContent = 'Actualizar';
    document.getElementById('btn-cancel-edit-dish').classList.remove('hidden');
    showSection('section-dishes');
  };
  document.getElementById('btn-cancel-edit-dish').addEventListener('click', () => {
    document.getElementById('edit-dish-id').value = '';
    document.getElementById('btn-save-dish').textContent = 'Guardar';
    document.getElementById('btn-cancel-edit-dish').classList.add('hidden');
    document.getElementById('dish-image-file').value = '';
    document.getElementById('dish-image-remove-checkbox').checked = false;
    document.getElementById('dish-image-preview-wrap').classList.add('hidden');
  });
  window.deleteDish = (id) => {
    requestDelete('¿Eliminar platillo?', async () => {
      dishesData = dishesData.filter(d => d.id !== id);
      scheduleData = scheduleData.filter(s => s.dishId !== id);
      singleMenuSchedule = singleMenuSchedule.filter(s => s.dishId !== id);
      await saveAllData();
      renderDishesSection();
      renderPublicMenu();
    });
  };
  function renderDishesSection() {
    const sel = document.getElementById('select-category');
    sel.innerHTML = '<option value="">-- Seleccionar --</option>';
    categoriesData.forEach(cat => sel.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);

    const list = document.getElementById('dishes-management-list');
    list.innerHTML = '';
    if (dishesData.length === 0) { list.innerHTML = '<p class="text-muted">Sin platillos.</p>'; return; }
    dishesData.forEach(dish => {
      const catName = categoriesData.find(c => c.id === dish.categoryId)?.name || "Sin categoría";
      list.innerHTML += `<div class="preview-dish-item"><div>• <strong>${dish.name}</strong> (${catName}) - ${dish.price}</div><div class="action-btns"><button class="btn-edit-sm" onclick="editDish(${dish.id})">Editar</button><button class="btn-danger-sm" onclick="deleteDish(${dish.id})">X</button></div></div>`;
    });
  }

  document.getElementById('schedule-quick-assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dishId = Number(document.getElementById('assign-select-dish').value);
    const day = document.getElementById('assign-select-day').value;
    if (!scheduleData.some(s => s.day === day && s.dishId === dishId)) {
      scheduleData.push({ id: Date.now(), day, dishId, available: true, stock: null });
      await saveAllData();
      renderScheduleMatrixSection();
      renderPublicMenu();
    }
  });
  
  window.updateStock = async (scheduleId, value) => {
    const item = scheduleData.find(s => s.id === scheduleId);
    if (item) {
      // Este número es el "stock definido": el máximo del día. Se descuenta
      // con cada pedido y se reinicia solo a este mismo valor cada día nuevo.
      // Nunca se permite negativo.
      const n = value === "" ? null : Math.max(0, parseInt(value) || 0);
      item.stock = n;
      item.stockDefinido = n;
      item.stockResetDate = fechaHoyBogota();
      await saveAllData();
      renderPublicMenu();
    }
  };

  window.toggleAvailable = async (id) => { const item = scheduleData.find(s => s.id === id); item.available = !item.available; await saveAllData(); renderScheduleMatrixSection(); renderPublicMenu(); };
  window.removeSchedule = async (id) => { scheduleData = scheduleData.filter(s => s.id !== id); await saveAllData(); renderScheduleMatrixSection(); renderPublicMenu(); };
  
  function renderScheduleMatrixSection() {
    const sel = document.getElementById('assign-select-dish');
    // Se reconstruyen las opciones (puede haber platillos nuevos), pero se
    // conserva el platillo que estaba elegido -- así, después de darle
    // "Agregar al Horario", el día y el platillo NO se resetean y se pueden
    // encadenar varias asignaciones seguidas sin volver a elegir cada vez.
    const dishIdPrevio = sel.value;
    sel.innerHTML = '';
    dishesData.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    if (dishIdPrevio && dishesData.some(d => String(d.id) === dishIdPrevio)) sel.value = dishIdPrevio;
    const days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
    const body = document.getElementById('matrix-body');
    body.innerHTML = '';
    categoriesData.forEach(cat => {
      let row = `<tr><td class="matrix-cat-title">${cat.name}</td>`;
      days.forEach(day => {
        let cell = '';
        scheduleData.filter(s => s.day === day && dishesData.find(d => d.id === s.dishId)?.categoryId === cat.id).forEach(sItem => {
          const d = dishesData.find(dish => dish.id === sItem.dishId);
          cell += `<div class="matrix-item-tag ${!sItem.available ? 'sold-out' : ''}">
            <span class="matrix-item-title">${d.name}</span>
            <div class="matrix-item-actions">
              <button class="${sItem.available ? 'btn-toggle-available' : 'btn-toggle-soldout'}" onclick="toggleAvailable(${sItem.id})">${sItem.available ? 'Disponible' : 'Agotado'}</button>
              <div class="stock-input-container"><span class="stock-label">Stock:</span><input type="number" class="stock-input" min="0" value="${sItem.stock ?? ''}" onchange="updateStock(${sItem.id}, this.value)"></div>
              <button class="btn-danger-sm" onclick="removeSchedule(${sItem.id})">X</button>
            </div></div>`;
        });
        row += `<td>${cell || '-'}</td>`;
      });
      body.innerHTML += row + '</tr>';
    });
    renderMenuModeUI();
  }

  // ── Modo de menú: Semanal (horario por día) vs. Único (mismo todos los
  // días) -- cambiar de modo solo cambia cuál de los dos guarda/lee, nunca
  // borra el otro. ──────────────────────────────────────────────────────
  function renderMenuModeUI() {
    document.getElementById('menu-mode-semanal').checked = menuMode === 'semanal';
    document.getElementById('menu-mode-unico').checked = menuMode === 'unico';
    document.getElementById('weekly-schedule-ui').classList.toggle('hidden', menuMode === 'unico');
    document.getElementById('single-menu-ui').classList.toggle('hidden', menuMode !== 'unico');
    if (menuMode === 'unico') renderSingleMenuList();
  }
  document.querySelectorAll('input[name="menu-mode"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      menuMode = e.target.value === 'unico' ? 'unico' : 'semanal';
      await saveAllData();
      renderMenuModeUI();
      renderPublicMenu();
    });
  });

  document.getElementById('single-menu-assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sel = document.getElementById('single-assign-select-dish');
    const dishId = Number(sel.value);
    if (!singleMenuSchedule.some(s => s.dishId === dishId)) {
      singleMenuSchedule.push({ id: Date.now(), dishId, available: true, stock: null, stockDefinido: null, stockResetDate: fechaHoyBogota() });
      await saveAllData();
      renderSingleMenuList();
      renderPublicMenu();
    }
  });

  window.updateSingleStock = async (id, value) => {
    const item = singleMenuSchedule.find(s => s.id === id);
    if (item) {
      const n = value === "" ? null : Math.max(0, parseInt(value) || 0);
      item.stock = n;
      item.stockDefinido = n;
      item.stockResetDate = fechaHoyBogota();
      await saveAllData();
      renderPublicMenu();
    }
  };
  window.toggleSingleAvailable = async (id) => { const item = singleMenuSchedule.find(s => s.id === id); item.available = !item.available; await saveAllData(); renderSingleMenuList(); renderPublicMenu(); };
  window.removeSingleSchedule = async (id) => { singleMenuSchedule = singleMenuSchedule.filter(s => s.id !== id); await saveAllData(); renderSingleMenuList(); renderPublicMenu(); };

  function renderSingleMenuList() {
    const sel = document.getElementById('single-assign-select-dish');
    const dishIdPrevio = sel.value;
    sel.innerHTML = '';
    dishesData.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    if (dishIdPrevio && dishesData.some(d => String(d.id) === dishIdPrevio)) sel.value = dishIdPrevio;

    const list = document.getElementById('single-menu-list');
    if (singleMenuSchedule.length === 0) { list.innerHTML = '<p class="text-muted">Sin platillos en el menú único todavía.</p>'; return; }
    list.innerHTML = categoriesData.map(cat => {
      const items = singleMenuSchedule.filter(s => dishesData.find(d => d.id === s.dishId)?.categoryId === cat.id);
      if (items.length === 0) return '';
      const filas = items.map(sItem => {
        const d = dishesData.find(dish => dish.id === sItem.dishId);
        return `<div class="matrix-item-tag ${!sItem.available ? 'sold-out' : ''}">
          <span class="matrix-item-title">${d.name}</span>
          <div class="matrix-item-actions">
            <button class="${sItem.available ? 'btn-toggle-available' : 'btn-toggle-soldout'}" onclick="toggleSingleAvailable(${sItem.id})">${sItem.available ? 'Disponible' : 'Agotado'}</button>
            <div class="stock-input-container"><span class="stock-label">Stock:</span><input type="number" class="stock-input" min="0" value="${sItem.stock ?? ''}" onchange="updateSingleStock(${sItem.id}, this.value)"></div>
            <button class="btn-danger-sm" onclick="removeSingleSchedule(${sItem.id})">X</button>
          </div></div>`;
      }).join('');
      return `<div class="preview-category"><h4>${cat.name}</h4>${filas}</div>`;
    }).join('');
  }

  function loadTakeoutFields() {
    document.getElementById('takeout-enable-checkbox').checked = !!takeoutConfig.enabled;
    document.getElementById('takeout-fee-input').value = takeoutConfig.fee || '';
    document.getElementById('domicilio-fee-input').value = takeoutConfig.domicilioFee || '';
  }

  // Ya no genera/guarda la key en data.json (se leía sin protección desde
  // api/load-data.php) -- solo sugiere un valor al vuelo para que el dueño lo
  // copie y lo pegue ÉL MISMO como variable de entorno N8N_API_KEY en su
  // hosting. Nunca toca el servidor.
  document.getElementById('generate-n8n-key-btn').addEventListener('click', () => {
    const sugerida = 'n8n_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    document.getElementById('n8n-suggested-key').value = sugerida;
    document.getElementById('n8n-key-suggestion').classList.remove('hidden');
  });

  // Estado (configurada o no) de las llaves, sin exponer su valor real.
  async function loadConfigStatus() {
    try {
      const res = await fetch('api/config-status.php');
      const status = await res.json();
      const resendBadge = document.getElementById('resend-status-badge');
      const n8nBadge = document.getElementById('n8n-status-badge');
      if (resendBadge) {
        resendBadge.textContent = status.resendConfigured ? '✅ Configurada' : '⚠️ Falta configurar';
        resendBadge.className = status.resendConfigured ? 'badge-stock' : 'badge-soldout';
      }
      if (n8nBadge) {
        n8nBadge.textContent = status.n8nConfigured ? '✅ Configurada' : '⚠️ Falta configurar';
        n8nBadge.className = status.n8nConfigured ? 'badge-stock' : 'badge-soldout';
      }
      // Limpieza de una sola vez: si la variable de entorno YA está puesta y
      // todavía queda la llave vieja guardada en data.json (de antes de este
      // cambio), la borra -- así deja de viajar en la respuesta pública de
      // load-data.php.
      let necesitaLimpiar = false;
      if (status.resendConfigured && notifyConfig.resendApiKey) { notifyConfig.resendApiKey = ''; necesitaLimpiar = true; }
      if (status.n8nConfigured && n8nConfig.apiKey) { n8nConfig.apiKey = ''; necesitaLimpiar = true; }
      if (necesitaLimpiar) await saveAllData();
    } catch { /* si falla, el badge se queda en "Verificando…" */ }
  }

  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('new-user-email').value.trim();
    const pass = document.getElementById('new-user-password').value.trim();
    if (email && pass) {
      usersData.push({ email, password: pass });
      await saveAllData();
      renderUsersSection();
      alert("Usuario creado");
    }
  });
  window.deleteUser = async (email) => {
    requestDelete(`¿Eliminar usuario ${email}?`, async () => {
      usersData = usersData.filter(u => u.email !== email);
      await saveAllData();
      renderUsersSection();
    });
  };
  function renderUsersSection() {
    const list = document.getElementById('users-management-list');
    list.innerHTML = '';
    usersData.forEach(u => list.innerHTML += `<div class="preview-dish-item"><div>• ${u.email}</div><button class="btn-danger-sm" onclick="deleteUser('${u.email}')">X</button></div>`);
  }

  document.getElementById('cancel-delete-btn').addEventListener('click', () => { document.getElementById('delete-modal').classList.add('hidden'); pendingDeleteAction = null; });
  document.getElementById('confirm-delete-btn').addEventListener('click', () => { if (pendingDeleteAction) pendingDeleteAction(); document.getElementById('delete-modal').classList.add('hidden'); pendingDeleteAction = null; });
  function requestDelete(msg, action) { document.getElementById('delete-modal-msg').textContent = msg; pendingDeleteAction = action; document.getElementById('delete-modal').classList.remove('hidden'); }

  document.getElementById('public-day-select').addEventListener('change', renderPublicMenu);

  document.getElementById('takeout-config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    takeoutConfig.enabled = document.getElementById('takeout-enable-checkbox').checked;
    takeoutConfig.fee = parseCurrencyNumber(document.getElementById('takeout-fee-input').value);
    takeoutConfig.domicilioFee = parseCurrencyNumber(document.getElementById('domicilio-fee-input').value);
    await saveAllData();
    renderPublicMenu();
    alert("Cargos de entrega guardados");
  });

  function renderPublicMenu() {
    const list = document.getElementById('public-menu-list');
    const esUnico = menuMode === 'unico';
    const dayFilterContainer = document.querySelector('.day-filter-container');
    if (dayFilterContainer) dayFilterContainer.classList.toggle('hidden', esUnico);
    // Se fuerza a leer el valor del selector, no el día actual
    const day = document.getElementById('public-day-select').value;
    const esHoy = esUnico || day === nombreDiaHoy();
    // Menú único: un solo listado, sin filtrar por día. Menú semanal: solo
    // los platillos asignados exactamente al día elegido.
    const items = esUnico ? singleMenuSchedule : scheduleData.filter(s => s.day === day);
    list.innerHTML = esHoy ? '' : `<p class="day-notice">📅 Estás viendo el menú de <strong>${day}</strong> — solo puedes pedir del día de hoy (<strong>${nombreDiaHoy()}</strong>). Cambia el día arriba para poder agregar al pedido.</p>`;

    const negocioAbierto = estaAbiertoAhora();
    const closedBanner = document.getElementById('closed-banner');
    if (!negocioAbierto) {
      const horarioTxt = businessOpenConfig.mode === 'horario' ? ` Abrimos de ${businessOpenConfig.horario.start} a ${businessOpenConfig.horario.end}.` : '';
      closedBanner.textContent = `🔴 Estamos cerrados ahora mismo.${horarioTxt} Puedes ver el menú, pero no se pueden hacer pedidos.`;
      closedBanner.classList.remove('hidden');
    } else closedBanner.classList.add('hidden');

    categoriesData.forEach(cat => {
      let catDishes = items
        .filter(s => dishesData.find(d => d.id === s.dishId)?.categoryId === cat.id)
        .map(s => ({ ...dishesData.find(d => d.id === s.dishId), available: s.available, stock: s.stock }));

      if (catDishes.length > 0) {
        const deliveryBadge = cat.deliveryEnabled === false ? '<span class="delivery-badge no-delivery">🚫 No disponible a domicilio</span>' : '';
        let html = `<h2 class="category-title">${cat.name} ${deliveryBadge}</h2>`;
        catDishes.forEach(dish => {
          if (!dish) return;
          const isSoldOut = dish.available === false || dish.stock === 0;
          let stockBadge = '';
          if (dish.stock > 0) stockBadge = `<span class="badge-stock">Quedan ${dish.stock}</span>`;
          if (dish.stock === 0) stockBadge = '<span class="badge-soldout">AGOTADO</span>';

          const imageHtml = dish.imageUrl ? `<img class="menu-item-image" src="${dish.imageUrl}" alt="${dish.name}">` : '';

          html += `<div class="menu-item ${isSoldOut ? 'sold-out' : ''}">
            <div class="item-info">${imageHtml}<div class="item-info-text"><h3>${dish.name} ${stockBadge}</h3>${dish.desc ? `<p>${dish.desc}</p>` : ''}</div></div>
            <div class="price-container"><span class="price">${dish.price}</span>
              ${(!isSoldOut && esHoy && negocioAbierto) ? `<button type="button" class="btn-add-cart" onclick="addToCart(${dish.id})">+ Agregar</button>` : ''}
            </div>
          </div>`;
        });
        list.innerHTML += `<section class="menu-section">${html}</section>`;
      }
    });
    if (!list.innerHTML) list.innerHTML = '<p class="text-muted" style="text-align:center;">No hay platillos para este día.</p>';
  }

  // ── Carrito / pedido directo en la página ──────────────────────────────
  // En modo "único" el día no importa -- se busca en singleMenuSchedule y
  // se ignora el parámetro day. En modo "semanal" funciona como siempre.
  function getMenuItemForDay(dishId, day) {
    const dish = dishesData.find(d => d.id === dishId);
    if (!dish) return null;
    const sched = menuMode === 'unico'
      ? singleMenuSchedule.find(s => s.dishId === dishId)
      : scheduleData.find(s => s.day === day && s.dishId === dishId);
    if (!sched) return null;
    return { id: dish.id, name: dish.name, price: dish.price, scheduleId: sched.id, available: sched.available, stock: sched.stock };
  }
  function newCartKey() { return 'c' + Date.now() + Math.random().toString(36).slice(2, 7); }

  window.addToCart = (dishId) => {
    const day = document.getElementById('public-day-select').value;
    const item = getMenuItemForDay(dishId, day);
    if (!item || item.available === false || item.stock === 0) { alert('Ese platillo ya no está disponible.'); return; }
    cartData.push({ key: newCartKey(), dishId: item.id, scheduleId: item.scheduleId, name: item.name, price: parseCurrencyNumber(item.price), cantidad: 1, day });
    renderCart();
  };
  window.changeCartQty = (key, delta) => {
    const item = cartData.find(i => i.key === key);
    if (!item) return;
    item.cantidad = Math.max(1, item.cantidad + delta);
    renderCart();
  };
  window.removeFromCart = (key) => {
    cartData = cartData.filter(i => i.key !== key);
    renderCart();
  };
  function renderCart() {
    const panel = document.getElementById('cart-panel');
    const badge = document.getElementById('cart-mini-badge');
    const itemsWrap = document.getElementById('cart-items');
    const total = cartData.reduce((sum, i) => sum + i.price * i.cantidad, 0);

    if (cartData.length === 0) {
      panel.classList.add('hidden');
      badge.classList.add('hidden');
      document.body.classList.remove('cart-expanded');
      itemsWrap.innerHTML = '';
      document.getElementById('cart-total-amount').textContent = formatCurrency(0);
      return;
    }

    if (!cartExpanded) {
      // En reposo: solo la pastillita chiquita, no tapa nada del menú.
      panel.classList.add('hidden');
      badge.classList.remove('hidden');
      document.body.classList.remove('cart-expanded');
      const platos = cartData.reduce((sum, i) => sum + i.cantidad, 0);
      document.getElementById('cart-mini-count').textContent = platos;
      document.getElementById('cart-mini-total').textContent = formatCurrency(total);
      return;
    }

    // Expandido: se ve el detalle completo.
    badge.classList.add('hidden');
    panel.classList.remove('hidden');
    document.body.classList.add('cart-expanded');
    let html = '';
    cartData.forEach(p => {
      html += `<div class="cart-item-group">
        <div class="cart-item-row">
          <span class="cart-item-name">${p.cantidad} x ${p.name}</span>
          <span class="cart-item-price">${formatCurrency(p.price * p.cantidad)}</span>
          <div class="cart-item-qty">
            <button type="button" class="btn-secondary-sm" onclick="changeCartQty('${p.key}', -1)">-</button>
            <button type="button" class="btn-secondary-sm" onclick="changeCartQty('${p.key}', 1)">+</button>
            <button type="button" class="btn-danger-sm" onclick="removeFromCart('${p.key}')">X</button>
          </div>
        </div>
      </div>`;
    });
    itemsWrap.innerHTML = html;
    document.getElementById('cart-total-amount').textContent = formatCurrency(total);
    actualizarResumenEntrega();
  }

  // ── Tipo de entrega (Domicilio/Recoger/Comer aquí): calcula el cargo que
  // se va a sumar al total (empaque en llevar/recoger, +domicilio solo en
  // domicilio) y muestra/oculta la dirección según haga falta. El total
  // final SIEMPRE lo recalcula el servidor (place-order.php) -- esto es
  // solo la vista previa para que el cliente sepa cuánto va a pagar.
  function calcularCargoEntrega(tipoEntrega) {
    if (!takeoutConfig.enabled || tipoEntrega === 'comer_aqui') return 0;
    const cantidadPlatos = cartData.reduce((sum, i) => sum + i.cantidad, 0);
    const empaque = (takeoutConfig.fee || 0) * cantidadPlatos;
    const domicilio = tipoEntrega === 'domicilio' ? (takeoutConfig.domicilioFee || 0) : 0;
    return empaque + domicilio;
  }
  function actualizarResumenEntrega() {
    const tipoEntrega = document.getElementById('checkout-tipo-entrega')?.value || 'domicilio';
    document.getElementById('checkout-direccion-group').classList.toggle('hidden', tipoEntrega !== 'domicilio');
    document.getElementById('checkout-direccion').required = tipoEntrega === 'domicilio';
    const subtotal = cartData.reduce((sum, i) => sum + i.price * i.cantidad, 0);
    const cargo = calcularCargoEntrega(tipoEntrega);
    const preview = document.getElementById('checkout-total-preview');
    if (preview) {
      preview.textContent = cargo > 0
        ? `Subtotal ${formatCurrency(subtotal)} + ${formatCurrency(cargo)} de entrega = ${formatCurrency(subtotal + cargo)}`
        : `Total: ${formatCurrency(subtotal)}`;
    }
  }
  document.getElementById('checkout-tipo-entrega').addEventListener('change', actualizarResumenEntrega);

  document.getElementById('cart-mini-badge').addEventListener('click', () => { cartExpanded = true; renderCart(); });
  document.getElementById('cart-toggle-btn').addEventListener('click', () => { cartExpanded = false; renderCart(); });
  document.getElementById('cart-checkout-btn').addEventListener('click', () => {
    if (cartData.length === 0) return;
    document.getElementById('checkout-error-msg').textContent = '';
    document.getElementById('checkout-modal').classList.remove('hidden');
    actualizarResumenEntrega();
  });
  document.getElementById('close-checkout-modal-btn').addEventListener('click', () => document.getElementById('checkout-modal').classList.add('hidden'));
  document.getElementById('order-confirmed-close-btn').addEventListener('click', () => document.getElementById('order-confirmed-modal').classList.add('hidden'));

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!estaAbiertoAhora()) { alert("Estamos cerrados ahora mismo, no se pueden hacer pedidos."); return; }
    const day = document.getElementById('public-day-select').value;
    const tipoEntrega = document.getElementById('checkout-tipo-entrega').value;
    const payload = {
      day,
      tipoEntrega,
      cliente: {
        nombre: document.getElementById('checkout-nombre').value.trim(),
        direccion: tipoEntrega === 'domicilio' ? document.getElementById('checkout-direccion').value.trim() : '',
        telefono: document.getElementById('checkout-telefono').value.trim(),
        nota: document.getElementById('checkout-nota').value.trim()
      },
      canal: 'pagina',
      metodoPago: document.getElementById('checkout-metodo-pago').value,
      menuMode,
      items: cartData.map(i => ({ dishId: i.dishId, cantidad: i.cantidad }))
    };
    try {
      const res = await fetch('api/place-order.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!result.success) {
        document.getElementById('checkout-error-msg').textContent = result.error || 'No se pudo procesar el pedido.';
        await loadAllData();
        renderPublicMenu();
        return;
      }
      document.getElementById('checkout-modal').classList.add('hidden');
      document.getElementById('checkout-form').reset();
      cartData = [];
      renderCart();
      document.getElementById('order-confirmed-msg').textContent = `Tu pedido #${result.orderId} por ${formatCurrency(result.total)} fue recibido. Te lo llevamos pronto.`;
      document.getElementById('order-confirmed-modal').classList.remove('hidden');
      await loadAllData();
      renderPublicMenu();
    } catch (err) {
      document.getElementById('checkout-error-msg').textContent = 'No se pudo conectar con el servidor.';
    }
  });

  // ── Panel admin: Pedidos ────────────────────────────────────────────────
  function loadNotifyConfigFields() {
    document.getElementById('notify-owner-email-input').value = notifyConfig.ownerEmail || '';
    loadConfigStatus();
  }
  document.getElementById('notify-config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // La API Key de Resend ya NO se maneja aquí -- vive como variable de
    // entorno RESEND_API_KEY en el hosting. Solo se guarda el correo.
    notifyConfig.ownerEmail = document.getElementById('notify-owner-email-input').value.trim();
    await saveAllData();
    alert('Correo guardado');
  });
  window.toggleOrderEstado = async (id) => {
    const o = ordersData.find(x => x.id === id);
    if (!o) return;
    o.estado = o.estado === 'entregado' ? 'pendiente' : 'entregado';
    await saveAllData();
    renderOrdersSection();
  };
  window.deleteOrder = async (id) => {
    const o = ordersData.find(x => x.id === id);
    if (!o) return;
    if (!confirm(`¿Borrar el pedido #${id} de ${o.cliente.nombre}? Esto no se puede deshacer.`)) return;
    ordersData = ordersData.filter(x => x.id !== id);
    await saveAllData();
    renderOrdersSection();
  };
  const TIPO_ENTREGA_LABEL = { domicilio: 'A domicilio', recoger: 'Para recoger', comer_aqui: 'Comer aquí' };
  function renderOrdersSection() {
    const list = document.getElementById('orders-management-list');
    if (ordersData.length === 0) { list.innerHTML = '<p class="text-muted">Sin pedidos todavía.</p>'; return; }
    const ordenados = [...ordersData].sort((a, b) => b.createdAt - a.createdAt);
    list.innerHTML = ordenados.map(o => `<div class="preview-category">
      <div class="preview-category-header">
        <h4>#${o.id} — ${o.cliente.nombre} — ${formatCurrency(o.total)} <span class="${o.estado === 'entregado' ? 'badge-stock' : 'badge-soldout'}">${o.estado}</span></h4>
        <div style="display:flex;gap:0.4rem;">
          <button class="btn-primary-sm" onclick="toggleOrderEstado(${o.id})">${o.estado === 'entregado' ? 'Marcar pendiente' : 'Marcar entregado'}</button>
          <button class="btn-danger-sm" onclick="deleteOrder(${o.id})">Borrar</button>
        </div>
      </div>
      <p class="text-muted">${TIPO_ENTREGA_LABEL[o.tipoEntrega] || o.tipoEntrega || ''} · Tel: ${o.cliente.telefono}${o.cliente.direccion ? ' · Dir: ' + o.cliente.direccion : ''}${o.cliente.nota ? ' · Nota: ' + o.cliente.nota : ''}</p>
      <div>${o.items.map(it => `<div class="preview-dish-item"><div>• ${it.cantidad} x ${it.name} — ${formatCurrency(it.precioUnitario * it.cantidad)}</div></div>`).join('')}</div>
    </div>`).join('');
  }

  // La página carga mostrando directamente el menú de HOY -- el selector de
  // día sigue abierto y funcional para que el cliente consulte cualquier
  // otro día cuando quiera (cambiarlo dispara renderPublicMenu normal).
  document.getElementById('public-day-select').value = nombreDiaHoy();
  renderPublicMenu();

  // La página se actualiza sola cada 20s (sin recargar) -- así nadie termina
  // pidiendo algo que otro cliente ya agotó mientras la tenía abierta. Solo
  // refresca la vista pública (el carrito y el panel del dueño no se tocan).
  setInterval(async () => {
    if (!document.getElementById('menu-view').classList.contains('hidden')) {
      await loadAllData();
      renderPublicMenu();
    }
  }, 20000);
});