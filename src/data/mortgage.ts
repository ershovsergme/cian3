import { listings } from './listings';

export const mortgageStorageKey = 'cian3:mortgage:v1';
export const purchaseTimes = [
  { value: 'month', label: 'В течение месяца' },
  { value: 'three', label: 'Через 1–3 месяца' },
  { value: 'six', label: 'Через 3–6 месяцев' },
  { value: 'exploring', label: 'Пока изучаю' },
];
export const propertyChoices = [
  { value: 'found', label: 'Да, уже выбрал объект' },
  { value: 'searching', label: 'Нет, пока выбираю' },
  { value: 'budget', label: 'Сначала хочу понять бюджет' },
];
export type ApplicationStatus = 'active' | 'issued' | 'cancelled' | 'declined';
export interface MortgageCalculation {
  price: string;
  deposit: string;
  years: string;
  program: 'family' | 'basic';
  propertyType: 'new' | 'resale';
  region: string;
  listingId?: string;
}
export interface MortgageDraft {
  timing: string;
  property: string;
  assistance: string;
  income: string;
  credits: string;
  creditPayment: string;
  fullName: string;
  email: string;
  date: string;
  time: string;
  marketing: boolean;
}
export interface MortgageApplication {
  status: ApplicationStatus;
  date: string;
  time: string;
  phone: string;
  calculation: MortgageCalculation;
  answers: MortgageDraft;
  context?: {
    propertyKind: 'apartment';
    employment: 'employed';
    salaryProject: boolean;
    canConfirmIncome: boolean;
    sourceBank: null;
    loanAmount: number;
  };
}
export interface MortgageState {
  calculation: MortgageCalculation;
  draft: MortgageDraft;
  marketingConsent: boolean;
  application: MortgageApplication | null;
}
export type MortgageErrors = Partial<
  Record<keyof MortgageDraft | keyof MortgageCalculation, string>
>;
export const profilePhone = '+7 (999) 000-00-00';
export const amount = (value: string) => Number(value.replace(/\s/g, ''));
export const requiresAssistance = (calculation: MortgageCalculation) =>
  calculation.program === 'family' && calculation.propertyType === 'new';

function isCalculation(value: unknown): value is MortgageCalculation {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    ['price', 'deposit', 'years', 'region'].every((key) => typeof c[key] === 'string') &&
    (c.program === 'family' || c.program === 'basic') &&
    (c.propertyType === 'new' || c.propertyType === 'resale')
  );
}
function isDraft(value: unknown): value is MortgageDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return (
    [
      'timing',
      'property',
      'assistance',
      'income',
      'credits',
      'creditPayment',
      'fullName',
      'email',
      'date',
      'time',
    ].every((key) => typeof d[key] === 'string') && typeof d.marketing === 'boolean'
  );
}

export function defaultMortgageState(listingId?: string | null): MortgageState {
  const listing = listings.find((item) => item.id === listingId);
  return {
    calculation: {
      price: String(listing?.price || 8000000),
      deposit: String(listing ? Math.round(listing.price * 0.25) : 2000000),
      years: '20',
      program: listing ? 'basic' : 'family',
      propertyType: listing ? 'resale' : 'new',
      region: 'Москва',
      ...(listing && { listingId: listing.id }),
    },
    draft: {
      timing: '',
      property: listing ? 'found' : '',
      assistance: '',
      income: '',
      credits: '',
      creditPayment: '',
      fullName: 'Александра Смирнова',
      email: 'alexandra@example.com',
      date: '',
      time: '',
      marketing: false,
    },
    marketingConsent: false,
    application: null,
  };
}

// The prototype keeps its draft only in this browser tab. Unavailable storage is harmless.
export function readMortgageState(listingId?: string | null): MortgageState {
  const initial = defaultMortgageState(listingId);
  try {
    const saved = JSON.parse(sessionStorage.getItem(mortgageStorageKey) || 'null');
    if (!saved || !saved.calculation || !saved.draft) return initial;
    const calculation = saved.calculation;
    const draft = saved.draft;
    if (
      !isDraft(draft) ||
      !isCalculation(calculation) ||
      typeof saved.marketingConsent !== 'boolean'
    )
      return initial;
    const application = saved.application;
    if (
      application &&
      (!['active', 'issued', 'cancelled', 'declined'].includes(application.status) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(application.date) ||
        !Number.isFinite(new Date(`${application.date}T12:00:00Z`).getTime()) ||
        typeof application.time !== 'string' ||
        typeof application.phone !== 'string' ||
        !isCalculation(application.calculation) ||
        !isDraft(application.answers))
    )
      return initial;
    return {
      calculation:
        listingId && calculation.listingId !== listingId ? initial.calculation : calculation,
      draft,
      marketingConsent: saved.marketingConsent,
      application: application || null,
    };
  } catch {
    return initial;
  }
}

export function validateCalculation(c: MortgageCalculation): MortgageErrors {
  const errors: MortgageErrors = {};
  if (!Number.isFinite(amount(c.price)) || amount(c.price) < 100000 || amount(c.price) > 1000000000)
    errors.price = 'Укажите стоимость от 100 тыс. до 1 млрд ₽';
  if (
    !c.deposit.trim() ||
    !Number.isFinite(amount(c.deposit)) ||
    amount(c.deposit) < 0 ||
    amount(c.deposit) >= amount(c.price)
  )
    errors.deposit = 'Взнос должен быть меньше стоимости объекта';
  if (!Number.isInteger(amount(c.years)) || amount(c.years) < 1 || amount(c.years) > 30)
    errors.years = 'Укажите срок от 1 года до 30 лет';
  return errors;
}

// Illustrative rates, not live bank offers or eligibility rules.
export function monthlyPayment(c: MortgageCalculation) {
  if (Object.keys(validateCalculation(c)).length) return null;
  const rate = (c.program === 'family' ? 6 : 18) / 1200;
  const periods = amount(c.years) * 12;
  return Math.round(((amount(c.price) - amount(c.deposit)) * rate) / (1 - (1 + rate) ** -periods));
}

export function moscowDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function callDays(now = new Date()) {
  const today = moscowDate(now);
  return [0, 1, 2].map((offset) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return {
      value: date.toISOString().slice(0, 10),
      label:
        offset === 0
          ? 'Сегодня'
          : offset === 1
            ? 'Завтра'
            : new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(date),
      detail: new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(date),
    };
  });
}
export function callSlots(date: string, now = new Date()) {
  if (!callDays(now).some((day) => day.value === date)) return [];
  return ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'].filter(
    (time) => new Date(`${date}T${time}:00+03:00`).getTime() > now.getTime(),
  );
}
export function formatCallDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
export function validateStep(
  step: number,
  d: MortgageDraft,
  c: MortgageCalculation,
  now = new Date(),
): MortgageErrors {
  const errors: MortgageErrors = {};
  if (step === 1) {
    if (!purchaseTimes.some((item) => item.value === d.timing))
      errors.timing = 'Выберите срок покупки';
    if (!propertyChoices.some((item) => item.value === d.property))
      errors.property = 'Расскажите, выбрали ли вы объект';
    if (requiresAssistance(c) && !['yes', 'no'].includes(d.assistance))
      errors.assistance = 'Выберите, нужна ли помощь';
    if (
      !d.income.trim() ||
      !Number.isFinite(amount(d.income)) ||
      amount(d.income) < 1 ||
      amount(d.income) > 100000000
    )
      errors.income = 'Укажите ежемесячный доход больше нуля';
    if (!['yes', 'no'].includes(d.credits)) errors.credits = 'Укажите, есть ли кредиты';
    if (
      d.credits === 'yes' &&
      (!d.creditPayment.trim() ||
        !Number.isFinite(amount(d.creditPayment)) ||
        amount(d.creditPayment) <= 0 ||
        amount(d.creditPayment) > 100000000)
    )
      errors.creditPayment = 'Укажите сумму ежемесячных платежей';
  }
  if (step === 2) {
    if (
      d.fullName.trim().split(/\s+/).length < 2 ||
      d.fullName.trim().length > 150 ||
      !/^[\p{L}\s'’-]+$/u.test(d.fullName.trim())
    )
      errors.fullName = 'Укажите имя и фамилию. Отчество — если есть';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) || d.email.length > 254)
      errors.email = 'Проверьте адрес почты, например name@mail.ru';
  }
  if (step === 3) {
    if (!callDays(now).some((day) => day.value === d.date))
      errors.date = 'Выберите день в ближайшие три дня';
    if (!callSlots(d.date, now).includes(d.time)) errors.time = 'Выберите доступное время звонка';
  }
  return errors;
}
