import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Dialog,
  Drawer,
  DropdownMenu,
  Popover,
  Tabs,
  Toast,
  IconSwap,
} from '@online-school/ui';
import { AccountMenu } from '@online-school/account-ui';
import '@online-school/ui/style.css';
import '@online-school/account-ui/style.css';

function Fixture() {
  const [popover, setPopover] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState('one');
  const [success, setSuccess] = useState(false);
  const [icon, setIcon] = useState(false);
  return (
    <main style={{ padding: 24, maxWidth: 680 }}>
      <h1>Проверка движений</h1>
      <Button id="press">Нажать</Button>
      <Button disabled id="disabled">
        Недоступно
      </Button>
      <Popover
        open={popover}
        onOpenChange={setPopover}
        title="Подробности"
        description="Локальный пример"
        trigger={<Button id="popover-trigger">Открыть popover</Button>}
        contentProps={{ side: 'bottom', align: 'start' }}
      >
        <p>Появление от кнопки</p>
        <Button onClick={() => setPopover(false)}>Готово</Button>
      </Popover>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Диалог"
        description="Фокус остаётся внутри"
        trigger={<Button id="dialog-trigger">Открыть диалог</Button>}
      >
        <label>
          Имя
          <input autoComplete="off" />
        </label>
      </Dialog>
      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title="Панель"
        description="Локальная панель"
        trigger={<Button id="drawer-trigger">Открыть панель</Button>}
      >
        <p>Содержимое панели</p>
      </Drawer>
      <DropdownMenu
        open={menu}
        onOpenChange={setMenu}
        label="Действия"
        trigger={<Button>Открыть меню</Button>}
        items={[
          { id: 'one', label: 'Первое действие', onSelect: () => {} },
          { id: 'two', label: 'Второе действие', onSelect: () => {} },
        ]}
      />
      <AccountMenu name="Пример" role="STUDENT" />
      <Tabs
        label="Пример вкладок"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: 'one',
            label: 'Первая',
            content: (
              <label>
                Черновик
                <input id="draft" defaultValue="Сохранённый текст" />
              </label>
            ),
          },
          { value: 'two', label: 'Вторая', content: <p>Вторая вкладка</p> },
        ]}
      />
      <ul data-motion-list className="k8k-student-list">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>Строка {i + 1}</li>
        ))}
      </ul>
      <Button onClick={() => setSuccess(true)}>Подтвердить успех</Button>
      <Toast
        label="Результаты"
        items={
          success
            ? [
                { id: 'confirmed', outcome: 'confirmed', tone: 'success', message: 'Сохранено' },
                {
                  id: 'unknown',
                  outcome: 'unknown',
                  tone: 'warning',
                  message: 'Результат неизвестен',
                },
              ]
            : []
        }
        onDismiss={() => setSuccess(false)}
      />
      <Button id="swap" onClick={() => setIcon(!icon)}>
        <IconSwap name={icon ? 'check' : 'clock'} />
        Сменить иконку
      </Button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
