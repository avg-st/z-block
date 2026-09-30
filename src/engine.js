/**
 * «Блокировщик мразей» — движок автоматизации.
 *
 * Два режима:
 *  1) list — прямо в открытом списке лайкнувших: «…» → «Заблокировать» → «Подтвердить»;
 *  2) tabs — по очереди открываем профиль каждого пользователя в фоновой вкладке
 *     и блокируем там (медленнее, но иногда надёжнее).
 *
 * Порядок загрузки важен: util.js → fb-dom.js → engine.js.
 */
(() => {
  'use strict';

  const BM = (globalThis.BM = globalThis.BM || {});
  if (BM.engine) return;

  const U = BM.util;
  const Fb = BM.fb;

  /** Максимум служебных вкладок, открываемых одновременно (пачкой). */
  const MAX_TABS = 100;

  /** Сколько ждать ответа от служебной вкладки профиля (по умолчанию, мс). */
  const DEFAULT_TAB_WAIT_MS = 120000;

  /** Статусы результата обработки одного человека. */
  const STATUS = {
    OK: 'ok', // заблокирован
    DRY: 'dry', // тестовый прогон: дошли до «Подтвердить», но не нажали
    FAILED: 'failed',
    KNOWN: 'known', // уже блокировали раньше (по истории расширения)
    SKIPPED: 'skipped',
    STOPPED: 'stopped',
  };

  /**
   * Контекст прогона: настройки, статистика, лог и признак остановки.
   * onEvent(event) — колбэк для панели (или консоли в служебных вкладках).
   */
  function createContext(options) {
    const opts = options || {};
    const settings = Object.assign({}, U.DEFAULT_SETTINGS, opts.settings || {});
    const ctx = {
      settings,
      dryRun: !!settings.dryRun,
      stopped: false,
      onEvent: typeof opts.onEvent === 'function' ? opts.onEvent : () => {},
      stats: { total: 0, processed: 0, ok: 0, dry: 0, failed: 0, known: 0, skipped: 0, stopped: false },
      knownBlocked: new Set(),

      emit(event) {
        try {
          ctx.onEvent(event);
        } catch (e) {
          U.log.warn('onEvent упал', e);
        }
      },
      debug(message) {
        U.log.debug(message);
        ctx.emit({ type: 'debug', message });
      },
      info(message) {
        U.log.info(message);
        ctx.emit({ type: 'info', message });
      },
      warn(message) {
        U.log.warn(message);
        ctx.emit({ type: 'warn', message });
      },
      error(message) {
        U.log.error(message);
        ctx.emit({ type: 'error', message });
      },
      stop(reason) {
        if (ctx.stopped) return;
        ctx.stopped = true;
        ctx.stats.stopped = true;
        if (reason) ctx.info(reason);
        ctx.emit({ type: 'stopped', message: reason || '' });
      },
      record(target, result) {
        const status = (result && result.status) || STATUS.FAILED;
        if (status === STATUS.OK) ctx.stats.ok += 1;
        else if (status === STATUS.DRY) ctx.stats.dry += 1;
        else if (status === STATUS.KNOWN) ctx.stats.known += 1;
        else if (status === STATUS.SKIPPED) ctx.stats.skipped += 1;
        else if (status === STATUS.FAILED) ctx.stats.failed += 1;
        if (status !== STATUS.KNOWN && status !== STATUS.SKIPPED) ctx.stats.processed += 1;
        ctx.emit({
          type: 'result',
          key: (target && target.key) || '',
          name: (target && target.name) || '',
          status,
          message: (result && result.message) || '',
        });
      },
      /** Пауза, которую можно прервать кнопкой «Стоп». */
      async sleep(ms) {
        const end = Date.now() + Math.max(0, Number(ms) || 0);
        while (!ctx.stopped && Date.now() < end) {
          await U.sleep(Math.min(250, Math.max(1, end - Date.now())));
        }
      },
    };
    return ctx;
  }

  /**
   * Общая для обоих режимов часть: в открытом окне «Заблокировать X?»
   * проверяем имя, при необходимости отменяем и нажимаем «Подтвердить».
   */
  async function confirmBlockDialog(dialog, expectedName, ctx) {
    const dialogName = Fb.dialogTargetName(dialog);
    const shown = dialogName || expectedName || '(имя не распознано)';
    const match = U.namesMatch(expectedName, dialogName);

    if (match === false) {
      const closed = await Fb.cancelDialog(dialog);
      return {
        status: STATUS.FAILED,
        message: `в окне другой пользователь: «${shown}» — отменил` + (closed ? '' : ' (окно не закрылось!)'),
      };
    }

    if (ctx.dryRun) {
      await Fb.cancelDialog(dialog);
      return { status: STATUS.DRY, message: `тестовый прогон: нажал бы «Подтвердить» для «${shown}»` };
    }

    const confirm = Fb.findConfirmButton(dialog);
    if (!confirm) {
      await Fb.cancelDialog(dialog);
      return { status: STATUS.FAILED, message: 'в окне нет кнопки «Подтвердить»' };
    }

    // Снимок уже открытых окон успеха (от прошлых блокировок), чтобы не спутать
    // старое окно с новым.
    const successBefore = Fb.findBlockSuccessDialog();
    const successBeforeText = successBefore
      ? U.cleanText(`${successBefore.getAttribute('aria-label') || ''} ${successBefore.textContent || ''}`)
      : '';

    U.realClick(confirm);

    // Реагируем наблюдателем на фразу «Вы заблокировали …»/«You blocked …».
    // Facebook может переиспользовать тот же DOM-узел и склонить имя, поэтому
    // для старого окна проверяем изменение текста, а не точное совпадение имени.
    const success = await Fb.waitForBlockSuccessDialog({
      preferred: dialog,
      timeout: 5000,
      isFresh: (found) => {
        if (found !== successBefore) return true;
        const currentText = U.cleanText(`${found.getAttribute('aria-label') || ''} ${found.textContent || ''}`);
        return currentText !== successBeforeText;
      },
    });

    if (success) {
      const successName = Fb.successDialogTargetName(success) || shown;
      const verified = U.namesMatch(expectedName, successName);
      // Закрываем окно успеха: иначе модалка перекроет список и следующие
      // строки будет невозможно нажать.
      if (ctx.closeSuccessDialog !== false) await Fb.closeBlockSuccessDialog(success);
      // Имя до клика уже сверено в окне «Заблокировать X?», поэтому окно
      // успеха считаем подтверждением. Несовпадение имени — только в лог.
      if (verified === false) {
        ctx.warn(`окно успеха: «${successName}» (имя отличается от ожидаемого «${expectedName}»)`);
      } else {
        ctx.info(`окно успеха: «${successName}» — блокировка подтверждена`);
      }
      return { status: STATUS.OK, message: `заблокирован: «${successName}»` };
    }

    // success-диалог не появился — проверим, исчез ли confirm-диалог.
    const gone = await U.waitGone(dialog, 8000);
    if (!gone) {
      // Последняя проверка: FB мог показать окно успеха с задержкой (а окно
      // подтверждения при этом остаётся в DOM «под» ним и никуда не исчезает).
      const late = Fb.findBlockSuccessDialog();
      const lateFresh = !!late && late !== successBefore;
      const lateText = late
        ? U.cleanText(`${late.getAttribute('aria-label') || ''} ${late.textContent || ''}`)
        : '';
      const lateReused = !!late && late === successBefore && lateText !== successBeforeText;
      if (lateFresh || lateReused) {
        const lateName = Fb.successDialogTargetName(late) || shown;
        if (ctx.closeSuccessDialog !== false) await Fb.closeBlockSuccessDialog(late);
        ctx.info(`окно успеха: «${lateName}» — блокировка подтверждена`);
        return { status: STATUS.OK, message: `заблокирован: «${lateName}»` };
      }
      await Fb.cancelDialog(dialog);
      return {
        status: STATUS.FAILED,
        message: 'окно подтверждения не закрылось — Facebook, возможно, требует дополнительных действий',
      };
    }
    return {
      status: STATUS.OK,
      message: match === null ? `заблокирован: «${shown}» (имя сверить не удалось)` : `заблокирован: «${shown}»`,
    };
  }

  /**
   * Режим «список»: блокируем пользователя из его строки в открытом окне.
   * Выбираем один наиболее вероятный триггер «…» и открываем только его меню.
   */
  async function blockUserInList(target, ctx) {
    if (!target || !target.row || !target.row.isConnected) {
      return { status: STATUS.SKIPPED, message: 'строка исчезла из списка' };
    }
    // Закрываем «зависшее» окно успеха от прошлой блокировки: модалка
    // перекрывает список, и клики по строкам до него не доходят.
    const stale = Fb.findBlockSuccessDialog();
    if (stale) await Fb.closeBlockSuccessDialog(stale);

    const triggers = Fb.rowTriggers(target.row, target);
    if (!triggers.length) {
      return {
        status: STATUS.FAILED,
        message: 'в строке нет кнопки «…» — Facebook не даёт меню для этого человека (например, он не ваш друг)',
      };
    }

    if (ctx.stopped) return { status: STATUS.STOPPED, message: 'остановлено пользователем' };
    const trigger = triggers[0];
    ctx.debug(`клик по триггеру: ${U.describeEl(trigger)}`);
    await Fb.closeOpenMenus();
    U.realClick(trigger);

    const item = await U.waitFor(() => Fb.findBlockMenuItem(), { timeout: 2500, interval: 100 });
    if (!item) {
      await Fb.closeOpenMenus();
      return { status: STATUS.FAILED, message: 'меню выбранной кнопки «…» не содержит пункт «Заблокировать»' };
    }

    ctx.debug('меню открылось, клик по пункту «Заблокировать»');
    U.realClick(item);

    const dialog = await U.waitFor(() => Fb.findBlockConfirmDialog(), { timeout: 7000, interval: 120 });
    if (!dialog) {
      await Fb.closeOpenMenus();
      return { status: STATUS.FAILED, message: 'окно «Заблокировать …?» не появилось' };
    }
    return confirmBlockDialog(dialog, target.name, ctx);
  }

  /**
   * Режим «вкладки»: та же логика, но на странице профиля.
   * Перед блокировкой убеждаемся, что открыт нужный профиль.
   */
  async function blockOnProfilePage(options, ctx) {
    const opts = options || {};
    const expectedKey = opts.expectedKey || null;
    const currentKey = Fb.profileKeyOf(location.href);

    if (expectedKey && currentKey && currentKey !== expectedKey) {
      return { status: STATUS.FAILED, message: `открыт другой профиль (${currentKey})` };
    }

    // Ждём готовности страницы профиля. В новом UI FB имени может не быть в h1 —
    // вместо этого ждём: (а) видимые триггеры «…» («Настройки профиля»), или
    // (б) role="main", или (в) любой заголовок/навигацию страницы.
    const ready = await U.waitFor(() => {
      if (Fb.profileTriggers().length) return true;
      const main = document.querySelector('[role="main"]');
      if (main && U.isVisible(main)) return true;
      const heading = document.querySelector('[role="heading"], h1, h2, h3, h4, h5, h6');
      if (heading && U.isVisible(heading)) return true;
      return null; // ещё не готово — продолжаем ждать
    }, { timeout: 30000, interval: 300 });

    if (!ready) {
      return { status: STATUS.FAILED, message: 'страница профиля не загрузилась за 30 с' };
    }

    // Убедимся, что ленивая шапка профиля «пробуждена» — в новых UI кнопка «…»
    // может появиться только после наведения.
    await Fb.pokeProfileHeader();
    await U.sleep(250);

    // «Зависшее» окно успеха от прошлой блокировки закроем — оно модальное.
    const staleSuccess = Fb.findBlockSuccessDialog();
    if (staleSuccess) await Fb.closeBlockSuccessDialog(staleSuccess);

        // Находим триггер меню профиля (кнопка «…» / «Настройки» / «Дополнительно»)
    const triggers = Fb.profileTriggers();
    if (!triggers.length) {
      return {
        status: STATUS.FAILED,
        message: 'не удалось найти кнопку меню профиля («…» / «Настройки» / «Дополнительно»)',
      };
    }

    if (ctx.stopped) return { status: STATUS.STOPPED, message: 'остановлено пользователем' };
    const trigger = triggers[0];
    ctx.debug(`клик по триггеру профиля: ${U.describeEl(trigger)}`);
    await Fb.closeOpenMenus();
    U.realClick(trigger);

    const expectedName = opts.expectedName || Fb.profileNameFromPage();
    const item = await U.waitFor(() => Fb.findBlockMenuItem(), { timeout: 2500, interval: 100 });
    if (!item) {
      await Fb.closeOpenMenus();
      return { status: STATUS.FAILED, message: 'меню выбранной кнопки профиля не содержит пункт «Заблокировать»' };
    }
    U.realClick(item);

    const dialog = await U.waitFor(() => Fb.findBlockConfirmDialog(), { timeout: 7000, interval: 120 });
    if (!dialog) {
      await Fb.closeOpenMenus();
      return { status: STATUS.FAILED, message: 'окно «Заблокировать …?» не появилось' };
    }
    return confirmBlockDialog(dialog, expectedName, ctx);
  }

  /** Догружаем список: прокручиваем вниз и ждём новых строк. true — появились новые. */
  async function loadMoreRows(scroll, dialog) {
    if (!scroll || !scroll.isConnected) return false;
    const beforeHeight = scroll.scrollHeight;
    const beforeRows = Fb.countProfileLinks(dialog);
    scroll.scrollTop = scroll.scrollHeight;
    const grew = await U.waitFor(
      () => (scroll.scrollHeight > beforeHeight + 20 || Fb.countProfileLinks(dialog) > beforeRows ? true : null),
      { timeout: 3000, interval: 200 }
    );
    await U.sleep(350);
    return !!grew;
  }

  /** Собираем всех людей из открытого списка (с прокруткой до конца). */
  async function collectAllTargets(dialog, ctx, onProgress) {
    const scroll = Fb.findScrollContainer(dialog);
    const seen = new Map();
    let idle = 0;
    while (!ctx.stopped && idle < 3) {
      for (const target of Fb.collectRows(dialog)) {
        if (!seen.has(target.key)) seen.set(target.key, target);
      }
      if (typeof onProgress === 'function') onProgress(seen.size);
      if (!dialog.isConnected) break;
      const grew = await loadMoreRows(scroll, dialog);
      if (grew) idle = 0;
      else idle += 1;
    }
    if (typeof onProgress === 'function') onProgress(seen.size);
    return [...seen.values()];
  }

  /**
   * Основной проход по списку лайкнувших: обрабатываем строки по очереди,
   * догружая список прокруткой, с паузами между людьми.
   */
  async function runListMode(ctx, tabApi) {
    const dialog = Fb.findLikesDialog();
    if (!dialog) throw new Error('не нашёл открытое окно со списком лайкнувших — откройте «Нравится»');

    const scroll = Fb.findScrollContainer(dialog);
    const done = new Set();
    let idle = 0;

    // Люди, у которых в строке нет «…» (Facebook не даёт меню для не-друзей),
    // копятся здесь и затем блокируются ПАРАЛЛЕЛЬНО в служебных вкладках —
    // пачками до maxTabs (по умолчанию 100) вкладок одновременно.
    const configured = Number(ctx.settings && ctx.settings.maxTabs);
    const maxTabs = Math.max(1, Math.min(MAX_TABS, Number.isFinite(configured) && configured > 0 ? configured : MAX_TABS));
    const deferred = [];
    const flushDeferred = async () => {
      if (!deferred.length || ctx.stopped) return;
      const batch = deferred.splice(0, deferred.length);
      ctx.info(`без кнопки «…»: ${batch.length} человек — открываю до ${Math.min(maxTabs, batch.length)} вкладок параллельно`);
      await runTabQueue({
        targets: batch,
        api: tabApi,
        ctx,
        waitTimeout: Number(ctx.settings.tabWaitMs) || DEFAULT_TAB_WAIT_MS,
      });
    };

    while (!ctx.stopped) {
      if (!dialog.isConnected) throw new Error('окно со списком закрылось');

      const targets = Fb.collectRows(dialog).filter((t) => !done.has(t.key));
      if (!targets.length) {
        // noScroll: блокируем ровно то, что сейчас загружено в списке, —
        // никаких догрузок за спиной пользователя.
        if (ctx.settings.noScroll) break;
        const grew = await loadMoreRows(scroll, dialog);
        if (grew) {
          idle = 0;
        } else {
          idle += 1;
          if (idle >= 2) break; // список закончился
        }
        continue;
      }
      idle = 0;

      for (const target of targets) {
        if (ctx.stopped) break;
        done.add(target.key);

        if (ctx.settings.skipKnown && ctx.knownBlocked.has(target.key)) {
          ctx.record(target, { status: STATUS.KNOWN, message: 'уже блокировали раньше (по истории расширения)' });
          continue;
        }

        const fresh = target.row && target.row.isConnected ? target : Fb.findRowByKey(dialog, target.key) || target;
        let result = await blockUserInList(fresh, ctx);
        if (
          result.status === STATUS.FAILED &&
          /«…»/.test(result.message || '') &&
          target.key &&
          tabApi
        ) {
          // FB не даёт меню «…» в строке (например, для не-друзей) —
          // откладываем и блокируем пачкой через профили в служебных вкладках.
          ctx.info(`${target.name || target.key}: в строке нет «…» — блокирую через вкладку профиля`);
          deferred.push(target);
          if (deferred.length >= maxTabs) await flushDeferred();
          if (ctx.settings.limit && ctx.stats.processed >= ctx.settings.limit) {
            ctx.stop(`остановлено: достигнут лимит прогона (${ctx.settings.limit})`);
            break;
          }
          continue;
        }
        if (result.status === STATUS.OK) {
          ctx.knownBlocked.add(target.key);
          await U.blockedAdd(target.key, target.name || '');
        }
        ctx.record(target, result);

        if (ctx.stopped) break;

        if (ctx.settings.limit && ctx.stats.processed >= ctx.settings.limit) {
          ctx.stop(`остановлено: достигнут лимит прогона (${ctx.settings.limit})`);
          break;
        }

        // В последовательном режиме сохраняем фиксированную короткую паузу;
        // параллельный режим профилей обрабатывает вкладки пачками без неё.
        await ctx.sleep(U.jitter(2500, 6000));
        if (ctx.stopped) break;
      }

      // Проход по загруженным строкам закончен: «отложенных» (у кого в строке
      // нет «…») отправляем в параллельные вкладки сразу, не дожидаясь конца
      // прогона, — иначе до последнего момента кажется, что всё идёт по очереди.
      await flushDeferred();
    }

    // Остаток отложенных — блокируем параллельно перед завершением прогона.
    await flushDeferred();

    return ctx.stats;
  }

  /** Канонический URL профиля для служебной вкладки (?bm_job=1 — метка, чтобы не рисовать панель). */
  function buildProfileUrl(key) {
    const base = Fb.profileUrlOf(key);
    if (!base) return null;
    return base.includes('?') ? `${base}&bm_job=1` : `${base}?bm_job=1`;
  }

  /**
   * Блокировка одного человека через его профиль в служебной вкладке:
   * открываем вкладку, шлём задачу, ждём ответ, закрываем вкладку.
   * Возвращает {status, message} (без record/blockedAdd — это делает вызывающий).
   *
   * api: {
   *   openTab(url, active)          -> {tabId} | {error}
   *   sendMessage(tabId, message)   -> {ok: true, response} | {ok: false, error}
   *   closeTab(tabId)               -> что угодно
   * }
   */
  async function blockViaTab(target, ctx, api, waitTimeout = DEFAULT_TAB_WAIT_MS) {
    let tabId = null;
    try {
      const opened = await api.openTab(buildProfileUrl(target.key), false);
      if (!opened || !opened.tabId) {
        throw new Error((opened && opened.error) || 'не удалось открыть вкладку профиля');
      }
      tabId = opened.tabId;

      const deadline = Date.now() + waitTimeout;
      let lastError = 'служебная вкладка не ответила';
      while (Date.now() < deadline && !ctx.stopped) {
        const reply = await api.sendMessage(tabId, {
          type: 'bm:blockProfile',
          expectedKey: target.key,
          expectedName: target.name || '',
          settings: ctx.settings,
        });
        if (reply && reply.ok && reply.response) {
          return reply.response;
        }
        lastError = (reply && (reply.error || (reply.response && reply.response.message))) || lastError;
        await ctx.sleep(800);
      }
      return { status: STATUS.FAILED, message: lastError };
    } catch (e) {
      return { status: STATUS.FAILED, message: String((e && e.message) || e) };
    } finally {
      if (tabId != null) {
        try {
          await api.closeTab(tabId);
        } catch (e) {
          /* вкладку могли уже закрыть */
        }
      }
    }
  }

  /**
   * Режим «вкладки»: открываем до 100 профилей одновременно (параллельно),
   * ждём, пока служебные вкладки отчитаются о блокировке, и закрываем их.
   * Дальше — следующая пачка. Пауза между пачками, чтобы не спамить Facebook.
   */
  async function runTabQueue(options) {
    const opts = options || {};
    const targets = opts.targets || [];
    const api = opts.api;
    const ctx = opts.ctx;
    const configured = Number(ctx && ctx.settings && ctx.settings.maxTabs);
    const CHUNK = Math.max(1, Math.min(MAX_TABS, Number.isFinite(configured) && configured > 0 ? configured : MAX_TABS));
    const waitTimeout = Number.isFinite(opts.waitTimeout) ? opts.waitTimeout : DEFAULT_TAB_WAIT_MS;
    if (!api || !ctx) throw new Error('runTabQueue: нужны api и ctx');

    for (let i = 0; i < targets.length; i += CHUNK) {
      if (ctx.stopped) break;

      const chunk = targets.slice(i, i + CHUNK);
      const chunkSize = chunk.length;

      ctx.info(`[пачка ${Math.floor(i / CHUNK) + 1}] ${chunkSize} вкладок открываю параллельно`);

      const results = await Promise.allSettled(
        chunk.map(async (target) => {
          if (ctx.stopped) return;

          if (ctx.settings.skipKnown && ctx.knownBlocked.has(target.key)) {
            ctx.record(target, { status: STATUS.KNOWN, message: 'уже блокировали раньше (по истории расширения)' });
            return;
          }

          ctx.info(`[${i + 1 + chunk.indexOf(target)}/${targets.length}] открываю профиль: ${target.name || target.key}`);
          const result = await blockViaTab(target, ctx, api, waitTimeout);
          ctx.record(target, result);
          if (result.status === STATUS.OK || result.status === STATUS.DRY) {
            ctx.knownBlocked.add(target.key);
            await U.blockedAdd(target.key, target.name || '');
          }
        })
      );

      ctx.info(`[пачка ${Math.floor(i / CHUNK) + 1}] ${chunkSize} вкладок завершили`);

      if (i + CHUNK < targets.length) {
        await ctx.sleep(1500);
      }
    }
  }

  BM.engine = {
    STATUS,
    MAX_TABS,
    DEFAULT_TAB_WAIT_MS,
    createContext,
    confirmBlockDialog,
    blockUserInList,
    blockViaTab,
    blockOnProfilePage,
    loadMoreRows,
    collectAllTargets,
    runListMode,
    runTabQueue,
    buildProfileUrl,
  };
})();




