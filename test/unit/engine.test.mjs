import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadExtension, resetDom } from '../setup.mjs';

loadExtension();

/**
 * Активный симулятор. Слушатели навешиваются на общий документ, поэтому при
 * установке нового симулятора старые надо снимать — иначе несколько
 * симуляторов реагируют на один клик и тесты влияют друг на друга.
 */
let simListeners = null;

/**
 * Симуляция поведения Facebook в ответ на клики расширения:
 *  - клик по «…» (aria-haspopup) → меню с пунктом «Заблокировать»;
 *  - клик по «Заблокировать» → окно «Заблокировать ИМЯ?»;
 *  - клик по «Подтвердить» → окно успеха «Вы заблокировали ИМЯ»;
 *  - клик по «Закрыть» / «Отмена» → окно закрывается;
 *  - Escape закрывает меню и окна.
 */
function installFacebookSim() {
  if (simListeners) {
    document.removeEventListener('click', simListeners.click);
    document.removeEventListener('keydown', simListeners.keydown);
    simListeners = null;
  }

  const sim = { menusOpened: 0, confirms: 0, pendingName: '' };

  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target : e.target.parentElement;
    if (!el) return;

    // Клик «Закрыть» в окне успеха «Вы заблокировали X…» — окно закрывается.
    const success = el.closest('div[role="alertdialog"], div[role="dialog"][aria-label^="Вы заблокировали"], div[role="dialog"][aria-label^="You blocked"]');
    if (success) {
      const name = BM.util.nameOf(el);
      if (/^(закрыть|ок|понятно|готово|close|ok)$/i.test(name)) success.remove();
      return;
    }

    const dialog = el.closest('div[role="dialog"][aria-label^="Заблокировать"]');
    if (dialog) {
      const name = BM.util.nameOf(el);
      if (name === 'подтвердить') {
        sim.confirms += 1;
        dialog.remove();
        // Показать success-окно «Вы заблокировали X...»
        const wrap = document.createElement('div');
        wrap.innerHTML = globalThis.FBMARKUP.successDialog(sim.pendingName || 'Неизвестный');
        document.body.appendChild(wrap.firstElementChild);
        return;
      }
      if (BM.util.RE.cancel.test(name) || name === 'закрыть') {
        dialog.remove();
        return;
      }
      return;
    }

    const item = el.closest('[role="menuitem"]');
    if (item) {
      const name = BM.util.nameOf(item);
      if (BM.util.RE.blockItem.test(name) && !BM.util.RE.unblock.test(name)) {
        item.closest('[role="menu"]').remove();
        const wrap = document.createElement('div');
        wrap.innerHTML = globalThis.FBMARKUP.confirmDialog(sim.pendingName || 'Неизвестный');
        document.body.appendChild(wrap.firstElementChild);
      }
      return;
    }

    if (el.closest('[aria-haspopup="true"]') ||
        (el.getAttribute && /настройки|settings|профиля|дополнительн/i.test(
          (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')
        ))) {
      sim.menusOpened += 1;
      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      menu.innerHTML = globalThis.FBMARKUP.blockMenuItem();
      document.body.appendChild(menu);
    }
  };

  const onKeydown = (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('div[role="menu"]').forEach((m) => m.remove());
    document
      .querySelectorAll('div[role="dialog"][aria-label^="Заблокировать"]')
      .forEach((d) => d.remove());
    document
      .querySelectorAll('div[role="alertdialog"], div[role="dialog"][aria-label^="Вы заблокировали"]')
      .forEach((d) => d.remove());
  };

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  simListeners = { click: onClick, keydown: onKeydown };

  return sim;
}

function ctxOf(overrides) {
  return BM.engine.createContext({
    settings: Object.assign(
      { dryRun: false, delayMin: 1, delayMax: 5, pauseEvery: 0, pauseFor: 0, limit: 0, skipKnown: false },
      overrides
    ),
    onEvent: () => {},
  });
}

function firstTarget(names) {
  document.body.innerHTML = globalThis.FBMARKUP.likesDialog(names);
  const dialog = BM.fb.findLikesDialog();
  return BM.fb.collectRows(dialog)[0];
}

describe('engine.js — confirmBlockDialog', () => {
  beforeEach(() => {
    resetDom();
  });

  it('dryRun: доходит до «Подтвердить», но отменяет', async () => {
    installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Иван Петров');
    const dialog = BM.fb.findBlockConfirmDialog();
    const res = await BM.engine.confirmBlockDialog(dialog, 'Иван Петров', ctxOf({ dryRun: true }));
    assert.equal(res.status, 'dry', JSON.stringify(res));
    assert.match(res.message, /тестовый прогон/);
  });

  it('живой прогон: нажимает «Подтвердить», окно успеха появляется и закрывается', async () => {
    const sim = installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Иван Петров');
    sim.pendingName = 'Иван Петров';
    const dialog = BM.fb.findBlockConfirmDialog();
    const res = await BM.engine.confirmBlockDialog(dialog, 'Иван Петров', ctxOf());
    assert.equal(res.status, 'ok', JSON.stringify(res));
    assert.ok(!dialog.isConnected, 'окно подтверждения должно закрыться');
    assert.equal(BM.fb.findBlockSuccessDialog(), null, 'окно успеха тоже должно закрыться');
  });

  it('чужое имя в окне → отмена и failed', async () => {
    installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Пётр Петров');
    const dialog = BM.fb.findBlockConfirmDialog();
    const res = await BM.engine.confirmBlockDialog(dialog, 'Иван Иванов', ctxOf());
    assert.equal(res.status, 'failed');
    assert.match(res.message, /другой пользователь/);
    assert.ok(!dialog.isConnected, 'окно должно закрыться после отмены');
  });
describe('engine.js — blockUserInList (полный сценарий в списке)', () => {
  it('«…» → «Заблокировать» → «Подтвердить» → ok', async () => {
    resetDom();
    const sim = installFacebookSim();
    const target = firstTarget([{ key: 'ivan.petrov.7', name: 'Иван Петров' }]);
    sim.pendingName = target.name;
    const res = await BM.engine.blockUserInList(target, ctxOf());
    assert.equal(res.status, 'ok', JSON.stringify(res));
    assert.match(res.message, /Иван Петров/);
    assert.ok(res.message.includes('Заблокирован') || res.message.includes('выполнен') || res.message.includes('Иван Петров'), JSON.stringify(res));
    assert.equal(sim.confirms, 1);
  });

  it('dryRun проходит весь путь, но подтверждение отменяется', async () => {
    resetDom();
    const sim = installFacebookSim();
    const target = firstTarget([{ key: 'anna.smir', name: 'Анна Смирнова' }]);
    sim.pendingName = target.name;
    const res = await BM.engine.blockUserInList(target, ctxOf({ dryRun: true }));
    assert.equal(res.status, 'dry', JSON.stringify(res));
    assert.ok(sim.menusOpened >= 1, 'меню должно было открываться');
    assert.equal(sim.confirms, 0, 'в dryRun «Подтвердить» не нажимаем');
  });

  it('строка без триггера «…» → failed, ничего не кликаем', async () => {
    resetDom();
    const sim = installFacebookSim();
    const target = firstTarget([{ key: 'petr.p', name: 'Пётр П' }]);
    target.row.querySelector('[aria-haspopup]').remove();
    const res = await BM.engine.blockUserInList(target, ctxOf());
    assert.equal(res.status, 'failed');
    assert.match(res.message, /«…»/);
    assert.equal(sim.menusOpened, 0);
  });

  it('несовпадение имени в окне → failed, окно отменено', async () => {
    resetDom();
    const sim = installFacebookSim();
    const target = firstTarget([{ key: 'ivan.petrov.7', name: 'Иван Петров' }]);
    sim.pendingName = 'Кто-то Другой';
    const res = await BM.engine.blockUserInList(target, ctxOf());
    assert.equal(res.status, 'failed');
    assert.match(res.message, /другой пользователь/);
  });
});

describe('engine.js — окно успеха «Вы заблокировали X…»', () => {
  beforeEach(() => {
    resetDom();
  });

  it('после «Подтвердить» окно успеха распознаётся как ok и закрывается', async () => {
    const sim = installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Clorinda Ieri');
    sim.pendingName = 'Clorinda Ieri';
    const dialog = BM.fb.findBlockConfirmDialog();

    const res = await BM.engine.confirmBlockDialog(dialog, 'Clorinda Ieri', ctxOf());

    assert.equal(res.status, 'ok', JSON.stringify(res));
    assert.match(res.message, /Clorinda Ieri/);
    assert.equal(sim.confirms, 1, '«Подтвердить» должно быть нажато');
    assert.equal(BM.fb.findBlockSuccessDialog(), null, 'окно успеха должно быть закрыто, чтобы не мешать дальше');
  });

  it('имя берётся из окна успеха (заголовок), а не из хвоста текста', async () => {
    installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.successDialog('Clorinda Ieri');
    const ok = BM.fb.findBlockSuccessDialog();
    assert.ok(ok, 'окно успеха должно находиться');
    assert.equal(BM.fb.successDialogTargetName(ok), 'Clorinda Ieri');
  });

  it('старое окно успеха от прошлой блокировки не путается с новой', async () => {
    const sim = installFacebookSim();
    // «Зависшее» окно успеха другого человека + новое окно подтверждения
    document.body.innerHTML =
      globalThis.FBMARKUP.successDialog('Прошлый Человек') + globalThis.FBMARKUP.confirmDialog('Новый Человек');
    sim.pendingName = 'Новый Человек';
    const dialog = BM.fb.findBlockConfirmDialog();
    assert.ok(BM.fb.findBlockSuccessDialog(), 'старое окно должно быть видно');

    const res = await BM.engine.confirmBlockDialog(dialog, 'Новый Человек', ctxOf());

    assert.equal(res.status, 'ok', JSON.stringify(res));
    assert.match(res.message, /Новый Человек/);
    assert.doesNotMatch(res.message, /Прошлый Человек/);
  });

  it('окно успеха БЕЗ role="dialog" распознаётся по тексту', async () => {
    const sim = installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Іван Ільченко');
    const dialog = BM.fb.findBlockConfirmDialog();

    // Реальный Facebook иногда рисует окно успеха вообще без role/aria-modal:
    // просто текст «Вы заблокировали X» + кнопка «Закрыть».
    const onClick = (e) => {
      const el = e.target instanceof Element ? e.target : e.target.parentElement;
      if (!el || !el.closest('[aria-label="Подтвердить"]')) return;
      sim.confirms += 1;
      dialog.remove();
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="x1n2onr6 x1ja2u2z x1afcbsf">
          <div class="x6s0dn4"><h2 dir="auto"><span dir="auto">Вы заблокировали Івана Ільченко</span></h2></div>
          <div dir="auto"><span dir="auto">Другие профили Івана Ільченко не будут заблокированы, но мы ограничим для этого пользователя возможности взаимодействия с вами в них.</span></div>
          <div aria-label="Закрыть" role="button" tabindex="0"><span>Закрыть</span></div>
        </div>`;
      document.body.appendChild(wrap.firstElementChild);
    };
    document.addEventListener('click', onClick);

    try {
      const res = await BM.engine.confirmBlockDialog(dialog, 'Іван Ільченко', ctxOf());
      assert.equal(res.status, 'ok', JSON.stringify(res));
      assert.match(res.message, /Ільченко/);
    } finally {
      document.removeEventListener('click', onClick);
    }
  });

  it('окно успеха в обёртке с чужим текстом перед фразой тоже распознаётся', async () => {
    resetDom();
    document.body.innerHTML = `
      <div role="alertdialog" aria-label="Вы заблокировали Любов Маленко">
        <div aria-label="Закрыть" role="button"><span class="x1lliihq x6ikm8r x10wlt62">Закрыть</span></div>
        <h2 dir="auto"><span dir="auto">Вы заблокировали Любов Маленко</span></h2>
        <div dir="auto"><span dir="auto">Другие профили Любов Маленко не будут заблокированы.</span></div>
      </div>`;
    const ok = BM.fb.findBlockSuccessDialog();
    assert.ok(ok, 'окно успеха должно находиться');
    assert.equal(BM.fb.successDialogTargetName(ok), 'Любов Маленко');
  });

  it('имя в success-окне не совпало с ожидаемым — прогон ok, но с предупреждением', async () => {
    resetDom();
    const sim = installFacebookSim();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Иван Петров');
    sim.pendingName = 'Совсем Другой';
    const dialog = BM.fb.findBlockConfirmDialog();
    const res = await BM.engine.confirmBlockDialog(dialog, 'Иван Петров', ctxOf());
    assert.equal(res.status, 'ok', JSON.stringify(res));
    assert.match(res.message, /Совсем Другой/);
  });

  it('FB перерисовал ТОТ ЖЕ confirm-диалог в success (aria-label остался «Заблокировать») → ok', async () => {
    resetDom();
    const sim = installFacebookSim();
    // Снимаем слушатели симулятора: здесь нам нужно другое поведение —
    // FB не удаляет окно, а меняет только его содержимое.
    if (simListeners) {
      document.removeEventListener('click', simListeners.click);
      document.removeEventListener('keydown', simListeners.keydown);
      simListeners = null;
    }
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Іван Ільченко');
    const dialog = BM.fb.findBlockConfirmDialog();
    assert.ok(dialog, 'confirm-диалог должен найтись');

    const onClick = (e) => {
      const el = e.target instanceof Element ? e.target : e.target.parentElement;
      if (!el || !el.closest('[aria-label="Подтвердить"]')) return;
      e.stopImmediatePropagation();
      sim.confirms += 1;
      // Содержимое заменяется на успех, aria-label окна остаётся «Заблокировать…».
      const wrap = document.createElement('div');
      wrap.innerHTML = globalThis.FBMARKUP.successDialog('Іван Ільченко');
      dialog.innerHTML = wrap.firstElementChild.innerHTML;
    };
    const onKeydown = (e) => {
      if (e.key === 'Escape' && dialog.isConnected) dialog.remove();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeydown);

    try {
      const res = await BM.engine.confirmBlockDialog(dialog, 'Іван Ільченко', ctxOf());
      assert.equal(res.status, 'ok', JSON.stringify(res));
      assert.match(res.message, /Ільченко/);
      assert.equal(sim.confirms, 1, '«Подтвердить» нажат ровно один раз');
    } finally {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeydown);
    }
  });

  it('FB оставил окно «Заблокировать X?» в DOM и показал окно успеха поверх → ok', async () => {
    resetDom();
    const sim = installFacebookSim();
    // Здесь нужно своё поведение: симулятор удаляет окно подтверждения,
    // а Facebook в реальности оставляет его и рисует окно успеха поверх.
    if (simListeners) {
      document.removeEventListener('click', simListeners.click);
      document.removeEventListener('keydown', simListeners.keydown);
      simListeners = null;
    }
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Любов Маленко');
    const dialog = BM.fb.findBlockConfirmDialog();
    assert.ok(dialog, 'confirm-диалог должен найтись');

    const onClick = (e) => {
      const el = e.target instanceof Element ? e.target : e.target.parentElement;
      if (!el) return;
      // «Закрыть» в окне успеха — убираем окно, как это делает Facebook.
      const success = el.closest('[role="alertdialog"], [aria-label^="Вы заблокировали"]');
      if (success) {
        if (/^(закрыть|ок|понятно|готово)$/i.test(BM.util.nameOf(el))) success.remove();
        return;
      }
      if (!el.closest('[aria-label="Подтвердить"]')) return;
      e.stopImmediatePropagation();
      sim.confirms += 1;
      // Окно подтверждения НЕ удаляем: FB держит его «под» окном успеха.
      const wrap = document.createElement('div');
      wrap.innerHTML = globalThis.FBMARKUP.successDialog('Любов Маленко');
      document.body.appendChild(wrap.firstElementChild);
    };
    document.addEventListener('click', onClick, true);

    try {
      const res = await BM.engine.confirmBlockDialog(dialog, 'Любов Маленко', ctxOf());
      assert.equal(res.status, 'ok', JSON.stringify(res));
      assert.match(res.message, /Любов Маленко/);
      assert.equal(BM.fb.findBlockSuccessDialog(), null, 'окно успеха должно быть закрыто');
    } finally {
      document.removeEventListener('click', onClick, true);
    }
  });

  it('окно успеха внутри aria-hidden-слоя тоже распознаётся (запасной поиск)', () => {
    resetDom();
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = globalThis.FBMARKUP.successDialog('Любов Маленко');
    document.body.appendChild(wrap);
    const found = BM.fb.findBlockSuccessDialog();
    assert.ok(found, 'скрытое окно успеха должно находиться запасным поиском');
    assert.equal(BM.fb.successDialogTargetName(found), 'Любов Маленко');
  });
});

describe('engine.js — runTabQueue (параллельные пачки вкладок)', () => {
  /** Фейковый API вкладок: считает, сколько вкладок открыто одновременно. */
  function makeTabApi() {
    const state = { opened: 0, closed: 0, live: 0, maxLive: 0, batches: [] };
    return {
      state,
      api: {
        async openTab() {
          state.opened += 1;
          state.live += 1;
          if (state.live > state.maxLive) state.maxLive = state.live;
          state.batches.push(state.live);
          return { tabId: state.opened };
        },
        async sendMessage(tabId, message) {
          await new Promise((r) => setTimeout(r, 5));
          return { ok: true, response: { status: 'ok', message: `заблокирован: «${message.expectedName}»` } };
        },
        async closeTab() {
          state.closed += 1;
          state.live -= 1;
        },
      },
    };
  }

  function targets(n) {
    const list = [];
    for (let i = 1; i <= n; i += 1) list.push({ key: `user.${i}`, name: `Человек ${i}` });
    return list;
  }

  it('открывает ровно maxTabs профилей одновременно и обрабатывает всех', async () => {
    const { state, api } = makeTabApi();
    const ctx = ctxOf({ maxTabs: 5 });
    const list = targets(12);

    await BM.engine.runTabQueue({ targets: list, api, ctx });

    assert.equal(state.opened, 12, 'все 12 должны быть обработаны');
    assert.equal(state.closed, 12, 'все вкладки должны быть закрыты');
    assert.equal(state.maxLive, 5, 'одновременно открыто ровно 5 вкладок');
    assert.equal(state.live, 0, 'после прогона живых вкладок не осталось');
    assert.equal(ctx.stats.ok, 12);
  });

  it('по умолчанию открывает пачку до 100 вкладок одновременно', async () => {
    const { state, api } = makeTabApi();
    const ctx = ctxOf(); // maxTabs по умолчанию = 100
    const list = targets(150);

    await BM.engine.runTabQueue({ targets: list, api, ctx });

    assert.equal(state.opened, 150);
    assert.equal(state.maxLive, 100, 'пачка ограничена 100 вкладками');
    assert.equal(BM.engine.MAX_TABS, 100);
  });

  it('maxTabs больше 100 не даёт открыть больше 100 вкладок', async () => {
    const { state, api } = makeTabApi();
    const ctx = ctxOf({ maxTabs: 500 });
    await BM.engine.runTabQueue({ targets: targets(120), api, ctx });
    assert.equal(state.maxLive, 100);
  });

  it('stop() прекращает прогон', async () => {
    const { state, api } = makeTabApi();
    const ctx = ctxOf({ maxTabs: 3 });
    ctx.stop('тест');
    await BM.engine.runTabQueue({ targets: targets(30), api, ctx });
    assert.equal(state.opened, 0, 'после stop ничего не открываем');
  });
});

describe('engine.js — runListMode: строки без «…» уходят в параллельные вкладки', () => {
  /** Фейковый API вкладок: считает, сколько вкладок открыто одновременно. */
  function makeTabApi() {
    const state = { opened: 0, closed: 0, live: 0, maxLive: 0 };
    const api = {
      async openTab() {
        state.opened += 1;
        state.live += 1;
        if (state.live > state.maxLive) state.maxLive = state.live;
        return { tabId: state.opened };
      },
      async sendMessage(tabId, message) {
        await new Promise((r) => setTimeout(r, 5));
        return { ok: true, response: { status: 'ok', message: `заблокирован: «${message.expectedName}»` } };
      },
      async closeTab() {
        state.closed += 1;
        state.live -= 1;
      },
    };
    return { state, api };
  }

  it('люди без кнопки «…» блокируются пачкой параллельно, а не по очереди', async () => {
    resetDom();
    document.body.innerHTML = globalThis.FBMARKUP.likesDialog([
      { key: 'a.one', name: 'Первый Человек' },
      { key: 'b.two', name: 'Второй Человек' },
      { key: 'c.three', name: 'Третий Человек' },
      { key: 'd.four', name: 'Четвёртый Человек' },
    ]);
    const dialog = BM.fb.findLikesDialog();
    const rows = BM.fb.collectRows(dialog);
    assert.equal(rows.length, 4, 'в списке должно быть 4 строки');
    // Facebook не даёт меню «…» для не-друзей: убираем триггер у всех.
    for (const target of rows) {
      const trigger = target.row.querySelector('[aria-haspopup]');
      if (trigger) trigger.remove();
      assert.equal(BM.fb.rowTriggers(target.row, target).length, 0, 'триггеров остаться не должно');
    }

    const { state, api } = makeTabApi();
    const ctx = ctxOf({ maxTabs: 4, noScroll: true, delayMin: 1, delayMax: 1 });
    const stats = await BM.engine.runListMode(ctx, api);

    assert.equal(state.opened, 4, 'все четверо должны уйти в служебные вкладки');
    assert.equal(state.maxLive, 4, 'вкладки открываются параллельно одной пачкой');
    assert.equal(state.closed, 4, 'все вкладки закрыты');
    assert.equal(stats.ok, 4, 'все четверо заблокированы');
  });
});

describe('engine.js — служебное', () => {
  it('buildProfileUrl и STATUS', () => {
    assert.equal(BM.engine.buildProfileUrl('ivan.petrov'), 'https://www.facebook.com/ivan.petrov?bm_job=1');
    assert.equal(BM.engine.buildProfileUrl('profile.php?id=123'), 'https://www.facebook.com/profile.php?id=123&bm_job=1');
    assert.equal(BM.engine.STATUS.OK, 'ok');
    assert.equal(BM.engine.STATUS.DRY, 'dry');
  });

  it('createContext: статистика и record', () => {
    const events = [];
    const ctx = BM.engine.createContext({ settings: { dryRun: true }, onEvent: (e) => events.push(e) });
    ctx.record({ key: 'k1', name: 'Иван' }, { status: 'ok', message: 'готово' });
    ctx.record({ key: 'k2', name: 'Пётр' }, { status: 'dry', message: 'тест' });
    assert.equal(ctx.stats.ok, 1);
    assert.equal(ctx.stats.dry, 1);
    assert.equal(ctx.stats.processed, 2);
    assert.equal(events.filter((e) => e.type === 'result').length, 2);
  });

  it('stop() останавливает ctx', () => {
    const ctx = BM.engine.createContext({ onEvent: () => {} });
    ctx.stop('по требованию');
    assert.ok(ctx.stopped);
    assert.ok(ctx.stats.stopped);
  });
});

});
