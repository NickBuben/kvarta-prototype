// Движок рассмотрения заявки (UC-02). Запускается после регистрации заявки
// и проходит шаги: обязательные списки → БКИ и ФНС → скоринг → маршрутизация.
// Внешние сервисы — заглушки: ответы берутся из тестовых данных компании.

const STEP_DELAY_MS = 1500; // пауза между шагами, чтобы на демо было видно процесс

// Регистрация отправленной заявки (FR-09): номер, статус «получена», SMS клиенту.
function registerApp(app) {
  app.number = 'КВ-2026-' + String(state.seq++).padStart(6, '0');
  app.status = 'received';
  app.submittedAt = new Date().toISOString();
  addLog(app, 'Заявка подписана и зарегистрирована под номером ' + app.number, 'FR-08, FR-09');
  notifyClient(app, 'Заявка ' + app.number + ' получена. Статус можно смотреть в личном кабинете.');
  next(app, 'sanctions');
}

// Один шаг обработки. В заявке хранится следующий шаг, который ещё не выполнен,
// и время его запуска. Шаг выполняется целиком и сразу записывает следующий,
// поэтому после перезагрузки страницы ни один шаг не повторяется и не теряется.
function runStage(appId, stage) {
  const app = findApp(appId);
  if (!app || app.stage !== stage || !['received', 'checking'].includes(app.status)) return;
  const c = company(app.clientId);

  if (stage === 'sanctions') {
    setStatus(app, 'checking');
    if (c.sanctions) {
      app.checks.sanctions = 'Совпадение с обязательным списком';
      addLog(app, 'Проверка по санкционным и обязательным спискам: найдено совпадение', 'FR-30');
      app.status = 'compliance';
      app.transferReason = 'Совпадение с обязательным списком';
      addLog(app, 'Автоматическое решение запрещено, заявка передана на ручную проверку комплаенса', 'FR-31');
      return finish(app);
    }
    app.checks.sanctions = 'Совпадений нет';
    addLog(app, 'Проверка по санкционным и обязательным спискам: совпадений нет', 'FR-30');
    return next(app, 'sources');
  }

  if (stage === 'sources') {
    app.checks.fns = c.fns.taxDebt > 0
      ? 'Задолженность перед бюджетом ' + money(c.fns.taxDebt)
      : 'Задолженности нет';
    addLog(app, 'Ответ ФНС получен: ' + app.checks.fns.toLowerCase(), 'FR-15');
    if (c.bkiNoResponse) {
      app.checks.bki = 'Нет ответа';
      addLog(app, 'Запрос в БКИ отправлен, ждём ответ не дольше ' + RULES.bkiTimeoutSec + ' с', 'FR-15');
      return next(app, 'bkiTimeout', RULES.bkiTimeoutSec * 1000);
    }
    app.checks.bki = bkiText(c.bki);
    addLog(app, 'Ответ БКИ получен: ' + app.checks.bki.toLowerCase(), 'FR-15');
    return next(app, 'scoring');
  }

  if (stage === 'bkiTimeout') {
    addLog(app, 'БКИ не ответило за ' + RULES.bkiTimeoutSec + ' с — заявка передана андеррайтеру', 'FR-18');
    return toUnderwriter(app, 'Нет данных источника: БКИ не ответило');
  }

  if (stage === 'scoring') {
    const result = score(app, c);
    app.score = result;
    addLog(app, 'Скоринг по правилам версии ' + RULES.version + ': ' + result.total + ' баллов', 'FR-16');

    if (result.stopFactor) {
      addLog(app, 'Сработал стоп-фактор: ' + result.stopFactor.label, 'FR-17');
      return decide(app, { result: 'rejected', by: 'auto', reasonCode: result.stopFactor.code });
    }
    if (result.total >= RULES.approveFrom) {
      addLog(app, 'Оценка не ниже порога ' + RULES.approveFrom + ' — автоматическое одобрение', 'FR-17');
      return decide(app, { result: 'approved', by: 'auto' });
    }
    if (result.total < RULES.rejectBelow) {
      addLog(app, 'Оценка ниже порога ' + RULES.rejectBelow + ' — автоматический отказ', 'FR-17');
      return decide(app, { result: 'rejected', by: 'auto', reasonCode: 'LOW_SCORE' });
    }
    addLog(app, 'Оценка между порогами ' + RULES.rejectBelow + ' и ' + RULES.approveFrom + ' — нужен андеррайтер', 'FR-17');
    return toUnderwriter(app, 'Пограничная оценка: ' + result.total + ' баллов');
  }
}

// Запланировать следующий шаг: сначала записать его в заявку, потом запустить таймер.
function next(app, stage, delayMs = STEP_DELAY_MS) {
  app.stage = stage;
  app.stageDueAt = Date.now() + delayMs;
  saveState();
  render();
  setTimeout(() => runStage(app.id, stage), delayMs);
}

// Скоринговая модель: сумма баллов по трём факторам и проверка стоп-факторов.
// Каждое слагаемое сохраняется, чтобы андеррайтер видел, из чего сложилась оценка.
function score(app, c) {
  const parts = [];
  const historyPoints = { good: 200, average: 60, bad: -150 }[c.bki.history];
  parts.push({ label: 'Кредитная история: ' + historyLabel(c.bki.history), points: historyPoints });

  const years = yearsSince(c.regDate);
  const yearsPoints = years >= 3 ? 80 : years >= 1 ? 30 : -50;
  parts.push({ label: 'Срок работы бизнеса: ' + years.toFixed(1).replace('.', ',') + ' г.', points: yearsPoints });

  const monthlyRevenue = c.revenue12m / 12;
  const load = app.amount / monthlyRevenue; // сколько месяцев выручки составляет кредит
  const loadPoints = load <= 2 ? 100 : load <= 4 ? 30 : -100;
  parts.push({ label: 'Сумма кредита = ' + load.toFixed(1).replace('.', ',') + ' мес. выручки', points: loadPoints });

  const base = 500;
  const total = base + parts.reduce((s, p) => s + p.points, 0);

  let stopFactor = null;
  if (c.fns.taxDebt > RULES.taxDebtLimit) stopFactor = { code: 'TAX_DEBT', label: 'долг перед бюджетом больше ' + money(RULES.taxDebtLimit) };
  else if (c.bki.overdue90) stopFactor = { code: 'BKI_OVERDUE', label: 'просрочка 90+ в кредитной истории' };

  return { base, parts, total, stopFactor, rulesVersion: RULES.version };
}

function toUnderwriter(app, reason) {
  app.status = 'underwriter';
  app.transferReason = reason;
  addLog(app, 'Заявка в очереди андеррайтера. Причина: ' + reason, 'FR-20');
  notifyClient(app, 'Заявку ' + app.number + ' рассматривает специалист банка. Решение — до ' + dateText(nextWorkday()) + '.');
  finish(app);
}

// Итоговое решение: автоматическое или андеррайтера. Пишется в журнал (FR-19)
// и сразу показывается клиенту с уведомлением (FR-11, FR-13).
function decide(app, decision) {
  if (decision.result === 'approved') {
    const rate = decision.by === 'auto' && app.score && app.score.total >= 850 ? 16.9 : 18.9;
    decision.rate = rate;
    decision.payment = annuity(app.amount, rate, app.term);
  }
  decision.at = new Date().toISOString();
  app.decision = decision;
  app.status = 'decided';
  const who = decision.by === 'auto' ? 'автоматически' : 'андеррайтером';
  const what = decision.result === 'approved' ? 'одобрена' : 'отклонена';
  addLog(app, 'Решение принято ' + who + ': заявка ' + what + ' (правила версии ' + RULES.version + ')', 'FR-19');
  notifyClient(app, 'По заявке ' + app.number + ' принято решение. Откройте личный кабинет.');
  finish(app);
}

function setStatus(app, status) {
  app.status = status;
  addLog(app, 'Статус заявки: «' + STATUS[status].label.toLowerCase() + '»', 'FR-10');
  notifyClient(app, 'Заявка ' + app.number + ': статус «' + STATUS[status].label.toLowerCase() + '».');
}

function finish(app) {
  app.stage = null;
  app.stageDueAt = null;
  saveState();
  render();
}

// После перезагрузки страницы продолжаем незавершённые шаги с того места,
// где остановились. Ожидание ответа БКИ не начинается заново: ждём только остаток.
function resumeProcessing() {
  state.apps
    .filter(a => ['received', 'checking'].includes(a.status) && a.stage)
    .forEach(a => {
      const left = a.stageDueAt ? a.stageDueAt - Date.now() : STEP_DELAY_MS;
      setTimeout(() => runStage(a.id, a.stage), Math.max(left, 500));
    });
}

// --- вспомогательные функции ---

function annuity(amount, ratePct, months) {
  const r = ratePct / 100 / 12;
  return Math.round(amount * r / (1 - Math.pow(1 + r, -months)));
}

function yearsSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (365.25 * 24 * 3600 * 1000);
}

function historyLabel(h) {
  return { good: 'хорошая', average: 'средняя', bad: 'плохая' }[h];
}

function bkiText(bki) {
  return 'Кредитная история ' + historyLabel(bki.history) + (bki.overdue90 ? ', есть просрочка 90+' : ', просрочек 90+ нет');
}

function nextWorkday(from) {
  const d = from ? new Date(from) : new Date();
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}
