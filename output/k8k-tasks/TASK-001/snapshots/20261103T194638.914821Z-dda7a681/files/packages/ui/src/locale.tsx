import { useEffect, useSyncExternalStore } from 'react';
export type Locale = 'ru' | 'ro';
const messages = {
  ru: {
    language: 'Язык интерфейса',
    home: 'Главная',
    lessonsShort: 'Уроки',
    skillsShort: 'Мой путь',
    overview: 'Обзор',
    lessons: 'Расписание',
    homework: 'Задания',
    skills: 'Мой путь знаний',
    materials: 'Материалы',
    subscription: 'Абонемент',
    profile: 'Профиль и настройки',
    students: 'Ученики',
    leads: 'Заявки',
    tasks: 'Задачи',
    health: 'Состояние платформы',
    more: 'Ещё',
    sections: 'Все разделы',
    close: 'Закрыть меню',
    skip: 'Перейти к содержимому',
    loaded: 'Загружено',
    unknownTime: 'Время последней успешной загрузки неизвестно',
    refreshing: 'Обновляем…',
    notifications: 'Уведомления',
    unread: 'Непрочитанных',
    unknownCount: 'Счётчик недоступен',
    reports: 'Опубликованные отчёты',
    achievements: 'Достижения',
    growth: 'Над чем работаем',
    recommendations: 'Рекомендации',
    teacher: 'Преподаватель',
    read: 'Отметить прочитанным',
    emptyReports: 'Опубликованных отчётов пока нет.',
    reportHelp:
      'Отчёт подтверждается преподавателем после восьми проведённых уроков. Срез навыков после четырёх уроков — отдельный документ.',
    openReports: 'Открыть отчёты',
    loading: 'Загружаем данные…',
    empty: 'Пока нет данных для этого раздела.',
    stale: 'Данные могли устареть. Проверяйте актуальный статус перед действием.',
    error: 'Не удалось загрузить данные.',
    forbidden: 'Нет доступа к этому разделу.',
    session: 'Сессия завершилась. Войдите снова.',
    retry: 'Повторить загрузку',
  },
  ro: {
    language: 'Limba interfeței',
    home: 'Acasă',
    lessonsShort: 'Orar',
    skillsShort: 'Parcurs',
    overview: 'Prezentare',
    lessons: 'Orar',
    homework: 'Teme',
    skills: 'Parcursul meu',
    materials: 'Materiale',
    subscription: 'Abonament',
    profile: 'Profil și setări',
    students: 'Elevi',
    leads: 'Solicitări',
    tasks: 'Sarcini',
    health: 'Starea platformei',
    more: 'Mai multe',
    sections: 'Toate secțiunile',
    close: 'Închide meniul',
    skip: 'Sari la conținut',
    loaded: 'Încărcat',
    unknownTime: 'Ora ultimei încărcări reușite nu este cunoscută',
    refreshing: 'Se actualizează…',
    notifications: 'Notificări',
    unread: 'Necitite',
    unknownCount: 'Contor indisponibil',
    reports: 'Rapoarte publicate',
    achievements: 'Realizări',
    growth: 'Aspecte de îmbunătățit',
    recommendations: 'Recomandări',
    teacher: 'Profesor',
    read: 'Marchează ca citit',
    emptyReports: 'Nu există încă rapoarte publicate.',
    reportHelp:
      'Profesorul confirmă raportul după opt lecții desfășurate. Evaluarea competențelor după patru lecții este un document separat.',
    openReports: 'Deschide rapoartele',
    loading: 'Se încarcă datele…',
    empty: 'Nu există încă date pentru această secțiune.',
    stale: 'Datele pot fi învechite. Verifică starea actuală înainte de a acționa.',
    error: 'Datele nu au putut fi încărcate.',
    forbidden: 'Nu ai acces la această secțiune.',
    session: 'Sesiunea a expirat. Autentifică-te din nou.',
    retry: 'Reîncearcă încărcarea',
  },
} satisfies Record<Locale, Record<string, string>>;
export type MessageKey = keyof typeof messages.ru;
const key = 'k8k.locale';
let selected: Locale = 'ru';
let initialized = false;
const listeners = new Set<() => void>();
function snapshot(): Locale {
  if (initialized) return selected;
  initialized = true;
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value === 'ru' || value === 'ro') selected = value;
  } catch {
    /* Storage can be unavailable. */
  }
  return selected;
}
function notify() {
  listeners.forEach((fn) => fn());
}
function onStorage(event: StorageEvent) {
  if (event.key !== key && event.key !== null) return;
  selected = event.newValue === 'ro' ? 'ro' : 'ru';
  initialized = true;
  if (typeof document !== 'undefined') document.documentElement.lang = selected;
  notify();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) globalThis.addEventListener?.('storage', onStorage);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) globalThis.removeEventListener?.('storage', onStorage);
  };
}
export function setLocale(locale: Locale) {
  selected = locale;
  initialized = true;
  try {
    globalThis.localStorage?.setItem(key, locale);
  } catch {
    /* In-memory preference still works. */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  notify();
}
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, snapshot, () => 'ru' as const);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return {
    locale,
    intlLocale: locale === 'ro' ? 'ro-MD' : 'ru-MD',
    t: (name: MessageKey) => messages[locale][name],
  };
}
export function LanguageSelector() {
  const { locale, t } = useLocale();
  return (
    <label className="k8k-language">
      <span>{t('language')}</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value === 'ro' ? 'ro' : 'ru')}>
        <option value="ru">Русский</option>
        <option value="ro">Română</option>
      </select>
    </label>
  );
}
