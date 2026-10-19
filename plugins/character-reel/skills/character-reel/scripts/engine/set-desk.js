// The desk world (2026-10-15): a social media manager's desk at night, seen at the scale of the characters,
// who stand on a giant smartphone lying face-up. Around them: a ring light (the key light), a sticky-note content
// calendar, a giant mug, two far monitors with real Social Champ captures, a night window, drifting like/comment
// glyphs. Background pieces are drawn to canvas and pre-blurred, which gives depth of field without a depth pass
// (a depth pass cannot see the fur shells). Sets its own night light on the shared fur/face uniforms.
import * as THREE from 'three';
import { LIGHT } from './switch.js';

const RING = new THREE.Vector3(-3.6, 3.4, 6.5); // ring light position, front-left of the characters
const NIGHT = {
  key: RING.clone().normalize().toArray(), fill: [0.15, -0.75, 0.6], keyCol: [1.55, 1.45, 1.32], fillCol: [0.12, 0.32, 0.48],
  amb: [0.05, 0.06, 0.13], rimCol: [1.0, 0.42, 0.34], rim: 1.1,
};

function canvasTex(w, h, draw, blur = 0) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (blur) {
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    draw(tmp.getContext('2d'), w, h);
    g.filter = `blur(${blur}px)`; g.drawImage(tmp, 0, 0);
  } else draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function heart(g, x, y, s) {
  g.beginPath(); g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3); g.fill();
}

// a dark-mode feed of generic post cards for the phone screen (our own drawing, no logos, no product UI)
function feedTexture() {
  return canvasTex(1024, 2048, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0e1a2e'); bg.addColorStop(1, '#091222');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const cols = ['#ff7a3d', '#3fb6c9', '#f2c14e', '#a77bff', '#ff5f7e'];
    // the first card is the lunch post: a cartoon wrap and its 900 likes (our own drawing)
    g.fillStyle = 'rgba(255,255,255,0.09)'; rr(g, 60, 70, w - 120, 620, 36); g.fill();
    g.fillStyle = '#3fb6c9'; g.beginPath(); g.arc(130, 140, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = '800 46px "DM Sans", sans-serif'; g.fillText('leo.eats', 190, 132);
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '600 34px "DM Sans", sans-serif'; g.fillText('lunch. obviously.', 190, 176);
    const plate = g.createLinearGradient(90, 200, w - 90, 600); plate.addColorStop(0, '#f6d7a7'); plate.addColorStop(1, '#e8b980');
    g.fillStyle = plate; rr(g, 90, 200, w - 180, 380, 28); g.fill();
    g.save(); g.translate(w / 2, 400); g.rotate(-0.25);
    g.fillStyle = '#e9c27c'; rr(g, -260, -90, 520, 180, 90); g.fill();               // tortilla
    g.fillStyle = '#7cc46a'; rr(g, 150, -70, 110, 140, 60); g.fill();               // lettuce
    g.fillStyle = '#e8573f'; g.beginPath(); g.arc(200, -30, 26, 0, Math.PI * 2); g.arc(205, 35, 24, 0, Math.PI * 2); g.fill(); // tomato
    g.fillStyle = '#d4a85f'; for (let k = -200; k < 140; k += 70) { rr(g, k, -88, 18, 176, 9); g.fill(); } // grill marks
    g.restore();
    g.fillStyle = '#ff5f7e'; heart(g, 120, 610, 46);
    g.fillStyle = '#ffffff'; g.font = '800 54px "DM Sans", sans-serif'; g.fillText('900', 165, 652);
    let y = 760;
    for (let i = 0; y < h - 200; i++) {
      const cardH = i % 2 ? 420 : 560;
      g.fillStyle = 'rgba(255,255,255,0.06)'; rr(g, 60, y, w - 120, cardH, 36); g.fill();
      g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(130, y + 70, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)'; rr(g, 190, y + 46, 260, 20, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; rr(g, 190, y + 80, 170, 16, 8); g.fill();
      const img = g.createLinearGradient(90, y + 130, w - 90, y + cardH - 90);
      img.addColorStop(0, cols[(i + 1) % cols.length] + 'aa'); img.addColorStop(1, cols[(i + 3) % cols.length] + '55');
      g.fillStyle = img; rr(g, 90, y + 130, w - 180, cardH - 230, 24); g.fill();
      g.fillStyle = '#ff5f7e'; heart(g, 120, y + cardH - 76, 40);
      g.fillStyle = 'rgba(255,255,255,0.5)'; rr(g, 170, y + cardH - 66, 90, 18, 9); g.fill();
      y += cardH + 60;
    }
  });
}

function stickyWallTexture() {
  return canvasTex(2048, 1152, (g, w, h) => {
    g.fillStyle = '#1b1530'; g.fillRect(0, 0, w, h);
    const notes = [['MON', 'reel'], ['TUE', 'carousel'], ['WED', 'live Q&A'], ['THU', 'thread'], ['FRI', 'meme?'],
      ['IDEA', 'behind the scenes'], ['POST AT', '12:30?'], ['CLIENT', 'launch'], ['DON\'T', 'post lunch'], ['SAT', 'rest']];
    const cols = ['#ffd45c', '#ff9f6b', '#8fe3b0', '#8ecbff', '#ffb3d1'];
    notes.forEach(([a, b], i) => {
      const x = 120 + (i % 5) * 370, y = 120 + Math.floor(i / 5) * 470, r = ((i * 37) % 9 - 4) * 0.02;
      g.save(); g.translate(x + 150, y + 150); g.rotate(r);
      g.fillStyle = cols[i % cols.length]; g.fillRect(-150, -150, 300, 300);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-150, 120, 300, 30);
      g.fillStyle = '#2a2230'; g.textAlign = 'center';
      g.font = '800 64px "DM Sans", sans-serif'; g.fillText(a, 0, -30);
      g.font = '600 48px "DM Sans", sans-serif'; g.fillText(b, 0, 50);
      g.restore();
    });
  }, 9);
}

function cityTexture() {
  return canvasTex(2048, 1024, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0a0f2c'); sky.addColorStop(1, '#25204a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < w;) {
      const bw = 60 + rnd() * 140, bh = 200 + rnd() * 600;
      g.fillStyle = '#0c0d22'; g.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 20; wy < h - 10; wy += 26) for (let wx = x + 10; wx < x + bw - 12; wx += 22) {
        if (rnd() < 0.35) { g.fillStyle = rnd() < 0.8 ? '#ffcf7a' : '#9fd8ff'; g.fillRect(wx, wy, 10, 14); }
      }
      x += bw + 6;
    }
  }, 6);
}

function glyphTexture(kind) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = kind === 'heart' ? '#ff6b8b' : kind === 'bubble' ? '#7fd3ff' : '#ffd166';
    if (kind === 'heart') heart(g, 64, 30, 70);
    else if (kind === 'bubble') { rr(g, 22, 28, 84, 58, 18); g.fill(); g.beginPath(); g.moveTo(44, 84); g.lineTo(38, 104); g.lineTo(62, 86); g.fill(); }
    else { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 48; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill(); }
  });
}

// the Social Champ wordmark, tinted, on a canvas texture (it ships white on transparent)
function logoTexture(tex, img, { w, h, color, glow = null, blur = 0, scale = 0.8, backing = null }) {
  const c = tex.image, g = c.getContext('2d');
  const tint = document.createElement('canvas'); tint.width = img.width * 4; tint.height = img.height * 4;
  const t = tint.getContext('2d');
  t.drawImage(img, 0, 0, tint.width, tint.height);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, tint.width, tint.height);
  const dw = w * scale, dh = dw * img.height / img.width;
  g.clearRect(0, 0, w, h);
  if (backing) { g.fillStyle = backing; rr(g, 24, 24, w - 48, h - 48, 40); g.fill(); } // a dark acrylic plate behind the tubes
  if (blur) g.filter = `blur(${blur}px)`; // deliberate: the sign sits in the soft background like the rest of the wall
  if (glow) { g.shadowColor = glow; g.shadowBlur = 28; for (let k = 0; k < 2; k++) g.drawImage(tint, (w - dw) / 2, (h - dh) / 2, dw, dh); }
  g.shadowBlur = 0; g.drawImage(tint, (w - dw) / 2, (h - dh) / 2, dw, dh);
  tex.needsUpdate = true; tex.userData.loaded = true;
}

export function buildDeskSet(scene, { screens = [], review = false } = {}) {
  // night light on the shared fur/face uniforms (switch.js presets are left untouched)
  LIGHT.uKey.value.set(...NIGHT.key).normalize();
  LIGHT.uFill.value.set(...NIGHT.fill).normalize();
  LIGHT.uKeyCol.value.setRGB(...NIGHT.keyCol);
  LIGHT.uFillCol.value.setRGB(...NIGHT.fillCol);
  LIGHT.uAmb.value.setRGB(...NIGHT.amb);
  LIGHT.uRimCol.value.setRGB(...NIGHT.rimCol);
  LIGHT.uRimStr.value = NIGHT.rim;

  scene.background = new THREE.Color(0x0a0c20);
  scene.fog = new THREE.Fog(0x0d1030, 14, 46);
  const textures = [];
  const T = (t) => (textures.push(t), t);

  // lights for the standard-material pieces (the man, props)
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.copy(RING); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7a52, 1.6); rim.position.set(5, 4, -6); scene.add(rim);
  const cool = new THREE.DirectionalLight(0x8fc4ff, 1.5); cool.position.set(-6, 3.5, -3); scene.add(cool); // separates the man from the night set
  scene.add(new THREE.HemisphereLight(0x3a4aa0, 0x1f5a7a, 0.9));

  // desk surface
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.55 }));
  desk.rotation.x = -Math.PI / 2; desk.position.y = -0.32; scene.add(desk);

  // the giant phone: graphite body, glowing feed screen as the floor
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.32, 13.2), new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.35, metalness: 0.4 }));
  body.position.y = -0.16; phone.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 12.8), new THREE.MeshBasicMaterial({ map: T(feedTexture()), color: 0xaab6d0, toneMapped: false }));
  screen.rotation.x = -Math.PI / 2; screen.position.y = 0.002; phone.add(screen);
  phone.position.set(0, 0, -3.2); phone.rotation.y = 0.04; scene.add(phone);

  // ring light: an emissive torus front-left, the visible source of the key light
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 12, 64), new THREE.MeshBasicMaterial({ color: 0xfff3e2, toneMapped: false }));
  ring.position.copy(RING).add(new THREE.Vector3(0, 0.6, 0)); ring.lookAt(0, 1.6, 0.5); scene.add(ring);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8), new THREE.MeshStandardMaterial({ color: 0x15151a }));
  stand.position.set(RING.x, 1.65, RING.z); scene.add(stand);

  // giant mug, back right
  const mug = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.25, 3.0, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3eee6, roughness: 0.35, side: THREE.DoubleSide }));
  mug.add(cup);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.45, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.4 }));
  band.position.y = 0.6; mug.add(band);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), new THREE.MeshStandardMaterial({ color: 0x2b170e, roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 1.2; mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.16, 10, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf3eee6, roughness: 0.35 }));
  handle.rotation.z = -Math.PI / 2; handle.position.set(1.35, 0, 0); mug.add(handle);
  mug.position.set(6.2, 1.18, -6.5); scene.add(mug);

  // subtle branding: the wordmark printed on the mug, and a soft neon sign on the back wall (2026-10-15)
  const blank = (w, h) => { const t = T(canvasTex(w, h, () => {})); t.userData.pending = true; return t; };
  const printTex = blank(1024, 310), neonTex = blank(1024, 256);
  const wordmark = new Image();
  wordmark.onload = () => {
    logoTexture(printTex, wordmark, { w: 1024, h: 310, color: '#2a2a33', scale: 0.78 });
    logoTexture(neonTex, wordmark, { w: 1024, h: 256, color: '#ffc9a3', glow: '#ff6a2b', blur: 4, scale: 0.78, backing: 'rgba(12,10,22,0.92)' });
  };
  // a missing logo must fail the render loudly (render.mjs fails on page errors), never hang or ship without it
  wordmark.onerror = () => { throw new Error('Social Champ wordmark failed to load: ./assets/socialchamp-wordmark-white.png'); };
  wordmark.src = './assets/socialchamp-wordmark-white.png';
  const facing = -0.55; // between the wide camera (-0.35) and the over-the-shoulder camera (-0.65), seen from the mug
  const print = new THREE.Mesh(new THREE.CylinderGeometry(1.352, 1.335, 0.5, 40, 1, true, facing - 0.7, 1.4),
    new THREE.MeshStandardMaterial({ map: printTex, transparent: true, roughness: 0.4, depthWrite: false }));
  print.position.set(0, 1.0, 0); mug.add(print); // above the orange band, the part of the mug the shots see
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 1.75),
    new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false, fog: true }));
  neon.position.set(1.6, 8.3, -15.85); scene.add(neon);

  // sticky-note content calendar on the wall behind
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 12.4), new THREE.MeshBasicMaterial({ map: T(stickyWallTexture()), color: 0x6f6888, fog: true }));
  wall.position.set(-3, 6, -16); scene.add(wall);

  // two far monitors with real captures (review mode shows neutral panels instead)
  screens.forEach((src, i) => {
    const mon = new THREE.Group();
    mon.add(new THREE.Mesh(new THREE.BoxGeometry(8.2, 5.0, 0.2), new THREE.MeshStandardMaterial({ color: 0x0e0e12 })));
    const mat = new THREE.MeshBasicMaterial({ color: 0x9aa0b8, toneMapped: false });
    if (review) mat.color.set(0x3a3d4a);
    else {
      const tex = T(canvasTex(1600, 960, () => {}, 0));
      const img = new Image();
      img.onload = () => {
        const c = tex.image, g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
        const s = Math.min(c.width / img.width, c.height / img.height);
        g.filter = 'blur(3px)';
        g.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s);
        tex.needsUpdate = true; tex.userData.loaded = true;
      };
      img.src = src;
      tex.userData.pending = true;
      mat.map = tex;
    }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 4.6), mat); scr.position.z = 0.11; mon.add(scr);
    mon.position.set(i ? 9.5 : -10.5, 5.2, -12 - i * 2); mon.rotation.y = i ? -0.45 : 0.45; scene.add(mon);
  });

  // night window, far back
  const city = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ map: T(cityTexture()), fog: false, color: 0xa0a8d0 }));
  city.position.set(14, 10, -30); city.rotation.y = -0.25; scene.add(city);

  // drifting like / comment / star glyphs in the far background
  const glyphs = [];
  const kinds = ['heart', 'bubble', 'star'].map((k) => T(glyphTexture(k)));
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: kinds[i % 3], transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    const s = 0.35 + rnd() * 0.5; sp.scale.set(s, s, 1);
    const base = new THREE.Vector3((rnd() - 0.5) * 30, rnd() * 10, -8 - rnd() * 14);
    glyphs.push({ sp, base, sp0: 0.15 + rnd() * 0.2, ph: rnd() * 10 }); scene.add(sp);
  }
  // dust specks catching the ring light
  const dustGeo = new THREE.BufferGeometry(); const pts = [];
  for (let i = 0; i < 260; i++) pts.push((rnd() - 0.5) * 16, rnd() * 7, -6 + rnd() * 12);
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe6c4, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  function update(t) {
    glyphs.forEach((g) => {
      const y = (g.base.y + t * g.sp0) % 11;
      g.sp.position.set(g.base.x + Math.sin(t * 0.3 + g.ph) * 0.4, y, g.base.z);
    });
    dust.rotation.y = t * 0.01;
  }
  const ready = () => textures.every((t) => !t.userData.pending || t.userData.loaded);
  return { update, ready, RING };
}
