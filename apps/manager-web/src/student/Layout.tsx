import { Bell, BookOpen, CalendarDays, FileText, FolderOpen, House, MessageCircle, NotebookPen, Sparkles, Ticket } from 'lucide-react';
import { Shell } from '../shared/Shell';
import { useStudent } from './store';

export function StudentLayout() {
  const { state, toasts, dismiss, reset } = useStudent();
  const unread = state.notifications.filter((n) => !n.isRead).length;
  const hwTodo = state.homework.filter((h) => h.status === 'NOT_SUBMITTED' || h.status === 'NEEDS_REVISION').length;
  const newReports = state.reports.filter((r) => r.isNew).length;
  const manager = state.me.managerContacts;

  return (
    <Shell
      role="student"
      now={state.now}
      person={{ name: state.me.displayName, caption: `Ученица · ${state.me.grade} класс` }}
      search={{ placeholder: 'Найти задание или материал…', to: '/student/materials' }}
      bell={{ count: unread, to: '/student/notifications', label: `Уведомления: ${unread} новых` }}
      toasts={toasts}
      dismiss={dismiss}
      onReset={reset}
      nav={[
        { group: 'Учёба', to: '/student', label: 'Главная', icon: <House size={18} /> },
        { group: 'Учёба', to: '/student/lessons', label: 'Уроки', icon: <CalendarDays size={18} /> },
        { group: 'Учёба', to: '/student/homework', label: 'Задания', icon: <NotebookPen size={18} />, count: hwTodo },
        { group: 'Учёба', to: '/student/progress', label: 'Навыки и цели', icon: <Sparkles size={18} /> },
        { group: 'Учёба', to: '/student/reports', label: 'Отчёты', icon: <FileText size={18} />, count: newReports },
        { group: 'Учёба', to: '/student/materials', label: 'Материалы', icon: <FolderOpen size={18} /> },
        { group: 'Аккаунт', to: '/student/subscription', label: 'Абонементы', icon: <Ticket size={18} /> },
        { group: 'Аккаунт', to: '/student/notifications', label: 'Уведомления', icon: <Bell size={18} />, count: unread },
      ]}
      sidebarExtra={
        <div className="help-card">
          <span className="help-ico" aria-hidden="true">
            <MessageCircle size={18} />
          </span>
          <b>Нужна помощь?</b>
          <span>Перенос, оплата и вопросы по расписанию — через менеджера{manager.displayName ? `: ${manager.displayName}` : ''}.</span>
          {manager.whatsapp || manager.telegram ? (
            <a className="btn btn-accent btn-sm" href={manager.telegram || manager.whatsapp}>Написать</a>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>
              <BookOpen size={12} /> Контакты появятся, когда школа их настроит.
            </span>
          )}
        </div>
      }
    />
  );
}
