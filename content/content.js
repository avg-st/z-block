/**
 * «Блокировщик мразей» — точка входа content-скрипта.
 *
 * 1. На обычных страницах Facebook поднимает панель управления.
 * 2. В «служебных» вкладках (открытых движком, с параметром bm_job=1)
 *    панель не нужна: такая вкладка просто получает задачу «заблокировать
 *    владельца этого профиля» и выполняет её.
 */
(() => {
  'use strict';

  const BM = globalThis.BM;
  if (!BM || !BM.util || !BM.engine || !BM.panel) {
    (globalThis.console || {}).error?.(BM && BM.util ? BM.util.LOG_PREFIX : '[БМ]', 'не все модули загрузились');
    return;
  }

  const U = BM.util;
  const Eng = BM.engine;

  /** Служебная вкладка? (её открыл движок, панель в ней не нужна) */
  function isWorkerTab() {
    try {
      return new URLSearchParams(location.search).has('bm_job');
    } catch (e) {
      return false;
    }
  }

  /** Задача «заблокировать владельца этого профиля» — приходит из panel.js через background. */
  async function handleProfileJob(message, sendResponse) {
    const settings = Object.assign({}, U.DEFAULT_SETTINGS, message.settings || U.settings.cache || {});
    const ctx = Eng.createContext({
      settings,
      onEvent: (event) => {
        if (event.message) U.log.info('служебная вкладка:', event.message);
      },
    });
    ctx.dryRun = !!settings.dryRun;
    const result = await Eng.blockOnProfilePage(
      { expectedKey: message.expectedKey, expectedName: message.expectedName },
      ctx
    );
    sendResponse(Object.assign({}, result, { stats: ctx.stats }));
  }

  function installMessageHandler() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message !== 'object') return undefined;

      if (message.type === 'bm:blockProfile') {
        handleProfileJob(message, sendResponse).catch((e) => {
          sendResponse({ status: 'failed', message: String((e && e.message) || e) });
        });
        return true; // ответ будет асинхронным
      }

      if (message.type === 'bm:ping') {
        sendResponse({ ok: true, url: location.href, ready: true });
        return undefined;
      }

      return undefined;
    });
  }

  function boot() {
    installMessageHandler();
    if (isWorkerTab()) return;

    const startPanel = () => {
      BM.panel.init().catch((e) => U.log.error('панель не запустилась', e));
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(startPanel, 300), { once: true });
    } else {
      setTimeout(startPanel, 300);
    }
  }

  boot();
})();
