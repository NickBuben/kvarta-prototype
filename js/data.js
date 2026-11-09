// Справочные данные прототипа: тестовые компании (заглушки АБС, БКИ, ФНС),
// кредитные продукты, обязательные документы, правила скоринга и справочник причин отказа.

// Тестовые клиенты банка. Каждый ведёт к своему исходу процесса UC-02.
const COMPANIES = [
  {
    id: 'c1', name: 'ООО «Хлебный двор»', inn: '7801234567', ogrn: '1127847000123',
    director: 'Морозова Анна Сергеевна', phone: '+7 921 555-12-34', email: 'anna@hlebdvor.ru',
    address: 'г. Санкт-Петербург, ул. Садовая, д. 12', okved: '10.71 Производство хлеба и мучных изделий',
    regDate: '2019-03-14', revenue12m: 36000000, defaultAmount: 2000000,
    bki: { history: 'good', overdue90: false }, fns: { taxDebt: 0 },
    sanctions: false, bkiNoResponse: false,
    scenario: 'Автоматическое одобрение',
  },
  {
    id: 'c2', name: 'ИП Сидоров Павел Игоревич', inn: '781234567890', ogrn: '318784700012345',
    director: 'Сидоров Павел Игоревич', phone: '+7 911 222-33-44', email: 'sidorov.auto@mail.ru',
    address: 'г. Санкт-Петербург, пр. Энгельса, д. 87', okved: '45.20 Ремонт автотранспортных средств',
    regDate: '2018-06-01', revenue12m: 14000000, defaultAmount: 1000000,
    bki: { history: 'average', overdue90: false }, fns: { taxDebt: 184300 },
    sanctions: false, bkiNoResponse: false,
    scenario: 'Автоотказ: долг перед бюджетом',
  },
  {
    id: 'c3', name: 'ООО «Северный склад»', inn: '7814567890', ogrn: '1247800004567',
    director: 'Ершов Дмитрий Олегович', phone: '+7 931 700-45-45', email: 'info@sev-sklad.ru',
    address: 'Ленинградская обл., г. Мурино, ул. Шоссе в Лаврики, д. 5', okved: '52.10 Складирование и хранение',
    regDate: '2024-05-20', revenue12m: 24000000, defaultAmount: 5000000,
    bki: { history: 'average', overdue90: false }, fns: { taxDebt: 0 },
    sanctions: false, bkiNoResponse: false,
    scenario: 'Пограничная оценка → андеррайтер',
  },
  {
    id: 'c4', name: 'ИП Ковалёва Ольга Викторовна', inn: '780987654321', ogrn: '320784700098765',
    director: 'Ковалёва Ольга Викторовна', phone: '+7 952 123-98-76', email: 'flowers.kovaleva@ya.ru',
    address: 'г. Санкт-Петербург, ул. Рубинштейна, д. 3', okved: '47.76 Торговля цветами',
    regDate: '2020-09-10', revenue12m: 9000000, defaultAmount: 800000,
    bki: { history: 'good', overdue90: false }, fns: { taxDebt: 0 },
    sanctions: false, bkiNoResponse: true,
    scenario: 'БКИ не отвечает → андеррайтер',
  },
  {
    id: 'c5', name: 'ООО «Транзит-Логистик»', inn: '7820011223', ogrn: '1217800011223',
    director: 'Ахмедов Руслан Тимурович', phone: '+7 921 900-10-10', email: 'office@tranzit-log.ru',
    address: 'г. Санкт-Петербург, Митрофаньевское ш., д. 2', okved: '49.41 Грузовые перевозки',
    regDate: '2021-02-02', revenue12m: 30000000, defaultAmount: 3000000,
    bki: { history: 'good', overdue90: false }, fns: { taxDebt: 0 },
    sanctions: true, bkiNoResponse: false,
    scenario: 'Совпадение со списком → комплаенс',
  },
];

// Продукты. В MVP онлайн доступен только простой кредит (ПР1, инкремент 1).
const PRODUCTS = [
  { id: 'business', name: 'Кредит на развитие бизнеса', note: 'Без залога, на пополнение оборотных средств',
    min: 300000, max: 10000000, terms: [6, 12, 18, 24, 36], available: true },
  { id: 'pledge', name: 'Кредит под залог', note: 'Появится в следующих версиях', available: false },
  { id: 'line', name: 'Кредитная линия', note: 'Появится в следующих версиях', available: false },
];

const PURPOSES = ['Пополнение оборотных средств', 'Закупка товара и сырья', 'Ремонт и оборудование', 'Другое'];

// Обязательные и дополнительные документы заявки (FR-03, FR-05).
const DOC_TYPES = [
  { id: 'passport', name: 'Паспорт руководителя', hint: 'Разворот с фото', required: true },
  { id: 'report', name: 'Бухгалтерская отчётность за последний год', hint: 'Баланс и отчёт о финансовых результатах', required: true },
  { id: 'contracts', name: 'Договоры с крупными покупателями', hint: 'Если есть', required: false },
];
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
const MAX_FILE_MB = 20;

// Действующая версия правил автоматического решения (FR-16, FR-17).
const RULES = {
  version: '1.2',
  approveFrom: 750,      // от этой оценки — автоматическое одобрение
  rejectBelow: 550,      // ниже — автоматический отказ
  taxDebtLimit: 50000,   // стоп-фактор: долг перед бюджетом выше лимита
  bkiTimeoutSec: 10,     // в прототипе 10 секунд, в требованиях — 10 минут (FR-18, NFR-15)
};

// Справочник причин отказа, которые видит клиент (FR-13).
const REJECT_REASONS = {
  TAX_DEBT: 'По данным ФНС у компании есть задолженность перед бюджетом. После её погашения можно подать заявку снова.',
  BKI_OVERDUE: 'В кредитной истории есть просрочка больше 90 дней.',
  LOW_SCORE: 'Финансовые показатели пока не позволяют выдать кредит на эту сумму. Попробуйте подать заявку на меньшую сумму.',
  UW_FINANCE: 'Банк оценил финансовое положение компании и пока не может выдать кредит на этих условиях.',
  UW_DOCS: 'Предоставленные документы не подтверждают финансовое положение компании.',
};

// Короткие названия причин для андеррайтера.
const REASON_LABELS = {
  UW_FINANCE: 'Слабое финансовое положение',
  UW_DOCS: 'Документы не подтверждают данные',
  LOW_SCORE: 'Низкая оценка, можно меньшую сумму',
};

const STATUS = {
  draft: { label: 'Черновик', tone: 'gray' },
  received: { label: 'Получена', tone: 'blue' },
  checking: { label: 'На проверке', tone: 'blue' },
  underwriter: { label: 'На проверке', tone: 'blue' },
  compliance: { label: 'На проверке', tone: 'blue' },
  decided: { label: 'Решение принято', tone: 'green' },
};
