import { useEffect, useRef, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  Field,
  HeroCard,
  Select,
  StatTile,
  Tabs,
  Toast,
  Tooltip,
} from '../src/index.js';
import type { BoundaryState, ToastMessage } from '../src/index.js';
import './composites.css';

export default { title: 'UI/Composite controls' };
type LocaleArgs = { locale: 'ru' | 'ro' };
type TabStoryArgs = LocaleArgs & { guarded?: boolean };

export function FormTabs({ locale, guarded = false }: TabStoryArgs) {
  const ro = locale === 'ro';
  const [tab, setTab] = useState('form');
  const [requested, setRequested] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  function requestTab(next: string) {
    if (guarded && input.current?.value && tab === 'form' && next !== tab) setRequested(next);
    else setTab(next);
  }
  return (
    <>
      <Tabs
        label={ro ? 'Secțiunile formularului' : 'Разделы формы'}
        value={tab}
        onValueChange={requestTab}
        mountPolicy={guarded ? 'unmount-inactive' : 'keep-mounted'}
        items={[
          {
            value: 'form',
            label: ro ? 'Formular' : 'Форма',
            content: (
              <Field
                ref={input}
                id="synthetic-draft"
                label={ro ? 'Text nesalvat' : 'Несохранённый текст'}
              />
            ),
          },
          {
            value: 'blocked',
            label: ro ? 'Opțiune indisponibilă' : 'Недоступный раздел',
            disabled: true,
            disabledReason: ro
              ? 'Această opțiune nu este disponibilă în contextul dat.'
              : 'Этот раздел недоступен в данном контексте.',
            content: null,
          },
          {
            value: 'details',
            label: ro
              ? 'Detalii și informații suplimentare'
              : 'Подробности и дополнительная информация',
            content: (
              <p>
                {ro
                  ? 'Informație sintetică pentru verificarea navigării.'
                  : 'Синтетическое пояснение для проверки навигации.'}
              </p>
            ),
          },
        ]}
      />
      <ConfirmDialog
        open={requested !== undefined}
        onOpenChange={(open) => {
          if (!open) setRequested(undefined);
        }}
        returnFocusRef={input}
        title={ro ? 'Renunți la modificări?' : 'Отбросить изменения?'}
        description={ro ? 'Textul din formular nu este salvat.' : 'Текст в форме не сохранён.'}
        confirmLabel={ro ? 'Renunță' : 'Отбросить'}
        cancelLabel={ro ? 'Continuă editarea' : 'Продолжить ввод'}
        destructive
        onConfirm={() => {
          if (requested) {
            setTab(requested);
            setRequested(undefined);
          }
        }}
      />
    </>
  );
}

export function SupplementaryHelp({ locale }: LocaleArgs) {
  const ro = locale === 'ro';
  const [open, setOpen] = useState(false);
  return (
    <div className="composite-help">
      <Button disabled disabledReason={ro ? 'Alege mai întâi o dată.' : 'Сначала выбери дату.'}>
        {ro ? 'Aplică' : 'Применить'}
      </Button>
      <Tooltip
        open={open}
        onOpenChange={setOpen}
        label={ro ? 'Explicație suplimentară' : 'Дополнительное пояснение'}
        content={
          ro
            ? 'Poți schimba modul de afișare și apoi reveni la luna selectată.'
            : 'Можно сменить вид расписания и вернуться к выбранному месяцу.'
        }
      />
    </div>
  );
}

const states: readonly BoundaryState[] = [
  { status: 'loading' },
  { status: 'empty' },
  { status: 'ready' },
  { status: 'stale' },
  { status: 'error' },
  { status: 'pending', outcome: 'unknown' },
  { status: 'forbidden' },
  { status: 'subscription-limited', message: 'fixture' },
  { status: 'session-expired' },
];
export function InformationCards({ locale }: LocaleArgs) {
  const ro = locale === 'ro';
  const [status, setStatus] = useState<BoundaryState['status']>('ready');
  const state = states.find((entry) => entry.status === status) ?? { status: 'ready' };
  const messages: Record<BoundaryState['status'], string> = ro
    ? {
        loading: 'Se încarcă datele',
        empty: 'Nu există date pentru această perioadă',
        ready: 'Date disponibile',
        stale: 'Datele pot fi învechite',
        error: 'Datele nu au putut fi încărcate',
        pending: 'Rezultatul nu este cunoscut',
        forbidden: 'Secțiunea nu este accesibilă',
        'subscription-limited': 'Accesul pentru acest obiect este limitat',
        'session-expired': 'Sesiunea a expirat',
      }
    : {
        loading: 'Загружаем данные',
        empty: 'За этот период данных нет',
        ready: 'Данные доступны',
        stale: 'Данные могли устареть',
        error: 'Не удалось загрузить данные',
        pending: 'Исход пока неизвестен',
        forbidden: 'Нет доступа к разделу',
        'subscription-limited': 'Доступ к этому объекту ограничен',
        'session-expired': 'Сессия завершилась',
      };
  const source = ro ? 'Sursă: exemplu local sintetic' : 'Источник: локальный синтетический пример';
  const period = ro ? 'Perioadă: noiembrie 2026' : 'Период: ноябрь 2026';
  return (
    <>
      <Select
        id="fixture-state"
        label={ro ? 'Starea exemplului' : 'Состояние примера'}
        value={status}
        onChange={(e) => setStatus(e.target.value as BoundaryState['status'])}
      >
        {states.map((entry) => (
          <option key={entry.status} value={entry.status}>
            {messages[entry.status]}
          </option>
        ))}
      </Select>
      <div className="composite-cards">
        <HeroCard
          title={ro ? 'Următoarea activitate' : 'Ближайшее занятие'}
          value="16:45"
          unit={ro ? 'ora locală' : 'по местному времени'}
          source={source}
          period={period}
          state={state}
          stateText={messages[status]}
          action={<a href="#fixture-details">{ro ? 'Detalii' : 'Подробнее'}</a>}
        />
        <StatTile
          title={
            ro
              ? 'Valoare demonstrativă pentru verificarea încadrării'
              : 'Условное значение для проверки переноса'
          }
          value="12345678901234567890.123456789"
          unit="MDL"
          source={source}
          period={period}
          state={state}
          stateText={messages[status]}
        />
      </div>
    </>
  );
}

type Reply = 'queued' | 'unknown' | 'error' | 'confirmed';
type ResultArgs = LocaleArgs & { request?: (outcome: Reply) => Promise<number> };
const statusByReply: Record<Reply, number> = {
  queued: 202,
  unknown: 504,
  error: 422,
  confirmed: 200,
};
export function ActionResults({
  locale,
  request = async (outcome) => statusByReply[outcome],
}: ResultArgs) {
  const ro = locale === 'ro';
  const [items, setItems] = useState<ToastMessage[]>([]);
  const [ticks, setTicks] = useState(0);
  const [active, setActive] = useState(true);
  const last = useRef<ToastMessage>();
  const nextId = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const tick = () => setTicks((n) => n + 1);
    const replay = () => {
      if (last.current) {
        const event = last.current;
        setItems((prev) => [...prev, { ...event }]);
      }
    };
    const revoke = () => {
      alive.current = false;
      last.current = undefined;
      setItems([]);
      setActive(false);
    };
    globalThis.addEventListener('fixture:tick', tick);
    globalThis.addEventListener('fixture:replay', replay);
    globalThis.addEventListener('fixture:revoke', revoke);
    return () => {
      alive.current = false;
      globalThis.removeEventListener('fixture:tick', tick);
      globalThis.removeEventListener('fixture:replay', replay);
      globalThis.removeEventListener('fixture:revoke', revoke);
    };
  }, []);
  async function receive(outcome: Reply) {
    const status = await request(outcome);
    if (!alive.current) return;
    const id = `synthetic-${++nextId.current}`;
    const item: ToastMessage =
      status === 202
        ? {
            id,
            outcome: 'queued',
            tone: 'info',
            message: ro
              ? 'Cererea a intrat în coadă. Livrarea nu este confirmată.'
              : 'Запрос в очереди. Доставка не подтверждена.',
          }
        : status === 200
          ? {
              id,
              outcome: 'confirmed',
              tone: 'success',
              message: ro
                ? 'Răspunsul local confirmă rezultatul.'
                : 'Локальный ответ подтвердил результат.',
            }
          : status === 422
            ? {
                id,
                outcome: 'error',
                tone: 'error',
                message: ro ? 'Verifică datele introduse.' : 'Проверь введённые данные.',
              }
            : {
                id,
                outcome: 'unknown',
                tone: 'warning',
                message: ro
                  ? 'Verifică starea cererii înainte de o altă acțiune.'
                  : 'Проверь состояние запроса перед новым действием.',
              };
    last.current = item;
    setItems((prev) => [...prev, item]);
  }
  return (
    <>
      <div className="composite-actions">
        {(['queued', 'unknown', 'error', 'confirmed'] as const).map((outcome) => (
          <Button
            key={outcome}
            data-reply={outcome}
            disabled={!active}
            variant="secondary"
            onClick={() => void receive(outcome)}
          >
            {ro ? 'Răspuns de test' : 'Тестовый ответ'} {statusByReply[outcome]}
          </Button>
        ))}
      </div>
      <p data-ticks>
        {ro ? 'Actualizare locală' : 'Локальное обновление'} {ticks}
      </p>
      {active && (
        <Toast
          label={ro ? 'Rezultatele acțiunilor' : 'Результаты действий'}
          items={items.map((item) => ({ ...item }))}
          onDismiss={(id) => setItems((prev) => prev.filter((item) => item.id !== id))}
        />
      )}
    </>
  );
}
export const RetainedForm = { args: { locale: 'ro' }, render: FormTabs };
export const GuardedForm = { args: { locale: 'ro', guarded: true }, render: FormTabs };
export const Help = { args: { locale: 'ru' }, render: SupplementaryHelp };
export const Information = { args: { locale: 'ro' }, render: InformationCards };
export const Results = { args: { locale: 'ro' }, render: ActionResults };
