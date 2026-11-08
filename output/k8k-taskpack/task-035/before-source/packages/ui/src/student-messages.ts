import { translate } from './messages.js';
import type { Locale, MessageCall } from './messages.js';

const ru = {
  'student.materialRefresh': 'Обновить материалы',
  'student.materialPageEmpty': 'На этой странице материалов нет.',
  'student.error.sessionUnavailable': 'Сессия недоступна. Обнови список устройств.',
  'student.error.currentSession': 'Для завершения текущей сессии используй выход из аккаунта.',
  'student.error.emailSuperseded': 'Запрошен более новый код. Используй последний код.',
  'student.error.emailUnavailable': 'Этот адрес недоступен для изменения. Проверь адрес.',
  'student.error.emailCodeInvalid': 'Код не подошёл или истёк. Проверь код либо запроси новый.',
  'student.notSpecified': 'Не указан',
  'student.all': 'Все →',
  'student.empty': 'Пока ничего нет. Новые данные появятся здесь.',
  'student.connect': 'Подключиться',
  'student.notFound': 'Страница не найдена',
  'student.routeError': 'Не удалось открыть страницу',
  'student.back': 'Вернуться в кабинет',
  'student.security': 'Безопасность аккаунта',
  'student.passwordTitle': 'Задайте новый пароль',
  'student.passwordIntro': 'Замени временный пароль или обнови свой действующий пароль.',
  'student.passwordSave': 'Изменить пароль',
  'student.saving': 'Сохраняем…',
  'student.password': 'Пароль',
  'student.passwordHelp': 'Меняй пароль, если считаешь, что его мог узнать кто-то ещё.',
  'student.email': 'Email для входа',
  'student.emailChanged': 'Email изменён: {email}',
  'student.codeSent': 'Введи код, отправленный на {email}.',
  'student.emailConfirm': 'Подтвердить email',
  'student.codeNew': 'Запросить новый код',
  'student.codeRequest': 'Получить код',
  'student.secretUnknown':
    'Ответ не получен. Не повторяй команду вслепую. Проверь вход с новыми данными или обратись к менеджеру.',
  'student.devices': 'Активные устройства',
  'student.thisDevice': 'Это устройство',
  'student.otherDevice': 'Другое устройство',
  'student.browserUnknown': 'Браузер не указан',
  'student.addressUnknown': 'Адрес не указан',
  'student.activity': 'Активность: {date}',
  'student.revoke': 'Завершить сессию',
  'student.revoked': 'Сессия завершена',
  'student.profilePanel': 'Личные данные',
  'student.alias': 'Как к тебе обращаться',
  'student.aliasHelp': 'Это имя отображается в кабинете. Данные в документах школы не меняются.',
  'student.profileSave': 'Сохранить профиль',
  'student.profilePending': 'Сохраняем профиль…',
  'student.profileSaved': 'Профиль сохранён',
  'student.securityLink': 'Безопасность аккаунта →',
  'student.aliasTitle': 'Имя в кабинете',
  'student.aliasAbout': 'Об имени в кабинете',
  'student.understood': 'Понятно',
  'student.materialLead': 'Всё необходимое для уроков и самостоятельной работы',
  'student.library': 'Библиотека',
  'student.materialEmpty': 'Преподаватель ещё не поделился материалами.',
  'student.material': 'Материал',
  'student.noSubject': 'Без предмета',
  'student.noLesson': 'Без привязки к уроку',
  'student.download': 'Скачать',
  'student.view': 'Открыть материал',
  'student.fileOpen': 'Открыть файл',
  'student.filePending': 'Проверяем разрешение…',
  'student.fileHelp':
    'Файл откроется после проверки доступа. Просмотр в браузере не препятствует сохранению файла.',
  'student.fileExpired': 'Срок ссылки истёк. Запроси новое разрешение на открытие файла.',
  'student.megabytes': '{size} МБ',
  'student.lessons.one': '{count} урок',
  'student.lessons.few': '{count} урока',
  'student.lessons.many': '{count} уроков',
  'student.lessons.other': '{count} урока',
  'student.titleLesson': 'Урок',
  'student.titleHomework': 'Домашнее задание',
  'student.titlePassword': 'Смена пароля',
  'student.titleLogin': 'Вход ученика',
  'student.titleSuspended': 'Доступ приостановлен',
} as const;
type Key = keyof typeof ru;
type Params<S extends string> = S extends `${string}{${infer P}}${infer Tail}`
  ? P | Params<Tail>
  : never;
const ro = {
  'student.materialRefresh': 'Actualizează materialele',
  'student.materialPageEmpty': 'Nu există materiale pe această pagină.',
  'student.error.sessionUnavailable':
    'Sesiunea nu este disponibilă. Actualizează lista dispozitivelor.',
  'student.error.currentSession': 'Pentru a încheia sesiunea curentă, folosește deconectarea.',
  'student.error.emailSuperseded': 'A fost solicitat un cod mai nou. Folosește ultimul cod.',
  'student.error.emailUnavailable': 'Această adresă nu poate fi folosită. Verifică adresa.',
  'student.error.emailCodeInvalid':
    'Codul este incorect sau a expirat. Verifică-l sau solicită unul nou.',
  'student.notSpecified': 'Nespecificat',
  'student.all': 'Toate →',
  'student.empty': 'Nu există încă date. Datele noi vor apărea aici.',
  'student.connect': 'Conectează-te',
  'student.notFound': 'Pagina nu a fost găsită',
  'student.routeError': 'Pagina nu a putut fi deschisă',
  'student.back': 'Înapoi în cabinet',
  'student.security': 'Securitatea contului',
  'student.passwordTitle': 'Setează o parolă nouă',
  'student.passwordIntro': 'Înlocuiește parola temporară sau actualizează parola curentă.',
  'student.passwordSave': 'Schimbă parola',
  'student.saving': 'Se salvează…',
  'student.password': 'Parolă',
  'student.passwordHelp': 'Schimbă parola dacă bănuiești că o cunoaște altcineva.',
  'student.email': 'E-mail pentru autentificare',
  'student.emailChanged': 'Adresa de e-mail a fost schimbată: {email}',
  'student.codeSent': 'Introdu codul trimis la {email}.',
  'student.emailConfirm': 'Confirmă adresa de e-mail',
  'student.codeNew': 'Solicită un cod nou',
  'student.codeRequest': 'Obține codul',
  'student.secretUnknown':
    'Răspunsul nu a fost primit. Nu repeta comanda fără verificare. Verifică autentificarea cu datele noi sau contactează managerul.',
  'student.devices': 'Dispozitive active',
  'student.thisDevice': 'Acest dispozitiv',
  'student.otherDevice': 'Alt dispozitiv',
  'student.browserUnknown': 'Browser nespecificat',
  'student.addressUnknown': 'Adresă nespecificată',
  'student.activity': 'Activitate: {date}',
  'student.revoke': 'Încheie sesiunea',
  'student.revoked': 'Sesiunea a fost încheiată',
  'student.profilePanel': 'Date personale',
  'student.alias': 'Cum să ne adresăm',
  'student.aliasHelp': 'Acest nume apare în cabinet. Datele din documentele școlii nu se modifică.',
  'student.profileSave': 'Salvează profilul',
  'student.profilePending': 'Se salvează profilul…',
  'student.profileSaved': 'Profilul a fost salvat',
  'student.securityLink': 'Securitatea contului →',
  'student.aliasTitle': 'Numele afișat în cabinet',
  'student.aliasAbout': 'Despre numele afișat',
  'student.understood': 'Am înțeles',
  'student.materialLead': 'Tot ce ai nevoie pentru lecții și studiu individual',
  'student.library': 'Bibliotecă',
  'student.materialEmpty': 'Profesorul nu a distribuit încă materiale.',
  'student.material': 'Material',
  'student.noSubject': 'Fără disciplină',
  'student.noLesson': 'Fără legătură cu o lecție',
  'student.download': 'Descarcă',
  'student.view': 'Deschide materialul',
  'student.fileOpen': 'Deschide fișierul',
  'student.filePending': 'Se verifică permisiunea…',
  'student.fileHelp':
    'Fișierul se deschide după verificarea accesului. Vizualizarea în browser nu împiedică salvarea fișierului.',
  'student.fileExpired': 'Linkul a expirat. Solicită o permisiune nouă pentru a deschide fișierul.',
  'student.megabytes': '{size} MB',
  'student.lessons.one': '{count} lecție',
  'student.lessons.few': '{count} lecții',
  'student.lessons.many': '{count} lecții',
  'student.lessons.other': '{count} de lecții',
  'student.titleLesson': 'Lecție',
  'student.titleHomework': 'Temă',
  'student.titlePassword': 'Schimbarea parolei',
  'student.titleLogin': 'Autentificarea elevului',
  'student.titleSuspended': 'Acces suspendat',
} as const satisfies Record<Key, string>;
type Matching = {
  [K in Key]: [Params<(typeof ru)[K]>] extends [Params<(typeof ro)[K]>]
    ? [Params<(typeof ro)[K]>] extends [Params<(typeof ru)[K]>]
      ? string
      : never
    : never;
};
export type StudentMessageDefinitions = typeof ru;
export const studentMessages = { ru, ro: ro satisfies Matching };
export function translateStudent(locale: Locale, ...args: MessageCall): string {
  const [key, params] = args;
  if (!Object.hasOwn(ru, key)) return translate(locale, ...args);
  const template = studentMessages[locale][key as Key];
  return template.replace(/\{(\w+)\}/gu, (placeholder: string, name: string) =>
    params && Object.hasOwn(params, name)
      ? String((params as Record<string, string | number>)[name])
      : placeholder,
  );
}

export function studentLessonCount(locale: Locale, count: number): string {
  const category = new Intl.PluralRules(locale).select(count);
  const key =
    category === 'one'
      ? 'student.lessons.one'
      : category === 'few'
        ? 'student.lessons.few'
        : category === 'many'
          ? 'student.lessons.many'
          : 'student.lessons.other';
  return translateStudent(locale, key, { count });
}
