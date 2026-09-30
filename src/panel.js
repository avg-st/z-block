/**
 * «Блокировщик мразей» — панель управления на странице.
 *
 * Панель живёт в Shadow DOM, чтобы стили Facebook её не ломали.
 * Здесь же: настройки, лог, кнопки «🚫» в строках списка и запуск прогона.
 */
(() => {
  'use strict';

  const BM = (globalThis.BM = globalThis.BM || {});
  if (BM.panel) return;

  const U = BM.util;
  const Fb = BM.fb;
  const Eng = BM.engine;

  const HOST_ID = 'bm-panel-host';
  const LOG_MAX = 250;

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
    .bm-panel {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
      width: 54px; height: 54px; color: #e9eaf0;
      font-size: 13px; line-height: 1.35; user-select: none;
    }
    .bm-launch {
      all: unset; position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; border: 1px solid #474b5b; border-radius: 18px;
      color: #fff; background: #252936; box-shadow: 0 8px 28px rgba(0,0,0,.42);
      cursor: pointer; font-size: 24px; transition: transform .16s ease, background .16s ease;
    }
    .bm-launch:hover { background: #34394a; transform: translateY(-1px); }
    .bm-count {
      position: absolute; top: -5px; right: -5px; min-width: 21px; height: 21px;
      display: grid; place-items: center; padding: 0 5px; border-radius: 12px;
      border: 2px solid #1c1e26; background: #c0392b; color: #fff;
      font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .bm-menu {
      position: absolute; right: 0; bottom: calc(100% + 10px); top: auto;
      display: flex; flex-direction: column; width: min(360px, var(--bm-menu-max-width, 360px));
      max-width: calc(100vw - 24px);
      max-height: var(--bm-menu-max-height, calc(100dvh - 32px)); overflow: hidden; color: #e9eaf0;
      background: #1c1e26; border: 1px solid #34363f; border-radius: 14px;
      box-shadow: 0 12px 36px rgba(0,0,0,.5); font-size: 13px; line-height: 1.35;
      opacity: 1; transform: translateY(0) scale(1); transform-origin: bottom right;
      transition: opacity .16s ease, transform .16s ease, visibility .16s;
    }
    .bm-panel[data-placement="below"] .bm-menu { top: calc(100% + 10px); bottom: auto; transform-origin: top right; }
    .bm-panel[data-align="left"] .bm-menu { left: 0; right: auto; transform-origin: top left; }
    .bm-panel[data-align="left"][data-placement="above"] .bm-menu { transform-origin: bottom left; }
    .bm-panel[data-collapsed="1"] .bm-menu {
      visibility: hidden; opacity: 0; pointer-events: none; transform: translateY(6px) scale(.98);
    }
    .bm-panel[data-placement="below"][data-collapsed="1"] .bm-menu { transform: translateY(-6px) scale(.98); }
    .bm-head {
      display: flex; align-items: center; gap: 10px; padding: 12px 14px;
      min-height: 58px; flex: 0 0 auto; cursor: move;
      background: linear-gradient(135deg, #242938, #1c1e26 78%);
      border-bottom: 1px solid #343746;
    }
    .bm-heading { flex: 1; min-width: 0; }
    .bm-title { display: block; font-weight: 700; letter-spacing: .01em; font-size: 14px; }
    .bm-subtitle { display: block; margin-top: 2px; color: #989fb0; font-size: 11px; }
    .bm-icon { all: unset; cursor: pointer; display:grid; place-items:center; width:30px; height:30px; border-radius:9px; font-size:14px; color:#b9bcc7; background:rgba(255,255,255,.045); }
    .bm-icon:hover { background: rgba(255,255,255,.11); color: #fff; }
    .bm-body { min-height: 0; padding: 12px; display: flex; flex-direction: column; gap: 11px; overflow: auto; overscroll-behavior: contain; background: #191b22; }
    .bm-status { color: #cbd1df; min-height: 2.2em; padding: 9px 10px; border: 1px solid #303442; border-radius: 10px; background: #20232d; }
    .bm-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 7px; }
    .bm-btn {
      all: unset; min-width: 0; cursor: pointer; text-align: center; padding: 8px 10px; border-radius: 9px;
      background: #303441; color: #eef0f6; font-size: 12px; font-weight: 600; transition: background .15s ease, transform .15s ease;
    }
    .bm-btn:hover { background: #3b4050; }
    .bm-btn:active { transform: translateY(1px); }
    .bm-btn[disabled] { opacity: .45; cursor: default; }
    .bm-primary { background: linear-gradient(135deg, #e5484d, #bf3039); color:#fff; }
    .bm-primary:hover { background: linear-gradient(135deg, #f25459, #d33b44); }
    .bm-danger { background: #412a30; color: #ffb4b8; }
    .bm-small { flex: none; font-size: 11px; padding: 7px 9px; }
    .bm-settings { border: 1px solid #303442; border-radius: 10px; padding: 0 10px; background: #1e2029; }
    .bm-settings summary { cursor: pointer; display:flex; align-items:center; gap:8px; min-height:38px; color:#e1e4ec; font-weight:600; list-style:none; }
    .bm-settings summary::-webkit-details-marker { display:none; }
    .bm-settings summary::after { content:'⌄'; margin-left:auto; color:#8d94a6; transition:transform .15s ease; }
    .bm-settings[open] summary::after { transform:rotate(180deg); }
    .bm-settings[open] summary { border-bottom: 1px solid #303442; margin-bottom: 8px; }
    .bm-field { display: block; margin: 8px 0 10px; color: #cbd1df; font-size:12px; }
    .bm-field input, .bm-field select {
      all: unset; display: block; width: 100%; margin-top: 4px; padding: 5px 7px;
      background: #15171e; border: 1px solid #383c4a; border-radius: 8px; color: #f2f3f7;
    }
    .bm-field input:focus, .bm-field select:focus { border-color:#7d8db7; box-shadow:0 0 0 2px rgba(125,141,183,.18); }
    .bm-field select { cursor: pointer; }
    .bm-range { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .bm-range input { flex: 1; min-width: 0; margin-top: 0; }
    .bm-check { display: flex; gap: 8px; align-items: flex-start; margin: 9px 0; color: #cbd1df; cursor: pointer; font-size:12px; }
    .bm-check input { all: revert; margin: 2px 0 0; accent-color:#ee555c; }
    .bm-stats { color: #9fa8bb; font-variant-numeric: tabular-nums; font-size:11px; }
    .bm-log {
      max-height: 145px; overflow: auto; background: #15171e; border: 1px solid #2c303c;
      border-radius: 8px; padding: 7px; display: flex; flex-direction: column; gap: 4px;
      user-select: text;
    }
    .bm-log:empty::before { content: "лог пуст"; color: #6d7180; }
    .bm-entry { display: flex; gap: 6px; }
    .bm-entry .t { color: #6d7180; flex: none; font-variant-numeric: tabular-nums; }
    .bm-entry .m { word-break: break-word; }
    .bm-ok .m { color: #6dd88a; }
    .bm-dry .m { color: #e2c25a; }
    .bm-failed .m { color: #ef7b6d; }
    .bm-known .m, .bm-skipped .m, .bm-debug .m { color: #7c8090; }
    .bm-info .m { color: #9fc4ef; }
    .bm-foot { display: flex; gap: 6px; flex-wrap:wrap; margin: 8px 0; }
    .bm-tabinfo { color: #9fc4ef; margin: 6px 0 2px; font-size:11px; }
    .bm-names {
      margin: 4px 0 0; padding-left: 18px; max-height: 160px; overflow: auto;
      color: #c9ccd6; user-select: text;
    }
    .bm-hint { color: #858da0; font-size: 11px; line-height:1.45; margin: 6px 0 9px; }
    .bm-section-title { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#aeb5c5; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
    .bm-history { padding: 9px 10px; border:1px solid #34313b; border-radius:9px; background:#211e25; color:#e6c7ca; }
    .bm-history:hover { background:#30242a; }
    @media (max-width: 380px) { .bm-menu { width: calc(100vw - 24px); } .bm-actions { grid-template-columns:minmax(0,1fr) auto; } .bm-actions [data-role="stop"] { grid-column:2; grid-row:1; } }
  `;

  const TEMPLATE = `
    <div class="bm-panel" data-role="panel" data-collapsed="1">
      <button class="bm-launch" data-role="collapse" title="Открыть меню блокировщика" aria-label="Открыть меню блокировщика" aria-expanded="false">
        <span aria-hidden="true">🚫</span>
        <span class="bm-count" data-role="count" title="Сколько человек видно в открытом списке">0</span>
      </button>
      <div class="bm-menu" data-role="menu">
      <div class="bm-head" data-role="head">
        <div class="bm-heading"><span class="bm-title">Блокировщик</span><span class="bm-subtitle">Управление списком Facebook</span></div>
        <button class="bm-icon" data-role="close" title="Свернуть меню" aria-label="Свернуть меню">✕</button>
      </div>
      <div class="bm-body">
        <div class="bm-status" data-role="status">Нажмите «↻», когда откроете окно реакций.</div>
        <div class="bm-actions">
          <button class="bm-btn bm-primary" data-role="run">Начать блокировку</button>
          <button class="bm-btn bm-danger" data-role="stop" disabled>Стоп</button>
          <button class="bm-btn bm-small" data-role="rescan" title="Вручную обновить список">Обновить</button>
        </div>
        <details class="bm-settings">
          <summary>Параметры обработки</summary>
          <label class="bm-field">Лимит за прогон (0 — без лимита)
            <input type="number" data-role="limit" min="0" step="1">
          </label>
          <label class="bm-check"><input type="checkbox" data-role="skipKnown"> <span>Пропускать аккаунты из локальной истории блокировок</span></label>
          <label class="bm-check"><input type="checkbox" data-role="rowButtons"> <span>Показывать кнопку блокировки в каждой строке</span></label>
          <label class="bm-field">Режим блокировки
            <select data-role="strategy">
              <option value="list">В открытом списке</option>
              <option value="tabs">Через вкладки профилей (параллельно)</option>
            </select>
          </label>
          <label class="bm-field">Вкладок одновременно (режим вкладок, максимум 100)
            <input type="number" data-role="maxTabs" min="1" max="100" step="1">
          </label>
          <label class="bm-check"><input type="checkbox" data-role="noScroll"> <span>Обрабатывать только уже загруженные строки</span></label>
          <div class="bm-hint">Если отключить этот параметр, список будет прокручиваться для загрузки следующих аккаунтов.</div>
        </details>
        <details class="bm-settings" data-role="namesBox">
          <summary>Найденные аккаунты <b data-role="namesCount">0</b></summary>
          <div class="bm-tabinfo" data-role="tabInfo"></div>
          <ol class="bm-names" data-role="names"></ol>
          <div class="bm-hint">Проверьте список перед запуском. После прокрутки или смены вкладки нажмите «Обновить».</div>
        </details>
        <div class="bm-stats" data-role="stats"></div>
        <details class="bm-settings" data-role="logDetails" open>
          <summary>Журнал работы</summary>
          <div class="bm-foot">
            <button class="bm-btn bm-small" data-role="copy">Скопировать журнал</button>
            <button class="bm-btn bm-small" data-role="clear">Очистить журнал</button>
          </div>
          <div class="bm-log" data-role="log"></div>
          <div class="bm-hint">Очистка журнала удаляет только сообщения на этой странице и не меняет список уже заблокированных.</div>
        </details>
        <details class="bm-settings">
          <summary>История и данные</summary>
          <button class="bm-btn bm-history" data-role="reset" title="Очистить локальные отметки о ранее заблокированных аккаунтах">Сбросить историю блокировок</button>
          <div class="bm-hint">Это позволит обработать аккаунты повторно. Люди не будут разблокированы в Facebook.</div>
        </details>
      </div>
      </div>
    </div>
  `;


  let host = null;
  let shadow = null;
  let els = {};
  let ctx = null;
  let running = false;
  let logEntries = [];
  let lastRows = [];
  let dragState = null;

  const FORM_KEYS = [
    'limit',
    'skipKnown',
    'rowButtons',
    'strategy',
    'maxTabs',
    'noScroll',
  ];

  function byRole(name) {
    return shadow ? shadow.querySelector(`[data-role="${name}"]`) : null;
  }

  function build() {
    const existing = document.getElementById(HOST_ID);
    if (existing && existing.shadowRoot) {
      host = existing;
      shadow = existing.shadowRoot;
    } else {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.setAttribute('data-bm-ignore', '1');
      host.style.cssText = 'all: initial;';
      shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>${STYLES}</style>${TEMPLATE}`;
      (document.body || document.documentElement).appendChild(host);
    }

    els = { panel: byRole('panel'), head: byRole('head'), menu: byRole('menu'), count: byRole('count'), collapse: byRole('collapse'), close: byRole('close') };
    for (const name of ['status', 'run', 'stop', 'rescan', 'stats', 'log', 'copy', 'clear', 'reset', 'names', 'namesCount', 'tabInfo']) {
      els[name] = byRole(name);
    }
    for (const name of FORM_KEYS) els[name] = byRole(name);
    wire();
  }

  function wire() {
    const setCollapsed = (collapsed, persist = true) => {
      els.panel.setAttribute('data-collapsed', collapsed ? '1' : '0');
      els.collapse.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      els.collapse.title = collapsed ? 'Открыть меню блокировщика' : 'Свернуть меню';
      els.collapse.setAttribute('aria-label', els.collapse.title);
      if (!collapsed) requestAnimationFrame(keepMenuInViewport);
      if (persist) U.storageSet('bm_panel_collapsed', collapsed);
    };
    els.collapse.addEventListener('click', () => {
      setCollapsed(els.panel.getAttribute('data-collapsed') === '0');
    });
    els.close.addEventListener('click', () => setCollapsed(true));
    els.panel.setCollapsed = setCollapsed;

    els.run.addEventListener('click', () => {
      start();
    });
    els.stop.addEventListener('click', () => stop());
    els.rescan.addEventListener('click', () => {
      scan();
      if (!running) setStatus(`В списке найдено: ${lastRows.length}`);
    });
    els.copy.addEventListener('click', copyLog);
    els.clear.addEventListener('click', () => logClear());
    els.reset.addEventListener('click', async () => {
      if (!window.confirm('Очистить локальную историю блокировок? Это позволит расширению обрабатывать эти аккаунты повторно, но не разблокирует их в Facebook.')) return;
      await U.historyClear();
      if (ctx) ctx.knownBlocked.clear();
      pushLog({ status: 'info', message: 'история блокировок сброшена' });
    });

    for (const key of FORM_KEYS) {
      if (els[key]) els[key].addEventListener('change', () => saveForm());
    }
    els.rowButtons.addEventListener('change', () => {
      if (!els.rowButtons.checked) removeRowButtons();
    });

    enableDrag();
  }

  /* ------------------------------------------------------------------ *
   * Настройки: форма ↔ хранилище
   * ------------------------------------------------------------------ */

  function readForm() {
    return {
      limit: U.clampNumber(els.limit.value, 0, 0, 100000),
      skipKnown: !!els.skipKnown.checked,
      rowButtons: !!els.rowButtons.checked,
      strategy: els.strategy.value === 'tabs' ? 'tabs' : 'list',
      maxTabs: U.clampNumber(els.maxTabs.value, U.DEFAULT_SETTINGS.maxTabs, 1, 100),
      noScroll: !!els.noScroll.checked,
      dryRun: false,
      pauseEvery: 0,
      pauseFor: 0,
      tabsActive: false,
      verbose: true,
    };
  }

  async function saveForm() {
    await U.settings.save(readForm());
  }

  function applySettingsToForm() {
    if (!els.limit) return;
    const s = Object.assign({}, U.DEFAULT_SETTINGS, U.settings.cache);
    els.limit.value = s.limit;
    els.skipKnown.checked = !!s.skipKnown;
    els.rowButtons.checked = !!s.rowButtons;
    els.strategy.value = s.strategy === 'tabs' ? 'tabs' : 'list';
    els.maxTabs.value = s.maxTabs;
    els.noScroll.checked = !!s.noScroll;
  }

  /* ------------------------------------------------------------------ *
   * Статус, статистика, лог
   * ------------------------------------------------------------------ */

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function renderStats(context) {
    const stats = (context || ctx || { stats: null }).stats;
    if (!stats) return;
    els.stats.textContent =
      `Заблокировано: ${stats.ok} · пропущено ранее: ${stats.known} · ошибок: ${stats.failed}`;
  }

  function summaryText(context) {
    const s = context.stats;
    if (context.dryRun) return `Тестовый прогон завершён: проверено ${s.dry}, ошибок ${s.failed}. Реальная блокировка — снимите галочку «Тестовый прогон».`;
    return `Готово. Заблокировано: ${s.ok}, ошибок: ${s.failed}, уже было ранее: ${s.known}.`;
  }

  function pushLog(entry) {
    const item = Object.assign({ ts: Date.now(), status: 'info', message: '' }, entry);
    logEntries.push(item);
    if (logEntries.length > LOG_MAX) logEntries = logEntries.slice(-LOG_MAX);
    renderLogEntry(item);
  }

  function renderLogEntry(item) {
    if (!els.log) return;
    const row = document.createElement('div');
    row.className = `bm-entry bm-${item.status || 'info'}`;
    const time = document.createElement('span');
    time.className = 't';
    time.textContent = U.formatTime(item.ts);
    const message = document.createElement('span');
    message.className = 'm';
    message.textContent = item.name ? `${item.name}: ${item.message}` : item.message;
    row.append(time, message);
    els.log.appendChild(row);
    while (els.log.childElementCount > LOG_MAX) els.log.removeChild(els.log.firstElementChild);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function logClear() {
    logEntries = [];
    if (els.log) els.log.textContent = '';
  }

  function logText() {
    return logEntries
      .map((e) => `${U.formatTime(e.ts)} [${e.status}] ${e.name ? e.name + ': ' : ''}${e.message}`)
      .join('\n');
  }

  async function copyLog() {
    const text = logText();
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Лог скопирован в буфер обмена');
    } catch (e) {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        setStatus('Лог скопирован');
      } catch (e2) {
        setStatus('Не удалось скопировать лог');
      }
      area.remove();
    }
  }

  /* ------------------------------------------------------------------ *
   * Перетаскивание панели за заголовок
   * ------------------------------------------------------------------ */

  function enableDrag() {
    const head = els.head;
    const panel = els.panel;
    if (!head || !panel) return;

    head.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-role="close"]')) return;
      const rect = panel.getBoundingClientRect();
      dragState = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      if (head.setPointerCapture) {
        try {
          head.setPointerCapture(event.pointerId);
        } catch (e) {
          /* не критично */
        }
      }
      event.preventDefault();
    });

    head.addEventListener('pointermove', (event) => {
      if (!dragState) return;
      const left = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, dragState.left + event.clientX - dragState.x));
      const top = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, dragState.top + event.clientY - dragState.y));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      keepMenuInViewport();
    });

    const finish = async () => {
      if (!dragState) return;
      dragState = null;
      const rect = panel.getBoundingClientRect();
      await U.storageSet(U.KEYS.panelPos, { left: Math.round(rect.left), top: Math.round(rect.top) });
      keepMenuInViewport();
    };
    head.addEventListener('pointerup', finish);
    head.addEventListener('pointercancel', finish);
  }

  /* ------------------------------------------------------------------ *
   * Сканирование открытого списка и кнопки «🚫» в строках
   * ------------------------------------------------------------------ */

  function scan() {
    if (!els.count || document.hidden) return;
    const dialog = Fb.findLikesDialog();
    lastRows = dialog ? Fb.collectRows(dialog) : [];
    els.count.textContent = String(lastRows.length);

    // Список к блокировке — ровно то, что сейчас загружено в окне реакций,
    // в том же порядке, в каком строки отображаются пользователю.
    if (els.namesCount) els.namesCount.textContent = String(lastRows.length);
    const tabLabel = dialog ? Fb.selectedTabLabel(dialog) : '';
    if (els.tabInfo) {
      els.tabInfo.textContent = tabLabel
        ? `Открытая вкладка реакций: ${tabLabel}`
        : 'Вкладка реакций не определена';
    }
    if (els.names) {
      els.names.textContent = '';
      for (let i = 0; i < lastRows.length; i += 1) {
        const li = document.createElement('li');
        li.textContent = lastRows[i].name || lastRows[i].key;
        els.names.appendChild(li);
      }
    }

    if (!running) {
      if (!dialog) {
        setStatus('Откройте список реакций и нажмите «↻» (Обновить), чтобы проверить.');
      } else {
        setStatus(`Загружено строк: ${lastRows.length}. Проверьте список ниже и жмите «Блокировать всех».`);
      }
    }
    syncRowButtons();
  }

  function syncRowButtons() {
    const enabled = !!(U.settings.cache && U.settings.cache.rowButtons);
    if (!enabled) {
      removeRowButtons();
      return;
    }
    for (const target of lastRows) {
      const row = target.row;
      if (!row || !row.isConnected) continue;
      if (row.querySelector('.bm-rowbtn')) continue;

      const btn = document.createElement('div');
      btn.className = 'bm-rowbtn';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('data-bm-ignore', '1');
      btn.textContent = '🚫';
      btn.title = `Заблокировать: ${target.name || target.key}`;
      btn.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          blockOne(target);
        },
        true
      );
      row.appendChild(btn);
    }
  }

  function removeRowButtons() {
    for (const el of document.querySelectorAll('.bm-rowbtn')) el.remove();
  }

  /** Блокировка одного человека по кнопке «🚫» в строке. */
  async function blockOne(target) {
    if (running) {
      setStatus('Идёт прогон — дождитесь окончания или нажмите «Стоп»');
      return;
    }
    const dialog = Fb.findLikesDialog();
    const fresh = (dialog && Fb.findRowByKey(dialog, target.key)) || target;
    const single = Eng.createContext({ settings: U.settings.cache, onEvent: onEvent });
    single.info(`точечная блокировка: ${target.name || target.key}`);
    const result = await Eng.blockUserInList(fresh, single);
    if (result.status === Eng.STATUS.FAILED && /«…»/.test(result.message || '') && target.key) {
      // В строке нет «…» (FB не даёт меню для не-друзей) — блокируем через профиль в служебной вкладке.
      single.info(`${target.name || target.key}: в строке нет «…» — блокирую через вкладку профиля`);
      const known = await U.blockedGet();
      for (const key of Object.keys(known)) single.knownBlocked.add(key);
      await Eng.runTabQueue({ targets: [target], api: buildTabApi(), ctx: single });
    } else {
      if (result.status === Eng.STATUS.OK) await U.blockedAdd(target.key, target.name || '');
      single.record(target, result);
    }
    renderStats(single);
  }

  /* ------------------------------------------------------------------ *
   * События движка → интерфейс
   * ------------------------------------------------------------------ */

  const EVENT_STATUS = { debug: 'debug', info: 'info', warn: 'dry', error: 'failed', stopped: 'info' };

  function onEvent(event) {
    if (!event) return;

    if (event.type === 'result') {
      pushLog({ status: event.status, name: event.name || event.key, message: event.message });
    } else if (event.message) {
      pushLog({ status: EVENT_STATUS[event.type] || 'info', message: event.message });
    }

    if (event.type === 'result' || event.type === 'stopped' || event.type === 'info') {
      if (ctx) renderStats(ctx);
    }
  }

  /* ------------------------------------------------------------------ *
   * Запуск прогона
   * ------------------------------------------------------------------ */

  function toggleRunning(active) {
    els.run.disabled = active;
    els.stop.disabled = !active;
  }

  function stop() {
    if (!ctx || !running) {
      setStatus('Сейчас ничего не выполняется');
      return;
    }
    ctx.stop('остановлено пользователем');
    setStatus('Останавливаюсь…');
  }

  /** Сообщение в background.js: открыть/закрыть вкладку или передать задачу в неё. */
  function runtimeSend(message) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, error: 'нет доступа к фоновому скрипту расширения' });
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const err = chrome.runtime.lastError;
          if (err) resolve({ ok: false, error: err.message });
          else resolve(response || { ok: false, error: 'пустой ответ фонового скрипта' });
        });
      } catch (e) {
        resolve({ ok: false, error: String((e && e.message) || e) });
      }
    });
  }

  function buildTabApi() {
    return {
      async openTab(url, active) {
        const reply = await runtimeSend({ type: 'bm:openProfileTab', url, active });
        if (!reply || !reply.ok || reply.tabId == null) {
          return { error: (reply && reply.error) || 'не удалось открыть вкладку' };
        }
        return { tabId: reply.tabId };
      },
      async sendMessage(tabId, message) {
        return await runtimeSend({ type: 'bm:relay', tabId, message });
      },
      async closeTab(tabId) {
        await runtimeSend({ type: 'bm:closeTab', tabId });
      },
    };
  }

  async function start() {
    if (running) return;

    const dialog = Fb.findLikesDialog();
    if (!dialog) {
      setStatus('Не вижу открытого списка лайкнувших. Откройте окно «Нравится» и повторите.');
      return;
    }

    const settings = await U.settings.save(readForm());
    ctx = Eng.createContext({ settings, onEvent: onEvent });
    const known = await U.blockedGet();
    for (const key of Object.keys(known)) ctx.knownBlocked.add(key);

    running = true;
    toggleRunning(true);
    scan();
    pushLog({
      status: 'info',
      message: 'начат прогон блокировки',
    });

    try {
      if (settings.strategy === 'tabs') {
        const targets = await Eng.collectAllTargets(dialog, ctx, (count) =>
          setStatus(`Собираю список… найдено человек: ${count}`)
        );
        ctx.info(`собрано человек: ${targets.length} — открываю пачками по ${settings.maxTabs}`);
        await Eng.runTabQueue({ targets, api: buildTabApi(), ctx, waitTimeout: settings.tabWaitMs });
      } else {
        await Eng.runListMode(ctx, buildTabApi());
      }
      setStatus(summaryText(ctx));
    } catch (e) {
      const message = String((e && e.message) || e);
      ctx.error(message);
      setStatus(`Ошибка: ${message}`);
    } finally {
      running = false;
      toggleRunning(false);
      renderStats(ctx);
      scan();
    }
  }

  /* ------------------------------------------------------------------ *
   * Инициализация панели
   * ------------------------------------------------------------------ */

  let initialized = false;

  function watchStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[U.KEYS.settings]) return;
      U.settings.cache = Object.assign({}, U.DEFAULT_SETTINGS, changes[U.KEYS.settings].newValue || {});
      applySettingsToForm();
    });
  }

  async function restorePosition() {
    const pos = await U.storageGet(U.KEYS.panelPos, null);
    if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return;
    const left = Math.max(8, Math.min(window.innerWidth - els.panel.offsetWidth - 8, pos.left));
    const top = Math.max(8, Math.min(window.innerHeight - els.panel.offsetHeight - 8, pos.top));
    els.panel.style.left = `${left}px`;
    els.panel.style.top = `${top}px`;
    els.panel.style.right = 'auto';
    els.panel.style.bottom = 'auto';
  }

  function keepMenuInViewport() {
    if (!els.panel || !els.menu || els.panel.getAttribute('data-collapsed') === '1') return;
    const panelRect = els.panel.getBoundingClientRect();
    const viewportPadding = 12;
    const above = Math.max(0, panelRect.top - viewportPadding);
    const below = Math.max(0, window.innerHeight - panelRect.bottom - viewportPadding);
    const menuHeight = els.menu.offsetHeight;
    const placeBelow = menuHeight > above && below > above;
    const available = placeBelow ? below : above;
    const menuWidth = els.menu.offsetWidth;
    const leftSpace = Math.max(0, panelRect.right - viewportPadding);
    const rightSpace = Math.max(0, window.innerWidth - panelRect.left - viewportPadding);
    const alignLeft = rightSpace >= leftSpace;
    const horizontalSpace = Math.min(menuWidth || 360, alignLeft ? rightSpace : leftSpace);
    els.panel.setAttribute('data-placement', placeBelow ? 'below' : 'above');
    els.panel.setAttribute('data-align', alignLeft ? 'left' : 'right');
    els.menu.style.setProperty('--bm-menu-max-height', `${available}px`);
    els.menu.style.setProperty('--bm-menu-max-width', `${horizontalSpace}px`);
  }

  function handleViewportResize() {
    if (els.panel.style.left && els.panel.style.top) {
      const left = Math.max(8, Math.min(window.innerWidth - els.panel.offsetWidth - 8, parseFloat(els.panel.style.left)));
      const top = Math.max(8, Math.min(window.innerHeight - els.panel.offsetHeight - 8, parseFloat(els.panel.style.top)));
      els.panel.style.left = `${left}px`;
      els.panel.style.top = `${top}px`;
    }
    keepMenuInViewport();
  }

  function installTestHooks() {
    globalThis.__BM_TEST__ = {
      ready: true,
      hasPanel: () => !!els.panel,
      scan,
      run: () => start(),
      stop,
      isRunning: () => running,
      getLog: () => logEntries.slice(),
      getStats: () => (ctx ? Object.assign({}, ctx.stats) : null),
      getRows: () => lastRows.map((t) => ({ key: t.key, name: t.name })),
      setSettings: async (patch) => {
        const saved = await U.settings.save(patch || {});
        applySettingsToForm();
        scan();
        return saved;
      },
      clearHistory: async () => {
        await U.historyClear();
        return true;
      },
      clearLog: logClear,
      text: () => ({
        status: els.status ? els.status.textContent : '',
        stats: els.stats ? els.stats.textContent : '',
        count: els.count ? els.count.textContent : '',
      }),
    };
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    await U.settings.load();
    build();
    applySettingsToForm();
    await restorePosition();

    const collapsed = await U.storageGet('bm_panel_collapsed', true);
    els.panel.setCollapsed(collapsed, false);
    window.addEventListener('resize', handleViewportResize);

    scan();

    watchStorage();
    installTestHooks();
    U.log.info('панель готова (авто-сканирование отключено — только по кнопке «↻»)');
  }

  BM.panel = { init, scan, start, stop, setStatus, buildTabApi, isRunning: () => running };
})();





