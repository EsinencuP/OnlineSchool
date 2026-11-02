// Synthetic component fixture only. Not shipped by any cabinet entry point.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, StateBoundary, useContextRefresh, PriorityEvents } from '../../src/index.js';
import type { BoundaryState } from '../../src/index.js';
import '../../src/style.css';
function Fixture() {
  const [state, setState] = useState<BoundaryState>({ status: 'ready' });
  const [reads, setReads] = useState(0);
  useContextRefresh({
    enabled: true,
    context: 'operational',
    refresh: async () => {
      setReads((value) => value + 1);
    },
  });
  Object.assign(globalThis, { __k8kFixture: { setState } });
  return (
    <AppShell
      role="STUDENT"
      activeId="home"
      renderNavigation={(item, label, props) => (
        <a href={`#${item.id}`} {...props}>
          {label}
        </a>
      )}
      account={<span>Тестовый аккаунт</span>}
    >
      <h1>Проверка поведения компонентов</h1>
      <p>
        Успешных чтений: <output aria-label="Чтения">{reads}</output>
      </p>
      <StateBoundary
        state={state}
        at={Date.UTC(2026, 10, 2, 8)}
        retryRead={() => setReads((value) => value + 1)}
      >
        <label>
          Черновик
          <input aria-label="Черновик" defaultValue="" />
        </label>
        <p>PRIVATE_LESSON</p>
      </StateBoundary>
      <PriorityEvents
        enabled
        source={{
          primary: {
            id: 'b',
            title: 'Синтетическое событие Б',
            action: <a href="#source">Исходный объект</a>,
          },
          criticalCount: 3,
          queueAction: <a href="#queue">Вся очередь</a>,
        }}
      />
    </AppShell>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
