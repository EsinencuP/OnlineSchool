import { useLocale } from '@online-school/ui';

const studyCopy = {
  back: ['К расписанию', 'Înapoi la orar'],
  details: ['Урок', 'Lecție'],
  unknowable: ['Данные урока недоступны.', 'Datele lecției nu sunt disponibile.'],
  loading: ['Загружаем…', 'Se încarcă…'],
  refresh: ['Обновить данные', 'Actualizează datele'],
  join: ['Войти в урок', 'Intră la lecție'],
  meetWaiting: [
    'Когда вход в урок станет доступен, здесь появится кнопка подключения.',
    'Butonul de conectare va apărea când accesul la lecție va fi disponibil.',
  ],
  movedFrom: ['Первоначальное время', 'Ora inițială'],
  minutes: ['мин', 'min'],
  history: ['Итог и списание', 'Rezultat și deducere'],
  emptyHistory: ['Подтверждённого итога пока нет.', 'Nu există încă un rezultat confirmat.'],
  deducted: ['Урок списан', 'Lecție dedusă'],
  notDeducted: ['Действующего списания нет', 'Fără deducere activă'],
  before: ['Уроков до списания', 'Lecții înainte de deducere'],
  after: ['Уроков после списания', 'Lecții după deducere'],
  balanceUnknown: ['Остаток неизвестен', 'Sold necunoscut'],
  reschedule: ['Запросить перенос', 'Cere reprogramarea'],
  dispute: ['Оспорить списание', 'Contestă deducerea'],
  rescheduleHint: [
    'Предложите дату и укажите причину. Время урока изменится после подтверждения менеджером.',
    'Propune o dată și indică motivul. Ora lecției se va schimba după confirmarea managerului.',
  ],
  disputeHint: [
    'Опишите ситуацию. Менеджер рассмотрит списание за этот урок.',
    'Descrie situația. Managerul va analiza deducerea pentru această lecție.',
  ],
  rescheduleSent: [
    'Запрос на перенос передан менеджеру.',
    'Cererea de reprogramare a fost transmisă managerului.',
  ],
  disputeSent: [
    'Спор передан менеджеру на рассмотрение.',
    'Contestația a fost transmisă managerului pentru analiză.',
  ],
  preferredDate: ['Желаемая дата', 'Data dorită'],
  reason: ['Причина', 'Motiv'],
  description: ['Что произошло', 'Ce s-a întâmplat'],
  submit: ['Отправить запрос', 'Trimite cererea'],
  check: ['Проверить результат', 'Verifică rezultatul'],
  retryRequest: ['Повторить отправку', 'Trimite din nou'],
  reference: ['Номер обращения', 'Numărul cererii'],
  pending: ['Отправляем запрос…', 'Cererea se trimite…'],
  unknown: [
    'Результат отправки пока неизвестен. Проверьте его по номеру операции.',
    'Rezultatul trimiterii este încă necunoscut. Verifică-l după numărul operațiunii.',
  ],
  notConfirmed: [
    'Сервер пока не подтвердил создание обращения.',
    'Serverul nu a confirmat încă înregistrarea cererii.',
  ],
  actionUnavailable: [
    'Действие сейчас недоступно. Обновите данные урока.',
    'Acțiunea nu este disponibilă acum. Actualizează datele lecției.',
  ],
  alreadyOpen: [
    'По этому уроку уже есть открытый спор.',
    'Există deja o contestație deschisă pentru această lecție.',
  ],
  invalid: ['Проверьте дату и длину текста.', 'Verifică data și lungimea textului.'],
  done: ['Закрыть', 'Închide'],
  removeFile: ['Убрать файл', 'Elimină fișierul'],
  homework: ['Домашние задания урока', 'Temele lecției'],
  materials: ['Материалы урока', 'Materialele lecției'],
  emptyHomework: ['К уроку пока нет домашних заданий.', 'Lecția nu are încă teme.'],
  emptyMaterials: [
    'К уроку пока нет доступных материалов.',
    'Lecția nu are încă materiale disponibile.',
  ],
  prepareFile: ['Получить ссылку', 'Obține linkul'],
  openFile: ['Открыть файл', 'Deschide fișierul'],
  downloadFile: ['Скачать файл', 'Descarcă fișierul'],
  fileUnavailable: [
    'Ссылка недоступна. Проверьте доступ к материалу.',
    'Linkul nu este disponibil. Verifică accesul la material.',
  ],
  previous: ['Предыдущая страница', 'Pagina precedentă'],
  next: ['Следующая страница', 'Pagina următoare'],
  assignmentFiles: ['Файлы задания', 'Fișierele temei'],
  fileHint: [
    'Общие файлы преподавателя доступны в разделе материалов.',
    'Fișierele partajate de profesor sunt disponibile în secțiunea Materiale.',
  ],
  review: ['Комментарий преподавателя', 'Comentariul profesorului'],
  versions: ['История отправок', 'Istoricul trimiterilor'],
  version: ['Версия', 'Versiune'],
  emptyVersions: ['Работа ещё не отправлена.', 'Tema nu a fost încă trimisă.'],
  deadline: ['Сдать до', 'Termen de predare'],
  late: ['Сдано после срока', 'Trimis după termen'],
  suspended: ['Доступ к кабинету приостановлен', 'Accesul la cont este suspendat'],
  suspendedHint: [
    'Свяжитесь с менеджером, чтобы уточнить условия восстановления доступа.',
    'Contactează managerul pentru a afla condițiile de restabilire a accesului.',
  ],
  managerContacts: ['Контакты менеджера', 'Contactele managerului'],
  noContacts: [
    'Контакты менеджера пока недоступны.',
    'Contactele managerului nu sunt disponibile acum.',
  ],
  scheduled: ['Запланирован', 'Programată'],
  completed: ['Урок проведён', 'Lecție desfășurată'],
  cancelled: ['Отменён', 'Anulată'],
  noShow: ['Неявка', 'Neprezentare'],
  disputed: ['На разборе', 'În curs de analiză'],
  renewal: ['Ожидает продления', 'În așteptarea reînnoirii'],
  notSubmitted: ['Не сдано', 'Netrimisă'],
  submitted: ['Сдано', 'Trimisă'],
  reviewed: ['Проверено', 'Verificată'],
  needsRevision: ['На доработке', 'De revizuit'],
  answer: ['Ответ', 'Răspuns'],
  saveDraft: ['Сохранить черновик', 'Salvează ciorna'],
  sendAssignment: ['Сдать задание', 'Trimite tema'],
  saved: ['Черновик сохранён.', 'Ciorna a fost salvată.'],
  assignmentSent: ['Задание сдано.', 'Tema a fost trimisă.'],
  assignmentUnknown: [
    'Статус отправки неизвестен. Проверьте, появилась ли новая версия.',
    'Starea trimiterii este necunoscută. Verifică dacă a apărut o versiune nouă.',
  ],
  sendAgain: ['Повторить исходную отправку', 'Repetă trimiterea inițială'],
  assignmentError: [
    'Задание сейчас не удалось сохранить. Проверьте ответ и доступ.',
    'Tema nu a putut fi salvată. Verifică răspunsul și accesul.',
  ],
} as const;

export type StudyMessage = keyof typeof studyCopy;
export type StudyText = (key: StudyMessage) => string;
export function useStudy() {
  const { locale } = useLocale();
  return { locale, text: (key: StudyMessage) => studyCopy[key][locale === 'ro' ? 1 : 0] };
}

const statusMessages: Record<string, StudyMessage> = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'noShow',
  STAR_PENDING: 'renewal',
  DISPUTED: 'disputed',
  NOT_SUBMITTED: 'notSubmitted',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  NEEDS_REVISION: 'needsRevision',
};

export function studyStatus(value: string, text: StudyText) {
  return statusMessages[value] ? text(statusMessages[value]) : value;
}
