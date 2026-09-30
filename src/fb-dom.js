/**
 * «Блокировщик мразей» — знание о разметке Facebook.
 *
 * Здесь собраны все селекторы и «находилки»: пункт меню «Заблокировать»,
 * окно «Заблокировать X?» с кнопкой «Подтвердить», строки списка лайкнувших
 * и кнопки-триггеры «…» рядом с ними.
 *
 * Ключевая идея безопасности: любые клики подтверждаются проверкой —
 * открывшееся окно должно относиться к тому самому пользователю.
 */
(() => {
  'use strict';

  const BM = (globalThis.BM = globalThis.BM || {});
  if (BM.fb) return;

  const U = BM.util;

  /**
   * Первые сегменты пути, которые профилем не являются.
   * (нужно, чтобы случайно не заблокировать «кого-то» из /messages, /groups и т.п.)
   */
  const NON_PROFILE_SEGMENTS = new Set([
    'messages', 'notifications', 'watch', 'marketplace', 'gaming', 'groups', 'pages', 'friends',
    'bookmarks', 'events', 'settings', 'help', 'privacy', 'policies', 'ads', 'business', 'live',
    'reels', 'stories', 'photo', 'photos', 'video', 'videos', 'share', 'sharer', 'login', 'checkpoint',
    'recover', 'search', 'composer', 'create', 'memories', 'saved', 'fundraisers', 'jobs', 'offers',
    'weather', 'crisisresponse', 'instantgames', 'hashtag', 'story.php', 'permalink.php', 'plugins',
    'dialog', 'me', 'profile.php', 'l.php', 'privacy', 'about', 'people', 'public', 'p', 'r',
  ]);

  /* ------------------------------------------------------------------ *
   * Профили
   * ------------------------------------------------------------------ */

  /** Ключ профиля из ссылки: 'ivan.petrov' или 'profile.php?id=10001'. */
  function profileKeyOf(href) {
    if (!href) return null;
    let url;
    try {
      url = new URL(href, 'https://www.facebook.com');
    } catch (e) {
      return null;
    }
    if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;

    if (parts[0].toLowerCase() === 'profile.php') {
      const id = url.searchParams.get('id');
      return id && /^\d+$/.test(id) ? `profile.php?id=${id}` : null;
    }
    // /people/Иван-Иванов/100012345678/
    if (parts[0].toLowerCase() === 'people' && parts.length >= 3 && /^\d+$/.test(parts[2])) {
      return `profile.php?id=${parts[2]}`;
    }

    const seg = parts[0];
    const lower = seg.toLowerCase();
    if (NON_PROFILE_SEGMENTS.has(lower)) return null;
    if (seg.length < 5) return null;
    if (!/^[a-z0-9.\-_]+$/i.test(seg)) return null;
    if (/^\d+$/.test(seg)) return null; // /1234567 — не поддерживаем, это редкость
    return lower;
  }

  /** Ссылка на профиль по ключу. */
  function profileUrlOf(key) {
    if (!key) return null;
    if (key.startsWith('profile.php?id=')) {
      return `https://www.facebook.com/profile.php?id=${key.slice('profile.php?id='.length)}`;
    }
    return `https://www.facebook.com/${key}`;
  }

  /** Имя владельца профиля со страницы профиля. */
  function profileNameFromPage() {
    // Пробуем h1 (старый UI)
    const h1 = document.querySelector('h1');
    const fromH1 = h1 ? U.cleanText(h1.textContent) : '';
    if (fromH1 && fromH1.length <= 80) return fromH1;

    // Поиск по role="heading" / aria-level (в новых интерфейсах Facebook имя часто в heading)
    const headings = document.querySelectorAll('[role="heading"], h1, h2, h3, h4, h5, h6');
    for (const el of headings) {
      const t = U.cleanText(el.textContent || '');
      if (t && t.length <= 80 && t.length > 1) {
        // Исключаем заголовки вроде "Подписчики", "Друзья" и т.п.
        if (!U.RE.badTrigger.test(t)) return t;
      }
    }

    // data-testid="profile-name" или data-testid, содержащий "name"
    const testIdEl = document.querySelector('[data-testid="profile-name"], [data-testid*="name"]');
    if (testIdEl) {
      const t = U.cleanText(testIdEl.textContent || '');
      if (t && t.length <= 80) return t;
    }

    // Последний резерв — заголовок страницы
    const title = U.cleanText(document.title || '');
    const cut = title.split('|')[0];
    return cut && cut.length <= 80 ? cut.trim() : '';
  }

  /* ------------------------------------------------------------------ *
   * Меню действий
   * ------------------------------------------------------------------ */

  /** Видимые открытые меню. */
  function visibleMenus() {
    return [...document.querySelectorAll('div[role="menu"], div[role="listbox"], div[role="dialog"][aria-label*="мен"]')]
      .filter((el) => U.isVisible(el) && !U.isInAriaHidden(el));
  }

  /**
   * Ищем пункт «Заблокировать» (не «Разблокировать»!).
   * Возвращает последний подходящий в порядке DOM — то есть самый верхний слой.
   */
  function findBlockMenuItem() {
    const items = document.querySelectorAll('[role="menuitem"], [role="option"], [role="menuitemradio"]');
    let best = null;
    for (const item of items) {
      if (!U.isVisible(item) || U.isInAriaHidden(item)) continue;
      const name = U.nameOf(item);
      if (!name) continue;
      if (U.RE.unblock.test(name)) continue;
      if (!U.RE.blockItem.test(name)) continue;
      best = item;
    }
    if (best) return best;

    // Фолбэк: меню профиля иногда рисует пункт без role="menuitem" —
    // ищем самый глубокий элемент с текстом «Заблокировать» внутри меню.
    for (const menu of visibleMenus()) {
      let deepest = null;
      let deepestCount = Infinity;
      for (const el of menu.querySelectorAll('*')) {
        if (el.closest('[role="menuitem"]')) continue;
        if (isOurNode(el)) continue;
        const text = U.cleanText(el.textContent || '').toLowerCase();
        if (!text) continue;
        if (U.RE.unblock.test(text)) continue;
        if (!U.RE.blockItem.test(text)) continue;
        const descendants = el.querySelectorAll('*').length;
        if (descendants < deepestCount) {
          deepestCount = descendants;
          deepest = el;
        }
      }
      if (deepest && U.isVisible(deepest)) return deepest;
    }
    return null;
  }

  /**
   * Закрывает открытые меню через Escape.
   * Escape нажимаем ТОЛЬКО если меню реально открыто — иначе можно
   * случайно закрыть окно со списком лайкнувших.
   */
  async function closeOpenMenus() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const menus = visibleMenus();
      if (!menus.length) return true;
      U.dispatchKey(menus[menus.length - 1], 'Escape', 'Escape', 27);
      await U.sleep(180);
    }
    return visibleMenus().length === 0;
  }

  /* ------------------------------------------------------------------ *
   * Окно подтверждения блокировки
   * ------------------------------------------------------------------ */

  /** Кнопка «Подтвердить» внутри окна блокировки. */
  function findConfirmButton(dialog) {
    if (!dialog) return null;
    const buttons = dialog.querySelectorAll('[role="button"], button');
    let best = null;
    for (const btn of buttons) {
      const name = U.nameOf(btn);
      if (!name) continue;
      if (U.RE.unblock.test(name)) continue;
      if (U.RE.cancel.test(name) || U.RE.cancelEn.test(name)) continue;
      if (!U.RE.confirm.test(name)) continue;
      best = btn; // последняя подходящая — обычно основная кнопка справа
    }
    return best;
  }

  /** Кнопка отмены внутри окна блокировки («Отмена» / «Отменить блокировку X»). */
  function findCancelButton(dialog) {
    if (!dialog) return null;
    const buttons = dialog.querySelectorAll('[role="button"], button');
    let best = null;
    for (const btn of buttons) {
      const name = U.nameOf(btn);
      if (!name) continue;
      if (U.RE.cancel.test(name) || U.RE.cancelEn.test(name)) best = btn;
    }
    return best;
  }

  /**
   * Похоже ли, что это именно окно «Заблокировать X?».
   * Требуем и заголовок «Заблокировать …», и наличие кнопки «Подтвердить».
   */
  function isBlockConfirmDialog(el) {
    if (!el || !el.querySelector) return false;
    const label = U.norm(el.getAttribute('aria-label') || '');
    const heading = el.querySelector('h1, h2, h3');
    const title = heading ? U.norm(heading.textContent || '') : '';
    if (U.RE.unblock.test(label) || U.RE.unblock.test(title)) return false;
    const titleMatches = U.RE.dialogTitle.test(label) || U.RE.dialogTitle.test(title);
    if (!titleMatches) return false;
    return !!findConfirmButton(el);
  }

  /** Самое верхнее открытое окно «Заблокировать X?». */
  function findBlockConfirmDialog() {
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    let best = null;
    for (const dialog of dialogs) {
      if (!U.isVisible(dialog) || U.isInAriaHidden(dialog)) continue;
      if (!isBlockConfirmDialog(dialog)) continue;
      best = dialog;
    }
    return best;
  }

  /** Имя пользователя из заголовка окна: «Заблокировать Stanislav Brem?» → «Stanislav Brem». */
  function dialogTargetName(dialog) {
    if (!dialog) return '';
    const heading = dialog.querySelector('h1, h2, h3');
    const raw = String(
      dialog.getAttribute('aria-label') || (heading ? heading.textContent : '') || ''
    ).trim();
    return U.cleanText(
      raw
        .replace(/^\s*(заблокировать|блокировать|block)\s+/i, '')
        .replace(/[?\uFF1F\s]+$/, '')
    );
  }

  /** Закрыть окно блокировки (нажать «Отмена» или Escape). true — окно закрылось. */
  async function cancelDialog(dialog) {
    if (!dialog) return true;
    const btn = findCancelButton(dialog);
    if (btn) U.realClick(btn);
    if (await U.waitGone(dialog, 2500)) return true;
    U.dispatchKey(dialog, 'Escape', 'Escape', 27);
    return !!(await U.waitGone(dialog, 2500));
  }

  /* ------------------------------------------------------------------ *
   * Список лайкнувших (окно «Нравится») и его строки
   * ------------------------------------------------------------------ */

  /** Ключ ссылки с кэшем на самом элементе: список сканируется каждые пару секунд. */
  function cachedKeyOf(link) {
    const href = link.getAttribute('href') || link.href || '';
    if (link.__bmHref === href && typeof link.__bmKey !== 'undefined') return link.__bmKey;
    const key = profileKeyOf(href);
    try {
      link.__bmHref = href;
      link.__bmKey = key;
    } catch (e) {
      /* не критично */
    }
    return key;
  }

  /** Все ссылки на профили внутри контейнера, без дублей: Map(ключ → ссылка). */
  function profileLinks(root) {
    const map = new Map();
    if (!root || !root.querySelectorAll) return map;
    for (const link of root.querySelectorAll('a[href]')) {
      if (U.isInAriaHidden(link)) continue;
      const key = cachedKeyOf(link);
      if (!key || map.has(key)) continue;
      map.set(key, link);
    }
    return map;
  }

  /** Сколько уникальных профилей в контейнере. */
  function countProfileLinks(root) {
    return profileLinks(root).size;
  }

  /**
   * Самое подходящее открытое окно со списком людей
   * (лайкнувшие комментарий/публикацию — это один и тот же компонент FB).
   */
  function findLikesDialog() {
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    let best = null;
    let bestRows = -1;
    for (const dialog of dialogs) {
      if (!U.isVisible(dialog) || U.isInAriaHidden(dialog)) continue;
      if (isBlockConfirmDialog(dialog)) continue;
      const rows = countProfileLinks(dialog);
      if (rows <= 0) continue;
      if (rows >= bestRows) {
        best = dialog;
        bestRows = rows;
      }
    }
    return best;
  }

  /** Имя из ссылки на профиль (текст ссылки или alt аватарки). */
  function nameFromLink(link) {
    if (!link) return '';
    const text = U.cleanText(link.textContent || '');
    if (text && text.length <= 80) return text;
    const img = link.querySelector('img[alt]');
    const alt = img ? U.cleanText(img.getAttribute('alt') || '') : '';
    return alt && alt.length <= 80 ? alt : '';
  }

  /** Имя из строки, если ссылка текста не содержит. */
  function nameFromRow(row, link) {
    if (!row) return '';
    for (const el of row.querySelectorAll('[dir="auto"]')) {
      if (link && el.contains(link)) continue;
      if (el.closest('a[href]')) continue;
      const text = U.cleanText(el.textContent || '');
      if (text && text.length <= 80) return text;
    }
    return '';
  }

  /**
   * Строки списка одним проходом. Сначала считаем, сколько уникальных профилей
   * лежит внутри каждого элемента-предка, потом для каждой ссылки поднимаемся
   * вверх, пока контейнер остаётся «одной строкой». Так мы не сканируем
   * поддеревья по кругу — список из сотен строк обрабатывается быстро.
   */
  function collectRows(dialog) {
    const links = profileLinks(dialog);
    const counts = new Map();
    for (const [key, link] of links) {
      let el = link;
      for (let hops = 0; hops < 12 && el.parentElement; hops += 1) {
        el = el.parentElement;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'body' || tag === 'html') break;
        if (el.getAttribute && el.getAttribute('role') === 'dialog') break;
        let set = counts.get(el);
        if (!set) {
          set = new Set();
          counts.set(el, set);
        }
        set.add(key);
        if (set.size > 1) break;
      }
    }

    const rows = [];
    for (const [key, link] of links) {
      const row = rowOf(link, counts);
      rows.push({ key, name: nameFromLink(link) || nameFromRow(row, link), row, link, href: link.href });
    }
    return rows;
  }

  /** Ближайший предок ссылки, который всё ещё похож на одну строку списка. */
  function rowOf(link, counts) {
    let el = link;
    let best = link;
    for (let hops = 0; hops < 8 && el.parentElement; hops += 1) {
      const parent = el.parentElement;
      const tag = (parent.tagName || '').toLowerCase();
      if (tag === 'body' || tag === 'html') break;

      const set = counts.get(parent);
      if (!set || set.size !== 1) break;

      const rect = typeof parent.getBoundingClientRect === 'function' ? parent.getBoundingClientRect() : null;
      if (rect && rect.height > 220) break;

      best = parent;
      el = parent;
    }
    return best;
  }

  /** Строка по ключу профиля (после перерисовок списка). */
  function findRowByKey(dialog, key) {
    return collectRows(dialog).find((row) => row.key === key) || null;
  }

  /* ------------------------------------------------------------------ *
   * Кнопки-триггеры «…» (открывают меню с пунктом «Заблокировать»)
   * ------------------------------------------------------------------ */

  function isOurNode(el) {
    return !!(el && el.closest && el.closest('[data-bm-ignore="1"]'));
  }

  function looksLikeIconButton(el) {
    return !!el.querySelector('i[data-visualcompletion="css-img"], svg, img, [style*="background-image"]');
  }

  /**
   * Кандидаты-триггеры внутри строки списка, отсортированные по «похожести
   * на кнопку …»: сначала aria-haspopup и подписи вроде «Ещё»/«Действия»,
   * затем безымянные иконочные кнопки. Кнопки-ловушки («Добавить в друзья»
   * и т.п.) выкидываем сразу — их нажатие изменило бы состояние аккаунта.
   */
  function rowTriggers(row, target) {
    if (!row) return [];
    const rowRect = typeof row.getBoundingClientRect === 'function' ? row.getBoundingClientRect() : null;
    const all = row.querySelectorAll('[role="button"], [aria-haspopup], button');
    const scored = [];
    for (const el of all) {
      if (target && el === target.link) continue;
      if (isOurNode(el)) continue;
      if (el.closest('a[href]')) continue;
      if (el.closest('[role="menu"]')) continue;
      if (!U.isVisible(el)) continue;

      const name = U.nameOf(el);
      if (name && U.RE.badTrigger.test(name)) continue;

      const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      if (rowRect && rect && rowRect.height > 0) {
        const centerY = rect.top + rect.height / 2;
        if (centerY < rowRect.top - 4 || centerY > rowRect.bottom + 4) continue;
        if (rect.left < rowRect.left - 12 || rect.right > rowRect.right + 12) continue;
      }

      let score = 0;
      if (el.hasAttribute('aria-haspopup')) score += 4;
      if (name && U.RE.goodTrigger.test(name)) score += 6;
      if (!name) score += 2;
      if (looksLikeIconButton(el)) score += 1;
      if ((el.getAttribute('role') || '') === 'button') score += 1;

      scored.push({ el, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.el);
  }

  /**
   * Триггеры «…» на странице профиля (режим «через вкладки»).
   * Профильная кнопка «Ещё» обычно безымянная иконочная или с aria-haspopup.
   */
  function profileTriggers() {
    const all = document.querySelectorAll('[role="button"], [aria-haspopup], button, div[aria-label]');
    const scored = [];
    for (const el of all) {
      if (isOurNode(el)) continue;
      if (el.closest('a[href]')) continue;
      if (el.closest('[role="menu"]')) continue;
      if (el.closest('[role="dialog"]')) continue;
      if (!U.isVisible(el)) continue;

      const name = U.nameOf(el);
      if (name && U.RE.badTrigger.test(name)) continue;

      // Явная кнопка «Настройки профиля» — проверяем aria-label и title (новый UI FB)
      const ariaLabel = (el.getAttribute && el.getAttribute('aria-label')) || '';
      const title = (el.getAttribute && el.getAttribute('title')) || '';
      const labelText = (ariaLabel + ' ' + title).toLowerCase();
      if (labelText.includes('настройки') || labelText.includes('settings') ||
          labelText.includes('профиля') || labelText.includes('меню') ||
          labelText.includes('дополнительные') || labelText.includes('options')) {
        scored.push({ el, score: 100 });
        continue;
      }

      let score = 0;
      if (name && U.RE.goodTrigger.test(name)) score += 6;
      if (el.hasAttribute('aria-haspopup')) score += 4;
      if (!name) score += 1;
      if (looksLikeIconButton(el)) score += 1;
      const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      if (rect && rect.top < 900) score += 2; // шапка профиля — сверху

      if (score >= 4) scored.push({ el, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.el);
  }

  /** Пробуждаем ленивую шапку профиля: FB может отрисовать «…» только при наведении. */
  async function pokeProfileHeader() {
    const spots = [];
    const h1 = document.querySelector('h1');
    if (h1 && h1.parentElement) spots.push(h1.parentElement, h1);
    const banner = document.querySelector('div[role="banner"]');
    if (banner) spots.push(banner);
    const main = document.querySelector('div[role="main"]');
    if (main) {
      spots.push(main);
      const first = main.firstElementChild;
      if (first) spots.push(first);
    }
    for (const el of spots) {
      if (!el) continue;
      try {
        el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      } catch (e) {
        /* не критично */
      }
      try {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      } catch (e) {
        /* не критично */
      }
    }
    await U.sleep(500);
  }

  /* ------------------------------------------------------------------ *
   * Прокрутка списка (догрузка строк)
   * ------------------------------------------------------------------ */

  /** Активная вкладка реакций (например, «Показать 37 человек, … Нравится»). */
  function selectedTabLabel(dialog) {
    if (!dialog || !dialog.querySelector) return '';
    const tab = dialog.querySelector('[role="tab"][aria-selected="true"]');
    if (!tab) return '';
    return U.cleanText(tab.getAttribute('aria-label') || tab.textContent || '');
  }

  /** Прокручиваемый контейнер внутри окна — обычно это список людей. */
  function findScrollContainer(root) {
    if (!root) return null;
    let best = null;
    for (const el of root.querySelectorAll('div')) {
      if (el.scrollHeight <= el.clientHeight + 40) continue;
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
      const overflow = cs ? `${cs.overflowY} ${cs.overflow}` : '';
      if (cs && !/(auto|scroll|overlay)/.test(overflow)) continue;
      if (!best || el.scrollHeight > best.scrollHeight) best = el;
    }
    return best;
  }

    /**
   * Окно «Вы заблокировали X…» (успешный результат после «Подтвердить»).
   * Facebook иногда заменяет confirm-диалог на это сообщение вместо закрытия,
   * а иногда показывает его вообще без role="dialog" — поэтому проверяем
   * в первую очередь по тексту, а не по атрибутам.
   */
  function isBlockSuccessDialog(el) {
    if (!el || !el.querySelector) return false;
    const label = U.cleanText((el.getAttribute && el.getAttribute('aria-label')) || '');
    const content = U.cleanText(el.textContent || '');
    // Фраза успеха — в содержимом окна или в его подписи.
    // Проверяем ОБА: Facebook может перерисовать содержимое confirm-диалога
    // («Вы заблокировали X…»), оставив старый aria-label «Заблокировать X?».
    const inContent = U.RE.blockSuccessAny.test(content);
    const inLabel = U.RE.blockSuccessAny.test(label);
    if (!inContent && !inLabel) return false;
    // Исключаем окно подтверждения: если фраза успеха только в подписи,
    // а содержимое — ещё «Заблокировать X?», это НЕ success.
    if (!inContent && U.RE.dialogTitle.test(label)) return false;
    // Окно успеха не может содержать вложенное окно «Заблокировать X?» —
    // иначе это внешняя обёртка, и мы рискуем принять её за окно успеха.
    if (el.querySelector('[role="dialog"][aria-label^="Заблокировать"], [aria-label^="Заблокировать"][aria-modal]')) {
      return false;
    }
    return true;
  }

  /** Поднимаемся от текста успеха к его модальному контейнеру. */
  function closestSuccessContainer(node) {
    let cur = node;
    let found = null;
    for (let depth = 0; depth < 8 && cur && cur.parentElement && cur.parentElement !== document.body; depth += 1) {
      cur = cur.parentElement;
      if (isOurNode(cur)) break;
      // Не поднимаемся выше контейнера, захватившего чужие меню/окна.
      if (cur.querySelector('[role="menu"], [role="dialog"][aria-label^="Заблокировать"]')) break;
      if (cur.querySelector('[role="button"], button')) found = cur;
    }
    return found || (node.parentElement && !isOurNode(node.parentElement) ? node.parentElement : node);
  }

  /** true, если элемент `a` идёт в документе позже `b` (свежее). */
  function isLaterInDom(a, b) {
    if (!a) return false;
    if (!b || a === b) return true;
    if (typeof b.compareDocumentPosition === 'function') {
      // DOCUMENT_POSITION_FOLLOWING === 4
      return !!(b.compareDocumentPosition(a) & 4);
    }
    return false;
  }

  /**
   * Сбор кандидатов-окон успеха.
   * includeHidden=true ослабляет фильтр: Facebook иногда держит настоящую
   * модалку в aria-hidden-слое (тогда поиск «по видимым» её не видит).
   */
  function collectSuccessCandidates(includeHidden) {
    const out = [];
    const acceptable = (el) => {
      if (!el || isOurNode(el) || !U.isVisible(el)) return false;
      if (!includeHidden && U.isInAriaHidden(el)) return false;
      return true;
    };

    for (const el of document.querySelectorAll(
      'div[role="dialog"], div[role="alertdialog"], [aria-modal="true"], [role="alert"], [role="status"]'
    )) {
      if (!acceptable(el) || !isBlockSuccessDialog(el)) continue;
      out.push(el);
    }

    // Фраза прямо в aria-label (дёшево: читаем только атрибут).
    for (const el of document.querySelectorAll('[aria-label]')) {
      const label = el.getAttribute('aria-label') || '';
      if (!U.RE.blockSuccessAny.test(label)) continue;
      if (!acceptable(el)) continue;
      if (el.querySelector('[role="dialog"][aria-label^="Заблокировать"], [aria-label^="Заблокировать"][aria-modal]')) continue;
      out.push(el);
    }

    // Поиск по тексту без опоры на атрибуты.
    const node = findSuccessTextNode(includeHidden);
    if (node) {
      const container = closestSuccessContainer(node);
      if (container) out.push(container);
    }
    return out;
  }

  function freshestCandidate(list) {
    if (!list || !list.length) return null;
    return list.reduce((latest, el) => (isLaterInDom(el, latest) ? el : latest), null);
  }

  /**
   * Ищем открытое окно успеха в документе.
   * 1) Обычные модалки (role=dialog/alertdialog, aria-modal, role=alert).
   * 2) Элементы, у которых фраза прямо в aria-label.
   * 3) Поиск по тексту документа (XPath) — Facebook показывает это окно
   *    и вовсе без role="dialog".
   * Из всех найденных кандидатов берём самый свежий по порядку документа:
   * Facebook дописывает новые окна в конец, а стратегии находят одно и то же
   * окно на разных уровнях вложенности.
   * Если в обычных слоях ничего нет, повторяем поиск среди скрытых
   * (aria-hidden) — имя всё равно сверяется вызывающим кодом.
   */
  function findBlockSuccessDialog() {
    // Сопоставляем все способы обнаружения вместе: Facebook может оставить
    // старую role=alertdialog и вставить более новое окно без ARIA-ролей.
    // Берём последний контейнер в DOM независимо от способа его нахождения.
    const visibleOnly = collectSuccessCandidates(false);
    if (visibleOnly.length) return freshestCandidate(visibleOnly);
    return freshestCandidate(collectSuccessCandidates(true));
  }

  /** Ищем узел, в тексте которого есть «Вы заблокировали …». */
  function findSuccessTextNode(includeHidden) {
    const hiddenOk = !!includeHidden;
    // XPath: находит только элементы, у которых фраза в собственном текстовом
    // узле, — на тяжёлых страницах Facebook это на порядки дешевле перебора.
    if (typeof document.evaluate === 'function') {
      try {
        const XPATH_ORDERED_SNAPSHOT = 7;
        const found = document.evaluate(
          "//*[contains(text(), 'заблокировали') or contains(text(), 'You blocked') or contains(text(), 'you blocked')]",
          document,
          null,
          XPATH_ORDERED_SNAPSHOT,
          null
        );
        for (let i = found.snapshotLength - 1; i >= 0; i -= 1) {
          const el = found.snapshotItem(i);
          if (!el || !el.tagName) continue;
          if (isOurNode(el) || !U.isVisible(el)) continue;
          if (!hiddenOk && U.isInAriaHidden(el)) continue;
          if (U.RE.dialogTitle.test(U.cleanText(el.textContent || ''))) continue;
          return el;
        }
      } catch (e) {
        /* XPath недоступен — уходим в перебор ниже */
      }
    }

    const nodes = document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], span[dir="auto"], p');
    let found = null;
    for (const el of nodes) {
      if (el.children.length) continue; // только листовые узлы с текстом
      if (isOurNode(el) || !U.isVisible(el)) continue;
      if (!hiddenOk && U.isInAriaHidden(el)) continue;
      const text = U.cleanText(el.textContent || '');
      if (!U.RE.blockSuccessAny.test(text)) continue;
      if (U.RE.dialogTitle.test(text)) continue;
      found = el;
    }
    return found;
  }

  /** Имя из окна успеха «Вы заблокировали X…». */
  function successDialogTargetName(el) {
    if (!el) return '';
    const clean = (s) => U.cleanText(s || '').replace(/^[«"'”]\s*/, '').replace(/\s*[»"'”]$/, '').trim();

    // 1) Заголовок окна — самый надёжный вариант: «Вы заблокировали Clorinda Ieri»
    const heading = el.querySelector('h1, h2, h3, h4, [role="heading"]');
    if (heading) {
      const m = U.cleanText(heading.textContent || '').match(/^(?:вы заблокировали|you blocked)\s+(.+)$/i);
      if (m && m[1]) {
        const name = clean(m[1]);
        if (name && name.length <= 80) return name;
      }
    }

    const text = U.cleanText(el.textContent || '');

    // 2) «Другие профили X не будут заблокированы…» — имя прямо в этой фразе
    const m2 = text.match(/другие профили\s+(.+?)\s+не будут заблокированы/i);
    if (m2 && m2[1]) {
      const name = clean(m2[1]);
      if (name && name.length <= 80) return name;
    }

    // 3) Запасной вариант: текст после «Вы заблокировали» до конца предложения
    const m3 = text.match(/(?:вы заблокировали|you blocked)\s+(.+)/i);
    if (m3 && m3[1]) {
      const sentence = m3[1].split(/(?<=[.!?])\s/)[0];
      const name = clean(sentence);
      if (name && name.length <= 80) return name;
    }
    return '';
  }

  /**
   * Закрываем окно успеха, чтобы оно не мешало блокировать следующих
   * (модальное окно перекрывает список и клики по строкам).
   */
  async function closeBlockSuccessDialog(el) {
    if (!el || !el.isConnected) return true;
    // На случай если поиск по тексту вернул вложенный узел — поднимаемся
    // к ближайшему семантическому окну успеха, где находятся его контролы.
    let container = el;
    for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
      if (isOurNode(cur)) break;
      if (
        cur.matches &&
        cur.matches('[role="alertdialog"], [role="dialog"], [aria-modal="true"]') &&
        isBlockSuccessDialog(cur)
      ) {
        container = cur;
        break;
      }
    }
    // Кнопки, лежащие внутри окна подтверждения, не трогаем — это не «Закрыть».
    const buttons = [...container.querySelectorAll('[role="button"], button')].filter(
      (b) => !b.closest('[role="dialog"][aria-label^="Заблокировать"]')
    );
    const closeBtn =
      buttons.find((b) => /^(закрыть|ок|окей|понятно|готово|close|ok|okay|done)$/i.test(U.nameOf(b))) ||
      buttons.find((b) => /закрыть|close/i.test((b.getAttribute && b.getAttribute('aria-label')) || ''));
    if (closeBtn) {
      U.realClick(closeBtn);
    } else {
      U.dispatchKey(container, 'Escape', 'Escape', 27);
    }
    const gone = await U.waitGone(container, 5000);
    return !!gone;
  }

  BM.fb = {
    NON_PROFILE_SEGMENTS,
    profileKeyOf,
    profileUrlOf,
    profileNameFromPage,
    visibleMenus,
    findBlockMenuItem,
    closeOpenMenus,
    findConfirmButton,
    findCancelButton,
    isBlockConfirmDialog,
    findBlockConfirmDialog,
    dialogTargetName,
    cancelDialog,
    isBlockSuccessDialog,
    findBlockSuccessDialog,
    successDialogTargetName,
    closeBlockSuccessDialog,
    profileLinks,
    countProfileLinks,
    findLikesDialog,
    nameFromLink,
    nameFromRow,
    rowOf,
    collectRows,
    findRowByKey,
    rowTriggers,
    profileTriggers,
    pokeProfileHeader,
    findScrollContainer,
    selectedTabLabel,
    isOurNode,
  };
})();



