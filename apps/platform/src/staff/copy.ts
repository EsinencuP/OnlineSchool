import { useLocale } from '@online-school/ui';

const copy = {
  greeting: ['Здравствуйте', 'Bună ziua'],
  teacherIntro: [
    'Ближайшие занятия, ваши ученики и домашние задания.',
    'Lecțiile următoare, elevii tăi și temele pentru acasă.',
  ],
  directorIntro: [
    'Расписание школы, ученики и текущие задачи команды.',
    'Orarul școlii, elevii și sarcinile curente ale echipei.',
  ],
  operatorIntro: [
    'Состояние работающих компонентов платформы.',
    'Starea componentelor active ale platformei.',
  ],
  upcoming: ['Ближайшие занятия', 'Lecțiile următoare'],
  schedule: ['Расписание занятий', 'Orarul lecțiilor'],
  fullSchedule: ['Всё расписание', 'Orarul complet'],
  enrolled: ['Ученики и направления', 'Elevi și discipline'],
  studentsEmpty: [
    'Ученики появятся после назначения преподавателя.',
    'Elevii vor apărea după desemnarea profesorului.',
  ],
  sampleEmpty: [
    'В этой выборке нет записей с выбранным фильтром.',
    'Eșantionul nu conține înregistrări pentru filtrul ales.',
  ],
  filter: ['Фильтр по выборке', 'Filtru în eșantion'],
  help: ['Справка по разделам', 'Ajutor pentru secțiuni'],
  helpText: [
    'Откройте карточку по ссылке. Кнопка «Назад» возвращает к предыдущему разделу и фильтру.',
    'Deschide fișa prin link. Butonul Înapoi revine la secțiunea și filtrul anterior.',
  ],
  all: ['Все записи', 'Toate înregistrările'],
  back: ['Вернуться к списку', 'Înapoi la listă'],
  unavailable: ['Объект недоступен.', 'Obiectul nu este disponibil.'],
  badLink: ['Некорректная ссылка на объект.', 'Linkul către obiect este incorect.'],
  update: ['Обновить', 'Actualizează'],
  minutes: ['мин', 'min'],
  upcomingCount: ['Предстоящих уроков', 'Lecții viitoare'],
  studentCount: ['Учеников с преподавателем', 'Elevi cu profesor desemnat'],
  taskCount: ['Открытых задач', 'Sarcini deschise'],
  due: ['Со сроком', 'Cu termen'],
  noDue: ['Без срока', 'Fără termen'],
  managerMissing: ['Не назначен', 'Nedesemnat'],
  OPEN: ['Открыта', 'Deschisă'],
  IN_PROGRESS: ['В работе', 'În desfășurare'],
  lessonInProgress: ['Идёт урок', 'Lecție în curs'],
  SCHEDULED: ['Запланирован', 'Programată'],
  COMPLETED: ['Завершён', 'Finalizată'],
  CANCELLED: ['Отменён', 'Anulată'],
  RESCHEDULED: ['Перенесён', 'Reprogramată'],
  overdue: ['Просрочена', 'Termen depășit'],
  database: ['База данных', 'Bază de date'],
  readFailed: [
    'Не удалось загрузить кабинет. Повторите попытку.',
    'Cabinetul nu s-a putut încărca. Încearcă din nou.',
  ],
} as const;

export function useStaffCopy() {
  const { locale } = useLocale();
  return (key: string) => copy[key as keyof typeof copy]?.[locale === 'ro' ? 1 : 0] ?? key;
}
