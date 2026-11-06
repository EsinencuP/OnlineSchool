import { useState } from 'react';
import { ErrorFeedback, ErrorForm, Field, useLocale } from '../src/index.js';
export default { title: 'UI/Error feedback' };
export const Rejected = {
  render: () => (
    <ErrorFeedback
      error={{ code: 'INVALID_MONEY', status: 422 }}
      amount={{ value: '9007199254740993.0001', currency: 'MDL' }}
    />
  ),
};
export const UnknownCommand = {
  render: () => <ErrorFeedback error={{ code: 'NETWORK_ERROR', status: 0, operation: 'write' }} />,
};
export const Validation = {
  render: function ValidationExample() {
    const { t } = useLocale();
    const [error, setError] = useState<unknown>(null);
    return (
      <ErrorForm
        error={error}
        onSubmit={(event) => {
          event.preventDefault();
          setError({ code: 'EMAIL_ALREADY_USED', status: 409, details: { fields: ['newEmail'] } });
        }}
      >
        <Field name="newEmail" label={t('auth.email')} required type="email" />
        <ErrorFeedback error={error} />
        <button type="submit">{t('errors.save')}</button>
      </ErrorForm>
    );
  },
};
