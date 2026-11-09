// Интерфейс прототипа: кабинет предпринимателя (UC-01) и рабочее место андеррайтера (UC-02).
// Экран целиком перерисовывается функцией render() из текущего состояния state.
// Кнопки помечены атрибутом data-act, поля формы — data-field.

const root = document.getElementById('app');

// ---------- форматирование ----------

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
}
function dateText(d) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function timeText(d) {
  return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
function fileSize(bytes) {
  return bytes < 1024 * 1024
    ? Math.max(1, Math.round(bytes / 1024)) + ' КБ'
    : (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// ---------- уведомления (FR-11) ----------
// В прототипе SMS показывается всплывающим сообщением в углу экрана.

function notifyClient(app, text) {
  app.notifications = app.notifications || [];
  app.notifications.push({ at: new Date().toISOString(), text });
  toast('SMS на ' + company(app.clientId).phone, text);
}

function toast(title, text, sticky) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (sticky ? ' sticky' : '');
  el.innerHTML = '<div class="toast-title">' + esc(title) + '</div><div>' + esc(text) + '</div>';
  box.appendChild(el);
  if (!sticky) {
    setTimeout(() => el.classList.add('hide'), 5000);
    setTimeout(() => el.remove(), 5600);
  }
}

function closeStickyToasts() {
  document.querySelectorAll('.toast.sticky').forEach(el => el.remove());
}

// ---------- навигация ----------

function go(name, params) {
  state.view = { name, ...(params || {}) };
  saveState();
  render();
  window.scrollTo(0, 0);
}

function render() {
  root.innerHTML = header() + '<main class="container">' + page() + '</main>';
}

function page() {
  const v = state.view;
  if (state.role === 'staff') {
    return v.name === 'case' ? staffCase(findApp(v.appId)) : staffQueue(v.tab || 'underwriter');
  }
  if (!state.clientId) return loginPage();
  if (v.name === 'wizard') return wizardPage(findApp(v.appId));
  if (v.name === 'app') return appPage(findApp(v.appId));
  return homePage();
}

// Знак банка: квадрат из четырёх частей, одна «четверть» закрашена — отсылка к названию «Кварта».
const LOGO = `<svg class="logo-mark" viewBox="0 0 30 30" aria-hidden="true">
  <rect x="1" y="1" width="13" height="13" rx="3" fill="#E9A23B"/>
  <rect x="17" y="2" width="11" height="11" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/>
  <rect x="2" y="17" width="11" height="11" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/>
  <rect x="17" y="17" width="11" height="11" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/>
</svg>`;

function header() {
  const c = state.clientId && company(state.clientId);
  return `
  <header class="topbar"><div class="container topbar-inner">
    <div class="logo" data-act="home">${LOGO}<span>Кварта</span><span class="logo-sub">Бизнес</span></div>
    <nav class="roles">
      <button class="role ${state.role === 'client' ? 'active' : ''}" data-act="role" data-role="client">Кабинет клиента</button>
      <button class="role ${state.role === 'staff' ? 'active' : ''}" data-act="role" data-role="staff">Андеррайтер банка</button>
    </nav>
    <div class="topbar-right">
      ${state.role === 'client' && c ? `<span class="who">${esc(c.name)}</span><button class="link" data-act="logout">Выйти</button>` : ''}
      <button class="link muted" data-act="reset">Сбросить демо</button>
    </div>
  </div></header>`;
}

// ---------- кабинет клиента ----------

function loginPage() {
  return `
  <section class="hero">
    <h1>Вход в интернет-банк для бизнеса</h1>
    <p class="muted">Демо-вход: выберите тестового клиента. Каждый показывает свой путь заявки.</p>
  </section>
  <div class="grid3">
    ${COMPANIES.map(c => `
      <button class="card company" data-act="login" data-id="${c.id}">
        <div class="company-name">${esc(c.name)}</div>
        <div class="muted small">ИНН ${c.inn}</div>
        <div class="tag">${esc(c.scenario)}</div>
      </button>`).join('')}
  </div>`;
}

function homePage() {
  const mine = state.apps.filter(a => a.clientId === state.clientId).slice().reverse();
  return `
  <section class="hero"><h1>Кредиты для бизнеса</h1>
    <p class="muted">Заявка онлайн за 15 минут, решение — в течение рабочего дня</p></section>
  <div class="grid3">
    ${PRODUCTS.map(p => `
      <div class="card product ${p.available ? '' : 'disabled'}">
        <div class="product-name">${esc(p.name)}</div>
        <div class="muted small">${esc(p.note)}</div>
        ${p.available
          ? `<div class="product-terms">до ${money(p.max)} · до ${p.terms[p.terms.length - 1]} мес.</div>
             <button class="btn" data-act="new" data-product="${p.id}">Оформить заявку</button>`
          : '<div class="tag gray">Скоро</div>'}
      </div>`).join('')}
  </div>
  <h2>Мои заявки</h2>
  ${mine.length ? `<div class="card list">${mine.map(appRow).join('')}</div>`
    : '<div class="card empty muted">Заявок пока нет</div>'}`;
}

function appRow(a) {
  const st = STATUS[a.status];
  const title = a.number || 'Черновик от ' + dateText(a.createdAt);
  return `
  <button class="row" data-act="${a.status === 'draft' ? 'continue' : 'open'}" data-id="${a.id}">
    <div><div class="row-title">${esc(title)}</div>
      <div class="muted small">${esc(productName(a.productId))} · ${money(a.amount)} · ${a.term} мес.</div></div>
    <span class="pill ${st.tone}">${st.label}</span>
  </button>`;
}

function productName(id) {
  return PRODUCTS.find(p => p.id === id).name;
}

// Новая заявка: проверяем дубли (FR-40) и незаконченный черновик (UC-01, А2).
function newApp(productId) {
  const mine = state.apps.filter(a => a.clientId === state.clientId && a.productId === productId);
  const active = mine.find(a => ['received', 'checking', 'underwriter', 'compliance'].includes(a.status));
  if (active) {
    toast('Заявка уже есть', 'У вас уже есть активная заявка ' + active.number + ' на этот продукт. Открываем её.');
    return go('app', { appId: active.id });
  }
  const draft = mine.find(a => a.status === 'draft');
  if (draft) {
    toast('Черновик сохранён', 'Продолжаем заполнение с того места, где вы остановились.');
    return go('wizard', { appId: draft.id });
  }
  const c = company(state.clientId);
  // FR-01: черновик с уникальным номером; FR-02: данные клиента подставляются из АБС.
  const app = {
    id: 'a' + Date.now(), clientId: c.id, productId, status: 'draft', step: 1,
    amount: c.defaultAmount, term: 12, purpose: PURPOSES[0],
    form: { name: c.name, inn: c.inn, ogrn: c.ogrn, address: c.address, okved: c.okved,
      director: c.director, revenue12m: c.revenue12m, phone: c.phone, email: c.email },
    docs: {}, consents: { pd: false, bki: false },
    checks: {}, log: [], createdAt: new Date().toISOString(),
  };
  addLog(app, 'Создан черновик заявки, данные клиента подставлены из АБС', 'FR-01, FR-02');
  state.apps.push(app);
  go('wizard', { appId: app.id });
}

// ---------- мастер заявки (UC-01) ----------

const STEPS = ['Условия', 'Данные компании', 'Документы', 'Отправка'];

function wizardPage(app) {
  const p = PRODUCTS.find(x => x.id === app.productId);
  return `
  <div class="wizard-head">
    <button class="link" data-act="home">← Мои заявки</button>
    <h1>${esc(p.name)}</h1>
    <div class="steps">${STEPS.map((s, i) => `
      <div class="step ${i + 1 < app.step ? 'done' : ''} ${i + 1 === app.step ? 'current' : ''}">
        <div class="step-bar"></div><div class="small">${s}</div></div>`).join('')}</div>
    <div class="muted small saved">Черновик сохраняется автоматически</div>
  </div>
  <div class="card form">${[stepTerms, stepCompany, stepDocs, stepSubmit][app.step - 1](app, p)}</div>`;
}

function stepTerms(app, p) {
  return `
  <h2>Сколько и на какой срок</h2>
  <label class="field"><span>Сумма кредита, ₽</span>
    <input data-field="amount" inputmode="numeric" value="${new Intl.NumberFormat('ru-RU').format(app.amount)}">
    <small class="muted">От ${money(p.min)} до ${money(p.max)}</small>
    ${app.errors && app.errors.amount ? `<small class="error">${app.errors.amount}</small>` : ''}</label>
  <div class="chips">${p.terms.map(t => `<button class="chip ${app.term === t ? 'active' : ''}" data-act="term" data-term="${t}">${t} мес.</button>`).join('')}</div>
  <label class="field"><span>Цель кредита</span>
    <select data-field="purpose">${PURPOSES.map(x => `<option ${x === app.purpose ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  <div class="actions"><button class="btn" data-act="next">Продолжить</button></div>`;
}

function stepCompany(app) {
  const f = app.form;
  const ro = (label, value) => `<div class="ro"><span class="muted small">${label}</span><div>${esc(value)}</div></div>`;
  return `
  <h2>Данные компании</h2>
  <p class="muted">Мы заполнили анкету по данным банка. Проверьте их и при необходимости поправьте контакты.</p>
  <div class="badge-abs">Заполнено из АБС</div>
  <div class="ro-grid">
    ${ro('Компания', f.name)}${ro('ИНН', f.inn)}${ro('ОГРН', f.ogrn)}${ro('Руководитель', f.director)}
    ${ro('Адрес', f.address)}${ro('Основной вид деятельности', f.okved)}${ro('Обороты по счёту за 12 месяцев', money(f.revenue12m))}
  </div>
  <div class="two">
    <label class="field"><span>Телефон для SMS</span><input data-field="phone" value="${esc(f.phone)}"></label>
    <label class="field"><span>Электронная почта</span><input data-field="email" value="${esc(f.email)}"></label>
  </div>
  <div class="actions"><button class="btn secondary" data-act="back">Назад</button><button class="btn" data-act="next">Продолжить</button></div>`;
}

function stepDocs(app) {
  return `
  <h2>Документы</h2>
  <p class="muted">PDF, JPG или PNG до ${MAX_FILE_MB} МБ. Фото с телефона подойдёт, если текст хорошо читается.</p>
  ${DOC_TYPES.map(t => {
    const d = app.docs[t.id];
    return `
    <div class="doc ${d ? (d.ok ? 'ok' : 'bad') : ''}">
      <div><div class="doc-name">${esc(t.name)} ${t.required ? '' : '<span class="muted small">— по желанию</span>'}</div>
        <div class="muted small">${d ? esc(d.name) + ' · ' + fileSize(d.size) : esc(t.hint)}</div>
        ${d && !d.ok ? `<div class="error small">${esc(d.error)}</div>` : ''}</div>
      <label class="btn secondary small-btn">${d ? 'Заменить' : 'Загрузить'}
        <input type="file" hidden data-upload="${t.id}" accept=".pdf,.jpg,.jpeg,.png"></label>
    </div>`; }).join('')}
  <div class="actions"><button class="btn secondary" data-act="back">Назад</button><button class="btn" data-act="next">Продолжить</button></div>`;
}

// FR-03: формат и размер файла; FR-04: проверка читаемости.
// Читаемость в прототипе — заглушка распознавания: слишком лёгкое фото считаем нечитаемым.
function checkFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return 'Этот формат не подходит. Загрузите PDF, JPG или PNG.';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return 'Файл больше ' + MAX_FILE_MB + ' МБ. Сожмите его или загрузите по частям.';
  if (ext !== 'pdf' && file.size < 30 * 1024) return 'Документ плохо читается. Сфотографируйте его ещё раз при хорошем освещении.';
  return null;
}

function stepSubmit(app) {
  const missing = app.missing || [];
  return `
  <h2>Проверьте и отправьте заявку</h2>
  <div class="summary">
    <div><span class="muted small">Сумма</span><div class="big">${money(app.amount)}</div></div>
    <div><span class="muted small">Срок</span><div class="big">${app.term} мес.</div></div>
    <div><span class="muted small">Цель</span><div>${esc(app.purpose)}</div></div>
  </div>
  <label class="check"><input type="checkbox" data-consent="pd" ${app.consents.pd ? 'checked' : ''}>
    <span>Даю согласие на обработку персональных данных</span></label>
  <label class="check"><input type="checkbox" data-consent="bki" ${app.consents.bki ? 'checked' : ''}>
    <span>Даю согласие на запрос моей кредитной истории в бюро кредитных историй</span></label>
  ${missing.length ? `<div class="alert"><b>Чтобы отправить заявку, не хватает:</b><ul>${missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
  <div class="actions"><button class="btn secondary" data-act="back">Назад</button>
    <button class="btn" data-act="sign">Подписать и отправить</button></div>
  ${app.signing ? signModal(app) : ''}`;
}

// FR-05 и FR-28: без обязательных документов и согласий заявку отправить нельзя.
function missingItems(app) {
  const m = [];
  DOC_TYPES.filter(t => t.required).forEach(t => {
    const d = app.docs[t.id];
    if (!d) m.push('документ «' + t.name + '»');
    else if (!d.ok) m.push('исправленный документ «' + t.name + '»');
  });
  if (!app.consents.pd) m.push('согласие на обработку персональных данных');
  if (!app.consents.bki) m.push('согласие на запрос в бюро кредитных историй');
  if (!app.form.phone.trim()) m.push('телефон для SMS');
  return m;
}

// FR-08: подписание простой электронной подписью — кодом из SMS.
function signModal(app) {
  return `
  <div class="modal-bg"><div class="modal card">
    <h2>Подпишите заявку</h2>
    <p class="muted">Мы отправили код на номер ${esc(app.form.phone)}</p>
    <input class="code" data-field="code" maxlength="4" inputmode="numeric" placeholder="____" autofocus>
    ${app.signError ? `<div class="error">${esc(app.signError)}</div>` : ''}
    <div class="actions"><button class="btn secondary" data-act="cancelSign">Отмена</button>
      <button class="btn" data-act="confirmSign">Подписать</button></div>
  </div></div>`;
}

// ---------- карточка заявки у клиента (статус и решение) ----------

function appPage(app) {
  const s = app.status;
  const stage = s === 'received' ? 1 : s === 'decided' ? 4 : 2;
  const expected = s === 'underwriter'
    ? 'до конца дня ' + dateText(nextWorkday(app.submittedAt))
    : 'в течение нескольких минут';
  return `
  <button class="link" data-act="home">← Мои заявки</button>
  <div class="app-head"><h1>Заявка ${esc(app.number)}</h1><span class="pill ${STATUS[s].tone}">${STATUS[s].label}</span></div>
  <div class="muted">${esc(productName(app.productId))} · ${money(app.amount)} · ${app.term} мес.</div>
  <div class="card">
    <div class="timeline">
      ${['Получена', 'На проверке', 'Решение принято'].map((t, i) => `
        <div class="tl ${i + 1 < stage ? 'done' : ''} ${i + 1 === stage ? 'current' : ''}"><div class="tl-dot"></div><div>${t}</div></div>`).join('')}
    </div>
    ${s === 'checking' ? `<p class="progress"><span class="spinner"></span>${esc(stageText(app))}</p>` : ''}
    ${s !== 'decided' ? `<p class="expected">Ожидаемый срок решения: <b>${expected}</b></p>` : ''}
  </div>
  ${s === 'decided' ? decisionCard(app) : ''}
  <h2>Уведомления</h2>
  <div class="card list">${(app.notifications || []).slice().reverse().map(n => `
    <div class="note"><span class="muted small">${timeText(n.at)}</span><div>${esc(n.text)}</div></div>`).join('')}</div>`;
}

// Что клиент видит, пока система проверяет заявку.
function stageText(app) {
  return {
    sanctions: 'Проверяем данные компании',
    sources: 'Запрашиваем данные в бюро кредитных историй и налоговой',
    scoring: 'Оцениваем заявку',
  }[app.stage] || 'Проверяем заявку';
}

function decisionCard(app) {
  const d = app.decision;
  if (d.result === 'approved') {
    return `
    <div class="card decision ok">
      <h2>Кредит одобрен</h2>
      <div class="summary">
        <div><span class="muted small">Сумма</span><div class="big">${money(app.amount)}</div></div>
        <div><span class="muted small">Ставка</span><div class="big">${String(d.rate).replace('.', ',')}%</div></div>
        <div><span class="muted small">Платёж в месяц</span><div class="big">${money(d.payment)}</div></div>
      </div>
      <p class="muted">Менеджер свяжется с вами, чтобы договориться о подписании договора.</p>
    </div>`;
  }
  return `
  <div class="card decision bad">
    <h2>К сожалению, банк не может выдать кредит</h2>
    <p>${esc(REJECT_REASONS[d.reasonCode])}</p>
  </div>`;
}

// ---------- рабочее место андеррайтера ----------

function staffQueue(tab) {
  const groups = {
    underwriter: state.apps.filter(a => a.status === 'underwriter'),
    compliance: state.apps.filter(a => a.status === 'compliance'),
    all: state.apps.filter(a => a.status !== 'draft'),
  };
  const list = groups[tab].slice().reverse();
  const tabBtn = (id, label) => `<button class="tab ${tab === id ? 'active' : ''}" data-act="tab" data-tab="${id}">${label} <span class="count">${groups[id].length}</span></button>`;
  return `
  <section class="hero"><h1>Заявки на кредит</h1></section>
  <div class="tabs">${tabBtn('underwriter', 'Очередь андеррайтера')}${tabBtn('compliance', 'Проверка комплаенса')}${tabBtn('all', 'Все заявки')}</div>
  ${list.length ? `<div class="card list">${list.map(a => `
    <button class="row" data-act="case" data-id="${a.id}">
      <div><div class="row-title">${esc(a.number)} · ${esc(company(a.clientId).name)}</div>
        <div class="muted small">${money(a.amount)} · ${a.term} мес. · подана в ${timeText(a.submittedAt)}</div>
        ${a.transferReason && a.status !== 'decided' ? `<div class="reason">${esc(a.transferReason)}</div>` : ''}</div>
      <span class="pill ${staffTone(a)}">${staffStatus(a)}</span>
    </button>`).join('')}</div>`
    : '<div class="card empty muted">Здесь пока пусто. Подайте заявку в кабинете клиента.</div>'}`;
}

// Андеррайтер видит более точный статус, чем клиент.
function staffStatus(a) {
  if (a.status === 'underwriter') return 'Ждёт андеррайтера';
  if (a.status === 'compliance') return 'У комплаенса';
  if (a.status === 'decided') return (a.decision.result === 'approved' ? 'Одобрена' : 'Отказ') + (a.decision.by === 'auto' ? ' · авто' : '');
  return 'Обработка';
}
function staffTone(a) {
  if (a.status === 'decided') return a.decision.result === 'approved' ? 'green' : 'red';
  return a.status === 'underwriter' || a.status === 'compliance' ? 'yellow' : 'blue';
}

function staffCase(app) {
  const c = company(app.clientId);
  const sc = app.score;
  return `
  <button class="link" data-act="tab" data-tab="underwriter">← К очереди</button>
  <div class="app-head"><h1>${esc(app.number)} · ${esc(c.name)}</h1><span class="pill ${staffTone(app)}">${staffStatus(app)}</span></div>
  ${app.transferReason ? `<div class="alert">Причина передачи: <b>${esc(app.transferReason)}</b></div>` : ''}
  <div class="case-grid">
    <div class="card">
      <h3>Заявка</h3>
      <dl>
        <dt>Сумма и срок</dt><dd>${money(app.amount)} на ${app.term} мес.</dd>
        <dt>Цель</dt><dd>${esc(app.purpose)}</dd>
        <dt>ИНН</dt><dd>${c.inn}</dd>
        <dt>Обороты за 12 мес.</dt><dd>${money(c.revenue12m)}</dd>
        <dt>Документы</dt><dd>${Object.values(app.docs).filter(d => d.ok).map(d => esc(d.name)).join('<br>') || '—'}</dd>
      </dl>
      <h3>Проверки</h3>
      <dl>
        <dt>Обязательные списки</dt><dd>${esc(app.checks.sanctions || '—')}</dd>
        <dt>ФНС</dt><dd>${esc(app.checks.fns || '—')}</dd>
        <dt>БКИ</dt><dd>${esc(app.checks.bki || '—')}</dd>
      </dl>
      ${sc ? `<h3>Скоринг · правила версии ${sc.rulesVersion}</h3>
      <table class="score"><tr><td>Базовая оценка</td><td>${sc.base}</td></tr>
        ${sc.parts.map(p => `<tr><td>${esc(p.label)}</td><td>${p.points > 0 ? '+' : ''}${p.points}</td></tr>`).join('')}
        <tr class="total"><td>Итого</td><td>${sc.total}</td></tr></table>
      <div class="muted small">Одобрение от ${RULES.approveFrom}, отказ ниже ${RULES.rejectBelow}</div>` : ''}
    </div>
    <div>
      ${app.status === 'underwriter' ? decisionForm(app) : ''}
      ${app.status === 'decided' ? `<div class="card"><h3>Решение</h3><p>${app.decision.result === 'approved' ? 'Одобрено' : 'Отказ'} ·
        ${app.decision.by === 'auto' ? 'автоматически' : 'андеррайтером'}</p>
        ${app.decision.comment ? `<p class="muted">Комментарий: ${esc(app.decision.comment)}</p>` : ''}</div>` : ''}
      ${app.status === 'compliance' ? '<div class="card"><h3>Проверка комплаенса</h3><p class="muted">Решение по заявке принимает сотрудник комплаенса. Его рабочее место не входит в этот прототип.</p></div>' : ''}
      <div class="card"><h3>Журнал заявки</h3>
        <div class="log">${app.log.map(l => `<div class="log-row"><span class="muted small">${timeText(l.at)}</span>
          <span>${esc(l.text)}</span>${l.fr ? `<span class="fr">${l.fr}</span>` : ''}</div>`).join('')}</div></div>
    </div>
  </div>`;
}

// FR-21: решение андеррайтера сохраняется только с комментарием.
function decisionForm(app) {
  const f = app.uwForm || { result: 'approved', reasonCode: 'UW_FINANCE', comment: '' };
  return `
  <div class="card">
    <h3>Решение андеррайтера</h3>
    <div class="chips">
      <button class="chip ${f.result === 'approved' ? 'active' : ''}" data-act="uwResult" data-result="approved">Одобрить</button>
      <button class="chip ${f.result === 'rejected' ? 'active' : ''}" data-act="uwResult" data-result="rejected">Отказать</button>
    </div>
    ${f.result === 'rejected' ? `<label class="field"><span>Причина для клиента</span>
      <select data-uw="reasonCode">${['UW_FINANCE', 'UW_DOCS', 'LOW_SCORE'].map(k => `<option value="${k}" ${f.reasonCode === k ? 'selected' : ''}>${esc(REASON_LABELS[k])}</option>`).join('')}</select>
      <small class="muted">Клиент увидит: «${esc(REJECT_REASONS[f.reasonCode])}»</small></label>` : ''}
    <label class="field"><span>Комментарий с обоснованием</span>
      <textarea data-uw="comment" rows="3" class="${app.uwError ? 'invalid' : ''}">${esc(f.comment)}</textarea>
      ${app.uwError ? `<small class="error">${esc(app.uwError)}</small>` : ''}</label>
    <button class="btn" data-act="uwSave">Сохранить решение</button>
  </div>`;
}

// ---------- обработка действий ----------

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const app = state.view.appId && findApp(state.view.appId);

  if (act === 'home') return go('home');
  if (act === 'role') { state.role = el.dataset.role; return go(state.role === 'staff' ? 'queue' : 'home'); }
  if (act === 'reset') { if (confirm('Удалить все демо-заявки?')) { resetState(); render(); } return; }
  if (act === 'login') { state.clientId = el.dataset.id; return go('home'); }
  if (act === 'logout') { state.clientId = null; return go('home'); }
  if (act === 'new') return newApp(el.dataset.product);
  if (act === 'continue') return go('wizard', { appId: el.dataset.id });
  if (act === 'open') return go('app', { appId: el.dataset.id });
  if (act === 'tab') return go('queue', { tab: el.dataset.tab });
  if (act === 'case') return go('case', { appId: el.dataset.id });

  if (act === 'term') { app.term = Number(el.dataset.term); saveState(); return render(); }
  if (act === 'back') { app.step--; saveState(); return render(); }
  if (act === 'next') {
    if (app.step === 1) {
      const p = PRODUCTS.find(x => x.id === app.productId);
      app.errors = {};
      if (!(app.amount >= p.min && app.amount <= p.max)) app.errors.amount = 'Укажите сумму от ' + money(p.min) + ' до ' + money(p.max);
      if (app.errors.amount) { saveState(); return render(); }
    }
    app.step++;
    saveState();
    return render();
  }
  if (act === 'sign') {
    app.missing = missingItems(app);
    if (app.missing.length) { saveState(); return render(); }
    state.sms = { appId: app.id, code: String(Math.floor(1000 + Math.random() * 9000)) };
    app.signing = true;
    app.signError = null;
    closeStickyToasts();
    toast('SMS на ' + app.form.phone, 'Код для подписания заявки: ' + state.sms.code, true);
    saveState();
    return render();
  }
  if (act === 'cancelSign') { app.signing = false; closeStickyToasts(); saveState(); return render(); }
  if (act === 'confirmSign') {
    const input = document.querySelector('[data-field="code"]');
    if (!state.sms || input.value.trim() !== state.sms.code) {
      app.signError = 'Код неверный. Заявка не отправлена, проверьте код и попробуйте ещё раз.';
      addLog(app, 'Введён неверный код подписи, заявка осталась черновиком', 'FR-08');
      saveState();
      return render();
    }
    app.signing = false;
    state.sms = null;
    closeStickyToasts();
    registerApp(app);
    return go('app', { appId: app.id });
  }

  if (act === 'uwResult') {
    app.uwForm = { ...(app.uwForm || { reasonCode: 'UW_FINANCE', comment: '' }), result: el.dataset.result };
    saveState();
    return render();
  }
  if (act === 'uwSave') {
    const f = app.uwForm || { result: 'approved', reasonCode: 'UW_FINANCE', comment: '' };
    if (!f.comment.trim()) {
      app.uwError = 'Без комментария решение не сохраняется. Опишите, почему принято такое решение.';
      saveState();
      return render();
    }
    app.uwError = null;
    addLog(app, 'Андеррайтер сохранил решение с комментарием', 'FR-21');
    decide(app, { result: f.result, by: 'underwriter', reasonCode: f.result === 'rejected' ? f.reasonCode : null, comment: f.comment.trim() });
    return;
  }
});

// Поля формы сохраняются при каждом изменении — это автосохранение черновика (FR-06).
document.addEventListener('input', e => {
  const app = state.view.appId && findApp(state.view.appId);
  if (!app) return;
  const field = e.target.dataset.field;
  if (field === 'amount') {
    app.amount = Number(e.target.value.replace(/\D/g, '')) || 0;
  } else if (field === 'phone' || field === 'email') {
    app.form[field] = e.target.value;
  } else if (e.target.dataset.uw) {
    app.uwForm = app.uwForm || { result: 'approved', reasonCode: 'UW_FINANCE', comment: '' };
    app.uwForm[e.target.dataset.uw] = e.target.value;
  }
  saveState();
});

document.addEventListener('change', e => {
  const app = state.view.appId && findApp(state.view.appId);
  if (!app) return;
  if (e.target.dataset.field === 'purpose') { app.purpose = e.target.value; saveState(); }
  if (e.target.dataset.uw === 'reasonCode') {
    app.uwForm = app.uwForm || { result: 'rejected', reasonCode: 'UW_FINANCE', comment: '' };
    app.uwForm.reasonCode = e.target.value;
    saveState();
    render();
  }
  if (e.target.dataset.consent) {
    app.consents[e.target.dataset.consent] = e.target.checked;
    const consentName = e.target.dataset.consent === 'pd' ? 'на обработку персональных данных' : 'на запрос в БКИ';
    addLog(app, (e.target.checked ? 'Дано согласие ' : 'Отозвано согласие ') + consentName, 'FR-28');
    if (app.missing && app.missing.length) app.missing = missingItems(app);
    saveState();
    render();
  }
  if (e.target.dataset.upload) {
    const file = e.target.files[0];
    if (!file) return;
    const error = checkFile(file);
    app.docs[e.target.dataset.upload] = { name: file.name, size: file.size, ok: !error, error };
    addLog(app, 'Загружен документ ' + file.name + (error ? ' — не принят: ' + error : ''), error ? 'FR-03, FR-04' : 'FR-03');
    saveState();
    render();
  }
});

render();
resumeProcessing();
