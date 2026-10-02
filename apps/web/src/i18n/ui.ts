import type { Occasion } from '@sipclock/domain';
import type { Locale } from '@sipclock/i18n';

export type { Locale };
export const LOCALES: readonly Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export interface Ui {
  siteTitle: string;
  siteDescription: string;
  nav: {
    today: string;
    recipes: string;
    bartender: string;
    language: string;
    signIn: string;
    account: string;
  };
  auth: {
    title: string;
    lead: string;
    emailLabel: string;
    sendCode: string;
    sendingCode: string;
    codeLabel: string;
    codeSent: (email: string) => string;
    verify: string;
    verifying: string;
    resend: string;
    resendIn: (seconds: number) => string;
    changeEmail: string;
    invalidEmail: string;
    invalidCode: string;
    sendFailed: string;
    verifyFailed: string;
    tooMany: string;
    guestNote: string;
    passwordRequired: string;
    passwordShort: string;
    passwordLong: string;
    passwordCompromised: string;
    invalidCredentials: string;
    otpInvalid: string;
    otpExpired: string;
    otpTooManyAttempts: string;
    signInFailed: string;
    signUpFailed: string;
    resetFailed: string;
    usePassword: string;
    useCode: string;
    forgotPassword: string;
    createAccount: string;
    creatingAccount: string;
    haveAccount: string;
    backToSignIn: string;
    passwordLabel: string;
    newPasswordLabel: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    signInButton: string;
    signingIn: string;
    confirmTitle: string;
    confirmFirst: string;
    confirm: string;
    resetTitle: string;
    resetLead: string;
    setPassword: string;
    settingPassword: string;
  };
  account: {
    title: string;
    signedOut: string;
    signIn: string;
    email: string;
    history: string;
    historyEmpty: string;
    loadFailed: string;
    signOut: string;
    deleteAccount: string;
    deleteWarning: string;
    deleteConfirm: string;
    deleteCancel: string;
    deleting: string;
    deleteFailed: string;
    reauthPrompt: string;
    reauthConfirm: string;
    reauthInvalid: string;
    setPassword: string;
    setPasswordLead: string;
  };
  sync: { failed: string; loadFailed: string; mergeFailed: string; dismiss: string };
  today: {
    now: string;
    lead: string;
    occasion: string;
    noAlcohol: string;
    anotherIdea: string;
    whyThis: string;
    openRecipe: string;
    alternatives: string;
    noPick: string;
    myBar: string;
    myBarHint: string;
    myBarHintSynced: string;
    barCount: (n: number) => string;
    clearBar: string;
    availReady: string;
    availSwap: (n: number) => string;
    availMissing: (names: string) => string;
  };
  recipes: {
    title: string;
    description: string;
    all: string;
    alcoholFree: string;
    filters: string;
    countTemplate: string;
    empty: string;
    search: {
      label: string;
      placeholder: string;
      clear: string;
      similar: string;
      noMatches: string; // template with {q}
      noMatchesHint: string;
      clearSearch: string;
    };
    min: string;
    metaTitle: (name: string) => string;
    ingredients: string;
    steps: string;
    units: string;
    servings: string;
    ml: string;
    oz: string;
    parts: string;
    zeroProofTwin: string;
    related: string;
    difficulty: Record<1 | 2 | 3, string>;
    yield: (n: number) => string;
    optional: string;
    garnish: string;
    abvLabel: string;
    save: string;
    saved: string;
    madeIt: string;
    madeLogged: string;
    signInToLog: string;
    signInLink: string;
  };
  swap: {
    button: string;
    signInCaption: string;
    signInLink: string;
    pickLabel: string;
    loading: string;
    inBar: string;
    close: string;
    workable: string;
    canSkip: string;
    none: string;
    ai: string;
    limit: string;
    failed: string;
    retry: string;
  };
  bartender: {
    title: string;
    description: string;
    heading: string;
    lead: string;
    starters: string[];
    newChat: string;
    conversation: string;
    inputLabel: string;
    placeholder: string;
    send: string;
    stop: string;
    quotaLeft: (n: number) => string;
    quotaNone: string;
    disclaimer: string;
    thinking: string;
    missing: (names: string) => string;
    signedOut: { title: string; body: string; signIn: string; today: string };
    limit: { title: (n: number) => string; body: string; today: string };
    failed: { title: string; body: string; retry: string };
    busy: string;
    tools: Record<
      | 'get_my_bar'
      | 'what_can_i_make'
      | 'search_recipes'
      | 'get_recipe'
      | 'find_substitutes'
      | 'recommend_now',
      { pending: string; done: string }
    >;
  };
  abv: { free: string; aria: string };
  notFound: { title: string; body: string; back: string };
  footer: { warning: string; adult: string };
  occasions: Record<Occasion, string>;
}

const en: Ui = {
  siteTitle: 'Sipclock - what to make right now',
  siteDescription:
    'Sipclock picks a cocktail for this date and hour, based on your home bar, the occasion and the weather.',
  nav: {
    today: 'Today',
    recipes: 'Recipes',
    bartender: 'Bartender',
    language: 'Language',
    signIn: 'Sign in',
    account: 'Account',
  },
  auth: {
    title: 'Sign in',
    lead: 'Enter your email and we will send a 6-digit code. Your bar, favorites and history then follow you across devices.',
    emailLabel: 'Email',
    sendCode: 'Send code',
    sendingCode: 'Sending',
    codeLabel: '6-digit code',
    codeSent: (email) => `We sent a code to ${email}.`,
    verify: 'Sign in',
    verifying: 'Checking',
    resend: 'Resend code',
    resendIn: (n) => `Resend in ${n} s`,
    changeEmail: 'Use another email',
    invalidEmail: 'Enter a valid email address.',
    invalidCode: 'Enter the 6-digit code.',
    sendFailed: 'Could not send the code. Try again.',
    verifyFailed: 'That code is wrong or expired.',
    tooMany: 'Too many attempts. Wait a minute and try again.',
    guestNote: 'You can use Sipclock without an account. Your bar then stays on this device.',
    passwordRequired: 'Enter your password.',
    passwordShort: 'Use at least 8 characters.',
    passwordLong: 'Use at most 128 characters.',
    passwordCompromised: 'This password appeared in a data breach. Choose another one.',
    invalidCredentials: 'Email or password is wrong.',
    otpInvalid: 'That code is wrong.',
    otpExpired: 'That code has expired. Request a new one.',
    otpTooManyAttempts: 'Too many wrong tries. Request a new code.',
    signInFailed: 'Could not sign in. Try again.',
    signUpFailed: 'Could not create the account. Try again.',
    resetFailed: 'Could not set the password. Try again.',
    usePassword: 'Use password',
    useCode: 'Use a code instead',
    forgotPassword: 'Forgot password?',
    createAccount: 'Create account',
    creatingAccount: 'Creating',
    haveAccount: 'Sign in with password',
    backToSignIn: 'Back to sign in',
    passwordLabel: 'Password',
    newPasswordLabel: 'New password',
    passwordHint: 'At least 8 characters',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    signInButton: 'Sign in',
    signingIn: 'Signing in',
    confirmTitle: 'Confirm your email',
    confirmFirst: 'Confirm your email first. We sent you a code.',
    confirm: 'Confirm',
    resetTitle: 'Set a new password',
    resetLead: 'Enter your email and we will send a code to set a new password.',
    setPassword: 'Set password',
    settingPassword: 'Saving',
  },
  account: {
    title: 'Account',
    signedOut: 'You are not signed in.',
    signIn: 'Sign in',
    email: 'Email',
    history: 'Recently made',
    historyEmpty: 'Nothing logged yet. Tap "I made it" on a recipe.',
    loadFailed: 'Could not load your data.',
    signOut: 'Sign out',
    deleteAccount: 'Delete account',
    deleteWarning: 'This permanently deletes your account, bar, favorites and history.',
    deleteConfirm: 'Delete forever',
    deleteCancel: 'Cancel',
    deleting: 'Deleting',
    deleteFailed: 'Could not delete the account. Try again.',
    reauthPrompt: 'To confirm, enter the code we just sent to your email.',
    reauthConfirm: 'Confirm and delete',
    reauthInvalid: 'That code did not work. Check it and try again.',
    setPassword: 'Set or change password',
    setPasswordLead:
      'We will email you a code, then you choose a new password. Other devices are signed out.',
  },
  sync: {
    failed: 'Could not save your last change. It was undone.',
    loadFailed: 'Could not load your saved data.',
    mergeFailed: 'Could not move this device’s bar to your account yet.',
    dismiss: 'Dismiss',
  },
  today: {
    now: 'Now',
    lead: 'What to make right now, based on the hour, your home bar and the occasion.',
    occasion: 'Occasion',
    noAlcohol: 'No alcohol',
    anotherIdea: 'Another idea',
    whyThis: 'Why this one',
    openRecipe: 'Open recipe',
    alternatives: 'Or try',
    noPick: 'Nothing fits these filters. Try a different occasion or add ingredients to your bar.',
    myBar: 'My bar',
    myBarHint: 'Tick what you have at home. Saved on this device only.',
    myBarHintSynced: 'Tick what you have at home. Synced to your account.',
    barCount: (n) => (n === 0 ? 'Not set' : `${n} selected`),
    clearBar: 'Clear bar',
    availReady: 'All in your bar',
    availSwap: (n) => `Ready · ${n} swap${n === 1 ? '' : 's'}`,
    availMissing: (names) => `Missing: ${names}`,
  },
  recipes: {
    title: 'Cocktail recipes',
    description:
      'Classic and modern cocktails with ingredients, steps and alcohol-free twins. Search by name, ingredient or mood, or pick by occasion.',
    all: 'All',
    alcoholFree: 'Alcohol-free',
    filters: 'Filters',
    countTemplate: '{n} recipes',
    empty: 'No recipes match these filters.',
    search: {
      label: 'Search recipes',
      placeholder: 'Name, ingredient or mood: “fresh with mint”',
      clear: 'Clear',
      similar: 'Similar in taste',
      noMatches: 'No matches for “{q}”',
      noMatchesHint: 'Try an ingredient you have, or a mood like “bitter” or “fresh”.',
      clearSearch: 'Clear search',
    },
    min: 'min',
    metaTitle: (name) => `${name} recipe`,
    ingredients: 'Ingredients',
    steps: 'Steps',
    units: 'Units',
    servings: 'Servings',
    ml: 'ml',
    oz: 'oz',
    parts: 'parts',
    zeroProofTwin: 'Alcohol-free version',
    related: 'More for the same time of day',
    difficulty: { 1: 'Easy', 2: 'Medium', 3: 'Advanced' },
    yield: (n) => `${n} ${n === 1 ? 'serving' : 'servings'}`,
    optional: 'optional',
    garnish: 'garnish',
    abvLabel: 'Estimated ABV',
    save: 'Save',
    saved: 'Saved',
    madeIt: 'I made it',
    madeLogged: 'Logged',
    signInToLog: 'Sign in to keep a history of what you make.',
    signInLink: 'Sign in',
  },
  swap: {
    button: 'Find a swap',
    signInCaption: 'Sign in to get swaps for missing ingredients.',
    signInLink: 'Sign in',
    pickLabel: 'Which ingredient are you missing?',
    loading: 'Looking for swaps',
    inBar: 'In your bar',
    close: 'Close match',
    workable: 'Different but good',
    canSkip: 'You can also leave it out.',
    none: 'No good swap in our catalog.',
    ai: 'AI suggestion',
    limit: "Daily AI limit reached. Showing editors' picks.",
    failed: "Couldn't load swaps.",
    retry: 'Try again',
  },
  bartender: {
    title: 'Bartender',
    description:
      'Ask the bartender what to make from your bar, how to swap an ingredient or what suits tonight.',
    heading: 'Ask the bartender',
    lead: 'What to make from your bar, how to swap an ingredient, what suits tonight. Answers come from our recipes and your bar.',
    starters: [
      'What can I make right now?',
      'Something light and citrusy',
      'What can replace vermouth in a Negroni?',
      'An alcohol-free drink for tonight',
    ],
    newChat: 'New chat',
    conversation: 'Conversation',
    inputLabel: 'Message the bartender',
    placeholder: 'Ask about drinks, swaps or your bar',
    send: 'Send',
    stop: 'Stop',
    quotaLeft: (n) => `${n} question${n === 1 ? '' : 's'} left today`,
    quotaNone: 'No questions left today',
    disclaimer: 'Answers can be wrong. Excessive alcohol consumption is harmful to your health.',
    thinking: 'The bartender is answering',
    missing: (names) => `Missing: ${names}`,
    signedOut: {
      title: 'Sign in to ask the bartender',
      body: 'The bartender knows your bar and favorites, so answers fit what you have at home.',
      signIn: 'Sign in',
      today: 'See today’s pick',
    },
    limit: {
      title: (n) => `That’s all ${n} questions for today`,
      body: 'New questions open at midnight. Recipes, your bar and catalog swaps work as usual.',
      today: 'See today’s pick',
    },
    failed: {
      title: 'Couldn’t answer right now',
      body: 'Try again in a minute.',
      retry: 'Try again',
    },
    busy: 'Still answering your last question',
    tools: {
      get_my_bar: { pending: 'Checking your bar…', done: 'Checked your bar' },
      what_can_i_make: {
        pending: 'Checking what you can make…',
        done: 'Checked what you can make',
      },
      search_recipes: { pending: 'Searching recipes…', done: 'Searched recipes' },
      get_recipe: { pending: 'Looking up the recipe…', done: 'Looked up the recipe' },
      find_substitutes: { pending: 'Looking up swaps…', done: 'Looked up swaps' },
      recommend_now: { pending: 'Picking for right now…', done: 'Picked for right now' },
    },
  },
  abv: { free: 'Alcohol-free', aria: '{percent} percent alcohol' },
  notFound: {
    title: 'Page not found',
    body: 'This page does not exist or has moved.',
    back: 'Back home',
  },
  footer: {
    warning: 'Excessive alcohol consumption is harmful to your health.',
    adult: '18+',
  },
  occasions: {
    'after-work': 'After work',
    date: 'Date',
    party: 'Party',
    chill: 'Chill',
    brunch: 'Brunch',
  },
};

const ru: Ui = {
  siteTitle: 'Sipclock - что приготовить прямо сейчас',
  siteDescription:
    'Sipclock подбирает коктейль под дату и час с учётом вашего домашнего бара и повода.',
  nav: {
    today: 'Сегодня',
    recipes: 'Рецепты',
    bartender: 'Бармен',
    language: 'Язык',
    signIn: 'Войти',
    account: 'Аккаунт',
  },
  auth: {
    title: 'Вход',
    lead: 'Введите почту, и мы пришлём 6-значный код. Бар, избранное и история будут на всех ваших устройствах.',
    emailLabel: 'Почта',
    sendCode: 'Получить код',
    sendingCode: 'Отправляем',
    codeLabel: '6-значный код',
    codeSent: (email) => `Мы отправили код на ${email}.`,
    verify: 'Войти',
    verifying: 'Проверяем',
    resend: 'Отправить ещё раз',
    resendIn: (n) => `Ещё раз через ${n} с`,
    changeEmail: 'Другая почта',
    invalidEmail: 'Введите корректный адрес почты.',
    invalidCode: 'Введите 6-значный код.',
    sendFailed: 'Не удалось отправить код. Попробуйте ещё раз.',
    verifyFailed: 'Код неверный или устарел.',
    tooMany: 'Слишком много попыток. Подождите минуту.',
    guestNote: 'Sipclock работает и без аккаунта. Тогда бар хранится только на этом устройстве.',
    passwordRequired: 'Введите пароль.',
    passwordShort: 'Нужно не меньше 8 символов.',
    passwordLong: 'Не больше 128 символов.',
    passwordCompromised: 'Этот пароль попал в утечку данных. Выберите другой.',
    invalidCredentials: 'Почта или пароль неверны.',
    otpInvalid: 'Код неверный.',
    otpExpired: 'Код устарел. Запросите новый.',
    otpTooManyAttempts: 'Слишком много ошибок. Запросите новый код.',
    signInFailed: 'Не удалось войти. Попробуйте ещё раз.',
    signUpFailed: 'Не удалось создать аккаунт. Попробуйте ещё раз.',
    resetFailed: 'Не удалось задать пароль. Попробуйте ещё раз.',
    usePassword: 'Войти с паролем',
    useCode: 'Войти по коду',
    forgotPassword: 'Забыли пароль?',
    createAccount: 'Создать аккаунт',
    creatingAccount: 'Создаём',
    haveAccount: 'Войти с паролем',
    backToSignIn: 'Назад ко входу',
    passwordLabel: 'Пароль',
    newPasswordLabel: 'Новый пароль',
    passwordHint: 'Не меньше 8 символов',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    signInButton: 'Войти',
    signingIn: 'Входим',
    confirmTitle: 'Подтвердите почту',
    confirmFirst: 'Сначала подтвердите почту. Мы отправили вам код.',
    confirm: 'Подтвердить',
    resetTitle: 'Задайте новый пароль',
    resetLead: 'Введите почту, и мы пришлём код для нового пароля.',
    setPassword: 'Задать пароль',
    settingPassword: 'Сохраняем',
  },
  account: {
    title: 'Аккаунт',
    signedOut: 'Вы не вошли.',
    signIn: 'Войти',
    email: 'Почта',
    history: 'Недавно приготовлено',
    historyEmpty: 'Пока пусто. Нажмите «Я приготовил» в рецепте.',
    loadFailed: 'Не удалось загрузить ваши данные.',
    signOut: 'Выйти',
    deleteAccount: 'Удалить аккаунт',
    deleteWarning: 'Аккаунт, бар, избранное и история будут удалены безвозвратно.',
    deleteConfirm: 'Удалить навсегда',
    deleteCancel: 'Отмена',
    deleting: 'Удаляем',
    deleteFailed: 'Не удалось удалить аккаунт. Попробуйте ещё раз.',
    reauthPrompt: 'Для подтверждения введите код, который мы только что отправили на почту.',
    reauthConfirm: 'Подтвердить и удалить',
    reauthInvalid: 'Код не подошёл. Проверьте его и попробуйте снова.',
    setPassword: 'Задать или сменить пароль',
    setPasswordLead:
      'Мы пришлём код на почту, затем вы выберете новый пароль. На других устройствах придётся войти заново.',
  },
  sync: {
    failed: 'Не удалось сохранить последнее изменение. Оно отменено.',
    loadFailed: 'Не удалось загрузить сохранённые данные.',
    mergeFailed: 'Пока не удалось перенести бар с этого устройства в аккаунт.',
    dismiss: 'Закрыть',
  },
  today: {
    now: 'Сейчас',
    lead: 'Что приготовить прямо сейчас: по времени суток, вашему бару и поводу.',
    occasion: 'Повод',
    noAlcohol: 'Без алкоголя',
    anotherIdea: 'Другая идея',
    whyThis: 'Почему этот',
    openRecipe: 'Открыть рецепт',
    alternatives: 'Или попробуйте',
    noPick: 'Под эти фильтры ничего не подходит. Смените повод или добавьте ингредиенты в бар.',
    myBar: 'Мой бар',
    myBarHint: 'Отметьте, что есть дома. Хранится только на этом устройстве.',
    myBarHintSynced: 'Отметьте, что есть дома. Синхронизируется с аккаунтом.',
    barCount: (n) => (n === 0 ? 'Не задан' : `Выбрано: ${n}`),
    clearBar: 'Очистить бар',
    availReady: 'Всё есть в баре',
    availSwap: (n) => `Можно готовить · замен: ${n}`,
    availMissing: (names) => `Не хватает: ${names}`,
  },
  recipes: {
    title: 'Рецепты коктейлей',
    description:
      'Классические и современные коктейли с ингредиентами, шагами и безалкогольными версиями. Ищите по названию, ингредиенту или настроению или выбирайте по поводу.',
    all: 'Все',
    alcoholFree: 'Без алкоголя',
    filters: 'Фильтры',
    countTemplate: 'Рецептов: {n}',
    empty: 'Нет рецептов под эти фильтры.',
    search: {
      label: 'Поиск рецептов',
      placeholder: 'Название, ингредиент или настроение: «свежее с мятой»',
      clear: 'Очистить',
      similar: 'Похоже по вкусу',
      noMatches: 'Ничего не нашлось по запросу «{q}»',
      noMatchesHint:
        'Попробуйте ингредиент, который есть у вас, или настроение: «горькое», «свежее».',
      clearSearch: 'Очистить поиск',
    },
    min: 'мин',
    metaTitle: (name) => `${name}: рецепт`,
    ingredients: 'Ингредиенты',
    steps: 'Приготовление',
    units: 'Единицы',
    servings: 'Порции',
    ml: 'мл',
    oz: 'oz',
    parts: 'части',
    zeroProofTwin: 'Версия без алкоголя',
    related: 'Ещё на это время суток',
    difficulty: { 1: 'Просто', 2: 'Средне', 3: 'Сложно' },
    yield: (n) => `${n} ${n === 1 ? 'порция' : n < 5 ? 'порции' : 'порций'}`,
    optional: 'по желанию',
    garnish: 'украшение',
    abvLabel: 'Ориентировочная крепость',
    save: 'Сохранить',
    saved: 'Сохранено',
    madeIt: 'Я приготовил',
    madeLogged: 'Записано',
    signInToLog: 'Войдите, чтобы вести историю приготовленного.',
    signInLink: 'Войти',
  },
  swap: {
    button: 'Подобрать замену',
    signInCaption: 'Войдите, чтобы подбирать замену недостающим ингредиентам.',
    signInLink: 'Войти',
    pickLabel: 'Какого ингредиента не хватает?',
    loading: 'Подбираем замену',
    inBar: 'Есть в баре',
    close: 'Близкая замена',
    workable: 'Другой вкус, но подойдёт',
    canSkip: 'Можно обойтись и без него.',
    none: 'В каталоге нет подходящей замены.',
    ai: 'Подсказка ИИ',
    limit: 'Дневной лимит ИИ исчерпан. Показываем подборку редакции.',
    failed: 'Не удалось загрузить замены.',
    retry: 'Повторить',
  },
  bartender: {
    title: 'Бармен',
    description:
      'Спросите бармена, что приготовить из вашего бара, чем заменить ингредиент и что подойдёт на вечер.',
    heading: 'Спросите бармена',
    lead: 'Что приготовить из вашего бара, чем заменить ингредиент, что подойдёт на вечер. Ответы опираются на наши рецепты и ваш бар.',
    starters: [
      'Что я могу приготовить прямо сейчас?',
      'Что-нибудь лёгкое и цитрусовое',
      'Чем заменить вермут в Негрони?',
      'Безалкогольный напиток на вечер',
    ],
    newChat: 'Новый чат',
    conversation: 'Разговор',
    inputLabel: 'Сообщение бармену',
    placeholder: 'Спросите про напитки, замены или ваш бар',
    send: 'Отправить',
    stop: 'Остановить',
    quotaLeft: (n) => {
      const m = n % 100;
      const d = n % 10;
      if (d === 1 && m !== 11) return `Остался ${n} вопрос на сегодня`;
      if (d >= 2 && d <= 4 && (m < 12 || m > 14)) return `Осталось ${n} вопроса на сегодня`;
      return `Осталось ${n} вопросов на сегодня`;
    },
    quotaNone: 'На сегодня вопросов не осталось',
    disclaimer:
      'Ответы могут быть неточными. Чрезмерное употребление алкоголя вредит вашему здоровью.',
    thinking: 'Бармен отвечает',
    missing: (names) => `Не хватает: ${names}`,
    signedOut: {
      title: 'Войдите, чтобы спросить бармена',
      body: 'Бармен знает ваш бар и избранное, поэтому ответы подходят под то, что есть дома.',
      signIn: 'Войти',
      today: 'Подборка на сегодня',
    },
    limit: {
      title: (n) => `На сегодня все ${n} вопросов заданы`,
      body: 'Новые вопросы откроются в полночь. Рецепты, ваш бар и замены из каталога работают как обычно.',
      today: 'Подборка на сегодня',
    },
    failed: {
      title: 'Сейчас не получается ответить',
      body: 'Попробуйте ещё раз через минуту.',
      retry: 'Повторить',
    },
    busy: 'Бармен ещё отвечает на прошлый вопрос',
    tools: {
      get_my_bar: { pending: 'Смотрим ваш бар…', done: 'Посмотрели ваш бар' },
      what_can_i_make: {
        pending: 'Проверяем, что можно приготовить…',
        done: 'Проверили, что можно приготовить',
      },
      search_recipes: { pending: 'Ищем рецепты…', done: 'Поискали рецепты' },
      get_recipe: { pending: 'Открываем рецепт…', done: 'Открыли рецепт' },
      find_substitutes: { pending: 'Подбираем замены…', done: 'Подобрали замены' },
      recommend_now: { pending: 'Выбираем на сейчас…', done: 'Выбрали на сейчас' },
    },
  },
  abv: { free: 'Без алкоголя', aria: 'Крепость {percent}%' },
  notFound: {
    title: 'Страница не найдена',
    body: 'Такой страницы нет или она переехала.',
    back: 'На главную',
  },
  footer: {
    warning: 'Чрезмерное употребление алкоголя вредит вашему здоровью.',
    adult: '18+',
  },
  occasions: {
    'after-work': 'После работы',
    date: 'Свидание',
    party: 'Вечеринка',
    chill: 'Отдых',
    brunch: 'Бранч',
  },
};

const dictionaries: Record<Locale, Ui> = { en, ru };

export function getUi(locale: Locale): Ui {
  return dictionaries[locale];
}
