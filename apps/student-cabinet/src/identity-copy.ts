import { useLocale } from '@online-school/ui';

const copy = {
  breadcrumbs: ['Путь по разделам', 'Calea de navigare'],
  chooseMonth: ['Выбрать месяц', 'Alege luna'],
  month: ['Месяц', 'Luna'],
  scheduleLead: ['Твои уроки и ближайшие встречи', 'Lecțiile tale și întâlnirile următoare'],
  homeworkLead: ['Всё для практики — в одном месте', 'Totul pentru exersare, într-un singur loc'],
  skillsLead: ['Шаг за шагом к уверенным знаниям', 'Pas cu pas spre cunoștințe sigure'],
  lessonTime: ['Время занятий', 'Ora lecțiilor'],
  timeZone: ['Часовой пояс', 'Fus orar'],
  meetHint: [
    'Вход открывается за 10 минут до урока при подтверждённом доступе.',
    'Intrarea se deschide cu 10 minute înaintea lecției, cu acces confirmat.',
  ],
  previousMonth: ['Предыдущий месяц', 'Luna precedentă'],
  nextMonth: ['Следующий месяц', 'Luna următoare'],
  hasLesson: ['Есть занятие', 'Există o lecție'],
  calendarUnverified: ['Данные о занятиях пока недоступны', 'Datele despre lecții nu sunt disponibile acum'],
  lessons: ['Занятия', 'Lecții'],
  submitHelp: ['Как сдать работу', 'Cum predai tema'],
  submitSteps: [
    'Открой задание|Добавь ответ и, если нужно, файл|Отправь преподавателю',
    'Deschide tema|Adaugă răspunsul și, dacă este necesar, un fișier|Trimite profesorului',
  ],
  help: ['Нужна помощь?', 'Ai nevoie de ajutor?'],
  helpText: [
    'Поможем разобраться с заданием и вопросами по обучению.',
    'Te ajutăm cu tema și întrebările despre studii.',
  ],
  contact: ['Связаться с менеджером', 'Contactează managerul'],
  teacherFeedback: ['Комментарий преподавателя', 'Comentariul profesorului'],
  feedback: ['Обратная связь', 'Feedback'],
  noFeedback: ['Опубликованного комментария пока нет.', 'Nu există încă un comentariu publicat.'],
  revise: ['Доработать задание', 'Revizuiește tema'],
  openHomework: ['Открыть задание', 'Deschide tema'],
  submissions: ['История отправок', 'Istoricul predărilor'],
  needSubmit: ['Нужно сдать', 'De predat'],
  reviewed: ['Выполнено', 'Verificate'],
  inReview: ['На проверке', 'În verificare'],
  noStageSkills: ['Навыков на этом этапе пока нет.', 'Nu există încă competențe la această etapă.'],
  noPageHomework: [
    'На этой странице нет заданий по выбранному предмету.',
    'Pe această pagină nu există teme la disciplina selectată.',
  ],
  countsUnavailable: [
    'Часть счётчиков сейчас недоступна.',
    'Unele contoare nu sunt disponibile acum.',
  ],
  currentPageSubjects: ['Предмет на этой странице', 'Disciplina pe această pagină'],
  allSubjects: ['Все предметы', 'Toate disciplinele'],
  pageFilter: [
    'Фильтр предмета действует на текущую страницу списка.',
    'Filtrul disciplinei se aplică paginii curente a listei.',
  ],
  stagesTitle: ['Три этапа освоения', 'Trei etape de învățare'],
  stagesHelp: ['Этап отмечает преподаватель', 'Profesorul stabilește etapa'],
  allStages: ['Все этапы', 'Toate etapele'],
  stage: ['Этап навыка', 'Etapa competenței'],
  goals: ['Цели и пересмотр навыков', 'Obiective și revizuirea competențelor'],
  skillFocus: ['Навык в работе', 'Competență în lucru'],
  subjectFocus: ['Продолжаем обучение', 'Continuăm învățarea'],
  openSubject: ['Открыть предмет', 'Deschide disciplina'],
  newSkills: [
    'Новые темы появятся здесь после добавления преподавателем.',
    'Temele noi vor apărea aici după ce profesorul le adaugă.',
  ],
} as const;

export function useIdentityCopy() {
  const { locale } = useLocale();
  return (key: keyof typeof copy) => copy[key][locale === 'ro' ? 1 : 0];
}
