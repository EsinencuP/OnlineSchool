import { createRoot } from 'react-dom/client';
import { AccountMenu } from '@online-school/account-ui';
import {
  AppShell,
  Field,
  initializeLocale,
  NotificationBell,
  roleNavigation,
  StateBoundary,
  useLocale,
} from '@online-school/ui';
import type { CabinetRole } from '@online-school/ui';
import '@online-school/ui/style.css';
import '@online-school/account-ui/style.css';

const params = new URLSearchParams(window.location.search);
const requestedRole = params.get('role') ?? '';
const role: CabinetRole = Object.hasOwn(roleNavigation, requestedRole)
  ? (requestedRole as CabinetRole)
  : 'STUDENT';
const activeId = params.get('section') ?? roleNavigation[role][0]?.id ?? '';
const name = 'Ștefan Exemplu';

function Fixture() {
  const { locale } = useLocale();
  const ro = locale === 'ro';
  return (
    <AppShell
      role={role}
      activeId={activeId}
      renderNavigation={(item, label, props) => (
        <a href={`#${item.id}`} {...props}>
          {label}
        </a>
      )}
      account={<AccountMenu role={role} name={name} />}
      notifications={
        role === 'STUDENT' && (
          <NotificationBell
            count={2}
            renderLink={(content, label) => (
              <a href="#event-example" className="k8k-bell" aria-label={label}>
                {content}
              </a>
            )}
          />
        )
      }
    >
      <h1>{ro ? 'Exemplu de cabinet' : 'Пример кабинета'}</h1>
      <StateBoundary state={{ status: params.has('denied') ? 'forbidden' : 'ready' }}>
        <Field label={ro ? 'Ciornă locală' : 'Локальный черновик'} id="draft" />
        <label>
          {ro ? 'Obiect selectat' : 'Выбранный объект'}
          <select id="object" defaultValue="a">
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </label>
      </StateBoundary>
    </AppShell>
  );
}
initializeLocale();
createRoot(document.getElementById('root')!).render(<Fixture />);
