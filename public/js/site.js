// Shared guest-site chrome: sticky header shadow, mobile navigation toggle, footer year.
(() => {
  const header = document.getElementById('siteHeader');
  if (header) {
    const toggle = header.querySelector('[data-nav-toggle]');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    const setOpen = (open) => {
      header.classList.toggle('nav-open', open);
      toggle?.setAttribute('aria-expanded', String(open));
      toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toggle?.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
    header.querySelectorAll('.main-nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); toggle?.focus(); } });
    document.addEventListener('click', (e) => { if (!header.contains(e.target)) setOpen(false); });
  }
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
