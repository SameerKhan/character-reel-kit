// Switch, built in code, proportions measured off the mascot design sheet
// (1 unit = 180 px of a 512 px pose cell). Fur is shell-rendered: N offset copies
// of each part, each discarding pixels outside a strand, so it is deterministic per frame.
// The face is the body surface itself inside a rounded-rect hood opening, drawn
// near-black with the eyes painted onto it, so it sits recessed behind the fur lip.
import * as THREE from 'three';

export const PALETTE = {
  fur: 0xfa5a00,
  furTip: 0xff8a26,
  furRoot: 0xa82c00,
  face: 0x1a130e,
  eye: '#ffd8a0',
  eyeGlow: '#ff9d3c',
  question: '#f2670a',
};

// face window: centre y, half width, half height (rounded rect, superellipse p=4)
const FACE = { y: 1.8, hw: 0.465, hh: 0.36, p: 2.35 };
const BODY_DEPTH = 0.84;

// ---------- fur ----------
const FUR_VERT = /* glsl */ `
  uniform float uH;
  uniform float uLen;
  uniform float uDroop;
  varying vec3 vBase;
  varying vec3 vN;
  varying vec3 vObjN;
  varying vec3 vWorld;
  #ifdef USE_REST
  attribute vec3 aRest;
  #endif
  uniform vec4 uHole;
  uniform float uHoleP;
  void main() {
    #ifdef USE_REST
    vBase = aRest;
    #else
    vBase = position;
    #endif
    vObjN = normal;
    vN = normalize(mat3(modelMatrix) * normal);
    vec3 p = position + normal * uH * uLen;
    // hood brim: strands just outside the face opening lean in over it, most at the top
    if (uHole.z > 0.0 && position.z > 0.0) {
      vec2 rel = (position.xy - uHole.xy) / uHole.zw;
      vec2 q = abs(rel);
      float e = pow(pow(q.x, uHoleP) + pow(q.y, uHoleP), 1.0 / uHoleP);
      float near = 1.0 - smoothstep(1.0, 1.3, e);
      float topBias = 0.6 + 0.6 * clamp(rel.y, 0.0, 1.0);
      p.xy -= normalize(rel + 1e-4) * uHole.zw * near * uH * uH * 0.08 * topBias;
    }
    vec4 w = modelMatrix * vec4(p, 1.0);
    w.y -= uH * uH * uLen * uDroop;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FUR_FRAG = /* glsl */ `
  uniform float uH;
  uniform float uDensity;
  uniform float uComb;
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform vec3 uRoot;
  uniform vec3 uKey;
  uniform vec3 uFill;
  uniform vec3 uKeyCol;
  uniform vec3 uFillCol;
  uniform vec3 uAmb;
  uniform vec3 uRimCol;
  uniform float uRimStr;
  uniform vec4 uHole;
  uniform float uHoleP;
  uniform float uUseOcc;
  uniform vec4 uSegA[8]; // segment start (xyz) + radius (w), world space
  uniform vec3 uSegB[8]; // segment end
  varying vec3 vBase;
  varying vec3 vN;
  varying vec3 vObjN;
  varying vec3 vWorld;

  // contact shadow from the arms onto the body fur
  float armOcclusion(vec3 p) {
    float occ = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 a = uSegA[i].xyz, b = uSegB[i];
      vec3 ab = b - a;
      float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
      float d = length(p - (a + ab * t)) - uSegA[i].w;
      occ = max(occ, 1.0 - smoothstep(0.0, 0.4, d));
    }
    return occ;
  }

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  vec3 hash3(vec3 p) { return vec3(hash(p), hash(p + 17.31), hash(p + 41.77)); }

  // nearest jittered strand root (Worley), so no lattice planes show through
  float strand(vec3 q, out float r) {
    vec3 c = floor(q), f = fract(q);
    float best = 1e3; vec3 bc = c;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 o = vec3(float(x), float(y), float(z));
      vec3 d = o + hash3(c + o) - f;
      float dd = dot(d, d);
      if (dd < best) { best = dd; bc = c + o; }
    }
    r = hash(bc + 7.0);
    float len = 0.7 + 0.3 * r;
    if (uH > len) return 1e3;
    float rad = 0.6 * pow(1.0 - uH / len, 0.75);
    return sqrt(best) - rad;
  }

  void main() {
    if (uHole.z > 0.0 && vBase.z > 0.0) {
      vec2 q = abs((vBase.xy - uHole.xy) / uHole.zw);
      float edge = 1.0 - 0.05 * uH * (0.3 + hash(floor(vBase * uDensity * 0.1)));
      if (pow(pow(q.x, uHoleP) + pow(q.y, uHoleP), 1.0 / uHoleP) < edge) discard;
    }
    // clumping: strands in one coarse cell lean the same way, forming locks
    // locks: strands in one coarse cell lean together, and all are combed downward
    vec3 lockCell = floor(vBase * uDensity * 0.075);
    vec3 n0 = normalize(vObjN);
    vec3 down = vec3(0.0, -1.0, 0.0) - n0 * (-n0.y);
    float dl = length(down);
    down = dl > 1e-3 ? down / dl : vec3(0.0);
    vec3 radial = vec3(n0.x, 0.0, n0.z);
    float rl = length(radial);
    radial = rl > 1e-3 ? radial / rl : vec3(0.0);
    // near the crown 'down' vanishes; sweep the locks outward there instead
    down = normalize(down * dl + radial * (1.0 - dl) * 0.9 + vec3(1e-4));
    float loft = 1.0 - 0.4 * max(n0.y, 0.0);
    vec3 clump = (hash3(lockCell) - 0.5) * 1.1 * uH - down * uComb * uH * loft;
    vec3 q = vBase * uDensity + clump;
    float lockTone = 0.9 + 0.2 * hash(lockCell + 3.3);
    float r1, r2;
    float d1 = strand(q, r1);
    float d2 = strand(q * 1.37 + 11.0, r2);
    float r = d1 < d2 ? r1 : r2;
    if (uH > 0.0 && min(d1, d2) > 0.0) discard;

    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float key = clamp((dot(N, uKey) + 0.25) / 1.25, 0.0, 1.0);
    key *= key;
    float fill = clamp(dot(N, uFill), 0.0, 1.0);
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.5);
    float ao = mix(0.26, 1.0, pow(uH, 0.75));

    vec3 col = mix(uRoot, uBase, smoothstep(0.0, 0.55, uH));
    col = mix(col, uTip, smoothstep(0.6, 1.0, uH) * 0.5);
    col *= (0.94 + 0.12 * r) * lockTone;
    // underside and lower-body occlusion give the plush its form
    float under = mix(0.7, 1.0, clamp(N.y * 0.6 + 0.6, 0.0, 1.0));
    float contact = uUseOcc > 0.5 ? armOcclusion(vWorld) : 0.0;
    vec3 light = uAmb + uKeyCol * key + uFillCol * fill;
    vec3 lit = col * light * ao * under * (1.0 - 0.62 * contact);
    // backlight: the sun behind the character lights the fur silhouette from within
    float back = clamp(dot(-V, uKey) * 0.5 + 0.5, 0.0, 1.0);
    lit += uRimCol * rim * uRimStr * (0.3 + back) * pow(uH, 0.6) * (1.0 - 0.5 * contact);
    gl_FragColor = vec4(lit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const KEY = new THREE.Vector3(-0.3, 0.6, 0.75).normalize();
const FILL = new THREE.Vector3(0.7, 0.15, 0.5).normalize();

// one set of light uniforms shared by every fur and face material; scenes pick a preset
export const LIGHT = {
  uKey: { value: KEY },
  uFill: { value: FILL },
  uKeyCol: { value: new THREE.Color(1.4, 1.4, 1.4) },
  uFillCol: { value: new THREE.Color(0.14, 0.14, 0.14) },
  uAmb: { value: new THREE.Color(0.24, 0.24, 0.24) },
  uRimCol: { value: new THREE.Color(1.0, 0.6, 0.3) },
  uRimStr: { value: 0.12 },
};

export const LIGHT_PRESETS = {
  // cream studio: soft front-left key (pose sheets, Meta ads)
  studio: { key: [-0.3, 0.6, 0.75], fill: [0.7, 0.15, 0.5], keyCol: [1.4, 1.4, 1.4], fillCol: [0.14, 0.14, 0.14], amb: [0.24, 0.24, 0.24], rimCol: [1.0, 0.6, 0.3], rim: 0.12 },
  // golden hour: low sun behind and to the side, warm front bounce, strong backlit rim (campaign)
  golden: { key: [-0.45, 0.3, -0.84], fill: [0.25, 0.35, 0.9], keyCol: [1.8, 1.05, 0.5], fillCol: [0.85, 0.42, 0.2], amb: [0.24, 0.1, 0.04], rimCol: [1.0, 0.55, 0.22], rim: 1.5 },
};

export function setLighting(name) {
  const p = LIGHT_PRESETS[name];
  LIGHT.uKey.value.set(...p.key).normalize();
  LIGHT.uFill.value.set(...p.fill).normalize();
  LIGHT.uKeyCol.value.setRGB(...p.keyCol);
  LIGHT.uFillCol.value.setRGB(...p.fillCol);
  LIGHT.uAmb.value.setRGB(...p.amb);
  LIGHT.uRimCol.value.setRGB(...p.rimCol);
  LIGHT.uRimStr.value = p.rim;
}

export function furry(geometry, { shells = 64, len = 0.13, density = 64, droop = 0.6, comb = 0, hole = [0, 0, 0, 0], occ = null, rest = false, colors = null } = {}) {
  const group = new THREE.Group();
  const shared = {
    uLen: { value: len },
    uDroop: { value: droop },
    uDensity: { value: density },
    uComb: { value: comb },
    uUseOcc: { value: occ ? 1 : 0 },
    uSegA: { value: occ ? occ.a : Array.from({ length: 8 }, () => new THREE.Vector4(0, -99, 0, 0)) },
    uSegB: { value: occ ? occ.b : Array.from({ length: 8 }, () => new THREE.Vector3(0, -99, 0)) },
    uBase: { value: new THREE.Color(colors ? colors.base : PALETTE.fur) },
    uTip: { value: new THREE.Color(colors ? colors.tip : PALETTE.furTip) },
    uRoot: { value: new THREE.Color(colors ? colors.root : PALETTE.furRoot) },
    ...LIGHT,
    uHole: { value: new THREE.Vector4(...hole) },
    uHoleP: { value: FACE.p },
  };
  for (let i = 0; i < shells; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: FUR_VERT,
      fragmentShader: FUR_FRAG,
      uniforms: { ...shared, uH: { value: i / (shells - 1) } },
      defines: rest ? { USE_REST: '' } : {},
    });
    group.add(new THREE.Mesh(geometry, mat));
  }
  return group;
}

// ---------- body ----------
// silhouette half-widths measured per row, minus ~0.1 of visible fur: [radius, y]
const PROFILE = [
  [0.0, 0.25], [0.3, 0.255], [0.45, 0.29], [0.53, 0.37], [0.6, 0.55], [0.65, 0.78],
  [0.66, 1.0], [0.64, 1.3], [0.62, 1.6], [0.6, 1.85], [0.55, 2.07], [0.49, 2.2],
  [0.4, 2.31], [0.27, 2.4], [0.0, 2.44],
];

const PROFILE_CURVE = new THREE.CatmullRomCurve3(PROFILE.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
const PROFILE_PTS = PROFILE_CURVE.getSpacedPoints(400);

// lathe radius at height y (before the depth squash)
function radiusAt(y) {
  for (let i = 1; i < PROFILE_PTS.length; i++) {
    const a = PROFILE_PTS[i - 1], b = PROFILE_PTS[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.x + (b.x - a.x) * ((y - a.y) / (b.y - a.y));
  }
  return 0;
}

// the hood lip: a furry tube following the face opening over the body surface
function hoodRimGeometry() {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const c = Math.cos(a), sn = Math.sin(a);
    const x = FACE.hw * 1.02 * Math.sign(c) * Math.abs(c) ** (2 / FACE.p);
    const y = FACE.y + FACE.hh * 1.02 * Math.sign(sn) * Math.abs(sn) ** (2 / FACE.p);
    const r = radiusAt(y);
    const z = Math.sqrt(Math.max(r * r - x * x, 0.0001)) * BODY_DEPTH;
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.035, 12, true);
}

function bodyGeometry() {
  const curve = PROFILE_CURVE;
  const pts = curve.getSpacedPoints(90).map((p) => new THREE.Vector2(Math.max(p.x, 0.0001), p.y));
  pts[0].x = 0.0001;
  pts[pts.length - 1].x = 0.0001;
  const g = new THREE.LatheGeometry(pts, 128);
  g.rotateY(Math.PI); // lathe seam to the back
  g.scale(1, 1, BODY_DEPTH);
  g.computeVertexNormals();
  return g;
}

// the face: a slightly inset copy of the body surface, clipped to the hood opening
const FACE_VERT = /* glsl */ `
  uniform vec4 uHole;
  uniform float uHoleP;
  varying vec3 vBase;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vBase = position;
    vN = normalize(mat3(modelMatrix) * normal);
    // recessed in the middle (a window), but flush with the fur line at the rim: seen from the side, a face
    // that stays recessed all the way out leaves a sliver of background between its edge and the fur (2026-10-15)
    vec2 q = abs((position.xy - uHole.xy) / uHole.zw);
    float r = pow(pow(q.x, uHoleP) + pow(q.y, uHoleP), 1.0 / uHoleP);
    // flush only across the window edge (r ~1.0), then back under the skin so the fur roots stay unoccluded
    float inset = mix(mix(0.06, -0.015, smoothstep(0.82, 1.0, r)), 0.03, smoothstep(1.06, 1.16, r));
    vec4 w = modelMatrix * vec4(position - normal * inset, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FACE_FRAG = /* glsl */ `
  uniform vec4 uHole;
  uniform float uHoleP;
  uniform vec3 uColor;
  uniform vec3 uKey;
  uniform sampler2D uEyes;
  uniform float uEyeGain;
  varying vec3 vBase;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    if (vBase.z <= 0.0) discard;
    vec2 rel = (vBase.xy - uHole.xy) / uHole.zw;
    vec2 q = abs(rel);
    if (pow(pow(q.x, uHoleP) + pow(q.y, uHoleP), 1.0 / uHoleP) > 1.22) discard; // runs on under the fur so no gap shows
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(uKey + V);
    float spec = pow(max(dot(N, H), 0.0), 40.0) * 0.025;
    float sheen = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.02;
    // the hood shades the top and edges of the opening
    float shade = mix(0.55, 1.0, smoothstep(1.0, 0.55, length(rel * vec2(0.9, 1.0))));
    shade *= mix(1.0, 0.55, smoothstep(0.15, 1.0, rel.y)); // the hood brim overhangs the top
    vec3 col = uColor * shade + vec3(1.0, 0.85, 0.7) * (spec + sheen) * shade;
    vec4 e = texture2D(uEyes, rel * 0.5 + 0.5);
    col += e.rgb * e.a * uEyeGain;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---------- eyes, drawn per frame on a canvas ----------
const EYE_W = 1024, EYE_H = Math.round(1024 * FACE.hh / FACE.hw);
const EYE_R = 88; // glyph radius in canvas px, ~20% of the window width per eye

function drawEye(ctx, kind, x, y, open, side) {
  const R = EYE_R;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, Math.max(open, 0.06));
  ctx.lineWidth = 50;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (kind) {
    case 'happy':
      ctx.arc(0, R * 0.45, R, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke(); break;
    case 'wink':
      if (side > 0) { ctx.moveTo(R * 0.8, -R * 0.72); ctx.lineTo(-R * 0.7, 0); ctx.lineTo(R * 0.8, R * 0.72); ctx.stroke(); }
      else { ctx.arc(0, R * 0.45, R, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke(); }
      break;
    case 'angry': {
      // slanted lid, a bowl hanging from it, and a pupil inside, inner ends low
      ctx.lineWidth = 36;
      ctx.rotate(-0.32 * side);
      ctx.moveTo(-R * 1.05, -R * 0.2); ctx.lineTo(R * 1.05, -R * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -R * 0.2, R * 0.55, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(-R * 0.1 * side, R * 0.12, R * 0.22, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'o':
      ctx.lineWidth = 46;
      ctx.ellipse(0, 0, R * 0.5, R * 0.62, 0, 0, Math.PI * 2); ctx.stroke(); break;
    case 'flat':
      ctx.moveTo(-R * 0.8, 0); ctx.lineTo(R * 0.8, 0); ctx.stroke(); break;
    case 'heart': {
      const s = R * 0.0219;
      ctx.rotate(0.12 * side); // hearts tilt outward like the sheet
      ctx.scale(1, 0.89);
      ctx.moveTo(0, 62 * s);
      ctx.bezierCurveTo(-92 * s, 5 * s, -72 * s, -80 * s, 0, -30 * s);
      ctx.bezierCurveTo(72 * s, -80 * s, 92 * s, 5 * s, 0, 62 * s);
      ctx.fill(); break;
    }
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.42 : R;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); break;
    case 'dots':
      ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2); ctx.fill(); break;
    case 'sad':
      // drooping outer ends, worried
      ctx.rotate(-0.38 * side);
      ctx.arc(0, -R * 0.55, R, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke(); break;
    case 'sleepy':
      ctx.arc(0, -R * 0.35, R * 0.9, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke(); break;
    case 'moon':
      // filled half-moon, flat edge on top (teaser "Oh really?")
      ctx.moveTo(-R * 0.6, -R * 0.15);
      ctx.lineTo(R * 0.6, -R * 0.15);
      ctx.arc(0, -R * 0.15, R * 0.6, 0, Math.PI);
      ctx.closePath(); ctx.fill(); break;
    default: ctx.arc(0, 0, R * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- limbs ----------
const UP = new THREE.Vector3(0, 1, 0);

function capsule(r, len) {
  const g = new THREE.CapsuleGeometry(r, len, 10, 24);
  g.translate(0, len / 2, 0); // base at origin, grows along +Y
  return g;
}

// one arm: upper + forearm segments placed by 2-bone IK, plus a mitten paw with thumb
function createArm(side) {
  const UPPER = 0.52, FORE = 0.6;
  // one curved tube through shoulder, elbow and wrist, rebuilt each frame; its rest
  // coordinates stay fixed so the fur pattern rides with the arm instead of crawling
  const TUB = 40, RAD = 14, ARM_R = 0.135;
  const curveFor = (a, b, c) => new THREE.CatmullRomCurve3([a, b, c], false, 'centripetal');
  const limbGeo = new THREE.TubeGeometry(curveFor(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, -1.1, 0)), TUB, ARM_R, RAD, false);
  const restArr = new Float32Array(limbGeo.attributes.position.count * 3);
  for (let i = 0; i <= TUB; i++) for (let j = 0; j <= RAD; j++) {
    const v = (i * (RAD + 1) + j) * 3, a = (j / RAD) * Math.PI * 2;
    restArr[v] = Math.cos(a) * ARM_R; restArr[v + 1] = -(i / TUB) * 1.1; restArr[v + 2] = Math.sin(a) * ARM_R;
  }
  limbGeo.setAttribute('aRest', new THREE.BufferAttribute(restArr, 3));
  const limb = furry(limbGeo, { shells: 48, len: 0.1, density: 70, rest: true });
  const paw = new THREE.Group();
  const pawGeo = new THREE.SphereGeometry(1, 40, 28);
  pawGeo.scale(0.17, 0.2, 0.15);
  const palm = furry(pawGeo, { shells: 44, len: 0.08, density: 85 });
  palm.position.y = 0.12;
  const thumb = furry(capsule(0.06, 0.1), { shells: 36, len: 0.06, density: 95 });
  thumb.position.set(-0.11 * side, 0.08, 0.06);
  thumb.rotation.set(0.3, 0, 0.9 * side);
  const finger = furry(capsule(0.06, 0.17), { shells: 36, len: 0.045, density: 100 });
  finger.position.set(0, 0.25, 0.05);
  paw.add(palm, thumb, finger);
  const group = new THREE.Group();
  group.add(limb, paw);

  const S = new THREE.Vector3();
  const joints = { S: new THREE.Vector3(), E: new THREE.Vector3(), T: new THREE.Vector3(), P: new THREE.Vector3() };
  const u = new THREE.Vector3(), n = new THREE.Vector3(), E = new THREE.Vector3();

  function solve(target, hint, pawRoll = 0, fingerOut = 0, hunch = 0, pawDir = null, fingerBend = 0, pawWave = 0) {
    // hunch brings the shoulder forward for gestures made in front of the chest
    S.set((0.52 - 0.1 * hunch) * side, 1.42, 0.18 + 0.1 * hunch);
    const T = target.clone();
    u.subVectors(T, S);
    const d = THREE.MathUtils.clamp(u.length(), Math.abs(UPPER - FORE) + 0.02, UPPER + FORE - 0.02);
    u.normalize();
    T.copy(S).addScaledVector(u, d);
    n.subVectors(hint, S);
    n.addScaledVector(u, -n.dot(u)).normalize();
    const cosA = (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    E.copy(S).addScaledVector(u, UPPER * cosA).addScaledVector(n, UPPER * sinA);

    const du = new THREE.Vector3().subVectors(E, S).normalize();
    const df = new THREE.Vector3().subVectors(T, E).normalize();
    // pull the elbow control point in a little so the bend reads soft, not hinged
    const Es = E.clone().lerp(S.clone().add(T).multiplyScalar(0.5), 0.18);
    const fresh = new THREE.TubeGeometry(curveFor(S, Es, T), TUB, ARM_R, RAD, false);
    limbGeo.attributes.position.array.set(fresh.attributes.position.array);
    limbGeo.attributes.normal.array.set(fresh.attributes.normal.array);
    limbGeo.attributes.position.needsUpdate = true;
    limbGeo.attributes.normal.needsUpdate = true;
    limbGeo.computeBoundingSphere();
    fresh.dispose();
    void du;
    const dp = pawDir ? pawDir.clone().normalize() : df;
    paw.position.copy(T).addScaledVector(df, -0.04);
    paw.quaternion.setFromUnitVectors(UP, dp);
    paw.rotateY(pawRoll);
    paw.rotateZ(pawWave); // waves pivot at the wrist
    finger.visible = fingerOut > 0.02;
    finger.scale.setScalar(Math.max(fingerOut, 0.02));
    finger.rotation.z = fingerBend;
    joints.S.copy(S); joints.E.copy(E); joints.T.copy(T); joints.P.copy(paw.position).addScaledVector(dp, 0.14);
  }
  // in the heart pose the curled fingers belong to the heart outline; keep a smaller palm
  const setHeartPaw = (k) => { thumb.visible = k < 0.5; palm.scale.setScalar(1 - 0.15 * k); };
  // open: a flatter, wider mitten with the thumb spread, for waves
  const setOpenPaw = (k) => {
    palm.scale.set(1 + 0.2 * k, 1 + 0.15 * k, 1 - 0.4 * k);
    thumb.rotation.z = (0.9 + 0.6 * k) * side;
  };
  return { group, solve, side, joints, setHeartPaw, setOpenPaw };
}

// arm poses in body space: wrist target, elbow hint, paw roll, finger out
// x<0 is screen-left (the character's right hand)
// [wrist, elbow hint, paw roll, finger out, hunch, paw direction (null = along forearm), finger bend]
const POSES = {
  // hangs straight down the side; the elbow hint sits behind so any bend hides
  rest: (s) => [[0.8 * s, 0.5 + (s > 0 ? 0.03 : 0), 0.1], [0.9 * s, 1.0, -1.0], 0, 0],
  // elbows flared wide, paws planted on the hip sides, palms in
  hips: (s) => [[0.72 * s, 0.86 + (s > 0 ? 0.03 : 0), 0.14], [1.28 * s, 1.0, -0.1], -1.3 * s, 0, 0, [0.35 * s, -1, 0.25]],
  // diagonal upper arm, soft elbow, hand beside the head
  waveUp: (s) => [[1.0 * s, 2.0, 0.24], [1.32 * s, 1.35, 0.1], 0, 0, 0, [0.12 * s, 1, 0.2]],
  // forearms stacked across the chest, screen-right arm on top
  // diagonal X: one forearm rises across the other, both close to the chest
  crossFront: (s) => [[-0.45 * s, 0.92 + (s > 0 ? 0.28 : 0), 0.54 + (s > 0 ? 0.06 : 0)], [0.85 * s, 0.85, 0.2], 1.5 * s, 0, 0.2, [-s, 0.35 * (s > 0 ? 1 : -1), -0.5]],
  // paws lean out at the top and the fingers curl in to close a heart
  // the hands themselves are the heart outline (see heartHands); wrists meet its lower outer edges
  heart: (s) => [[0.2 * s, 0.95, 0.76], [0.95 * s, 0.55, 0.4], 0, 0, 0.6],
  // finger up at the lower-left corner of the face
  // finger angled in along the jaw to touch the face's lower-left corner, never up across it
  chin: (s) => [[0.34 * s, 1.2, 0.64], [0.95 * s, 0.65, 0.2], 0, 1, 0.3, [-0.2 * s, 1, 0.3], 0.55 * s],
  cheer: (s) => [[1.0 * s, 2.25, 0.25], [1.4 * s, 1.5, 0.0], 0, 0],
  // paws on a keyboard in front of the belly
  typing: (s) => [[0.2 * s, 0.98, 0.98], [0.95 * s, 0.85, 0.45], 0, 0, 0.5, [0.1 * s, 0.25, 1]],
};

// arm pairs a scene can request directly, independent of the eye expression
export const ARM_SETS = { typing: ['typing', 'typing'], rest: ['rest', 'rest'], wave: ['waveUp', 'rest'], cheer: ['cheer', 'cheer'], hips: ['hips', 'hips'], heart: ['heart', 'heart'], cross: ['crossFront', 'crossFront'], chin: ['chin', 'rest'] };

// expression -> [screen-left arm pose, screen-right arm pose]
export const EXPRESSION_ARMS = {
  happy: ['hips', 'hips'],
  wink: ['waveUp', 'rest'],
  angry: ['crossFront', 'crossFront'],
  heart: ['heart', 'heart'],
  o: ['chin', 'rest'],
  star: ['cheer', 'cheer'],
  flat: ['rest', 'rest'],
  dots: ['rest', 'rest'],
  sad: ['rest', 'rest'],
  sleepy: ['rest', 'rest'],
  moon: ['chin', 'rest'],
};

function poseVec(name, side) {
  const [t, h, roll, fin, hunch = 0, dir = null, bend = 0] = POSES[name](side);
  return { t: new THREE.Vector3(...t), h: new THREE.Vector3(...h), roll, fin, hunch, dir: dir && new THREE.Vector3(...dir), bend };
}

// look: 'studio' (pose-sheet plush) or 'campaign' (longer golden-hour shag)
export function createSwitch({ look = 'studio' } = {}) {
  const campaign = look === 'campaign';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hole = [0, FACE.y, FACE.hw, FACE.hh];
  const bodyGeo = bodyGeometry();
  const occ = {
    a: Array.from({ length: 8 }, () => new THREE.Vector4(0, -99, 0, 0)),
    b: Array.from({ length: 8 }, () => new THREE.Vector3(0, -99, 0)),
  };
  body.add(furry(bodyGeo, { hole, shells: campaign ? 84 : 72, len: campaign ? 0.185 : 0.17, density: campaign ? 40 : 46, droop: 0.75, comb: 1.2, occ }));

  const canvas = document.createElement('canvas');
  canvas.width = EYE_W; canvas.height = EYE_H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(bodyGeo, new THREE.ShaderMaterial({
    vertexShader: FACE_VERT,
    fragmentShader: FACE_FRAG,
    uniforms: {
      uHole: { value: new THREE.Vector4(...hole) },
      uHoleP: { value: FACE.p },
      uColor: { value: new THREE.Color(PALETTE.face) },
      uKey: LIGHT.uKey,
      uEyes: { value: tex },
      uEyeGain: { value: 1.15 },
    },
  }));
  body.add(face);
  // the brim is grown from the body fur (see FUR_VERT), no separate lip tube

  const arms = [-1, 1].map((side) => {
    const a = createArm(side);
    body.add(a.group);
    return a;
  });

  // legs with flat-soled feet, a small gap between them
  [-1, 1].forEach((side) => {
    const leg = furry(capsule(0.17, 0.12), { shells: 48, len: 0.1, density: 70 });
    leg.position.set(0.28 * side, 0.12, 0.0);
    root.add(leg);
    const footGeo = new THREE.SphereGeometry(1, 40, 24);
    const p = footGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.45));
    footGeo.scale(0.24, 0.17, 0.3);
    footGeo.computeVertexNormals();
    const foot = furry(footGeo, { shells: 44, len: 0.08, density: 80 });
    foot.position.set(0.29 * side, 0.08, 0.1);
    root.add(foot);
  });

  // heart hands: each hand is a furry finger-tube tracing half a heart, so the gap
  // in the middle (the body, in contact shadow) reads as the heart like the sheet
  const HEART = { y: 1.16, z: 0.84, k: 0.0205 };
  const heartHands = new THREE.Group();
  const heartHalves = [];
  [-1, 1].forEach((side) => {
    const half = new THREE.Group();
    heartHalves.push(half);
    heartHands.add(half);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push(new THREE.Vector3(x * HEART.k * side, y * HEART.k, 0));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.082, 16, false);
    half.add(furry(tube, { shells: 40, len: 0.05, density: 110 }));
    // knuckle bulbs close the tube ends at the notch and the point
    [pts[0], pts[40]].forEach((p) => {
      const b = furry(new THREE.SphereGeometry(0.085, 20, 14), { shells: 36, len: 0.05, density: 110 });
      b.position.copy(p);
      half.add(b);
    });
  });
  heartHands.position.set(0, HEART.y, HEART.z);
  heartHands.visible = false;
  body.add(heartHands);

  // floating "?" for the puzzled pose
  const qc = document.createElement('canvas'); qc.width = qc.height = 256;
  const qx = qc.getContext('2d');
  qx.font = '900 210px "Arial Rounded MT Bold", "Helvetica Neue", sans-serif';
  qx.textAlign = 'center'; qx.textBaseline = 'middle';
  qx.lineJoin = 'round';
  qx.fillStyle = qx.strokeStyle = '#a83200'; // back layer gives it a little depth
  qx.lineWidth = 14; qx.strokeText('?', 136, 146); qx.fillText('?', 136, 146);
  qx.fillStyle = qx.strokeStyle = PALETTE.question;
  qx.lineWidth = 12; qx.strokeText('?', 128, 138); qx.fillText('?', 128, 138);
  const qtex = new THREE.CanvasTexture(qc);
  qtex.colorSpace = THREE.SRGBColorSpace;
  const question = new THREE.Sprite(new THREE.SpriteMaterial({ map: qtex, transparent: true }));
  question.scale.set(0.42, 0.42, 1);
  question.position.set(0.62, 2.42, 0.25);
  question.visible = false;
  body.add(question);

  const state = { expr: 'happy', prev: 'happy', mix: 1, blink: 0, look: [0, 0], poseMix: 1, t: 0 };

  function drawFace() {
    ctx.clearRect(0, 0, EYE_W, EYE_H);
    const swap = state.mix < 1 ? Math.abs(state.mix * 2 - 1) : 1;
    const kind = state.mix < 0.5 ? state.prev : state.expr;
    const open = swap * (1 - state.blink);
    ctx.fillStyle = ctx.strokeStyle = PALETTE.eye;
    ctx.shadowColor = PALETTE.eyeGlow;
    ctx.shadowBlur = 12;
    const [lx, ly] = state.look;
    // eye centres at +/-41% of the half width, slightly below the window centre
    [-1, 1].forEach((side) => drawEye(ctx, kind, EYE_W / 2 + side * EYE_W * 0.205 + lx, EYE_H * 0.55 + ly, open, side));
    tex.needsUpdate = true;
  }

  function poseArms() {
    const k = THREE.MathUtils.smootherstep(state.poseMix, 0, 1);
    // scenes may drive the arms separately (state.arms / state.prevArms name an ARM_SETS entry)
    const from = (state.prevArms && ARM_SETS[state.prevArms]) || EXPRESSION_ARMS[state.prev] || EXPRESSION_ARMS.flat;
    const to = (state.arms && ARM_SETS[state.arms]) || EXPRESSION_ARMS[state.expr] || EXPRESSION_ARMS.flat;
    arms.forEach((arm, i) => {
      const a = poseVec(from[i], arm.side), b = poseVec(to[i], arm.side);
      const ay = a.t.y, by = b.t.y;
      const t = a.t.lerp(b.t, k), h = a.h.lerp(b.h, k);
      // going up: swing out first, rise second, so the arms never sweep across the face
      const goingUp = by > ay + 0.3;
      if (goingUp) t.y = ay + (by - ay) * k * k;
      // a wave is the paw swinging at the wrist with a little forearm follow-through, ~2 Hz
      const waving = to[i] === 'waveUp' ? k : 0;
      const wavePhase = Math.sin(state.t * Math.PI * 2 * 1.9);
      t.x += wavePhase * 0.035 * waving;
      if (from[i] !== to[i]) {
        // swing out around the body instead of cutting through it
        const rising = Math.max(0, Math.max(a.t.y, b.t.y) - 1.7);
        const arc = Math.sin(Math.PI * (goingUp ? Math.sqrt(k) : k)) * (0.06 + 1.1 * rising);
        t.add(new THREE.Vector3(arm.side * 1.0, 0, 0.1).multiplyScalar(arc));
        h.add(new THREE.Vector3(arm.side * 0.5, 0, 0).multiplyScalar(arc));
      }
      const fwd = new THREE.Vector3(0, 1, 0);
      const da = a.dir || fwd, db = b.dir || fwd;
      const dir = a.dir || b.dir ? da.clone().lerp(db, k) : null;
      arm.solve(t, h, THREE.MathUtils.lerp(a.roll, b.roll, k), THREE.MathUtils.lerp(a.fin, b.fin, k),
        THREE.MathUtils.lerp(a.hunch, b.hunch, k), dir, THREE.MathUtils.lerp(a.bend, b.bend, k), wavePhase * 0.5 * arm.side * waving);
      arm.setOpenPaw((from[i] === 'waveUp' ? 1 - k : 0) + (to[i] === 'waveUp' ? k : 0));
    });
    const isHeart = (e, a) => (a ? a === 'heart' : e === 'heart');
    const heartOn = (isHeart(state.expr, state.arms) ? k : 0) + (isHeart(state.prev, state.prevArms) && !isHeart(state.expr, state.arms) ? 1 - k : 0);
    // each half rides on its own paw and curls into place as the hands arrive
    const g = THREE.MathUtils.smoothstep(heartOn, 0.7, 1);
    heartHands.visible = g > 0.01;
    heartHalves.forEach((half, i) => {
      const arm = arms[i];
      const wristFinal = poseVec('heart', arm.side).t.sub(heartHands.position);
      half.position.copy(arm.joints.T).sub(heartHands.position).sub(wristFinal).multiplyScalar(1 - g);
      half.scale.setScalar(Math.max(g, 0.01));
    });
    arms.forEach((arm) => arm.setHeartPaw(heartOn));
    root.updateMatrixWorld(true);
    const w = (v) => body.localToWorld(v.clone());
    arms.forEach((arm, i) => {
      const j = arm.joints, o = i * 4;
      const segs = [[j.S, j.E, 0.2], [j.E, j.T, 0.19], [j.T, j.P, 0.2]];
      if (heartOn > 0.5) segs[2] = [new THREE.Vector3(0.15 * arm.side, HEART.y + 0.12, HEART.z), new THREE.Vector3(0.0, HEART.y - 0.2, HEART.z), 0.14];
      occ.a[o + 3].set(0, -99, 0, 0); // spare slot
      segs.forEach(([a, b, r], k) => {
        const A = w(a), B = w(b);
        occ.a[o + k].set(A.x, A.y, A.z, r);
        occ.b[o + k].copy(B);
      });
    });
    const qk = state.expr === 'o' ? THREE.MathUtils.smoothstep(state.poseMix, 0.3, 1)
      : state.prev === 'o' ? 1 - THREE.MathUtils.smoothstep(state.poseMix, 0, 0.6) : 0;
    question.visible = qk > 0.01;
    question.scale.setScalar(0.5 * qk);
    question.position.y = 2.42 + Math.sin(state.t * 3) * 0.04;
  }

  function update() { drawFace(); poseArms(); }

  return { root, body, arms, state, update, drawFace };
}
