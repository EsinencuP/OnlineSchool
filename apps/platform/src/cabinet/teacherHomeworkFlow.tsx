import type { HomeworkCopy } from './teacherHomeworkCopy.js';

export function HomeworkCommandFeedback({
  t,
  command,
}: {
  t: HomeworkCopy;
  command: {
    error: keyof HomeworkCopy | null;
    unresolved: boolean;
    busy: boolean;
    retry: () => void;
  };
}) {
  return (
    <>
      {command.error && (
        <p className="cab-form-error" role="alert">
          {String(t[command.error])}
        </p>
      )}
      {command.unresolved && command.error !== 'retryExpired' && (
        <div className="cab-empty cab-teacher-homework-feedback">
          <p role="status">{t.unknown}</p>
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={command.busy}
            onClick={command.retry}
          >
            {command.busy ? t.submitting : t.retry}
          </button>
        </div>
      )}
    </>
  );
}
