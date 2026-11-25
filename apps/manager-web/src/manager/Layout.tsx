import { CalendarDays, ClipboardList, CreditCard, Filter, LayoutGrid, Users } from 'lucide-react';
import { Shell } from '../shared/Shell';
import { useManager } from './store';

export function ManagerLayout() {
  const { state, toasts, dismiss, reset } = useManager();
  const open = state.tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const overdue = open.filter((t) => t.isOverdue).length;

  return (
    <Shell
      role="manager"
      now={state.now}
      person={{ name: state.me.displayName, caption: `Менеджер · ${state.me.portfolioSize} учеников` }}
      search={{ placeholder: 'Найти ученика или родителя…', to: '/manager/students' }}
      bell={{ count: overdue, to: '/manager/tasks', label: `Задачи: ${overdue} просрочено` }}
      toasts={toasts}
      dismiss={dismiss}
      onReset={reset}
      nav={[
        { group: 'Работа', to: '/manager', label: 'Обзор', icon: <LayoutGrid size={18} /> },
        { group: 'Работа', to: '/manager/leads', label: 'Заявки', icon: <Filter size={18} />, count: state.leads.filter((l) => l.stage === 'NEW').length },
        { group: 'Работа', to: '/manager/students', label: 'Ученики', icon: <Users size={18} /> },
        { group: 'Работа', to: '/manager/tasks', label: 'Задачи', icon: <ClipboardList size={18} />, count: overdue },
        { group: 'Работа', to: '/manager/schedule', label: 'Расписание', icon: <CalendarDays size={18} /> },
        { group: 'Работа', to: '/manager/payments', label: 'Платежи', icon: <CreditCard size={18} />, count: state.payments.filter((p) => p.status === 'PENDING').length },
      ]}
    />
  );
}
