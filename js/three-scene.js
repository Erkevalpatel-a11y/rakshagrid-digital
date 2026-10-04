/* ============================================================
   RAKSHAGRID DIGITAL — three-scene.js
   Three.js scenes: 3D India network, particle field, digital grid,
   floating nodes and a layered protection shield.
   Conceptual visualisations only — not real infrastructure data.
   ============================================================ */
import * as THREE from "three";

const RG = window.RG;
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.innerWidth < 820;
const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
const SCALE = 5;

const SCENES = [];

/* ---------- shared helpers ---------- */
function projectVec(lon, lat, z) {
  const p = RG.project(lon, lat);
  return new THREE.Vector3(p.x * SCALE, p.y * SCALE, z || 0);
}

function makeGlowTexture(hex) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, hex);
  g.addColorStop(0.25, hex.replace("rgb", "rgba").replace(")", ",0.5)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function indiaPoints() {
  const positions = [];
  const colors = [];
  const step = isMobile ? 0.62 : 0.45;
  const c = new THREE.Color();
  for (let lat = RG.GEO.latMin + 1; lat <= RG.GEO.latMax; lat += step) {
    for (let lon = RG.GEO.lonMin; lon <= RG.GEO.lonMax; lon += step) {
      if (!RG.pointInPoly(lon, lat, RG.INDIA_OUTLINE)) continue;
      const p = RG.project(lon, lat);
      positions.push(p.x * SCALE, p.y * SCALE, (Math.random() - 0.5) * 0.4);
      const r = Math.random();
      if (r > 0.965) c.setHSL(0.09, 0.9, 0.6);        /* saffron accent */
      else if (r > 0.94) c.setHSL(0.4, 0.7, 0.5);      /* green accent */
      else c.setHSL(0.55 - (p.y * 0.03), 0.85, 0.55);  /* blue → cyan */
      colors.push(c.r, c.g, c.b);
    }
  }
  return { positions, colors };
}

function outlineGeometry() {
  const pts = RG.INDIA_OUTLINE.map(([lon, lat]) => {
    const p = RG.project(lon, lat);
    return new THREE.Vector3(p.x * SCALE, p.y * SCALE, 0.02);
  });
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function createParticleField(count, spread) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.7;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.6 - 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.06, color: 0x8fc4ff, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  return new THREE.Points(geo, mat);
}

function createShieldShape(scale) {
  const s = new THREE.Shape();
  s.moveTo(0, 1.15);
  s.quadraticCurveTo(0.98, 0.95, 0.98, 0.35);
  s.quadraticCurveTo(0.98, -0.6, 0, -1.15);
  s.quadraticCurveTo(-0.98, -0.6, -0.98, 0.35);
  s.quadraticCurveTo(-0.98, 0.95, 0, 1.15);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 18 });
  geo.scale(scale, scale, scale);
  geo.center();
  return geo;
}

function createShieldGroup(withLayers, layerColors) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    createShieldShape(1),
    new THREE.MeshBasicMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.16, depthWrite: false })
  );
  group.add(core);
  const wire = new THREE.Mesh(
    createShieldShape(1.02),
    new THREE.MeshBasicMaterial({ color: 0x35d6ef, wireframe: true, transparent: true, opacity: 0.35 })
  );
  group.add(wire);
  const layers = [];
  if (withLayers) {
    layerColors.forEach((col, i) => {
      const r = 1.25 + i * 0.42;
      const g = new THREE.IcosahedronGeometry(r, 1);
      const m = new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.28 });
      const mesh = new THREE.Mesh(g, m);
      group.add(mesh);
      layers.push({ mesh, speed: (i % 2 ? -1 : 1) * (0.12 + i * 0.03), axis: i % 3 });
    });
  }
  return { group, layers, core, wire };
}

/* ---------- scene registry ---------- */
function register(containerId, setup, opts) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    container.setAttribute("data-webgl", "unsupported");
    return null;
  }
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  const api = setup(scene, camera, container) || {};

  const obj = {
    renderer, scene, camera, container,
    visible: false,
    update: api.update || function () {},
    camera: camera,
    cam: api.cam || camera
  };
  SCENES.push(obj);

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    obj.renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  obj.resize = resize;

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => { obj.visible = en.isIntersecting; });
    }, { threshold: 0.02 }).observe(container);
  } else {
    obj.visible = true;
  }
  if (containerId === "heroCanvas") obj.visible = true;
  return obj;
}

/* ============================================================
   SCENE 1 — HERO: India network + shield shell + particles + grid
   ============================================================ */
function heroSetup(scene, camera) {
  camera.position.set(0, 0, 15.5);
  const world = new THREE.Group();
  scene.add(world);

  /* point cloud silhouette */
  const { positions, colors } = indiaPoints();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: isMobile ? 0.12 : 0.095, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  world.add(points);

  /* outline */
  const outline = new THREE.Line(outlineGeometry(), new THREE.LineBasicMaterial({
    color: 0x35d6ef, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending
  }));
  world.add(outline);

  /* shield shell */
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(7.4, 1),
    new THREE.MeshBasicMaterial({ color: 0x3d8bff, wireframe: true, transparent: true, opacity: 0.06 })
  );
  world.add(shell);

  /* grid */
  const grid = new THREE.GridHelper(34, 34, 0x2a4a7a, 0x152a4a);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -4.5;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  world.add(grid);

  /* particles */
  const particles = createParticleField(isMobile ? 180 : 520, 26);
  scene.add(particles);

  /* city nodes */
  const glowTex = makeGlowTexture("rgb(120,200,255)");
  const cityGroup = new THREE.Group();
  world.add(cityGroup);
  const cityNodes = [];
  RG.CITIES.forEach((city) => {
    const v = projectVec(city.lon, city.lat, 0.25);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(city.primary ? 0.14 : 0.1, 12, 12),
      new THREE.MeshBasicMaterial({ color: city.primary ? 0x35d6ef : 0x3d8bff })
    );
    dot.position.copy(v);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(city.primary ? 1.5 : 1.1);
    halo.position.copy(v);
    cityGroup.add(dot); cityGroup.add(halo);
    cityNodes.push({ halo, base: halo.scale.x, phase: Math.random() * Math.PI * 2 });
  });

  /* connections + travelling packets */
  const pairs = [[0,1],[0,2],[0,3],[0,6],[1,6],[2,3],[2,9],[3,4],[3,5],[4,5],[6,7],[2,8],[1,4],[0,9],[3,8]];
  const packets = [];
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
  pairs.forEach(([a, b]) => {
    const va = projectVec(RG.CITIES[a].lon, RG.CITIES[a].lat, 0.25);
    const vb = projectVec(RG.CITIES[b].lon, RG.CITIES[b].lat, 0.25);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    mid.z += va.distanceTo(vb) * 0.28 + 0.6;
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    const curvePts = curve.getPoints(36);
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curvePts), lineMat));
    const pkt = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 })
    );
    world.add(pkt);
    packets.push({ curve, mesh: pkt, t: Math.random(), speed: 0.18 + Math.random() * 0.22 });
  });

  let mx = 0, my = 0;
  window.addEventListener("mousemove", (e) => {
    mx = (e.clientX / window.innerWidth - 0.5);
    my = (e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  return {
    update(dt, t) {
      if (!reduceMotion) {
        world.rotation.y = Math.sin(t * 0.12) * 0.22;
        world.rotation.x = Math.sin(t * 0.08) * 0.06;
        points.material.opacity = 0.85 + Math.sin(t * 1.4) * 0.08;
        shell.rotation.y += dt * 0.03;
        shell.rotation.x -= dt * 0.012;
        particles.rotation.y += dt * 0.02;
        cityNodes.forEach((n) => {
          const s = n.base * (1 + Math.sin(t * 1.6 + n.phase) * 0.12);
          n.halo.scale.setScalar(s);
        });
        packets.forEach((p) => {
          p.t += dt * p.speed;
          if (p.t > 1) p.t -= 1;
          const pos = p.curve.getPoint(p.t);
          p.mesh.position.copy(pos);
          p.mesh.material.opacity = 0.4 + Math.sin(p.t * Math.PI) * 0.6;
        });
      }
      /* parallax */
      camera.position.x += (mx * 2.2 - camera.position.x) * 0.04;
      camera.position.y += (-my * 1.6 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
    }
  };
}

/* ============================================================
   SCENE 2 — INDIA DIGITAL NETWORK section
   ============================================================ */
function indiaSectionSetup(scene, camera) {
  camera.position.set(0, 0, 16);
  const world = new THREE.Group();
  scene.add(world);

  const { positions, colors } = indiaPoints();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: isMobile ? 0.13 : 0.1, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  world.add(points);

  world.add(new THREE.Line(outlineGeometry(), new THREE.LineBasicMaterial({
    color: 0x35d6ef, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending
  })));

  const grid = new THREE.GridHelper(36, 36, 0x2a4a7a, 0x152a4a);
  grid.rotation.x = Math.PI / 2; grid.position.z = -5;
  grid.material.transparent = true; grid.material.opacity = 0.18;
  world.add(grid);

  const particles = createParticleField(isMobile ? 140 : 380, 28);
  scene.add(particles);

  const glowTex = makeGlowTexture("rgb(120,220,255)");
  const pairs = [[0,1],[0,2],[0,3],[0,6],[1,6],[2,3],[2,9],[3,4],[3,5],[4,5],[6,7],[2,8],[1,4],[0,9],[3,8]];
  const packets = [];
  RG.CITIES.forEach((city) => {
    const v = projectVec(city.lon, city.lat, 0.2);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshBasicMaterial({ color: 0x35d6ef }));
    dot.position.copy(v); world.add(dot);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.3); halo.position.copy(v); world.add(halo);
  });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  pairs.forEach(([a, b]) => {
    const va = projectVec(RG.CITIES[a].lon, RG.CITIES[a].lat, 0.2);
    const vb = projectVec(RG.CITIES[b].lon, RG.CITIES[b].lat, 0.2);
    const mid = va.clone().add(vb).multiplyScalar(0.5); mid.z += va.distanceTo(vb) * 0.3 + 0.5;
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(30)), lineMat));
    const pkt = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    world.add(pkt);
    packets.push({ curve, mesh: pkt, t: Math.random(), speed: 0.16 + Math.random() * 0.2 });
  });

  return {
    update(dt, t) {
      if (!reduceMotion) {
        world.rotation.y = Math.sin(t * 0.1) * 0.3;
        particles.rotation.y += dt * 0.015;
        packets.forEach((p) => {
          p.t += dt * p.speed; if (p.t > 1) p.t -= 1;
          p.mesh.position.copy(p.curve.getPoint(p.t));
        });
      }
    }
  };
}

/* ============================================================
   SCENE 3 — DEFENSE ARCHITECTURE shield
   ============================================================ */
function shieldSetup(scene, camera, container) {
  camera.position.set(0, 0, 8);
  const { group, layers, wire } = createShieldGroup(true, [0x3d8bff, 0x35d6ef, 0x24c07a, 0xff9f45, 0xa98bff]);
  scene.add(group);

  const particles = createParticleField(isMobile ? 90 : 220, 12);
  scene.add(particles);

  /* central label overlay */
  const label = document.createElement("div");
  label.textContent = "RAKSHAGRID";
  label.style.cssText = "position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;letter-spacing:.28em;font-size:clamp(11px,1.5vw,15px);color:#dbe9ff;text-shadow:0 0 18px rgba(53,214,239,.7);pointer-events:none;";
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.appendChild(label);

  return {
    update(dt, t) {
      if (!reduceMotion) {
        group.rotation.y += dt * 0.35;
        layers.forEach((l, i) => {
          if (l.axis === 0) l.mesh.rotation.x += dt * l.speed;
          else if (l.axis === 1) l.mesh.rotation.y += dt * l.speed;
          else l.mesh.rotation.z += dt * l.speed;
        });
        wire.rotation.y -= dt * 0.5;
        particles.rotation.y += dt * 0.03;
      } else {
        group.rotation.y = 0.6;
      }
    }
  };
}

/* ============================================================
   SCENE 4 — CTA shield + network
   ============================================================ */
function ctaSetup(scene, camera) {
  camera.position.set(0, 0, 9);
  const { group, layers } = createShieldGroup(false, []);
  group.scale.setScalar(1.15);
  scene.add(group);

  const particles = createParticleField(isMobile ? 110 : 300, 22);
  scene.add(particles);

  /* orbiting nodes */
  const ring = new THREE.Group();
  scene.add(ring);
  const glowTex = makeGlowTexture("rgb(140,210,255)");
  const orbiters = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 3.6 + (i % 2) * 0.5;
    const node = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    node.scale.setScalar(0.9);
    node.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.7, 0);
    ring.add(node);
    orbiters.push(node);
  }

  return {
    update(dt, t) {
      if (!reduceMotion) {
        group.rotation.y += dt * 0.25;
        ring.rotation.z += dt * 0.1;
        ring.rotation.y = Math.sin(t * 0.2) * 0.4;
        particles.rotation.y += dt * 0.02;
        orbiters.forEach((o, i) => {
          o.material.opacity = 0.4 + Math.sin(t * 1.5 + i) * 0.35;
        });
      }
    }
  };
}

/* ============================================================
   Boot + render loop
   ============================================================ */
function boot() {
  if (!RG) return;
  register("heroCanvas", heroSetup);
  register("indiaCanvas", indiaSectionSetup);
  register("shieldCanvas", shieldSetup);
  register("ctaCanvas", ctaSetup);

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;
    for (let i = 0; i < SCENES.length; i++) {
      const s = SCENES[i];
      if (!s.visible) continue;
      s.update(dt, t);
      s.renderer.render(s.scene, s.camera);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.addEventListener("resize", () => {
    SCENES.forEach((s) => s.resize && s.resize());
  });

  /* pause rendering when tab hidden */
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

window.RGThree = { scenes: SCENES };
