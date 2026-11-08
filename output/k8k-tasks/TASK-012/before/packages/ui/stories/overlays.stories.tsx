// CSF-compatible, UI-only specimens. No SDK, credentials, providers or real commands.
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Drawer,
  DropdownMenu,
  Field,
  Popover,
  StatusChip,
} from '../src/index.js';
import type { OverlayCloseReason } from '../src/index.js';
import './overlays.css';
export default { title: 'UI/Controlled overlays' };
export type OverlayStoryArgs = {
  locale: 'ru' | 'ro';
  kind?: 'dialog' | 'drawer' | 'nonmodal' | 'confirm' | 'popover' | 'menu';
};

export function OverlaySpecimen({ locale, kind = 'dialog' }: OverlayStoryArgs) {
  const ro = locale === 'ro';
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [inner, setInner] = useState(false);
  const [selection, setSelection] = useState('');
  const content = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const title = ro
    ? 'Informații despre numele afișat și păstrarea modificărilor în cabinetul de învățare — explicație detaliată'
    : 'Об имени в кабинете и сохранении изменений — подробное пояснение';
  const description = ro
    ? 'Exemplu sintetic fără date personale sau comenzi reale.'
    : 'Синтетический пример без личных данных и реальных команд.';
  const trigger = (
    <Button data-trigger>
      {ro ? 'Deschide' : 'Открыть'} · {kind}
    </Button>
  );
  const contentProps = {
    onFocus: () => {
      if (content.current) content.current.dataset.refProof = 'connected';
    },
  };
  const common = { open, onOpenChange: setOpen, title, description, trigger, contentProps };
  const body = (
    <>
      <p>
        {ro
          ? 'ȘțĂîâ — text lung pentru verificarea încadrării și a navigării cu tastatura.'
          : 'Длинное пояснение для проверки переноса текста и навигации клавиатурой.'}
      </p>
      <Field
        id="overlay-name"
        label={ro ? 'Nume sintetic' : 'Синтетическое имя'}
        ref={input}
        defaultValue="Synthetic Ștefan"
      />
      <Popover
        open={nested}
        onOpenChange={setNested}
        title={ro ? 'Explicație' : 'Пояснение'}
        description={description}
        trigger={
          <Button data-nested variant="secondary">
            {ro ? 'Explicație suplimentară' : 'Дополнительное пояснение'}
          </Button>
        }
      >
        <Dialog
          open={inner}
          onOpenChange={setInner}
          title={ro ? 'Detalii suplimentare' : 'Дополнительные сведения'}
          description={description}
          trigger={<Button data-inner>{ro ? 'Deschide detaliile' : 'Открыть сведения'}</Button>}
        >
          <Button data-inner-end onClick={() => setInner(false)}>
            {ro ? 'Am înțeles' : 'Понятно'}
          </Button>
        </Dialog>
      </Popover>
      <Button data-last variant="secondary" onClick={() => setOpen(false)}>
        {ro ? 'Am înțeles' : 'Понятно'}
      </Button>
    </>
  );
  return (
    <>
      {kind === 'confirm' ? (
        <ConfirmDialog
          {...common}
          ref={content}
          confirmLabel={ro ? 'Confirmă exemplul' : 'Подтвердить пример'}
          cancelLabel={ro ? 'Anulează' : 'Отмена'}
          onConfirm={() => {
            setSelection('confirmed');
            setOpen(false);
          }}
        />
      ) : kind === 'popover' ? (
        <Popover {...common} ref={content} initialFocusRef={input}>
          {body}
        </Popover>
      ) : kind === 'menu' ? (
        <DropdownMenu
          open={open}
          onOpenChange={setOpen}
          trigger={trigger}
          ref={content}
          contentProps={contentProps}
          label={ro ? 'Acțiuni permise de aplicație' : 'Действия, разрешённые приложением'}
          items={[
            {
              id: 'read',
              label: ro ? 'Arată detaliile' : 'Показать сведения',
              onSelect: () => setSelection('read'),
            },
            {
              id: 'blocked',
              label: ro ? 'Modifică' : 'Изменить',
              disabled: true,
              disabledReason: ro
                ? 'Acțiunea nu este disponibilă în acest context'
                : 'Действие недоступно в этом контексте',
              onSelect: () => setSelection('BAD'),
            },
            {
              id: 'keep',
              label: ro ? 'Păstrează meniul deschis' : 'Оставить меню открытым',
              onSelect: (event) => {
                event.preventDefault();
                setSelection('keep');
              },
            },
          ]}
        />
      ) : kind === 'drawer' ? (
        <Drawer {...common} ref={content} initialFocusRef={input}>
          {body}
        </Drawer>
      ) : (
        <Dialog {...common} ref={content} initialFocusRef={input} modal={kind !== 'nonmodal'}>
          {body}
        </Dialog>
      )}
      <output data-selection>{selection}</output>
    </>
  );
}

/** App-owned close guard and async lifetime. The local harness dispatches synthetic settlement/revoke events. */
export function GuardedOverlay({ locale }: OverlayStoryArgs) {
  const ro = locale === 'ro';
  const [open, setOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'ready' | 'pending' | 'unknown' | 'settled'>('ready');
  const [session, setSession] = useState(true);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState('');
  const active = useRef(true);
  const inFlight = useRef(false);
  const unknown = useRef(false);
  const settle = useRef<(() => void) | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    active.current = true;
    const complete = () => settle.current?.();
    const uncertain = () => {
      if (!active.current || !inFlight.current) return;
      inFlight.current = false;
      unknown.current = true;
      setPhase('unknown');
    };
    const revoke = () => {
      active.current = false;
      // Drop caller-owned private state synchronously with removal of the entire overlay subtree.
      settle.current = null;
      setValue('');
      setDiscard(false);
      setOpen(false);
      setNotice('');
      setSession(false);
    };
    globalThis.addEventListener('fixture:complete', complete);
    globalThis.addEventListener('fixture:unknown', uncertain);
    globalThis.addEventListener('fixture:revoke', revoke);
    return () => {
      active.current = false;
      settle.current = null;
      globalThis.removeEventListener('fixture:complete', complete);
      globalThis.removeEventListener('fixture:unknown', uncertain);
      globalThis.removeEventListener('fixture:revoke', revoke);
    };
  }, []);
  function requestClose(reason: OverlayCloseReason) {
    if (inFlight.current || unknown.current) {
      setNotice(
        ro
          ? `Închiderea este amânată (${reason}). Verifică rezultatul; nu retrimite comanda.`
          : `Закрытие отложено (${reason}). Проверь результат; не отправляй команду повторно.`,
      );
    } else if (value) setDiscard(true);
    else setOpen(false);
  }
  function submit() {
    if (!active.current || inFlight.current || unknown.current) return;
    inFlight.current = true;
    setPhase('pending');
    setNotice('');
    setCount((n) => n + 1);
    const actor = active;
    settle.current = () => {
      if (!actor.current) return;
      inFlight.current = false;
      unknown.current = false;
      settle.current = null;
      setValue('');
      setPhase('settled');
      setNotice('');
      setOpen(false);
    };
  }
  return (
    <>
      <output data-count>{count}</output>
      <output data-phase>{phase}</output>
      {session ? (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          onRequestClose={requestClose}
          initialFocusRef={input}
          title={
            ro
              ? 'Modificări nesalvate — exemplu de ciclu de viață'
              : 'Несохранённый ввод — пример жизненного цикла'
          }
          description={
            ro
              ? 'Doar apelantul decide închiderea și rezultatul comenzii.'
              : 'Закрытие и исход команды определяет вызывающий код.'
          }
          pending={phase === 'pending'}
          trigger={
            <Button data-guard-trigger>{ro ? 'Deschide formularul' : 'Открыть форму'}</Button>
          }
        >
          <p data-private>SYNTHETIC_PRIVATE_CONTENT</p>
          <Field
            id="guard-name"
            ref={input}
            label={ro ? 'Text sintetic' : 'Синтетический текст'}
            value={value}
            disabled={phase === 'pending' || phase === 'unknown'}
            onChange={(e) => setValue(e.target.value)}
          />
          {phase === 'unknown' && (
            <p data-unknown role="status">
              <StatusChip tone="warning">
                {ro
                  ? 'Rezultatul nu este cunoscut. Verifică starea înainte de altă comandă.'
                  : 'Исход неизвестен. Проверь состояние перед новой командой.'}
              </StatusChip>
            </p>
          )}
          {notice && (
            <p data-close-notice role="status">
              {notice}
            </p>
          )}
          <Button
            data-send
            onClick={submit}
            pending={phase === 'pending'}
            disabled={phase === 'unknown'}
            disabledReason={
              ro
                ? 'Nu retrimite comanda; așteaptă sau verifică rezultatul.'
                : 'Не повторяй команду; дождись или проверь результат.'
            }
          >
            {ro ? 'Trimite exemplul local' : 'Отправить локальный пример'}
          </Button>
          <ConfirmDialog
            open={discard}
            onOpenChange={setDiscard}
            returnFocusRef={input}
            title={ro ? 'Renunți la modificări?' : 'Отбросить изменения?'}
            description={
              ro
                ? 'Textul sintetic nesalvat va fi eliminat.'
                : 'Несохранённый синтетический текст будет удалён.'
            }
            confirmLabel={ro ? 'Renunță la modificări' : 'Отбросить изменения'}
            cancelLabel={ro ? 'Continuă editarea' : 'Продолжить ввод'}
            destructive
            onConfirm={() => {
              setValue('');
              setDiscard(false);
              setOpen(false);
            }}
          />
        </Dialog>
      ) : (
        <p data-session role="status">
          {ro ? 'Sesiunea a expirat.' : 'Сессия завершилась.'}
        </p>
      )}
    </>
  );
}
export const Russian = { args: { locale: 'ru' }, render: OverlaySpecimen };
export const Romanian = { args: { locale: 'ro' }, render: OverlaySpecimen };
export const Lifecycle = { args: { locale: 'ro' }, render: GuardedOverlay };

export function AsyncConfirmation({ locale }: OverlayStoryArgs) {
  const ro = locale === 'ro';
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const complete = () => {
      busy.current = false;
      setPending(false);
      setOpen(false);
    };
    globalThis.addEventListener('fixture:complete', complete);
    return () => globalThis.removeEventListener('fixture:complete', complete);
  }, []);
  return (
    <>
      <output data-confirm-count>{count}</output>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        pending={pending}
        onRequestClose={() => {
          if (busy.current) setNotice(true);
          else setOpen(false);
        }}
        title={
          ro
            ? 'Confirmare asincronă — exemplu local'
            : 'Асинхронное подтверждение — локальный пример'
        }
        description={ro ? 'Închiderea nu anulează comanda.' : 'Закрытие не отменяет команду.'}
        confirmLabel={ro ? 'Confirmă' : 'Подтвердить'}
        cancelLabel={ro ? 'Anulează' : 'Отмена'}
        pendingDescription={ro ? 'Așteaptă rezultatul.' : 'Дождись результата.'}
        trigger={
          <Button data-confirm-trigger>
            {ro ? 'Deschide confirmarea' : 'Открыть подтверждение'}
          </Button>
        }
        onConfirm={() => {
          if (!busy.current) {
            busy.current = true;
            setPending(true);
            setCount((n) => n + 1);
          }
        }}
      >
        {notice && (
          <p data-confirm-notice role="status">
            {ro ? 'Așteaptă rezultatul comenzii.' : 'Дождись результата команды.'}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
export const PendingConfirmation = { args: { locale: 'ro' }, render: AsyncConfirmation };
