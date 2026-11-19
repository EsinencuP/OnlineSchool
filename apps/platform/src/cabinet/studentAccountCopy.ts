import { useLocale } from '@online-school/ui';
import { CabinetError } from './contract.js';

const copy = {
  profile: ['Профиль', 'Profil'],
  security: ['Безопасность', 'Securitate'],
  alias: ['Имя в кабинете', 'Numele din cabinet'],
  aliasHint: [
    'Это имя видно в учебном кабинете.',
    'Acest nume este afișat în cabinetul de studiu.',
  ],
  email: ['Почта для входа', 'E-mail de conectare'],
  timezone: ['Часовой пояс', 'Fus orar'],
  edit: ['Настройки профиля', 'Setări de profil'],
  avatar: ['Аватар', 'Avatar'],
  avatarId: ['UUID проверенного файла', 'UUID-ul fișierului verificat'],
  avatarHint: [
    'Вы можете указать UUID своего проверенного файла JPEG, PNG или WebP до 2 МБ.',
    'Poți indica UUID-ul propriului fișier JPEG, PNG sau WebP verificat, de până la 2 MB.',
  ],
  invalidAvatar: ['Проверьте UUID файла аватара.', 'Verifică UUID-ul fișierului avatar.'],
  avatarDenied: [
    'Этот файл недоступен для аватара.',
    'Acest fișier nu poate fi folosit ca avatar.',
  ],
  invalidName: [
    'Укажите имя длиной от 1 до 100 символов.',
    'Introdu un nume de la 1 la 100 de caractere.',
  ],
  save: ['Сохранить профиль', 'Salvează profilul'],
  saved: ['Профиль обновлён.', 'Profilul a fost actualizat.'],
  busy: ['Подождите…', 'Așteaptă…'],
  profileUnknown: [
    'Результат сохранения пока неизвестен. Можно повторить исходное сохранение.',
    'Rezultatul salvării este încă necunoscut. Poți repeta salvarea inițială.',
  ],
  retryProfile: ['Повторить сохранение', 'Repetă salvarea'],
  changePassword: ['Сменить пароль', 'Schimbă parola'],
  initialTitle: ['Смените временный пароль', 'Schimbă parola temporară'],
  initialHint: [
    'Установите свой пароль для входа в учебный кабинет.',
    'Alege propria parolă pentru a intra în cabinet.',
  ],
  passwordHint: [
    'От 8 до 128 символов, хотя бы одна латинская буква и одна цифра.',
    'Între 8 și 128 de caractere, cel puțin o literă latină și o cifră.',
  ],
  passwordPanel: ['Пароль', 'Parolă'],
  passwordHelp: [
    'После смены пароля другие сессии будут завершены.',
    'După schimbarea parolei, celelalte sesiuni vor fi închise.',
  ],
  currentPassword: ['Текущий пароль', 'Parola actuală'],
  newPassword: ['Новый пароль', 'Parola nouă'],
  confirmPassword: ['Повторите новый пароль', 'Repetă parola nouă'],
  mismatch: ['Новые пароли не совпадают.', 'Parolele noi nu coincid.'],
  samePassword: [
    'Новый пароль должен отличаться от текущего.',
    'Parola nouă trebuie să difere de cea actuală.',
  ],
  wrongPassword: ['Текущий пароль неверен.', 'Parola actuală este incorectă.'],
  backSecurity: ['К безопасности', 'Înapoi la securitate'],
  emailChange: ['Смена почты', 'Schimbarea e-mailului'],
  emailHelp: [
    'Подтвердите новый адрес кодом из письма.',
    'Confirmă adresa nouă cu codul din e-mail.',
  ],
  newEmail: ['Новая почта', 'E-mail nou'],
  sameEmail: ['Укажите другой адрес для входа.', 'Introdu o altă adresă de conectare.'],
  requestCode: ['Получить код', 'Obține codul'],
  codeSent: ['Код отправлен на новый адрес.', 'Codul a fost trimis la adresa nouă.'],
  deliveryUnknown: [
    'Доставка кода пока не подтверждена. Если письмо пришло, введите код.',
    'Livrarea codului nu este confirmată. Dacă ai primit e-mailul, introdu codul.',
  ],
  emailUnavailable: [
    'Этот адрес недоступен для входа.',
    'Această adresă nu este disponibilă pentru conectare.',
  ],
  emailInactive: [
    'Отправка кода сейчас недоступна.',
    'Trimiterea codului nu este disponibilă acum.',
  ],
  superseded: [
    'Запрошен более новый код. Используйте последнее письмо или запросите код снова.',
    'A fost cerut un cod mai nou. Folosește ultimul e-mail sau solicită un cod nou.',
  ],
  code: ['Код из письма', 'Codul din e-mail'],
  invalidCode: ['Код неверен или срок его действия истёк.', 'Codul este incorect sau a expirat.'],
  confirmEmail: ['Подтвердить почту', 'Confirmă e-mailul'],
  restartEmail: ['Запросить новый код', 'Solicită un cod nou'],
  sessions: ['Активные сессии', 'Sesiuni active'],
  sessionsEmpty: ['Активных сессий пока нет.', 'Nu există sesiuni active.'],
  currentSession: ['Текущая сессия', 'Sesiunea curentă'],
  otherSession: ['Другая сессия', 'Altă sesiune'],
  browserUnknown: ['Браузер не указан', 'Browser nespecificat'],
  address: ['IP-адрес', 'Adresă IP'],
  addressUnknown: ['Адрес не зафиксирован', 'Adresa nu a fost înregistrată'],
  created: ['Вход', 'Conectare'],
  activity: ['Последняя активность', 'Ultima activitate'],
  revoke: ['Завершить сессию', 'Închide sesiunea'],
  revokeHint: [
    'На этом устройстве потребуется войти снова.',
    'Pe acest dispozitiv va fi necesară o nouă conectare.',
  ],
  revoked: ['Сессия завершена.', 'Sesiunea a fost închisă.'],
  sessionUnknown: [
    'Результат завершения сессии пока неизвестен. Проверьте список сессий перед повтором.',
    'Rezultatul închiderii sesiunii este încă necunoscut. Verifică lista înainte de a repeta.',
  ],
  sessionGone: ['Сессия уже недоступна.', 'Sesiunea nu mai este disponibilă.'],
  sessionCurrent: [
    'Текущую сессию можно завершить кнопкой выхода.',
    'Poți închide sesiunea curentă folosind butonul de deconectare.',
  ],
  cancel: ['Отмена', 'Anulează'],
  refresh: ['Обновить список', 'Actualizează lista'],
  unavailable: ['Данные сейчас недоступны.', 'Datele nu sunt disponibile acum.'],
  rate: ['Слишком много попыток. Попробуйте позже.', 'Prea multe încercări. Încearcă mai târziu.'],
  failed: [
    'Действие сейчас недоступно. Попробуйте ещё раз.',
    'Acțiunea nu este disponibilă acum. Încearcă din nou.',
  ],
} as const;

export type AccountMessage = keyof typeof copy;
export const studentPasswordPath = '/student/security/change-password';

export function useAccountCopy() {
  const { locale } = useLocale();
  return { locale, text: (key: AccountMessage) => copy[key][locale === 'ro' ? 1 : 0] };
}

const commandErrors: Partial<Record<string, AccountMessage>> = {
  CURRENT_PASSWORD_INVALID: 'wrongPassword',
  PASSWORD_MUST_DIFFER: 'samePassword',
  PASSWORD_UNCHANGED: 'samePassword',
  AVATAR_FILE_FORBIDDEN: 'avatarDenied',
  EMAIL_NOT_CONFIGURED: 'emailInactive',
  EMAIL_UNAVAILABLE: 'emailUnavailable',
  EMAIL_REQUEST_SUPERSEDED: 'superseded',
  EMAIL_OTP_INVALID: 'invalidCode',
  SESSION_NOT_FOUND: 'sessionGone',
  CURRENT_SESSION_CANNOT_BE_REVOKED: 'sessionCurrent',
};

export function accountFailure(error: unknown): AccountMessage {
  if (!(error instanceof CabinetError)) return 'failed';
  return commandErrors[error.issue.code] ?? (error.issue.status === 429 ? 'rate' : 'failed');
}

export function accountOutcomeUnknown(error: unknown) {
  return (
    !(error instanceof CabinetError) ||
    error.issue.status === 0 ||
    error.issue.status >= 500 ||
    (error.issue.status >= 200 && error.issue.status < 300) ||
    error.issue.code === 'COMMAND_IN_PROGRESS'
  );
}
