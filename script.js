(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Theme ---------- */
  $('.theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  /* ---------- Top bar + active link ---------- */
  const bar = $('.topbar');
  const onScroll = () => bar.classList.toggle('is-stuck', scrollY > 8);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });
  const links = $$('.menu a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) links.forEach((l) => { if (l.getAttribute('href').startsWith('#')) l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id); });
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((l) => { const h = l.getAttribute('href'); const s = h.startsWith('#') && $(h); if (s) spy.observe(s); });
  }

  /* ---------- Reveal ---------- */
  const reveals = $$('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });
  } else reveals.forEach((el) => el.classList.add('is-in'));

  /* ---------- Rotating headline ---------- */
  const rot = $('.headline__rotator');
  if (rot) {
    const phrases = JSON.parse(rot.dataset.phrases);
    let idx = 0;
    const paint = (text) => {
      rot.classList.remove('is-out');
      const [a, b = ''] = text.split('|');
      let i = 0;
      const words = (s, cls) => s.split(' ').filter(Boolean).map((w) => `<span class="w${cls}" style="--i:${i++}">${w} </span>`).join('');
      rot.innerHTML = words(a, '') + (b ? '<br>' + words(b, ' acc') : '');
    };
    paint(phrases[0]);
    if (!reduce) {
      setInterval(() => {
        if (document.hidden) return;
        rot.classList.add('is-out');
        setTimeout(() => { idx = (idx + 1) % phrases.length; paint(phrases[idx]); }, 480);
      }, 3400);
    }
  }


  /* ---------- Project showcase ---------- */
  const sc = $('[data-showcase]');
  if (sc) {
    const SLIDE = 3600;
    const tabs = $$('.ptab', sc);
    const panels = tabs.map((t) => $('#' + t.getAttribute('aria-controls')));
    const nameEl = $('[data-stage-name]', sc), screenEl = $('[data-stage-screen]', sc), dotsEl = $('[data-stage-dots]', sc);
    let p = 0, s = 0, elapsed = 0, last = 0, paused = false, visible = false;

    const slidesOf = (i) => $$('.slide', panels[i]);
    function render() {
      tabs.forEach((t, i) => {
        const on = i === p;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
        panels[i].classList.toggle('is-active', on);
        if (!on) $('.ptab__timer i', t).style.width = '0';
      });
      const slides = slidesOf(p);
      slides.forEach((el, j) => el.classList.toggle('is-active', j === s));
      nameEl.textContent = panels[p].dataset.name;
      screenEl.textContent = slides[s].dataset.label;
      dotsEl.innerHTML = slides.map((el, j) => `<button type="button" class="${j === s ? 'is-on' : ''}" aria-label="Show ${el.dataset.label}"></button>`).join('');
      $$('button', dotsEl).forEach((b, j) => b.addEventListener('click', () => { s = j; elapsed = 0; render(); }));
    }
    function go(np, ns = 0) { p = (np + tabs.length) % tabs.length; s = ns; elapsed = 0; render(); }
    function advance() {
      const n = slidesOf(p).length;
      if (s + 1 < n) { s++; elapsed = 0; render(); } else go(p + 1);
    }
    function loop(t) {
      const dt = last ? t - last : 0; last = t;
      if (!paused && visible && !document.hidden) {
        elapsed += dt;
        const n = slidesOf(p).length;
        $('.ptab__timer i', tabs[p]).style.width = `${Math.min(100, ((s + elapsed / SLIDE) / n) * 100)}%`;
        if (elapsed >= SLIDE) advance();
      }
      requestAnimationFrame(loop);
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => go(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); go(p + 1); tabs[p].focus(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(p - 1); tabs[p].focus(); }
      });
    });
    const stage = $('.stage', sc);
    stage.addEventListener('mouseenter', () => { paused = true; });
    stage.addEventListener('mouseleave', () => { paused = false; });
    sc.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) paused = true; });
    sc.addEventListener('focusout', () => { paused = false; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 }).observe(sc);
    render();
    if (!reduce) requestAnimationFrame(loop);
  }

  /* ---------- Automation filters ---------- */
  const fBtns = $$('[data-filter]');
  const cards = $$('.flow-card, [data-filterable] [data-tags]');
  fBtns.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    fBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cards.forEach((c) => { c.hidden = !(f === 'all' || c.dataset.tags.split(' ').includes(f)); });
  }));

  /* ---------- GitHub activity ---------- */
  const heatmap = $('.heatmap');
  const yTabs = $$('.tabs [data-year]');
  const cache = {};
  const today = new Date().toISOString().slice(0, 10);
  const dayFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
  const monFmt = new Intl.DateTimeFormat('en', { month: 'short' });
  const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  async function load(y) {
    if (cache[y]) return cache[y];
    const r = await fetch(`https://github-contributions-api.jogruber.de/v4/NusratJahanShawon?y=${y}`);
    if (!r.ok) throw new Error('fetch failed');
    const j = await r.json();
    return (cache[y] = j.contributions.filter((d) => d.date <= today));
  }
  function renderHeat(days) {
    heatmap.textContent = '';
    if (!days.length) return;
    let total = 0, active = 0, longest = 0, run = 0, best = days[0];
    days.forEach((d) => { total += d.count; if (d.count > 0) { active++; run++; longest = Math.max(longest, run); } else run = 0; if (d.count > best.count) best = d; });
    set('total', total.toLocaleString('en')); set('active', active);
    set('longest', `${longest} day${longest === 1 ? '' : 's'}`); set('best', best.count);
    set('bestLabel', `best day, ${dayFmt.format(new Date(best.date + 'T00:00:00'))}`);
    const frag = document.createDocumentFragment();
    const off = new Date(days[0].date + 'T00:00:00').getDay();
    let lastM = -1;
    days.forEach((d, i) => {
      const pos = i + off, col = Math.floor(pos / 7) + 1, row = (pos % 7) + 2;
      const date = new Date(d.date + 'T00:00:00');
      if (date.getMonth() !== lastM) {
        lastM = date.getMonth();
        const m = document.createElement('span'); m.className = 'm'; m.textContent = monFmt.format(date);
        m.style.gridColumn = `${row > 4 ? col + 1 : col} / span 3`; frag.appendChild(m);
      }
      const c = document.createElement('span'); c.className = 'd'; c.dataset.l = d.level;
      c.style.gridColumn = col; c.style.gridRow = row;
      c.title = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${dayFmt.format(date)}`;
      frag.appendChild(c);
    });
    heatmap.appendChild(frag);
    heatmap.setAttribute('aria-label', `${total} GitHub contributions across ${active} active days`);
    heatmap.parentElement.scrollLeft = heatmap.parentElement.scrollWidth;
  }
  async function showYear(y) {
    yTabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.year === y)));
    try { renderHeat(await load(y)); }
    catch (e) { heatmap.innerHTML = '<p class="heatmap-msg">Activity could not load right now. See it on GitHub.</p>'; ['total', 'active', 'longest', 'best'].forEach((k) => set(k, '–')); }
  }
  yTabs.forEach((t) => t.addEventListener('click', () => showYear(t.dataset.year)));
  if (heatmap) showYear('last');

  /* ---------- Photo lightbox ---------- */
  const lb = $('.lightbox');
  const allShots = $$('.shot[data-src]');
  const shots = [];
  if (lb && allShots.length) {
    const img = $('img', lb), cap = $('figcaption', lb);
    let cur = 0, opener = null;
    const show = (i) => {
      cur = (i + shots.length) % shots.length;
      const s = shots[cur];
      img.src = s.dataset.src; img.alt = $('img', s)?.alt || '';
      cap.textContent = s.dataset.caption || '';
    };
    const open = (el) => { shots.length = 0; shots.push(...allShots.filter((s) => !s.hidden && s.offsetParent !== null && !s.closest('[hidden]'))); const i = Math.max(0, shots.indexOf(el)); opener = document.activeElement; show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; $('.lightbox__close', lb).focus(); };
    const close = () => { lb.hidden = true; document.body.style.overflow = ''; opener?.focus(); };
    allShots.forEach((s) => {
      s.tabIndex = 0; s.setAttribute('role', 'button');
      s.addEventListener('click', () => open(s));
      s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s); } });
    });
    $('.lightbox__close', lb).addEventListener('click', close);
    $('.lightbox__prev', lb).addEventListener('click', () => show(cur - 1));
    $('.lightbox__next', lb).addEventListener('click', () => show(cur + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }
})();
