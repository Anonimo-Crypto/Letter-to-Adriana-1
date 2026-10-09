(() => {
  'use strict';

  const app = document.getElementById('app');
  const FADE = 2500;
  const SLIDE = 1100;      // subida de la pregunta
  const OPT_GAP = 800;     // pausa entre el fin de una opción y el inicio de la siguiente
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };

  const PRELUDE = 'Antes de la carta (sé que estás ansiosa, pero quiero disfrutar 😈) responde estas preguntas, solo porque quiero que lo hagas';

  const QUESTIONS = [
    { q: '¿Cuál es mi color favorito?', correct: 0, o: ['Negro', 'Blanco', 'Gris', 'Todos los anteriores'] },
    { q: '¿Cuál es mi serie favorita?', correct: 0, o: ['Tensei Shitara Slime Datta Ken', 'Black Clover', 'Shingeki no Kyojin', 'Todas las anteriores'] },
    { q: '¿Cuál es mi sabor favorito?', correct: 1, o: ['Fresa', 'Chocolate', 'Vainilla'] },
    { q: '¿Qué soy tuyo?', correct: 'any', o: ['Tu novio', 'Tu Pocho', 'Tu propiedad', { t: 'Aún no lo sé', wrong: true }, { t: 'TUYO Y SOLO TUYO', secret: true }] },
    { q: '¿Me quieres?', correct: null, count: false, o: ['Sí', 'Sí', 'Sí'] },
  ];

  const state = { secret: false, answers: [], wrong: [] };

  // Mensajes según aciertos (de 4: la pregunta 5 no cuenta, la 4 acepta cualquier respuesta)
  const MESSAGES = [
    'Eso dolió',
    '¿Esto prueba que no prestas atención?',
    'Tendrás que mejorar un poco',
    'Jajajaja, seguro fallaste la de Rimuru',
    'Yo también te quiero Pocha',
  ];
  const TOXIC = 'Tan TÓXICA como siempre (ME ENCANTAS)';

  function score() {
    return QUESTIONS.reduce((n, q, i) => {
      if (q.count === false) return n;
      if (q.correct === 'any') return n + (state.wrong[i] ? 0 : 1);   // cualquiera vale, salvo "Aún no lo sé"
      return n + (state.answers[i] === q.correct ? 1 : 0);
    }, 0);
  }

  function el(tag, cls, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  const screen = () => el('section', 'screen', app);

  async function fadeOut(s) {
    s.classList.add('out');
    await sleep(FADE);
    s.remove();
  }

  // Motor de texto: el layout se calcula completo desde el inicio (sin saltos de línea
  // mientras se escribe); un bucle rAF revela cada carácter con su propio tiempo
  // y dispara 1 vibración por carácter.
  function type(node, text, speed = 34) {
    node.textContent = '';
    node.setAttribute('aria-label', text);
    const chars = [];
    const times = [];
    const words = text.split(' ');
    let t = 0;

    words.forEach((w, wi) => {
      const ws = el('span', 'w', node);
      ws.setAttribute('aria-hidden', 'true');
      for (const ch of Array.from(w)) {
        const c = el('span', 'c', ws);
        c.textContent = ch;
        chars.push(c);
        times.push(t);
        t += speed;
        if (/[,;:]/.test(ch)) t += 130;
        else if (/[.?!)]/.test(ch)) t += 260;
      }
      if (wi < words.length - 1) {
        node.appendChild(document.createTextNode(' '));
        t += speed * 0.6;
      }
    });

    return new Promise((resolve) => {
      let i = 0;
      const t0 = performance.now();
      (function frame(now) {
        const elapsed = now - t0;
        let fired = false;
        while (i < chars.length && times[i] <= elapsed) {
          chars[i++].classList.add('on');
          fired = true;
        }
        if (fired) buzz(6);
        if (i < chars.length) requestAnimationFrame(frame);
        else setTimeout(resolve, 260);
      })(t0);
    });
  }

  // Slide hacia arriba (técnica FLIP) con dos estelas que se desvanecen
  function slideUp(q, from, rect, to) {
    const dy = to - from;
    if (Math.abs(dy) < 1) return;

    q.style.transition = 'none';
    q.style.transform = `translateY(${-dy}px)`;
    const ghosts = [{ delay: 80, o: 0.3 }, { delay: 170, o: 0.15 }].map((g) => {
      const c = q.cloneNode(true);
      c.classList.add('ghost');
      c.setAttribute('aria-hidden', 'true');
      Object.assign(c.style, {
        left: rect.left + 'px', top: from + 'px', width: rect.width + 'px',
        transition: 'none', transform: 'none', opacity: g.o, filter: 'blur(1.5px)',
      });
      q.parentNode.appendChild(c);
      return { c, g };
    });

    q.offsetWidth; // fuerza reflow
    const ease = 'cubic-bezier(0.22, 0.7, 0.2, 1)';
    q.style.transition = `transform ${SLIDE}ms ${ease}`;
    q.style.transform = '';
    ghosts.forEach(({ c, g }) => {
      c.style.transition = `transform ${SLIDE}ms ${ease} ${g.delay}ms, opacity ${SLIDE}ms ease ${g.delay}ms`;
      c.style.transform = `translateY(${dy}px)`;
      c.style.opacity = 0;
      setTimeout(() => c.remove(), SLIDE + g.delay + 250);
    });
  }

  // Resuelve cuando termina la animación de aparición de la opción (con respaldo por tiempo)
  function scanDone(btn) {
    return new Promise((resolve) => {
      const end = () => { btn.removeEventListener('animationend', on); clearTimeout(tm); resolve(); };
      const on = (e) => { if (e.animationName === 'scan') end(); };
      const tm = setTimeout(end, 2000);
      btn.addEventListener('animationend', on);
    });
  }

  async function intro() {
    const s = screen();
    const title = el('p', 'title', s);
    title.textContent = 'Por nuestro primer mesaniversario';
    const hint = el('p', 'hint', s);
    hint.textContent = 'Toca para continuar';

    await sleep(300);
    title.classList.add('in');
    await sleep(FADE + 400);
    hint.classList.add('in');

    await new Promise((res) => s.addEventListener('pointerdown', res, { once: true }));
    buzz(25);
    await fadeOut(s);
  }

  async function prelude() {
    const s = screen();
    const p = el('p', 'text', s);
    await type(p, PRELUDE);
    await sleep(2200);
    await fadeOut(s);
  }

  function secretLabel(btn, text) {
    for (const ch of Array.from(text)) {
      const span = el('span', ch === ' ' ? 'sp' : 'ch', btn);
      if (ch !== ' ') {
        span.textContent = ch;
        span.style.animationDelay = `-${(Math.random() * 0.2).toFixed(2)}s`;
      }
    }
  }

  async function ask(item, index) {
    const s = screen();
    const q = el('p', 'question', s);
    await type(q, item.q, 38);

    // posición antes de añadir las opciones (la pregunta está centrada)
    const rect = q.getBoundingClientRect();
    const from = rect.top;

    const list = el('div', 'options', s);
    let ready = false;
    let done = false;
    let resolveChoice;
    const choice = new Promise((r) => { resolveChoice = r; });

    item.o.forEach((opt, i) => {
      const o = typeof opt === 'string' ? { t: opt } : opt;
      const btn = el('button', 'opt' + (o.secret ? ' secret' : ''), list);
      btn.type = 'button';
      btn.setAttribute('aria-label', o.t);
      if (o.secret) secretLabel(btn, o.t); else btn.textContent = o.t;

      btn.addEventListener('animationend', (e) => {
        if (e.animationName === 'scan') btn.classList.add('settled');
      });
      btn.addEventListener('click', () => {
        if (!ready || done) return;
        done = true;
        buzz(25);
        btn.classList.add('picked');
        resolveChoice({ i, secret: !!o.secret, wrong: !!o.wrong });
      });
    });

    // la pregunta sube suave mientras el layout se recoloca
    slideUp(q, from, rect, q.getBoundingClientRect().top);

    await sleep(SLIDE * 0.45);
    for (const b of list.children) {
      const finished = scanDone(b);
      b.classList.add('show');
      await finished;          // la opción terminó de generarse
      buzz(12);                // háptica al terminar
      await sleep(OPT_GAP);    // 1 s antes de la siguiente
    }
    ready = true;

    const picked = await choice;
    if (index === QUESTIONS.length - 1) dropShortcuts();
    state.answers[index] = picked.i;
    if (picked.secret) state.secret = true;
    if (picked.wrong) state.wrong[index] = true;
    await sleep(350);
    await fadeOut(s);
  }

  async function result() {
    const sc = score();
    const toxic = sc === 4 && state.secret;
    const s = screen();
    const p = el('p', 'text' + (toxic ? ' red' : ''), s);
    const run = type(p, toxic ? TOXIC : MESSAGES[sc], 42);
    if (toxic) {
      p.querySelectorAll('.c').forEach((c) => {
        c.style.animationDelay = `-${(Math.random() * 0.2).toFixed(2)}s`;
      });
    }
    await run;
    if (sc < 3) return;   // no pasa: el mensaje se queda en pantalla
    await sleep(2600);
    await fadeOut(s);
  }

  // ---------- persistencia y atajos ----------
  const KEY = 'carta.v1';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } },
    set(k) { try { const o = store.get(); o[k] = true; localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} },
  };
  let sc = null;

  function reveal(b) {
    b.addEventListener('animationend', (e) => { if (e.animationName === 'scan') b.classList.add('settled'); });
    b.classList.add('show');
  }

  // Botones "Carta" de las cartas ya desbloqueadas (saltan el quiz)
  function shortcuts() {
    const u = store.get();
    if (!u.normal && !u.special) return;
    sc = el('div', 'shortcuts', document.body);
    [['normal', 'Carta'], ['special', 'Carta']].forEach(([k, label]) => {
      if (!u[k]) return;
      const b = el('button', 'opt' + (k === 'special' ? ' secret' : ''), sc);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      if (k === 'special') secretLabel(b, label); else b.textContent = label;
      b.addEventListener('click', () => {
        buzz(25);
        try { localStorage.setItem('carta.go', k); } catch (_) {}
        location.reload();
      });
      reveal(b);
    });
  }

  function dropShortcuts() {
    if (!sc) return;
    const n = sc;
    sc = null;
    n.classList.add('out');
    setTimeout(() => n.remove(), FADE);
  }

  function takeGo() {
    try {
      const g = localStorage.getItem('carta.go');
      if (g) { localStorage.removeItem('carta.go'); return g; }
    } catch (_) {}
    return null;
  }

  // ---------- la carta ----------
  const L = [
    'Hola Pocha, no tienes idea de la atención que presté a cada detalle de esta carta, pero valió la pena porque sé que ahora estarás conmovida (o sonriendo, o que no quepas en ti de la emoción)',
    'Este mes contigo ha sido de las mejores cosas que me han pasado, y como este habrá muchos más',
    'Sé que tienes tus inseguridades, por eso solo te pido confiar. Yo también tengo las mías, pero prefiero confiar en tus sentimientos y tus acciones antes que en corazonadas o temores',
    'Y lo entiendo, puedo entender por qué te sientes insegura, aunque no vea todo el panorama. Uno teme perder lo que aprecia: temes que lo nuestro no dure, o que pase algo, ya sea por ti o por mí, que arruine la relación',
    'Pero no pasará, ¿sabes por qué? Porque te quiero. Puede que aún no esté seguro de si estoy enamorado de ti, pero sí estoy seguro de lo que siento por ti: te quiero, con todo mi corazón',
    'Y si hice esto aun sin saber bien si estoy enamorado, imagina cómo será cuando esté completamente seguro. ¿Tal vez para el 2.º mesaniversario? Jajajaja. Posdata: quiero un gran beso y un gran abrazo ahora',
    'Por cierto, había otro final; este es el mejor de los dos. Es que eres muy tóxica, por eso hice esto tan especial',
    'Con amor y cariño: TUYO Y SOLO TUYO',
  ];
  const BYE = 'Por cierto, había otro final, mucho mejor que este, créeme, jajajaja';
  const HOT = 'TUYOYSOLOTUYO'.length;   // letras rojas del último texto
  const READ_BASE = 1400, READ_PER_CHAR = 50;   // tiempo de lectura de cada texto

  async function say(parent, text, { hot = 0, slow = false, keep = false } = {}) {
    const p = el('p', 'text fx', parent);
    const run = type(p, text, 36);
    if (hot) {
      [...p.querySelectorAll('.c')].slice(-hot).forEach((c) => {
        c.classList.add('hot');
        c.style.animationDelay = `-${(Math.random() * 0.2).toFixed(2)}s`;
      });
    }
    await run;
    if (keep) return p;
    await sleep(READ_BASE + text.length * READ_PER_CHAR);
    const d = slow ? 4500 : FADE;
    p.style.transitionDuration = d + 'ms';
    p.classList.add('gone');
    await sleep(d);
    p.remove();
  }

  async function again(parent, cls) {
    await sleep(900);
    const b = el('button', 'opt ' + (cls || ''), parent);
    b.type = 'button';
    b.textContent = 'Volver a leer';
    reveal(b);
    await new Promise((res) => b.addEventListener('click', () => { buzz(25); res(); }, { once: true }));
    return b;
  }

  // Carta normal: versos 2 a 6 + despedida, sin corazón
  async function readNormal() {
    for (;;) {
      const s = screen();
      for (const t of L.slice(1, 6)) await say(s, t);
      await say(s, BYE, { keep: true });
      store.set('normal');
      await again(s);
      await fadeOut(s);
    }
  }

  // ---------- corazón con carrusel ----------
  const HEART = 'M0.5 0.92C0.5 0.92 0.02 0.6 0.02 0.28C0.02 0.11 0.15 0.02 0.28 0.02C0.38 0.02 0.46 0.07 0.5 0.16C0.54 0.07 0.62 0.02 0.72 0.02C0.85 0.02 0.98 0.11 0.98 0.28C0.98 0.6 0.5 0.92 0.5 0.92Z';

  function buildHeart(stage) {
    if (!document.getElementById('hc')) {
      document.body.insertAdjacentHTML('beforeend',
        '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><clipPath id="hc" clipPathUnits="objectBoundingBox"><path d="' + HEART + '"/></clipPath></svg>');
    }
    const root = el('div', 'heart', stage);
    const box = el('div', 'hclip', root);
    root.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path d="' + HEART + '"/></svg>');
    return { root, box };
  }

  const probe = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = u; });

  // Lista de fotos: carrusel/fotos.json, o bien carrusel/1.jpg, 2.jpg, 3.png...
  async function loadPhotos() {
    try {
      const r = await fetch('carrusel/fotos.json', { cache: 'no-cache' });
      if (r.ok) {
        const a = await r.json();
        if (Array.isArray(a) && a.length) return a.map((f) => 'carrusel/' + encodeURIComponent(f));
      }
    } catch (_) {}
    const out = [];
    for (let n = 1; n <= 80; n++) {
      let found = null;
      for (const e of ['jpg', 'jpeg', 'png', 'webp']) {
        if (await probe(`carrusel/${n}.${e}`)) { found = `carrusel/${n}.${e}`; break; }
      }
      if (!found) break;
      out.push(found);
    }
    return out;
  }

  // Las fotos cubren todo el corazón (object-fit: cover); el carrusel no se detiene nunca
  function carousel(box, urls) {
    if (!urls.length) return;
    const imgs = urls.map((u) => {
      const i = new Image();
      i.alt = '';
      i.decoding = 'async';
      i.dataset.u = u;
      box.appendChild(i);
      return i;
    });
    let k = -1;
    const step = () => {
      const n = (k + 1) % imgs.length;
      [imgs[n], imgs[(n + 1) % imgs.length]].forEach((x) => { if (!x.src) x.src = x.dataset.u; });
      if (k >= 0) imgs[k].classList.remove('on');
      imgs[n].classList.add('on');
      k = n;
    };
    step();
    setInterval(step, 3200);
  }

  async function readSpecial() {
    const s = screen();
    s.classList.add('stage');
    const heart = buildHeart(s);
    const zone = el('div', 'lines', s);
    carousel(heart.box, await photos());

    await sleep(400);
    heart.root.classList.add('in');            // aparece poco a poco
    await sleep(3200);

    for (;;) {
      await sleep(5000);
      heart.root.classList.add('rise');        // sube a la parte superior
      await sleep(1900);
      for (let i = 0; i < L.length; i++) {
        const last = i === L.length - 1;
        await say(zone, L[i], { hot: last ? HOT : 0, slow: last });
      }
      heart.root.classList.remove('rise');     // vuelve a su posición original
      await sleep(1900);
      store.set('special');
      const b = await again(s, 'again');
      b.remove();
    }
  }

  // ---------- descarga inicial (modo sin conexión) ----------
  const MEDIA = 'carta-media';
  const SHELL_FILES = ['index.html', 'style.css', 'main.js', 'manifest.json', 'icons/icon.svg', 'icons/192.png', 'icons/512.png', 'carrusel/fotos.json'];
  let photosP = null;
  const photos = () => photosP || (photosP = loadPhotos());
  const abs = (u) => new URL(u, location.href).href;
  const isCached = async (u) => {
    try { return !!(await caches.match(u, { ignoreSearch: true, ignoreVary: true })); } catch (_) { return false; }
  };

  // Descarga un archivo, lo guarda en Cache Storage y reporta el progreso en bytes
  async function grab(url, onProg) {
    const cache = await caches.open(MEDIA);
    const res = await fetch(url, { cache: 'reload' });
    if (!res.ok || !res.body) throw new Error('http ' + res.status);
    const total = +res.headers.get('content-length') || 0;
    const put = cache.put(url, res.clone());
    const rd = res.body.getReader();
    let got = 0;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      got += value.length;
      onProg(got, total);
    }
    await put;
  }

  // Solo aparece si falta algún archivo en el almacenamiento local
  async function ensureOffline() {
    if (!('caches' in window) || location.protocol === 'file:') return;
    const todo = [];
    try {
      const urls = [...SHELL_FILES, ...(await photos())].map(abs);
      for (const u of urls) if (!(await isCached(u))) todo.push(u);
    } catch (_) { return; }
    if (!todo.length) return;
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}

    const total = todo.length;
    const s = screen();
    s.innerHTML =
      '<div class="dl-box"><p class="dl-title">Preparando todo</p>' +
      '<p class="dl-sub">Esto solo pasa una vez. Después funciona sin conexión.</p>' +
      '<p class="dl-pct">0%</p><div class="dl-bar"><i></i></div>' +
      '<p class="dl-stat"></p><p class="dl-mb"></p></div>';
    const $ = (c) => s.querySelector('.' + c);
    const frac = new Map();
    const got = new Map();
    todo.forEach((u) => { frac.set(u, 0); got.set(u, 0); });

    const paint = () => {
      let f = 0, b = 0, d = 0;
      frac.forEach((v) => { f += v; if (v >= 1) d++; });
      got.forEach((v) => { b += v; });
      const p = Math.min(1, f / total);
      $('dl-pct').textContent = Math.round(p * 100) + '%';
      $('dl-bar').firstElementChild.style.transform = `scaleX(${p})`;
      $('dl-stat').textContent = `${d} / ${total} archivos`;
      $('dl-mb').textContent = (b / 1048576).toFixed(1) + ' MB descargados';
    };

    const runBatch = async (list) => {
      const failed = [];
      let next = 0;
      const worker = async () => {
        while (next < list.length) {
          const u = list[next++];
          let ok = false;
          for (let t = 0; t < 3 && !ok; t++) {
            try {
              await grab(u, (g, tot) => { got.set(u, g); frac.set(u, tot ? Math.min(0.99, g / tot) : 0); paint(); });
              ok = true;
            } catch (_) { await sleep(600 * (t + 1)); }
          }
          if (ok) { frac.set(u, 1); buzz(8); } else { frac.set(u, 0); got.set(u, 0); failed.push(u); }
          paint();
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      return failed;
    };

    paint();
    let pending = todo;
    let skipped = false;
    for (;;) {
      const failed = await runBatch(pending);
      if (!failed.length) break;
      $('dl-sub').textContent = `No se pudieron descargar ${failed.length} archivos. Revisa tu conexión.`;
      const acts = el('div', 'dl-actions', $('dl-box'));
      const choice = await new Promise((res) => {
        [['Reintentar', 'retry'], ['Continuar', 'skip']].forEach(([label, v]) => {
          const b = el('button', 'opt', acts);
          b.type = 'button';
          b.textContent = label;
          reveal(b);
          b.addEventListener('click', () => { buzz(25); res(v); }, { once: true });
        });
      });
      acts.remove();
      if (choice === 'skip') { skipped = true; break; }
      $('dl-sub').textContent = 'Reintentando…';
      pending = failed;
    }

    $('dl-title').textContent = skipped ? 'Continuando' : 'Listo';
    $('dl-sub').textContent = skipped ? 'Algunos archivos se cargarán al abrir.' : 'Ya puedes abrirla sin conexión.';
    buzz([20, 70, 20]);
    await sleep(1800);
    await fadeOut(s);
  }

  async function start() {
    await ensureOffline();   // pantalla de descarga: antes de cualquier texto
    const go = takeGo();
    if (go) return go === 'special' ? readSpecial() : readNormal();

    shortcuts();
    await intro();
    await prelude();
    for (let i = 0; i < QUESTIONS.length; i++) await ask(QUESTIONS[i], i);
    await result();
    if (score() >= 3) await (state.secret ? readSpecial() : readNormal());
  }

  start();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
