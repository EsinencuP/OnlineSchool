import { useState } from 'react';
import { Button, Dialog, useLocale } from '@online-school/ui';

/** Read-only first adoption. Profile writes and their command lifecycle remain in Account.tsx. */
export function ProfileHelp() {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const ro = locale === 'ro';
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={ro ? 'Numele afișat în cabinet' : 'Имя в кабинете'}
      description={
        ro
          ? 'Acest nume apare în cabinet. Datele din documentele școlii nu se modifică.'
          : 'Это имя отображается в кабинете. Данные в документах школы не меняются.'
      }
      trigger={
        <Button variant="ghost">{ro ? 'Despre numele afișat' : 'Об имени в кабинете'}</Button>
      }
    >
      <Button variant="secondary" onClick={() => setOpen(false)}>
        {ro ? 'Am înțeles' : 'Понятно'}
      </Button>
    </Dialog>
  );
}
