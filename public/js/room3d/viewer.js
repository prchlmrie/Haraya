// Real-time WebGL viewer shared by the room tour and the amenities explorer:
// orbit / zoom / pan camera kept inside the scene bounds, keyboard and
// on-screen walking, guided viewpoints with smooth camera flights, an automatic
// tour, clickable hotspots, and optional per-frame scene animation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ROOM_BUILDERS } from './rooms.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_BACKGROUND = new THREE.Color('#151515');

const KEYMAP = {
  KeyW: ['forward', 1], ArrowUp: ['forward', 1],
  KeyS: ['forward', -1], ArrowDown: ['forward', -1],
  KeyA: ['strafe', -1], KeyD: ['strafe', 1],
  ArrowLeft: ['turn', 1], KeyQ: ['turn', 1],
  ArrowRight: ['turn', -1], KeyE: ['turn', -1],
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class RoomViewer {
  /**
   * @param {HTMLElement} container element that receives the canvas
   * @param {{ onInteract?: Function, onTourStep?: Function, onError?: Function, onHotspot?: Function }} hooks
   */
  constructor(container, hooks = {}) {
    this.container = container;
    this.hooks = hooks;
    this.room = null;
    this.tween = null;
    this.tour = null;
    this.dirty = true;
    this.visible = true;
    this.held = new Map();
    this.markers = [];
    this.lastTime = performance.now();
    this.raycaster = new THREE.Raycaster();

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // scenes are static: shadows are rendered once per scene
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = 'tour__canvas';
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '3D view. Drag to look around, scroll or pinch to zoom, right-drag or two-finger drag to pan, W A S D or arrow keys to walk.');
    container.prepend(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = DEFAULT_BACKGROUND;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 200);

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.45;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.minDistance = 0.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.9;
    controls.addEventListener('start', () => this.userTookControl());
    this.controls = controls;

    this.markerLayer = document.createElement('div');
    this.markerLayer.className = 'hotspots';
    container.append(this.markerLayer);

    this.bindInput();

    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.stopTour();
      renderer.setAnimationLoop(null);
      this.hooks.onError?.('The 3D view was interrupted by your device (graphics context lost). Reload the page to try again.');
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.dirty = true;
    });
    this.intersectionObserver.observe(container);
    this.resize();
    renderer.setAnimationLoop(() => this.tick());
  }

  // ---------- input ----------

  bindInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('keydown', (e) => {
      const map = KEYMAP[e.code];
      if (!map || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      this.press(e.code, ...map);
    });
    canvas.addEventListener('keyup', (e) => this.release(e.code));
    canvas.addEventListener('blur', () => this.held.clear());

    let down = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500) {
        const id = this.pickHotspot(e);
        if (id) this.hooks.onHotspot?.(id, 'object');
      }
      down = null;
    });
    let lastHover = 0;
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons || performance.now() - lastHover < 90 || !this.room?.hotspots?.length) return;
      lastHover = performance.now();
      canvas.style.cursor = this.pickHotspot(e) ? 'pointer' : '';
    });
  }

  /** Starts a movement from a key or on-screen button (`axis` is forward, strafe or turn). */
  press(source, axis, value) {
    this.held.set(source, [axis, value]);
  }

  release(source) {
    this.held.delete(source);
  }

  userTookControl() {
    this.tween = null;
    this.stopTour();
    this.hooks.onInteract?.();
  }

  pickHotspot(event) {
    if (!this.room) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const hit of this.raycaster.intersectObject(this.room.group, true)) {
      const m = hit.object.material;
      if (!hit.object.visible || hit.object.userData.noPick || (m?.transparent && m.opacity < 0.35)) continue;
      for (let o = hit.object; o; o = o.parent) if (o.userData.hotspot) return o.userData.hotspot;
      return null;
    }
    return null;
  }

  // ---------- layout ----------

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Wider field of view on narrow (portrait) screens so the space still reads well.
    this.camera.fov = w / h < 1 ? 75 : 62;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // ---------- scenes ----------

  /** Builds the hotel room for a category code and returns its tour viewpoints. */
  load(code) {
    const build = ROOM_BUILDERS[code];
    if (!build) throw new Error(`Unknown room category: ${code}`);
    return this.setScene(build());
  }

  /**
   * Shows a built scene: `{ group, bounds: {W, D, H}, exposure, viewpoints,
   * hotspots?, update?(dt, t), background?, envIntensity?, walkSpeed? }`.
   */
  setScene(room) {
    this.stopTour();
    this.disposeRoom();
    this.scene.add(room.group);
    this.room = room;
    this.renderer.toneMappingExposure = room.exposure ?? 1;
    this.scene.background = room.background ?? DEFAULT_BACKGROUND;
    this.scene.environmentIntensity = room.envIntensity ?? 0.35;
    this.renderer.shadowMap.needsUpdate = true;
    this.buildMarkers(room.hotspots ?? []);
    this.jumpTo(room.viewpoints[0]);
    return room.viewpoints;
  }

  jumpTo(vp) {
    this.tween = null;
    this.camera.position.set(...vp.position);
    this.controls.target.set(...vp.target);
    this.controls.update();
    this.dirty = true;
  }

  flyTo(vp, duration = 1500) {
    this.tween = {
      start: performance.now(),
      duration,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: new THREE.Vector3(...vp.position),
      toTarget: new THREE.Vector3(...vp.target),
    };
  }

  viewpoint(id) {
    return this.room?.viewpoints.find((v) => v.id === id);
  }

  goTo(id) {
    const vp = this.viewpoint(id);
    if (vp) { this.stopTour(); this.flyTo(vp); }
  }

  reset() {
    if (this.room) { this.stopTour(); this.flyTo(this.room.viewpoints[0]); }
  }

  startTour(interval = 5200) {
    if (!this.room) return;
    this.stopTour();
    const vps = this.room.viewpoints;
    let i = 0;
    const step = () => {
      this.flyTo(vps[i], 2200);
      this.hooks.onTourStep?.(vps[i].id, true);
      i = (i + 1) % vps.length;
    };
    step();
    this.tour = setInterval(step, interval);
  }

  stopTour() {
    if (this.tour) {
      clearInterval(this.tour);
      this.tour = null;
      this.hooks.onTourStep?.(null, false);
    }
  }

  get touring() {
    return !!this.tour;
  }

  // ---------- hotspot markers ----------

  buildMarkers(hotspots) {
    this.markerLayer.innerHTML = '';
    this.markers = hotspots.map((h, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hotspot';
      el.innerHTML = `<span class="hotspot__dot">${i + 1}</span><span class="hotspot__label">${escapeHtml(h.label)}</span>`;
      el.setAttribute('aria-label', `${h.label}: show details`);
      el.addEventListener('click', () => this.hooks.onHotspot?.(h.id, 'marker'));
      this.markerLayer.append(el);
      return { id: h.id, el, pos: new THREE.Vector3(...h.position), occluded: false };
    });
    this.lastOcclusion = 0;
  }

  setMarkersVisible(on) {
    this.markerLayer.hidden = !on;
    this.dirty = true;
  }

  setActiveMarker(id) {
    for (const m of this.markers) m.el.classList.toggle('is-active', m.id === id);
  }

  updateMarkers() {
    if (!this.markers.length || this.markerLayer.hidden) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const now = performance.now();
    const checkOcclusion = now - this.lastOcclusion > 250;
    if (checkOcclusion) this.lastOcclusion = now;
    const v = new THREE.Vector3();
    for (const m of this.markers) {
      v.copy(m.pos).project(this.camera);
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02;
      m.el.classList.toggle('is-hidden', !onScreen);
      if (!onScreen) continue;
      m.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      if (checkOcclusion) {
        const dist = this.camera.position.distanceTo(m.pos);
        this.raycaster.set(this.camera.position, m.pos.clone().sub(this.camera.position).normalize());
        this.raycaster.far = dist - 0.25;
        const blocker = this.raycaster.intersectObject(this.room.group, true)
          .find((hit) => !(hit.object.material?.transparent && hit.object.material.opacity < 0.6));
        this.raycaster.far = Infinity;
        m.el.classList.toggle('is-occluded', !!blocker);
        m.el.classList.toggle('is-far', dist > 9);
      }
    }
  }

  // ---------- frame loop ----------

  /** Keeps the camera and its look-at point inside the scene. */
  clampInside(v, margin) {
    const { W, D, H } = this.room.bounds;
    v.x = clamp(v.x, -W / 2 + margin, W / 2 - margin);
    v.y = clamp(v.y, 0.25, H - 0.15);
    v.z = clamp(v.z, -D / 2 + margin, D / 2 - margin);
  }

  /** Applies held walk / turn input; returns true when the camera moved. */
  walk(dt) {
    if (!this.held.size || !this.room) return false;
    const m = { forward: 0, strafe: 0, turn: 0 };
    for (const [axis, value] of this.held.values()) m[axis] += value;
    if (!m.forward && !m.strafe && !m.turn) return false;
    if (this.tween || this.tour) this.userTookControl();

    const cam = this.camera.position, target = this.controls.target;
    const look = target.clone().sub(cam);
    if (m.turn) {
      look.applyAxisAngle(UP, clamp(m.turn, -1, 1) * 1.4 * dt);
      target.copy(cam).add(look);
    }
    const forward = new THREE.Vector3(look.x, 0, look.z);
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const speed = (this.room.walkSpeed ?? 1.6) * dt;
    const step = forward.clone().multiplyScalar(clamp(m.forward, -1, 1) * speed)
      .add(right.multiplyScalar(clamp(m.strafe, -1, 1) * speed));
    cam.add(step);
    target.add(step);
    const before = cam.clone();
    this.clampInside(cam, 0.3);
    target.add(cam.clone().sub(before));
    if (cam.distanceTo(target) < 0.6) target.copy(cam).addScaledVector(forward, 1.2);
    return true;
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.room) return;
    let moving = this.walk(dt);
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration);
      const k = ease(t);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, k);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k);
      if (t >= 1) this.tween = null;
      moving = true;
    }
    const changed = this.controls.update();
    this.clampInside(this.camera.position, 0.3);
    this.clampInside(this.controls.target, 0.05);
    if (!this.visible) return;
    if (this.room.update) {
      this.room.update(dt, now / 1000);
      moving = true;
    }
    if (moving || changed || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.updateMarkers();
      this.dirty = false;
    }
  }

  /** Renders the current frame to a JPEG data URL (used for preview images). */
  snapshot(quality = 0.86) {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/jpeg', quality);
  }

  disposeRoom() {
    if (!this.room) return;
    this.room.dispose?.();
    this.scene.remove(this.room.group);
    this.room.group.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        for (const value of Object.values(m)) if (value?.isTexture) value.dispose();
        m.dispose();
      }
      if (obj.isLight) obj.dispose?.();
    });
    if (this.room.background?.isTexture) this.room.background.dispose();
    this.markerLayer.innerHTML = '';
    this.markers = [];
    this.room = null;
  }

  dispose() {
    this.stopTour();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.disposeRoom();
    this.envMap.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.markerLayer.remove();
  }
}
