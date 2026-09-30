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
      width: 320px; max-width: calc(100vw - 24px); color: #e9eaf0;
      background: #1c1e26; border: 1px solid #34363f; border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,.45); font-size: 13px; line-height: 1.35;
      overflow: hidden; user-select: none;
    }
    .bm-head {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: #23252f; cursor: move; border-bottom: 1px solid #34363f;
    }
    .bm-title { font-weight: 600; font-size: 13px; flex: 1; }
    .bm-count {
      min-width: 26px; text-align: center; padding: 1px 6px; border-radius: 10px;
      background: #3a3d4a; font-variant-numeric: tabular-nums;
    }
    .bm-icon { all: unset; cursor: pointer; padding: 0 6px; border-radius: 6px; font-size: 14px; color: #b9bcc7; }
    .bm-icon:hover { background: #34363f; color: #fff; }
    .bm-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .bm-panel[data-collapsed="1"] .bm-body { display: none; }
    .bm-status { color: #c9ccd6; min-height: 2.2em; }
    .bm-actions { display: flex; gap: 6px; }
    .bm-btn {
      all: unset; cursor: pointer; text-align: center; padding: 7px 10px; border-radius: 8px;
      background: #3a3d4a; color: #f2f3f7; font-size: 13px; flex: 1;
    }
    .bm-btn:hover { background: #464a5a; }
    .bm-btn[disabled] { opacity: .45; cursor: default; }
    .bm-primary { background: #c0392b; font-weight: 600; }
    .bm-primary:hover { background: #d04434; }
    .bm-danger { background: #4a3a3a; }
    .bm-small { flex: none; font-size: 12px; padding: 5px 8px; }
    .bm-settings { border-top: 1px solid #34363f; padding-top: 8px; }
    .bm-settings summary { cursor: pointer; color: #b9bcc7; }
    .bm-field { display: block; margin-top: 8px; color: #c9ccd6; }
    .bm-field input, .bm-field select {
      all: unset; display: block; width: 100%; margin-top: 4px; padding: 5px 7px;
      background: #15161c; border: 1px solid #3a3d4a; border-radius: 6px; color: #f2f3f7;
    }
    .bm-field select { cursor: pointer; }
    .bm-range { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .bm-range input { margin-top: 0; }
    .bm-check { display: flex; gap: 7px; align-items: flex-start; margin-top: 8px; color: #c9ccd6; cursor: pointer; }
    .bm-check input { all: revert; margin-top: 2px; }
    .bm-stats { color: #9fa3b0; font-variant-numeric: tabular-nums; }
    .bm-log {
      max-height: 190px; overflow: auto; background: #15161c; border: 1px solid #2c2e37;
      border-radius: 8px; padding: 6px; display: flex; flex-direction: column; gap: 3px;
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
    .bm-foot { display: flex; gap: 6px; }
    .bm-tabinfo { color: #9fc4ef; margin: 6px 0 2px; }
    .bm-names {
      margin: 4px 0 0; padding-left: 18px; max-height: 160px; overflow: auto;
      color: #c9ccd6; user-select: text;
    }
    .bm-hint { color: #8b8f9c; font-size: 12px; margin-top: 8px; }
  `;

  const TEMPLATE = `
    <div class="bm-panel" data-role="panel">
      <div class="bm-head" data-role="head">
        <span class="bm-title">🚫 Блокировщик мразей</span>
        <span class="bm-count" data-role="count" title="Сколько человек видно в открытом списке">0</span>
        <button class="bm-icon" data-role="collapse" title="Свернуть / развернуть">▾</button>
      </div>
      <div class="bm-body">
        <div class="bm-status" data-role="status">Нажмите «↻», когда откроете окно реакций.</div>
        <div class="bm-actions">
          <button class="bm-btn bm-primary" data-role="run">Блокировать всех</button>
          <button class="bm-btn bm-danger" data-role="stop" disabled>Стоп</button>
          <button class="bm-btn bm-small" data-role="rescan" title="Проверить/обновить список (сканирование вручную)">↻</button>
        </div>
        <details class="bm-settings">
          <summary>Настройки</summary>
          <label class="bm-field">Пауза между людьми, мс
            <span class="bm-range">
              <input type="number" data-role="delayMin" min="100" step="100">
              <span>–</span>
              <input type="number" data-role="delayMax" min="100" step="100">
            </span>
          </label>
          <label class="bm-field">Лимит за прогон (0 — без лимита)
            <input type="number" data-role="limit" min="0" step="1">
          </label>
          <label class="bm-field">Каждые N человек — длинная пауза, мс
            <span class="bm-range">
              <input type="number" data-role="pauseEvery" min="0" step="1">
              <input type="number" data-role="pauseFor" min="0" step="1000">
            </span>
          </label>
          <label class="bm-check"><input type="checkbox" data-role="dryRun"> <span>Тестовый прогон: доходить до «Подтвердить», но не нажимать</span></label>
          <label class="bm-check"><input type="checkbox" data-role="skipKnown"> <span>Пропускать тех, кого уже блокировали (по истории расширения)</span></label>
          <label class="bm-check"><input type="checkbox" data-role="rowButtons"> <span>Кнопка «🚫» в каждой строке списка</span></label>
          <label class="bm-check"><input type="checkbox" data-role="verbose"> <span>Подробный лог (диагностика)</span></label>
          <label class="bm-field">Режим блокировки
            <select data-role="strategy">
              <option value="list">В открытом списке — быстро (по очереди; кого нельзя из строки — параллельно вкладками)</option>
              <option value="tabs">Через вкладки профилей — параллельно, до 100 сразу</option>
            </select>
          </label>
          <label class="bm-check"><input type="checkbox" data-role="tabsActive"> <span>В режиме вкладок активировать вкладку профиля (переключает фокус)</span></label>
          <label class="bm-field">Вкладок одновременно (режим вкладок, максимум 100)
            <input type="number" data-role="maxTabs" min="1" max="100" step="1">
          </label>
          <label class="bm-check"><input type="checkbox" data-role="noScroll"> <span>Блокировать только то, что видно в списке (без автопрокрутки)</span></label>
          <div class="bm-hint">Пауза 2–6 секунд выглядит для Facebook как обычные действия человека. Слишком быстрый массовый прогон может привести к временной блокировке действий.</div>
        </details>
        <details class="bm-settings" data-role="namesBox">
          <summary>Список к блокировке: <b data-role="namesCount">0</b></summary>
          <div class="bm-tabinfo" data-role="tabInfo"></div>
          <ol class="bm-names" data-role="names"></ol>
          <div class="bm-hint">Это строки, которые сейчас загружены в окне реакций, в порядке отображения. Прокрутили список или сменили вкладку — нажмите «↻».</div>
        </details>
        <div class="bm-stats" data-role="stats"></div>
        <div class="bm-log" data-role="log"></div>
        <div class="bm-foot">
          <button class="bm-btn bm-small" data-role="copy">Копировать лог</button>
          <button class="bm-btn bm-small" data-role="clear">Очистить лог</button>
          <button class="bm-btn bm-small" data-role="reset" title="Забыть, кого уже блокировали">Сбросить историю</button>
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
    'delayMin',
    'delayMax',
    'limit',
    'pauseEvery',
    'pauseFor',
    'dryRun',
    'skipKnown',
    'rowButtons',
    'verbose',
    'strategy',
    'tabsActive',
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

    els = { panel: byRole('panel'), head: byRole('head'), count: byRole('count'), collapse: byRole('collapse') };
    for (const name of ['status', 'run', 'stop', 'rescan', 'stats', 'log', 'copy', 'clear', 'reset', 'names', 'namesCount', 'tabInfo']) {
      els[name] = byRole(name);
    }
    for (const name of FORM_KEYS) els[name] = byRole(name);
    wire();
  }

  function wire() {
    els.collapse.addEventListener('click', () => {
      const collapsed = els.panel.getAttribute('data-collapsed') === '1';
      els.panel.setAttribute('data-collapsed', collapsed ? '0' : '1');
      els.collapse.textContent = collapsed ? '▾' : '▸';
      U.storageSet('bm_panel_collapsed', !collapsed);
    });

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
      delayMin: U.clampNumber(els.delayMin.value, U.DEFAULT_SETTINGS.delayMin, 100, 600000),
      delayMax: U.clampNumber(els.delayMax.value, U.DEFAULT_SETTINGS.delayMax, 100, 600000),
      limit: U.clampNumber(els.limit.value, 0, 0, 100000),
      pauseEvery: U.clampNumber(els.pauseEvery.value, 0, 0, 10000),
      pauseFor: U.clampNumber(els.pauseFor.value, 0, 0, 3600000),
      dryRun: !!els.dryRun.checked,
      skipKnown: !!els.skipKnown.checked,
      rowButtons: !!els.rowButtons.checked,
      verbose: !!els.verbose.checked,
      strategy: els.strategy.value === 'tabs' ? 'tabs' : 'list',
      tabsActive: !!els.tabsActive.checked,
      maxTabs: U.clampNumber(els.maxTabs.value, U.DEFAULT_SETTINGS.maxTabs, 1, 100),
      noScroll: !!els.noScroll.checked,
    };
  }

  async function saveForm() {
    await U.settings.save(readForm());
  }

  function applySettingsToForm() {
    if (!els.delayMin) return;
    const s = Object.assign({}, U.DEFAULT_SETTINGS, U.settings.cache);
    els.delayMin.value = s.delayMin;
    els.delayMax.value = s.delayMax;
    els.limit.value = s.limit;
    els.pauseEvery.value = s.pauseEvery;
    els.pauseFor.value = s.pauseFor;
    els.dryRun.checked = !!s.dryRun;
    els.skipKnown.checked = !!s.skipKnown;
    els.rowButtons.checked = !!s.rowButtons;
    els.verbose.checked = !!s.verbose;
    els.strategy.value = s.strategy === 'tabs' ? 'tabs' : 'list';
    els.tabsActive.checked = !!s.tabsActive;
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
      `Заблокировано: ${stats.ok} · тест: ${stats.dry} · ошибок: ${stats.failed} · уже было: ${stats.known}`;
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
      if (event.target.closest('[data-role="collapse"]')) return;
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
      const left = Math.max(0, Math.min(window.innerWidth - 80, dragState.left + event.clientX - dragState.x));
      const top = Math.max(0, Math.min(window.innerHeight - 40, dragState.top + event.clientY - dragState.y));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });

    const finish = async () => {
      if (!dragState) return;
      dragState = null;
      const rect = panel.getBoundingClientRect();
      await U.storageSet(U.KEYS.panelPos, { left: Math.round(rect.left), top: Math.round(rect.top) });
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
    const verbose = !!(U.settings.cache && U.settings.cache.verbose);

    if (event.type === 'result') {
      pushLog({ status: event.status, name: event.name || event.key, message: event.message });
    } else if (event.message && (event.type !== 'debug' || verbose)) {
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
    logClear();
    scan();
    pushLog({
      status: 'info',
      message: settings.dryRun ? 'Старт (тестовый прогон — реальных блокировок не будет)' : 'Старт прогона',
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
    els.panel.style.left = `${pos.left}px`;
    els.panel.style.top = `${pos.top}px`;
    els.panel.style.right = 'auto';
    els.panel.style.bottom = 'auto';

    const rect = els.panel.getBoundingClientRect();
    const outside =
      rect.right > window.innerWidth || rect.bottom > window.innerHeight || rect.left < 0 || rect.top < 0;
    if (outside) {
      els.panel.style.left = '';
      els.panel.style.top = '';
      els.panel.style.right = '16px';
      els.panel.style.bottom = '16px';
    }
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

    const collapsed = await U.storageGet('bm_panel_collapsed', false);
    if (collapsed) {
      els.panel.setAttribute('data-collapsed', '1');
      els.collapse.textContent = '▸';
    }

    scan();

    watchStorage();
    installTestHooks();
    U.log.info('панель готова (авто-сканирование отключено — только по кнопке «↻»)');
  }

  BM.panel = { init, scan, start, stop, setStatus, buildTabApi, isRunning: () => running };
})();





