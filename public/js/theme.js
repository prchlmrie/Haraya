// Theme preference (light / dark / Christmas / system default), shared by every page.
// Loaded as a classic script in <head> so the theme is applied before first paint.
(() => {
  const KEY = 'haraya:theme';
  const ICONS = {
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    christmas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l1.2 2.4 2.6.3-1.9 1.8.5 2.6L12 7.9 9.6 9.1l.5-2.6-1.9-1.8 2.6-.3z"/><path d="M12 10l-4 5h2.5L7 19h10l-3.5-4H16z"/><path d="M12 19v3"/></svg>',
  };
  const THEMES = {
    light: { label: 'Light', hint: 'Bright, classic hotel look' },
    dark: { label: 'Dark', hint: 'Dark backgrounds, easy on the eyes' },
    christmas: { label: 'Christmas', hint: 'Festive red, green and gold' },
    system: { label: 'System default', hint: 'Follows your device setting' },
  };
  const MUSIC_SRC = '/The%20Bells%20At%20Christmas.mp3';
  const MUSIC_KEY = 'haraya:xmas-music';
  const MUSIC_POS_KEY = 'haraya:xmas-music-pos';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const read = () => {
    try { const v = localStorage.getItem(KEY); return Object.hasOwn(THEMES, v) ? v : 'system'; } catch { return 'system'; }
  };
  const resolve = (pref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref);

  function apply(pref) {
    const theme = resolve(pref);
    root.dataset.themePref = pref;
    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    document.querySelectorAll('.theme-switch').forEach(syncSwitch);
    music.update();
    window.dispatchEvent(new CustomEvent('themechange', { detail: { pref, theme } }));
  }

  // ---------- Christmas music ----------
  // Browsers block audio until the visitor interacts with the page, so a blocked
  // start is retried on the first click, tap or key press.

  const music = (() => {
    let audio = null;
    let waiting = false;
    const GESTURES = ['pointerdown', 'keydown', 'touchstart'];

    const enabled = () => { try { return localStorage.getItem(MUSIC_KEY) !== 'off'; } catch { return true; } };
    const wanted = () => root.dataset.theme === 'christmas' && enabled();

    function element() {
      if (!audio) {
        audio = new Audio(MUSIC_SRC);
        audio.loop = true;
        audio.volume = 0.5;
        audio.preload = 'auto';
        try {
          const pos = Number(sessionStorage.getItem(MUSIC_POS_KEY));
          if (pos > 0) audio.addEventListener('loadedmetadata', () => { audio.currentTime = pos % (audio.duration || Infinity); }, { once: true });
        } catch { /* session storage may be blocked: start from the beginning */ }
        audio.addEventListener('play', syncButtons);
        audio.addEventListener('pause', syncButtons);
      }
      return audio;
    }

    function retryOnGesture() {
      if (waiting) return;
      waiting = true;
      const go = (e) => {
        if (e.target instanceof Element && e.target.closest('[data-xmas-music]')) return;
        GESTURES.forEach((g) => document.removeEventListener(g, go, true));
        waiting = false;
        if (wanted()) element().play().catch(() => {});
      };
      GESTURES.forEach((g) => document.addEventListener(g, go, { capture: true, passive: true }));
    }

    function update() {
      if (wanted()) {
        element().play().catch(retryOnGesture);
      } else if (audio && !audio.paused) {
        audio.pause();
      }
      syncButtons();
    }

    const playing = () => Boolean(audio && !audio.paused);

    function toggle() {
      try { localStorage.setItem(MUSIC_KEY, playing() ? 'off' : 'on'); } catch { /* ignore */ }
      update();
    }

    function syncButtons() {
      const on = playing();
      document.querySelectorAll('[data-xmas-music]').forEach((b) => {
        b.setAttribute('aria-pressed', String(on));
        b.textContent = on ? '\u266B Music on' : '\u266A Play music';
        b.title = on ? 'Turn off the Christmas music' : 'Play the Christmas music';
      });
    }

    window.addEventListener('pagehide', () => {
      try {
        if (audio && !audio.paused) sessionStorage.setItem(MUSIC_POS_KEY, String(audio.currentTime));
        else sessionStorage.removeItem(MUSIC_POS_KEY);
      } catch { /* ignore */ }
    });

    return { update, toggle, syncButtons };
  })();

  function set(pref) {
    if (!Object.hasOwn(THEMES, pref)) return;
    try { localStorage.setItem(KEY, pref); } catch { /* storage may be blocked: theme still applies for this page */ }
    apply(pref);
  }

  // ---------- switcher UI ----------

  function syncSwitch(el) {
    const pref = root.dataset.themePref;
    const btn = el.querySelector('.theme-switch__btn');
    btn.querySelector('.theme-switch__icon').innerHTML = ICONS[pref === 'system' ? resolve(pref) : pref];
    btn.querySelector('.theme-switch__label').textContent = pref === 'system' ? `Auto (${THEMES[resolve(pref)].label})` : THEMES[pref].label;
    btn.setAttribute('aria-label', `Theme: ${THEMES[pref].label}. Change theme`);
    el.querySelectorAll('[data-theme-option]').forEach((o) => o.setAttribute('aria-checked', String(o.dataset.themeOption === pref)));
  }

  function buildSwitch(slot) {
    const id = `themeMenu${Math.random().toString(36).slice(2, 7)}`;
    slot.classList.add('theme-switch');
    slot.innerHTML = `
      <button type="button" class="theme-switch__btn" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}">
        <span class="theme-switch__icon"></span><span class="theme-switch__label"></span>
        <svg class="theme-switch__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="theme-switch__menu" id="${id}" role="menu" aria-label="Choose a theme" hidden>
        ${Object.entries(THEMES).map(([key, t]) => `
          <button type="button" role="menuitemradio" aria-checked="false" data-theme-option="${key}">
            <span class="theme-switch__opt-icon">${ICONS[key]}</span>
            <span><strong>${t.label}</strong><small>${t.hint}</small></span>
          </button>`).join('')}
      </div>`;
    const btn = slot.querySelector('.theme-switch__btn');
    const menu = slot.querySelector('.theme-switch__menu');
    const options = [...menu.querySelectorAll('[data-theme-option]')];
    const open = (focusCurrent) => {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      if (focusCurrent) (options.find((o) => o.getAttribute('aria-checked') === 'true') ?? options[0]).focus();
    };
    const close = (refocus) => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    };
    btn.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
    });
    options.forEach((o, i) => {
      o.addEventListener('click', () => { set(o.dataset.themeOption); close(true); });
      o.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          options[(i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
        } else if (e.key === 'Escape') { close(true); } else if (e.key === 'Tab') { close(false); }
      });
    });
    document.addEventListener('click', (e) => { if (!slot.contains(e.target)) close(false); });
    syncSwitch(slot);
  }

  function decorate() {
    if (!document.querySelector('.xmas-snow')) {
      const snow = document.createElement('div');
      snow.className = 'xmas-snow';
      snow.setAttribute('aria-hidden', 'true');
      document.body.append(snow);
    }
    if (!document.querySelector('.xmas-banner')) {
      const banner = document.createElement('div');
      banner.className = 'xmas-banner';
      banner.innerHTML = '<span aria-hidden="true">&#10052;</span> Maligayang Pasko! Season\u2019s greetings from Haraya Bay By Zaldy Land <span aria-hidden="true">&#10052;</span>'
        + '<button type="button" class="xmas-music" data-xmas-music></button>';
      banner.querySelector('[data-xmas-music]').addEventListener('click', music.toggle);
      const topbar = document.querySelector('.topbar');
      if (topbar) topbar.after(banner); else document.body.prepend(banner);
    }
    music.syncButtons();
  }

  apply(read());
  media.addEventListener('change', () => { if (root.dataset.themePref === 'system') apply('system'); });
  window.addEventListener('storage', (e) => { if (e.key === KEY) apply(read()); });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-slot]').forEach(buildSwitch);
    decorate();
  });
  window.harayaTheme = { get: () => root.dataset.themePref, resolved: () => root.dataset.theme, set, themes: Object.keys(THEMES), toggleMusic: music.toggle };
})();
