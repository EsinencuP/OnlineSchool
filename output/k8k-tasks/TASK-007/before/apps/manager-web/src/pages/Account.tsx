import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createManagerStudentAccount,
  resetManagerStudentPassword,
  getManagerStudentCard,
} from '@online-school/api-contracts';
import type { StudentAccountIssuedDto } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
import { Check, FormShell, Input, State, text } from '../components/ui.js';
import { ru } from '../i18n/ru.js';
import { displayTime } from '../lib/time.js';
import { useManager } from '../session.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
export default function Account() {
  const id = useParams().id!;
  return <AccountScreen key={id} id={id} />;
}
function AccountScreen({ id }: { id: string }) {
  const me = useManager();
  const command = useCommand();
  const [issued, setIssued] = useState<StudentAccountIssuedDto | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const secretRef = useRef<StudentAccountIssuedDto | null>(null);
  const active = useRef(true);
  const query = useQuery({
    queryKey: ['manager', 'student', id],
    queryFn: ({ signal }) => read((o) => getManagerStudentCard(id, o), signal),
  });
  function clear() {
    if (secretRef.current) secretRef.current.temporaryPassword = null;
    secretRef.current = null;
    setIssued(null);
    setCopyStatus('');
  }
  useEffect(() => {
    active.current = true;
    const hide = () => {
      active.current = false;
      if (secretRef.current) secretRef.current.temporaryPassword = null;
      secretRef.current = null;
      setIssued(null);
    };
    window.addEventListener('pagehide', hide);
    return () => {
      active.current = false;
      if (secretRef.current) secretRef.current.temporaryPassword = null;
      secretRef.current = null;
      window.removeEventListener('pagehide', hide);
    };
  }, [id]);
  async function copy() {
    const password = secretRef.current?.temporaryPassword;
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      if (active.current) setCopyStatus(ru.copied);
    } catch {
      if (active.current) setCopyStatus(ru.copyFailed);
    }
  }
  return (
    <>
      <Link className="back-link" to={routes.student(id)}>
        ← {ru.viewStudent}
      </Link>
      {issued ? (
        <section className="panel secret-screen">
          <h1>{ru.secretTitle}</h1>
          <p>{issued.loginEmail}</p>
          <p className="warning">{ru.secretWarning}</p>
          {issued.temporaryPassword ? (
            <>
              <output className="secret" aria-label={ru.password}>
                {issued.temporaryPassword}
              </output>
              <button
                type="button"
                onClick={() => {
                  void copy();
                }}
              >
                {ru.copy}
              </button>
            </>
          ) : (
            <p>{ru.alreadyIssued}</p>
          )}
          <p role="status">{copyStatus}</p>
          <p>
            {ru.expires}: {displayTime(issued.temporaryPasswordExpiresAt, me.timezone)}
          </p>
          <button type="button" onClick={clear}>
            {ru.done}
          </button>
        </section>
      ) : (
        <>
          <h1>{ru.account}</h1>
          <State query={query}>
            {(s) => (
              <section className="panel narrow">
                <h2>{s.fullName}</h2>
                <p>{ru.accountHelp}</p>
                <FormShell
                  busy={command.busy}
                  error={command.error}
                  button={s.hasAccount ? ru.resetPassword : ru.createAccount}
                  submit={async (f) => {
                    const payload = { loginEmail: text(f, 'loginEmail') };
                    const result = s.hasAccount
                      ? await command.run({ studentId: id, reset: true }, (o) =>
                          resetManagerStudentPassword(id, {}, o),
                        )
                      : await command.run(payload, (o) =>
                          createManagerStudentAccount(id, payload, o),
                        );
                    if (result && active.current) {
                      secretRef.current = result;
                      setIssued(result);
                    }
                  }}
                >
                  {!s.hasAccount && (
                    <Input
                      name="loginEmail"
                      label={ru.email}
                      type="email"
                      required
                      maxLength={254}
                      defaultValue={s.contacts.email ?? ''}
                    />
                  )}
                  {s.hasAccount && (
                    <>
                      <p className="warning">{ru.resetWarning}</p>
                      <Check name="confirm" label={ru.acknowledge} required />
                    </>
                  )}
                </FormShell>
              </section>
            )}
          </State>
        </>
      )}
    </>
  );
}
