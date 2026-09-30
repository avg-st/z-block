/**
 * Разметка Facebook, снятая «как есть» с реальной страницы (из задания).
 * Используется в тестовых фикстурах, чтобы проверять селекторы расширения
 * на настоящих классах и структуре.
 *
 * Заменено только изображение (data:, вместо внешнего URL) — чтобы тесты
 * не ходили в сеть. Всё остальное — включая длинные наборы классов — как в оригинале.
 */
(() => {
  'use strict';

  /** Пункт меню «Заблокировать» (открывается по клику на «…» в строке списка). */
  const BLOCK_MENU_ITEM = `
<div class="x1i10hfl xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x972fbf x10w94by x1qhh985 x14e42zd x3ct3a4 x1hl2dhg xggy1nq x1fmog5m xu25z0z x140muxe xo1y3bh x87ps6o x1lku1pv x1a2a7pz xjyslct x9f619 x1ypdohk x78zum5 x1q0g3np x2lah0s x1i6fsjq xfvfia3 x8e7100 x1a16bkn x1n2onr6 x16tdsg8 x1ja2u2z x6s0dn4 x1y1aw1k xwib8y2 x1qpxxdj xa6wxux" role="menuitem" tabindex="0"><div class="x6s0dn4 xoi2r2e x78zum5 xl56j7k xbmvrgn xcrj56b x1ua1ozc"><img draggable="false" height="20" width="20" class="xz74otr x15mokao x1ga7v0g x16uus16 xbiv7yw x1b0d499 xep6ejk" alt="" referrerpolicy="origin-when-cross-origin" src="data:,"></div><div class="html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 x1q0g3np x1iyjqo2 x1qughib xeuugli"><div class="x78zum5 xdt5ytf xz62fqu x16ldp7u"><div class="xu06os2 x1ok221b"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xk50ysn xzsf02u x1yc453h" dir="auto">Заблокировать</span></div></div></div><div class="x1ey2m1c xtijo5x x1o0tod xg01cxk x47corl x10l6tqk x13vifvy x1ebt8du x19991ni x1dhq9h xbxg5aw xxh58k5 xzw787d xk59nb" role="none" data-visualcompletion="ignore" style="inset: 0px;"></div></div>`;

  /**
   * Окно «Заблокировать ИМЯ?» с кнопками «Отмена» и «Подтвердить».
   * Собрано из трёх частей, чтобы файл было удобно читать и править.
   */
  const CONFIRM_DIALOG_HEAD = `
<div aria-label="Заблокировать {{NAME}}?" aria-modal="true" role="dialog" class="x1n2onr6 x1ja2u2z x1afcbsf x78zum5 xdt5ytf x1a2a7pz x6ikm8r x10wlt62 x71s49j x1jx94hy xw5cjc7 x1dmpuos x1vsv7so xau0kf4 x104qc98 x15o3w11 xogydr4 x1vmz7ll x1yyrj1m x1n7qst7 xh8yej3"><div class="xt7dq6l x1a2a7pz x6ikm8r x10wlt62 x1n2onr6 x14atkfc" style="height: 307.906px;"><div class="x9f619 x1ja2u2z x1k90msu x6o7n8i x1qfuztq x1o0tod x10l6tqk x13vifvy x1hc1fzr x71s49j xh8yej3" style="transform: translateX(0%) translateZ(1px);"><div class="x6s0dn4 x1nb4dca x1q0q8m5 xso031l x78zum5 xng8ra xl56j7k xh7rcd0 x17smslp"><h2 dir="auto" class="html-h2 xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x1vvkbs x1heor9g x1qlqyl8 x1pd3egz x1a2a7pz x193iq5w xeuugli"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xtoi2st x3x7a5m x1603h9y x1u7k74 x1xlr1w8 xzsf02u" dir="auto">Заблокировать {{NAME}}?</span></h2></div><div class="xdg88n9 x10l6tqk x1tk7jg1 x1vjfegm"><div class="html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x3nfvp2 x1n2onr6"><div aria-label="Закрыть" class="x1i10hfl xjqpnuy xc5r6h4 xqeqjp1 x1phubyo x13fuv20 x18b5jzi x1q0q8m5 x1t7ytsu x1ypdohk xdl72j9 x2lah0s x3ct3a4 xdj266r x14z9mp xat24cr x1lziwak x2lwn1j xeuugli x16tdsg8 x1hl2dhg xggy1nq x1ja2u2z x1t137rt x1q0g3np x87ps6o x1lku1pv x1a2a7pz x6s0dn4 x1iwo8zk x1033uif x179ill4 x1b60jn0 x972fbf x10w94by x1qhh985 x14e42zd x9f619 x78zum5 xl56j7k xexx8yu xyri2b x18d9i69 x1c1uobl x1n2onr6 xc9qbxq x14qfxbe x1qhmfi1" role="button" tabindex="0"><i data-visualcompletion="css-img" class="x15mokao x1ga7v0g x16uus16 xbiv7yw x1b0d499 x1d69dk1" style="background-image: url(&quot;https://static.xx.fbcdn.net/rsrc.php/ys/r/99VOeN4eRaR.webp&quot;); background-position: 0px -464px; background-size: auto; width: 20px; height: 20px; background-repeat: no-repeat; display: inline-block;"></i><div class="x1ey2m1c xtijo5x x1o0tod xg01cxk x47corl x10l6tqk x13vifvy x1ebt8du x19991ni x1dhq9h x1iwo8zk x1033uif x179ill4 x1b60jn0" role="none" data-visualcompletion="ignore"></div></div></div></div><div class="x9f619 x1ja2u2z x78zum5 x2lah0s x1n2onr6 x1qughib x1qjc9v5 xozqiw3 x1q0g3np xv54qhq xf7dkkf x18d9i69 xyamay9 x1ws5yxj xw01apr x4cne27 xifccgj"><div class="x9f619 x1n2onr6 x1ja2u2z x78zum5 xdt5ytf x2lah0s x193iq5w xeuugli x1icxu4v x25sj25 x10b6aqq x1yrsyyn"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">{{NAME}} больше не сможет:</span></div></div><div class="x9f619 x1ja2u2z x78zum5 x2lah0s x1n2onr6 x1qughib x1qjc9v5 xozqiw3 x1q0g3np xv54qhq xf7dkkf x18d9i69 xyamay9 x1ws5yxj xw01apr x4cne27 xifccgj"><div class="x9f619 x1n2onr6 x1ja2u2z x78zum5 xdt5ytf x2lah0s x193iq5w xeuugli x1icxu4v x25sj25 x10b6aqq x1yrsyyn"><ul><li class="x152237o x1e56ztr xyqm7xq"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">Видеть ваши публикации в профиле</span></li><li class="x152237o x1e56ztr xyqm7xq"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">Отмечать вас</span></li><li class="x152237o x1e56ztr xyqm7xq"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">Приглашать вас на мероприятия и в группы</span></li><li class="x152237o x1e56ztr xyqm7xq"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">Отправлять вам сообщения</span></li><li class="x152237o x1e56ztr xyqm7xq"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">Добавлять вас в друзья</span></li></ul></div></div><div class="x9f619 x1ja2u2z x78zum5 x2lah0s x1n2onr6 x1qughib x1qjc9v5 xozqiw3 x1q0g3np xpdmqnj x1g0dm76 xsag5q8 xz9dl7a x1ws5yxj xw01apr x4cne27 xifccgj"></div><div class="x1exxf4d x13fuv20 x178xt8z x78zum5 x2lah0s x13a6bvl"><div class="x9f619 x1ja2u2z x78zum5 x2lah0s x1n2onr6 x1qughib x1qjc9v5 xozqiw3 x1q0g3np xv54qhq xf7dkkf x1l90r2v xyamay9 x1ws5yxj xw01apr x4cne27 xifccgj">
`;

  /* Хвост окна: блок кнопок «Отмена» и «Подтвердить» + закрытие слоёв. */
  const CONFIRM_DIALOG_TAIL = `
<div class="x9f619 x1n2onr6 x1ja2u2z x78zum5 xdt5ytf x2lah0s x193iq5w xeuugli x1icxu4v x25sj25 x10b6aqq x1yrsyyn"><div aria-label="Отменить блокировку {{NAME}}" class="x1i10hfl xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x972fbf x10w94by x1qhh985 x14e42zd x1ypdohk x3ct3a4 xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x16tdsg8 x1hl2dhg xggy1nq x1fmog5m xu25z0z x140muxe xo1y3bh x87ps6o x1lku1pv x1a2a7pz x9f619 x3nfvp2 xdt5ytf xl56j7k x1n2onr6 xh8yej3" role="button" tabindex="0"><div role="none" class="x1ja2u2z x78zum5 x2lah0s x1n2onr6 xl56j7k x6s0dn4 xozqiw3 x1q0g3np x14ldlfn x1b1wa69 xws8118 x5fzff1 x972fbf x10w94by x1qhh985 x14e42zd x9f619 xpdmqnj x1g0dm76 xjbqb8w x1r1pt67"><div class="html-div xdj266r xat24cr xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 xl56j7k x14ayic xwyz465 x1e0frkt"><div role="none" class="x9f619 x1n2onr6 x1ja2u2z x193iq5w xeuugli x6s0dn4 x78zum5 x2lah0s xsqbvy7 xb9jzoj"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen x1s688f x1mvi0mv" dir="auto"><span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6 xlyipyv xuxw1ft">Отмена</span></span></div></div><div class="x1ey2m1c xtijo5x x1o0tod xg01cxk x47corl x10l6tqk x13vifvy x1ebt8du x19991ni x1dhq9h x1fmog5m xu25z0z x140muxe xo1y3bh" role="none" data-visualcompletion="ignore" style="inset: 0px;"></div></div></div></div><div class="x9f619 x1n2onr6 x1ja2u2z x78zum5 xdt5ytf x2lah0s x193iq5w xeuugli x1icxu4v x25sj25 x10b6aqq x1yrsyyn"><div aria-label="Подтвердить" class="x1i10hfl xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x972fbf x10w94by x1qhh985 x14e42zd x1ypdohk x3ct3a4 xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x16tdsg8 x1hl2dhg xggy1nq x1fmog5m xu25z0z x140muxe xo1y3bh x87ps6o x1lku1pv x1a2a7pz x9f619 x3nfvp2 xdt5ytf xl56j7k x1n2onr6 xh8yej3" role="button" tabindex="0"><div role="none" class="x1ja2u2z x78zum5 x2lah0s x1n2onr6 xl56j7k x6s0dn4 xozqiw3 x1q0g3np x14ldlfn x1b1wa69 xws8118 x5fzff1 x972fbf x10w94by x1qhh985 x14e42zd x9f619 xp48ta0 xtssl2i xtvsq51 x1r1pt67"><div class="html-div xdj266r xat24cr xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 xl56j7k x14ayic xwyz465 x1e0frkt"><div role="none" class="x9f619 x1n2onr6 x1ja2u2z x193iq5w xeuugli x6s0dn4 x78zum5 x2lah0s xsqbvy7 xb9jzoj"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen x1s688f xtk6v10" dir="auto"><span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6 xlyipyv xuxw1ft">Подтвердить</span></span></div></div><div class="x1ey2m1c xtijo5x x1o0tod xg01cxk x47corl x10l6tqk x13vifvy x1ebt8du x19991ni x1dhq9h x1fmog5m xu25z0z x140muxe xo1y3bh" role="none" data-visualcompletion="ignore" style="inset: 0px;"></div></div></div></div></div></div></div></div><div aria-hidden="true" class="x9f619 x1ja2u2z xg01cxk x47corl x1k90msu x6o7n8i x1qfuztq x1o0tod x10l6tqk xh8yej3" style="transform: translateX(100%) translateZ(1px);"></div></div></div>
`;

  const CONFIRM_DIALOG = CONFIRM_DIALOG_HEAD + CONFIRM_DIALOG_TAIL;

  /** Окно со списком лайкнувших: строки «Аватар + имя + кнопка …». */
  const LIKES_DIALOG = `
<div aria-label="Нравится" role="dialog" class="x1n2onr6 x1ja2u2z x9f619 x78zum5 xdt5ytf x1a2a7pz x6ikm8r x10wlt62 xh8yej3"><div class="x9f619 x1n2onr6 x1ja2u2z x78zum5 xdt5ytf xh8yej3"><h2 dir="auto" class="html-h2 xdj266r x14z9mp xat24cr x1lziwak"><span class="x193iq5w xeuugli x1vvkbs" dir="auto">Нравится</span></h2><div class="x9f619 x78zum5 xdt5ytf xh8yej3" style="overflow-y: auto; height: 500px;">
{{ROWS}}
</div></div></div>`;

  /** Одна строка списка лайкнувших: имя-ссылка, подпись и триггер-меню «…». */
  function likesRow({ key, name, id }) {
    return `
<div class="x9f619 x78zum5 xdt5ytf x1n2onr6 xh8yej3" style="height: 60px; padding: 4px 8px;"><div class="x78zum5 xdt5ytf"><a href="/${key}/" class="x1i10hfl x1qjc9v5" role="link" tabindex="0"><img alt="${name}" height="40" width="40" src="data:," class="xz74otr"><div dir="auto"><span class="x193iq5w x1vvkbs">${name}</span></div></a></div><div class="x78zum5 xl56j7k"><div aria-label="Ещё" aria-expanded="false" aria-haspopup="true" class="x1i10hfl x1ypdohk xh8yej3" role="button" tabindex="0"><i data-visualcompletion="css-img" class="x1b0d499" style="width: 20px; height: 20px; display: inline-block;"></i><span class="x1lliihq x6ikm8r x10wlt62" style="height: 1px; width: 1px; position: absolute; overflow: hidden;">Ещё</span></div></div></div>`;
  }

  function likesDialog(rows) {
    return LIKES_DIALOG.replace('{{ROWS}}', rows.map(likesRow).join('\n'));
  }

    /**
   * Страница профиля (для режима «через вкладки»): h1 с именем,
   * кнопка «Ещё» в шапке профиля.
   */
  function profilePage(name) {
    return `
<div role="banner" class="x9f619 x78zum5 xh8yej3"><div class="x78zum5"><h1 dir="auto" class="html-h1 xdj266r x1vvkbs">${name}</h1></div><div aria-label="Ещё" aria-haspopup="true" class="x1i10hfl x1ypdohk xh8yej3" role="button" tabindex="0"><i data-visualcompletion="css-img" class="x1b0d499" style="width: 20px; height: 20px; display: inline-block;"></i></div></div><div role="main" class="x9f619 x78zum5 xh8yej3"><div class="x78zum5 xdt5ytf"><div dir="auto"><span class="x193iq5w x1vvkbs">Профиль ${name}</span></div></div></div>`;
  }

  /**
   * Страница профиля в новом UI Facebook (без h1 и aria-haspopup).
   * Кнопка «…» имеет aria-label="Настройки профиля, смотреть дополнительные параметры".
   * Имя находится в элементе с data-testid="profile-name".
   */
  function profilePageWithSettings(name) {
    return `
<div role="banner" class="x9f619 x78zum5 xh8yej3"><div class="x78zum5" data-testid="profile-name"><span class="x193iq5w x1vvkbs">${name}</span></div><div aria-label="Настройки профиля, смотреть дополнительные параметры" class="x1i10hfl xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x972fbf x10w94by x1qhh985 x14e42zd x3ct3a4 x1hl2dhg xggy1nq x1fmog5m xu25z0z x140muxe xo1y3bh x87ps6o x1lku1pv x1a2a7pz x9f619 x1ypdohk" role="button" tabindex="0"><div role="none" class="x1ja2u2z x78zum5 x2lah0s x1n2onr6 xl56j7k x6s0dn4 xozqiw3 x1q0g3np x14ldlfn x1b1wa69"><div class="html-div xdj266r x1l1ziwak"><div role="none" class="x9f619 x1n2onr6 x1ja2u2z x193iq5w"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="2.5"></circle><circle cx="19.5" cy="12" r="2.5"></circle><circle cx="4.5" cy="12" r="2.5"></circle></svg></div></div><div class="x1ey2m1c xtijo5x x1o0tod xg01cxk" role="none" data-visualcompletion="ignore"></div></div></div></div></div><div role="main" class="x9f619 x78zum5 xh8yej3"><div class="x78zum5 xdt5ytf"><div dir="auto"><span class="x193iq5w x1vvkbs">Профиль ${name}</span></div></div></div>`;
  }

  /**
   * Окно успеха «Вы заблокировали X...» — появляется после нажатия «Подтвердить»,
   * когда Facebook заменяет confirm-диалог на это сообщение.
   */
  const SUCCESS_DIALOG = `
<div aria-label="Вы заблокировали {{NAME}}. Другие профили {{NAME}} не будут заблокированы, но мы ограничим для этого пользователя возможности взаимодействия с вами в них." aria-modal="true" role="alertdialog" class="x1n2onr6 x1ja2u2z x1afcbsf x78zum5 xdt5ytf x1a2a7pz x71s49j x1qjc9v5 xazwl86 x1hl0hii x1aq6byr x2k6n7x x78zum5 x1plvlek xryxfnj xcatxm7 x1n7qst7 xh8yej3"><div class="xt7dq6l x1a2a7pz x6ikm8r x10wlt62 x1n2onr6 x14atkfc"><div class="x9f619 x1ja2u2z x1k90msu x6o7n8i x1qfuztq x1o0tod x10l6tqk x13vifvy x1hc1fzr x71s49j xh8yej3"><div class="x6s0dn4 x1nb4dca x1q0q8m5 xso031l x78zum5 xng8ra xl56j7k xh7rcd0 x17smslp"><h2 dir="auto" class="html-h2 xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x1vvkbs x1heor9g x1qlqyl8 x1pd3egz x1a2a7pz x193iq5w xeuugli"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xtoi2st x3x7a5m x1603h9y x1u7k74 x1xlr1w8 xzsf02u" dir="auto">Вы заблокировали {{NAME}}</span></h2></div><div class="x9f619 x1ja2u2z x78zum5 x2lah0s x1n2onr6 x1qughib x1qjc9v5 xozqiw3 x1q0g3np xv54qhq xf7dkkf x18d9i69 xyamay9 x1ws5yxj xw01apr x4cne27 xifccgj"><div class="x9f619 x1n2onr6 x1ja2u2z x78zum5 xdt5ytf x2lah0s x193iq5w xeuugli x1icxu4v x25sj25 x10b6aqq x1yrsyyn"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen xo1l8bm xzsf02u" dir="auto">Другие профили {{NAME}} не будут заблокированы, но мы ограничим для этого пользователя возможности взаимодействия с вами в них.</span></div></div><div class="x1exxf4d x13fuv20 x178xt8z x78zum5 x2lah0s x13a6bvl"><div class="x9f619 x1ja2u2z x78zum5 x2lah0s x1n2onr6 x1qughib x1qjc9v5 xozqiw3 x1q0g3np xv54qhq xf7dkkf x1l90r2v xyamay9 x1ws5yxj xw01apr x4cne27 xifccgj"><div aria-label="Закрыть" class="x1i10hfl xjbqb8w x1ejq31n x1ypdohk x3ct3a4 x9f619 x3nfvp2 xdt5ytf xl56j7k x1n2onr6 xh8yej3" role="button" tabindex="0"><div role="none" class="x1ja2u2z x78zum5 x2lah0s x1n2onr6 xl56j7k x6s0dn4 xozqiw3 x1q0g3np x14ldlfn x1b1wa69 xws8118 x5zff1 x972fbf x10w94by x1qhh985 x14e42zd x9f619 xpdmqnj x1g0dm76 xjbqb8w x1r1pt67"><div class="html-div xdj266r xat24cr xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 xl56j7k x14ayic xwyz465 x1e0frkt"><div role="none" class="x9f619 x1n2onr6 x1ja2u2z x193iq5w xeuugli x6s0dn4 x78zum5 x2lah0s xsqbvy7 xb9jzoj"><span class="x193iq5w xeuugli x13faqbe x1vvkbs x1xmvt09 x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x xudqn12 x3x7a5m x6prxxf xvq8zen x1s688f x1mvi0mv" dir="auto"><span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6 xlyipyv xuxw1ft">Закрыть</span></span></div></div></div></div></div></div></div></div></div>`;

  globalThis.FBMARKUP = {
    BLOCK_MENU_ITEM,
    blockMenuItem: () => BLOCK_MENU_ITEM,
    confirmDialog: (name) => CONFIRM_DIALOG.replace(/\{\{NAME\}\}/g, name),
    successDialog: (name) => SUCCESS_DIALOG.replace(/\{\{NAME\}\}/g, name),
    likesDialog,
    likesRow,
    profilePage,
    profilePageWithSettings,
  };
})();

