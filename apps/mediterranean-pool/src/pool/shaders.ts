export const SIM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SIM_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uPool;
uniform vec4 uImpulses[8];
uniform vec4 uWhirl;

void main() {
  vec2 uv = vUv;
  vec4 s = texture2D(uState, uv);
  float hL = texture2D(uState, uv + vec2(-uTexel.x, 0.0)).r;
  float hR = texture2D(uState, uv + vec2(uTexel.x, 0.0)).r;
  float hD = texture2D(uState, uv + vec2(0.0, -uTexel.y)).r;
  float hU = texture2D(uState, uv + vec2(0.0, uTexel.y)).r;
  float average = (hL + hR + hD + hU) * 0.25;
  float vel = s.g + (average - s.r) * 2.0;
  vel *= 0.984;
  float h = s.r + vel;

  for (int i = 0; i < 8; i++) {
    vec4 imp = uImpulses[i];
    vec2 d = (uv - imp.xy) * uPool;
    float rad = max(imp.w, 0.02);
    h += imp.z * exp(-dot(d, d) / (rad * rad));
  }

  if (uWhirl.z > 0.02) {
    vec2 dw = (uv - uWhirl.xy) * uPool;
    float r = length(dw);
    float radius = max(uWhirl.w, 0.2);
    float inf = smoothstep(radius, radius * 0.22, r) * uWhirl.z;
    vec2 dir = dw / max(r, 0.0008);
    vec2 tangent = vec2(-dir.y, dir.x);
    float spin = uWhirl.z * 2.8 * smoothstep(radius, radius * 0.18, r);
    float inward = uWhirl.z * 0.55 * smoothstep(radius, radius * 0.28, r) * smoothstep(0.12, 0.55, r);
    vec2 flow = tangent * spin - dir * inward;
    vec2 prevUv = clamp(uv - flow * 0.016 / uPool, vec2(0.002), vec2(0.998));
    float advected = texture2D(uState, prevUv).r;
    h = mix(h, advected, clamp(inf, 0.0, 0.8));
    float target = -exp(-r * r / 0.55) * uWhirl.z * 0.28;
    float hold = clamp(inf, 0.0, 0.72);
    h = mix(h, target, hold);
    vel *= 1.0 - hold;
  }

  float border = smoothstep(0.0, 0.035, uv.x) * smoothstep(0.0, 0.035, uv.y);
  border *= smoothstep(0.0, 0.035, 1.0 - uv.x) * smoothstep(0.0, 0.035, 1.0 - uv.y);
  h *= border;
  vel *= border;
  h = clamp(h, -0.32, 0.22);
  gl_FragColor = vec4(h, vel, s.b, s.a);
}
`;

export const NORMAL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uPool;

void main() {
  vec2 uv = vUv;
  float h = texture2D(uState, uv).r;
  float vel = texture2D(uState, uv).g;
  float hL = texture2D(uState, uv + vec2(-uTexel.x, 0.0)).r;
  float hR = texture2D(uState, uv + vec2(uTexel.x, 0.0)).r;
  float hD = texture2D(uState, uv + vec2(0.0, -uTexel.y)).r;
  float hU = texture2D(uState, uv + vec2(0.0, uTexel.y)).r;
  float dx = (hR - hL) / (2.0 * uTexel.x * uPool.x);
  float dz = (hU - hD) / (2.0 * uTexel.y * uPool.y);
  vec3 n = normalize(vec3(-dx, 1.0, -dz));
  gl_FragColor = vec4(h, vel, n.x, n.z);
}
`;

const SHARED = /* glsl */ `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float detailHeight(vec2 world, float time) {
  float w1 = sin(world.x * 3.2 + time * 0.82) * sin(world.y * 2.7 - time * 0.58);
  float w2 = sin(world.x * 6.4 - time * 1.05 + world.y * 1.8) * 0.42;
  float w3 = sin((world.x + world.y * 0.8) * 10.5 + time * 1.35) * 0.2;
  return (w1 + w2 + w3) * 0.0055;
}

vec3 detailGrad(vec2 world, float time) {
  float e = 0.045;
  float dx = detailHeight(world + vec2(e, 0.0), time) - detailHeight(world - vec2(e, 0.0), time);
  float dz = detailHeight(world + vec2(0.0, e), time) - detailHeight(world - vec2(0.0, e), time);
  return vec3(-dx / (2.0 * e), 0.0, -dz / (2.0 * e));
}

float palmShadow(sampler2D palm, vec2 world, float time) {
  float sway = sin(time * 0.55) * 0.012;
  vec2 uv1 = world * 0.105 + vec2(0.42 + sway, 0.38 + time * 0.008);
  vec2 uv2 = world * 0.082 + vec2(0.18 - time * 0.006, 0.62 + sway);
  float a = texture2D(palm, uv1).a;
  float b = texture2D(palm, uv2).a;
  float mask = clamp(a * 0.85 + b * 0.55, 0.0, 1.0);
  return 1.0 - mask * 0.62;
}

vec3 tileColor(vec2 world) {
  vec2 tile = world / 0.09;
  vec2 f = fract(tile);
  vec2 id = floor(tile);
  float grout = step(0.07, f.x) * step(0.07, f.y);
  float n = hash(id);
  vec3 a = vec3(0.05, 0.38, 0.58);
  vec3 b = vec3(0.02, 0.24, 0.46);
  vec3 c = vec3(0.16, 0.62, 0.72);
  vec3 cream = vec3(0.86, 0.83, 0.74);
  vec3 tileCol = mix(a, b, n);
  tileCol = mix(tileCol, c, smoothstep(0.78, 0.86, n));
  tileCol = mix(tileCol, cream, step(0.975, n));
  float diamond = step(8.5, mod(id.x, 9.0)) * step(8.5, mod(id.y, 9.0));
  tileCol = mix(tileCol, cream * 0.95, diamond);
  tileCol *= 0.9 + 0.12 * hash(id + 4.2);
  vec3 groutCol = vec3(0.78, 0.8, 0.78);
  return mix(groutCol, tileCol, grout);
}

float lace(vec2 p, float time) {
  float c = 0.0;
  vec2 q = p * 1.15;
  for (int i = 1; i <= 3; i++) {
    float fi = float(i);
    q = q * 1.32 + vec2(sin(time * 0.33 + fi), cos(time * 0.27 + fi * 1.6)) * 0.35;
    c += abs(sin(q.x * 1.65 + time * 0.55) * sin(q.y * 1.45 - time * 0.42)) / fi;
  }
  return pow(c, 2.6);
}

vec3 simNormal(sampler2D state, vec2 uv, vec2 world, float time) {
  vec4 s = texture2D(state, uv);
  float ny = sqrt(max(0.0, 1.0 - s.b * s.b - s.a * s.a));
  vec3 detail = detailGrad(world, time);
  return normalize(vec3(s.b + detail.x * 0.85, ny, s.a + detail.z * 0.85));
}
`;

export const CAUSTIC_VERT = /* glsl */ `
uniform sampler2D uState;
uniform vec2 uPool;
uniform vec3 uLight;
uniform float uDepth;
uniform float uTime;
uniform float uPointSize;
varying float vFocus;

${SHARED}

void main() {
  vec2 world = position.xz;
  vec3 n = simNormal(uState, uv, world, uTime);
  vec3 refr = refract(normalize(uLight), n, 0.75);
  if (dot(refr, refr) < 0.0001 || refr.y > -0.04) {
    refr = refract(normalize(uLight), vec3(0.0, 1.0, 0.0), 0.75);
  }
  float dist = uDepth / max(-refr.y, 0.08);
  vec2 hit = world + refr.xz * dist;
  gl_Position = vec4(hit.x / (uPool.x * 0.5), hit.y / (uPool.y * 0.5), 0.0, 1.0);
  gl_PointSize = uPointSize;
  vFocus = clamp(1.15 - length(n.xz) * 6.0, 0.35, 1.4);
}
`;

export const CAUSTIC_FRAG = /* glsl */ `
varying float vFocus;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.02, d) * vFocus;
  gl_FragColor = vec4(vec3(a * 0.07), 1.0);
}
`;

export const FLOOR_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FLOOR_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
uniform sampler2D uState;
uniform sampler2D uCaustic;
uniform sampler2D uPalm;
uniform vec2 uPool;
uniform float uTime;
uniform float uCausticScale;

${SHARED}

void main() {
  vec2 uv = clamp(vWorld.xz / uPool + 0.5, 0.0, 1.0);
  vec3 n = simNormal(uState, uv, vWorld.xz, uTime);
  vec3 tiles = tileColor(abs(vNormal.y) > 0.5 ? vWorld.xz : (abs(vNormal.x) > abs(vNormal.z) ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y)));
  float splat = texture2D(uCaustic, uv).r;
  float pattern = lace(vWorld.xz * 0.85 + n.xz * 1.1, uTime);
  float light = 0.28 + pattern * 0.95 + splat * uCausticScale;
  float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  light *= mix(0.62, 1.0, smoothstep(0.0, 0.07, edge));
  if (abs(vNormal.y) < 0.5) {
    light *= 0.72 + 0.28 * clamp(vWorld.y / -0.2, 0.0, 1.0);
  }
  light *= palmShadow(uPalm, vWorld.xz, uTime);
  vec3 col = tiles * light;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const STONE_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const STONE_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
uniform sampler2D uPalm;
uniform vec3 uSun;
uniform float uTime;
uniform float uLift;
uniform vec2 uPool;
uniform vec2 uCope;

${SHARED}

void main() {
  float n = valueNoise(vWorld.xz * 2.1);
  float fine = valueNoise(vWorld.xz * 9.0);
  vec3 stone = mix(vec3(0.79, 0.72, 0.61), vec3(0.64, 0.56, 0.46), n);
  stone *= 0.93 + 0.1 * fine;
  stone = mix(stone, stone * 1.06 + vec3(0.035, 0.03, 0.02), uLift);
  float halfW = uPool.x * 0.5 + uCope.x;
  float halfD = uPool.y * 0.5 + uCope.y;
  float dx = max(abs(vWorld.x) - halfW, 0.0);
  float dz = max(abs(vWorld.z) - halfD, 0.0);
  float dist = length(vec2(dx, dz));
  float wet = smoothstep(0.55, 0.0, dist);
  stone = mix(stone, stone * vec3(0.72, 0.78, 0.8), wet * 0.55);
  float ndl = dot(normalize(vNormal), normalize(uSun)) * 0.5 + 0.55;
  stone *= 0.7 + 0.4 * clamp(ndl, 0.0, 1.4);
  stone *= palmShadow(uPalm, vWorld.xz, uTime);
  gl_FragColor = vec4(stone, 1.0);
}
`;

export const WATER_VERT = /* glsl */ `
uniform sampler2D uState;
uniform float uTime;
varying vec3 vWorld;
varying vec2 vUv;
varying float vHeight;

${SHARED}

void main() {
  vUv = uv;
  vec3 pos = position;
  vec2 world = vec2(pos.x, pos.z);
  float simH = texture2D(uState, uv).r;
  float micro = detailHeight(world, uTime);
  pos.y += simH * 1.85 + micro;
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorld = worldPos.xyz;
  vHeight = simH;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const WATER_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
varying float vHeight;
uniform sampler2D uState;
uniform sampler2D uScene;
uniform sampler2D uPalm;
uniform vec2 uResolution;
uniform vec2 uPool;
uniform vec3 uSun;
uniform float uTime;

${SHARED}

vec3 skyColor(vec3 rd) {
  float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(vec3(0.97, 0.78, 0.62), vec3(0.18, 0.48, 0.82), smoothstep(0.02, 0.55, rd.y));
  col = mix(vec3(0.62, 0.82, 0.95), col, smoothstep(0.0, 0.18, rd.y));
  float sunDot = max(dot(rd, normalize(uSun)), 0.0);
  col += vec3(1.0, 0.97, 0.9) * pow(sunDot, 700.0) * 2.6;
  col += vec3(1.0, 0.86, 0.66) * pow(sunDot, 14.0) * 0.28;
  col *= mix(1.0, h, 0.15);
  return col;
}

void main() {
  vec3 n = simNormal(uState, vUv, vWorld.xz, uTime);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec2 offset = n.xz * 0.052;
  vec3 refrR = texture2D(uScene, screenUv + offset * 1.12).rgb;
  vec3 refrG = texture2D(uScene, screenUv + offset).rgb;
  vec3 refrB = texture2D(uScene, screenUv + offset * 0.88).rgb;
  vec3 refr = vec3(refrR.r, refrG.g, refrB.b);
  refr *= vec3(0.62, 0.9, 0.95);
  refr = mix(refr, vec3(0.01, 0.32, 0.42), 0.1);
  vec3 reflDir = reflect(-viewDir, n);
  float shadow = palmShadow(uPalm, vWorld.xz, uTime);
  vec3 reflected = skyColor(reflDir) * mix(0.42, 1.0, shadow);
  float ndv = max(dot(n, viewDir), 0.0);
  float fresnel = 0.06 + 0.7 * pow(1.0 - ndv, 3.0);
  vec3 col = mix(refr, reflected, fresnel);
  vec3 halfDir = normalize(normalize(uSun) + viewDir);
  float spec = pow(max(dot(n, halfDir), 0.0), 160.0);
  float sheen = pow(max(dot(n, halfDir), 0.0), 12.0);
  col += vec3(1.0, 0.98, 0.92) * spec * 1.8 * shadow;
  col += vec3(0.85, 0.93, 0.95) * sheen * 0.05;
  col *= mix(0.58, 1.0, shadow);
  float crest = smoothstep(0.012, 0.05, abs(vHeight));
  col += vec3(0.75, 0.9, 0.95) * crest * 0.08;
  col *= mix(1.0, 0.62, smoothstep(-0.04, -0.2, vHeight));
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

export const FLOWER_VERT = /* glsl */ `
uniform sampler2D uState;
uniform vec2 uPool;
uniform float uHeightGain;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  vUv = uv;
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vec4 world = modelMatrix * vec4(position, 1.0);
  #endif
  vec2 uv = clamp(world.xz / uPool + 0.5, 0.001, 0.999);
  world.y += texture2D(uState, uv).r * uHeightGain;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FLOWER_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.08) discard;
  gl_FragColor = vec4(tex.rgb * vColor, tex.a);
}
`;
