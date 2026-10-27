/**
 * UI strings (Russian). Learning content stays in English.
 * Add a new language by creating a dictionary with the same shape.
 */
export const ru = {
  appName: 'LingoUp',
  tagline: 'Открытая платформа для изучения английского',
  nav: {
    library: 'Библиотека',
    vocabulary: 'Словарь',
    review: 'Повторение',
    profile: 'Профиль',
    login: 'Войти',
    register: 'Регистрация',
    logout: 'Выйти',
    main: 'Основная навигация',
    skipToContent: 'Перейти к содержимому',
  },
  common: {
    loading: 'Загрузка…',
    retry: 'Повторить',
    error: 'Что-то пошло не так',
    networkError: 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
    rateLimited: 'Слишком много запросов. Подождите минуту.',
    close: 'Закрыть',
    cancel: 'Отмена',
    save: 'Сохранить',
    delete: 'Удалить',
    minutes: (n: number) => `${n} мин`,
    words: (n: number) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`,
  },
  levels: {
    all: 'Все уровни',
    filterLabel: 'Уровень CEFR',
    names: {
      A1: 'Начальный',
      A2: 'Элементарный',
      B1: 'Средний',
      B2: 'Выше среднего',
      C1: 'Продвинутый',
      C2: 'Владение в совершенстве',
    } as Record<string, string>,
  },
  library: {
    title: 'Библиотека текстов',
    intro:
      'Выберите уровень и откройте текст. Выделите незнакомое слово, чтобы увидеть объяснение и сохранить его в словарь.',
    empty: 'Для этого уровня пока нет текстов.',
    read: 'Читать',
    completed: 'Прочитано',
  },
  reader: {
    back: '← Библиотека',
    instructions:
      'Выделите слово или фразу мышью или пальцем. С клавиатуры: стрелки ← → двигают курсор по словам, Shift + стрелка расширяет выделение, Enter открывает карточку, Esc закрывает её.',
    cardPlaceholder: 'Выделите слово или фразу в тексте — здесь появится её карточка.',
    regionLabel: 'Текст для чтения. Используйте стрелки для перемещения по словам.',
    currentWord: (word: string) => `Слово: ${word}`,
    tooLong: 'Выделите не больше 6 слов.',
    markRead: 'Отметить как прочитанное',
    markedRead: 'Текст отмечен как прочитанный',
    licence: (author: string, license: string) => `Источник: ${author}. Лицензия: ${license}.`,
  },
  card: {
    title: 'Карточка слова',
    context: 'Контекст',
    glossary: 'Словарь текста',
    aiExplanation: 'Объяснение AI',
    mockNotice:
      'Это заглушка MockAIProvider, а не настоящее объяснение. Подключите AI-провайдера в настройках сервера.',
    translation: 'Перевод',
    example: 'Пример',
    save: 'Сохранить в словарь',
    saved: 'В словаре',
    openVocabulary: 'Открыть словарь',
    loginRequired: 'Войдите, чтобы смотреть значения и сохранять слова.',
    noDefinition: 'Для этого слова нет записи в глоссарии текста.',
    aiStatus: {
      disabled: 'AI отключён на этом сервере.',
      consent_required:
        'Подключённый AI-провайдер внешний. Чтобы отправлять ему текст, разрешите это в профиле.',
      quota_exceeded: 'Дневной лимит AI-запросов исчерпан.',
      unavailable: 'AI сейчас недоступен. Попробуйте позже.',
    } as Record<string, string>,
    profileLink: 'Открыть настройки',
  },
  vocabulary: {
    title: 'Мой словарь',
    search: 'Поиск по словарю',
    searchPlaceholder: 'Начните вводить слово…',
    empty: 'Словарь пока пуст. Откройте текст в библиотеке и сохраните первые слова.',
    notFound: 'Ничего не найдено.',
    loadMore: 'Показать ещё',
    dueNow: 'Пора повторить',
    due: (date: string) => `Повторение: ${date}`,
    fromText: 'Из текста',
    confirmDelete: (term: string) => `Удалить «${term}» и историю его повторений?`,
    deleted: 'Слово удалено',
    total: (n: number) => `Всего: ${n}`,
    states: {
      new: 'Новое',
      learning: 'Изучается',
      review: 'Повторяется',
      relearning: 'Переучивается',
    } as Record<string, string>,
  },
  review: {
    title: 'Повторение',
    intro:
      'Интервалы рассчитывает алгоритм FSRS: чем лучше вы помните слово, тем реже оно возвращается.',
    remaining: (n: number) => `Осталось: ${n}`,
    showAnswer: 'Показать ответ',
    prompt: 'Вспомните значение слова',
    ratings: { again: 'Снова', hard: 'Трудно', good: 'Хорошо', easy: 'Легко' } as Record<
      string,
      string
    >,
    keyboard: 'Пробел — показать ответ, 1–4 — оценка.',
    done: 'На сегодня всё!',
    doneText:
      'Все слова, которые пора повторить, повторены. Возвращайтесь позже или почитайте новый текст.',
    nothingDue: 'Сейчас нечего повторять',
    nothingDueText: 'Новые слова появятся здесь, когда вы сохраните их из текстов.',
    saveFailed: 'Не удалось сохранить оценку. Попробуйте ещё раз: повторная отправка безопасна.',
  },
  profile: {
    title: 'Профиль',
    stats: 'Прогресс',
    totalWords: 'Слов в словаре',
    dueNow: 'К повторению',
    totalReviews: 'Повторений',
    textsCompleted: 'Прочитано текстов',
    streak: 'Дней подряд',
    activity: 'Активность за 30 дней',
    activityLag: 'Активность обновляется фоновым обработчиком с небольшой задержкой.',
    activityNotYet:
      'Данных об активности пока нет. Если вы уже занимались, проверьте, что запущен worker.',
    byState: 'Слова по стадиям',
    settings: 'Настройки',
    nativeLanguage: 'Родной язык (для переводов)',
    targetLevel: 'Целевой уровень',
    dailyGoal: 'Цель на день, минут',
    aiSharing: 'Разрешить отправку текста внешним AI-провайдерам',
    aiSharingHint:
      'По умолчанию выключено. Влияет только на провайдеров вне инфраструктуры этого сервера; локальные модели и заглушка работают без согласия.',
    settingsSaved: 'Настройки сохранены',
    data: 'Мои данные',
    export: 'Скачать все мои данные (JSON)',
    deleteAccount: 'Удалить аккаунт',
    deleteWarning: 'Аккаунт, словарь, история повторений и прогресс будут удалены безвозвратно.',
    deletePassword: 'Введите пароль для подтверждения',
    table: { day: 'День', words: 'Слова', reviews: 'Повторения', texts: 'Тексты' },
  },
  auth: {
    loginTitle: 'Вход',
    registerTitle: 'Регистрация',
    email: 'Email',
    password: 'Пароль',
    passwordHint: 'Не менее 10 символов.',
    displayName: 'Имя',
    submitLogin: 'Войти',
    submitRegister: 'Создать аккаунт',
    noAccount: 'Нет аккаунта?',
    haveAccount: 'Уже есть аккаунт?',
    invalidCredentials: 'Неверный email или пароль.',
    emailTaken: 'Этот email уже зарегистрирован.',
    validation: 'Проверьте правильность заполнения полей.',
    required: 'Эта страница доступна после входа.',
  },
  footer: {
    license: 'Open English Learning Platform — свободное ПО под лицензией GNU AGPL-3.0.',
    source: 'Исходный код',
  },
  notFound: {
    title: 'Страница не найдена',
    text: 'Возможно, ссылка устарела.',
  },
};

export type Dictionary = typeof ru;

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
