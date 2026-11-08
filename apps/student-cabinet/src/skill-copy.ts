import { useLocale } from '@online-school/ui';
import type { SkillDto } from '@online-school/api-contracts';

const messages = {
  title: ['Мой путь знаний', 'Parcursul meu de cunoaștere'],
  lead: [
    'Навыки и цели, которые вы обсуждаете с преподавателем',
    'Competențe și obiective discutate cu profesorul',
  ],
  subject: ['Предмет', 'Disciplina'],
  all: ['Все предметы, включая историю', 'Toate disciplinele, inclusiv istoricul'],
  stages: ['Учебные этапы', 'Etapele de învățare'],
  stageHelp: [
    'Этап определяет преподаватель. «Ещё не изучали» — отдельное состояние до начала изучения.',
    'Profesorul stabilește etapa. „Încă nu am studiat” este o stare separată, înainte de începerea studiului.',
  ],
  NOT_STUDIED: ['Ещё не изучали', 'Încă nu am studiat'],
  FAMILIARIZING: ['Знакомлюсь', 'Mă familiarizez'],
  PRACTICING: ['Практикую', 'Exersez'],
  APPLYING: ['Применяю', 'Aplic'],
  history: ['История навыка', 'Istoricul competenței'],
  emptyAudit: ['Опубликованных изменений пока нет.', 'Nu există încă modificări publicate.'],
  noComment: ['Публичный комментарий не добавлен.', 'Nu a fost adăugat un comentariu public.'],
  noAssessment: [
    'Проверка преподавателя ещё не опубликована.',
    'Evaluarea profesorului nu a fost încă publicată.',
  ],
  catalogDate: ['Добавлено в карту', 'Adăugat în hartă'],
  assessed: ['Последняя проверка', 'Ultima evaluare'],
  goals: ['Цели обучения', 'Obiective de învățare'],
  noGoals: ['Обсуди цели с преподавателем.', 'Discută obiectivele cu profesorul.'],
  goal: ['Цель', 'Obiectiv'],
  achieved: ['Достигнута', 'Atins'],
  activeGoal: ['В работе', 'În lucru'],
  due: ['Срок', 'Termen'],
  noDate: ['Без срока', 'Fără termen'],
  noSkills: ['Навыки ещё не добавлены.', 'Competențele nu au fost încă adăugate.'],
  noSubjects: ['Предметы пока не назначены.', 'Disciplinele nu au fost încă atribuite.'],
  count: ['Навыков в карте', 'Competențe în hartă'],
  snapshotTitle: ['Срезы навыков после 4 уроков', 'Sinteze ale competențelor după 4 lecții'],
  cadence: [
    'Преподаватель пересматривает навыки каждые 4 подтверждённых проведённых урока по предмету. Отчёт после 8 уроков публикуется отдельно.',
    'Profesorul revizuiește competențele după fiecare 4 lecții desfășurate și confirmate la disciplină. Raportul după 8 lecții se publică separat.',
  ],
  historyHelp: [
    'Срез сохраняет названия и комментарии на момент подтверждения. История предмета не означает текущий допуск к занятиям.',
    'Sinteza păstrează denumirile și comentariile din momentul confirmării. Istoricul disciplinei nu confirmă accesul curent la lecții.',
  ],
  noSnapshots: ['Подтверждённых срезов пока нет.', 'Nu există încă sinteze confirmate.'],
  lastSnapshot: ['Последний подтверждённый срез', 'Ultima sinteză confirmată'],
  noLastSnapshot: [
    'По этому предмету срез пока не опубликован.',
    'La această disciplină nu a fost încă publicată o sinteză.',
  ],
  next: ['До следующего пересмотра, уроков', 'Lecții până la următoarea revizuire'],
  unknownNext: [
    'Срок следующего пересмотра пока не указан.',
    'Termenul următoarei revizuiri nu este încă indicat.',
  ],
  afterLesson: ['После урока', 'După lecția'],
  noSummary: ['Общий комментарий не добавлен.', 'Nu a fost adăugat un comentariu general.'],
  reports: ['Отчёты после 8 уроков', 'Rapoarte după 8 lecții'],
  openMap: ['Открыть карту навыков', 'Deschide harta competențelor'],
  refresh: ['Обновить навыки', 'Actualizează competențele'],
} as const;
export function useSkillCopy() {
  const { locale } = useLocale();
  return {
    locale,
    text: (key: keyof typeof messages) => messages[key][locale === 'ro' ? 1 : 0],
    statusLabel: (status: SkillDto['status']) => messages[status][locale === 'ro' ? 1 : 0],
  };
}

export function formatSkillDate(
  value: string,
  timeZone: string,
  locale: 'ru' | 'ro',
  includeTime = false,
) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-MD' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(includeTime && !dateOnly ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
    timeZone: dateOnly ? 'UTC' : timeZone,
  }).format(new Date(dateOnly ? value + 'T12:00:00Z' : value));
}
