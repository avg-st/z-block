/**
 * «Блокировщик мразей» — служебный скрипт расширения (MV3 service worker).
 *
 * Задача максимально простая: открывать/закрывать вкладки профилей и
 * передавать в них сообщения. Вся очередь блокировок живёт в панели на
 * странице, поэтому service worker не «засыпает» посреди прогона.
 */
'use strict';

function reply(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (e) {
    /* страница уже закрылась */
  }
}

async function relayToTab(tabId, payload) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    return { ok: true, response };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/** Закрываем вкладки, оставшиеся от прерванного прогона (у них есть метка bm_job). */
async function closeWorkerTabs() {
  let closed = 0;
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    for (const tab of tabs) {
      if (!tab.url || !tab.url.includes('bm_job=1')) continue;
      try {
        await chrome.tabs.remove(tab.id);
        closed += 1;
      } catch (e) {
        /* вкладку уже закрыли */
      }
    }
  } catch (e) {
    /* нет доступа — не критично */
  }
  return closed;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return undefined;

  if (message.type === 'bm:openProfileTab') {
    chrome.tabs
      .create({ url: message.url, active: !!message.active })
      .then((tab) => reply(sendResponse, { ok: true, tabId: tab.id }))
      .catch((e) => reply(sendResponse, { ok: false, error: String((e && e.message) || e) }));
    return true;
  }

  if (message.type === 'bm:closeTab') {
    chrome.tabs
      .remove(message.tabId)
      .then(() => reply(sendResponse, { ok: true }))
      .catch((e) => reply(sendResponse, { ok: false, error: String((e && e.message) || e) }));
    return true;
  }

  if (message.type === 'bm:relay') {
    relayToTab(message.tabId, message.message).then((result) => reply(sendResponse, result));
    return true;
  }

  if (message.type === 'bm:closeWorkerTabs') {
    closeWorkerTabs().then((closed) => reply(sendResponse, { ok: true, closed }));
    return true;
  }

  return undefined;
});

chrome.runtime.onStartup.addListener(() => {
  closeWorkerTabs();
});
