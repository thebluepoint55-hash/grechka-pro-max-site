(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => n.toLocaleString("ru-RU");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const grain = (size, extra = "") => `<svg width="${size}" height="${size}" ${extra}><use href="#grain"/></svg>`;

  /* ---------- Появление и счётчики ---------- */
  function countUp(el) {
    const to = +el.dataset.to, dec = +(el.dataset.dec || 0);
    const show = v => el.textContent = dec ? v.toFixed(dec).replace(".", ",") : fmt(Math.round(v));
    if (reduce) return show(to);
    const dur = 1600, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      show(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    $$(".count", e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  // соседние элементы появляются по очереди
  $$(".reveal").forEach(el => {
    const sib = [...el.parentElement.children].filter(c => c.classList.contains("reveal"));
    el.style.transitionDelay = `${Math.min(sib.indexOf(el), 5) * 80}ms`;
    io.observe(el);
  });

  /* ---------- Заголовок, который «проявляется» по словам при прокрутке ---------- */
  const scrubs = $$(".scrub").map(el => {
    const words = el.innerHTML.split(/(\s+)/).map(w => (/^\s+$/.test(w) ? w : `<span class="w">${w}</span>`)).join("");
    el.innerHTML = words;
    return { el, words: $$(".w", el) };
  });

  /* ---------- Сцены с коробкой ---------- */
  const scenes = $("#scenes");
  const panels = $$(".scene-panel", scenes);
  const bars = $$(".scenes__progress i", scenes);
  let step = -1;

  const nav = $("#nav");
  const hero = $(".hero");
  const heroTitle = $(".hero__title");
  const heroFoot = $(".hero__foot");
  const steps = $("#steps");
  const inboxImg = $(".inbox__photo img");
  const bar = $("#buybar");

  function onScroll() {
    const vh = innerHeight, y = scrollY;
    nav.classList.toggle("scrolled", y > 8);
    bar.classList.toggle("compact", y > vh * 0.35);

    // первый экран: надпись чуть уезжает и гаснет
    if (!reduce && y < vh * 1.2) {
      const k = y / vh;
      heroTitle.style.transform = `translate3d(0, ${k * -60}px, 0) scale(${1 - k * 0.06})`;
      heroTitle.style.opacity = String(clamp(1 - k * 1.4, 0, 1));
      heroFoot.style.opacity = String(clamp(1 - k * 2.2, 0, 1));
    }

    scrubs.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh * 0.88 - r.top) / (vh * 0.55), 0, 1);
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < n));
    });

    const r = scenes.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    const s = Math.min(panels.length - 1, Math.floor(p * panels.length + 0.2));
    if (s !== step) {
      step = s;
      panels.forEach((el, i) => el.classList.toggle("is-active", i === s));
      bars.forEach((el, i) => el.classList.toggle("on", i <= s));
    }

    const sr = steps.getBoundingClientRect();
    steps.style.setProperty("--p", clamp((vh * 0.8 - sr.top) / (sr.height + vh * 0.3), 0, 1).toFixed(3));

    if (inboxImg && !reduce) {
      const ir = inboxImg.getBoundingClientRect();
      const k = clamp((vh - ir.top) / (vh + ir.height), 0, 1);
      inboxImg.style.transform = `translate3d(0, ${(0.5 - k) * 60}px, 0) scale(${1.06 - k * 0.06})`;
    }
  }
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- До и после: одна и та же тарелка ---------- */
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let heap = "";
  for (let i = 0; i < 170; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 31;
    const x = 50 + Math.cos(a) * rr - 3.75, yy = 50 + Math.sin(a) * rr * 0.92 - 3.75;
    heap += `<svg style="left:${x}%;top:${yy}%;transform:rotate(${Math.round(rnd() * 360)}deg) scale(${0.85 + rnd() * 0.3})"><use href="#grain"/></svg>`;
  }
  $$(".plate").forEach(p => p.innerHTML = `<div class="plate__heap">${heap}</div>`);
  const ba = $("#ba"), baRange = $("#baRange");
  const setPos = v => ba.style.setProperty("--pos", v + "%");
  baRange.addEventListener("input", () => setPos(baRange.value));
  setPos(50);

  /* ---------- Конфигуратор ---------- */
  const form = $("#cfgForm");
  const MODELS = { pro: { name: "Гречка Pro", price: 2490 }, promax: { name: "Гречка Pro MAX", price: 4990 }, ultra: { name: "Гречка Ultra", price: 12990 } };
  const SIZES = { s: { name: "400 г", d: -1000 }, m: { name: "800 г", d: 0 }, l: { name: "1 ТБ (тарелка борща)", d: 1500 } };
  const COLORS = {
    titan: { name: "Натуральный титан", tint: "#FFFFFF" },
    coffee: { name: "Обжаренный кофейный", tint: "#B9906F" },
    desert: { name: "Пустынная ядрица", tint: "#EAD6B4" },
    iron: { name: "Космический чугун", tint: "#66666C" },
  };
  const ADDONS = { care: "КашаCare+", engrave: "Гравировка на каждом зерне", trade: "Trade-in старой гречки" };

  function state() {
    const fd = new FormData(form);
    const model = MODELS[fd.get("model")], size = SIZES[fd.get("size")], color = fd.get("color");
    const addons = Object.keys(ADDONS).filter(k => fd.get(k)).map(k => ({ name: ADDONS[k], price: +form.elements[k].value }));
    const total = Math.max(1, model.price + size.d + addons.reduce((s, a) => s + a.price, 0));
    return { model, modelKey: fd.get("model"), size, color, addons, total };
  }

  // плавный пересчёт цены
  const totalEl = $("#total"), monthlyEl = $("#monthly");
  let shown = 4990, anim = 0;
  function tweenTotal(to) {
    cancelAnimationFrame(anim);
    const from = shown, t0 = performance.now(), dur = reduce ? 0 : 500;
    const tick = now => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      shown = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      totalEl.textContent = fmt(shown);
      monthlyEl.textContent = fmt(Math.round(shown / 12));
      if (p < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
    // если вкладка в фоне и кадры не идут — всё равно показываем итог
    clearTimeout(tweenTotal.t);
    tweenTotal.t = setTimeout(() => {
      shown = to; totalEl.textContent = fmt(to); monthlyEl.textContent = fmt(Math.round(to / 12));
    }, dur + 120);
  }

  function render(e) {
    const st = state();
    tweenTotal(st.total);
    const c = COLORS[st.color];
    $("#colorName").textContent = c.name;
    $("#colorLegend").textContent = c.name;
    dispatchEvent(new CustomEvent("grechka:config", {
      detail: { tint: c.tint, model: st.modelKey, spin: !!(e && e.target.name === "color") },
    }));
  }
  form.addEventListener("change", render);
  render();

  /* ---------- Закреплённая плашка: прячем у конфигуратора, в финале и в подвале ---------- */
  const seen = {};
  const barIo = new IntersectionObserver(entries => {
    entries.forEach(e => seen[e.target.dataset.watch] = e.isIntersecting);
    const show = !seen.final && !seen.cfg && !seen.footer && !seen.game;
    bar.classList.toggle("show", show);
    bar.toggleAttribute("inert", !show);
  });
  [[".final .btn", "final"], ["#prices .cfg__total", "cfg"], [".footer", "footer"], ["#game .board", "game"]].forEach(([s, k]) => {
    const el = $(s); el.dataset.watch = k; barIo.observe(el);
  });

  /* ---------- «Кто-то только что купил» ---------- */
  const toast = $("#toast");
  const news = [
    ["Кто-то из Тамбова", "предзаказал Гречку Pro MAX"],
    ["Сергей из Казани", "взял Ultra в цвете «Космический чугун»"],
    ["Бабушка из Воронежа", "сдала гречку по Trade-in и получила 3 ₽"],
    ["Анна из Москвы", "добавила гравировку на каждое зерно"],
    ["Игорь, CEO", "купил 12 коробок для совета директоров"],
    ["Кто-то из Новосибирска", "уже распаковывает. 7 минут из 12"],
  ];
  let ni = 0;
  function showToast() {
    if ($("#modal").open || document.hidden || seen.game) return;
    const [who, what] = news[ni++ % news.length];
    toast.innerHTML = `<span class="toast__icon">${grain(22)}</span><div><b>${who}</b> ${what}<small>только что</small></div>`;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4200);
  }
  setTimeout(() => { showToast(); setInterval(showToast, 18000); }, 9000);

  /* ---------- Предзаказ ---------- */
  const modal = $("#modal"), s1 = $("#modalStep1"), s2 = $("#modalStep2");
  function openOrder() {
    const st = state();
    const rows = [
      ["Модель", st.model.name], ["Цвет", COLORS[st.color].name], ["Объём", st.size.name],
      ...st.addons.map(a => [a.name, (a.price > 0 ? "+" : "−") + fmt(Math.abs(a.price)) + " ₽"]),
      ["Итого", fmt(st.total) + " ₽"],
    ];
    $("#summary").innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("");
    s1.hidden = false; s2.hidden = true;
    modal.showModal();
    setTimeout(() => $("#buyerName").focus(), 60);
  }
  $$("[data-order]").forEach(b => b.addEventListener("click", openOrder));
  $$("[data-close]").forEach(b => b.addEventListener("click", () => modal.close()));
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });

  function confirmOrder() {
    const name = $("#buyerName").value.trim().replace(/[<>&"]/g, "");
    $("#doneTitle").textContent = name ? `${name}, ваша гречка уже едет.` : "Ваша гречка уже едет.";
    $("#orderId").textContent = "GPM-" + String(Math.floor(1000 + Math.random() * 9000));
    s1.hidden = true; s2.hidden = false;
    rain();
  }
  $("#confirmBtn").addEventListener("click", confirmOrder);
  $("#buyerName").addEventListener("keydown", e => { if (e.key === "Enter") confirmOrder(); });

  // дождь из гречки поверх окна
  function rain() {
    if (reduce) return;
    const box = $("#rain");
    let html = "";
    for (let i = 0; i < 80; i++) {
      const size = 14 + Math.random() * 20;
      html += grain(Math.round(size), `style="left:${Math.random() * 100}%;--dx:${(Math.random() - .5) * 200}px;--rot:${Math.round(Math.random() * 900 - 450)}deg;animation-duration:${2 + Math.random() * 2.2}s;animation-delay:${Math.random() * .8}s"`);
    }
    box.innerHTML = html;
    setTimeout(() => box.innerHTML = "", 5200);
  }
})();
