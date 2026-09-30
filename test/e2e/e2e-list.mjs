/**
 * E2E-тест: настоящий Chrome + загруженное расширение.
 * «Facebook» эмулируется перехватом запросов: отдаём страницу-фикстуру
 * со списком лайкнувших, которая реагирует на клики как настоящий FB
 * («…» → меню → «Заблокировать» → окно → «Подтвердить»).
 *
 * Запуск: npm run test:e2e
 */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, accessSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const EXT = prepareExtensionDir();

function exists(p) {
  try { accessSync(p); return true; } catch { return false; }
}
const chromePath = [process.env.CHROME_PATH,
  // branded Google Chrome игнорирует --load-extension; нужен Chrome for Testing
  resolve(root, '.chrome', 'chrome', 'win64-153.0.8010.52', 'chrome-win64', 'chrome.exe'),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => p && exists(p));
/** Если Chrome не найден — скачиваем Chrome for Testing в .chrome/ (один раз). */
async function ensureChrome() {
  if (chromePath) return chromePath;
  console.log('Chrome не найден, скачиваю Chrome for Testing в .chrome/ …');
  const { install, resolveBuildId, detectBrowserPlatform } = await import('@puppeteer/browsers');
  const cacheDir = join(root, '.chrome');
  const platform = await detectBrowserPlatform();
  const buildId = await resolveBuildId('chrome', platform, 'stable');
  const res = await install({ browser: 'chrome', buildId, cacheDir });
  console.log('скачан:', res.executablePath);
  return res.executablePath;
}

const fixtureJs = readFileSync(join(root, 'test', 'fixture', 'facebook-markup.js'), 'utf8');

/**
 * Chrome не всегда грузит unpacked-расширения из путей с не-ASCII символами
 * (а путь проекта — с кириллицей), поэтому копируем расширение во временный
 * каталог с ASCII-путём.
 */
function prepareExtensionDir() {
  const dest = mkdtempSync(join(tmpdir(), 'bm-ext-'));
  const files = [
    'manifest.json', 'background.js',
    join('src', 'util.js'), join('src', 'fb-dom.js'), join('src', 'engine.js'), join('src', 'panel.js'),
    join('content', 'content.js'), join('content', 'content.css'),
    join('popup', 'popup.html'), join('popup', 'popup.css'), join('popup', 'popup.js'),
    join('icons', 'icon16.png'), join('icons', 'icon32.png'), join('icons', 'icon48.png'), join('icons', 'icon128.png'),
  ];
  for (const rel of files) {
    const from = join(root, rel);
    const to = join(dest, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  return dest;
}

/** Страница-фикстура: список из 5 лайкнувших + FB-симулятор. */
function buildFixturePage() {
  const rows = [
    { key: 'ivan.petrov.7', name: 'Иван Петров' },
    { key: 'stan.brem.9', name: 'Станислав Брем' },
    { key: 'anna.smir', name: 'Анна Смирнова' },
    { key: 'oleg.kuznet', name: 'Олег Кузнецов' },
    { key: 'marina.orlova', name: 'Марина Орлова' },
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reactions</title></head><body>
  <div id="mount"></div>
  <script src="/fb-markup.js"></script>
  <script>
  const ROWS = ${JSON.stringify(rows)};
  window.__SIM__ = { confirms: 0, menus: 0, blocked: [], pendingName: '' };
  (function openList() {
    const scroll = document.createElement('div');
    scroll.style.cssText = 'overflow-y:auto;height:420px;width:520px;';
    scroll.innerHTML = FBMARKUP.likesDialog(ROWS);
    document.getElementById('mount').appendChild(scroll);
    scroll.querySelector('div[role="dialog"]').style.height = '420px';
  })();
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : e.target.parentElement;
    if (!el) return;
    // Клик «Закрыть» в окне успеха «Вы заблокировали X…»
    const success = el.closest('div[role="alertdialog"], div[role="dialog"][aria-label^="Вы заблокировали"]');
    if (success) {
      if (/^(закрыть|ок|понятно|готово)$/i.test((el.getAttribute('aria-label') || el.textContent || '').trim())) {
        window.__SIM__.successClosed = (window.__SIM__.successClosed || 0) + 1;
        success.remove();
      }
      return;
    }
    const dialog = el.closest('div[role="dialog"][aria-label^="Заблокировать"]');
    if (dialog) {
      if (el.closest('[aria-label="Подтвердить"]')) {
        window.__SIM__.confirms += 1;
        window.__SIM__.blocked.push(dialog.getAttribute('aria-label') || '');
        const name = (dialog.getAttribute('aria-label') || '').replace(/^Заблокировать +/, '').replace(/[?]$/, '');
        dialog.remove();
        // Facebook показывает окно успеха «Вы заблокировали X…»
        const ok = document.createElement('div');
        ok.innerHTML = FBMARKUP.successDialog(name || window.__SIM__.pendingName || ROWS[0].name);
        document.body.appendChild(ok.firstElementChild);
      } else if (el.closest('[aria-label^="Отмен"]')) dialog.remove();
      return;
    }
    const item = el.closest('[role="menuitem"]');
    if (item) {
      const n = (item.textContent || '').trim().toLowerCase();
      if (n === 'заблокировать') {
        item.closest('[role="menu"]').remove();
        const wrap = document.createElement('div');
        wrap.innerHTML = FBMARKUP.confirmDialog(window.__SIM__.pendingName || ROWS[0].name);
        document.body.appendChild(wrap.firstElementChild);
      }
      return;
    }
    if (el.closest('[aria-haspopup="true"]')) {
      window.__SIM__.menus += 1;
      window.__SIM__.pendingName = ROWS[0].name;
      let n = el;
      for (let i = 0; i < 10 && n && n !== document.body; i++) {
        n = n.parentElement;
        if (!n) break;
        const links = n.querySelectorAll('a[href]');
        if (links.length === 1) {
          window.__SIM__.pendingName = (links[0].textContent || '').trim() || ROWS[0].name;
          break;
        }
      }
      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      menu.innerHTML = FBMARKUP.blockMenuItem();
      document.body.appendChild(menu);
    }
  });
  </script></body></html>`;
}

const page = buildFixturePage();
const exePath = await ensureChrome();
const launchArgs = [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'bm-e2e-'))}`,
    '--no-first-run',
    '--no-default-browser-check',
];
const browser = await puppeteer.launch({
  executablePath: exePath,
  headless: 'new',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: launchArgs,
});
// ждём, пока расширение реально загрузится (иначе первая навигация
// происходит до регистрации content script'ов)
await (async () => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (browser.targets().some((t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'))) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('расширение не загрузилось: нет service worker; targets: '
    + JSON.stringify(browser.targets().map((t) => t.type() + ' ' + t.url())));
})();
try {
  const [mainPage] = await browser.pages();
  await mainPage.setRequestInterception(true);
  mainPage.on('request', (req) => {
    if (req.url().startsWith('https://www.facebook.com/likes')) {
      req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: page });
    } else if (req.url().startsWith('https://www.facebook.com/fb-markup.js')) {
      req.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fixtureJs });
    } else {
      req.respond({ status: 200, contentType: 'text/plain', body: '' });
    }
  });

  mainPage.on('console', (msg) => console.log('[консоль страницы]', msg.type(), msg.text()));
  mainPage.on('pageerror', (err) => console.log('[ошибка страницы]', err.message));

  await mainPage.goto('https://www.facebook.com/likes', { waitUntil: 'domcontentloaded' });

  // Ждём панель расширения (content script создаёт shadow host)
  try {
    await mainPage.waitForFunction(() => {
      const host = document.getElementById('bm-panel-host');
      return !!(host && host.shadowRoot && host.shadowRoot.querySelector('[data-role="run"]'));
    }, { timeout: 30000, polling: 300 });
  } catch (e) {
    console.log('targets:', browser.targets().map((t) => t.type() + ' ' + t.url()).join('\n'));
    console.log('host есть:', await mainPage.evaluate(() => !!document.getElementById('bm-panel-host')));
    throw e;
  }
  console.log('панель расширения загрузилась ✓');

  // Настраиваем форму: быстрый живой прогон в режиме списка
  await mainPage.evaluate(() => {
    const sh = document.getElementById('bm-panel-host').shadowRoot;
    const set = (role, value) => {
      const el = sh.querySelector('[data-role="' + role + '"]');
      if (!el) return;
      if (el.type === 'checkbox') el.checked = value;
      else el.value = String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('strategy', 'list');
    set('dryRun', false);
    set('skipKnown', false);
    set('delayMin', 120);
    set('delayMax', 200);
    set('limit', 0);
  });

  // Нажимаем «Блокировать всех»
  await mainPage.evaluate(() => {
    document.getElementById('bm-panel-host').shadowRoot
      .querySelector('[data-role="run"]').click();
  });
  console.log('прогон запущен, жду результата…');

  try {
    const deadline = Date.now() + 120000;
    let last = '';
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      const sim = await mainPage.evaluate(() => JSON.stringify(window.__SIM__));
      if (sim !== last) { console.log('sim:', sim); last = sim; }
      if (JSON.parse(sim).confirms >= 5) break;
      const panelText = await mainPage.evaluate(() => {
        const host = document.getElementById('bm-panel-host');
        return host && host.shadowRoot ? host.shadowRoot.textContent.replace(/\s+/g, ' ').slice(0, 400) : '(нет панели)';
      });
      console.log('панель:', panelText);
      if (Date.now() >= deadline) throw new Error('таймаут ожидания 5 блокировок');
    }
  } catch (e) {
    throw new Error('прогон не завершился: ' + e.message);
  }

  const sim = await mainPage.evaluate(() => window.__SIM__);
  const status = await mainPage.evaluate(() => {
    const el = document.getElementById('bm-panel-host').shadowRoot
      .querySelector('[data-role="status"]');
    return el ? el.textContent : '';
  });

  const allNames = ['Иван Петров', 'Станислав Брем', 'Анна Смирнова', 'Олег Кузнецов', 'Марина Орлова'];
  const missed = allNames.filter((n) => !sim.blocked.some((b) => b.includes(n)));
  if (missed.length) throw new Error('заблокированы не все: ' + missed.join(', '));

  // Окно успеха «Вы заблокировали X…» должно быть распознано и закрыто
  // для каждого человека, иначе оно перекрыло бы список.
  if ((sim.successClosed || 0) < allNames.length) {
    throw new Error(`окна успеха закрыты не все: ${sim.successClosed || 0} из ${allNames.length}`);
  }
  const leftover = await mainPage.evaluate(
    () => document.querySelectorAll('div[role="alertdialog"]').length
  );
  if (leftover) throw new Error(`в DOM осталось незакрытых окон успеха: ${leftover}`);

  console.log('симулятор:', JSON.stringify(sim));
  console.log('статус панели:', status);
  console.log('\nE2E OK: все ' + allNames.length + ' человек заблокированы через «…» → «Заблокировать» → «Подтвердить»;');
  console.log('окно успеха «Вы заблокировали X…» распознано и закрыто ✓');
  process.exitCode = 0;
} catch (e) {
  console.error('\nE2E FAILED:', e.message);
  try {
    const sim = await mainPage.evaluate(() => window.__SIM__);
    console.error('симулятор на момент падения:', JSON.stringify(sim));
    const log = await mainPage.evaluate(() => {
      const el = document.getElementById('bm-panel-host').shadowRoot
        .querySelector('[data-role="log"]');
      return el ? el.textContent : '(нет лога)';
    });
    console.error('лог панели:\n' + log);
  } catch (e2) { /* вкладка могла закрыться */ }
  process.exitCode = 1;
} finally {
  await browser.close();
}
