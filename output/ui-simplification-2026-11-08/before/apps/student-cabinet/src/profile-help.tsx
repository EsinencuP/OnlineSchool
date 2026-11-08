import { useState } from 'react';
import { Button, Dialog } from '@online-school/ui';
import { useStudentLocale } from './student-locale.js';

/** Read-only first adoption. Profile writes and their command lifecycle remain in Account.tsx. */
export function ProfileHelp() {
  const [open, setOpen] = useState(false);
  const { t } = useStudentLocale();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('student.aliasTitle')}
      description={t('student.aliasHelp')}
      trigger={<Button variant="ghost">{t('student.aliasAbout')}</Button>}
    >
      <Button variant="secondary" onClick={() => setOpen(false)}>
        {t('student.understood')}
      </Button>
    </Dialog>
  );
}
