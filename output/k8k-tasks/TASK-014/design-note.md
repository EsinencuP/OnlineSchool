# TASK-014 — design note

Публичный контракт UI: Locale, IntlLocale, MessageKey, MessageArgs<K>, translate(locale, key, params), initializeLocale(), существующие setLocale/useLocale/LanguageSelector. Существующие ключи сохранены. Новые пространства ключей auth.* и validation.*. Русский словарь определяет ключи и параметры, румынский проверяется на точное соответствие. Единственное хранилище k8k.locale содержит ru/ro. Инициализация восстанавливает html lang до монтирования кабинетов.

Форматтеры: intlLocaleFor(locale), formatDate, formatDateTime и formatTime для ISO instant с offset или timestamp и явной IANA zone, formatDateOnly для ISO civil date, formatRelativeTime с переданным числом и unit, formatMoneyAmount для decimal string и кода валюты. Форматирование использует Intl, UTC-проверку civil date и алгоритм Decimal/BigInt из менеджерского helper. Temporal сохраняется для календарной навигации DatePicker. Compat-вызов менеджера сохраняет ru-RU, символ валюты и прежнее округление Decimal. DatePicker и FreshnessLabel подключаются к общему форматированию.

Проверка pre-login проводится на уже существующем shared Login платформы с его LanguageSelector, typed labels, validation и локализованными ошибками. Auth, DTO, operation, SDK, route, session и component props сохраняют контракты. Миграция остальных экранов и account chrome относятся к TASK-015 и ролевым заданиям.
