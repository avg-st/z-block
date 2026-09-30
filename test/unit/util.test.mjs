import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadExtension, resetDom } from '../setup.mjs';

loadExtension();

describe('util.js', () => {
  it('нормализация текста', () => {
    assert.equal(BM.util.norm('  Заблокировать  '), 'заблокировать');
    assert.equal(BM.util.normName('Иван, «Иванов» ?'), 'иван иванов');
    assert.equal(BM.util.cleanText(' a\u00a0 b  c '), 'a b c');
  });

  it('namesMatch сверяет имена', () => {
    assert.equal(BM.util.namesMatch('Иван Петров', 'Заблокировать Иван Петров?'), true);
    assert.equal(BM.util.namesMatch('Иван Петров', 'Пётр Петров'), false);
    assert.equal(BM.util.namesMatch('', ''), null);
  });

  it('namesMatch понимает падежи Facebook («Заблокировать Анну Смирнову»)', () => {
    assert.equal(BM.util.namesMatch('Анна Смирнова', 'Анну Смирнову'), true);
    assert.equal(BM.util.namesMatch('Іван Ільченко', 'Івана Ільченко'), true);
    assert.equal(BM.util.namesMatch('Любов Маленко', 'Любов Маленко'), true);
    assert.equal(BM.util.namesMatch('Олег Кузнецов', 'Олега Кузнецова'), true);
    assert.equal(BM.util.namesMatch('Марина Орлова', 'Марину Орлову'), true);
    // разные люди по-прежнему не совпадают
    assert.equal(BM.util.namesMatch('Анна Смирнова', 'Анна Петрова'), false);
    assert.equal(BM.util.namesMatch('Иван Петров', 'Пётр Иванов'), false);
  });

  it('namesMatch терпим к обрезанным именам и инициалам', () => {
    assert.equal(BM.util.namesMatch('Иван Петров', 'Иван Петров…'), true);
    assert.equal(BM.util.namesMatch('И. Петров', 'Иван Петров'), true);
  });


  it('пропускает пункты «Разблокировать»', () => {
    // расширение сравнивает имена уже в нижнем регистре (через nameOf → norm)
    assert.ok(BM.util.RE.unblock.test('разблокировать'));
    assert.ok(BM.util.RE.blockItem.test('заблокировать'));
    assert.ok(BM.util.RE.blockItem.test('block'));
    assert.equal(BM.util.RE.blockItem.test('разблокировать'), false);
  });

  it('регулируемые паузы', async () => {
    const t0 = Date.now();
    await BM.util.sleep(50);
    assert.ok(Date.now() - t0 >= 40);
    const j = BM.util.jitter(100, 200);
    assert.ok(j >= 100 && j <= 200, `jitter=${j}`);
  });
});
