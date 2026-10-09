// 3D-коробка «Гречка Pro MAX» на three.js (локальная копия в vendor/three).
// Одна сцена на всю страницу: коробка «переезжает» между якорями [data-anchor]
// и в каждом принимает свою позу. Поза зависит от прокрутки, мыши и пальца.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";

const root = document.documentElement;
let canvas = null;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// 3D не заработало: показываем фото коробки (их грузим только в этом случае)
function fail() {
  root.classList.add("no-webgl");
  document.querySelectorAll("img.poster[data-src]").forEach(img => { img.src = img.dataset.src; });
}
const domReady = () => document.readyState !== "loading" ? Promise.resolve()
  : new Promise(r => document.addEventListener("readystatechange", r, { once: true }));

/* ---------- Тень под коробкой: мягкая «контактная» тень на белом ---------- */
function makeShadow() {
  const S = 512, W = 3.6, D = 2.8;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const fw = (1.25 / W) * S, fd = (0.65 / D) * S, off = 4000;
  const blob = (w, h, blur, alpha, r) => {
    g.save();
    g.shadowColor = `rgba(0,0,0,${alpha})`;
    g.shadowBlur = blur;
    g.shadowOffsetX = off;
    g.fillStyle = "#000";
    g.beginPath();
    g.roundRect(S / 2 - w / 2 - off, S / 2 - h / 2, w, h, r);
    g.fill();
    g.restore();
  };
  blob(fw * 1.15, fd * 1.35, 70, 0.22, 40);   // широкая мягкая
  blob(fw * 1.0, fd * 1.0, 22, 0.32, 12);     // средняя
  blob(fw * 0.97, fd * 0.92, 6, 0.38, 4);     // контакт
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

async function main() {
  // Скрипт загружается async и не ждёт остальные скрипты. Холст стоит в начале
  // страницы, поэтому начинаем готовить 3D, как только он есть, не дожидаясь всей разметки.
  canvas = document.getElementById("scene");
  if (!canvas) { await domReady(); canvas = document.getElementById("scene"); }
  performance.mark("box:start");
  if (!canvas) return;
  let renderer;
  try {
    // Аппаратное сглаживание (MSAA) на весь экран съедало половину кадра на встроенных видеокартах.
    // Вместо него рисуем в 1,5× и даём браузеру уменьшить картинку — края остаются гладкими.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  } catch (e) { return fail(); }

  const isMobile = matchMedia("(max-width: 767px)").matches;
  // не больше 2× и не больше ~4,5 млн пикселей на холст
  // Всегда 1,5× (это и есть сглаживание), но не больше ~2,2 млн пикселей на холст
  const pixelRatio = () => Math.min(1.5, Math.sqrt(2.2e6 / Math.max(1, innerWidth * innerHeight)));
  renderer.setPixelRatio(pixelRatio());
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral (Khronos PBR Neutral): белое остаётся белым, красный — сочным
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.95;

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-5, 7, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(6, 2, 4);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(20, 1, 1, 60);
  camera.position.set(0, 0, 20);
  const visH = 2 * Math.tan((camera.fov / 2) * DEG) * camera.position.z;

  /* ---------- Текстуры граней ---------- */
  // Текстуры создаём сразу пустыми, а картинки распаковываются в фоне (ImageBitmap).
  // Так материалы можно готовить параллельно с загрузкой картинок.
  const bitmaps = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const pending = [];
  const tex = (url, srgb) => {
    const t = new THREE.Texture();
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    t.flipY = false;
    pending.push(bitmaps.loadAsync(url).then(img => { t.image = img; t.needsUpdate = true; }));
    return t;
  };
  // порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z
  const faces = ["right", "left", "top", "bottom", "front", "back"];
  const withMask = { front: 1, back: 1, left: 1, top: 1 };
  const maps = faces.map(f => tex(`img/pack/${f}.jpg`, true));
  const masks = faces.map(f => (withMask[f] ? tex(`img/pack/${f}-mask.png`, false) : null));

  // Оттенок бумаги для конфигуратора: красим только светлую ненасыщенную «бумагу»,
  // окно с гречкой и красные буквы не трогаем.
  const tint = { value: new THREE.Color(1, 1, 1) };
  const tintTarget = new THREE.Color(1, 1, 1);
  const injectTint = sh => {
    sh.uniforms.uTint = tint;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTint;")
      .replace("#include <map_fragment>", `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
        float sat = (mx - mn) / max(mx, 1e-4);
        float paper = smoothstep(0.30, 0.70, l) * (1.0 - smoothstep(0.08, 0.22, sat));
        #ifdef USE_CLEARCOATMAP
          paper *= 1.0 - texture2D(clearcoatMap, vClearcoatMapUv).r;
        #endif
        diffuseColor.rgb = mix(c, c * uTint, paper);
      }`);
  };

  // Граням без своей маски даём «пустую» маску 1×1: просто матовая бумага.
  // Тогда у всех шести граней одинаковый шейдер, и видеокарта собирает его один раз.
  const paperMask = new THREE.DataTexture(new Uint8Array([0, 209, 0, 255]), 1, 1);
  paperMask.needsUpdate = true;

  const mats = faces.map((f, i) => {
    // R — плёнка/лак, G — шероховатость, B — металл (рамка окна)
    const mk = masks[i] || paperMask;
    const m = new THREE.MeshPhysicalMaterial({
      map: maps[i],
      roughness: 1, roughnessMap: mk,
      metalness: 1, metalnessMap: mk,
      clearcoat: 1, clearcoatMap: mk,
      clearcoatRoughness: 0.035,
    });
    m.onBeforeCompile = injectTint;
    return m;
  });

  const geo = new RoundedBoxGeometry(1.25, 2, 0.65, 5, 0.02);

  // rig (позиция, масштаб, наклон «камеры») → yaw (поворот) → float (парение) → box (кивок)
  const rig = new THREE.Group();
  const rollG = new THREE.Group();
  const yawG = new THREE.Group();
  const floatG = new THREE.Group();
  const box = new THREE.Mesh(geo, mats);
  const shadow = makeShadow();
  shadow.position.y = -1.004;
  floatG.add(box);
  yawG.add(floatG, shadow);
  rollG.add(yawG);
  rig.add(rollG);
  scene.add(rig);

  // Сразу начинаем собирать шейдеры (параллельно с загрузкой картинок),
  // и только потом ждём остальную разметку страницы — она нужна для якорей ниже.
  const compiled = renderer.compileAsync(scene, camera).catch(() => { /* соберётся при первом кадре */ })
    .then(() => performance.mark("box:compiled"));
  await domReady();

  /* ---------- Позы ---------- */
  const P = (yaw, tilt, pitch, fill, extra) => Object.assign({ yaw, tilt, pitch, fill, ox: 0, oy: 0, shadow: 1, float: 0, roll: 0 }, extra);
  const KEYS = ["yaw", "tilt", "pitch", "fill", "ox", "oy", "shadow", "float", "roll"];
  const lerpPose = (a, b, t) => {
    const o = {};
    for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
    return o;
  };
  // ракурс 3/4 как на фото hero.webp
  const HERO_YAW = 24;
  const STEPS = [
    P(-12, 2, 0, 1.0, { oy: 0.04 }),   // 01 лицо крупно: окно
    P(166, 4, 0, 0.9),                  // 02 оборот: таблица характеристик
    P(292, 5, 0, 0.9),                  // 03 правый бок: «Быстрый старт»
    P(430, 5, 0, 0.9),                  // 04 левый бок: Pro MAX
    P(360, 12, 56, 0.8, { shadow: 0 }), // 05 крышка: КРУПА и красная точка
  ];

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let spin = 0, spinRamp = 0, dragYaw = 0, vel = 0, drag = false, lastX = 0, lastT = 0, idleAt = 0;
  let extraYaw = 0, extraTarget = 0, modelScale = 1, modelScaleTarget = 1;
  const heroYaw = () => HERO_YAW + spin + dragYaw + ptr.x * 14;

  const scenesEl = document.getElementById("scenes");
  // «Гречка рассыпается»: коробка по прокрутке опрокидывается крышкой влево-вниз
  const spillEl = document.getElementById("spill");
  function spillPose() {
    const r = spillEl.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    const k = smooth(clamp((p - 0.03) / 0.34, 0, 1));
    return P(24 - k * 8, 6, 0, 0.74, { roll: 128 * k, shadow: 1 - k, float: 0.35 });
  }
  function techPose() {
    const r = scenesEl.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    const s = p * STEPS.length;
    const i = Math.min(STEPS.length - 1, Math.floor(s));
    if (i >= STEPS.length - 1) return STEPS[i];
    return lerpPose(STEPS[i], STEPS[i + 1], smooth(clamp((s - i - 0.6) / 0.4, 0, 1)));
  }

  function poseFor(key) {
    if (reduce) {
      const f = { hero: isMobile ? 0.84 : 0.8, pain: 0.82, tech: 0.86, cfg: 0.8, final: 0.8 }[key] || 0.8;
      return P(HERO_YAW, 8, 0, f);
    }
    switch (key) {
      case "hero": return P(heroYaw(), 9 + ptr.y * 6, 0, isMobile ? 0.84 : 0.8, { float: 1 });
      case "pain": return P(-8 + ptr.x * 8, 4 + ptr.y * 3, 0, 0.84);
      case "tech": { const t = techPose(); return isMobile ? Object.assign({}, t, { fill: t.fill * 0.86 }) : t; }
      case "spill": return spillPose();
      case "cfg": return P(20 + Math.sin(time * 0.45) * 9, 7, 0, 0.8 * modelScale);
      case "final": return P(heroYaw(), 9, 0, 0.8, { float: 1 });
    }
    return P(HERO_YAW, 8, 0, 0.8);
  }

  /* ---------- Якоря ---------- */
  const anchors = [...document.querySelectorAll("[data-anchor]")].map(el => ({ el, key: el.dataset.anchor }));
  let vw = 1, vh = 1;
  function resize() {
    vw = canvas.clientWidth || innerWidth;
    vh = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  function target() {
    const list = anchors.map(a => {
      const r = a.el.getBoundingClientRect();
      const h = Math.min(r.height, r.width * 1.5);
      return { a, r, h, cx: r.left + r.width / 2, cy: r.top + r.height / 2, d: (r.top + r.height / 2 - vh / 2) / vh };
    });
    let i = 0;
    while (i < list.length - 1 && list[i + 1].d <= 0) i++;
    const A = list[i], B = list[i + 1];
    let t = 0;
    if (B && A.d <= 0) {
      const gap = B.d - A.d;
      // близкие якоря: коробка перелетает; далёкие: уезжает вместе со своим блоком,
      // а у следующего появляется, когда прежний якорь целиком ушёл за верх экрана
      t = gap < 1.4 ? smooth(clamp(-A.d / gap, 0, 1)) : (A.r.bottom < 0 ? 1 : 0);
    }
    const pa = poseFor(A.a.key);
    if (!B || t === 0) return { pose: pa, cx: A.cx, cy: A.cy, h: A.h, key: A.a.key };
    const pb = poseFor(B.a.key);
    if (t === 1) return { pose: pb, cx: B.cx, cy: B.cy, h: B.h, key: B.a.key };
    pb.yaw += 360 * Math.round((pa.yaw - pb.yaw) / 360);
    return {
      key: "",
      pose: lerpPose(pa, pb, t),
      cx: A.cx + (B.cx - A.cx) * t,
      cy: A.cy + (B.cy - A.cy) * t,
      h: A.h + (B.h - A.h) * t,
    };
  }

  /* ---------- Мышь и палец ---------- */
  addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    ptr.tx = e.clientX / innerWidth - 0.5;
    ptr.ty = e.clientY / innerHeight - 0.5;
  }, { passive: true });
  document.addEventListener("mouseleave", () => { ptr.tx = 0; ptr.ty = 0; });

  const heroEl = document.querySelector('[data-anchor="hero"]');
  if (heroEl && !reduce) {
    heroEl.addEventListener("pointerdown", e => {
      drag = true; lastX = e.clientX; lastT = performance.now(); vel = 0;
      heroEl.setPointerCapture(e.pointerId);
      heroEl.classList.add("is-drag");
    });
    heroEl.addEventListener("pointermove", e => {
      if (!drag) return;
      const now = performance.now(), dx = e.clientX - lastX;
      const d = dx * (isMobile ? 0.7 : 0.45);
      dragYaw += d;
      const inst = d / Math.max(0.008, (now - lastT) / 1000);
      vel = vel * 0.4 + inst * 0.6;
      lastX = e.clientX; lastT = now;
    });
    const up = () => {
      if (!drag) return;
      drag = false; idleAt = time;
      if (performance.now() - lastT > 90) vel = 0;
      vel = clamp(vel, -900, 900);
      heroEl.classList.remove("is-drag");
    };
    heroEl.addEventListener("pointerup", up);
    heroEl.addEventListener("pointercancel", up);
    heroEl.addEventListener("lostpointercapture", up);
  }

  // Конфигуратор: цвет бумаги, «прокрутка» при смене цвета, Ultra чуть больше
  addEventListener("grechka:config", e => {
    const d = e.detail || {};
    if (d.tint) tintTarget.set(d.tint);
    if (d.spin && !reduce) extraTarget += 360;
    if (d.model) modelScaleTarget = d.model === "ultra" ? 1.1 : d.model === "pro" ? 0.94 : 1;
  });

  /* ---------- Цикл ---------- */
  const cur = { yaw: HERO_YAW, tilt: 9, pitch: 0, shadow: 1, float: 0, roll: 0 };
  // «горлышко» коробки на экране — откуда сыплется гречка (читает grains.js)
  const spout = { active: false, roll: 0, x1: 0, y1: 0, x2: 0, y2: 0, dx: 0, dy: 1, h: 0 };
  const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const toScreen = (v, x, y, z) => {
    v.set(x, y, z); box.localToWorld(v); v.project(camera);
    return [(v.x + 1) / 2 * vw, (1 - v.y) / 2 * vh];
  };
  let time = 0, last = performance.now(), hidden = false, ready = false;
  const stats = { frames: 0, slow: 0, avg: 16.7 };

  function frame(now) {
    const ms = now - last;
    last = now;
    stats.frames++; stats.avg += (ms - stats.avg) * 0.05; if (ms > 25) stats.slow++;
    const t0 = performance.now();
    step(Math.min(0.05, ms / 1000), true);
    stats.cpu = performance.now() - t0;
    if (!ready) {
      ready = true;
      requestAnimationFrame(() => { root.classList.remove("no-webgl"); root.classList.add("webgl-ready"); });
    }
    requestAnimationFrame(frame);
  }

  // для проверки: прогнать n кадров по 1/60 с сразу (браузер в фоне режет частоту кадров)
  window.grechkaBox = { stats, cur, spout, tick(n = 60) { for (let i = 0; i < n; i++) step(1 / 60, i === n - 1); } };

  function step(dt, draw) {
    time += dt;

    ptr.x += (ptr.tx - ptr.x) * damp(4, dt);
    ptr.y += (ptr.ty - ptr.y) * damp(4, dt);

    if (!reduce) {
      // автоповорот: полный оборот за 24 с, после перетаскивания плавно возвращается
      const want = drag || time - idleAt < 1.6 ? 0 : 1;
      spinRamp += (want - spinRamp) * damp(want ? 1.2 : 6, dt);
      spin += dt * 15 * spinRamp;
      if (!drag) { dragYaw += vel * dt; vel *= Math.exp(-dt * 2.8); }
    }
    extraYaw += (extraTarget - extraYaw) * damp(3.2, dt);
    modelScale += (modelScaleTarget - modelScale) * damp(5, dt);
    tint.value.lerp(tintTarget, damp(7, dt));

    const T = target();
    const p = T.pose;
    const r = reduce ? 30 : drag ? 14 : 5.5;
    // поворот всегда по кратчайшему пути
    const ty = p.yaw + 360 * Math.round((cur.yaw - p.yaw) / 360);
    cur.yaw += (ty - cur.yaw) * damp(r, dt);
    cur.tilt += (p.tilt - cur.tilt) * damp(r, dt);
    cur.pitch += (p.pitch - cur.pitch) * damp(4.5, dt);
    cur.shadow += (p.shadow - cur.shadow) * damp(5, dt);
    cur.float += (p.float - cur.float) * damp(3, dt);
    cur.roll += (p.roll - cur.roll) * damp(reduce ? 30 : 4, dt);

    const hpx = T.h * p.fill;
    const cx = T.cx + p.ox * T.h;
    const cy = T.cy - p.oy * T.h;
    const off = cy + hpx * 0.75 < 0 || cy - hpx * 0.75 > vh || cx + hpx < 0 || cx - hpx > vw;

    if (!draw) return;
    spout.active = false;
    if (off) {
      if (!hidden) { renderer.clear(); hidden = true; }
    } else {
      hidden = false;
      const upp = visH / vh;
      rig.position.set((cx - vw / 2) * upp, (vh / 2 - cy) * upp, 0);
      rig.scale.setScalar((hpx * upp) / 2);
      rig.rotation.x = cur.tilt * DEG;
      yawG.rotation.y = (cur.yaw + extraYaw) * DEG;
      box.rotation.x = cur.pitch * DEG;
      rollG.rotation.z = cur.roll * DEG;
      const fy = reduce ? 0 : Math.sin(time * (Math.PI * 2 / 6)) * 0.028 * cur.float;
      floatG.position.y = fy + 0.012 * cur.float;
      shadow.material.opacity = cur.shadow * (1 - fy * 6 - 0.1 * cur.float);
      shadow.scale.setScalar(1 + fy * 1.5);
      renderer.render(scene, camera);
      if (T.key === "spill") {
        rig.updateMatrixWorld(true);
        [spout.x1, spout.y1] = toScreen(_v[0], -0.5, 1.0, 0.05);
        [spout.x2, spout.y2] = toScreen(_v[1], 0.5, 1.0, 0.05);
        const [ax, ay] = toScreen(_v[2], 0, 1.0, 0);
        const [bx, by] = toScreen(_v[3], 0, 1.6, 0);
        const l = Math.hypot(bx - ax, by - ay) || 1;
        spout.dx = (bx - ax) / l; spout.dy = (by - ay) / l;
        spout.roll = cur.roll; spout.h = hpx; spout.active = true;
      }
    }
  }
  // Заранее отдаём текстуры видеокарте и собираем шейдеры (без заморозки страницы),
  // чтобы первый кадр появился сразу целиком, без рывка.
  // Картинки и материалы готовятся одновременно; страница при этом не замирает.
  try {
    await Promise.all(pending);
  } catch (e) { return fail(); }
  performance.mark("box:textures");
  await compiled;
  for (const t of [...maps, ...masks]) if (t) renderer.initTexture(t);
  // первый кадр рисуем сразу, не дожидаясь requestAnimationFrame, и проявляем 3D
  step(0, true);
  ready = true;
  root.classList.remove("no-webgl");
  root.classList.add("webgl-ready");
  requestAnimationFrame(frame);
}

main().catch(err => { console.warn("3D отключено:", err); fail(); });
