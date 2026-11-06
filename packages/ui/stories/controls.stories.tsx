// CSF-compatible stories; TASK-013 will add the Storybook runtime. No SDK imports.
import { useLayoutEffect, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Field,
  Icon,
  IconButton,
  Select,
  StateBoundary,
  StatusChip,
} from '../src/index.js';
import type { BoundaryState, StatusTone } from '../src/index.js';
import './controls.css';
export default { title: 'UI/Native controls', includeStories: ['Variants', 'FieldAndSelect'] };
export type ControlsStoryArgs = { locale: 'ru' | 'ro' };
export function ConsumerForm({ locale }: ControlsStoryArgs) {
  const ro = locale === 'ro';
  const input = useRef<HTMLInputElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const iconButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const avatar = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState('Synthetic Ana');
  const [language, setLanguage] = useState('ro');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [attempts, setAttempts] = useState(0);
  useLayoutEffect(() => {
    if (error && !pending) input.current?.focus();
  }, [error, pending]);
  const longError = ro
    ? 'Valoarea nu a fost acceptată. Verificați câmpul fără să pierdeți textul introdus și corectați informația înainte de a încerca din nou. ' +
      'ExplicațieFoarteLungă'.repeat(6)
    : 'Значение не принято. Проверьте поле: введённый текст сохранён. ' +
      'ОченьДлинноеПояснение'.repeat(6);
  return (
    <Card
      ref={card}
      id="consumer-card"
      title={ro ? 'Formular sintetic' : 'Синтетическая форма'}
      headingLevel={2}
      description={ro ? 'Fără date sau comenzi reale' : 'Без реальных данных и команд'}
      actions={
        <Button variant="ghost" onClick={() => card.current?.focus()}>
          {ro ? 'Focalizează cardul' : 'Фокус на карточку'}
        </Button>
      }
      tabIndex={-1}
    >
      <form
        id="consumer-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError(undefined);
          setAttempts((n) => n + 1);
          globalThis.setTimeout(() => {
            setError(longError);
            setPending(false);
          }, 700);
        }}
      >
        <p id="outside-help">{ro ? 'Ajutor extern păstrat' : 'Внешняя подсказка сохранена'}</p>
        <Field
          ref={input}
          id="controlled-name"
          name="displayName"
          label={ro ? 'Numele sintetic' : 'Синтетическое имя'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          hint={
            ro ? 'Puteți corecta fără pierderea valorii' : 'Можно исправить без потери значения'
          }
          error={error}
          aria-describedby="outside-help outside-help"
          autoComplete="nickname"
          inputMode="text"
          required
          maxLength={100}
          pending={pending}
        />
        <Select
          ref={select}
          id="controlled-select"
          name="language"
          label={ro ? 'Selecție nativă' : 'Нативный выбор'}
          hint={ro ? 'Folosiți tastatura' : 'Используйте клавиатуру'}
          error={error}
          aria-describedby="outside-help"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          pending={pending}
        >
          <option value="ru">Русский</option>
          <option value="ro">Română</option>
        </Select>
        <Field
          id="uncontrolled-name"
          name="uncontrolled"
          label={ro ? 'Câmp nativ necontrolat' : 'Нативное неконтролируемое поле'}
          defaultValue="Uncontrolled synthetic"
          autoComplete="off"
          inputMode="text"
        />
        <Select
          id="uncontrolled-select"
          name="uncontrolledSelect"
          label={ro ? 'Selecție necontrolată' : 'Неконтролируемый выбор'}
          defaultValue="one"
        >
          <optgroup label={ro ? 'Exemple' : 'Примеры'}>
            <option value="one">One</option>
            <option value="two">Two</option>
          </optgroup>
        </Select>
        <Button data-default-button onClick={() => input.current?.focus()}>
          {ro ? 'Buton fără submit' : 'Кнопка без submit'}
        </Button>
        <Button
          ref={button}
          data-submit
          type="submit"
          pending={pending}
          disabledReason={ro ? 'Se așteaptă răspunsul sintetic' : 'Ожидается синтетический ответ'}
        >
          {ro ? 'Trimite formularul' : 'Отправить форму'}
        </Button>
        <output data-attempts>{attempts}</output>
        <output data-native-value>
          {value} / {language}
        </output>
      </form>
      <div className="controls-actions">
        <Button data-focus-input variant="secondary" onClick={() => input.current?.focus()}>
          {ro ? 'Focalizează input' : 'Фокус на поле'}
        </Button>
        <Button data-focus-select variant="secondary" onClick={() => select.current?.focus()}>
          {ro ? 'Focalizează select' : 'Фокус на выборе'}
        </Button>
        <Button data-focus-button variant="secondary" onClick={() => button.current?.focus()}>
          {ro ? 'Focalizează butonul' : 'Фокус на кнопке'}
        </Button>
        <Button data-focus-icon variant="secondary" onClick={() => iconButton.current?.focus()}>
          {ro ? 'Focalizează pictograma' : 'Фокус на значке'}
        </Button>
        <IconButton
          ref={iconButton}
          data-icon
          label={ro ? 'Deschide orarul sintetic' : 'Открыть синтетическое расписание'}
        >
          <Icon name="calendar" />
        </IconButton>
      </div>
      <div className="controls-person">
        <Avatar ref={avatar} name={ro ? 'Ăna Ștefănescu' : 'Анна Синтетическая'} />
        <span className="k8k-person-name">
          {(ro ? 'NumeFoarteLung' : 'ОченьДлинноеИмя').repeat(12)}
        </span>
      </div>
    </Card>
  );
}
export function ControlsCatalog({ locale }: ControlsStoryArgs) {
  const ro = locale === 'ro';
  const states: BoundaryState[] = [
    { status: 'loading' },
    { status: 'empty' },
    { status: 'ready' },
    { status: 'stale' },
    { status: 'error' },
    { status: 'pending', outcome: 'pending' },
    { status: 'pending', outcome: 'unknown' },
    { status: 'forbidden' },
    {
      status: 'subscription-limited',
      message: ro ? 'Limitare sintetică' : 'Синтетическое ограничение',
    },
    { status: 'session-expired' },
  ];
  return (
    <>
      <h1 className="k8k-heading-1">
        {ro ? 'Controale native — date sintetice' : 'Нативные контролы — синтетические данные'}
      </h1>
      <ConsumerForm locale={locale} />
      <Card title={ro ? 'Variante și dimensiuni' : 'Варианты и размеры'}>
        <div className="controls-actions">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} data-variant={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button density="compact" data-compact>
            {ro ? 'Compact pentru staff desktop' : 'Компактно для staff desktop'}
          </Button>
          <Button
            disabled
            disabledReason={ro ? 'Este necesară o decizie separată' : 'Требуется отдельное решение'}
          >
            {ro ? 'Indisponibil' : 'Недоступно'}
          </Button>
        </div>
        <Field
          label={ro ? 'Câmp dezactivat' : 'Недоступное поле'}
          disabled
          hint={ro ? 'Motivul este indicat în text' : 'Причина указана текстом'}
        />
        <Select
          label={ro ? 'Select dezactivat' : 'Недоступный выбор'}
          disabled
          hint={ro ? 'Așteptați contextul' : 'Дождитесь контекста'}
        >
          <option>—</option>
        </Select>
      </Card>
      <Card title={ro ? 'Stări și nume' : 'Статусы и имена'}>
        <div className="controls-actions">
          {(['info', 'success', 'warning', 'danger', 'neutral'] as const).map((tone) => (
            <StatusChip
              key={tone}
              tone={tone}
            >{`${tone}: ${ro ? 'stare sintetică' : 'синтетический статус'}`}</StatusChip>
          ))}
          <StatusChip data-unknown tone={'UNRECOGNIZED' as StatusTone}>
            NEVER_SUCCESS
          </StatusChip>
          <Avatar name="" />
        </div>
      </Card>
      <Card title={ro ? 'Stările componentei existente' : 'Состояния существующего компонента'}>
        {states.map((state, i) => (
          <section key={i}>
            <h3 className="k8k-heading-3">
              {state.status}
              {state.status === 'pending' ? `/${state.outcome}` : ''}
            </h3>
            <StateBoundary
              state={state}
              timeZone="Europe/Chisinau"
              at={Date.parse('2026-11-03T10:30:00Z')}
              retryRead={() => undefined}
            >
              <p>{ro ? 'Date sintetice păstrate' : 'Синтетические данные сохранены'}</p>
            </StateBoundary>
          </section>
        ))}
      </Card>
    </>
  );
}
export const Russian = { args: { locale: 'ru' as const }, render: ControlsCatalog };
export const Variants = { render: ControlsCatalog };
export const Romanian = { args: { locale: 'ro' as const }, render: ControlsCatalog };
export const FieldAndSelect = { args: { locale: 'ro' as const }, render: ConsumerForm };
