/* Original localization engine. No Google code, network requests or message storage. */
(() => {
  'use strict';
  const dictionary = /* GEMINI_ZH_DICTIONARY */ {};
  const version = /* GEMINI_ZH_VERSION */ 'development';
  if (location.protocol !== 'https:' || location.hostname !== 'gemini.google.com') return;
  if (globalThis.__geminiWindowsZh) { globalThis.__geminiWindowsZh.refresh(); return; }

  const protectedSelector = [
    'user-query', 'model-response', 'message-content', 'code', 'pre', 'textarea', 'input', 'select', 'option', 'article', 'figure',
    '[contenteditable]', '[role="textbox"]', '[role="log"]', '[role="article"]',
    '[id^="user-query-content"]', '[data-message-id]', '[data-testid*="message"]',
    '[data-test-id*="message"]', '[class*="user-query"]', '[class*="model-response"]',
    '[class*="conversation-title"]', '[class*="conversation-snippet"]',
    '[class*="response-content"]', '.markdown', '.markdown-main-panel', '[data-gemini-zh-welcome]',
    '[data-user-content]', '[class*="user-name"]', '[class*="username"]', '[class*="profile-name"]',
    '[class*="account-name"]', '[class*="display-name"]', '[class*="skill-card"]', '[class*="skill-name"]',
    '[class*="skill-title"]', '[class*="skill-description"]', '[class*="gem-card"]', '[class*="gem-title"]',
    '[class*="gem-description"]', '[class*="notebook-title"]', '[class*="memory-item"]',
    '[class*="memory-content"]', '[class*="instruction-content"]', '[class*="custom-instruction"]',
    '[class*="file-name"]', '[class*="file-title"]', '[class*="document-title"]', '[class*="document-card"]',
    '[class*="task-title"]', '[class*="task-name"]', '[class*="task-description"]', '[class*="schedule-title"]',
    '.material-icons', '.material-symbols-outlined', 'mat-icon'
  ].join(',');
  const controlSelector = 'button,[role="button"],[role="menuitem"],[role="tab"],[role="option"],a,label';
  const staticScope = 'nav,aside,[role="navigation"],[role="menu"],[role="menubar"],[role="tooltip"],.mat-mdc-tooltip,.mat-mdc-tooltip-surface,.mdc-tooltip__surface,[data-gemini-zh-scope="ui"],.zero-state-block-container,.modular-zero-state-container,modular-zero-state,.your-day-status-unenrolled,.search-island-host,.close-sidenav-button,.mavatar-settings-button,.top-action-list-scrollable,.side-nav-sparkle-button,.desktop-controls,.gem-segmented-button-row';
  let secondaryScopes = [];
  const pageTitles = new Set(['Customize Gemini', 'Scheduled', 'Schedules', 'Create images', 'Your avatar', 'Avatar', 'Task settings', 'Personal Intelligence', 'Skills', 'Cart and orders', 'Your public links', 'Import memory to Gemini', 'Import chats', 'Media watermark', 'Developer Mode', 'Usage limits', 'Gems', 'Your data & preferences', 'Memory', 'Connected Apps', 'Instructions for Gemini']);
  const records = new Map();
  let enabled = true;
  let scheduled = false;
  let observer;
  const welcomeRoots = new Set();
  let changed = 0;
  let lastRoute = location.pathname;

  function protectedElement(element) {
    if (!element || element.closest(protectedSelector)) return true;
    // Settings data records are not UI captions. Keep menu/first-use lists
    // eligible instead of treating every semantic list as user content.
    const record = element.closest('[role="listitem"],[role="row"],[role="gridcell"],tbody,li,tr');
    if (record?.closest('main,.main-content,[role="dialog"],.route-island-host') &&
        !record.closest('[role="menu"],[role="menubar"],.your-day-status-unenrolled')) return true;
    const anchor = element.closest('a[href]');
    if (anchor) {
      try {
        const pathname = new URL(anchor.getAttribute('href'), location.href).pathname;
        // Existing chat titles are user data, even when their words match the dictionary.
        if (/\/app\/[a-z0-9_-]{8,}\/?$/i.test(pathname)) return true;
      } catch { return true; }
    }
    return false;
  }

  function homeRoute() { return /^\/(?:u\/\d+\/)?(?:app\/?)?$/.test(location.pathname); }

  function searchInput(element) {
    return element.matches('input:not([type="password"]),[role="searchbox"]') &&
      ['Search chats', '搜索对话', 'Search your chats', '搜索你的对话'].some(text =>
        element.getAttribute('aria-label') === text || element.getAttribute('placeholder') === text);
  }

  function searchCaptions(element) {
    const dialog = element.closest('[role="dialog"]');
    if (!dialog) return;
    for (const caption of dialog.querySelectorAll('div,span,h1,h2,[role="heading"]')) {
      if (caption.children.length || caption.closest('a,button,[role="button"],[role="link"],[role="option"]') || protectedElement(caption)) continue;
      if (['Recents', 'Recent chats', 'Search chats', 'Search your chats'].includes(caption.textContent.trim())) controlText(caption);
    }
  }

  function landingText() {
    const headings = new Set(['Library', 'Documents', 'Media', 'Create images', 'Scheduled', 'Schedules', 'Daily brief']);
    // Only identified headings/captions. Never infer a content pane by walking
    // up two parents or translate all same-word text within main/html.
    for (const heading of document.querySelectorAll('h1,h2,h3,[role="heading"],.page-title,.page-subtitle,.title')) {
      const root = heading.closest('.main-content,main,.route-island-host');
      if (!root || root === document.body || root === document.documentElement ||
          root.querySelector('user-query,model-response,[data-message-id],.ql-editor') || protectedElement(heading) ||
          heading.closest('a,button,[role="button"],[role="link"],[role="option"]')) continue;
      const key = heading.textContent.replace(/\s+/g, ' ').trim();
      if (headings.has(key) || (heading.matches('.page-subtitle') && key === 'Try a template or describe an idea in chat. Create with Nano Banana.')) controlText(heading);
    }
    for (const caption of document.querySelectorAll('.route-island-host p,main p,.main-content p')) {
      if (!protectedElement(caption) && caption.textContent.trim() === 'Documents you create will appear here') controlText(caption);
    }
  }

  function findSecondaryScopes() {
    return [...document.querySelectorAll('.main-content,main,[role="dialog"],.route-island-host')].filter(root => {
      // A chat heading with the same words must never turn a conversation into a settings scope.
      if (root.querySelector('user-query,model-response,[data-message-id],[id^="user-query-content"]')) return false;
      if (root.matches('.route-island-host')) return [...root.querySelectorAll('button')].some(button =>
        ['Information about usage limits', '使用限额说明', 'Delete all links', '删除所有链接'].some(label => button.getAttribute('aria-label') === label || button.textContent.trim() === label));
      if (root.querySelector('.likeness-card')) return true;
      const headings = root.querySelectorAll('h1,h2,.title,.header-title,.likeness-title,.page-title,.window-title,.section-header,.gds-title-l');
      const title = [...headings].slice(0, 20).some(element => {
        if (protectedElement(element)) return false;
        const text = element.textContent.replace(/\s+/g, ' ').trim();
        return [...pageTitles].some(key => text === key || text === dictionary[key]);
      });
      return title;
    });
  }

  function safeControl(element) {
    if (protectedElement(element)) return false;
    // On an existing conversation route, only explicit navigation/menu scopes are allowed.
    // This deliberately leaves some conversation action buttons in English.
    const label = element.getAttribute('aria-label') || '';
    const composerControl = homeRoute() && element.matches('button,[role="button"]') &&
      (/^(?:Open mode picker, currently [a-zA-Z0-9 .-]{1,60}|Dictate(?: \([^()\r\n]{1,20}\))?)$/.test(label) ||
       /^(?:选择模型，当前为 [a-zA-Z0-9 .-]{1,60}|语音输入(?: \([^()\r\n]{1,20}\))?)$/.test(label));
    return composerControl || Boolean(element.closest(staticScope)) || secondaryScopes.some(root => root.contains(element));
  }

  function translate(original, attribute = false, element = null) {
    if (typeof original !== 'string') return null;
    const key = original.replace(/\s+/g, ' ').trim();
    if (key === 'Home' && element?.closest('.customize-page .category-heading,.customize-page .category-header')) return '居家';
    if (!Object.hasOwn(dictionary, key)) {
      const avatarHint = key.match(/^Use your avatar anytime by typing (@[^\s@<>]{1,64}) into your prompt\.$/);
      if (avatarHint) return '在提示中输入 ' + avatarHint[1] + '，即可随时使用你的虚拟形象。';
      if (!attribute) return null;
      const add = key.match(/^Add (.{1,80})$/);
      const brands = ['Airtable', 'Bandsintown', 'Canva', 'Experian', 'Fever', 'GetYourGuide', 'Google Business Profile', 'Google Workspace', 'Instacart', 'OpenTable', 'PandaDoc', 'Peloton', 'Picsart', 'Thumbtack', 'Ticketmaster', 'Viator', 'Wix', 'YouTube Music', 'Zillow'];
      if (add && element?.closest('.customize-page') && (brands.includes(add[1]) || Object.hasOwn(dictionary, add[1]))) return '添加 ' + (dictionary[add[1]] || add[1]);
      const dictate = key.match(/^Dictate (\([^()\r\n]{1,20}\))$/);
      if (dictate) return '语音输入 ' + dictate[1];
      const picker = key.match(/^Open mode picker, currently ([a-zA-Z0-9 .-]{1,60})$/);
      if (picker) return '选择模型，当前为 ' + (dictionary[picker[1]] || picker[1]);
      const model = key.match(/^(Selected )?((?:\d+(?:\.\d+)? )?(?:Flash-Lite|Flash|Pro|Argon)) (Fastest answers|All-around help|Advanced reasoning|Complex tasks)( New)?$/);
      if (model) return (model[1] ? '已选中 ' : '') + model[2] + ' ' + dictionary[model[3]] + (model[4] ? ' 新增' : '');
      return null;
    }
    if (dictionary[key] === key) return null;
    return original.replace(/\S(?:[\s\S]*\S)?/, () => dictionary[key]);
  }

  function applyValue(node, property, attribute = false) {
    const original = attribute ? node.getAttribute(property) : node[property];
    const translated = translate(original, attribute, attribute ? node : node.parentElement);
    if (translated === null) return;
    let entries = records.get(node);
    if (!entries) {
      if (records.size >= 5000) return;
      entries = new Map(); records.set(node, entries);
    }
    entries.set(property, { original, translated, attribute });
    if (attribute) node.setAttribute(property, translated); else node[property] = translated;
    changed++;
  }

  function controlText(element) {
    // Animated headings can split one UI phrase across several span/text nodes.
    // Keep those nodes and event handlers in place; never replace innerHTML.
    const wholeTranslation = translate(element.textContent, false, element);
    if (wholeTranslation !== null) {
      const textNodes = [];
      const parts = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let part;
      while ((part = parts.nextNode())) textNodes.push(part);
      if (textNodes.length > 1 && textNodes.every(node => !protectedElement(node.parentElement))) {
        if (records.size + textNodes.filter(node => !records.has(node)).length > 5000) return;
        const firstText = textNodes.find(node => node.nodeValue.trim());
        for (const node of textNodes) {
          const original = node.nodeValue;
          const translated = node === firstText ? wholeTranslation : '';
          let entries = records.get(node);
          if (!entries) { entries = new Map(); records.set(node, entries); }
          entries.set('nodeValue', { original, translated, attribute: false });
          node.nodeValue = translated; changed++;
        }
        return;
      }
    }
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!protectedElement(node.parentElement)) applyValue(node, 'nodeValue');
    }
  }

  function welcomeText(element) {
    const alreadyOwned = element.hasAttribute('data-gemini-zh-welcome');
    // Gemini places its zero-state UI inside the same role=log container used
    // for messages. Allow only this specific, observed zero-state component;
    // keep actual message/editor/code ancestors protected.
    if (element.closest('user-query,model-response,message-content,code,pre,textarea,input,[contenteditable="true"],[role="textbox"],[data-message-id],[class*="user-query"],[class*="model-response"],.markdown,.markdown-main-panel')) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node; let original = '';
    while ((node = walker.nextNode())) {
      if (!node.parentElement.closest('[data-gemini-zh-welcome-overlay]')) original += node.nodeValue;
    }
    // Only the observed, fixed welcome sentence. Personalized greetings are untouched.
    const known = original.replace(/\s+/g, ' ').trim() === 'Where should we start?';
    let overlay = element.querySelector('[data-gemini-zh-welcome-overlay]');
    if (!known) {
      if (alreadyOwned) { overlay?.remove(); element.removeAttribute('data-gemini-zh-welcome'); welcomeRoots.delete(element); }
      return;
    }
    if (!document.getElementById('gemini-windows-zh-welcome-style')) {
      const style = document.createElement('style'); style.id = 'gemini-windows-zh-welcome-style';
      style.textContent = '[data-gemini-zh-welcome]{position:relative!important;visibility:hidden!important}[data-gemini-zh-welcome]>[data-gemini-zh-welcome-overlay]{visibility:visible!important;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:inherit;font:inherit;line-height:inherit;white-space:normal}.ql-editor.ql-blank[aria-label="向 Gemini 输入问题"]::before{content:"向 Gemini 提问"!important}';
      document.head.append(style);
    }
    element.setAttribute('data-gemini-zh-welcome', 'true'); welcomeRoots.add(element);
    if (!overlay) {
      overlay = document.createElement('span'); overlay.setAttribute('data-gemini-zh-welcome-overlay', 'true');
      overlay.textContent = dictionary['Where should we start?']; element.append(overlay); changed++;
    }
  }

  function refresh() {
    if (!enabled) return;
    scheduled = false;
    observer.disconnect();
    try {
      // Release detached nodes so repeated SPA navigation does not retain message elements.
      for (const node of records.keys()) if (!node.isConnected) records.delete(node);
      for (const element of welcomeRoots) if (!element.isConnected) welcomeRoots.delete(element);
      secondaryScopes = findSecondaryScopes();
      landingText();
      for (const element of document.querySelectorAll(controlSelector)) {
        if (!safeControl(element)) continue;
        controlText(element);
        for (const attribute of ['aria-label', 'aria-description', 'title']) applyValue(element, attribute, true);
      }
      for (const element of document.querySelectorAll('.modular-zero-state-container .gds-display-m,.zero-state-block-container .gds-display-m,modular-zero-state .gds-display-m')) welcomeText(element);
      for (const element of document.querySelectorAll('h1,h2,h3,[role="heading"]')) {
        if (safeControl(element)) controlText(element);
      }
      // Menu section captions and sidebar labels, never the whole page body.
      for (const scope of [...document.querySelectorAll(staticScope), ...secondaryScopes]) {
        // Translate fixed phrases split across spans (including the avatar handle hint).
        for (const paragraph of scope.querySelectorAll('p,.description,.subtitle,.section-title,.gds-body-m')) {
          if (!protectedElement(paragraph)) controlText(paragraph);
        }
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) if (!protectedElement(node.parentElement)) applyValue(node, 'nodeValue');
      }
      // The input hint may be localized; the user's actual input/value is never changed.
      for (const element of document.querySelectorAll('[placeholder],[data-placeholder],input[aria-label],.ql-editor[contenteditable]')) {
        const search = searchInput(element);
        if ((!homeRoute() && !element.matches('.ql-editor[contenteditable]') && !search) || element.closest('user-query,model-response,[data-message-id],[role="article"]')) continue;
        for (const attribute of ['placeholder', 'data-placeholder', 'aria-label']) applyValue(element, attribute, true);
        if (search) searchCaptions(element);
      }
    } finally {
      observer.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['aria-label', 'aria-description', 'title', 'placeholder', 'data-placeholder', 'role', 'aria-hidden', 'data-state']
      });
    }
  }

  function schedule() {
    if (scheduled || !enabled) return;
    scheduled = true;
    setTimeout(refresh, 100);
  }

  function disable() {
    enabled = false; scheduled = false; observer.disconnect();
    for (const element of welcomeRoots) { element.querySelector('[data-gemini-zh-welcome-overlay]')?.remove(); element.removeAttribute('data-gemini-zh-welcome'); }
    welcomeRoots.clear(); document.getElementById('gemini-windows-zh-welcome-style')?.remove();
    for (const [node, entries] of records) {
      for (const [property, record] of entries) {
        const current = record.attribute ? node.getAttribute(property) : node[property];
        // Do not overwrite a value the app/user has changed since translation.
        if (current !== record.translated) continue;
        if (record.attribute) node.setAttribute(property, record.original); else node[property] = record.original;
      }
    }
    records.clear();
  }

  observer = new MutationObserver(mutations => {
    // Streaming a response should not repeatedly scan the page's navigation.
    if (mutations.some(mutation => {
      const element = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
      if (element?.closest('[data-gemini-zh-welcome]') && !element.closest('[data-gemini-zh-welcome-overlay]')) return true;
      return element && !protectedElement(element);
    })) schedule();
  });
  globalThis.__geminiWindowsZh = Object.freeze({
    version, refresh, disable,
    enable() { enabled = true; refresh(); },
    get stats() {
      const headings = [...document.querySelectorAll('.gds-display-m')];
      return {
        enabled, changes: changed, retainedNodes: records.size, homeRoute: homeRoute(),
        zeroStateContainers: document.querySelectorAll('.zero-state-block-container,.modular-zero-state-container,modular-zero-state').length,
        welcomeCandidates: headings.length,
        welcomeEnglish: headings.filter(element => element.textContent.trim() === 'Where should we start?').length,
        welcomeChinese: headings.filter(element => element.querySelector('[data-gemini-zh-welcome-overlay]')?.textContent === dictionary['Where should we start?']).length
      };
    }
  });
  // SPA history changes may not trigger a DOM mutation on their own.
  let routeTimer;
  function watchRoute() {
    if (routeTimer !== undefined) return;
    routeTimer = setInterval(() => {
      if (location.pathname !== lastRoute) { lastRoute = location.pathname; schedule(); }
    }, 1000);
  }
  addEventListener('pagehide', () => { clearInterval(routeTimer); routeTimer = undefined; observer.disconnect(); });
  addEventListener('pageshow', () => { watchRoute(); if (enabled) refresh(); });
  watchRoute();
  refresh();
})();
