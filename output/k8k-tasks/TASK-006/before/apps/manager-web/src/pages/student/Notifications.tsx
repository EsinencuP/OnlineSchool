import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listManagerStudentNotifications,
  sendManagerStudentNotification,
} from '@online-school/api-contracts';
import type { ListManagerStudentNotificationsParams } from '@online-school/api-contracts';
import { read } from '../../api/client.js';
import { useCommand } from '../../hooks/use-command.js';
import { useManager } from '../../session.js';
import {
  Badge,
  State,
  Dialog,
  FormShell,
  Input,
  Select,
  TextArea,
  text,
  enumOptions,
} from '../../components/ui.js';
import { displayTime } from '../../lib/time.js';
import { ru, label } from '../../i18n/ru.js';
import { ERROR_MESSAGES } from '../../i18n/error-messages.js';
export default function Notifications({ studentId }: { studentId: string }) {
  const me = useManager();
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [compose, setCompose] = useState(false);
  const query = useQuery({
    queryKey: ['manager', 'notifications', studentId, status, cursor],
    queryFn: ({ signal }) =>
      read(
        (o) =>
          listManagerStudentNotifications(
            studentId,
            {
              limit: 25,
              ...(status
                ? { status: status as NonNullable<ListManagerStudentNotificationsParams['status']> }
                : {}),
              ...(cursor ? { cursor } : {}),
            },
            o,
          ),
        signal,
      ),
    refetchInterval: (q) =>
      q.state.data?.items.some((n) => n.status === 'QUEUED') ? 10_000 : false,
  });
  return (
    <>
      <div className="section-heading">
        <h2>{ru.notifications}</h2>
        <button className="primary" type="button" onClick={() => setCompose(true)}>
          + {ru.sendNotification}
        </button>
      </div>
      <div className="filters">
        <Select
          name="notificationStatus"
          label={ru.status}
          options={enumOptions(['QUEUED', 'SENT', 'FAILED'])}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor(undefined);
          }}
        />
        <button
          type="button"
          onClick={() => {
            void query.refetch();
          }}
        >
          {ru.refresh}
        </button>
      </div>
      <State query={query} empty={query.data?.items.length === 0}>
        {(d) => (
          <>
            <ul className="record-cards">
              {d.items.map((n) => (
                <li key={n.notificationId}>
                  <div className="section-heading">
                    <strong>{label(n.channel)}</strong>
                    <Badge value={n.status} />
                  </div>
                  <p>
                    {ru.createdAt}: {displayTime(n.createdAt, me.timezone)}
                  </p>
                  {n.sentAt && (
                    <p>
                      {ru.sentAt}: {displayTime(n.sentAt, me.timezone)}
                    </p>
                  )}
                  {n.failureReason && (
                    <p>
                      {ru.notificationFailure}:{' '}
                      {Object.hasOwn(ERROR_MESSAGES, n.failureReason)
                        ? ERROR_MESSAGES[n.failureReason as keyof typeof ERROR_MESSAGES]
                        : ru.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="pagination">
              {cursor && (
                <button type="button" onClick={() => setCursor(undefined)}>
                  {ru.firstPage}
                </button>
              )}
              {d.nextCursor && (
                <button type="button" onClick={() => setCursor(d.nextCursor!)}>
                  {ru.next}
                </button>
              )}
            </div>
          </>
        )}
      </State>
      {compose && <Compose studentId={studentId} close={() => setCompose(false)} />}
    </>
  );
}
function Compose({ studentId, close }: { studentId: string; close: () => void }) {
  const command = useCommand();
  const [channel, setChannel] = useState<'EMAIL' | 'IN_APP'>('IN_APP');
  const [sent, setSent] = useState(false);
  return (
    <Dialog
      title={ru.sendNotification}
      close={() => {
        if (!command.busy) close();
      }}
    >
      {sent ? (
        <>
          <p role="status">{ru.queued}</p>
          <button type="button" onClick={close}>
            {ru.done}
          </button>
        </>
      ) : (
        <FormShell
          busy={command.busy}
          error={command.error}
          button={ru.sendNotification}
          submit={async (f) => {
            const payload = {
              channel,
              body: text(f, 'body'),
              ...(channel === 'EMAIL' ? { subject: text(f, 'subject') } : {}),
            };
            const result = await command.run(payload, (o) =>
              sendManagerStudentNotification(studentId, payload, o),
            );
            if (result) setSent(true);
          }}
        >
          <p className="hint">{ru.notificationHelp}</p>
          <Select
            name="channel"
            label={ru.channel}
            placeholder={false}
            options={enumOptions(['IN_APP', 'EMAIL'])}
            value={channel}
            onChange={(e) => setChannel(e.target.value as 'IN_APP' | 'EMAIL')}
          />
          {channel === 'EMAIL' && (
            <Input name="subject" label={ru.subject} required maxLength={150} />
          )}
          <TextArea name="body" label={ru.body} required minLength={1} maxLength={2000} rows={7} />
        </FormShell>
      )}
    </Dialog>
  );
}
