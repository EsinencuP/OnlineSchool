import { translate, useLocale } from '../dist/index.js';

translate('ru', 'loading');
translate('ro', 'validation.required', { label: 'Parolă' });
// @ts-expect-error Unknown keys are rejected.
translate('ru', 'missing.key');
// @ts-expect-error An unknown locale cannot be selected by typed code.
translate('en', 'loading');
// @ts-expect-error The required placeholder must be supplied.
translate('ro', 'validation.required');
// @ts-expect-error Placeholder names must match the dictionary contract.
translate('ro', 'validation.required', { field: 'Parolă' });
// @ts-expect-error A plain message accepts no params.
translate('ro', 'loading', { label: 'Parolă' });

export function LocaleTypeFixture() {
  const { t } = useLocale();
  t('validation.required', { label: 'Parolă' });
  // @ts-expect-error The hook uses the same required parameters.
  t('validation.required', {});
}
