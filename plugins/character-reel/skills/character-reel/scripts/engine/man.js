// Leo (2026-10-15): the co-star for the desk-world episodes. A standing, faceted low-poly man of our own design:
// short wavy hair, a full short beard, a teal knit sweater with rolled sleeves, sneakers. Dot eyes that cannot go
// uncanny, thick brows that carry the deadpan, a mouth that opens inside the beard on his words.
// Same API and state schema as maya2.js: { root, head, state, update }.
import * as THREE from 'three';

const flat = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

export const FACES = {
  neutral:   { browY: 0.0,    browTilt: 0.0,  lid: 0.15, smile: 0.0,  open: 0.0 },
  worried:   { browY: 0.016,  browTilt: 0.45, lid: 0.05, smile: -0.4, open: 0.08 },
  deadpan:   { browY: -0.012, browTilt: 0.0,  lid: 0.5,  smile: 0.0,  open: 0.0 },
  surprised: { browY: 0.032,  browTilt: 0.1,  lid: 0.0,  smile: 0.0,  open: 0.45 },
  smile:     { browY: 0.01,   browTilt: -0.1, lid: 0.3,  smile: 0.9,  open: 0.0 },
  glare:     { browY: -0.016, browTilt: -0.5, lid: 0.4,  smile: -0.3, open: 0.0 },
};

// [shoulder.x, shoulder.z (outward +), elbow.x] per side; torso lean, head drop
export const POSES = {
  rest:        { L: [0.0, 0.1, -0.2],    R: [0.0, 0.1, -0.2],    lean: 0.0,  drop: 0.0 },
  phone:       { L: [0.0, 0.1, -0.2],    R: [-0.7, -0.35, -1.75], lean: 0.04, drop: 0.12 },
  facepalm:    { L: [-1.15, -0.5, -2.45], R: [-1.15, -0.5, -2.45], lean: 0.14, drop: 0.14 },
  point:       { L: [0.0, 0.1, -0.2],    R: [-1.45, -0.15, -0.1], lean: 0.05, drop: 0.0 },
  shrug:       { L: [-0.25, 0.7, -1.9],  R: [-0.25, 0.7, -1.9],  lean: -0.04, drop: -0.04 },
  armsCrossed: { L: [-0.55, -0.7, -1.95], R: [-0.6, -0.75, -1.85], lean: -0.03, drop: 0.0 },
  slump:       { L: [0.05, 0.05, -0.1],  R: [0.05, 0.05, -0.1],  lean: 0.22, drop: 0.18 },
};

export function createMan() {
  const root = new THREE.Group();
  const skin = flat(0xdba272, 0.7);
  const knit = flat(0x2f8f86, 0.95);
  const denim = flat(0x2a3142, 0.95);
  const hairM = flat(0x2b1a12, 0.65);
  const ink = new THREE.MeshBasicMaterial({ color: 0x140c08 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // legs and sneakers
  [-1, 1].forEach((s) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.84, 6), denim); leg.position.set(0.14 * s, 0.56, 0); root.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.32), flat(0xeeeae2, 0.6)); shoe.position.set(0.14 * s, 0.08, 0.05); root.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.33), flat(0xff6a2b, 0.6)); sole.position.set(0.14 * s, 0.02, 0.05); root.add(sole);
  });

  // torso: a knit sweater, broad at the chest, ribbed hem and collar
  const torso = new THREE.Group(); torso.position.y = 0.96; root.add(torso);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.3, 0.64, 7), knit); body.position.y = 0.34; torso.add(body);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.07, 7), flat(0x277a72, 0.95)); hem.position.y = 0.04; torso.add(hem);
  const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), knit); chest.scale.set(1.45, 0.55, 0.9); chest.position.y = 0.62; torso.add(chest);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 7), flat(0x277a72, 0.95)); collar.position.y = 0.76; torso.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 6), skin); neck.position.y = 0.82; torso.add(neck);

  // arms: shoulder -> elbow chains; rolled sleeves show the forearms
  const arms = {};
  [['L', -1], ['R', 1]].forEach(([k, s]) => {
    const sh = new THREE.Group(); sh.position.set(0.36 * s, 0.62, 0); torso.add(sh);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.32, 6), knit); up.position.y = -0.16; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.07, 6), flat(0x277a72, 0.95)); roll.position.y = -0.03; el.add(roll);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.26, 6), skin); fore.position.y = -0.17; el.add(fore);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.066, 0), skin); hand.scale.set(0.9, 1.15, 0.75); hand.position.y = -0.33; el.add(hand);
    arms[k] = { sh, el, s };
  });
  // a phone in the right hand, shown only in the 'phone' pose
  const phone = new THREE.Group();
  phone.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.19, 0.015), flat(0x1a1a1e, 0.3)));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.17), new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
  glow.position.z = 0.009; phone.add(glow);
  phone.position.set(0, -0.36, 0.07); phone.rotation.set(-1.25, 0, 0); arms.R.el.add(phone);

  // head: faceted skull, broad jaw under the beard, chunky nose, dot eyes, heavy brows
  const head = new THREE.Group(); head.position.y = 1.13; head.scale.setScalar(1.22); torso.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), skin); skull.scale.set(0.95, 1.04, 0.95); head.add(skull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.1, 4), skin); nose.rotation.x = Math.PI / 2 + 0.3; nose.position.set(0, -0.01, 0.245); head.add(nose);
  [-1, 1].forEach((s) => { const ear = new THREE.Mesh(new THREE.IcosahedronGeometry(0.048, 0), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(0.235 * s, 0, 0); head.add(ear); });
  const eyes = [], lids = [], brows = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group(); eye.position.set(0.088 * s, 0.045, 0.215); head.add(eye);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), ink); dot.scale.set(0.85, 1.15, 0.5); eye.add(dot);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), white); glint.position.set(0.009 * s, 0.012, 0.014); eye.add(glint);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.02), skin); lid.position.set(0, 0.07, 0.014); eye.add(lid); lids.push(lid);
    eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.026, 0.024), hairM); brow.position.set(0.088 * s, 0.12, 0.222); head.add(brow); brows.push(brow);
  });
  // beard: a faceted mass along the jaw and chin, a moustache over the mouth, sideburns into the hair
  const beard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), hairM); beard.scale.set(1.02, 0.62, 0.92); beard.position.set(0, -0.14, 0.04); head.add(beard);
  const mous = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.05), hairM); mous.position.set(0, -0.075, 0.228); head.add(mous);
  [-1, 1].forEach((s) => { const burn = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), hairM); burn.position.set(0.215 * s, -0.04, 0.03); head.add(burn); });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 6), new THREE.MeshBasicMaterial({ color: 0x5a1a16 })); mouth.position.set(0, -0.12, 0.236); head.add(mouth);
  // a lower lip in skin tone so the mouth reads against the beard
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.03), skin); lip.position.set(0, -0.15, 0.232); head.add(lip);

  // hair: short and wavy, a faceted cap with a few lumps swept forward
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.262, 1), hairM); cap.scale.set(0.99, 0.82, 1.0); cap.position.set(0, 0.085, -0.03); head.add(cap);
  [[0.0, 0.25, 0.1, 0.1], [0.11, 0.23, 0.07, 0.085], [-0.11, 0.235, 0.06, 0.09], [0.05, 0.27, -0.02, 0.09], [-0.06, 0.26, -0.08, 0.085]].forEach(([x, y, z, r]) => {
    const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), hairM); lump.position.set(x, y, z); lump.rotation.set(x * 7, y * 5, z * 9); head.add(lump);
  });

  const state = { face: 'neutral', prevFace: 'neutral', faceMix: 1, mouthOpen: 0, blink: 0, yaw: 0, pitch: 0, pose: 'rest', prevPose: 'rest', poseMix: 1 };

  function update() {
    const a = FACES[state.prevFace] || FACES.neutral, b = FACES[state.face] || FACES.neutral, k = state.faceMix;
    const f = {}; for (const key in b) f[key] = a[key] + (b[key] - a[key]) * k;
    brows.forEach((br, i) => { const s = i ? 1 : -1; br.position.y = 0.12 + f.browY; br.rotation.z = -f.browTilt * s * 0.6; });
    const lidClose = Math.min(1, f.lid + state.blink * (1 - f.lid));
    lids.forEach((l) => { l.position.y = 0.07 - lidClose * 0.052; l.visible = lidClose > 0.02; });
    const open = Math.max(state.mouthOpen, f.open * 0.6);
    mouth.scale.set(1.3 + 0.5 * f.smile - 0.25 * open, 0.22 + 1.1 * open, 0.4);
    mouth.position.y = -0.12 + 0.008 * f.smile;
    lip.position.y = -0.135 - 0.04 * open;

    const pa = POSES[state.prevPose] || POSES.rest, pb = POSES[state.pose] || POSES.rest;
    const m = state.poseMix, mix = (x, y) => x + (y - x) * m;
    ['L', 'R'].forEach((side) => {
      const { sh, el, s } = arms[side];
      sh.rotation.x = mix(pa[side][0], pb[side][0]);
      sh.rotation.z = mix(pa[side][1], pb[side][1]) * s;
      el.rotation.x = mix(pa[side][2], pb[side][2]);
    });
    phone.visible = (m > 0.5 ? state.pose : state.prevPose) === 'phone';
    torso.rotation.x = mix(pa.lean, pb.lean);
    head.rotation.y = state.yaw;
    head.rotation.x = state.pitch + mix(pa.drop, pb.drop);
  }
  update();
  return { root, head, state, update };
}
