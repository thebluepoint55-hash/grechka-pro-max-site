// Физика гречки на canvas 2D: блок «Гречка рассыпается» и игра «Переберите гречку».
// Зёрна — круги-коллайдеры с вращением; спрайты берутся из img/grains/manifest.json,
// пока его нет — рисуются процедурно.
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = a => a[(Math.random() * a.length) | 0];
  const dprNow = () => Math.min(window.devicePixelRatio || 1, 2);
  const fmt = n => n.toLocaleString("ru-RU");
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? many : b === 1 ? one : b > 1 && b < 5 ? few : many;
  };

  /* ================= Спрайты ================= */
  const KINDS = ["grain", "black", "stone", "husk"];
  const SRC = { grain: [], black: [], stone: [], husk: [] };
  let spriteVersion = 0;

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  // зерно ядрицы сбоку: трёхгранная «пирамидка» со скруглёнными углами
  function procGrain(dark, seed) {
    const c = canvas(96, 96), g = c.getContext("2d");
    const j = k => (Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
    const tip = [48 + j(1) * 6, 10 + Math.abs(j(2)) * 6];
    const L = [12 + j(3) * 4, 80 + j(4) * 3], Rr = [84 + j(5) * 4, 80 + j(6) * 3];
    g.beginPath();
    g.moveTo(tip[0] - 5, tip[1] + 6);
    g.quadraticCurveTo(tip[0], tip[1] - 4, tip[0] + 5, tip[1] + 6);
    g.lineTo(Rr[0] - 2, Rr[1] - 10);
    g.quadraticCurveTo(Rr[0] + 4, Rr[1] + 4, Rr[0] - 12, Rr[1] + 4);
    g.quadraticCurveTo(48, Rr[1] + 12, L[0] + 12, L[1] + 4);
    g.quadraticCurveTo(L[0] - 4, L[1] + 4, L[0] + 2, L[1] - 10);
    g.closePath();
    const gr = g.createLinearGradient(14, 20, 86, 84);
    if (dark) { gr.addColorStop(0, "#3A2A20"); gr.addColorStop(1, "#0E0907"); }
    else {
      const h = 24 + j(7) * 6, l = 46 + j(8) * 8;
      gr.addColorStop(0, `hsl(${h} 52% ${l + 12}%)`);
      gr.addColorStop(0.55, `hsl(${h - 2} 56% ${l}%)`);
      gr.addColorStop(1, `hsl(${h - 4} 60% ${l - 18}%)`);
    }
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    // грань и блик
    g.fillStyle = dark ? "rgba(255,255,255,.06)" : "rgba(255,230,190,.28)";
    g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(L[0] + 6, L[1]); g.lineTo(48, L[1] + 6); g.closePath(); g.fill();
    g.strokeStyle = dark ? "rgba(255,255,255,.12)" : "rgba(255,236,200,.5)";
    g.lineWidth = 2; g.beginPath(); g.moveTo(tip[0], tip[1] + 4); g.lineTo(50, 84); g.stroke();
    g.fillStyle = "rgba(255,255,255,.35)";
    g.beginPath(); g.ellipse(58, 38, 4, 11, -0.4, 0, Math.PI * 2); g.fill();
    g.restore();
    return c;
  }
  function procStone(seed) {
    const c = canvas(96, 96), g = c.getContext("2d");
    const n = 8, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 30 + Math.sin(seed * 7 + i * 2.3) * 7;
      pts.push([48 + Math.cos(a) * r, 48 + Math.sin(a) * r * 0.82]);
    }
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (i === 0) g.moveTo(m[0], m[1]); else g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    g.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    g.closePath();
    const gr = g.createRadialGradient(38, 34, 4, 48, 50, 44);
    const t = 40 + (seed % 3) * 8;
    gr.addColorStop(0, `hsl(30 6% ${t + 26}%)`); gr.addColorStop(1, `hsl(28 8% ${t - 8}%)`);
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},.12)`;
      g.fillRect(20 + ((i * 37) % 56), 20 + ((i * 53) % 56), 2, 2);
    }
    g.restore();
    return c;
  }
  function procHusk(seed) {
    const c = canvas(96, 96), g = c.getContext("2d");
    g.translate(48, 48); g.rotate(seed);
    g.beginPath();
    g.moveTo(-36, 6);
    g.quadraticCurveTo(-4, -26, 36, -4);
    g.quadraticCurveTo(4, -6, -36, 6);
    g.closePath();
    const gr = g.createLinearGradient(-30, -10, 30, 10);
    gr.addColorStop(0, "rgba(160,112,64,.95)"); gr.addColorStop(1, "rgba(214,178,128,.85)");
    g.fillStyle = gr; g.fill();
    g.strokeStyle = "rgba(110,70,30,.6)"; g.lineWidth = 1.5; g.stroke();
    return c;
  }
  for (let i = 0; i < 5; i++) SRC.grain.push(procGrain(false, i + 1));
  for (let i = 0; i < 3; i++) SRC.black.push(procGrain(true, i + 11));
  for (let i = 0; i < 4; i++) SRC.stone.push(procStone(i + 1));
  for (let i = 0; i < 3; i++) SRC.husk.push(procHusk(i * 0.7));
  KINDS.forEach(k => SRC[k].forEach(c => { c._ref = 80; }));

  // настоящие спрайты, если их уже положили
  fetch("img/grains/manifest.json", { cache: "no-cache" })
    .then(r => (r.ok ? r.json() : null))
    .then(m => {
      if (!m) return;
      KINDS.forEach(k => {
        const list = (m[k] || []).map(it => (typeof it === "string" ? it : it.file || it.src || it.path)).filter(Boolean);
        if (!list.length) return;
        const imgs = [];
        let left = list.length;
        list.forEach(f => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => { img._ref = 125; imgs.push(img); done(); };
          img.onerror = done;
          img.src = /[\/]/.test(f) ? f : "img/grains/" + f;
        });
        function done() {
          if (--left) return;
          if (imgs.length) { SRC[k] = imgs; spriteVersion++; }
        }
      });
    })
    .catch(() => {});

  const SHADOW = (() => {
    const c = canvas(64, 64), g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(40,24,10,.55)"); gr.addColorStop(0.55, "rgba(40,24,10,.18)"); gr.addColorStop(1, "rgba(40,24,10,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  })();

  /* ================= Движок ================= */
  // mode "side": вид сбоку, гравитация вниз, пол; mode "top": вид сверху на стол, подскоки по z
  class Sim {
    constructor(cv, o) {
      this.cv = cv; this.ctx = cv.getContext("2d"); this.o = o;
      this.ps = []; this.w = 1; this.h = 1; this.d = 1;
      this.bakes = new Map(); this.bakeVer = -1;
      this.resize();
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      this.d = dprNow();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.cv.width = Math.round(this.w * this.d); this.cv.height = Math.round(this.h * this.d);
      this.bakes.clear();
    }
    sprite(p) {
      if (this.bakeVer !== spriteVersion) { this.bakes.clear(); this.bakeVer = spriteVersion; }
      const list = SRC[p.kind];
      const src = list[p.v % list.length];
      const px = Math.max(4, Math.round(p.size * this.d));
      const key = p.kind + (p.v % list.length) + "_" + px;
      let b = this.bakes.get(key);
      if (!b) {
        const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
        // спрайты нарисованы в едином масштабе: size — это размер «среднего» зерна
        const k = px / (src._ref || Math.max(sw, sh));
        const c = canvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(src, 0, 0, c.width, c.height);
        b = { c, w: c.width / this.d, h: c.height / this.d };
        this.bakes.set(key, b);
      }
      return b;
    }
    add(p) {
      const size = p.size;
      const rk = p.kind === "husk" ? 0.3 : p.kind === "stone" ? 0.42 : 0.38;
      this.ps.push(Object.assign({ vx: 0, vy: 0, z: 0, vz: 0, a: rand(0, 6.28), va: rand(-6, 6), r: size * rk, v: (Math.random() * 1000) | 0, still: 0, sleep: false, c: 0 }, p));
    }
    step(dt) {
      if (dt <= 0) return;
      const o = this.o, ps = this.ps, top = o.mode === "top";
      const sub = 3, h = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (const p of ps) {
          p.c = 0;
          if (p.sleep || p.fly) continue;
          if (top) {
            if (p.z > 0 || p.vz > 0) {
              p.vz -= o.gz * h; p.z += p.vz * h;
              if (p.z < 0) { p.z = 0; p.vz = p.vz < -60 ? -p.vz * 0.32 : 0; p.vx *= 0.8; p.vy *= 0.8; }
            } else {
              const f = Math.exp(-(p.blown ? 0.6 : o.fric) * h);
              p.vx *= f; p.vy *= f; p.va *= f;
            }
          } else {
            p.vy += o.g * h;
          }
          p.x += p.vx * h; p.y += p.vy * h; p.a += p.va * h;
        }
        this.collide(top);
        this.bounds(top);
      }
      // покой: медленные зёрна «засыпают» и держат горку
      for (const p of ps) {
        if (p.sleep || p.fly) continue;
        if (!top && p.c > 0) { p.vx *= this.o.roll || 0.97; p.va += (p.vx / Math.max(1, p.r) * 0.5 - p.va) * 0.2; }
        const sp = Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.vz);
        const grounded = top ? p.z <= 0 : p.c > 0;
        if (sp < (top ? 6 : 30) && grounded) p.still += dt; else p.still = 0;
        if (p.still > (top ? 0.35 : 0.06)) { p.sleep = true; p.vx = p.vy = p.vz = 0; p.va = 0; }
      }
    }
    collide(top) {
      const ps = this.ps, e = this.o.e;
      let maxR = 1;
      for (const p of ps) if (p.r > maxR) maxR = p.r;
      const cs = maxR * 2, grid = new Map();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.fly || (top && p.z > p.r * 1.5)) continue;
        const k = (Math.floor(p.x / cs) + 512) * 4096 + Math.floor(p.y / cs) + 512;
        let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i);
      }
      for (const [k, cell] of grid) {
        const cx = Math.floor(k / 4096), cy = k - cx * 4096; // со сдвигом +512
        for (let ox = 0; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          if (ox === 0 && oy < 0) continue;
          const other = ox === 0 && oy === 0 ? cell : grid.get((cx + ox) * 4096 + cy + oy);
          if (!other) continue;
          for (let ii = 0; ii < cell.length; ii++) {
            const i = cell[ii], pi = ps[i];
            for (let jj = other === cell ? ii + 1 : 0; jj < other.length; jj++) {
              const pj = ps[other[jj]];
              const dx = pj.x - pi.x, dy = pj.y - pi.y, R = pi.r + pj.r, d2 = dx * dx + dy * dy;
              if (d2 >= R * R || d2 < 1e-6) continue;
              const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = R - d;
              let wi = pi.sleep ? 0 : 1, wj = pj.sleep ? 0 : 1;
              const rvn = (pj.vx - pi.vx) * nx + (pj.vy - pi.vy) * ny;
              if (rvn < -this.o.wake) { if (pi.sleep) { pi.sleep = false; wi = 1; } if (pj.sleep) { pj.sleep = false; wj = 1; } }
              const sum = wi + wj;
              if (!sum) continue;
              pi.x -= nx * ov * wi / sum; pi.y -= ny * ov * wi / sum;
              pj.x += nx * ov * wj / sum; pj.y += ny * ov * wj / sum;
              pi.c++; pj.c++;
              if (rvn < 0) {
                const imp = -(1 + e) * rvn / sum;
                pi.vx -= imp * nx * wi; pi.vy -= imp * ny * wi;
                pj.vx += imp * nx * wj; pj.vy += imp * ny * wj;
              }
              const tx = -ny, ty = nx, rvt = (pj.vx - pi.vx) * tx + (pj.vy - pi.vy) * ty, ft = rvt * this.o.mu / sum;
              pi.vx += ft * tx * wi; pi.vy += ft * ty * wi;
              pj.vx -= ft * tx * wj; pj.vy -= ft * ty * wj;
            }
          }
        }
      }
    }
    bounds(top) {
      const o = this.o, W = this.w, floor = top ? this.h : this.h - o.floorPad;
      for (const p of this.ps) {
        if (p.fly || p.sleep) continue;
        if (top && p.blown) continue; // сдутую шелуху стены не держат
        if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx) * 0.4; }
        if (p.x > W - p.r) { p.x = W - p.r; p.vx = -Math.abs(p.vx) * 0.4; }
        if (top) {
          const t0 = o.topPad || 0;
          if (p.y < t0 + p.r) { p.y = t0 + p.r; p.vy = Math.abs(p.vy) * 0.4; }
        }
        if (p.y > floor - p.r) {
          p.y = floor - p.r; p.c++;
          if (p.vy > 0) p.vy = p.vy > 120 ? -p.vy * o.e : 0;
          p.vx *= top ? 0.6 : 0.55;
        }
      }
    }
    draw(extra) {
      const g = this.ctx, d = this.d, top = this.o.mode === "top";
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.cv.width, this.cv.height);
      const floor = this.h - (this.o.floorPad || 0);
      // мягкие тени
      for (const p of this.ps) {
        if (p.fly) continue;
        let sx, sy, sw, a;
        if (top) {
          sx = p.x + 1 + p.z * 0.35; sy = p.y + p.r * 0.5 + p.z * 0.55; sw = p.r * 3.2 * (1 + p.z / 160); a = 0.38 * (1 - Math.min(p.z / 180, 0.7));
        } else {
          const dist = floor - (p.y + p.r);
          if (dist > 46) continue;
          sx = p.x; sy = floor - 1; sw = p.r * 3 * (1 - dist / 120); a = 0.5 * (1 - dist / 46);
        }
        g.globalAlpha = a;
        g.setTransform(d, 0, 0, d, 0, 0);
        g.drawImage(SHADOW, sx - sw / 2, sy - sw * (top ? 0.3 : 0.16), sw, sw * (top ? 0.6 : 0.32));
      }
      g.globalAlpha = 1;
      for (const p of this.ps) {
        if (p.fly) continue;
        this.drawOne(p, p.x, top ? p.y - p.z * 0.5 : p.y, top ? 1 + p.z / 420 : 1, p.alpha == null ? 1 : p.alpha);
      }
      if (extra) extra(g);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    }
    drawOne(p, x, y, k, alpha) {
      const g = this.ctx, d = this.d, b = this.sprite(p);
      const c = Math.cos(p.a) * d * k, s = Math.sin(p.a) * d * k;
      g.globalAlpha = alpha;
      g.setTransform(c, s, -s, c, x * d, y * d);
      g.drawImage(b.c, -b.w / 2, -b.h / 2, b.w, b.h);
    }
  }

  // цикл, который работает только пока блок виден
  function runner(el, tick) {
    let on = false, raf = 0, last = 0;
    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      tick(dt);
      if (on) raf = requestAnimationFrame(loop);
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(loop); }
      else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
    }, { rootMargin: "100px 0px" }).observe(el);
  }

  /* ================= Блок «Гречка рассыпается» ================= */
  const spill = $("#spill");
  if (spill) {
    const cv = $(".spill__canvas", spill);
    const mobile = matchMedia("(max-width: 767px)").matches;
    const sim = new Sim(cv, { mode: "side", g: 2600, e: 0.1, mu: 0.95, roll: 0.72, wake: 420, floorPad: mobile ? 112 : 56 });
    const TOTAL = mobile ? 260 : 380;
    const countEl = $(".spill__count b", spill);
    let emitted = 0, acc = 0, shown = -1;
    new ResizeObserver(() => sim.resize()).observe(cv);

    const grainSize = h => clamp(h * 0.04, mobile ? 10 : 12, 16);
    function emitAt(x, y, dx, dy, size) {
      const sp = rand(40, 120), side = rand(-22, 22);
      sim.add({ kind: "grain", x, y, size: size * rand(0.85, 1.12),
        vx: dx * sp - dy * side, vy: dy * sp + dx * side });
      emitted++;
    }
    function staticHeap() {
      // без анимации: сразу готовая горка под коробкой
      const cx = sim.w * (mobile ? 0.5 : 0.62), size = mobile ? 10 : 13;
      for (let i = 0; i < TOTAL; i++) {
        sim.add({ kind: "grain", x: cx + rand(-60, 60), y: sim.h * 0.3 - i * 2, size, vx: rand(-40, 40) });
      }
      for (let i = 0; i < 400; i++) sim.step(1 / 60);
      emitted = TOTAL;
    }
    window.grainsDebug = window.grainsDebug || {};
    window.grainsDebug.spill = { sim, reset() { sim.ps.length = 0; emitted = 0; }, tick: n => { for (let i = 0; i < n; i++) spillTick(1 / 60); } };

    function spillTick(dt) {
      const r = spill.getBoundingClientRect();
      // блок ушёл далеко вниз — можно рассыпать заново
      if (r.top > innerHeight * 1.05 && emitted) { sim.ps.length = 0; emitted = 0; }
      const sp = window.grechkaBox && window.grechkaBox.spout;
      if (reduce) {
        if (!emitted && r.top < innerHeight * 0.6) staticHeap();
      } else if (sp && sp.active && sp.roll > 74 && emitted < TOTAL) {
        acc += dt * (190 + (sp.roll - 74) * 4);
        const cr = cv.getBoundingClientRect(), size = grainSize(sp.h);
        while (acc >= 1 && emitted < TOTAL) {
          acc -= 1;
          const u = rand(0.38, 0.62);
          emitAt(sp.x1 + (sp.x2 - sp.x1) * u - cr.left + sp.dx * 4, sp.y1 + (sp.y2 - sp.y1) * u - cr.top + sp.dy * 4, sp.dx, sp.dy, size);
        }
      }
      sim.step(dt);
      sim.draw();
      if (countEl && shown !== emitted) { shown = emitted; countEl.textContent = fmt(emitted); }
    }
    runner(spill, spillTick);
  }

  /* ================= Игра «Переберите гречку» ================= */
  const game = $("#game");
  if (!game) return;
  const board = $(".board", game), cv = $(".board__canvas", game);
  const bowl = $(".board__bowl", game), bowlCount = $(".board__bowl b", game);
  const hudTime = $("[data-hud=time]", game), hudScore = $("[data-hud=score]", game), hudLeft = $("[data-hud=left]", game), hudCombo = $("[data-hud=combo]", game);
  const startScr = $(".board__start", game), endScr = $(".board__end", game);
  const spentEls = document.querySelectorAll("[data-spent]");
  const pay = $("#payModal"), payChoose = $(".pay__choose", pay), payWait = $(".pay__wait", pay), payDone = $(".pay__done", pay);
  const bubble = $(".board__bubble", game);
  const PRICE = 51, DUR = 30;
  const POINTS = { stone: 10, black: 7, husk: 5 };
  const mobile = matchMedia("(max-width: 767px)").matches;

  let spent = 0;
  try { spent = +localStorage.getItem("grechka-spent") || 0; } catch (e) {}
  const showSpent = () => spentEls.forEach(el => el.textContent = fmt(spent));
  showSpent();

  const sim = new Sim(cv, { mode: "top", gz: 2200, fric: 7, e: 0.3, mu: 0.25, wake: 90, topPad: 0 });
  new ResizeObserver(() => sim.resize()).observe(cv);
  let state = "idle", timeLeft = DUR, score = 0, combo = 0, lastHit = 0, penalties = 0, clock = 0;
  const caught = { stone: 0, black: 0, husk: 0 };
  let flying = [], pops = [], inBowl = [], pourLeft = 0, pourAcc = 0, debrisTotal = 0;

  function setHud() {
    hudTime.textContent = "0:" + String(Math.max(0, Math.ceil(timeLeft))).padStart(2, "0");
    hudScore.textContent = fmt(score);
    const left = sim.ps.filter(p => p.kind !== "grain" && !p.fly && !p.gone).length + pourLeftDebris;
    hudLeft.textContent = left;
    bowlCount.textContent = caught.stone + caught.black + caught.husk;
  }
  let pourLeftDebris = 0, queue = [];

  function startGame() {
    sim.resize();
    sim.ps.length = 0; flying = []; pops = []; inBowl = [];
    score = 0; combo = 0; penalties = 0; timeLeft = DUR; clock = 0;
    caught.stone = caught.black = caught.husk = 0;
    const W = sim.w, H = sim.h;
    const nGood = mobile ? 170 : 300, size = mobile ? 15 : 19;
    queue = [];
    for (let i = 0; i < nGood; i++) queue.push("grain");
    const nStone = mobile ? 7 : 10, nBlack = mobile ? 7 : 10, nHusk = mobile ? 8 : 12;
    for (let i = 0; i < nStone; i++) queue.push("stone");
    for (let i = 0; i < nBlack; i++) queue.push("black");
    for (let i = 0; i < nHusk; i++) queue.push("husk");
    for (let i = queue.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [queue[i], queue[j]] = [queue[j], queue[i]]; }
    debrisTotal = nStone + nBlack + nHusk;
    pourLeftDebris = debrisTotal;
    sim.gsize = size;
    sim.pour = { x: W * 0.5, y: H * 0.42 };
    state = "play";
    board.classList.add("is-play");
    startScr.hidden = true; endScr.hidden = true;
    setHud();
  }
  function emitPour(dt) {
    if (!queue.length) return;
    pourAcc += dt * (reduce ? 1e4 : 420);
    const W = sim.w, H = sim.h, size = sim.gsize;
    while (pourAcc >= 1 && queue.length) {
      pourAcc -= 1;
      const kind = queue.pop();
      if (kind !== "grain") pourLeftDebris--;
      const a = rand(0, Math.PI * 2), sp = rand(40, Math.min(W, H) * 1.25) * (kind === "husk" ? 0.8 : 1);
      const sz = kind === "stone" ? size * rand(0.8, 1.05) : kind === "husk" ? size * rand(1.0, 1.3) : size * rand(0.85, 1.1);
      sim.add({ kind, x: sim.pour.x + rand(-14, 14), y: sim.pour.y + rand(-14, 14), z: rand(120, 200), vz: rand(-40, 120),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, size: sz });
    }
  }
  function bowlPos() {
    const b = bowl.getBoundingClientRect(), c = cv.getBoundingClientRect();
    return { x: b.left + b.width / 2 - c.left, y: b.top + b.height * 0.45 - c.top };
  }
  function collect(p, how) {
    p.fly = true;
    const t = bowlPos();
    flying.push({ p, x0: p.x, y0: p.y - p.z * 0.5, x1: t.x + rand(-10, 10), y1: t.y + rand(-6, 6), t: 0, dur: 0.55 + Math.random() * 0.15 });
    caught[p.kind]++;
    const now = clock;
    combo = now - lastHit < 1.6 ? combo + 1 : 1;
    lastHit = now;
    const pts = (how === "blow" ? 8 : POINTS[p.kind]) * Math.min(combo, 5);
    score += pts;
    pops.push({ x: p.x, y: p.y - 10, text: "+" + pts, t: 0 });
    if (combo > 1) { hudCombo.textContent = "Комбо ×" + Math.min(combo, 5); hudCombo.classList.add("on"); clearTimeout(collect.t); collect.t = setTimeout(() => hudCombo.classList.remove("on"), 900); }
    bowl.classList.remove("hit"); void bowl.offsetWidth; bowl.classList.add("hit");
  }
  function penalty(p) {
    score -= 5; penalties++; combo = 0;
    p.vz = 160; p.z = Math.max(p.z, 1); p.sleep = false; p.va = rand(-14, 14);
    pops.push({ x: p.x, y: p.y - 10, text: "−5", t: 0, bad: true });
    bubble.textContent = "Это была хорошая гречка";
    bubble.style.left = clamp(p.x, 110, sim.w - 110) + "px";
    bubble.style.top = Math.max(40, p.y - 34) + "px";
    bubble.classList.remove("show"); void bubble.offsetWidth; bubble.classList.add("show");
  }
  function local(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function hitTest(x, y, touch) {
    let best = null, bd = Infinity;
    for (const p of sim.ps) {
      if (p.fly || p.gone) continue;
      const py = p.y - p.z * 0.5;
      const pad = touch ? 14 : 6, rr = p.r + pad + (p.kind !== "grain" ? 4 : 0);
      const d = (p.x - x) ** 2 + (py - y) ** 2;
      if (d < rr * rr) {
        // мусор в приоритете, чтобы промахи по соседнему зерну не наказывали
        const sc = d - (p.kind !== "grain" ? 400 : 0);
        if (sc < bd) { bd = sc; best = p; }
      }
    }
    return best;
  }
  let lastMove = null;
  cv.addEventListener("pointerdown", e => {
    if (state !== "play") return;
    const { x, y } = local(e);
    const p = hitTest(x, y, e.pointerType !== "mouse");
    lastMove = { x, y, t: performance.now() };
    if (!p) return;
    if (p.kind === "grain") penalty(p); else collect(p, "click");
    setHud();
  });
  // сдувание шелухи быстрым движением
  cv.addEventListener("pointermove", e => {
    if (state !== "play") return;
    const { x, y } = local(e), now = performance.now();
    if (lastMove) {
      const dt = Math.max(8, now - lastMove.t) / 1000;
      const vx = (x - lastMove.x) / dt, vy = (y - lastMove.y) / dt, v = Math.hypot(vx, vy);
      if (v > 900) {
        for (const p of sim.ps) {
          if (p.kind !== "husk" || p.fly || p.gone || p.blown) continue;
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < 70 * 70) {
            p.blown = true; p.sleep = false; p.vx = vx * 0.9; p.vy = vy * 0.9; p.z = 4; p.vz = 60; p.va = rand(-20, 20);
          }
        }
      }
    }
    lastMove = { x, y, t: now };
  });
  cv.addEventListener("pointerleave", () => { lastMove = null; });

  function finish() {
    setHud();
    state = "end";
    board.classList.remove("is-play");
    const parts = [];
    if (caught.stone) parts.push(`${caught.stone} ${plural(caught.stone, "камушек", "камушка", "камушков")}`);
    if (caught.black) parts.push(`${caught.black} ${plural(caught.black, "чёрное зерно", "чёрных зерна", "чёрных зёрен")}`);
    if (caught.husk) parts.push(`${caught.husk} ${plural(caught.husk, "шелушинку", "шелушинки", "шелушинок")}`);
    const used = Math.min(DUR, Math.round(clock));
    const list = parts.length ? parts.length > 1 ? parts.slice(0, -1).join(", ") + " и " + parts[parts.length - 1] : parts[0] : "ничего";
    $(".end__score", endScr).textContent = fmt(score);
    $(".end__text", endScr).textContent = `Вы перебрали ${list} за ${used} ${plural(used, "секунду", "секунды", "секунд")} и ${PRICE} ₽.`;
    $(".end__penalty", endScr).textContent = penalties ? `Хорошей гречки пострадало: ${penalties}.` : "Ни одно хорошее зерно не пострадало.";
    endScr.hidden = false;
  }

  function gameTick(dt) {
    if (state === "play") {
      clock += dt;
      timeLeft -= dt;
      emitPour(dt);
      if (timeLeft <= 0) { timeLeft = 0; finish(); }
      else {
        const left = sim.ps.filter(p => p.kind !== "grain" && !p.fly && !p.gone).length + pourLeftDebris;
        if (!left && !queue.length) finish();
      }
    }
    sim.step(dt);
    // сдутая шелуха улетела за край
    for (const p of sim.ps) {
      if (p.blown && !p.gone && !p.fly && (p.x < -20 || p.x > sim.w + 20 || p.y < -20 || p.y > sim.h + 20)) {
        p.gone = true;
        if (state === "play") collect(p, "blow");
      }
    }
    for (const f of flying) f.t += dt / f.dur;
    flying = flying.filter(f => {
      if (f.t >= 1) {
        f.p.gone = true;
        // мусор остаётся лежать в мисочке
        const b = bowlPos();
        inBowl.push({ p: f.p, dx: f.x1 - b.x, dy: f.y1 - b.y });
        if (inBowl.length > 40) inBowl.shift();
        return false;
      }
      return true;
    });
    sim.ps = sim.ps.filter(p => !p.gone);
    for (const q of pops) q.t += dt;
    pops = pops.filter(q => q.t < 0.9);
    sim.draw(g => {
      const d = sim.d;
      if (inBowl.length) {
        const b = bowlPos();
        for (const it of inBowl) sim.drawOne(it.p, b.x + it.dx * 0.6, b.y + it.dy * 0.6, 0.85, 1);
      }
      for (const f of flying) {
        const t = f.t, e = t * t * (3 - 2 * t);
        const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * t) * 90;
        f.p.a += dt * 10;
        sim.drawOne(f.p, x, y, 1 + Math.sin(Math.PI * t) * 0.35 - t * 0.2, 1);
      }
      g.setTransform(d, 0, 0, d, 0, 0);
      g.textAlign = "center";
      g.font = "600 15px Onest, Manrope, sans-serif";
      for (const q of pops) {
        g.globalAlpha = 1 - q.t / 0.9;
        g.fillStyle = q.bad ? "#C8102E" : "#1D1D1F";
        g.fillText(q.text, q.x, q.y - q.t * 36);
      }
      g.globalAlpha = 1;
    });
    if (state === "play") setHud();
  }
  runner(board, gameTick);
  window.grainsDebug = window.grainsDebug || {};
  window.grainsDebug.game = { sim, tick: n => { for (let i = 0; i < n; i++) gameTick(1 / 60); }, get state() { return state; }, caught, startGame };

  /* ---------- Шуточная оплата: никаких полей и реальных данных ---------- */
  function openPay() {
    payChoose.hidden = false; payWait.hidden = true; payDone.hidden = true;
    pay.showModal();
  }
  game.querySelectorAll("[data-play]").forEach(b => b.addEventListener("click", openPay));
  pay.querySelectorAll("[data-method]").forEach(b => b.addEventListener("click", () => {
    payChoose.hidden = true; payWait.hidden = false;
    $(".pay__method", pay).textContent = b.dataset.method;
    setTimeout(() => {
      payWait.hidden = true; payDone.hidden = false;
      spent += PRICE;
      try { localStorage.setItem("grechka-spent", String(spent)); } catch (e) {}
      showSpent();
      setTimeout(() => {
        if (pay.open) pay.close();
        board.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        startGame();
      }, 1100);
    }, 1400);
  }));
  pay.querySelectorAll("[data-pay-close]").forEach(b => b.addEventListener("click", () => pay.close()));
  pay.addEventListener("click", e => { if (e.target === pay && !payChoose.hidden) pay.close(); });
})();
