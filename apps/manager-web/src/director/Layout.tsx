import { Gavel, LayoutGrid, Users, Wallet } from 'lucide-react';
import { useManager } from '../manager/store';
import { Shell } from '../shared/Shell';
import { allDecisions } from './logic';
import { useDirector } from './store';

export function DirectorLayout() {
  const { state, toasts, dismiss, reset } = useDirector();
  const manager = useManager();
  const decisions = allDecisions(state, manager.state).length;
  const openEsc = state.escalations.filter((e) => e.state === 'OPEN').length;
  // Toasts from both stores: a payment decision runs in the manager store.
  const allToasts = [...toasts, ...manager.toasts.map((t) => ({ ...t, id: -t.id }))];

  return (
    <Shell
      role="director"
      now={state.now}
      person={{ name: state.me.displayName, caption: 'Руководитель академии' }}
      search={{ placeholder: 'Найти сотрудника…', to: '/director/team' }}
      bell={{ count: decisions, to: '/director/decisions', label: `Решения: ${decisions} ждут` }}
      toasts={allToasts}
      dismiss={(id) => (id < 0 ? manager.dismiss(-id) : dismiss(id))}
      onReset={() => {
        reset();
        manager.reset();
      }}
      nav={[
        { group: 'Управление', to: '/director', label: 'Обзор', icon: <LayoutGrid size={18} /> },
        { group: 'Управление', to: '/director/decisions', label: 'Решения', icon: <Gavel size={18} />, count: decisions },
        { group: 'Управление', to: '/director/team', label: 'Команда', icon: <Users size={18} />, count: openEsc },
        { group: 'Управление', to: '/director/finance', label: 'Финансы', icon: <Wallet size={18} /> },
      ]}
    />
  );
}
