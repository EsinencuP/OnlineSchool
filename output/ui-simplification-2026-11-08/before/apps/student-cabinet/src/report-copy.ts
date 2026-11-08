import { useLocale } from '@online-school/ui';
const messages = {
  open: ['Открыть отчёт', 'Deschide raportul'],
  back: ['← К списку отчётов', '← La lista rapoartelor'],
  refresh: ['Обновить отчёт', 'Actualizează raportul'],
  read: ['Я прочитал(а)', 'Am citit'],
  readDone: ['Прочтение отмечено', 'Lectura a fost înregistrată'],
  exportTitle: ['PDF учебной истории', 'PDF al istoricului educațional'],
  exportHelp: [
    'Выписка включает разрешённую учебную историю. Выбери предмет и период или оставь поля пустыми для всей истории.',
    'Extrasul include istoricul educațional permis. Alege disciplina și perioada sau lasă câmpurile goale pentru întregul istoric.',
  ],
  subject: ['Предмет', 'Disciplina'],
  all: ['Вся история по всем предметам', 'Întregul istoric, toate disciplinele'],
  from: ['С даты', 'De la data'],
  to: ['По дату включительно', 'Până la data inclusiv'],
  range: [
    'Дата начала должна быть не позже даты окончания.',
    'Data de început nu poate fi după data de sfârșit.',
  ],
  create: ['Подготовить PDF', 'Pregătește PDF'],
  pending: ['Отправляем запрос…', 'Se trimite cererea…'],
  estimate: [
    'Время готовности — только оценка. Подготовка может занять больше 30 секунд.',
    'Ora finalizării este o estimare. Pregătirea poate dura mai mult de 30 de secunde.',
  ],
  job: ['Задание экспорта', 'Sarcina de export'],
  QUEUED: ['В очереди', 'În așteptare'],
  PROCESSING: ['Готовим PDF', 'Pregătim PDF-ul'],
  READY: ['PDF готов', 'PDF-ul este gata'],
  FAILED: ['PDF не подготовлен', 'PDF-ul nu a fost pregătit'],
  unknown: [
    'Результат запроса пока неизвестен. Проверь, началась ли подготовка, перед повторной отправкой.',
    'Rezultatul cererii este încă necunoscut. Verifică dacă pregătirea a început înainte de a reîncerca.',
  ],
  check: ['Проверить результат', 'Verifică rezultatul'],
  retry: ['Повторить тот же запрос', 'Reîncearcă aceeași cerere'],
  unknownStill: [
    'Подготовка пока не подтверждена. Новый запрос автоматически не отправляется.',
    'Pregătirea nu este încă confirmată. Nu se trimite automat o cerere nouă.',
  ],
  paused: [
    'Автопроверка приостановлена. Задание не отменено. Можно проверить его состояние ещё раз.',
    'Verificarea automată s-a oprit. Sarcina nu a fost anulată. Poți verifica din nou starea ei.',
  ],
  resume: ['Проверить готовность', 'Verifică dacă este gata'],
  expires: ['Ссылка действует до', 'Link valabil până la'],
  estimateAt: ['Оценка готовности', 'Ora estimată de finalizare'],
  expired: [
    'Срок ссылки истёк. Для нового PDF отправь новый запрос.',
    'Linkul a expirat. Trimite o cerere nouă pentru un PDF nou.',
  ],
  invalidReady: [
    'Ссылка для скачивания пока недоступна. Проверь готовность ещё раз.',
    'Linkul de descărcare nu este încă disponibil. Verifică din nou.',
  ],
  failed: [
    'Не удалось подготовить PDF. Можно отправить новый запрос.',
    'PDF-ul nu a putut fi pregătit. Poți trimite o cerere nouă.',
  ],
  limit: [
    'У тебя уже готовятся два PDF. Дождись завершения одного из них.',
    'Două PDF-uri sunt deja în pregătire. Așteaptă finalizarea unuia dintre ele.',
  ],
  download: ['Скачать PDF', 'Descarcă PDF'],
  checking: ['Проверяем доступ…', 'Verificăm accesul…'],
  newExport: ['Новый экспорт', 'Export nou'],
} as const;
export function useReportCopy() {
  const { locale } = useLocale();
  return { locale, text: (key: keyof typeof messages) => messages[key][locale === 'ro' ? 1 : 0] };
}
