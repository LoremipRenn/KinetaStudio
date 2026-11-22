import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildSneakerModel } from './shoe-geometry.js';

const CAMERA_PRESETS = {
  studio: { pos: [2.95, 1.72, 3.35], target: [0.02, 0.46, 0.0] },
  profile: { pos: [0.02, 0.72, 4.05], target: [0.02, 0.46, 0.0] },
  top: { pos: [0.04, 4.55, 0.58], target: [0.02, 0.35, 0.0] },
  heel: { pos: [-3.45, 1.35, 1.82], target: [-0.12, 0.46, 0.0] },
  sole: { pos: [1.05, -1.55, 3.05], target: [0.02, 0.25, 0.0] }
};

function createSoftShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 14, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(6, 10, 18, 0.46)');
  grad.addColorStop(0.50, 'rgba(6, 10, 18, 0.18)');
  grad.addColorStop(1, 'rgba(6, 10, 18, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createParticleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(220, 245, 255, 0.85)');
  grad.addColorStop(0.45, 'rgba(130, 220, 200, 0.32)');
  grad.addColorStop(1, 'rgba(130, 220, 200, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a physical softbox light-tent scene for PMREM reflections so leather,
 * knit, metallic eyelets/dubrae, and Air Pods catch crisp commercial studio highlights.
 */
function buildStudioEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#131720');

  const addPanel = (color, intensity, size, pos, lookAt) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity)
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
    mesh.position.set(...pos);
    mesh.lookAt(...lookAt);
    envScene.add(mesh);
  };

  // Overhead warm-white main softbox
  addPanel('#FFFDF8', 3.4, [8, 5], [0, 7, 1.5], [0, 0, 0]);
  // Key front-right softbox
  addPanel('#FFF3E6', 2.8, [5, 4], [6, 3.5, 5], [0, 0.5, 0]);
  // Cool rim strip on back-left for crisp silhouette separation
  addPanel('#CFE5FF', 3.6, [7, 2.2], [-6, 3.0, -4.5], [0, 0.5, 0]);
  // Subtle mint-teal bounce strip on low right
  addPanel('#B7F0DF', 1.4, [6, 2], [4, -1.5, -5], [0, 0.5, 0]);
  // Soft studio floor bounce
  addPanel('#2B3342', 1.0, [14, 14], [0, -5, 0], [0, 0, 0]);

  return envScene;
}

export class StudioScene {
  constructor(container, options = {}) {
    this.container = container;
    this.onFallback = options.onFallback || (() => {});
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.autoRotate = !this.reducedMotion;
    this.exploded = false;
    this.currentModel = null;
    this.cameraAnim = null;
    this.explodeProgress = 0;
    this.clock = new THREE.Clock();
    this.destroyed = false;

    this.init();
  }

  init() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
    } catch {
      this.onFallback('Browser atau perangkat ini belum mengaktifkan akselerasi WebGL untuk kanvas 3D.');
      return;
    }

    const width = this.container.clientWidth || 640;
    const height = this.container.clientHeight || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#11161F');
    scene.fog = new THREE.Fog('#11161F', 8.5, 18);
    this.scene = scene;

    // Bake custom softbox light-tent reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = buildStudioEnvironmentScene();
    this.envRT = pmrem.fromScene(envScene, 0.025);
    scene.environment = this.envRT.texture;
    envScene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(...CAMERA_PRESETS.studio.pos);
    this.camera = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.1;
    controls.maxDistance = 6.2;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.target.set(...CAMERA_PRESETS.studio.target);
    controls.autoRotate = this.autoRotate;
    controls.autoRotateSpeed = 0.85;
    this.controls = controls;

    // 3-point physical studio lights + soft shadows
    const keyLight = new THREE.DirectionalLight('#FFF6EC', 2.2);
    keyLight.position.set(3.4, 5.2, 3.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -2.4;
    keyLight.shadow.camera.right = 2.4;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -2.4;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.radius = 3.5;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#D2E8FF', 1.45);
    rimLight.position.set(-4.0, 2.8, -3.2);
    scene.add(rimLight);

    const underRim = new THREE.PointLight('#4CE0B3', 0.65, 6.0);
    underRim.position.set(1.8, 0.35, -1.9);
    scene.add(underRim);
    this.underRim = underRim;

    const fillLight = new THREE.HemisphereLight('#F4F8FF', '#283142', 0.55);
    scene.add(fillLight);

    // Two-tier architectural showroom plinth with metallic chamfered rim
    const plinthGeom = new THREE.CylinderGeometry(1.94, 2.02, 0.14, 72);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1C2330'),
      roughness: 0.62,
      metalness: 0.15
    });
    const plinth = new THREE.Mesh(plinthGeom, plinthMat);
    plinth.position.set(0.05, -0.11, 0);
    plinth.receiveShadow = true;
    scene.add(plinth);
    this.plinth = plinth;
    this.plinthMat = plinthMat;

    const rimRingGeom = new THREE.TorusGeometry(1.94, 0.016, 12, 84);
    rimRingGeom.rotateX(Math.PI / 2);
    const rimRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3D4C66'),
      roughness: 0.28,
      metalness: 0.72
    });
    const rimRing = new THREE.Mesh(rimRingGeom, rimRingMat);
    rimRing.position.set(0.05, -0.04, 0);
    scene.add(rimRing);
    this.rimRingMat = rimRingMat;

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.25, 2.15),
      new THREE.MeshBasicMaterial({
        map: createSoftShadowTexture(),
        transparent: true,
        depthWrite: false
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0.05, -0.036, 0);
    scene.add(shadowPlane);

    // Subtle atmospheric studio dust motes
    const moteCount = 64;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i += 1) {
      const angle = (i / moteCount) * Math.PI * 2;
      const radius = 1.4 + ((i * 37) % 100) / 55;
      motePos[i * 3] = Math.cos(angle) * radius;
      motePos[i * 3 + 1] = 0.08 + ((i * 53) % 100) / 55;
      motePos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const moteGeom = new THREE.BufferGeometry();
    moteGeom.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      map: createParticleTexture(),
      size: 0.045,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const motes = new THREE.Points(moteGeom, moteMat);
    motes.visible = !this.reducedMotion;
    scene.add(motes);
    this.motes = motes;
    this.moteMat = moteMat;

    this.shoeAnchor = new THREE.Group();
    scene.add(this.shoeAnchor);

    // Setup Postprocessing (EffectComposer + UnrealBloomPass + OutputPass)
    try {
      const renderTarget = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(width * dpr)),
        Math.max(1, Math.floor(height * dpr)),
        { samples: 4, type: THREE.HalfFloatType }
      );
      const composer = new EffectComposer(renderer, renderTarget);
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);

      const renderPass = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.16, // subtle specular glint only
        0.32,
        0.94
      );
      const outputPass = new OutputPass();

      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);
      this.composer = composer;
      this.bloomPass = bloomPass;
    } catch {
      this.composer = null;
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.container.addEventListener('keydown', (e) => {
      const step = 0.14;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.shoeAnchor.rotation.y -= step;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.shoeAnchor.rotation.y += step;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.camera.position.y = Math.min(3.4, this.camera.position.y + 0.16);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.camera.position.y = Math.max(-1.0, this.camera.position.y - 0.16);
      }
    });

    this.animate();
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  setTheme(theme) {
    if (!this.scene || !this.plinthMat || !this.rimRingMat) return;
    if (theme === 'terang') {
      const bg = new THREE.Color('#E3E7EE');
      this.scene.background = bg;
      this.scene.fog.color.copy(bg);
      this.plinthMat.color.set('#D2DAE6');
      this.rimRingMat.color.set('#96A3B8');
      this.moteMat.opacity = 0.16;
      this.underRim.intensity = 0.25;
    } else if (theme === 'pekat') {
      const bg = new THREE.Color('#080B10');
      this.scene.background = bg;
      this.scene.fog.color.copy(bg);
      this.plinthMat.color.set('#121721');
      this.rimRingMat.color.set('#2C384D');
      this.moteMat.opacity = 0.42;
      this.underRim.intensity = 0.72;
    } else {
      const bg = new THREE.Color('#11161F');
      this.scene.background = bg;
      this.scene.fog.color.copy(bg);
      this.plinthMat.color.set('#1C2330');
      this.rimRingMat.color.set('#3D4C66');
      this.moteMat.opacity = 0.38;
      this.underRim.intensity = 0.65;
    }
  }

  loadShoe(shoeSpec, colors, materialType) {
    if (!this.shoeAnchor) return;
    if (this.currentModel) {
      this.shoeAnchor.remove(this.currentModel.root);
      this.currentModel.dispose();
    }
    this.currentModel = buildSneakerModel(shoeSpec, colors, materialType);
    this.currentModel.root.rotation.y = 0.22;
    this.shoeAnchor.add(this.currentModel.root);
  }

  updateColors(colors) {
    if (this.currentModel) {
      this.currentModel.updateColors(colors);
    }
  }

  updateMaterial(materialType) {
    if (this.currentModel) {
      this.currentModel.updateMaterialType(materialType);
    }
  }

  setCameraPreset(presetName) {
    const preset = CAMERA_PRESETS[presetName];
    if (!preset || !this.camera || !this.controls) return;
    if (this.reducedMotion) {
      this.camera.position.set(...preset.pos);
      this.controls.target.set(...preset.target);
      this.controls.update();
      return;
    }
    this.cameraAnim = {
      startPos: this.camera.position.clone(),
      endPos: new THREE.Vector3(...preset.pos),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(...preset.target),
      progress: 0
    };
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
  }

  setExploded(enabled) {
    this.exploded = Boolean(enabled);
  }

  focusLayer(layerName) {
    if (layerName === 'outsole') {
      this.setCameraPreset('sole');
      this.setExploded(true);
    } else if (layerName === 'midsole') {
      this.setCameraPreset('profile');
      this.setExploded(true);
    } else if (layerName === 'upper') {
      this.setCameraPreset('studio');
      this.setExploded(false);
    }
  }

  animate() {
    if (this.destroyed) return;
    requestAnimationFrame(() => this.animate());

    const elapsed = this.clock.getElapsedTime();

    if (this.motes && this.autoRotate && !this.reducedMotion) {
      this.motes.rotation.y = elapsed * 0.04;
    }

    if (this.cameraAnim) {
      this.cameraAnim.progress = Math.min(1, this.cameraAnim.progress + 0.055);
      const t = 1 - Math.pow(1 - this.cameraAnim.progress, 3);
      this.camera.position.lerpVectors(this.cameraAnim.startPos, this.cameraAnim.endPos, t);
      this.controls.target.lerpVectors(this.cameraAnim.startTarget, this.cameraAnim.endTarget, t);
      if (this.cameraAnim.progress >= 1) {
        this.cameraAnim = null;
      }
    }

    const targetExplode = this.exploded ? 1 : 0;
    const step = this.reducedMotion ? 1 : 0.1;
    this.explodeProgress += (targetExplode - this.explodeProgress) * step;

    if (this.currentModel) {
      const { layers } = this.currentModel;
      layers.outsole.position.y = -0.18 * this.explodeProgress;
      layers.midsole.position.y = 0.04 * this.explodeProgress;
      layers.upper.position.y = 0.28 * this.explodeProgress;
      layers.laces.position.y = 0.56 * this.explodeProgress;
      this.shoeAnchor.position.y = 0.16 * this.explodeProgress;
    }

    if (this.controls) {
      this.controls.update();
    }

    if (this.composer) {
      this.composer.render();
    } else if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.currentModel) this.currentModel.dispose();
    if (this.envRT) this.envRT.dispose();
    if (this.composer) this.composer.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}
