import * as THREE from "three";
import { clamp, insidePool, MAX_FLOWERS, MAX_IMPULSES, POOL_D, POOL_DEPTH, POOL_W, worldToUv } from "./constants";
import { createFlower, stepFlower, type Flower, type Whirl } from "./flowers";
import { isSwirl, isTap, measureSwirl, pointerTravel, type PointerSample } from "./gestures";
import {
  CAUSTIC_FRAG,
  CAUSTIC_VERT,
  FLOWER_FRAG,
  FLOWER_VERT,
  FLOOR_FRAG,
  FLOOR_VERT,
  NORMAL_FRAG,
  SIM_FRAG,
  SIM_VERT,
  STONE_FRAG,
  STONE_VERT,
  WATER_FRAG,
  WATER_VERT,
} from "./shaders";
import { createFlowerTextures, createPalmTexture } from "./textures";
import { CpuWave } from "./wave-cpu";

export type PoolHandle = {
  reset: () => void;
  dispose: () => void;
};

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function horizontal(width: number, depth: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function frameCamera(camera: THREE.PerspectiveCamera, aspect: number): void {
  if (aspect < 0.85) {
    camera.position.set(0.1, 9.1, 6.55);
    camera.fov = 40;
  } else if (aspect < 1.25) {
    camera.position.set(0.2, 7.35, 5.85);
    camera.fov = 35;
  } else {
    camera.position.set(0.35, 6.2, 5.15);
    camera.fov = 31;
  }
  camera.aspect = aspect;
  camera.lookAt(0, -0.42, -0.05);
  camera.updateProjectionMatrix();
}

export function createPool(canvas: HTMLCanvasElement): PoolHandle {
  const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5);
  const simRes = coarse ? 160 : 256;
  const causticGrid = coarse ? 120 : 180;
  const causticSize = coarse ? 360 : 512;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !coarse,
    alpha: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x8ebfd0, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;

  const dataTarget = (width: number, height: number, type: THREE.TextureDataType, depth: boolean) => {
    const target = new THREE.WebGLRenderTarget(width, height, {
      type,
      depthBuffer: depth,
      stencilBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    return target;
  };

  const rtA = dataTarget(simRes, simRes, THREE.HalfFloatType, false);
  const rtB = dataTarget(simRes, simRes, THREE.HalfFloatType, false);
  const causticRT = dataTarget(causticSize, causticSize, THREE.UnsignedByteType, false);
  const sceneRT = dataTarget(2, 2, THREE.UnsignedByteType, true);
  const texel = new THREE.Vector2(1 / simRes, 1 / simRes);
  const poolSize = new THREE.Vector2(POOL_W, POOL_D);
  const sun = new THREE.Vector3(0.42, 0.84, 0.28).normalize();

  const clearTarget = (target: THREE.WebGLRenderTarget) => {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
  };
  clearTarget(rtA);
  clearTarget(rtB);
  renderer.setRenderTarget(null);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const flowerTextures = createFlowerTextures(anisotropy);
  const palm = createPalmTexture();

  const impulseSlots = Array.from({ length: MAX_IMPULSES }, () => new THREE.Vector4(0, 0, 0, 0.12));
  let impulseCount = 0;
  const whirlVec = new THREE.Vector4(0.5, 0.5, 0, 2.05);

  const simUniforms = {
    uState: { value: rtA.texture },
    uTexel: { value: texel },
    uPool: { value: poolSize },
    uImpulses: { value: impulseSlots },
    uWhirl: { value: whirlVec },
  };
  const simMaterial = new THREE.ShaderMaterial({
    uniforms: simUniforms,
    vertexShader: SIM_VERT,
    fragmentShader: SIM_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const normalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uState: { value: rtB.texture },
      uTexel: { value: texel },
      uPool: { value: poolSize },
    },
    vertexShader: SIM_VERT,
    fragmentShader: NORMAL_FRAG,
    depthTest: false,
    depthWrite: false,
  });

  const simScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
  quad.frustumCulled = false;
  simScene.add(quad);
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const causticUniforms = {
    uState: { value: rtA.texture },
    uPool: { value: poolSize },
    uLight: { value: new THREE.Vector3(0.22, -1, 0.12).normalize() },
    uDepth: { value: POOL_DEPTH },
    uTime: { value: 0 },
    uPointSize: { value: (causticSize / causticGrid) * (coarse ? 2.6 : 2.35) },
  };
  const causticMaterial = new THREE.ShaderMaterial({
    uniforms: causticUniforms,
    vertexShader: CAUSTIC_VERT,
    fragmentShader: CAUSTIC_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const causticGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(causticGrid * causticGrid * 3);
  const uvs = new Float32Array(causticGrid * causticGrid * 2);
  for (let y = 0; y < causticGrid; y++) {
    for (let x = 0; x < causticGrid; x++) {
      const index = y * causticGrid + x;
      const u = (x + 0.5) / causticGrid;
      const v = (y + 0.5) / causticGrid;
      positions[index * 3] = (u - 0.5) * POOL_W;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = (v - 0.5) * POOL_D;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }
  causticGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  causticGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  const causticPoints = new THREE.Points(causticGeometry, causticMaterial);
  causticPoints.frustumCulled = false;
  const causticScene = new THREE.Scene();
  causticScene.add(causticPoints);

  const floorUniforms = {
    uState: { value: rtA.texture },
    uCaustic: { value: causticRT.texture },
    uPalm: { value: palm },
    uPool: { value: poolSize },
    uTime: { value: 0 },
    uCausticScale: { value: coarse ? 4.2 : 5.4 },
  };
  const floorMaterial = new THREE.ShaderMaterial({
    uniforms: floorUniforms,
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    side: THREE.DoubleSide,
  });

  const stoneUniforms = (lift: number) => ({
    uPalm: { value: palm },
    uSun: { value: sun },
    uTime: { value: 0 },
    uLift: { value: lift },
    uPool: { value: poolSize },
    uCope: { value: new THREE.Vector2(0.46, 0.46) },
  });
  const deckUniforms = stoneUniforms(0);
  const copeUniforms = stoneUniforms(1);
  const deckMaterial = new THREE.ShaderMaterial({
    uniforms: deckUniforms,
    vertexShader: STONE_VERT,
    fragmentShader: STONE_FRAG,
    side: THREE.DoubleSide,
  });
  const copeMaterial = new THREE.ShaderMaterial({
    uniforms: copeUniforms,
    vertexShader: STONE_VERT,
    fragmentShader: STONE_FRAG,
  });

  const resolution = new THREE.Vector2(1, 1);
  const waterUniforms = {
    uState: { value: rtA.texture },
    uScene: { value: sceneRT.texture },
    uPalm: { value: palm },
    uResolution: { value: resolution },
    uPool: { value: poolSize },
    uSun: { value: sun },
    uTime: { value: 0 },
  };
  const segments = coarse ? 56 : 88;
  const waterGeometry = new THREE.PlaneGeometry(POOL_W, POOL_D, segments, segments);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = 0.02;

  const flowerMaterials = flowerTextures.map((texture) => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uState: { value: rtA.texture },
        uPool: { value: poolSize },
        uHeightGain: { value: 1 },
      },
      vertexShader: FLOWER_VERT,
      fragmentShader: FLOWER_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
  });
  const petal = new THREE.PlaneGeometry(0.64, 0.64);
  const lay = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const surfaceFlowers: THREE.InstancedMesh[] = [];
  const underFlowers: THREE.InstancedMesh[] = [];
  const white = new THREE.Color(1, 1, 1);
  const sunk = new THREE.Color(0.58, 0.74, 0.86);
  for (const material of flowerMaterials) {
    const above = new THREE.InstancedMesh(petal, material, MAX_FLOWERS);
    const below = new THREE.InstancedMesh(petal, material, MAX_FLOWERS);
    above.frustumCulled = false;
    below.frustumCulled = false;
    above.count = 0;
    below.count = 0;
    for (let i = 0; i < MAX_FLOWERS; i++) {
      above.setColorAt(i, white);
      below.setColorAt(i, sunk);
    }
    surfaceFlowers.push(above);
    underFlowers.push(below);
  }

  const underScene = new THREE.Scene();
  const mainScene = new THREE.Scene();
  const addBasin = (scene: THREE.Scene) => {
    const floor = new THREE.Mesh(horizontal(POOL_W, POOL_D), floorMaterial);
    floor.position.y = -POOL_DEPTH;
    scene.add(floor);
    const height = POOL_DEPTH + 0.05;
    const y = -POOL_DEPTH / 2 + 0.015;
    const south = new THREE.Mesh(new THREE.PlaneGeometry(POOL_W, height), floorMaterial);
    south.position.set(0, y, -POOL_D / 2);
    const north = new THREE.Mesh(new THREE.PlaneGeometry(POOL_W, height), floorMaterial);
    north.position.set(0, y, POOL_D / 2);
    north.rotation.y = Math.PI;
    const east = new THREE.Mesh(new THREE.PlaneGeometry(POOL_D, height), floorMaterial);
    east.position.set(POOL_W / 2, y, 0);
    east.rotation.y = -Math.PI / 2;
    const west = new THREE.Mesh(new THREE.PlaneGeometry(POOL_D, height), floorMaterial);
    west.position.set(-POOL_W / 2, y, 0);
    west.rotation.y = Math.PI / 2;
    scene.add(south, north, east, west);
  };
  addBasin(underScene);
  addBasin(mainScene);

  const cope = 0.46;
  const innerW = POOL_W + cope * 2;
  const innerD = POOL_D + cope * 2;
  const outerW = 26;
  const outerD = 20;
  const stripX = (outerW - innerW) / 2;
  const stripZ = (outerD - innerD) / 2;
  const deckPieces = [
    [outerW, stripZ, 0, -(innerD / 2 + stripZ / 2)],
    [outerW, stripZ, 0, innerD / 2 + stripZ / 2],
    [stripX, innerD, -(innerW / 2 + stripX / 2), 0],
    [stripX, innerD, innerW / 2 + stripX / 2, 0],
  ] as const;
  for (const [width, depth, x, z] of deckPieces) {
    const mesh = new THREE.Mesh(horizontal(width, depth), deckMaterial);
    mesh.position.set(x, 0, z);
    mainScene.add(mesh);
  }
  const copeH = 0.11;
  const copePieces = [
    [innerW, copeH, cope, 0, copeH / 2, -(POOL_D / 2 + cope / 2)],
    [innerW, copeH, cope, 0, copeH / 2, POOL_D / 2 + cope / 2],
    [cope, copeH, POOL_D, POOL_W / 2 + cope / 2, copeH / 2, 0],
    [cope, copeH, POOL_D, -(POOL_W / 2 + cope / 2), copeH / 2, 0],
  ] as const;
  for (const [w, h, d, x, y, z] of copePieces) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), copeMaterial);
    mesh.position.set(x, y, z);
    mainScene.add(mesh);
  }
  mainScene.add(water);
  for (const mesh of surfaceFlowers) mainScene.add(mesh);
  for (const mesh of underFlowers) underScene.add(mesh);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const drawSize = new THREE.Vector2();

  const resize = () => {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    frameCamera(camera, width / Math.max(height, 1));
    renderer.getDrawingBufferSize(drawSize);
    let rtW = drawSize.x;
    let rtH = drawSize.y;
    const maxEdge = coarse ? 1100 : 1600;
    const edge = Math.max(rtW, rtH);
    if (edge > maxEdge) {
      const scale = maxEdge / edge;
      rtW = Math.max(2, Math.round(rtW * scale));
      rtH = Math.max(2, Math.round(rtH * scale));
    }
    if (sceneRT.width !== rtW || sceneRT.height !== rtH) sceneRT.setSize(rtW, rtH);
    resolution.set(drawSize.x, drawSize.y);
  };
  resize();
  const resizeObserver = new ResizeObserver(() => resize());
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

  const cpu = new CpuWave(coarse ? 40 : 48);
  const flowers: Flower[] = [];
  const whirl: Whirl = { x: 0, z: 0, strength: 0, radius: 3.4 };
  const wakeAt = new Map<number, { x: number; z: number }>();
  let nextId = 1;
  let disposed = false;

  const spawnInitial = () => {
    const rand = mulberry32(27);
    const spots = [
      { x: -1.55, z: 0.4, variant: 0 },
      { x: 0.9, z: -0.8, variant: 4 },
      { x: 1.65, z: 0.95, variant: 2 },
    ];
    for (const spot of spots) {
      flowers.push(
        createFlower({
          id: nextId++,
          x: spot.x,
          z: spot.z,
          variant: spot.variant,
          yaw: rand() * Math.PI * 2,
          spin: (rand() * 0.28 + 0.1) * (rand() < 0.5 ? -1 : 1),
          tilt: (rand() - 0.5) * 0.22,
          scale: 0.86 + rand() * 0.28,
        }),
      );
    }
  };
  spawnInitial();

  const clearImpulses = () => {
    for (const slot of impulseSlots) slot.set(0, 0, 0, 0.12);
    impulseCount = 0;
  };

  const pushImpulse = (x: number, z: number, amplitude: number, radius: number) => {
    if (!insidePool(x, z, -0.15)) return;
    cpu.impulse(x, z, amplitude, radius);
    if (impulseCount >= MAX_IMPULSES) return;
    const uv = worldToUv(x, z);
    impulseSlots[impulseCount]?.set(uv.u, uv.v, amplitude, radius);
    impulseCount += 1;
  };

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const qYaw = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const tint = new THREE.Color();

  const writeFlower = (mesh: THREE.InstancedMesh, index: number, flower: Flower) => {
    const sink = clamp(-flower.y / 0.78, 0, 1);
    qYaw.setFromAxisAngle(UP, flower.yaw);
    qTilt.setFromAxisAngle(Z_AXIS, flower.tilt * (1 - sink));
    quaternion.copy(qYaw).multiply(lay).multiply(qTilt);
    position.set(flower.x, flower.y * 0.65 + 0.05, flower.z);
    const size = flower.scale * (1 - sink * 0.48);
    scale.set(size, size, size);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    tint.setRGB(1 - sink * 0.78, 1 - sink * 0.58, 1 - sink * 0.28);
    mesh.setColorAt(index, tint);
  };

  const syncFlowers = () => {
    const aboveCount = new Array<number>(flowerTextures.length).fill(0);
    for (const flower of flowers) {
      const above = surfaceFlowers[flower.variant];
      if (!above) continue;
      const index = aboveCount[flower.variant] ?? 0;
      aboveCount[flower.variant] = index + 1;
      writeFlower(above, index, flower);
    }
    surfaceFlowers.forEach((mesh, variant) => {
      mesh.count = aboveCount[variant] ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    for (const mesh of underFlowers) {
      mesh.count = 0;
      mesh.visible = false;
    }
  };

  const update = (dt: number, now: number) => {
    whirl.strength *= Math.exp(-dt * 0.16);
    if (whirl.strength < 0.02) whirl.strength = 0;
    if (whirl.strength > 0.04) {
      const angle = now * 0.0045;
      const orbit = 0.5;
      pushImpulse(
        whirl.x + Math.cos(angle) * orbit,
        whirl.z + Math.sin(angle) * orbit,
        -0.04 * whirl.strength,
        0.11,
      );
      pushImpulse(
        whirl.x + Math.cos(angle + Math.PI) * orbit,
        whirl.z + Math.sin(angle + Math.PI) * orbit,
        -0.018 * whirl.strength,
        0.1,
      );
    }

    for (const flower of flowers) {
      const previousY = flower.y;
      const slope = cpu.sample(flower.x, flower.z);
      stepFlower(flower, dt, slope, whirl);
      if (!flower.held && previousY < -0.08 && flower.y > -0.04 && flower.vy > 0) {
        pushImpulse(flower.x, flower.z, -0.06, 0.15);
      }
      if (!flower.held) {
        const speed = Math.hypot(flower.vx, flower.vz);
        const last = wakeAt.get(flower.id);
        if (speed > 0.28 && (!last || Math.hypot(flower.x - last.x, flower.z - last.z) > 0.12)) {
          pushImpulse(flower.x, flower.z, -0.02 * Math.min(speed, 1.4), 0.09);
          wakeAt.set(flower.id, { x: flower.x, z: flower.z });
        }
      }
    }
    cpu.step();
    syncFlowers();

    const uv = worldToUv(whirl.x, whirl.z);
    whirlVec.set(uv.u, uv.v, whirl.strength, whirl.radius);
    const time = now / 1000;
    causticUniforms.uTime.value = time;
    floorUniforms.uTime.value = time;
    waterUniforms.uTime.value = time;
    deckUniforms.uTime.value = time;
    copeUniforms.uTime.value = time;
  };

  const render = () => {
    quad.material = simMaterial;
    simUniforms.uState.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, simCamera);

    quad.material = normalMaterial;
    normalMaterial.uniforms.uState.value = rtB.texture;
    renderer.setRenderTarget(rtA);
    renderer.render(simScene, simCamera);
    clearImpulses();

    renderer.setRenderTarget(causticRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    renderer.render(causticScene, simCamera);

    for (const material of flowerMaterials) material.uniforms.uHeightGain.value = 0.2;
    renderer.setRenderTarget(sceneRT);
    renderer.setClearColor(0x0c4e5c, 1);
    renderer.clear(true, true, false);
    renderer.render(underScene, camera);

    for (const material of flowerMaterials) material.uniforms.uHeightGain.value = 1.85;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x8ebfd0, 1);
    renderer.clear(true, true, false);
    renderer.render(mainScene, camera);
  };

  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    if (disposed) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      update(dt, now);
      render();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
  const hitPoint = new THREE.Vector3();
  let mode: "idle" | "stir" | "hold" = "idle";
  let held: Flower | null = null;
  let samples: PointerSample[] = [];
  let stirring = false;
  let pointerId = -1;
  const lastRipple = { x: 99, z: 99 };

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(waterPlane, hitPoint);
  };

  const nearestFlower = (x: number, z: number, radius: number) => {
    let best: Flower | null = null;
    let bestDistance = radius;
    for (const flower of flowers) {
      const distance = Math.hypot(flower.x - x, flower.z - z);
      if (distance < bestDistance) {
        best = flower;
        bestDistance = distance;
      }
    }
    return best;
  };

  const spawn = (x: number, z: number) => {
    if (flowers.length >= MAX_FLOWERS) {
      const index = flowers.findIndex((flower) => !flower.held);
      if (index >= 0) {
        const removed = flowers[index];
        if (removed) wakeAt.delete(removed.id);
        flowers.splice(index, 1);
      }
    }
    const variant = Math.floor(Math.random() * flowerTextures.length);
    flowers.push(
      createFlower({
        id: nextId++,
        x,
        z,
        variant,
        yaw: Math.random() * Math.PI * 2,
        spin: (Math.random() * 0.32 + 0.12) * (Math.random() < 0.5 ? -1 : 1),
        tilt: (Math.random() - 0.5) * 0.28,
        scale: 0.8 + Math.random() * 0.38,
      }),
    );
  };

  const onDown = (event: PointerEvent) => {
    if (pointerId !== -1) return;
    const world = clientToWorld(event.clientX, event.clientY);
    if (!world || !insidePool(world.x, world.z, 0.02)) return;
    canvas.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    samples = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
    stirring = false;
    const grab = event.pointerType === "touch" ? 0.66 : 0.42;
    const flower = nearestFlower(world.x, world.z, grab);
    if (flower) {
      mode = "hold";
      held = flower;
      flower.held = true;
      pushImpulse(flower.x, flower.z, -0.04, 0.12);
      lastRipple.x = flower.x;
      lastRipple.z = flower.z;
    } else {
      mode = "stir";
      held = null;
      lastRipple.x = world.x;
      lastRipple.z = world.z;
    }
    event.preventDefault();
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || mode === "idle") return;
    const world = clientToWorld(event.clientX, event.clientY);
    if (!world) return;
    samples.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (samples.length > 180) samples.shift();
    if (mode === "hold" && held) {
      const limX = POOL_W / 2 - 0.36;
      const limZ = POOL_D / 2 - 0.36;
      const nextX = clamp(world.x, -limX, limX);
      const nextZ = clamp(world.z, -limZ, limZ);
      const previous = samples[samples.length - 2];
      const latest = samples[samples.length - 1];
      const slice = previous && latest ? Math.max((latest.t - previous.t) / 1000, 0.008) : 0.016;
      held.vx = clamp((nextX - held.x) / slice, -2.4, 2.4);
      held.vz = clamp((nextZ - held.z) / slice, -2.4, 2.4);
      held.x = nextX;
      held.z = nextZ;
      if (Math.hypot(nextX - lastRipple.x, nextZ - lastRipple.z) > 0.08) {
        pushImpulse(nextX, nextZ, -0.036, 0.11);
        lastRipple.x = nextX;
        lastRipple.z = nextZ;
      }
    } else if (mode === "stir") {
      const slop = event.pointerType === "touch" ? 16 : 8;
      if (pointerTravel(samples) > slop && insidePool(world.x, world.z, 0.02)) {
        stirring = true;
        if (Math.hypot(world.x - lastRipple.x, world.z - lastRipple.z) > 0.07) {
          pushImpulse(world.x, world.z, -0.03, 0.1);
          lastRipple.x = world.x;
          lastRipple.z = world.z;
        }
        const measured = measureSwirl(samples, 2600);
        const strongTurn = measured !== null && Math.abs(measured.signedAngle) >= 4.2 && measured.pathLength >= 90;
        if (measured && (isSwirl(measured) || strongTurn)) {
          const center = clientToWorld(measured.centerX, measured.centerY);
          if (center && insidePool(center.x, center.z, 0.05)) {
            const follow = whirl.strength > 0.08 ? 0.35 : 1;
            whirl.x += (center.x - whirl.x) * follow;
            whirl.z += (center.z - whirl.z) * follow;
            whirl.strength = Math.min(1, whirl.strength + 0.35);
            whirl.radius = 3.4;
          }
        }
      }
    }
    event.preventDefault();
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const world = clientToWorld(event.clientX, event.clientY);
    if (mode === "stir" && !stirring && world && insidePool(world.x, world.z, 0.12)) {
      const tap = isTap(samples, {
        maxMovePx: event.pointerType === "touch" ? 22 : 10,
        maxDurationMs: 450,
      });
      if (tap) {
        const limX = POOL_W / 2 - 0.4;
        const limZ = POOL_D / 2 - 0.4;
        const x = clamp(world.x, -limX, limX);
        const z = clamp(world.z, -limZ, limZ);
        spawn(x, z);
        pushImpulse(x, z, -0.085, 0.18);
      }
    }
    if (held) {
      held.held = false;
      held = null;
    }
    mode = "idle";
    pointerId = -1;
  };

  const abort = new AbortController();
  const listen = { signal: abort.signal } as const;
  canvas.addEventListener("pointerdown", onDown, listen);
  canvas.addEventListener("pointermove", onMove, listen);
  canvas.addEventListener("pointerup", onUp, listen);
  canvas.addEventListener("pointercancel", onUp, listen);

  const reset = () => {
    if (held) held.held = false;
    held = null;
    mode = "idle";
    pointerId = -1;
    flowers.length = 0;
    nextId = 1;
    wakeAt.clear();
    whirl.x = 0;
    whirl.z = 0;
    whirl.strength = 0;
    spawnInitial();
    cpu.clear();
    clearImpulses();
    clearTarget(rtA);
    clearTarget(rtB);
    renderer.setRenderTarget(null);
  };

  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    abort.abort();
    resizeObserver.disconnect();
    rtA.dispose();
    rtB.dispose();
    causticRT.dispose();
    sceneRT.dispose();
    petal.dispose();
    waterGeometry.dispose();
    causticGeometry.dispose();
    for (const texture of flowerTextures) texture.dispose();
    palm.dispose();
    renderer.dispose();
  };

  return { reset, dispose };
}
