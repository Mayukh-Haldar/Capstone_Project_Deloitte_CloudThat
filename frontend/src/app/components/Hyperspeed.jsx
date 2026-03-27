import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from "postprocessing";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./Hyperspeed.css";

const DEFAULT_EFFECT_OPTIONS = {
  onSpeedUp: () => {},
  onSlowDown: () => {},
  distortion: "turbulentDistortion",
  length: 400,
  roadWidth: 10,
  islandWidth: 2,
  lanesPerRoad: 4,
  fov: 90,
  fovSpeedUp: 150,
  speedUp: 2,
  carLightsFade: 0.4,
  totalSideLightSticks: 20,
  lightPairsPerRoadWay: 40,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [60, 80],
  movingCloserSpeed: [-120, -160],
  carLightsLength: [12, 80],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.8, 0.8],
  carFloorSeparation: [0, 5],
  colors: {
    roadColor: 0x080808,
    islandColor: 0x0a0a0a,
    background: 0x000000,
    shoulderLines: 0xffffff,
    brokenLines: 0xffffff,
    leftCars: [0xd856bf, 0x6750a2, 0xc247ac],
    rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
    sticks: 0x03b3c3
  }
};

const random = (base) => Array.isArray(base) ? Math.random() * (base[1] - base[0]) + base[0] : Math.random() * base;
const pickRandom = (arr) => Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
const lerp = (current, target, speed = 0.1, limit = 0.001) => {
  let change = (target - current) * speed;
  if (Math.abs(change) < limit) change = target - current;
  return change;
};

const roadVertex = `
  #define USE_FOG;
  uniform float uTravelLength; varying vec2 vUv; ${THREE.ShaderChunk.fog_pars_vertex}
  #include <getDistortion_vertex>
  void main() {
    vec3 transformed = position.xyz;
    vec3 distortion = getDistortion((transformed.y + uTravelLength / 2.) / uTravelLength);
    transformed.x += distortion.x; transformed.z += distortion.y; transformed.y += -1. * distortion.z;
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
    gl_Position = projectionMatrix * mvPosition; vUv = uv; ${THREE.ShaderChunk.fog_vertex}
  }
`;

const roadBaseFragment = `
  #define USE_FOG;
  varying vec2 vUv; uniform vec3 uColor; uniform float uTime; #include <roadMarkings_vars>
  ${THREE.ShaderChunk.fog_pars_fragment}
  void main() { vec2 uv = vUv; vec3 color = vec3(uColor); #include <roadMarkings_fragment> gl_FragColor = vec4(color, 1.); ${THREE.ShaderChunk.fog_fragment} }
`;

const roadFragment = roadBaseFragment
  .replace("#include <roadMarkings_vars>", `
    uniform float uLanes; uniform vec3 uBrokenLinesColor; uniform vec3 uShoulderLinesColor;
    uniform float uShoulderLinesWidthPercentage; uniform float uBrokenLinesWidthPercentage; uniform float uBrokenLinesLengthPercentage;
  `)
  .replace("#include <roadMarkings_fragment>", `
    uv.y = mod(uv.y + uTime * 0.05, 1.);
    float laneWidth = 1.0 / uLanes;
    float brokenLineWidth = laneWidth * uBrokenLinesWidthPercentage;
    float laneEmptySpace = 1. - uBrokenLinesLengthPercentage;
    float brokenLines = step(1.0 - brokenLineWidth, fract(uv.x * 2.0)) * step(laneEmptySpace, fract(uv.y * 10.0));
    float sideLines = step(1.0 - brokenLineWidth, fract((uv.x - laneWidth * (uLanes - 1.0)) * 2.0)) + step(brokenLineWidth, uv.x);
    color = mix(color, uBrokenLinesColor, brokenLines);
    color = mix(color, uShoulderLinesColor, clamp(sideLines, 0.0, 1.0));
  `);

const islandFragment = roadBaseFragment
  .replace("#include <roadMarkings_vars>", "")
  .replace("#include <roadMarkings_fragment>", "");

const carLightsVertex = `
  #define USE_FOG;
  attribute vec3 aOffset; attribute vec3 aMetrics; attribute vec3 aColor;
  uniform float uTravelLength; uniform float uTime; varying vec2 vUv; varying vec3 vColor;
  ${THREE.ShaderChunk.fog_pars_vertex}
  #include <getDistortion_vertex>
  void main() {
    vec3 transformed = position.xyz; float radius = aMetrics.r; float myLength = aMetrics.g; float speed = aMetrics.b;
    transformed.xy *= radius; transformed.z *= myLength; transformed.z += myLength - mod(uTime * speed + aOffset.z, uTravelLength); transformed.xy += aOffset.xy;
    float progress = abs(transformed.z / uTravelLength); transformed.xyz += getDistortion(progress);
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.); gl_Position = projectionMatrix * mvPosition; vUv = uv; vColor = aColor; ${THREE.ShaderChunk.fog_vertex}
  }
`;

const carLightsFragment = `
  #define USE_FOG;
  varying vec3 vColor; varying vec2 vUv; uniform vec2 uFade;
  ${THREE.ShaderChunk.fog_pars_fragment}
  void main() { float alpha = smoothstep(uFade.x, uFade.y, vUv.x); gl_FragColor = vec4(vColor, alpha); if (gl_FragColor.a < 0.0001) discard; ${THREE.ShaderChunk.fog_fragment} }
`;

const sideSticksVertex = `
  #define USE_FOG;
  attribute float aOffset; attribute vec3 aColor; attribute vec2 aMetrics;
  uniform float uTravelLength; uniform float uTime; varying vec3 vColor;
  ${THREE.ShaderChunk.fog_pars_vertex}
  mat4 rotationY(in float angle){ return mat4(cos(angle),0,sin(angle),0,0,1.0,0,0,-sin(angle),0,cos(angle),0,0,0,0,1); }
  #include <getDistortion_vertex>
  void main(){
    vec3 transformed = position.xyz; float width = aMetrics.x; float height = aMetrics.y; transformed.xy *= vec2(width, height);
    float time = mod(uTime * 120. + aOffset, uTravelLength); transformed = (rotationY(3.14/2.) * vec4(transformed,1.)).xyz; transformed.z += -uTravelLength + time;
    float progress = abs(transformed.z / uTravelLength); transformed.xyz += getDistortion(progress); transformed.y += height / 2.; transformed.x += -width / 2.;
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.); gl_Position = projectionMatrix * mvPosition; vColor = aColor; ${THREE.ShaderChunk.fog_vertex}
  }
`;

const sideSticksFragment = `
  #define USE_FOG;
  varying vec3 vColor; ${THREE.ShaderChunk.fog_pars_fragment}
  void main(){ gl_FragColor = vec4(vColor,1.); ${THREE.ShaderChunk.fog_fragment} }
`;

const createDistortions = () => {
  const distortionUniforms = { uDistortionX: { value: new THREE.Vector2(80, 3) }, uDistortionY: { value: new THREE.Vector2(-40, 2.5) } };
  const turbulentUniforms = { uFreq: { value: new THREE.Vector4(4, 8, 8, 1) }, uAmp: { value: new THREE.Vector4(25, 5, 10, 10) } };
  const nsin = (val) => Math.sin(val) * 0.5 + 0.5;
  return {
    defaultDistortion: {
      uniforms: distortionUniforms,
      getDistortion: `
        #define PI 3.14159265358979
        uniform vec2 uDistortionX; uniform vec2 uDistortionY;
        float nsin(float val){ return sin(val) * 0.5 + 0.5; }
        vec3 getDistortion(float progress){
          progress = clamp(progress, 0., 1.);
          return vec3(uDistortionX.r * nsin(progress * PI * uDistortionX.g - PI / 2.), uDistortionY.r * nsin(progress * PI * uDistortionY.g - PI / 2.), 0.);
        }
      `
    },
    turbulentDistortion: {
      uniforms: turbulentUniforms,
      getDistortion: `
        uniform vec4 uFreq; uniform vec4 uAmp; #define PI 3.14159265358979
        float nsin(float val){ return sin(val) * 0.5 + 0.5; }
        float getDistortionX(float progress){ return cos(PI * progress * uFreq.r + uTime) * uAmp.r + pow(cos(PI * progress * uFreq.g + uTime * (uFreq.g / uFreq.r)), 2.) * uAmp.g; }
        float getDistortionY(float progress){ return -nsin(PI * progress * uFreq.b + uTime) * uAmp.b - pow(nsin(PI * progress * uFreq.a + uTime / (uFreq.b / uFreq.a)), 5.) * uAmp.a; }
        vec3 getDistortion(float progress){ return vec3(getDistortionX(progress) - getDistortionX(0.0125), getDistortionY(progress) - getDistortionY(0.0125), 0.); }
      `,
      getJS: (progress, time) => {
        const uFreq = turbulentUniforms.uFreq.value;
        const uAmp = turbulentUniforms.uAmp.value;
        const getX = (p) => Math.cos(Math.PI * p * uFreq.x + time) * uAmp.x + Math.pow(Math.cos(Math.PI * p * uFreq.y + time * (uFreq.y / uFreq.x)), 2) * uAmp.y;
        const getY = (p) => -nsin(Math.PI * p * uFreq.z + time) * uAmp.z - Math.pow(nsin(Math.PI * p * uFreq.w + time / (uFreq.z / uFreq.w)), 5) * uAmp.w;
        return new THREE.Vector3(getX(progress) - getX(progress + 0.007), getY(progress) - getY(progress + 0.007), 0).multiply(new THREE.Vector3(-2, -5, 0)).add(new THREE.Vector3(0, 0, -10));
      }
    }
  };
};

class CarLights {
  constructor(webgl, options, colors, speed, fade) { this.webgl = webgl; this.options = options; this.colors = colors; this.speed = speed; this.fade = fade; }
  init() {
    const options = this.options;
    const geometry = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)), 40, 1, 8, false);
    const instanced = new THREE.InstancedBufferGeometry().copy(geometry);
    instanced.instanceCount = options.lightPairsPerRoadWay * 2;
    const laneWidth = options.roadWidth / options.lanesPerRoad;
    const aOffset = [], aMetrics = [], aColor = [];
    let colors = Array.isArray(this.colors) ? this.colors.map((c) => new THREE.Color(c)) : new THREE.Color(this.colors);
    for (let i = 0; i < options.lightPairsPerRoadWay; i += 1) {
      const radius = random(options.carLightsRadius), length = random(options.carLightsLength), speed = random(this.speed), carLane = i % options.lanesPerRoad, carWidth = random(options.carWidthPercentage) * laneWidth, offsetY = random(options.carFloorSeparation) + radius * 1.3, offsetZ = -random(options.length);
      let laneX = carLane * laneWidth - options.roadWidth / 2 + laneWidth / 2 + random(options.carShiftX) * laneWidth;
      aOffset.push(laneX - carWidth / 2, offsetY, offsetZ, laneX + carWidth / 2, offsetY, offsetZ);
      aMetrics.push(radius, length, speed, radius, length, speed);
      const color = pickRandom(colors); aColor.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    instanced.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 3, false));
    instanced.setAttribute("aMetrics", new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 3, false));
    instanced.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));
    const material = new THREE.ShaderMaterial({ fragmentShader: carLightsFragment, vertexShader: carLightsVertex, transparent: true, uniforms: Object.assign({ uTime: { value: 0 }, uTravelLength: { value: options.length }, uFade: { value: this.fade } }, this.webgl.fogUniforms, options.distortion.uniforms) });
    material.onBeforeCompile = (shader) => { shader.vertexShader = shader.vertexShader.replace("#include <getDistortion_vertex>", options.distortion.getDistortion); };
    this.mesh = new THREE.Mesh(instanced, material); this.mesh.frustumCulled = false; this.webgl.scene.add(this.mesh);
  }
  update(time) { this.mesh.material.uniforms.uTime.value = time; }
}

class LightsSticks {
  constructor(webgl, options) { this.webgl = webgl; this.options = options; }
  init() {
    const options = this.options, instanced = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1)), totalSticks = options.totalSideLightSticks, stickOffset = options.length / (totalSticks - 1), aOffset = [], aColor = [], aMetrics = [];
    instanced.instanceCount = totalSticks;
    let colors = Array.isArray(options.colors.sticks) ? options.colors.sticks.map((c) => new THREE.Color(c)) : new THREE.Color(options.colors.sticks);
    for (let i = 0; i < totalSticks; i += 1) { aOffset.push((i - 1) * stickOffset * 2 + stickOffset * Math.random()); const color = pickRandom(colors); aColor.push(color.r, color.g, color.b); aMetrics.push(random(options.lightStickWidth), random(options.lightStickHeight)); }
    instanced.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 1, false));
    instanced.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));
    instanced.setAttribute("aMetrics", new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 2, false));
    const material = new THREE.ShaderMaterial({ fragmentShader: sideSticksFragment, vertexShader: sideSticksVertex, side: THREE.DoubleSide, uniforms: Object.assign({ uTravelLength: { value: options.length }, uTime: { value: 0 } }, this.webgl.fogUniforms, options.distortion.uniforms) });
    material.onBeforeCompile = (shader) => { shader.vertexShader = shader.vertexShader.replace("#include <getDistortion_vertex>", options.distortion.getDistortion); };
    this.mesh = new THREE.Mesh(instanced, material); this.mesh.frustumCulled = false; this.webgl.scene.add(this.mesh);
  }
  update(time) { this.mesh.material.uniforms.uTime.value = time; }
}

class Road {
  constructor(webgl, options) { this.webgl = webgl; this.options = options; this.uTime = { value: 0 }; }
  createPlane(side, isRoad) {
    const options = this.options;
    let uniforms = { uTravelLength: { value: options.length }, uColor: { value: new THREE.Color(isRoad ? options.colors.roadColor : options.colors.islandColor) }, uTime: this.uTime };
    if (isRoad) uniforms = Object.assign(uniforms, { uLanes: { value: options.lanesPerRoad }, uBrokenLinesColor: { value: new THREE.Color(options.colors.brokenLines) }, uShoulderLinesColor: { value: new THREE.Color(options.colors.shoulderLines) }, uShoulderLinesWidthPercentage: { value: options.shoulderLinesWidthPercentage }, uBrokenLinesLengthPercentage: { value: options.brokenLinesLengthPercentage }, uBrokenLinesWidthPercentage: { value: options.brokenLinesWidthPercentage } });
    const material = new THREE.ShaderMaterial({ fragmentShader: isRoad ? roadFragment : islandFragment, vertexShader: roadVertex, side: THREE.DoubleSide, uniforms: Object.assign(uniforms, this.webgl.fogUniforms, options.distortion.uniforms) });
    material.onBeforeCompile = (shader) => { shader.vertexShader = shader.vertexShader.replace("#include <getDistortion_vertex>", options.distortion.getDistortion); };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(isRoad ? options.roadWidth : options.islandWidth, options.length, 20, 100), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.z = -options.length / 2; mesh.position.x += (options.islandWidth / 2 + options.roadWidth / 2) * side; this.webgl.scene.add(mesh); return mesh;
  }
  init() { this.leftRoadWay = this.createPlane(-1, true); this.rightRoadWay = this.createPlane(1, true); this.island = this.createPlane(0, false); }
  update(time) { this.uTime.value = time; }
}

class App {
  constructor(container, options) {
    this.options = options; this.container = container; this.hasValidSize = false; this.disposed = false; this.tick = this.tick.bind(this); this.onWindowResize = this.onWindowResize.bind(this); this.onMouseDown = this.onMouseDown.bind(this); this.onMouseUp = this.onMouseUp.bind(this); this.onTouchStart = this.onTouchStart.bind(this); this.onTouchEnd = this.onTouchEnd.bind(this); this.onContextMenu = this.onContextMenu.bind(this); this.setSize = this.setSize.bind(this);
    const initW = Math.max(1, container.offsetWidth), initH = Math.max(1, container.offsetHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); this.renderer.setSize(initW, initH, false); this.renderer.setPixelRatio(window.devicePixelRatio);
    this.composer = new EffectComposer(this.renderer); container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(options.fov, initW / initH, 0.1, 10000); this.camera.position.set(0, 8, -5);
    this.scene = new THREE.Scene(); this.scene.background = null;
    const fog = new THREE.Fog(options.colors.background, options.length * 0.2, options.length * 500);
    this.scene.fog = fog; this.fogUniforms = { fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far } };
    this.clock = new THREE.Clock(); this.road = new Road(this, options); this.leftCarLights = new CarLights(this, options, options.colors.leftCars, options.movingAwaySpeed, new THREE.Vector2(0, 1 - options.carLightsFade)); this.rightCarLights = new CarLights(this, options, options.colors.rightCars, options.movingCloserSpeed, new THREE.Vector2(1, options.carLightsFade)); this.leftSticks = new LightsSticks(this, options);
    this.fovTarget = options.fov; this.speedUpTarget = 0; this.speedUp = 0; this.timeOffset = 0;
    window.addEventListener("resize", this.onWindowResize); if (container.offsetWidth > 0 && container.offsetHeight > 0) this.hasValidSize = true;
  }
  loadAssets() { return Promise.resolve(); }
  initPasses() { this.composer.addPass(new RenderPass(this.scene, this.camera)); this.composer.addPass(new EffectPass(this.camera, new BloomEffect({ luminanceThreshold: 0.2, luminanceSmoothing: 0, resolutionScale: 1 }))); const smaaPass = new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM })); smaaPass.renderToScreen = true; this.composer.addPass(smaaPass); }
  init() {
    const options = this.options; this.initPasses(); this.road.init(); this.leftCarLights.init(); this.leftCarLights.mesh.position.setX(-options.roadWidth / 2 - options.islandWidth / 2); this.rightCarLights.init(); this.rightCarLights.mesh.position.setX(options.roadWidth / 2 + options.islandWidth / 2); this.leftSticks.init(); this.leftSticks.mesh.position.setX(-(options.roadWidth + options.islandWidth / 2));
    this.container.addEventListener("mousedown", this.onMouseDown); this.container.addEventListener("mouseup", this.onMouseUp); this.container.addEventListener("mouseout", this.onMouseUp); this.container.addEventListener("touchstart", this.onTouchStart, { passive: true }); this.container.addEventListener("touchend", this.onTouchEnd, { passive: true }); this.container.addEventListener("touchcancel", this.onTouchEnd, { passive: true }); this.container.addEventListener("contextmenu", this.onContextMenu); this.tick();
  }
  onMouseDown(ev) { this.options.onSpeedUp?.(ev); this.fovTarget = this.options.fovSpeedUp; this.speedUpTarget = this.options.speedUp; }
  onMouseUp(ev) { this.options.onSlowDown?.(ev); this.fovTarget = this.options.fov; this.speedUpTarget = 0; }
  onTouchStart(ev) { this.onMouseDown(ev); }
  onTouchEnd(ev) { this.onMouseUp(ev); }
  onContextMenu(ev) { ev.preventDefault(); }
  onWindowResize() { const width = this.container.offsetWidth, height = this.container.offsetHeight; if (width <= 0 || height <= 0) { this.hasValidSize = false; return; } this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.composer.setSize(width, height); this.hasValidSize = true; }
  update(delta) {
    const lerpPercentage = Math.exp(-(-60 * Math.log2(1 - 0.1)) * delta); this.speedUp += lerp(this.speedUp, this.speedUpTarget, lerpPercentage, 0.00001); this.timeOffset += this.speedUp * delta; const time = this.clock.elapsedTime + this.timeOffset;
    this.rightCarLights.update(time); this.leftCarLights.update(time); this.leftSticks.update(time); this.road.update(time);
    let updateCamera = false; const fovChange = lerp(this.camera.fov, this.fovTarget, lerpPercentage); if (fovChange !== 0) { this.camera.fov += fovChange * delta * 6; updateCamera = true; }
    if (this.options.distortion.getJS) { const d = this.options.distortion.getJS(0.025, time); this.camera.lookAt(new THREE.Vector3(this.camera.position.x + d.x, this.camera.position.y + d.y, this.camera.position.z + d.z)); updateCamera = true; }
    if (updateCamera) this.camera.updateProjectionMatrix();
  }
  render(delta) { this.composer.render(delta); }
  setSize(width, height) { if (width <= 0 || height <= 0) { this.hasValidSize = false; return; } this.composer.setSize(width, height); this.hasValidSize = true; }
  dispose() {
    this.disposed = true; this.scene?.traverse((object) => { if (!object.isMesh) return; object.geometry?.dispose(); if (object.material) Array.isArray(object.material) ? object.material.forEach((m) => m.dispose()) : object.material.dispose(); }); this.scene?.clear();
    this.renderer?.dispose(); this.renderer?.forceContextLoss(); if (this.renderer?.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement); this.composer?.dispose();
    window.removeEventListener("resize", this.onWindowResize);
    if (this.container) { this.container.removeEventListener("mousedown", this.onMouseDown); this.container.removeEventListener("mouseup", this.onMouseUp); this.container.removeEventListener("mouseout", this.onMouseUp); this.container.removeEventListener("touchstart", this.onTouchStart); this.container.removeEventListener("touchend", this.onTouchEnd); this.container.removeEventListener("touchcancel", this.onTouchEnd); this.container.removeEventListener("contextmenu", this.onContextMenu); }
  }
  tick() {
    if (this.disposed) return;
    if (!this.hasValidSize) { const w = this.container.offsetWidth, h = this.container.offsetHeight; if (w > 0 && h > 0) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.composer.setSize(w, h); this.hasValidSize = true; } else { requestAnimationFrame(this.tick); return; } }
    if (resizeRendererToDisplaySize(this.renderer, this.setSize)) { const canvas = this.renderer.domElement; if (this.hasValidSize) { this.camera.aspect = canvas.clientWidth / canvas.clientHeight; this.camera.updateProjectionMatrix(); } }
    if (this.hasValidSize) { const delta = this.clock.getDelta(); this.render(delta); this.update(delta); }
    requestAnimationFrame(this.tick);
  }
}

export default function Hyperspeed({ effectOptions = DEFAULT_EFFECT_OPTIONS, className = "" }) {
  const hyperspeedRef = useRef(null); const appRef = useRef(null);
  useEffect(() => {
    const container = hyperspeedRef.current; if (!container) return;
    if (appRef.current) { appRef.current.dispose(); appRef.current = null; while (container.firstChild) container.removeChild(container.firstChild); }
    const distortions = createDistortions();
    const options = { ...DEFAULT_EFFECT_OPTIONS, ...effectOptions, colors: { ...DEFAULT_EFFECT_OPTIONS.colors, ...effectOptions.colors } };
    options.distortion = distortions[options.distortion] ?? distortions.defaultDistortion;
    const app = new App(container, options); appRef.current = app; app.loadAssets().then(() => app.init());
    return () => { app.dispose(); appRef.current = null; };
  }, [effectOptions]);
  return <div ref={hyperspeedRef} className={`hyperspeed-container ${className}`.trim()} />;
}
