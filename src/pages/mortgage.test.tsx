import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import {
  callDays,
  callSlots,
  defaultMortgageState,
  monthlyPayment,
  mortgageStorageKey,
  readMortgageState,
  requiresAssistance,
  validateCalculation,
  validateStep,
} from '@/data/mortgage';

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
function open(path = '/mortgage') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
async function fillPurchase(credits = false) {
  await userEvent.click(screen.getByRole('radio', { name: 'В течение месяца' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Нет, пока выбираю' }));
  const assistance = screen.queryByRole('group', { name: 'Нужна помощь с подбором новостройки?' });
  if (assistance) await userEvent.click(within(assistance).getByRole('radio', { name: 'Да' }));
  await userEvent.click(screen.getByRole('button', { name: /150\s000 ₽/ }));
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Есть действующие кредиты?' })).getByRole('radio', {
      name: credits ? 'Да' : 'Нет',
    }),
  );
  if (credits)
    await userEvent.type(screen.getByLabelText('Платежи по кредитам в месяц, ₽'), '12000');
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
}
async function chooseCall() {
  await userEvent.click(screen.getByRole('radio', { name: /Завтра/ }));
  await userEvent.click(screen.getByRole('radio', { name: '11:00' }));
}

describe('Mortgage flow', () => {
  it('carries the listing calculation into the form and validates the calculator', async () => {
    open('/listing/1');
    await userEvent.click(screen.getByRole('button', { name: 'Рассчитать ипотеку' }));
    expect(screen.getByLabelText('Стоимость недвижимости, ₽')).toHaveValue('18400000');
    await userEvent.clear(screen.getByLabelText('Первоначальный взнос, ₽'));
    await userEvent.type(screen.getByLabelText('Первоначальный взнос, ₽'), '18400000');
    await userEvent.click(screen.getByRole('button', { name: 'Заполнить заявку на Циане' }));
    expect(screen.getByText('Взнос должен быть меньше стоимости объекта')).toBeVisible();
    await userEvent.clear(screen.getByLabelText('Первоначальный взнос, ₽'));
    await userEvent.type(screen.getByLabelText('Первоначальный взнос, ₽'), '4000000');
    await userEvent.click(screen.getByRole('button', { name: 'Заполнить заявку на Циане' }));
    expect(screen.getByRole('radio', { name: 'Да, уже выбрал объект' })).toBeChecked();
    expect(
      screen.queryByRole('group', { name: 'Нужна помощь с подбором новостройки?' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'К расчёту' }));
    expect(screen.getByLabelText('Первоначальный взнос, ₽')).toHaveValue('4000000');
  });

  it('saves the draft, submits once and blocks a duplicate after reopening the route', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Заполнить заявку на Циане' }));
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByText('Выберите срок покупки')).toBeVisible();
    await fillPurchase(true);
    expect(screen.getByLabelText('Телефон')).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть анкету' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить и выйти' }));
    cleanup();
    open('/mortgage/application?step=2');
    expect(screen.getByRole('heading', { name: 'Как с вами связаться?' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByLabelText('Платежи по кредитам в месяц, ₽')).toHaveValue('12000');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Есть действующие кредиты?' })).getByRole('radio', {
        name: 'Нет',
      }),
    );
    expect(screen.queryByLabelText('Платежи по кредитам в месяц, ₽')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(
      screen.getByRole('checkbox', { name: 'Хочу получать новости и предложения Циана' }),
    ).not.toBeChecked();
    await chooseCall();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
    const saved = JSON.parse(sessionStorage.getItem(mortgageStorageKey)!);
    expect(saved.application.answers.creditPayment).toBe('');
    expect(saved.application.date).toBe(callDays()[1].value);
    expect(saved.application.context.loanAmount).toBe(6000000);
    expect(saved.marketingConsent).toBe(false);
    cleanup();
    open('/mortgage/application?step=3');
    expect(screen.getByRole('heading', { name: 'Ваша заявка уже в работе' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Отправить заявку' })).not.toBeInTheDocument();
  });

  it('validates empty contacts and restores focus after the consent dialog', async () => {
    open('/mortgage/application?case=empty&step=3');
    expect(screen.getByRole('heading', { name: 'Расскажите о покупке' })).toBeVisible();
    await fillPurchase();
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByLabelText('Фамилия, имя и отчество')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await userEvent.type(screen.getByLabelText('Фамилия, имя и отчество'), 'Ли Ян');
    await userEvent.type(screen.getByLabelText('Электронная почта'), 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    const consent = screen.getByRole('button', {
      name: 'условия услуги и согласие на обработку и передачу данных партнёру',
    });
    await userEvent.click(consent);
    expect(screen.getByRole('dialog')).toBeVisible();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Понятно' }),
    );
    expect(consent).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(screen.getByText('Выберите день в ближайшие три дня')).toBeVisible();
  });

  it('recovers from submission failure without clearing the slot or answers', async () => {
    open('/mortgage/application?case=error');
    await fillPurchase();
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await chooseCall();
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось отправить заявку');
    expect(screen.getByRole('radio', { name: '11:00' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    expect(await screen.findByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
  });

  it('does not ask again for advertising consent and recovers from profile failure', async () => {
    open('/mortgage/application?case=consented');
    await fillPurchase();
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    cleanup();
    open('/mortgage/application?case=profile-error');
    await fillPurchase();
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить профиль');
    expect(screen.queryByRole('button', { name: 'Продолжить' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить профиль снова' }));
    expect(screen.getByLabelText('Телефон')).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('radio', { name: 'В течение месяца' })).toBeChecked();
  });

  it.each(['issued', 'cancelled', 'declined'])(
    'allows another application after %s',
    async (status) => {
      open(`/mortgage/status?case=${status}`);
      await userEvent.click(screen.getByRole('button', { name: 'Подать новую заявку' }));
      await userEvent.click(screen.getByRole('button', { name: 'Заполнить заявку на Циане' }));
      expect(screen.getByRole('heading', { name: 'Расскажите о покупке' })).toBeVisible();
    },
  );

  it('shows loading and then usable profile fields', async () => {
    open('/mortgage/application?case=loading');
    await fillPurchase();
    expect(screen.getByText('Загружаем данные профиля')).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Телефон')).toBeVisible(), { timeout: 2000 });
  });
});

describe('Mortgage rules', () => {
  it('limits slots to future Moscow times, including midnight and month boundaries', () => {
    const late = new Date('2026-11-30T20:30:00Z');
    expect(callDays(late).map((day) => day.value)).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(callSlots('2026-11-30', late)).toEqual([]);
    expect(callSlots('2026-12-01', late)).toContain('09:00');
    expect(callSlots('2026-12-03', late)).toEqual([]);
    expect(callSlots('2026-11-21', new Date('2026-11-21T08:00:00Z'))).not.toContain('11:00');
    expect(callDays(new Date('2026-11-30T21:01:00Z'))[0].value).toBe('2026-12-01');
  });
  it('validates conditional answers and expired slots without imposing a credit decision', () => {
    const { draft, calculation } = defaultMortgageState();
    expect(requiresAssistance(calculation)).toBe(true);
    expect(requiresAssistance({ ...calculation, propertyType: 'resale' })).toBe(false);
    expect(requiresAssistance({ ...calculation, program: 'basic' })).toBe(false);
    const filled = {
      ...draft,
      timing: 'month',
      property: 'found',
      assistance: 'no',
      income: '100000',
      credits: 'yes',
      creditPayment: '150000',
    };
    expect(validateStep(1, filled, calculation)).toEqual({});
    expect(validateStep(1, { ...filled, creditPayment: '' }, calculation)).toHaveProperty(
      'creditPayment',
    );
    expect(validateStep(1, { ...filled, credits: 'no', creditPayment: '' }, calculation)).toEqual(
      {},
    );
    expect(
      validateStep(
        3,
        { ...filled, date: '2026-11-21', time: '11:00' },
        calculation,
        new Date('2026-11-21T09:00:00Z'),
      ),
    ).toHaveProperty('time');
    expect(monthlyPayment(calculation)).toBe(42986);
    expect(monthlyPayment({ ...calculation, price: 'abc' })).toBeNull();
    expect(validateCalculation({ ...calculation, years: 'Infinity' })).toHaveProperty('years');
  });
  it('handles damaged and unavailable session storage', () => {
    sessionStorage.setItem(mortgageStorageKey, '{broken');
    expect(readMortgageState()).toEqual(defaultMortgageState());
    sessionStorage.setItem(mortgageStorageKey, JSON.stringify({ calculation: {}, draft: {} }));
    expect(readMortgageState()).toEqual(defaultMortgageState());
    sessionStorage.setItem(
      mortgageStorageKey,
      JSON.stringify({
        ...defaultMortgageState(),
        application: {
          status: 'active',
          date: '2026-11-22',
          time: '11:00',
          phone: '+7 (999) 000-00-00',
          calculation: {},
          answers: {},
        },
      }),
    );
    expect(readMortgageState()).toEqual(defaultMortgageState());
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readMortgageState()).toEqual(defaultMortgageState());
    get.mockRestore();
  });
});
