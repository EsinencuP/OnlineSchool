import { BookOpenCheck, CalendarDays, ClipboardCheck, FolderOpen, House, NotebookPen, Users, Wallet } from 'lucide-react';
import { Shell } from '../shared/Shell';
import { selectJournal } from './logic';
import { useTeacher } from './store';

export function TeacherLayout() {
  const { state, toasts, dismiss, reset } = useTeacher();
  const awaitingReport = selectJournal(state).filter((j) => j.state === 'AWAITING_REPORT').length;
  const toReview = state.homework.filter((h) => h.state === 'AWAITING_REVIEW').length;
  const checkpoints = state.checkpoints.filter((c) => c.state === 'PENDING').length;
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <Shell
      role="teacher"
      now={state.now}
      person={{ name: state.me.displayName, caption: `${state.me.subjects.join(', ')} · ${state.me.activeStudentCount} учеников` }}
      search={{ placeholder: 'Найти ученика…', to: '/teacher/students' }}
      bell={{ count: unread, to: '/teacher', label: `Уведомления: ${unread} новых` }}
      toasts={toasts}
      dismiss={dismiss}
      onReset={reset}
      nav={[
        { group: 'Работа', to: '/teacher', label: 'Сегодня', icon: <House size={18} /> },
        { group: 'Работа', to: '/teacher/schedule', label: 'Расписание', icon: <CalendarDays size={18} /> },
        { group: 'Работа', to: '/teacher/journal', label: 'Журнал уроков', icon: <BookOpenCheck size={18} />, count: awaitingReport },
        { group: 'Ученики', to: '/teacher/students', label: 'Ученики', icon: <Users size={18} /> },
        { group: 'Ученики', to: '/teacher/homework', label: 'Задания', icon: <NotebookPen size={18} />, count: toReview },
        { group: 'Ученики', to: '/teacher/checkpoints', label: 'Контрольные точки', icon: <ClipboardCheck size={18} />, count: checkpoints },
        { group: 'Ученики', to: '/teacher/materials', label: 'Материалы', icon: <FolderOpen size={18} /> },
        { group: 'Финансы', to: '/teacher/payroll', label: 'Начисления', icon: <Wallet size={18} /> },
      ]}
    />
  );
}
