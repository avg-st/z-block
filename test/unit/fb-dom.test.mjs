import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadExtension, resetDom } from '../setup.mjs';

loadExtension();

describe('fb-dom.js — ключи и ссылки профилей', () => {
  beforeEach(resetDom);
  it('profileKeyOf разбирает ссылки', () => {
    assert.equal(BM.fb.profileKeyOf('/ivan.petrov.7'), 'ivan.petrov.7');
    assert.equal(BM.fb.profileKeyOf('https://www.facebook.com/profile.php?id=100077306881802'), 'profile.php?id=100077306881802');
    assert.equal(BM.fb.profileKeyOf('/people/Иван-Иванов/100012345678/'), 'profile.php?id=100012345678');
    assert.equal(BM.fb.profileKeyOf('/messages/t/123'), null);
    assert.equal(BM.fb.profileKeyOf('/groups/999'), null);
    assert.equal(BM.fb.profileKeyOf(''), null);
    assert.equal(BM.fb.profileKeyOf('https://evil.com/ivan'), null);
  });

  it('profileUrlOf строит ссылку обратно', () => {
    assert.equal(BM.fb.profileUrlOf('ivan.petrov'), 'https://www.facebook.com/ivan.petrov');
    assert.equal(BM.fb.profileUrlOf('profile.php?id=123'), 'https://www.facebook.com/profile.php?id=123');
  });
});

describe('fb-dom.js — окно «Заблокировать X?» (реальная разметка FB)', () => {
  beforeEach(() => {
    resetDom();
    document.body.innerHTML = globalThis.FBMARKUP.confirmDialog('Stanislav Brem');
  });

  it('распознаёт окно подтверждения', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    assert.ok(BM.fb.isBlockConfirmDialog(dialog), 'окно подтверждения не распознано');
  });

  it('находит кнопку «Подтвердить» и «Отмена»', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    assert.equal(BM.util.nameOf(BM.fb.findConfirmButton(dialog)), 'подтвердить');
    // aria-label кнопки отмены — «Отменить блокировку …» (текст «Отмена» — глубже)
    assert.match(BM.util.nameOf(BM.fb.findCancelButton(dialog)), /^отмен/);
  });

  it('dialogTargetName вытаскивает имя из заголовка', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    assert.equal(BM.fb.dialogTargetName(dialog), 'Stanislav Brem');
  });

  it('не принимает за подтверждение окно «Разблокировать …»', () => {
    const el = document.querySelector('div[role="dialog"]');
    el.setAttribute('aria-label', 'Разблокировать Stanislav Brem?');
    assert.equal(BM.fb.isBlockConfirmDialog(el), false);
  });

  it('findBlockConfirmDialog находит окно в документе', () => {
    assert.ok(BM.fb.findBlockConfirmDialog());
  });
});

describe('fb-dom.js — список лайкнувших (реальная разметка FB)', () => {
  beforeEach(() => {
    resetDom();
    document.body.innerHTML = globalThis.FBMARKUP.likesDialog([
      { key: 'ivan.petrov.7', name: 'Иван Петров' },
      { key: 'stan.brem.9', name: 'Станислав Брем' },
      { key: 'anna.smir', name: 'Анна Смирнова' },
    ]);
  });

  it('собирает строки с ключами и именами', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    const rows = BM.fb.collectRows(dialog);
    assert.equal(rows.length, 3);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const key of ['ivan.petrov.7', 'stan.brem.9', 'anna.smir']) {
      assert.ok(byKey.has(key), `нет ключа ${key}`);
    }
    assert.ok(rows.every((r) => r.name.length > 0), `имена: ${rows.map((r) => r.name).join(', ')}`);
    assert.ok(rows.every((r) => r.row && r.row.isConnected));
  });

  it('countProfileLinks считает уникальные профили', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    assert.equal(BM.fb.countProfileLinks(dialog), 3);
  });

  it('findLikesDialog находит окно со списком', () => {
    const dialog = BM.fb.findLikesDialog();
    assert.ok(dialog, 'окно списка не найдено');
    assert.equal(BM.fb.countProfileLinks(dialog), 3);
  });

  it('rowTriggers находит кнопку «…» в строке', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    const [target] = BM.fb.collectRows(dialog);
    const triggers = BM.fb.rowTriggers(target.row, target);
    assert.equal(triggers.length, 1, `триггеров: ${triggers.length}`);
    assert.equal(triggers[0].getAttribute('aria-label'), 'Ещё');
  });

    it('findRowByKey находит строку по ключу', () => {
    const dialog = document.querySelector('div[role="dialog"]');
    const row = BM.fb.findRowByKey(dialog, 'stan.brem.9');
    assert.ok(row);
    assert.equal(row.name, 'Станислав Брем');
  });
});

describe('fb-dom.js — страница профиля (новый UI)', () => {
  beforeEach(resetDom);

  it('profileNameFromPage ищет имя через data-testid и заголовок страницы', () => {
    document.body.innerHTML = globalThis.FBMARKUP.profilePageWithSettings('Кирилл Грек');
    const name = BM.fb.profileNameFromPage();
    assert.equal(name, 'Кирилл Грек', `имя: ${name}`);
  });

  it('profileNameFromPage fallback на document.title при отсутствии h1', () => {
    document.body.innerHTML = '<div><span>Просто текст</span></div>';
        document.title = 'Кто То | Facebook';
    const name = BM.fb.profileNameFromPage();
    assert.equal(name, 'Кто То', `имя: ${name}`);
  });

  it('profileTriggers находит кнопку «Настройки профиля» по aria-label без aria-haspopup', () => {
    document.body.innerHTML = globalThis.FBMARKUP.profilePageWithSettings('Кирилл Грек');
    const triggers = BM.fb.profileTriggers();
    assert.ok(triggers.length > 0, 'не найдено кнопок меню профиля');
    const settingBtn = triggers.find((el) =>
      /настройки|settings|профиля|дополнительн/i.test(
        (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')
      )
    );
        assert.ok(settingBtn, 'кнопка «Настройки профиля» не найдена среди триггеров');
  });
});
