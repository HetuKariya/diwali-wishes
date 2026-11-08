import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const GRAVITY = 3.2;
const CAM_Z = 14;
const FOV = 50;
const RANGOLI_TILT = -1.0; // radians, rangoli lies back like a floor
const SKY_W = 2048;
const SKY_H = 384;

const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const PALETTE = [0xffc233, 0xff5a1f, 0xff2e63, 0xc77dff, 0x4cc9f0, 0xfff1a8, 0x7cfc9a, 0xff8ad8].map(
  (c) => new THREE.Color(c)
);
const pick = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
const GOLD = new THREE.Color(1.0, 0.72, 0.25);
const HEART = new THREE.Color(1.0, 0.24, 0.49);
const WHITE = new THREE.Color(1, 1, 1);
const TRAIL = new THREE.Color(2.2, 1.3, 0.5);
const HEAD = new THREE.Color(3.0, 2.4, 1.2);
const SPARK = new THREE.Color(2.0, 0.9, 0.25);

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.2, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.12)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSkyTexture() {
  const W = 1024;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#06010f");
  grad.addColorStop(0.45, "#1a0538");
  grad.addColorStop(0.78, "#3c1058");
  grad.addColorStop(1, "#6b1d52");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const blob = (x, y, r, rgb, a) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${rgb},${a})`);
    rg.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(220, 300, 380, "120,40,160", 0.35);
  blob(800, 200, 330, "40,60,170", 0.3);
  blob(600, 620, 420, "190,50,110", 0.25);
  blob(120, 820, 300, "255,120,40", 0.18);
  blob(900, 860, 300, "255,90,60", 0.16);
  const hg = g.createLinearGradient(0, H * 0.75, 0, H);
  hg.addColorStop(0, "rgba(255,120,40,0)");
  hg.addColorStop(1, "rgba(255,140,50,0.35)");
  g.fillStyle = hg;
  g.fillRect(0, H * 0.75, W, H * 0.25);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeMoonTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  g.save();
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  g.clip();
  const base = g.createRadialGradient(S * 0.4, S * 0.38, S * 0.05, S / 2, S / 2, S / 2);
  base.addColorStop(0, "#fff8e4");
  base.addColorStop(1, "#d8c79c");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = "rgba(150,130,100,0.16)";
    g.beginPath();
    g.arc(S * (0.2 + Math.random() * 0.6), S * (0.2 + Math.random() * 0.6), 20 + Math.random() * 60, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 90; i++) {
    const x = S * (0.1 + Math.random() * 0.8);
    const y = S * (0.1 + Math.random() * 0.8);
    const r = 3 + Math.pow(Math.random(), 2) * 26;
    g.fillStyle = "rgba(120,100,70,0.16)";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,250,230,0.25)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x - r * 0.12, y - r * 0.12, r, 0, Math.PI * 2);
    g.stroke();
  }
  const limb = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
  limb.addColorStop(0, "rgba(40,25,10,0)");
  limb.addColorStop(1, "rgba(40,25,10,0.45)");
  g.fillStyle = limb;
  g.fillRect(0, 0, S, S);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeSkylineTexture() {
  const c = document.createElement("canvas");
  c.width = SKY_W;
  c.height = SKY_H;
  const g = c.getContext("2d");
  const base = SKY_H;
  g.fillStyle = "#0a0316";
  let x = -40;
  while (x < SKY_W) {
    const w = 60 + Math.random() * 110;
    const h = 50 + Math.random() * 110;
    g.fillRect(x, base - h, w, h);
    const r = Math.random();
    if (r < 0.4) {
      g.beginPath();
      g.arc(x + w / 2, base - h, w * 0.42, Math.PI, 0);
      g.fill();
      g.fillRect(x + w / 2 - 2, base - h - w * 0.42 - 26, 4, 26);
    } else if (r < 0.7) {
      g.beginPath();
      g.moveTo(x + w * 0.1, base - h);
      g.lineTo(x + w / 2, base - h - w * 0.9);
      g.lineTo(x + w * 0.9, base - h);
      g.fill();
    } else {
      for (let k = 0; k < w; k += 14) g.fillRect(x + k, base - h - 10, 8, 10);
    }
    x += w * (0.7 + Math.random() * 0.4);
  }
  g.fillRect(0, base - 22, SKY_W, 22);
  // windows only on the silhouette
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "#ffc857";
  for (let i = 0; i < 320; i++) {
    g.globalAlpha = 0.45 + Math.random() * 0.55;
    g.fillRect(Math.random() * SKY_W, base - 12 - Math.random() * 170, 4, 6);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  // fairy lights
  const cols = ["#ffd27a", "#ff8a5c", "#fff1b8", "#ff6fa5"];
  for (let seg = 0; seg < SKY_W; seg += 320) {
    for (let k = 0; k <= 320; k += 16) {
      const tt = k / 320;
      const px = seg + k;
      const py = base - 70 + Math.sin(tt * Math.PI) * 38;
      const rg = g.createRadialGradient(px, py, 0, px, py, 7);
      rg.addColorStop(0, cols[(k / 16) % cols.length]);
      rg.addColorStop(1, "rgba(255,200,100,0)");
      g.fillStyle = rg;
      g.fillRect(px - 7, py - 7, 14, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeClayTextures() {
  const S = 256;
  const build = (baseCol, blotchA, blotchB, grainAmp) => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    g.fillStyle = baseCol;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() < 0.5 ? blotchA : blotchB;
      g.beginPath();
      g.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 14, 0, Math.PI * 2);
      g.fill();
    }
    const img = g.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * grainAmp;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 2);
    t.anisotropy = 4;
    return t;
  };
  const color = build("#b34a2b", "rgba(80,20,5,0.06)", "rgba(255,160,110,0.06)", 26);
  color.colorSpace = THREE.SRGBColorSpace;
  const bump = build("#808080", "rgba(0,0,0,0.08)", "rgba(255,255,255,0.08)", 70);
  return { color, bump };
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const pointVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPx;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}`;

const twinkleVert = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uPx;
uniform float uTime;
varying vec3 vColor;
void main() {
  float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aPhase * 2.0) + aPhase * 40.0);
  vColor = aColor * tw;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}`;

const pointFrag = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * 9.0);
  float halo = pow(1.0 - d, 2.5) * 0.5;
  float a = core + halo;
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

const flameVert = /* glsl */ `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vH;
void main() {
  vec3 p = position;
  float h = (p.y + 1.0) * 0.5;
  vH = h;
  float taper = 1.0 - 0.72 * pow(h, 1.4);
  p.xz *= taper;
  p.y += h * h * 0.35;
  float w = h * h;
  p.x += sin(uTime * 9.0 + h * 5.0) * 0.12 * w + sin(uTime * 15.0 + h * 9.0) * 0.05 * w;
  p.z += cos(uTime * 8.0 + h * 4.0) * 0.10 * w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const flameFrag = /* glsl */ `
uniform vec3 uBottom;
uniform vec3 uMid;
uniform vec3 uTop;
uniform float uAlpha;
uniform float uFlick;
varying vec3 vNormal;
varying vec3 vView;
varying float vH;
void main() {
  float f = pow(clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 1.3);
  vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.35, vH));
  col = mix(col, uTop, smoothstep(0.3, 0.95, vH));
  float a = f * uAlpha * (1.0 - smoothstep(0.55, 1.0, vH) * 0.6) * uFlick;
  gl_FragColor = vec4(col * a, 1.0);
}`;

const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float rnd(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
    }
    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d);
      vec2 off = d * r * 0.006;
      vec4 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col.a = 1.0;
      float vig = 1.0 - smoothstep(0.25, 0.85, r);
      col.rgb *= mix(0.55, 1.0, vig);
      col.rgb += (rnd(vUv * 1000.0) - 0.5) * 0.025;
      gl_FragColor = col;
    }`,
};

const makeFlameMaterial = (bottom, mid, top, alpha) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlick: { value: 1 },
      uAlpha: { value: alpha },
      uBottom: { value: new THREE.Vector3(...bottom) },
      uMid: { value: new THREE.Vector3(...mid) },
      uTop: { value: new THREE.Vector3(...top) },
    },
    vertexShader: flameVert,
    fragmentShader: flameFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

const disposeMaterial = (m) => {
  for (const k in m) {
    const v = m[k];
    if (v && v.isTexture) v.dispose();
  }
  m.dispose();
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Scene3D() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const small = Math.min(width, height) < 700;
    const MAX = small ? 6000 : 12000;
    const pr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);

    // ---------- Renderer ----------
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch (e) {
      console.warn("WebGL not available, 3D scene skipped.", e);
      return;
    }
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 400);
    camera.position.set(0, 0, CAM_Z + 5);

    const visible = (z) => {
      const h = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAM_Z - z);
      return { h, w: h * camera.aspect };
    };

    // ---------- Environment (PBR reflections) ----------
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.35;
    if (roomEnv.dispose) roomEnv.dispose();

    const skyTex = makeSkyTexture();
    scene.background = skyTex;
    const glowTex = makeGlowTexture();

    // ---------- Post-processing ----------
    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: small ? 0 : 4,
    });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.6, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const finishPass = new ShaderPass(FinishShader);
    composer.addPass(finishPass);

    // ---------- Point shader materials ----------
    const pxUniform = { value: 1 };
    const timeUniform = { value: 0 };
    const setPx = () => {
      pxUniform.value = (height * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    };
    setPx();

    const fwMat = new THREE.ShaderMaterial({
      uniforms: { uPx: pxUniform },
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const twinkleMat = new THREE.ShaderMaterial({
      uniforms: { uPx: pxUniform, uTime: timeUniform },
      vertexShader: twinkleVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // ---------- Lights ----------
    scene.add(new THREE.HemisphereLight(0x7a5cff, 0x2a1020, 1.6));
    const rimLight = new THREE.DirectionalLight(0x9a7bff, 1.4);
    rimLight.position.set(-3, 4, -2);
    scene.add(rimLight);
    const burstLight = new THREE.PointLight(0xffffff, 0, 0, 2);
    scene.add(burstLight);

    // ---------- Stars ----------
    const STAR_N = small ? 900 : 1800;
    const sPos = new Float32Array(STAR_N * 3);
    const sSize = new Float32Array(STAR_N);
    const sPhase = new Float32Array(STAR_N);
    const sCol = new Float32Array(STAR_N * 3);
    const tmpC = new THREE.Color();
    for (let i = 0; i < STAR_N; i++) {
      sPos[i * 3] = rand(-80, 80);
      sPos[i * 3 + 1] = rand(-50, 50);
      sPos[i * 3 + 2] = rand(-110, -20);
      sSize[i] = 0.05 + Math.pow(Math.random(), 4) * 0.5;
      sPhase[i] = Math.random();
      tmpC.set(Math.random() < 0.3 ? 0xffe2a0 : Math.random() < 0.5 ? 0xbcd2ff : 0xffffff);
      tmpC.multiplyScalar(rand(0.5, 1.4));
      sCol[i * 3] = tmpC.r;
      sCol[i * 3 + 1] = tmpC.g;
      sCol[i * 3 + 2] = tmpC.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(sSize, 1));
    starGeo.setAttribute("aPhase", new THREE.BufferAttribute(sPhase, 1));
    starGeo.setAttribute("aColor", new THREE.BufferAttribute(sCol, 3));
    const stars = new THREE.Points(starGeo, twinkleMat);
    stars.frustumCulled = false;
    scene.add(stars);

    // ---------- Moon ----------
    const moonTex = makeMoonTexture();
    const moonMat = new THREE.MeshBasicMaterial({ map: moonTex });
    moonMat.color.setRGB(1.5, 1.4, 1.2);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1, 64), moonMat);
    moon.scale.setScalar(3);
    scene.add(moon);
    const moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex, color: 0xffe2a0, transparent: true, opacity: 0.35,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    moonGlow.scale.setScalar(16);
    scene.add(moonGlow);

    // ---------- Skyline ----------
    const skylineTex = makeSkylineTexture();
    const skyline = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: skylineTex, transparent: true, depthWrite: false })
    );
    scene.add(skyline);

    // ---------- Embers ----------
    const EMBER_N = small ? 140 : 260;
    const ePos = new Float32Array(EMBER_N * 3);
    const eSize = new Float32Array(EMBER_N);
    const ePhase = new Float32Array(EMBER_N);
    const eCol = new Float32Array(EMBER_N * 3);
    const eSpeed = new Float32Array(EMBER_N);
    for (let i = 0; i < EMBER_N; i++) {
      ePos[i * 3] = rand(-16, 16);
      ePos[i * 3 + 1] = rand(-9, 9);
      ePos[i * 3 + 2] = rand(-8, 3);
      eSize[i] = rand(0.04, 0.14);
      ePhase[i] = Math.random();
      const k = rand(0.5, 1);
      eCol[i * 3] = 1.6 * k;
      eCol[i * 3 + 1] = 0.7 * k;
      eCol[i * 3 + 2] = 0.2 * k;
      eSpeed[i] = rand(0.25, 0.9);
    }
    const emberGeo = new THREE.BufferGeometry();
    const emberPosAttr = new THREE.BufferAttribute(ePos, 3);
    emberPosAttr.setUsage(THREE.DynamicDrawUsage);
    emberGeo.setAttribute("position", emberPosAttr);
    emberGeo.setAttribute("aSize", new THREE.BufferAttribute(eSize, 1));
    emberGeo.setAttribute("aPhase", new THREE.BufferAttribute(ePhase, 1));
    emberGeo.setAttribute("aColor", new THREE.BufferAttribute(eCol, 3));
    const embers = new THREE.Points(emberGeo, twinkleMat);
    embers.frustumCulled = false;
    scene.add(embers);

    // ---------- Fireworks particle pool ----------
    const pPos = new Float32Array(MAX * 3);
    const pCol = new Float32Array(MAX * 3);
    const pSz = new Float32Array(MAX);
    const pBase = new Float32Array(MAX * 3);
    const pVel = new Float32Array(MAX * 3);
    const pLife = new Float32Array(MAX);
    const pDecay = new Float32Array(MAX);
    const pDrag = new Float32Array(MAX);
    const pSize0 = new Float32Array(MAX);
    const pGrav = new Float32Array(MAX);
    const pFlag = new Uint8Array(MAX); // 1 = crackle, 2 = glitter
    let head = 0;

    const fwGeo = new THREE.BufferGeometry();
    const fwPosAttr = new THREE.BufferAttribute(pPos, 3);
    const fwColAttr = new THREE.BufferAttribute(pCol, 3);
    const fwSzAttr = new THREE.BufferAttribute(pSz, 1);
    fwPosAttr.setUsage(THREE.DynamicDrawUsage);
    fwColAttr.setUsage(THREE.DynamicDrawUsage);
    fwSzAttr.setUsage(THREE.DynamicDrawUsage);
    fwGeo.setAttribute("position", fwPosAttr);
    fwGeo.setAttribute("aColor", fwColAttr);
    fwGeo.setAttribute("aSize", fwSzAttr);
    const fireworks = new THREE.Points(fwGeo, fwMat);
    fireworks.frustumCulled = false;
    scene.add(fireworks);

    const emit = (x, y, z, vx, vy, vz, col, decay, drag, size, flag = 0, grav = 1) => {
      const i = head;
      head = (head + 1) % MAX;
      const j = i * 3;
      pPos[j] = x; pPos[j + 1] = y; pPos[j + 2] = z;
      pVel[j] = vx; pVel[j + 1] = vy; pVel[j + 2] = vz;
      pBase[j] = col.r; pBase[j + 1] = col.g; pBase[j + 2] = col.b;
      pLife[i] = 1;
      pDecay[i] = decay;
      pDrag[i] = drag;
      pSize0[i] = size;
      pFlag[i] = flag;
      pGrav[i] = grav;
    };

    const randDir = () => {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return [s * Math.cos(a), u, s * Math.sin(a)];
    };

    // flash sprites (pool)
    const flashes = [];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      sp.visible = false;
      scene.add(sp);
      flashes.push({ sp, life: 0 });
    }
    let flashIdx = 0;
    const flash = (x, y, z, col) => {
      const f = flashes[flashIdx];
      flashIdx = (flashIdx + 1) % flashes.length;
      f.sp.position.set(x, y, z);
      f.sp.material.color.copy(col).multiplyScalar(2);
      f.sp.visible = true;
      f.life = 1;
      burstLight.color.copy(col);
      burstLight.position.set(x, y, z + 2);
      burstLight.intensity = 160;
    };

    const burst = (x, y, z) => {
      const c1 = pick();
      const c2 = pick();
      const type = Math.floor(Math.random() * 6);
      flash(x, y, z, c1);

      if (type === 0 || type === 4) {
        // peony (4 = with crackle)
        for (let i = 0; i < 320; i++) {
          const [dx, dy, dz] = randDir();
          const sp = 8 * (0.88 + Math.random() * 0.12);
          emit(x, y, z, dx * sp, dy * sp, dz * sp, i % 4 === 0 ? c2 : c1,
            rand(0.45, 0.6), 0.965, rand(0.16, 0.26), type === 4 ? 1 : 0, 1);
        }
      } else if (type === 1) {
        // ring in a random plane
        const [ax, ay, az] = randDir();
        let ux = -az, uy = 0, uz = ax;
        let ul = Math.hypot(ux, uy, uz);
        if (ul < 1e-4) { ux = 1; uy = 0; uz = 0; ul = 1; }
        ux /= ul; uy /= ul; uz /= ul;
        const vx = ay * uz;
        const vy = az * ux - ax * uz;
        const vz = -ay * ux;
        for (let i = 0; i < 180; i++) {
          const a = (i / 180) * Math.PI * 2;
          const ca = Math.cos(a) * 8;
          const sa = Math.sin(a) * 8;
          emit(x, y, z, ux * ca + vx * sa, uy * ca + vy * sa, uz * ca + vz * sa,
            c1, rand(0.5, 0.6), 0.965, 0.2, 0, 1);
        }
        for (let i = 0; i < 60; i++) {
          const [dx, dy, dz] = randDir();
          emit(x, y, z, dx * 2.5, dy * 2.5, dz * 2.5, c2, 0.8, 0.95, 0.15, 0, 1);
        }
      } else if (type === 2) {
        // double shell
        for (let i = 0; i < 120; i++) {
          const [dx, dy, dz] = randDir();
          emit(x, y, z, dx * 4.5, dy * 4.5, dz * 4.5, c2, rand(0.5, 0.65), 0.965, 0.2, 0, 1);
        }
        for (let i = 0; i < 220; i++) {
          const [dx, dy, dz] = randDir();
          emit(x, y, z, dx * 8.5, dy * 8.5, dz * 8.5, c1, rand(0.45, 0.6), 0.965, 0.2, 0, 1);
        }
      } else if (type === 3) {
        // golden willow
        for (let i = 0; i < 260; i++) {
          const [dx, dy, dz] = randDir();
          const sp = rand(3, 8);
          emit(x, y, z, dx * sp, dy * sp, dz * sp, GOLD, rand(0.22, 0.32), 0.978, 0.18, 2, 0.55);
        }
      } else {
        // heart
        for (let i = 0; i < 200; i++) {
          const t = (i / 200) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          emit(x, y, z, (hx / 16) * 7, ((hy + 2.5) / 16) * 7, rand(-0.3, 0.3),
            i % 5 === 0 ? GOLD : HEART, rand(0.45, 0.55), 0.968, 0.22, 0, 0.2);
        }
      }
    };

    // ---------- Rockets ----------
    const rockets = [];
    const launch = (x, targetY, z) => {
      const { h } = visible(z);
      rockets.push({ x, y: -h * 0.55, z, vy: rand(12, 15), targetY, ph: rand(0, 6.28) });
    };
    const launchRandom = () => {
      const z = rand(-9, -3);
      const { h, w } = visible(z);
      launch((Math.random() - 0.5) * w * 0.95, rand(-0.02, 0.4) * h, z);
    };

    // ---------- Diya ----------
    const diya = new THREE.Group();
    const clay = makeClayTextures();
    const bowlProfile = [
      [0, -0.45], [0.35, -0.44], [0.8, -0.3], [1.15, -0.05], [1.35, 0.2],
      [1.4, 0.28], [1.25, 0.3], [1.1, 0.2], [0.75, 0.0], [0, -0.05],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const bowl = new THREE.Mesh(
      new THREE.LatheGeometry(bowlProfile, 96),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, map: clay.color, bumpMap: clay.bump, bumpScale: 1.2,
        roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide,
      })
    );
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.28 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.05, 16, 96), goldMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.27;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 12, 96), goldMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.2;
    // gold painted dots around the body
    const dotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 12, 12), goldMat, 28);
    const dd = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      dd.position.set(Math.cos(a) * 1.24, 0.05, Math.sin(a) * 1.24);
      dd.updateMatrix();
      dotMesh.setMatrixAt(i, dd.matrix);
    }
    dotMesh.instanceMatrix.needsUpdate = true;
    // brass plate
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.08, 96), goldMat);
    plate.position.y = -0.5;
    const plateRim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 12, 96), goldMat);
    plateRim.rotation.x = Math.PI / 2;
    plateRim.position.y = -0.46;
    // oil
    const oil = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0x6b3a05, emissive: 0xff8a1f, emissiveIntensity: 0.6,
        roughness: 0.05, metalness: 0, clearcoat: 1,
      })
    );
    oil.rotation.x = -Math.PI / 2;
    oil.position.y = 0.12;
    // wick
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.055, 0.32, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 1 })
    );
    wick.position.y = 0.26;
    const wickTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.8, 0.1) })
    );
    wickTip.position.y = 0.43;

    // flame
    const flame = new THREE.Group();
    flame.position.y = 0.42;
    flame.rotation.x = -(Math.PI / 2 + RANGOLI_TILT); // keep the flame vertical in world space
    const flameGeo = new THREE.SphereGeometry(1, 32, 32);
    const outerMat = makeFlameMaterial([0.15, 0.3, 1.2], [2.4, 1.1, 0.15], [1.6, 0.25, 0.02], 0.9);
    const innerMat = makeFlameMaterial([1.0, 1.2, 2.2], [3.2, 2.6, 1.2], [3.0, 1.6, 0.4], 1.0);
    const flameMats = [outerMat, innerMat];
    const flameOuter = new THREE.Mesh(flameGeo, outerMat);
    flameOuter.scale.set(0.2, 0.5, 0.2);
    flameOuter.position.y = 0.52;
    const flameInner = new THREE.Mesh(flameGeo, innerMat);
    flameInner.scale.set(0.11, 0.3, 0.11);
    flameInner.position.y = 0.36;
    const flameGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex, color: 0xff9d2e, transparent: true, opacity: 0.55,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    flameGlow.scale.set(3.6, 3.6, 1);
    flameGlow.position.y = 0.55;
    flame.add(flameOuter, flameInner, flameGlow);

    const flameLight = new THREE.PointLight(0xffa040, 38, 0, 2);
    flameLight.position.y = 1;
    const fillLight = new THREE.PointLight(0xffa060, 18, 0, 2);
    fillLight.position.set(0, 1.5, 4.5);

    diya.add(plate, plateRim, bowl, rim, band, dotMesh, oil, wick, wickTip, flame, flameLight, fillLight);
    diya.rotation.x = Math.PI / 2 + RANGOLI_TILT; // sits flat on the rangoli plane
    scene.add(diya);

    // ---------- Rangoli ----------
    const rangoli = new THREE.Group();
    rangoli.rotation.x = RANGOLI_TILT;
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 96),
      new THREE.MeshStandardMaterial({ color: 0x240838, roughness: 0.9 })
    );
    base.position.z = -0.02;
    rangoli.add(base);

    const makePetal = (w, len) => {
      const s = new THREE.Shape();
      s.moveTo(0, -len);
      s.quadraticCurveTo(w, -len * 0.2, 0, len);
      s.quadraticCurveTo(-w, -len * 0.2, 0, -len);
      return new THREE.ShapeGeometry(s, 12);
    };
    const bigPetal = makePetal(0.16, 0.4);
    const smallPetal = makePetal(0.1, 0.26);
    const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const col = (hex, k = 0.85) => new THREE.Color(hex).multiplyScalar(k);
    const dummy = new THREE.Object3D();
    const spinners = [];
    [
      { r: 1.95, n: 14, geo: smallPetal, cols: [0xffb300, 0xff6a00], z: 0.01 },
      { r: 2.6, n: 20, geo: bigPetal, cols: [0xff2e63, 0xff6a00, 0xffd86b], z: 0.015 },
      { r: 3.3, n: 26, geo: smallPetal, cols: [0xc77dff, 0xff2e8a, 0xffd86b], z: 0.02 },
      { r: 4.0, n: 32, geo: bigPetal, cols: [0xffd86b, 0xff9d00, 0xff5a1f], z: 0.025 },
    ].forEach((ring, k) => {
      const g = new THREE.Group();
      const mesh = new THREE.InstancedMesh(ring.geo, petalMat, ring.n);
      for (let i = 0; i < ring.n; i++) {
        const a = (i / ring.n) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * ring.r, Math.sin(a) * ring.r, ring.z);
        dummy.rotation.set(0, 0, a - Math.PI / 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col(ring.cols[(i + k) % ring.cols.length]));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      g.add(mesh);
      rangoli.add(g);
      spinners.push({ g, speed: (k % 2 ? -1 : 1) * (0.12 + k * 0.04) });
    });
    // dotted ring
    const dotRing = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }),
      56
    );
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 4.65, Math.sin(a) * 4.65, 0.03);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dotRing.setMatrixAt(i, dummy.matrix);
      dotRing.setColorAt(i, col(i % 2 ? 0xf2c14e : 0xfff1d0, 1));
    }
    dotRing.instanceMatrix.needsUpdate = true;
    if (dotRing.instanceColor) dotRing.instanceColor.needsUpdate = true;
    rangoli.add(dotRing);
    // gold rings
    [1.7, 3.0, 4.35].forEach((r) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 10, 128), goldMat);
      t.position.z = 0.03;
      rangoli.add(t);
    });
    // sparkling powder
    const GR_N = small ? 500 : 1200;
    const grPos = new Float32Array(GR_N * 3);
    const grSize = new Float32Array(GR_N);
    const grPhase = new Float32Array(GR_N);
    const grCol = new Float32Array(GR_N * 3);
    for (let i = 0; i < GR_N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 5;
      grPos[i * 3] = Math.cos(a) * r;
      grPos[i * 3 + 1] = Math.sin(a) * r;
      grPos[i * 3 + 2] = 0.05;
      grSize[i] = rand(0.03, 0.08);
      grPhase[i] = Math.random();
      const k = rand(0.6, 1.3);
      grCol[i * 3] = 1.2 * k;
      grCol[i * 3 + 1] = 0.85 * k;
      grCol[i * 3 + 2] = 0.4 * k;
    }
    const grGeo = new THREE.BufferGeometry();
    grGeo.setAttribute("position", new THREE.BufferAttribute(grPos, 3));
    grGeo.setAttribute("aSize", new THREE.BufferAttribute(grSize, 1));
    grGeo.setAttribute("aPhase", new THREE.BufferAttribute(grPhase, 1));
    grGeo.setAttribute("aColor", new THREE.BufferAttribute(grCol, 3));
    const grains = new THREE.Points(grGeo, twinkleMat);
    grains.frustumCulled = false;
    rangoli.add(grains);
    // warm light pool
    const glowPool = new THREE.Mesh(
      new THREE.CircleGeometry(5, 64),
      new THREE.MeshBasicMaterial({
        map: glowTex, color: 0xff9a30, transparent: true, opacity: 0.3,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    glowPool.position.z = 0.06;
    rangoli.add(glowPool);
    scene.add(rangoli);

    // ---------- Sky lanterns ----------
    const lanternGeo = new THREE.CylinderGeometry(0.34, 0.26, 0.62, 8, 1, true);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffa850, emissive: 0xff6a14, emissiveIntensity: 1.3,
      roughness: 0.85, side: THREE.DoubleSide, flatShading: true,
    });
    const lanternGlowMat = new THREE.SpriteMaterial({
      map: glowTex, color: 0xffa040, transparent: true, opacity: 0.6,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const lanternCoreMat = new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color(3, 2, 0.8), transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const lanterns = [];
    for (let i = 0; i < (small ? 8 : 12); i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(lanternGeo, lanternMat);
      const glow = new THREE.Sprite(lanternGlowMat);
      glow.scale.set(2.8, 2.8, 1);
      const core = new THREE.Sprite(lanternCoreMat);
      core.scale.set(0.9, 0.9, 1);
      core.position.y = -0.15;
      g.add(body, glow, core);
      const sc = rand(0.8, 1.4);
      g.scale.setScalar(sc);
      const z = rand(-12, -3);
      const side = i % 2 ? 1 : -1;
      g.position.z = z;
      scene.add(g);
      lanterns.push({
        g, z, nx: side * rand(0.28, 0.5), speed: rand(0.3, 0.6), phase: rand(0, 6.28),
        y: rand(-8, 8), spin: rand(-0.3, 0.3),
      });
    }

    // ---------- Layout ----------
    const NORMAL = new THREE.Vector3(0, Math.sin(-RANGOLI_TILT), Math.cos(RANGOLI_TILT));
    const layout = () => {
      const { h, w } = visible(0);
      const s = Math.min(1, w / 11);
      rangoli.scale.setScalar(s);
      rangoli.position.set(0, -h * 0.3, 0);
      const ds = s * 0.9;
      diya.scale.setScalar(ds);
      diya.position.copy(rangoli.position).addScaledVector(NORMAL, 0.55 * ds);

      const sk = visible(-30);
      const W = sk.w * 1.2;
      skyline.scale.set(W, W / (SKY_W / SKY_H), 1);
      skyline.position.set(0, -sk.h / 2 + skyline.scale.y / 2 - sk.h * 0.02, -30);

      const mz = -45;
      const mv = visible(mz);
      moon.position.set(-mv.w * 0.3, mv.h * 0.3, mz);
      moonGlow.position.set(-mv.w * 0.3, mv.h * 0.3, mz - 0.1);
    };
    layout();

    // ---------- Events ----------
    const mouse = { x: 0, y: 0 };
    const onMove = (e) => {
      mouse.x = (e.clientX / width) * 2 - 1;
      mouse.y = -((e.clientY / height) * 2 - 1);
    };
    const onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest("input,textarea,button,a")) return;
      const v = new THREE.Vector3((e.clientX / width) * 2 - 1, -(e.clientY / height) * 2 + 1, 0.5);
      v.unproject(camera);
      const dir = v.sub(camera.position).normalize();
      const tz = -5;
      const t = (tz - camera.position.z) / dir.z;
      launch(camera.position.x + dir.x * t, camera.position.y + dir.y * t, tz);
    };
    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      renderer.setSize(width, height);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      setPx();
      layout();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);

    // ---------- Animation loop ----------
    const tmpV = new THREE.Vector3();
    let last = performance.now();
    let t = 0;
    let nextLaunch = 1.2;
    let raf;

    const animate = (now) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      timeUniform.value = t;
      finishPass.uniforms.uTime.value = t % 100;

      // camera: intro push-in + parallax + gentle breathing
      const intro = smooth(0, 4, t);
      camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.04;
      camera.position.y += ((1 - intro) * 2.5 + mouse.y * 0.8 - camera.position.y) * 0.04;
      camera.position.z = CAM_Z + (1 - intro) * 5 + Math.sin(t * 0.2) * 0.35;
      camera.lookAt(0, -0.5, 0);

      stars.rotation.z += dt * 0.004;

      // embers
      for (let i = 0; i < EMBER_N; i++) {
        ePos[i * 3 + 1] += eSpeed[i] * dt;
        ePos[i * 3] += Math.sin(t + ePhase[i] * 6.28) * 0.004;
        if (ePos[i * 3 + 1] > 9) {
          ePos[i * 3 + 1] = -9;
          ePos[i * 3] = rand(-16, 16);
        }
      }
      emberPosAttr.needsUpdate = true;

      // flame
      const ig = smooth(0.4, 2.0, t);
      const n = Math.sin(t * 11) * 0.45 + Math.sin(t * 17.3) * 0.35 + Math.sin(t * 29.1) * 0.2;
      const gs = Math.max(ig, 0.001);
      flame.scale.set(gs * (1 + n * 0.05), gs * (1 + n * 0.12), gs * (1 + n * 0.05));
      flame.rotation.z = Math.sin(t * 6.3) * 0.05 + Math.sin(t * 2.1) * 0.03;
      flameMats.forEach((m) => {
        m.uniforms.uTime.value = t;
        m.uniforms.uFlick.value = 0.9 + n * 0.1;
      });
      flameLight.intensity = ig * (38 + n * 9);
      fillLight.intensity = ig * 18;
      flameGlow.material.opacity = ig * (0.55 + n * 0.08);
      glowPool.material.opacity = ig * (0.3 + n * 0.05);
      oil.material.emissiveIntensity = 0.4 + ig * (0.4 + n * 0.1);

      // sparks drifting up from the flame
      if (ig > 0.5 && Math.random() < 0.25) {
        flame.getWorldPosition(tmpV);
        emit(tmpV.x + rand(-0.05, 0.05), tmpV.y + 0.25, tmpV.z,
          rand(-0.15, 0.15), rand(0.8, 1.6), rand(-0.1, 0.1),
          SPARK, rand(0.7, 1.1), 0.98, rand(0.04, 0.08), 2, -0.35);
      }

      // rangoli
      spinners.forEach((s) => (s.g.rotation.z += s.speed * dt));
      rangoli.rotation.z = Math.sin(t * 0.3) * 0.05;

      // lanterns
      lanterns.forEach((l) => {
        const { h, w } = visible(l.z);
        l.y += l.speed * dt;
        if (l.y > h / 2 + 1.5) l.y = -h / 2 - 1.5;
        l.g.position.x = l.nx * w + Math.sin(t * 0.6 + l.phase) * 0.6;
        l.g.position.y = l.y;
        l.g.rotation.z = Math.sin(t * 0.8 + l.phase) * 0.1;
        l.g.rotation.y += l.spin * dt;
      });
      lanternGlowMat.opacity = 0.55 + Math.sin(t * 2.3) * 0.08;

      // flashes + light
      flashes.forEach((f) => {
        if (f.life <= 0) return;
        f.life -= dt * 2.2;
        if (f.life <= 0) {
          f.sp.visible = false;
          f.sp.material.opacity = 0;
          return;
        }
        const s = 6 + (1 - f.life) * 8;
        f.sp.scale.set(s, s, 1);
        f.sp.material.opacity = f.life * f.life * 0.8;
      });
      burstLight.intensity *= Math.exp(-dt * 5);
      if (burstLight.intensity < 0.01) burstLight.intensity = 0;

      // auto launch
      nextLaunch -= dt;
      if (nextLaunch <= 0) {
        launchRandom();
        nextLaunch = rand(0.7, 1.7);
      }

      // rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy * dt;
        r.x += Math.sin(t * 20 + r.ph) * 0.01;
        emit(r.x, r.y, r.z, rand(-0.3, 0.3), -1.2, rand(-0.3, 0.3), HEAD, 3.5, 0.9, 0.2, 0, 0.3);
        for (let k = 0; k < 2; k++) {
          emit(r.x, r.y, r.z, rand(-0.4, 0.4), -1.5, rand(-0.4, 0.4), TRAIL, 1.8, 0.95, 0.1, 2, 0.6);
        }
        if (r.y >= r.targetY) {
          burst(r.x, r.y, r.z);
          rockets.splice(i, 1);
        }
      }

      // particles
      for (let i = 0; i < MAX; i++) {
        const L0 = pLife[i];
        if (L0 <= 0) continue;
        const j = i * 3;
        const L = L0 - pDecay[i] * dt;
        pLife[i] = L;
        if (L <= 0) {
          pCol[j] = pCol[j + 1] = pCol[j + 2] = 0;
          pSz[i] = 0;
          continue;
        }
        if (pFlag[i] === 1 && L < 0.3) {
          pFlag[i] = 0;
          for (let k = 0; k < 5; k++) {
            const [dx, dy, dz] = randDir();
            emit(pPos[j], pPos[j + 1], pPos[j + 2], dx * 3, dy * 3, dz * 3, WHITE, 3.2, 0.94, 0.09, 0, 0.6);
          }
        }
        const dr = Math.pow(pDrag[i], dt * 60);
        pVel[j] *= dr;
        pVel[j + 1] = pVel[j + 1] * dr - GRAVITY * pGrav[i] * dt;
        pVel[j + 2] *= dr;
        pPos[j] += pVel[j] * dt;
        pPos[j + 1] += pVel[j + 1] * dt;
        pPos[j + 2] += pVel[j + 2] * dt;

        // white-hot -> colour -> cooling ember
        const w = Math.max(0, (L - 0.8) * 5);
        const cool = Math.max(0, (0.3 - L) * 3.3);
        let r = pBase[j], g = pBase[j + 1], b = pBase[j + 2];
        r += (2.2 - r) * w * 0.8;
        g += (2.0 - g) * w * 0.8;
        b += (1.6 - b) * w * 0.8;
        r += (1.4 - r) * cool * 0.5;
        g += (0.35 - g) * cool * 0.5;
        b += (0.05 - b) * cool * 0.5;
        let inten = L < 0.4 ? L / 0.4 : 1;
        if (pFlag[i] === 2 && L < 0.7 && Math.random() < 0.4) inten *= 0.2;
        pCol[j] = r * inten * 1.5;
        pCol[j + 1] = g * inten * 1.5;
        pCol[j + 2] = b * inten * 1.5;
        pSz[i] = pSize0[i] * (0.35 + 0.65 * Math.min(1, L * 1.6)) * (1 + w * 0.6);
      }
      fwPosAttr.needsUpdate = true;
      fwColAttr.needsUpdate = true;
      fwSzAttr.needsUpdate = true;

      composer.render();
    };
    raf = requestAnimationFrame(animate);

    // ---------- Cleanup ----------
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(disposeMaterial);
          else disposeMaterial(o.material);
        }
      });
      [skyTex, glowTex, envTex].forEach((tx) => tx.dispose());
      pmrem.dispose();
      composer.passes.forEach((p) => p.dispose && p.dispose());
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="scene3d" />;
}