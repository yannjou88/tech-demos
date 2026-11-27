import * as THREE from "three";

function canvas(size: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const context = element.getContext("2d");
  if (!context) throw new Error("Could not draw flower textures");
  return { canvas: element, g: context };
}

function drawHibiscus(petal: string, edge: string, center: string): HTMLCanvasElement {
  const { canvas: element, g } = canvas(256);
  g.clearRect(0, 0, 256, 256);

  g.save();
  g.translate(128, 150);
  g.scale(1, 0.42);
  const shadow = g.createRadialGradient(0, 0, 10, 0, 0, 96);
  shadow.addColorStop(0, "rgba(12, 36, 44, 0.38)");
  shadow.addColorStop(1, "rgba(12, 36, 44, 0)");
  g.fillStyle = shadow;
  g.beginPath();
  g.arc(0, 0, 96, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.save();
  g.translate(128, 122);
  for (let i = 0; i < 5; i++) {
    g.save();
    g.rotate((i / 5) * Math.PI * 2 - Math.PI / 2);
    const gradient = g.createLinearGradient(0, 0, 0, -108);
    gradient.addColorStop(0, petal);
    gradient.addColorStop(0.45, edge);
    gradient.addColorStop(1, edge);
    g.fillStyle = gradient;
    g.beginPath();
    g.moveTo(0, 2);
    g.bezierCurveTo(34, -18, 40, -68, 2, -108);
    g.bezierCurveTo(-40, -68, -34, -18, 0, 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.28)";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(0, -10);
    g.quadraticCurveTo(4, -50, 0, -96);
    g.stroke();
    g.restore();
  }

  const centerGradient = g.createRadialGradient(0, -2, 2, 0, 0, 18);
  centerGradient.addColorStop(0, "#fff8e4");
  centerGradient.addColorStop(0.5, center);
  centerGradient.addColorStop(1, petal);
  g.fillStyle = centerGradient;
  g.beginPath();
  g.arc(0, 0, 16, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = center;
  g.lineWidth = 1.25;
  g.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.cos(angle) * 22;
    const y = Math.sin(angle) * 12 - 4;
    g.beginPath();
    g.moveTo(0, -1);
    g.lineTo(x, y);
    g.stroke();
    g.fillStyle = i % 2 === 0 ? "#ffe38a" : "#fff6d0";
    g.beginPath();
    g.arc(x, y, 2.3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  return element;
}

function drawBougainvillea(bract: string, hot: string): HTMLCanvasElement {
  const { canvas: element, g } = canvas(256);
  g.clearRect(0, 0, 256, 256);
  g.save();
  g.translate(128, 148);
  g.scale(1, 0.4);
  const shadow = g.createRadialGradient(0, 0, 8, 0, 0, 84);
  shadow.addColorStop(0, "rgba(20, 24, 40, 0.32)");
  shadow.addColorStop(1, "rgba(20, 24, 40, 0)");
  g.fillStyle = shadow;
  g.beginPath();
  g.arc(0, 0, 84, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.save();
  g.translate(128, 128);
  for (let i = 0; i < 3; i++) {
    g.save();
    g.rotate((i / 3) * Math.PI * 2 - Math.PI / 2);
    const gradient = g.createLinearGradient(0, 10, 0, -100);
    gradient.addColorStop(0, hot);
    gradient.addColorStop(0.6, bract);
    gradient.addColorStop(1, "#ffe4ef");
    g.fillStyle = gradient;
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(46, -10, 28, -78, 0, -102);
    g.bezierCurveTo(-28, -78, -46, -10, 0, 8);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.22)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -88);
    g.stroke();
    g.restore();
  }
  g.fillStyle = "#fffaf2";
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    g.beginPath();
    g.ellipse(Math.cos(angle) * 7, Math.sin(angle) * 6, 3.2, 5, angle, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#f2c14e";
  g.beginPath();
  g.arc(0, 0, 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return element;
}

function drawPalm(): HTMLCanvasElement {
  const { canvas: element, g } = canvas(1024);
  g.clearRect(0, 0, 1024, 1024);
  g.fillStyle = "rgba(14, 26, 22, 0.2)";
  for (const blob of [
    { x: 240, y: 220, rx: 200, ry: 80, rot: 0.5 },
    { x: 720, y: 300, rx: 170, ry: 64, rot: -0.4 },
    { x: 420, y: 760, rx: 220, ry: 70, rot: 0.2 },
  ]) {
    g.save();
    g.translate(blob.x, blob.y);
    g.rotate(blob.rot);
    g.beginPath();
    g.ellipse(0, 0, blob.rx, blob.ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const clusters = [
    { x: 150, y: 180, rot: 0.35 },
    { x: 690, y: 240, rot: -0.7 },
    { x: 300, y: 700, rot: 0.15 },
    { x: 820, y: 760, rot: 1.05 },
    { x: 500, y: 120, rot: -0.2 },
  ];
  for (const cluster of clusters) {
    for (let pass = 0; pass < 3; pass++) {
      g.save();
      g.translate(cluster.x, cluster.y);
      g.rotate(cluster.rot + pass * 0.03);
      g.strokeStyle = `rgba(18, 32, 26, ${0.16 - pass * 0.035})`;
      g.fillStyle = `rgba(18, 32, 26, ${0.07 - pass * 0.015})`;
      g.lineCap = "round";
      g.lineJoin = "round";
      for (let i = 0; i < 8; i++) {
        const angle = -1.15 + (i / 7) * 2.3;
        const length = 280 + (i % 3) * 30;
        g.lineWidth = 16 + pass * 9;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(angle) * length * 0.45, Math.sin(angle) * length * 0.18, Math.cos(angle) * length, Math.sin(angle) * length * 0.08);
        g.stroke();
        const steps = 7;
        for (let s = 2; s <= steps; s++) {
          const t = s / steps;
          const px = Math.cos(angle) * length * t;
          const py = Math.sin(angle) * length * (0.18 * (1 - t) + 0.08 * t);
          const side = angle + Math.PI / 2;
          const leaf = 26 + pass * 6;
          g.lineWidth = 7 + pass * 3;
          g.beginPath();
          g.moveTo(px, py);
          g.quadraticCurveTo(px + Math.cos(side) * leaf * 0.3, py + Math.sin(side) * leaf * 0.2, px + Math.cos(side) * leaf, py + Math.sin(side) * leaf * 0.35);
          g.stroke();
          g.beginPath();
          g.moveTo(px, py);
          g.quadraticCurveTo(px - Math.cos(side) * leaf * 0.3, py - Math.sin(side) * leaf * 0.2, px - Math.cos(side) * leaf, py - Math.sin(side) * leaf * 0.35);
          g.stroke();
        }
      }
      g.restore();
    }
  }
  return element;
}

function asTexture(source: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createFlowerTextures(anisotropy: number): THREE.CanvasTexture[] {
  const sources = [
    drawHibiscus("#c2183a", "#ff8fa8", "#f0c14e"),
    drawHibiscus("#e15a22", "#ffb089", "#ffe08a"),
    drawHibiscus("#a31462", "#f48cb8", "#fff1c4"),
    drawHibiscus("#f7f3ee", "#ffd0dc", "#f2c14e"),
    drawBougainvillea("#e11d48", "#fb7185"),
    drawBougainvillea("#c2410c", "#fb923c"),
  ];
  return sources.map((source) => asTexture(source, anisotropy));
}

export function createPalmTexture(): THREE.CanvasTexture {
  const texture = asTexture(drawPalm(), 1);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}
