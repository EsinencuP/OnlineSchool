import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import {
  Button,
  Dialog,
  Field,
  operationalQueryInterval,
  useContextRefresh,
} from '@online-school/ui';
import { queryClient, useStudentQuery } from '../../../student-cabinet/src/api.js';
import { QueryState } from '../../../student-cabinet/src/components.js';
import { StudentLayout } from '../../../student-cabinet/src/Layout.js';
import { StudentHome } from '../../../student-cabinet/src/pages/StudentHome.js';
import '@online-school/ui/style.css';
import '../../../student-cabinet/src/student.css';

type Sample = { items: string[]; asOf: string };
function useSample(key: string, poll: number | false = false) {
  return useStudentQuery<Sample>(
    [key],
    async ({ signal }) => {
      const response = await fetch(`/fixture-read/${key}`, {
        signal: signal ?? null,
        cache: 'no-store',
      });
      return response.ok
        ? { ok: true, value: (await response.json()) as Sample }
        : { ok: false, error: { code: 'NETWORK_ERROR', status: response.status, message: '' } };
    },
    true,
    poll,
  );
}

function Policy({ live }: { live: boolean }) {
  const data = useSample(live ? 'lesson' : 'dashboard');
  useSample('me', 60_000);
  useSample('reports');
  useContextRefresh({
    enabled: true,
    context: live ? 'live-lesson' : 'operational',
    refresh: () =>
      queryClient.refetchQueries(
        {
          type: 'active',
          predicate: (q) => operationalQueryInterval(q.queryKey) === (live ? 15_000 : 60_000),
        },
        { cancelRefetch: false },
      ),
  });
  return (
    <QueryState
      query={data}
      operational
      empty={data.data?.items.length === 0}
      sourceTimestamp={data.data?.asOf}
    >
      {data.data?.items.length ? <p>{data.data.items[0]}</p> : null}
    </QueryState>
  );
}

function Fixture() {
  const [active, setActive] = useState(true);
  const [open, setOpen] = useState(false);
  return (
    <main style={{ maxWidth: '48rem', margin: '1rem auto', padding: '1rem' }}>
      <h1>Refresh fixture</h1>
      <Field id="draft" label="Draft" />
      <Button id="outside" onClick={() => {}}>
        Outside
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Fixture dialog"
        description="Synthetic read policy"
        trigger={<Button id="open">Open</Button>}
      >
        <Button id="close" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Dialog>
      <Button id="stop" onClick={() => setActive(false)}>
        Stop
      </Button>
      <Button
        id="invalidate"
        onClick={() => void queryClient.invalidateQueries({ queryKey: ['student', 'dashboard'] })}
      >
        Invalidate
      </Button>
      {active && <Policy live={new URLSearchParams(location.search).has('live')} />}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Fixture />} />
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<StudentHome />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
);
