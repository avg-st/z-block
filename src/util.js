/**
 * «Блокировщик мразей» — общие утилиты, настройки и хранилище.
 *
 * Скрипт обычный (не модуль): всё складывается в globalThis.BM.util,
 * чтобы быть доступным остальным content-скриптам (они грузятся по порядку
 * из manifest.json) и popup-странице.
 */
(() => {
  'use strict';

  const BM = (globalThis.BM = globalThis.BM || {});
  if (BM.util) return;

  const LOG_PREFIX = '[БМ]';

  /** Ключи в chrome.storage.local / localStorage. */
  const KEYS = {
    settings: 'bm_settings',
    history: 'bm_history',
    blocked: 'bm_blocked',
    panelPos: 'bm_panel_pos',
  };

  /** Настройки по умолчанию. */
  const DEFAULT_SETTINGS = {
    settingsVersion: 2,
    limit: 0, // 0 — без лимита за прогон
    skipKnown: true, // пропускать тех, кто уже есть в истории блокировок
    verbose: true, // журнал событий включён постоянно
    strategy: 'list', // 'list' — прямо в списке; 'tabs' — через вкладки профилей
    noScroll: true, // обрабатывать только загруженные сейчас строки (без автопрокрутки)
    rowButtons: false, // показывать кнопку «🚫» в каждой строке списка
    maxTabs: 100, // сколько профилей открывать одновременно (пачкой) в режиме вкладок
    tabWaitMs: 120000, // сколько ждать ответа от служебной вкладки профиля
  };

  /**
   * Подписи Facebook, которые встречаются в интерфейсе.
   * Работаем и с русским, и с английским UI.
   * Все подписи сравниваются уже нормализованными (нижний регистр, ё → е).
   */
  const RE = {
    // пункт меню «Заблокировать» / «Block»
    blockItem: /^(заблокировать|блокировать|block)$/,
    // \b в JS не работает с кириллицей, поэтому отрицательный lookahead
    blockItemLoose: /^(заблокировать|блокировать|block)(?![а-яёa-z])/i,
    // «Разблокировать» — этого мы НЕ ищем
    unblock: /(разблокировать|unblock)/,
    // кнопка подтверждения в окне блокировки
    confirm: /^(подтвердить|подтверждаю|подтвердите|confirm|block)$/,
    // кнопка отмены в окне блокировки («Отмена», «Отменить блокировку X»)
    cancel: /^отмен/,
    cancelEn: /^(cancel)$/,
    // заголовок/aria-label окна подтверждения начинается с «Заблокировать …?»
    // (\b с кириллицей в JS не работает — используем lookahead)
    dialogTitle: /^(заблокировать|блокировать|block)(?![а-яёa-z])/i,
    // окно успеха «Вы заблокировали X…» / «You blocked X…» (появляется после «Подтвердить»)
    blockSuccess: /^(вы заблокировали|you blocked)/i,
    // то же, но без привязки к началу текста (в окне перед фразой может быть
    // скрытая подпись кнопки «Закрыть» и т.п.)
    blockSuccessAny: /(вы заблокировали|you blocked)/i,
    // триггеры «…» меню: подходящие подписи (учитываем Ё/е в русском тексте)
    goodTrigger: /(ёже|еще|больше|действия|параметры|опции|меню|другое|more|options|actions|menu)/i,
    // кнопки, которые НЕ надо нажимать как триггер меню (иначе отправим заявку в друзья и т.п.)
    badTrigger: new RegExp(
      '(' +
        [
          'добавить в друзья',
          'добавить друга',
          'запрос в друзья',
          'принять',
          'подписаться',
          'вы подписаны',
          'отписаться',
          'написать',
          'сообщение',
          'позвонить',
          'видеозвонок',
          'удалить из друзей',
          'отменить',
          'пожаловаться',
          'поделиться',
          'add friend',
          'accept',
          'follow',
          'unfollow',
          'message',
          'call',
          'invite',
          'report',
          'share',
        ].join('|') +
        ')'
    ),
  };

  /* ------------------------------------------------------------------ *
   * Мелкие помощники
   * ------------------------------------------------------------------ */

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function jitter(min, max) {
    const a = Math.max(0, Number(min) || 0);
    const b = Math.max(a, Number(max) || 0);
    return Math.round(a + Math.random() * (b - a));
  }

  function clampNumber(value, def, min, max) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = def;
    if (n < min) n = min;
    if (n > max) n = max;
    return Math.round(n);
  }

  /** Нормализация текста для сравнения подписей: нижний регистр, ё → е, пробелы. */
  function norm(text) {
    return String(text == null ? '' : text)
      .replace(/\u00a0/g, ' ')
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/ё/gi, 'е')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** Нормализация имени: без пунктуации. */
  function normName(text) {
    return norm(text)
      .replace(/[?？!.,;:()«»"'`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Текст как есть, но без лишних пробелов и переводов строк. */
  function cleanText(text) {
    return String(text == null ? '' : text)
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Доступное имя элемента: aria-label → title → innerText → textContent. */
  function nameOf(el) {
    if (!el || !el.getAttribute) return '';
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    if (label && label.trim()) return norm(label);
    return norm(el.innerText || el.textContent || '');
  }

  /** Человекочитаемое описание элемента (для логов и диагностики). */
  function describeEl(el) {
    if (!el) return 'null';
    const tag = (el.tagName || '?').toLowerCase();
    const role = el.getAttribute && el.getAttribute('role');
    const name = nameOf(el);
    const text = cleanText((el.innerText || '').slice(0, 40));
    return `<${tag}${role ? ' role=' + role : ''}${name ? ' name="' + name.slice(0, 40) + '"' : ''}${
      text && text !== name ? ' text="' + text + '"' : ''
    }>`;
  }

  /**
   * Мягкое сравнение слов: FB в окне пишет имя в другом падеже
   * («Заблокировать Анну Смирнову» против «Анна Смирнова» в списке),
   * поэтому сравниваем ещё и основы слов без типичных окончаний.
   */
  const RU_ENDINGS = [
    'ями', 'ами', 'ого', 'ему', 'ому', 'ими', 'ыми', 'ах', 'ях', 'ам', 'ям',
    'ов', 'ев', 'ей', 'ой', 'ою', 'ею', 'ом', 'ем', 'ых', 'их',
    'ы', 'и', 'а', 'я', 'у', 'ю', 'е', 'о', 'ь',
  ];

  function stemToken(tok) {
    // Режем окончания в несколько проходов: «кузнецова» → «кузнецов» → «кузнец»,
    // иначе родительный падеж фамилии не совпадёт с именительным.
    let t = tok;
    for (let pass = 0; pass < 3; pass += 1) {
      let cut = null;
      for (const end of RU_ENDINGS) {
        if (t.length - end.length >= 3 && t.endsWith(end)) {
          cut = t.slice(0, t.length - end.length);
          break;
        }
      }
      if (!cut) break;
      t = cut;
    }
    return t;
  }

  function sameWord(x, y) {
    if (x === y) return true;
    // Обрезанные имена: «Иван Петров…» / инициалы
    if ((x.length <= 2 || /[.…]$/.test(x)) && y.startsWith(x)) return true;
    if ((y.length <= 2 || /[.…]$/.test(y)) && x.startsWith(y)) return true;
    return stemToken(x) === stemToken(y);
  }

  /**
   * Сравнение ожидаемого имени с именем, которое Facebook показал в окне
   * подтверждения/успеха. Возвращает true / false / null (сравнить нельзя).
   *
   * Падежи FB учитываем сравнением основ слов, но ТОЛЬКО на одной и той же
   * позиции: Facebook меняет падеж, а порядок слов сохраняет. Иначе
   * «Иван Петров» совпал бы с «Пётр Иванов» (однофамильцы/перестановка).
   */
  function namesMatch(expected, actual) {
    const a = normName(expected);
    const b = normName(actual);
    if (!a || !b) return null;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;

    const ta = a.split(' ').filter(Boolean);
    const tb = b.split(' ').filter(Boolean);
    if (!ta.length || !tb.length) return null;

    const n = Math.min(ta.length, tb.length);
    let hits = 0;
    for (let i = 0; i < n; i += 1) {
      if (sameWord(ta[i], tb[i])) hits += 1;
    }

    // Лишнее слово (отчество, второе имя) допускает одно расхождение.
    const allowedMiss = Math.abs(ta.length - tb.length) === 1 ? 1 : 0;
    return hits >= n - allowedMiss;
  }

  function truncate(text, max) {
    const s = String(text == null ? '' : text);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString('ru-RU', { hour12: false });
    } catch (e) {
      return '';
    }
  }

  /* ------------------------------------------------------------------ *
   * Работа с DOM: клики, видимость, ожидания
   * ------------------------------------------------------------------ */

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (typeof el.getBoundingClientRect !== 'function') return true;
    const rect = el.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return false;
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false;
    return true;
  }

  /** Элемент лежит в контейнере, скрытом от скринридеров (FB так прячет «уехавшие» слои). */
  function isInAriaHidden(el) {
    return !!(el && el.closest && el.closest('[aria-hidden="true"]'));
  }

  function mouseEventInit(extra) {
    return Object.assign(
      {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: typeof window !== 'undefined' ? window : null,
        button: 0,
        detail: 1,
      },
      extra || {}
    );
  }

  /**
   * «Настоящий» клик: интерфейс Facebook реагирует на полный набор событий,
   * поэтому эмулируем наведение мыши и нажатие, а не только element.click().
   */
  function realClick(el) {
    if (!el) return false;
    try {
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch (e) {
      /* не критично */
    }

    try {
      const pointerSupported = typeof PointerEvent === 'function';
      const pointer = (type, buttons) => {
        if (!pointerSupported) return;
        el.dispatchEvent(
          new PointerEvent(
            type,
            mouseEventInit({ buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1 })
          )
        );
      };
      const mouse = (type, buttons) =>
        el.dispatchEvent(new MouseEvent(type, mouseEventInit({ buttons, clientX: 1, clientY: 1 })));

      pointer('pointerover', 0);
      mouse('mouseover', 0);
      pointer('pointerenter', 0);
      mouse('mouseenter', 0);
      pointer('pointerdown', 1);
      mouse('mousedown', 1);
      try {
        if (typeof el.focus === 'function') el.focus({ preventScroll: true });
      } catch (e) {
        /* не критично */
      }
      pointer('pointerup', 0);
      mouse('mouseup', 0);
      mouse('click', 0);
      return true;
    } catch (e) {
      try {
        if (typeof el.click === 'function') {
          el.click();
          return true;
        }
      } catch (e2) {
        /* не критично */
      }
      return false;
    }
  }

  /** Нажатие клавиши (нужно, чтобы закрыть открытое меню Facebook без лишних кликов). */
  function dispatchKey(el, key, code, keyCode) {
    const target = el || document.body || document;
    const opts = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };
    target.dispatchEvent(new KeyboardEvent('keydown', opts));
    target.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  /** Ждём, пока fn() вернёт «истину». Возвращает значение функции или null. */
  async function waitFor(fn, options) {
    const opts = options || {};
    const timeout = Number.isFinite(opts.timeout) ? opts.timeout : 5000;
    const interval = Number.isFinite(opts.interval) ? opts.interval : 120;
    const deadline = Date.now() + timeout;
    for (;;) {
      let value = null;
      try {
        value = fn();
      } catch (e) {
        value = null;
      }
      if (value) return value;
      if (Date.now() >= deadline) return null;
      await sleep(interval);
    }
  }

  /** Ждём исчезновения элемента. */
  function waitGone(el, timeout) {
    return waitFor(() => (el && el.isConnected && isVisible(el) ? null : true), { timeout: timeout || 8000 });
  }

  /* ------------------------------------------------------------------ *
   * Хранилище (chrome.storage.local, с фолбэком на localStorage)
   * ------------------------------------------------------------------ */

  function hasExtensionStorage() {
    return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
  }

  async function storageGet(key, def) {
    if (hasExtensionStorage()) {
      try {
        const res = await chrome.storage.local.get(key);
        return res && Object.prototype.hasOwnProperty.call(res, key) ? res[key] : def;
      } catch (e) {
        log.warn('storage.get не сработал', e);
        return def;
      }
    }
    try {
      const raw = globalThis.localStorage ? localStorage.getItem(key) : null;
      return raw == null ? def : JSON.parse(raw);
    } catch (e) {
      return def;
    }
  }

  async function storageSet(key, value) {
    if (hasExtensionStorage()) {
      try {
        await chrome.storage.local.set({ [key]: value });
        return true;
      } catch (e) {
        log.warn('storage.set не сработал', e);
        return false;
      }
    }
    try {
      if (globalThis.localStorage) localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  async function storageRemove(key) {
    if (hasExtensionStorage()) {
      try {
        await chrome.storage.local.remove(key);
        return true;
      } catch (e) {
        return false;
      }
    }
    try {
      if (globalThis.localStorage) localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ *
   * Настройки
   * ------------------------------------------------------------------ */

  const settings = {
    cache: Object.assign({}, DEFAULT_SETTINGS),

    async load() {
      const stored = await storageGet(KEYS.settings, {});
      this.cache = Object.assign({}, DEFAULT_SETTINGS, stored && typeof stored === 'object' ? stored : {});
      const storedVersion = stored && Number(stored.settingsVersion);
      if (!Number.isFinite(storedVersion) || storedVersion < DEFAULT_SETTINGS.settingsVersion) {
        // Новая панель работает без тестового режима, пропускает уже известные
        // блокировки по умолчанию и сохраняет только актуальные параметры.
        this.cache.skipKnown = true;
        this.cache.dryRun = false;
        this.cache.pauseEvery = 0;
        this.cache.pauseFor = 0;
        this.cache.tabsActive = false;
        this.cache.verbose = true;
        await storageSet(KEYS.settings, this.cache);
      }
      return this.cache;
    },

    async save(patch) {
      this.cache = Object.assign({}, this.cache, patch || {});
      await storageSet(KEYS.settings, this.cache);
      return this.cache;
    },

    async replace(values) {
      this.cache = Object.assign({}, DEFAULT_SETTINGS, values || {});
      await storageSet(KEYS.settings, this.cache);
      return this.cache;
    },
  };

  /* ------------------------------------------------------------------ *
   * История блокировок
   * ------------------------------------------------------------------ */

  const HISTORY_LIMIT = 800;

  async function historyGet() {
    const list = await storageGet(KEYS.history, []);
    return Array.isArray(list) ? list : [];
  }

  async function historyAdd(entry) {
    const list = await historyGet();
    list.unshift(Object.assign({ ts: Date.now() }, entry));
    await storageSet(KEYS.history, list.slice(0, HISTORY_LIMIT));
  }

  async function historyClear() {
    await storageRemove(KEYS.history);
    await storageRemove(KEYS.blocked);
  }

  /** Карта «ключ профиля → {ts, name}» успешно заблокированных. */
  async function blockedGet() {
    const map = await storageGet(KEYS.blocked, {});
    return map && typeof map === 'object' ? map : {};
  }

  async function blockedAdd(key, name) {
    if (!key) return;
    const map = await blockedGet();
    map[key] = { ts: Date.now(), name: name || '' };
    await storageSet(KEYS.blocked, map);
  }

  /* ------------------------------------------------------------------ *
   * Логи в консоль
   * ------------------------------------------------------------------ */

  const log = {
    debug(...args) {
      if (globalThis.console && console.debug) console.debug(LOG_PREFIX, ...args);
    },
    info(...args) {
      if (globalThis.console && console.info) console.info(LOG_PREFIX, ...args);
    },
    warn(...args) {
      if (globalThis.console && console.warn) console.warn(LOG_PREFIX, ...args);
    },
    error(...args) {
      if (globalThis.console && console.error) console.error(LOG_PREFIX, ...args);
    },
  };

  BM.util = {
    LOG_PREFIX,
    KEYS,
    DEFAULT_SETTINGS,
    RE,
    HISTORY_LIMIT,
    sleep,
    jitter,
    clampNumber,
    norm,
    normName,
    cleanText,
    nameOf,
    describeEl,
    namesMatch,
    truncate,
    formatTime,
    isVisible,
    isInAriaHidden,
    realClick,
    dispatchKey,
    waitFor,
    waitGone,
    hasExtensionStorage,
    storageGet,
    storageSet,
    storageRemove,
    settings,
    historyGet,
    historyAdd,
    historyClear,
    blockedGet,
    blockedAdd,
    log,
  };
})();

