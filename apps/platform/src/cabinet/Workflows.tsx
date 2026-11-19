import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '@online-school/ui';
import { readableError, request } from './contract.js';
import { useEndpoint } from './hooks.js';
import { LoadState, Status } from './Operations.js';

type Upload = { id?: string; fileId?: string; uploadUrl: string };
type Intent = {
  file: File;
  beginKey: string;
  confirmKey: string;
  staging?: Upload;
  uploaded: boolean;
};
type Attachment = { id: string; name: string };

function privateHttps(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function PrivateUpload({
  homeworkId,
  uploaded,
  disabled,
  onActivityChange,
}: {
  homeworkId?: string;
  uploaded: (file: Attachment) => void;
  disabled?: boolean;
  onActivityChange?: (active: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const intent = useRef<Intent | null>(null);
  const active = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || !file || disabled) return;
    if (file.size < 1 || file.size > 50 * 1024 * 1024) {
      setError('Размер файла должен быть от 1 байта до 50 МБ.');
      return;
    }
    if (intent.current?.file !== file)
      intent.current = {
        file,
        beginKey: crypto.randomUUID(),
        confirmKey: crypto.randomUUID(),
        uploaded: false,
      };
    const current = intent.current;
    const pending = new AbortController();
    active.current = pending;
    onActivityChange?.(true);
    setStatus('Готовим загрузку…');
    setError('');
    try {
      const mimeType = file.type || 'application/octet-stream';
      current.staging ??= await request<Upload>(
        homeworkId ? 'requestStudentHomeworkUpload' : 'requestTeacherMaterialUpload',
        {
          ...(homeworkId ? { params: { hwId: homeworkId } } : {}),
          body: { fileName: file.name, fileSizeBytes: file.size, mimeType },
          signal: pending.signal,
          key: current.beginKey,
        },
      );
      const fileId = current.staging.fileId ?? current.staging.id;
      if (!fileId || !privateHttps(current.staging.uploadUrl)) {
        setError('Сервер не выдал защищённую ссылку.');
        setStatus('');
        return;
      }
      if (!current.uploaded) {
        setStatus('Загружаем файл…');
        const sent = await fetch(current.staging.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': mimeType },
          credentials: 'omit',
          signal: AbortSignal.any([pending.signal, AbortSignal.timeout(120_000)]),
          redirect: 'error',
        });
        if (!sent.ok) {
          if (sent.status === 403) intent.current = null;
          setError('Хранилище отклонило загрузку. Вы можете повторить её.');
          setStatus('');
          return;
        }
        current.uploaded = true;
      }
      setStatus('Проверяем файл…');
      const result = await request<{ fileId?: string; id?: string; status: string }>(
        homeworkId ? 'confirmStudentHomeworkUpload' : 'confirmTeacherMaterialUpload',
        {
          params: { ...(homeworkId ? { hwId: homeworkId } : {}), fileId },
          signal: pending.signal,
          key: current.confirmKey,
        },
      );
      if ((result.fileId ?? result.id) !== fileId || result.status !== 'VERIFIED') {
        setError('Сервер ещё не подтвердил файл.');
        setStatus('');
        return;
      }
      if (pending.signal.aborted) return;
      uploaded({ id: fileId, name: file.name });
      setFile(null);
      intent.current = null;
      if (input.current) input.current.value = '';
      setStatus('Файл проверен и добавлен.');
    } catch (reason) {
      if (!pending.signal.aborted) {
        setError(readableError(reason));
        setStatus('');
      }
    } finally {
      if (active.current === pending) {
        active.current = null;
        if (!pending.signal.aborted) onActivityChange?.(false);
      }
    }
  }

  return (
    <form className="cab-upload" onSubmit={(event) => void upload(event)}>
      <label className="cab-form-label">
        <span>Файл до 50 МБ</span>
        <input
          type="file"
          ref={input}
          disabled={disabled || !!active.current}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button
        className="cab-button cab-secondary"
        type="submit"
        disabled={disabled || !file || !!active.current}
      >
        <Icon name="materials" size={17} /> Прикрепить файл
      </button>
      {!!status && <p role="status">{status}</p>}
      {!!error && (
        <p role="alert" className="cab-form-error">
          {error}
        </p>
      )}
    </form>
  );
}

export function MeetConnection() {
  const result = useEndpoint<{ state: string; available: boolean }>('getTeacherMeetConnection');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const callback = useRef(false);
  useEffect(() => {
    if (callback.current) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return;
    callback.current = true;
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('scope');
    window.history.replaceState({}, '', url.pathname + url.search);
    setBusy(true);
    void request('completeTeacherMeetOAuth', { body: { code, state } })
      .then(() => result.refresh())
      .catch((reason: unknown) => setError(readableError(reason)))
      .finally(() => setBusy(false));
  }, [result]);
  async function connect() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { authorizationUrl } = await request<{ authorizationUrl: string }>(
        'startTeacherMeetOAuth',
      );
      const url = new URL(authorizationUrl);
      if (url.origin !== 'https://accounts.google.com' || url.username || url.password) {
        setError('Сервер не выдал ссылку Google.');
        setBusy(false);
        return;
      }
      window.location.assign(url.href);
    } catch (reason) {
      setError(readableError(reason));
      setBusy(false);
    }
  }
  return (
    <section className="cab-card cab-panel cab-detail">
      <div className="cab-panel-title">
        <h2>Подключение Google Meet</h2>
        <Status value={result.data?.state} />
      </div>
      {result.pending || result.error ? (
        <LoadState refreshing={result.pending} error={result.error} retry={result.refresh} />
      ) : (
        <button
          type="button"
          className="cab-button cab-primary"
          disabled={busy || !result.data?.available || result.data.state !== 'DISCONNECTED'}
          onClick={() => void connect()}
        >
          <Icon name="video" size={18} /> Подключить Google
        </button>
      )}
      {error && (
        <p className="cab-form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
