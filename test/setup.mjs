/**
 * Тестовое окружение: jsdom + загрузка немодульных скриптов расширения.
 * Импортируется из юнит-тестов. Не модуль расширения.
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '..');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://www.facebook.com/',
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const key of [
  'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'HTMLElement', 'Element', 'Node',
  'getComputedStyle', 'navigator', 'location', 'MutationObserver', 'CustomEvent',
]) {
  if (dom.window[key] !== undefined && globalThis[key] === undefined) {
    globalThis[key] = dom.window[key];
  }
}

/**
 * jsdom не делает layout: все rect нулевые, и U.isVisible считает всё скрытым.
 * Подменяем на «всё видно и влезает в строку».
 */
const FAKE_RECT = { width: 120, height: 44, top: 0, left: 0, right: 120, bottom: 44, x: 0, y: 0 };
for (const Ctor of [dom.window.Element, dom.window.HTMLElement]) {
  if (!Ctor) continue;
  Ctor.prototype.getBoundingClientRect = function fakeRect() {
    return { ...FAKE_RECT, width: this.ownerDocument === document ? FAKE_RECT.width : 0 };
  };
}

/**
 * Загружает обычный (не ES-модуль) скрипт расширения в глобальный контекст.
 */
export function loadScript(relativePath) {
  const code = readFileSync(resolve(root, relativePath), 'utf8');
  (0, eval)(code);
}

/** Загружает весь контент-стек расширения в правильном порядке. */
export function loadExtension() {
  loadScript('test/fixture/facebook-markup.js');
  loadScript('src/util.js');
  loadScript('src/fb-dom.js');
  loadScript('src/engine.js');
}

/** Чистое body перед каждым тестом. */
export function resetDom() {
  document.body.innerHTML = '';
}
