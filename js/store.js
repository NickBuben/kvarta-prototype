// Хранилище прототипа. Сервера нет: состояние живёт в localStorage браузера,
// поэтому заявки сохраняются между перезагрузками страницы.

const STORE_KEY = 'kvarta-prototype-v1';

function initialState() {
  return {
    role: 'client',        // 'client' — кабинет предпринимателя, 'staff' — рабочее место андеррайтера
    clientId: null,        // под каким тестовым клиентом выполнен вход
    view: { name: 'home' },
    apps: [],              // все заявки, включая черновики
    seq: 1,                // счётчик для номеров заявок
    sms: null,             // последний отправленный код подписи { appId, code }
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...initialState(), ...JSON.parse(raw) } : initialState();
  } catch (e) {
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function resetState() {
  state = initialState();
  saveState();
}

function company(id) {
  return COMPANIES.find(c => c.id === id);
}

function findApp(id) {
  return state.apps.find(a => a.id === id);
}

// Запись в журнал заявки (FR-19): что произошло, когда и по какому требованию.
function addLog(app, text, fr) {
  app.log.push({ at: new Date().toISOString(), text, fr: fr || '' });
}
