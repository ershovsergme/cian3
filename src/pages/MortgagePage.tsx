import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Checkbox, Icon, Input, Modal, Radio, Skeleton } from '@/ui';
import { listings, money } from '@/data/listings';
import {
  amount,
  callDays,
  callSlots,
  defaultMortgageState,
  formatCallDate,
  monthlyPayment,
  mortgageStorageKey,
  profilePhone,
  propertyChoices,
  purchaseTimes,
  readMortgageState,
  requiresAssistance,
  validateCalculation,
  validateStep,
  type MortgageCalculation,
  type MortgageDraft,
  type MortgageErrors,
  type MortgageState,
} from '@/data/mortgage';
import s from './MortgagePage.module.css';

const stepNames = ['О покупке', 'Контакты', 'Время звонка'];
const stepTitles = ['Расскажите о покупке', 'Как с вами связаться?', 'Когда вам позвонить?'];
const yesNo = [
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' },
];

function Choices({
  name,
  title,
  value,
  options,
  onChange,
  error,
  stacked = false,
}: {
  name: string;
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string;
  stacked?: boolean;
}) {
  return (
    <fieldset className={s.question} aria-describedby={error ? `${name}-error` : undefined}>
      <legend>{title}</legend>
      <div className={stacked ? s.stackedChoices : s.choices}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            checked={value === option.value}
            className={s.choice}
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : undefined}
            onChange={() => onChange(option.value)}
          />
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className={s.error}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Summary({
  calculation,
  compact = false,
}: {
  calculation: MortgageCalculation;
  compact?: boolean;
}) {
  const payment = monthlyPayment(calculation);
  const listing = listings.find((item) => item.id === calculation.listingId);
  return (
    <section className={compact ? s.compactSummary : s.summary} aria-label="Ваш расчёт">
      <div className={s.summaryHeading}>
        <Icon name="InfrastructureBank16" size={20} />
        <span>Ваш расчёт</span>
      </div>
      {listing && (
        <div className={s.propertyPreview}>
          <img src={listing.images[0]} alt="" />
          <div>
            <strong>
              {listing.rooms || 'Студия'}
              {listing.rooms ? '-комн. квартира' : ''}
            </strong>
            <span>{listing.address}</span>
          </div>
        </div>
      )}
      <p className={s.payment}>
        {payment === null ? '—' : money(payment)} <span>/ мес.</span>
      </p>
      <p className={s.summaryCaption}>Примерный ежемесячный платёж</p>
      <dl className={s.numbers}>
        <div>
          <dt>Программа</dt>
          <dd>{calculation.program === 'family' ? 'Семейная' : 'Базовая'}</dd>
        </div>
        <div>
          <dt>Недвижимость</dt>
          <dd>{calculation.propertyType === 'new' ? 'Новостройка' : 'Вторичка'}</dd>
        </div>
        <div>
          <dt>Сумма кредита</dt>
          <dd>
            {payment === null
              ? '—'
              : money(amount(calculation.price) - amount(calculation.deposit))}
          </dd>
        </div>
        <div>
          <dt>Срок</dt>
          <dd>{calculation.years} лет</dd>
        </div>
        <div>
          <dt>Ставка в примере</dt>
          <dd>{calculation.program === 'family' ? '6' : '18'}%</dd>
        </div>
      </dl>
      <p className={s.finePrint}>
        Учебный расчёт. Точные условия и доступную программу уточнит ипотечный эксперт.
      </p>
    </section>
  );
}

export function MortgagePage() {
  const [params] = useSearchParams();
  return (
    <MortgageFlow
      key={`${params.get('case') || ''}:${params.get('listing') || ''}`}
      scenario={params.get('case') || ''}
      listingId={params.get('listing')}
    />
  );
}

function MortgageFlow({ scenario, listingId }: { scenario: string; listingId: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState<MortgageState>(() => {
    const value = scenario ? defaultMortgageState(listingId) : readMortgageState(listingId);
    if (scenario === 'empty') {
      value.draft.fullName = '';
      value.draft.email = '';
    }
    if (scenario === 'consented') value.marketingConsent = true;
    if (['active', 'issued', 'cancelled', 'declined'].includes(scenario)) {
      value.application = {
        status: scenario as 'active' | 'issued' | 'cancelled' | 'declined',
        date: callDays()[1].value,
        time: '11:00',
        phone: profilePhone,
        calculation: value.calculation,
        answers: value.draft,
      };
    }
    return value;
  });
  const [errors, setErrors] = useState<MortgageErrors>({});
  const [document, setDocument] = useState<'service' | 'marketing' | 'help' | ''>('');
  const [exitOpen, setExitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [profileError, setProfileError] = useState(scenario === 'profile-error');
  const [loading, setLoading] = useState(scenario === 'loading');
  const failNext = useRef(scenario === 'error');
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const { calculation, draft, application } = data;
  const isApplication = location.pathname === '/mortgage/application';
  const success = location.pathname === '/mortgage/success' && application?.status === 'active';
  const active = application?.status === 'active';
  const statusView =
    !!application &&
    (location.pathname === '/mortgage/status' || (isApplication && active) || success);
  const requestedStep = Math.max(1, Math.min(3, Math.floor(Number(params.get('step')) || 1)));
  const step =
    requestedStep > 1 && Object.keys(validateStep(1, draft, calculation)).length
      ? 1
      : requestedStep > 2 && Object.keys(validateStep(2, draft, calculation)).length
        ? 2
        : requestedStep;
  const calculator = !isApplication && !statusView;
  const payment = monthlyPayment(calculation);
  const title = statusView
    ? success
      ? 'Заявка отправлена'
      : active
        ? 'Ваша заявка уже в работе'
        : 'Заявка завершена'
    : calculator
      ? 'Ипотека начинается\nс разговора'
      : stepTitles[step - 1];

  useEffect(() => {
    if (!scenario) {
      try {
        sessionStorage.setItem(mortgageStorageKey, JSON.stringify(data));
      } catch {
        /* In-memory fallback. */
      }
    }
  }, [data, scenario]);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => {
      clearInterval(tick);
      if (submitTimer.current) clearTimeout(submitTimer.current);
    };
  }, []);
  useEffect(() => {
    if (step !== 2 || !isApplication) return;
    const load = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(load);
  }, [step, isApplication]);
  useEffect(() => {
    if (mounted.current) {
      headingRef.current?.focus();
      window.scrollTo(0, 0);
    }
    mounted.current = true;
  }, [location.pathname, step]);
  // Canonicalize a guarded deep link before editing. Otherwise finishing a field
  // could silently advance to the originally requested later step.
  useEffect(() => {
    if (!isApplication || active || requestedStep === step) return;
    const query = new URLSearchParams(location.search);
    query.set('step', String(step));
    navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
  }, [isApplication, active, requestedStep, step, location.pathname, location.search, navigate]);

  const url = (path: string, nextStep?: number) => {
    const query = new URLSearchParams();
    if (scenario) query.set('case', scenario);
    if (listingId) query.set('listing', listingId);
    if (nextStep) query.set('step', String(nextStep));
    return `${path}${query.size ? `?${query}` : ''}`;
  };
  const go = (path: string, nextStep?: number) => {
    setErrors({});
    setSubmitError(false);
    navigate(url(path, nextStep));
  };
  const change = <K extends keyof MortgageDraft>(key: K, value: MortgageDraft[K]) => {
    setData((old) => ({
      ...old,
      draft: { ...old.draft, [key]: value, ...(key === 'date' ? { time: '' } : {}) },
    }));
    setErrors((old) => ({ ...old, [key]: undefined }));
    setSubmitError(false);
  };
  const changeCalculation = (key: keyof MortgageCalculation, value: string) => {
    setData((old) => ({ ...old, calculation: { ...old.calculation, [key]: value } }));
    setErrors((old) => ({ ...old, [key]: undefined }));
  };
  const showErrors = (next: MortgageErrors) => {
    setErrors(next);
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || submitTimer.current) return;
    if (!calculator && step === 2 && (loading || profileError)) return;
    if (active) {
      go('/mortgage/status');
      return;
    }
    const invalidCalculation = validateCalculation(calculation);
    if (Object.keys(invalidCalculation).length) {
      go('/mortgage');
      showErrors(invalidCalculation);
      return;
    }
    const invalid = calculator ? {} : validateStep(step, draft, calculation);
    if (Object.keys(invalid).length) {
      showErrors(invalid);
      return;
    }
    if (calculator) {
      go('/mortgage/application', 1);
      return;
    }
    if (step < 3) {
      go('/mortgage/application', step + 1);
      return;
    }
    setBusy(true);
    setSubmitError(false);
    submitTimer.current = setTimeout(() => {
      submitTimer.current = null;
      setBusy(false);
      if (failNext.current) {
        failNext.current = false;
        setSubmitError(true);
        return;
      }
      const staleSlot = validateStep(3, draft, calculation);
      if (Object.keys(staleSlot).length) {
        showErrors(staleSlot);
        return;
      }
      setData((old) => ({
        ...old,
        marketingConsent: old.marketingConsent || draft.marketing,
        application: {
          status: 'active',
          date: draft.date,
          time: draft.time,
          phone: profilePhone,
          calculation: { ...calculation },
          context: {
            propertyKind: 'apartment',
            employment: 'employed',
            salaryProject: false,
            canConfirmIncome: true,
            sourceBank: null,
            loanAmount: amount(calculation.price) - amount(calculation.deposit),
          },
          answers: {
            ...draft,
            fullName: draft.fullName.trim(),
            email: draft.email.trim(),
            assistance: requiresAssistance(calculation) ? draft.assistance : '',
            creditPayment: draft.credits === 'yes' ? draft.creditPayment : '',
          },
        },
      }));
      go('/mortgage/success');
    }, 800);
  };

  let content: ReactNode;
  if (statusView && application) {
    content = (
      <div className={s.result}>
        <div className={s.resultIcon}>
          <Icon name={success ? 'FunctionalSuccess16' : 'FunctionalCalendar24'} size={32} />
        </div>
        <Badge tone={active ? 'positive' : 'neutral'}>
          {active
            ? 'Ждём звонка эксперта'
            : (
                {
                  issued: 'Ипотека выдана',
                  cancelled: 'Отменена',
                  declined: 'Получен отказ',
                } as Record<string, string>
              )[application.status]}
        </Badge>
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        <p className={s.intro}>
          {active
            ? 'Ипотечный эксперт партнёра позвонит вам, уточнит детали и поможет подобрать банк.'
            : 'Вы можете заполнить новую короткую заявку, когда будете готовы.'}
        </p>
        {active && (
          <div className={s.appointment}>
            <Icon name="FunctionalCalendar24" size={28} />
            <div>
              <strong>
                {formatCallDate(application.date)}, {application.time}
              </strong>
              <span>По московскому времени</span>
              <span>{application.phone}</span>
            </div>
          </div>
        )}
        {active && (
          <ol className={s.nextSteps}>
            <li>
              <span>1</span>
              <div>
                <strong>Обсудите ваши планы</strong>
                <p>Эксперт задаст несколько вопросов о покупке.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Подберите подходящую ипотеку</strong>
                <p>Партнёр сравнит условия и поможет с заявкой в банк.</p>
              </div>
            </li>
          </ol>
        )}
        {active && !success && (
          <p className={s.finePrint}>
            Новая заявка станет доступна после завершения текущей: выдачи, отмены или отказа.
          </p>
        )}
        {active ? (
          <Link to="/search" className={s.primaryLink}>
            Продолжить поиск жилья
          </Link>
        ) : (
          <Button fullWidth size="L" onClick={() => go('/mortgage')}>
            Подать новую заявку
          </Button>
        )}
        <Link to={url('/mortgage')}>К ипотечному калькулятору</Link>
      </div>
    );
  } else {
    content = (
      <>
        {!calculator && (
          <div className={s.progress} aria-label={`Шаг ${step} из 3: ${stepNames[step - 1]}`}>
            {stepNames.map((name, index) => (
              <div
                key={name}
                className={index + 1 <= step ? s.progressActive : ''}
                aria-current={index + 1 === step ? 'step' : undefined}
              >
                <span>{index + 1 < step ? '✓' : `0${index + 1}`}</span>
                {name}
                <i />
              </div>
            ))}
          </div>
        )}
        <div className={s.heading}>
          {calculator && <span className={s.eyebrow}>СВОЁ ЖИЛЬЁ — БЛИЖЕ</span>}
          <h1 ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          <p className={s.intro}>
            {calculator
              ? 'Рассчитайте платёж. Мы поможем сделать следующий шаг к своему дому.'
              : step === 1
                ? 'Несколько ответов помогут эксперту подобрать подходящие условия.'
                : step === 2
                  ? scenario === 'empty'
                    ? 'Добавьте имя и почту. Подтверждённый телефон уже есть в вашем профиле.'
                    : 'Мы подставили данные из профиля. Проверьте имя и почту — их можно изменить.'
                  : 'Выберите удобное время. Эксперт свяжется с вами и расскажет, что делать дальше.'}
          </p>
        </div>
        <form
          ref={formRef}
          noValidate
          onSubmit={submit}
          className={s.form}
          aria-label={calculator ? 'Ипотечный калькулятор' : 'Короткая ипотечная анкета'}
        >
          <fieldset disabled={busy} className={s.formFields}>
            {calculator ? (
              <>
                <Choices
                  name="program"
                  title="Ипотечная программа"
                  value={calculation.program}
                  options={[
                    { value: 'family', label: 'Семейная' },
                    { value: 'basic', label: 'Базовая' },
                  ]}
                  onChange={(value) => changeCalculation('program', value)}
                />
                <Choices
                  name="propertyType"
                  title="Что планируете купить?"
                  value={calculation.propertyType}
                  options={[
                    { value: 'new', label: 'Новостройку' },
                    { value: 'resale', label: 'Вторичное жильё' },
                  ]}
                  onChange={(value) => changeCalculation('propertyType', value)}
                />
                <Input
                  size="L"
                  label="Стоимость недвижимости, ₽"
                  inputMode="numeric"
                  value={calculation.price}
                  onChange={(e) => changeCalculation('price', e.target.value)}
                  error={errors.price}
                />
                <div className={s.inputRow}>
                  <Input
                    size="L"
                    label="Первоначальный взнос, ₽"
                    inputMode="numeric"
                    value={calculation.deposit}
                    onChange={(e) => changeCalculation('deposit', e.target.value)}
                    error={errors.deposit}
                  />
                  <Input
                    size="L"
                    label="Срок кредита, лет"
                    inputMode="numeric"
                    value={calculation.years}
                    onChange={(e) => changeCalculation('years', e.target.value)}
                    error={errors.years}
                  />
                </div>
                <div className={s.region}>
                  <Icon name="MapLocation16" /> Регион покупки: {calculation.region}
                </div>
                <div className={s.mobileSummary}>
                  <Summary calculation={calculation} compact />
                </div>
                <div className={s.invitation}>
                  <span className={s.roundIcon}>
                    <Icon name="ActionProfile24" size={24} />
                  </span>
                  <div>
                    <h2>Подберём ипотеку вместе</h2>
                    <p>Короткая заявка займёт около 3 минут. Дальше поможет ипотечный эксперт.</p>
                  </div>
                </div>
                {application && !active && (
                  <p className={s.notice}>Предыдущая заявка завершена. Можно отправить новую.</p>
                )}
              </>
            ) : step === 1 ? (
              <>
                <Choices
                  name="timing"
                  title="Когда планируете покупку?"
                  options={purchaseTimes}
                  value={draft.timing}
                  onChange={(value) => change('timing', value)}
                  error={errors.timing}
                />
                <Choices
                  name="property"
                  title="Уже выбрали объект?"
                  options={propertyChoices}
                  value={draft.property}
                  onChange={(value) => change('property', value)}
                  error={errors.property}
                  stacked
                />
                {requiresAssistance(calculation) && (
                  <Choices
                    name="assistance"
                    title="Нужна помощь с подбором новостройки?"
                    options={yesNo}
                    value={draft.assistance}
                    onChange={(value) => change('assistance', value)}
                    error={errors.assistance}
                  />
                )}
                <div className={s.income}>
                  <Input
                    size="L"
                    label="Ежемесячный доход, ₽"
                    inputMode="numeric"
                    placeholder="После вычета налогов"
                    value={draft.income}
                    onChange={(e) => change('income', e.target.value)}
                    error={errors.income}
                    hint="Примерная сумма, которую вы получаете на руки"
                  />
                  <div className={s.quickAmounts} aria-label="Выбрать доход">
                    {[100000, 150000, 200000].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={amount(draft.income) === value}
                        onClick={() => change('income', String(value))}
                      >
                        {money(value)}
                      </button>
                    ))}
                  </div>
                </div>
                <Choices
                  name="credits"
                  title="Есть действующие кредиты?"
                  options={yesNo}
                  value={draft.credits}
                  onChange={(value) => change('credits', value)}
                  error={errors.credits}
                />
                {draft.credits === 'yes' && (
                  <Input
                    size="L"
                    label="Платежи по кредитам в месяц, ₽"
                    inputMode="numeric"
                    value={draft.creditPayment}
                    onChange={(e) => change('creditPayment', e.target.value)}
                    placeholder="Общая сумма по всем кредитам"
                    error={errors.creditPayment}
                  />
                )}
              </>
            ) : step === 2 ? (
              <>
                {loading ? (
                  <div className={s.loading} role="status">
                    <span>Загружаем данные профиля</span>
                    {[1, 2, 3].map((key) => (
                      <Skeleton key={key} height={72} />
                    ))}
                  </div>
                ) : profileError ? (
                  <div className={s.failure} role="alert">
                    <h2>Не удалось загрузить профиль</h2>
                    <p>
                      Нужен подтверждённый номер телефона. Попробуйте ещё раз — ответы о покупке
                      сохранены.
                    </p>
                    <Button theme="main_secondary" onClick={() => setProfileError(false)}>
                      Загрузить профиль снова
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      size="L"
                      label="Фамилия, имя и отчество"
                      autoComplete="name"
                      maxLength={150}
                      value={draft.fullName}
                      onChange={(e) => change('fullName', e.target.value)}
                      error={errors.fullName}
                      hint="Если отчества нет, укажите только имя и фамилию"
                      placeholder="Например, Александра Смирнова"
                    />
                    <Input
                      size="L"
                      className={s.readonly}
                      label="Телефон"
                      type="tel"
                      value={profilePhone}
                      readOnly
                      hint="Подтверждён в профиле. Здесь его изменить нельзя"
                    />
                    <Input
                      size="L"
                      label="Электронная почта"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={draft.email}
                      onChange={(e) => change('email', e.target.value)}
                      error={errors.email}
                      placeholder="name@mail.ru"
                      hint="Для информации о вашей заявке"
                    />
                    <div className={s.note}>
                      <Icon name="FunctionalInformationCircle16" />
                      <p>
                        Данные получит ипотечный партнёр, чтобы связаться с вами и помочь с заявкой.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <fieldset
                  className={s.question}
                  aria-describedby={errors.date ? 'date-error' : undefined}
                >
                  <legend>День звонка</legend>
                  <div className={s.days}>
                    {callDays(now).map((day) => (
                      <label key={day.value} className={s.day}>
                        <input
                          type="radio"
                          name="date"
                          value={day.value}
                          checked={draft.date === day.value}
                          onChange={() => change('date', day.value)}
                          aria-invalid={!!errors.date}
                          aria-describedby={errors.date ? 'date-error' : undefined}
                        />
                        <strong>{day.label}</strong>
                        <span>{day.detail}</span>
                      </label>
                    ))}
                  </div>
                  {errors.date && (
                    <p id="date-error" className={s.error}>
                      {errors.date}
                    </p>
                  )}
                </fieldset>
                <fieldset className={s.question}>
                  <legend>
                    Время звонка <span className={s.timezone}>· Москва, UTC+3</span>
                  </legend>
                  {!draft.date ? (
                    <p className={s.emptySlots}>Сначала выберите день — покажем свободное время.</p>
                  ) : callSlots(draft.date, now).length ? (
                    <div className={s.slots}>
                      {callSlots(draft.date, now).map((time) => (
                        <Radio
                          key={time}
                          label={time}
                          name="time"
                          value={time}
                          checked={draft.time === time}
                          className={s.choice}
                          aria-invalid={!!errors.time}
                          aria-describedby={errors.time ? 'time-error' : undefined}
                          onChange={() => change('time', time)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={s.emptySlots}>
                      На этот день свободного времени нет. Выберите следующий день.
                    </div>
                  )}
                  {errors.time && (
                    <p id="time-error" className={s.error} role="alert">
                      {errors.time}
                    </p>
                  )}
                </fieldset>
                <div className={s.contactReview}>
                  <div>
                    <span>Эксперт позвонит</span>
                    <strong>{profilePhone}</strong>
                    <p>{draft.fullName}</p>
                  </div>
                  <Button
                    theme="stroke_secondary"
                    size="XS"
                    onClick={() => go('/mortgage/application', 2)}
                  >
                    Изменить контакты
                  </Button>
                </div>
                {!data.marketingConsent && (
                  <div className={s.marketing}>
                    <Checkbox
                      label="Хочу получать новости и предложения Циана"
                      checked={draft.marketing}
                      onChange={(e) => change('marketing', e.target.checked)}
                    />
                    <button
                      className={s.textButton}
                      type="button"
                      onClick={() => setDocument('marketing')}
                    >
                      Согласие на рекламу · необязательно
                    </button>
                  </div>
                )}
                <div className={s.consent}>
                  <p>Нажимая «Отправить заявку», вы принимаете:</p>
                  <button
                    type="button"
                    className={s.textButton}
                    onClick={() => setDocument('service')}
                  >
                    условия услуги и согласие на обработку и передачу данных партнёру
                  </button>
                </div>
                {submitError && (
                  <div className={s.failure} role="alert">
                    <strong>Не удалось отправить заявку</strong>
                    <p>Ответы сохранены. Попробуйте ещё раз.</p>
                  </div>
                )}
              </>
            )}
          </fieldset>
          {!(step === 2 && !calculator && (loading || profileError)) && (
            <div className={s.formActions}>
              <Button size="L" fullWidth type="submit" loading={busy}>
                {busy
                  ? 'Отправляем заявку'
                  : calculator
                    ? active
                      ? 'Посмотреть заявку'
                      : 'Заполнить заявку на Циане'
                    : step < 3
                      ? 'Продолжить'
                      : submitError
                        ? 'Попробовать снова'
                        : 'Отправить заявку'}
              </Button>
              <p>
                {calculator
                  ? 'Около 3 минут · Без документов'
                  : step < 3
                    ? `Шаг ${step} из 3 · Ответы сохраняются`
                    : 'Один звонок — первый шаг к своему дому'}
              </p>
            </div>
          )}
        </form>
      </>
    );
  }

  return (
    <div className={s.page}>
      <a className="skip-link" href="#mortgage-main">
        К содержимому
      </a>
      <header className={s.header}>
        <Link to="/" aria-label="Циан — главная" className={s.logo}>
          <img src="/images/logo.svg" alt="Циан" width="100" height="25" />
        </Link>
        <span className={s.headerDivider} />
        <span className={s.headerTitle}>Ипотека</span>
        <button
          type="button"
          className={s.help}
          aria-label="Как это работает"
          onClick={() => setDocument('help')}
        >
          <Icon name="FunctionalInformationCircle16" />
          <span>Как это работает</span>
        </button>
      </header>
      <main id="mortgage-main" className={s.main}>
        <div className={s.topline}>
          {isApplication && !statusView ? (
            <button
              disabled={busy}
              className={s.back}
              onClick={() =>
                go(
                  step === 1 ? '/mortgage' : '/mortgage/application',
                  step === 1 ? undefined : step - 1,
                )
              }
            >
              <Icon name="ActionChevronLeft16" />
              {step === 1 ? 'К расчёту' : 'Назад'}
            </button>
          ) : (
            <Link to={listingId ? `/listing/${listingId}` : '/'} className={s.back}>
              <Icon name="ActionChevronLeft16" />
              {listingId ? 'К квартире' : 'На главную'}
            </Link>
          )}
          {isApplication && !statusView && (
            <button
              type="button"
              disabled={busy}
              aria-label="Закрыть анкету"
              className={s.close}
              onClick={() => setExitOpen(true)}
            >
              <Icon name="ActionClose16" />
            </button>
          )}
          {calculator && <span className={s.toplineCaption}>Поддержим на пути к своему дому</span>}
        </div>
        <div className={s.layout}>
          <div className={`${s.mainCard} ${statusView ? s.resultCard : ''}`}>{content}</div>
          <aside className={s.aside}>
            <Summary
              calculation={statusView && application ? application.calculation : calculation}
            />
            <div className={s.support}>
              <span className={s.roundIcon}>
                <Icon name="PlaceholderUser16" size={24} />
              </span>
              <h2>Рядом на каждом шаге</h2>
              <p>Эксперт поможет разобраться в условиях и подготовиться к покупке.</p>
              <ul>
                <li>
                  <Icon name="FunctionalSuccess16" />
                  Подберёт банк под вашу ситуацию
                </li>
                <li>
                  <Icon name="FunctionalSuccess16" />
                  Ответит на вопросы об ипотеке
                </li>
                <li>
                  <Icon name="FunctionalSuccess16" />
                  Объяснит следующие шаги
                </li>
              </ul>
            </div>
            {payment !== null && !calculator && !statusView && (
              <button className={s.textButton} disabled={busy} onClick={() => go('/mortgage')}>
                Изменить расчёт
              </button>
            )}
          </aside>
        </div>
        <footer className={s.footer}>
          <span>Учебный прототип · данные не отправляются</span>
          <Link to="/patterns">Состояния прототипа</Link>
        </footer>
      </main>
      <Modal
        open={!!document}
        title={
          document === 'service'
            ? 'Условия услуги и согласия'
            : document === 'marketing'
              ? 'Согласие на рекламу'
              : 'Как работает заявка'
        }
        onClose={() => setDocument('')}
      >
        <div className="stack">
          {document === 'help' ? (
            <>
              <p>1. Рассчитайте платёж и ответьте на несколько вопросов о покупке.</p>
              <p>2. Проверьте контакты и выберите время звонка.</p>
              <p>3. Ипотечный эксперт партнёра поможет подобрать банк и подготовить заявку.</p>
            </>
          ) : document === 'service' ? (
            <>
              <p>
                Заявка нужна для консультации ипотечного эксперта. Для связи партнёру передаются
                контакты, ответы анкеты и параметры расчёта.
              </p>
              <p>
                Отправка заявки не означает одобрение кредита. Окончательные условия определяет
                банк.
              </p>
            </>
          ) : (
            <p>
              Необязательное согласие на новости и рекламные предложения Циана. Отказ не влияет на
              отправку ипотечной заявки.
            </p>
          )}
          <p className="muted">
            Это демонстрационный текст для прототипа. Юридические документы и реальные партнёры не
            подключены; данные никуда не отправляются.
          </p>
          <Button fullWidth onClick={() => setDocument('')}>
            Понятно
          </Button>
        </div>
      </Modal>
      <Modal open={exitOpen} title="Вернуться к анкете позже?" onClose={() => setExitOpen(false)}>
        <div className="stack">
          <p>Ответы сохранятся в этой вкладке. Вы сможете продолжить с калькулятора.</p>
          <Button fullWidth onClick={() => setExitOpen(false)}>
            Продолжить заполнение
          </Button>
          <Button
            fullWidth
            theme="main_secondary"
            onClick={() => {
              setExitOpen(false);
              go('/mortgage');
            }}
          >
            Сохранить и выйти
          </Button>
        </div>
      </Modal>
    </div>
  );
}
