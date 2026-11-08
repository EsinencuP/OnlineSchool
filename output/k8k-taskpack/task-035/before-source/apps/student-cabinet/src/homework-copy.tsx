import { StatusChip, useLocale } from '@online-school/ui';
import type { HomeworkItemDto } from '@online-school/api-contracts';
import { statusLabels } from './components.js';
import { studentStatusRo } from './student-copy.js';

const messages = {
  homework: ['Домашние задания', 'Teme'],
  task: ['Домашнее задание', 'Temă'],
  lead: ['Практика, которая помогает двигаться вперёд', 'Exersează și progresează în ritmul tău'],
  yourTasks: ['Твои задания', 'Temele tale'],
  yourTask: ['Твоё задание', 'Tema ta'],
  status: ['Статус', 'Stare'],
  all: ['Все задания', 'Toate temele'],
  empty: ['Заданий с этим статусом пока нет.', 'Nu există încă teme cu această stare.'],
  notFound: [
    'Задание не найдено или больше недоступно.',
    'Tema nu a fost găsită sau nu mai este disponibilă.',
  ],
  assigned: ['Назначено', 'Atribuită'],
  due: ['Сдать до', 'Termen'],
  noDeadline: ['Без срока сдачи', 'Fără termen de predare'],
  late: ['Сдано с опозданием', 'Predată cu întârziere'],
  instruction: ['Задание преподавателя', 'Sarcina profesorului'],
  teacher: ['Преподаватель', 'Profesor'],
  answer: ['Твой ответ', 'Răspunsul tău'],
  answerHint: [
    'До 10 000 символов. Черновик сохраняется автоматически.',
    'Până la 10 000 de caractere. Ciorna se salvează automat.',
  ],
  saving: ['Сохраняем черновик…', 'Se salvează ciorna…'],
  dirty: ['Изменения не сохранены', 'Modificările nu sunt salvate'],
  saved: ['Черновик сохранён', 'Ciorna este salvată'],
  noDraft: ['Ответ ещё не сохранён в черновике.', 'Răspunsul nu este încă salvat ca ciornă.'],
  retrySave: ['Повторить сохранение', 'Reîncearcă salvarea'],
  teacherFiles: ['Вложения преподавателя', 'Fișierele profesorului'],
  materialsHint: [
    'Доступные для скачивания файлы находятся в разделе «Материалы».',
    'Fișierele disponibile pentru descărcare sunt în secțiunea Materiale.',
  ],
  attach: ['Прикрепить файл', 'Atașează un fișier'],
  limits: [
    'До 50 МБ на файл, до 20 файлов. Отправка доступна после завершения загрузки.',
    'Până la 50 MiB pe fișier și 20 de fișiere. Poți trimite după finalizarea încărcării.',
  ],
  requesting: ['Готовим загрузку файла…', 'Se pregătește încărcarea fișierului…'],
  uploading: ['Загружаем файл…', 'Se încarcă fișierul…'],
  confirming: ['Загружаем и проверяем файл…', 'Se verifică fișierul încărcat…'],
  retryUpload: ['Повторить загрузку', 'Reîncearcă încărcarea'],
  cancelUpload: ['Отменить загрузку', 'Renunță la încărcare'],
  invalidFile: [
    'Выбери непустой файл размером до 50 МБ. Можно приложить до 20 файлов.',
    'Alege un fișier nevid de cel mult 50 MiB. Poți atașa cel mult 20 de fișiere.',
  ],
  uploadExpired: [
    'Срок загрузки истёк. Повтори загрузку, чтобы получить новое разрешение.',
    'Permisiunea de încărcare a expirat. Reîncearcă pentru a primi una nouă.',
  ],
  remove: ['Убрать', 'Elimină'],
  send: ['Сдать работу', 'Predă tema'],
  sending: ['Отправляем…', 'Se trimite…'],
  submitted: [
    'Работа сдана. Ждём комментарий преподавателя.',
    'Tema a fost predată. Așteptăm comentariul profesorului.',
  ],
  readonly: [
    'Работа отправлена. Новую версию можно сдать после запроса доработки.',
    'Tema a fost trimisă. O versiune nouă poate fi predată după solicitarea revizuirii.',
  ],
  reviewed: ['Работа проверена.', 'Tema este verificată.'],
  unknown: [
    'Результат отправки пока неизвестен. Проверим, получила ли школа работу. Если отправка не подтвердится, можно повторить её.',
    'Rezultatul trimiterii este încă necunoscut. Verificăm dacă școala a primit tema. Dacă predarea nu se confirmă, o poți reîncerca.',
  ],
  check: ['Проверить результат', 'Verifică rezultatul'],
  stillUnknown: [
    'Отправка пока не подтверждена. Можно повторить отправку.',
    'Predarea încă nu este confirmată. Poți reîncerca trimiterea.',
  ],
  changedVersion: [
    'На сервере появилась другая версия. Проверь историю перед дальнейшими действиями.',
    'Pe server a apărut o altă versiune. Verifică istoricul înainte de alte acțiuni.',
  ],
  history: ['История версий', 'Istoricul versiunilor'],
  version: ['Версия', 'Versiunea'],
  noComment: [
    'Комментарий преподавателя пока не добавлен',
    'Profesorul încă nu a adăugat un comentariu',
  ],
  noVersions: ['Отправленных версий пока нет.', 'Nu există încă versiuni predate.'],
  leaveTitle: ['Черновик ещё не сохранён', 'Ciorna nu este încă salvată'],
  leaveHint: [
    'Дождитесь сохранения или вернитесь к заданию. Выбранные файлы и неопределённая отправка также требуют внимания.',
    'Așteaptă salvarea sau revino la temă. Fișierele selectate și predarea neconfirmată necesită de asemenea atenție.',
  ],
  stay: ['Остаться', 'Rămâi'],
  leave: ['Уйти без сохранения', 'Pleacă fără salvare'],
  unavailable: [
    'Проверь актуальные данные перед отправкой.',
    'Verifică datele actualizate înainte de predare.',
  ],
  refresh: ['Обновить задание', 'Actualizează tema'],
} as const;
export function useHomeworkCopy() {
  const { locale } = useLocale();
  return {
    locale,
    text: (key: keyof typeof messages) => messages[key][locale === 'ro' ? 1 : 0],
    statusLabel: (value: HomeworkItemDto['status']) =>
      (locale === 'ro' ? studentStatusRo[value] : statusLabels[value]) ?? value,
  };
}
export function HomeworkStatus({ value }: { value: HomeworkItemDto['status'] }) {
  const { locale } = useLocale();
  return (
    <StatusChip
      tone={value === 'REVIEWED' ? 'success' : value === 'NEEDS_REVISION' ? 'warning' : 'info'}
    >
      {(locale === 'ro' ? studentStatusRo[value] : statusLabels[value]) ?? value}
    </StatusChip>
  );
}
