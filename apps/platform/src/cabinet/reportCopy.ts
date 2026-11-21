import { useLocale } from '@online-school/ui';

const copy = {
  skills: ['Карта навыков', 'Harta competențelor'],
  empty: ['Опубликованных отчётов пока нет.', 'Nu există încă rapoarte publicate.'],
  emptyHint: [
    'Отчёт появится здесь, когда преподаватель опубликует его по итогам контрольной точки.',
    'Raportul apare aici după ce profesorul îl publică în urma punctului de control.',
  ],
  open: ['Открыть отчёт', 'Deschide raportul'],
  back: ['К отчётам', 'Înapoi la rapoarte'],
  new: ['Новый', 'Nou'],
  read: ['Отметить прочитанным', 'Marchează ca citit'],
  readDone: ['Прочитан', 'Citit'],
  achievements: ['Достижения', 'Realizări'],
  growthAreas: ['Над чем поработать', 'Aspecte de îmbunătățit'],
  recommendations: ['Рекомендации', 'Recomandări'],
  teacherSignature: ['Подпись преподавателя', 'Semnătura profesorului'],
  loading: ['Загружаем данные…', 'Se încarcă datele…'],
  unavailable: ['Эта запись недоступна.', 'Această înregistrare nu este disponibilă.'],
  readFailed: [
    'Не удалось подтвердить отметку. Повторная проверка сверит её с сервером.',
    'Marcarea nu a putut fi confirmată. Verifică din nou starea pe server.',
  ],
  failed: [
    'Не удалось получить данные. Попробуйте ещё раз.',
    'Datele nu au putut fi obținute. Încearcă din nou.',
  ],
  retry: ['Повторить', 'Încearcă din nou'],
  exportTitle: ['Учебная выписка в PDF', 'Extras de studiu PDF'],
  exportHelp: [
    'Отчёты, посещаемость и карта навыков.',
    'Rapoarte, prezență și harta competențelor.',
  ],
  subject: ['Предмет', 'Disciplină'],
  all: ['Все предметы', 'Toate disciplinele'],
  from: ['С даты', 'De la data'],
  to: ['По дату', 'Până la data'],
  create: ['Запросить PDF', 'Solicită PDF'],
  invalidDates: ['Проверьте даты выбранного периода.', 'Verifică datele perioadei selectate.'],
  request: ['Номер запроса', 'Numărul cererii'],
  job: ['Номер задания', 'Numărul sarcinii'],
  unknown: [
    'Постановка в очередь пока не подтверждена.',
    'Punerea în coadă nu a fost încă confirmată.',
  ],
  check: ['Проверить запрос', 'Verifică cererea'],
  retryRequest: ['Повторить исходный запрос', 'Retrimite cererea inițială'],
  checking: ['Проверяем…', 'Se verifică…'],
  limit: [
    'Уже есть два незавершённых задания. Дождитесь их завершения.',
    'Ai deja două sarcini nefinalizate. Așteaptă finalizarea lor.',
  ],
  queued: ['В очереди', 'În coadă'],
  processing: ['Готовим выписку', 'Se pregătește extrasul'],
  ready: ['Выписка готова', 'Extrasul este gata'],
  estimate: ['Ориентир готовности', 'Estimarea finalizării'],
  until: ['Ссылка действует до', 'Link disponibil până la'],
  resume: ['Проверить готовность', 'Verifică dacă este gata'],
  paused: [
    'Автоматическая проверка остановилась. Можно проверить это задание позже.',
    'Verificarea automată s-a oprit. Poți verifica această sarcină mai târziu.',
  ],
  download: ['Скачать PDF', 'Descarcă PDF'],
  expired: [
    'Срок ссылки истёк. Запросите новую выписку.',
    'Linkul a expirat. Solicită un extras nou.',
  ],
  exportFailed: [
    'Подготовка выписки завершилась ошибкой.',
    'Pregătirea extrasului s-a încheiat cu o eroare.',
  ],
  fileUnavailable: [
    'Ссылка на выписку недоступна. Проверьте готовность ещё раз.',
    'Linkul extrasului nu este disponibil. Verifică din nou dacă este gata.',
  ],
  newExport: ['Новая выписка', 'Extras nou'],
} as const;

export type ReportMessage = keyof typeof copy;
export function useReportCopy() {
  const { locale } = useLocale();
  return { locale, text: (key: ReportMessage) => copy[key][locale === 'ro' ? 1 : 0] };
}
