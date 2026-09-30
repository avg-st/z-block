/**
 * «Блокировщик мразей» — всплывающее окно расширения.
 * Показывает краткую инструкцию, историю блокировок и служебные кнопки.
 */
(() => {
  'use strict';

  const U = globalThis.BM && globalThis.BM.util;
  const blockedCount = document.getElementById('blockedCount');
  const historyCount = document.getElementById('historyCount');
  const updated = document.getElementById('updated');
  const recent = document.getElementById('recent');
  const note = document.getElementById('note');

  function showNote(text) {
    note.textContent = text || '';
  }

  async function render() {
    if (!U) {
      showNote('Не удалось загрузить модули расширения.');
      return;
    }
    const history = await U.historyGet();
    const blocked = await U.blockedGet();
    const keys = Object.keys(blocked);

    blockedCount.textContent = String(keys.length);
    historyCount.textContent = String(history.length);
    updated.textContent = history.length
      ? `последняя запись: ${new Date(history[0].ts).toLocaleString('ru-RU')}`
      : '';

    recent.textContent = '';
    for (const entry of history.slice(0, 12)) {
      const li = document.createElement('li');
      const name = entry.name || entry.key || '';
      li.textContent = `${new Date(entry.ts).toLocaleString('ru-RU')} — ${name} ${entry.message ? '· ' + entry.message : ''}`;
      recent.appendChild(li);
    }
    if (!history.length) {
      const li = document.createElement('li');
      li.textContent = 'пока пусто';
      recent.appendChild(li);
    }
  }

  document.getElementById('clear').addEventListener('click', async () => {
    await U.historyClear();
    showNote('История сброшена: расширение снова будет считать всех не заблокированными.');
    await render();
  });

  document.getElementById('closeTabs').addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      showNote('Нет доступа к фоновому скрипту.');
      return;
    }
    chrome.runtime.sendMessage({ type: 'bm:closeWorkerTabs' }, (response) => {
      if (chrome.runtime.lastError) {
        showNote(`Ошибка: ${chrome.runtime.lastError.message}`);
        return;
      }
      showNote(response && response.ok ? `Закрыто вкладок: ${response.closed}` : 'Не удалось закрыть вкладки');
    });
  });

  render();
})();
