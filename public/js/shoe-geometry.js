import * as THREE from 'three';

const surfaceMapCache = new Map();

function createHeightAndNormalMaps(materialType) {
  if (surfaceMapCache.has(materialType)) {
    return surfaceMapCache.get(materialType);
  }

  const size = 256;
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const ctx = heightCanvas.getContext('2d');

  if (materialType === 'knit') {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 6) {
      for (let x = 0; x < size; x += 6) {
        const offset = (y / 6) % 2 === 0 ? 0 : 3;
        ctx.fillStyle = '#404040';
        ctx.fillRect((x + offset) % size, y, 2.5, 4);
        ctx.fillStyle = '#dcdcdc';
        ctx.fillRect((x + offset + 2.5) % size, y + 1, 2.5, 3.5);
      }
    }
  } else if (materialType === 'leather') {
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, size, size);
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 1800; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1.4 + rand() * 3.2;
      const shade = Math.floor(105 + rand() * 90);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.45)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (materialType === 'foam') {
    ctx.fillStyle = '#828282';
    ctx.fillRect(0, 0, size, size);
    let seed = 71;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 2400; i += 1) {
      const shade = Math.floor(110 + rand() * 48);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
      ctx.fillRect(rand() * size, rand() * size, 2, 2);
    }
  } else {
    // Suede nap
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    let seed = 99;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 4200; i += 1) {
      const shade = Math.floor(72 + rand() * 130);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.48)`;
      ctx.fillRect(rand() * size, rand() * size, 2, 1.5);
    }
  }

  // Convert height canvas to tangent-space normal map via central differences
  const src = ctx.getImageData(0, 0, size, size).data;
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  const out = nctx.createImageData(size, size);
  const strength = materialType === 'knit' ? 2.4 : materialType === 'suede' ? 1.8 : 1.3;

  const sampleH = (x, y) => {
    const wx = (x + size) % size;
    const wy = (y + size) % size;
    return src[(wy * size + wx) * 4] / 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (sampleH(x + 1, y) - sampleH(x - 1, y)) * strength;
      const dy = (sampleH(x, y + 1) - sampleH(x, y - 1)) * strength;
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz);
      const idx = (y * size + x) * 4;
      out.data[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      out.data[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      out.data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      out.data[idx + 3] = 255;
    }
  }
  nctx.putImageData(out, 0, 0);

  const bumpMap = new THREE.CanvasTexture(heightCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.5, 3.5);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3.5, 3.5);

  const pair = { bumpMap, normalMap };
  surfaceMapCache.set(materialType, pair);
  return pair;
}

/**
 * Draws a crisp 1024x1024 UV-mapped upper texture (flipY = false)
 * with widened interior footwell shading and Nike-inspired colorblocking.
 */
function paintUpperCanvas(canvas, colors, materialType, arch) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const sil = arch.silhouette;

  ctx.fillStyle = colors.upper;
  ctx.fillRect(0, 0, w, h);

  // Subtle fabric micro-grain
  ctx.save();
  ctx.globalAlpha = materialType === 'knit' ? 0.08 : materialType === 'suede' ? 0.065 : 0.03;
  ctx.fillStyle = '#000000';
  if (materialType === 'knit') {
    for (let y = 0; y < h * 0.55; y += 6) {
      for (let x = (y % 12 === 0 ? 0 : 3); x < w; x += 6) {
        ctx.fillRect(x, y, 2, 3);
      }
    }
  } else {
    let seed = 17;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 4500; i += 1) {
      ctx.fillRect(rand() * w, rand() * (h * 0.55), 2, 2);
    }
  }
  ctx.restore();

  if (sil === 'wave_97') {
    ctx.save();
    ctx.strokeStyle = colors.overlay;
    ctx.lineWidth = 14;
    for (let band = 0; band < 4; band += 1) {
      const inset = band * 26;
      ctx.beginPath();
      ctx.moveTo(40 + inset * 0.4, 20 + inset);
      ctx.bezierCurveTo(360, 10 + inset, 700, 30 + inset, 985 - inset * 0.4, 140 + inset * 0.7);
      ctx.quadraticCurveTo(1000, 256, 985 - inset * 0.4, 372 - inset * 0.7);
      ctx.bezierCurveTo(700, 482 - inset, 360, 502 - inset, 40 + inset * 0.4, 492 - inset);
      ctx.stroke();
    }
    ctx.fillStyle = colors.overlay;
    ctx.fillRect(0, 0, 1024, 58);
    ctx.fillRect(0, 454, 1024, 58);
    ctx.restore();
  } else {
    const isCourtBlock = sil === 'dunk_low' || sil === 'jordan_high' || sil === 'af1_low';

    // Heel Counter + High-top Ankle Wing Overlay
    ctx.save();
    ctx.fillStyle = colors.overlay;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(isCourtBlock ? 285 : 255, 0);
    ctx.bezierCurveTo(255, 85, 180, 132, 112, 162);
    ctx.quadraticCurveTo(84, 256, 112, 350);
    ctx.bezierCurveTo(180, 380, 255, 427, isCourtBlock ? 285 : 255, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    if (sil === 'jordan_high' || sil === 'dunk_low') {
      ctx.beginPath();
      ctx.roundRect(140, 106, 220, 58, 18);
      ctx.roundRect(140, 348, 220, 58, 18);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo((isCourtBlock ? 285 : 255) - 14, 6);
    ctx.bezierCurveTo(240, 85, 170, 128, 104, 158);
    ctx.quadraticCurveTo(76, 256, 104, 354);
    ctx.bezierCurveTo(170, 384, 240, 427, (isCourtBlock ? 285 : 255) - 14, 506);
    ctx.stroke();
    ctx.restore();

    // Toe Mudguard / Court Toe Cap Overlay
    const toeReach = sil === 'trail_acg' ? 685 : isCourtBlock ? 705 : 745;
    ctx.save();
    ctx.fillStyle = colors.overlay;
    ctx.beginPath();
    ctx.moveTo(1024, 0);
    ctx.lineTo(toeReach, 0);
    ctx.bezierCurveTo(toeReach + 35, 80, 825, 130, 898, 166);
    ctx.quadraticCurveTo(924, 256, 898, 346);
    ctx.bezierCurveTo(825, 382, toeReach + 35, 432, toeReach, 512);
    ctx.lineTo(1024, 512);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(toeReach + 14, 6);
    ctx.bezierCurveTo(toeReach + 48, 82, 836, 134, 908, 170);
    ctx.quadraticCurveTo(932, 256, 908, 342);
    ctx.bezierCurveTo(836, 378, toeReach + 48, 430, toeReach + 14, 506);
    ctx.stroke();
    ctx.restore();

    // Eyestay Overlay Strips flanking the laces
    ctx.save();
    ctx.fillStyle = colors.overlay;
    ctx.globalAlpha = isCourtBlock ? 0.98 : 0.88;
    ctx.beginPath();
    ctx.roundRect(368, 168, 322, 36, 14);
    ctx.roundRect(368, 308, 322, 36, 14);
    ctx.fill();
    ctx.restore();
  }

  // Toe-box perforations
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  for (let row = 0; row < 4; row += 1) {
    const px = 744 + row * 28;
    const count = 5 - Math.floor(row / 2);
    for (let col = 0; col < count; col += 1) {
      const py = 256 + (col - (count - 1) / 2) * 18;
      ctx.beginPath();
      ctx.arc(px, py, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Widened, realistic recessed Dark Interior Ankle Footwell with depth shading
  ctx.save();
  const footwellGrad = ctx.createRadialGradient(228, 256, 22, 228, 256, 146);
  footwellGrad.addColorStop(0, '#090908');
  footwellGrad.addColorStop(0.75, '#181715');
  footwellGrad.addColorStop(1, '#292724');
  ctx.fillStyle = footwellGrad;
  ctx.beginPath();
  ctx.ellipse(226, 256, 142, 86, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lastDimensions(u, arch) {
  const x = -1.26 + u * 2.62;
  // Rounder endCap (0.24) gives authentic Nike-style rounded heel and broad toe box
  const endCap = Math.pow(Math.sin(Math.PI * clamp(u, 0.002, 0.998)), 0.24);

  const isCourt = arch?.cupsole;
  const baseHalfW =
    (isCourt ? 0.46 : 0.44) * (1 - smoothstep(0.16, 0.44, u)) +
    (isCourt ? 0.44 : 0.40) * (smoothstep(0.16, 0.44, u) - smoothstep(0.42, 0.72, u)) +
    (isCourt ? 0.59 : 0.57) * smoothstep(0.42, 0.72, u);

  const halfWidth = Math.max(0.035, baseHalfW * endCap);
  const medialShift = -0.05 * Math.sin(u * Math.PI * 1.15) * (1 - u * 0.4);
  const toeSpring = Math.pow(smoothstep(0.70, 1.0, u), 1.8) * (isCourt ? 0.065 : 0.13);
  const heelBevel = Math.pow(1 - smoothstep(0.0, 0.12, u), 2.0) * (isCourt ? 0.02 : 0.045);

  return { x, halfWidth, medialShift, toeSpring, heelBevel };
}

function midsoleTopAt(arch, u) {
  const { toeSpring, heelBevel } = lastDimensions(u, arch);
  const isCourt = arch.cupsole;
  const heelThick = (isCourt ? 0.20 : 0.25) * arch.soleThickness;
  const foreThick = (isCourt ? 0.18 : 0.14) * arch.soleThickness;
  const thick =
    heelThick * (1 - smoothstep(0.15, 0.85, u)) +
    foreThick * smoothstep(0.15, 0.85, u);
  return 0.065 + thick + toeSpring + heelBevel;
}

function evalUpperPoint(arch, u, theta, outwardOffset = 0) {
  const { x, halfWidth, medialShift } = lastDimensions(u, arch);
  const baseY = midsoleTopAt(arch, u) - 0.048;

  const collarH = arch.collarHeight;
  let heightCurve;
  if (u < 0.38) {
    const t = u / 0.38;
    const heelRound = smoothstep(0.0, 0.10, u) * 0.30 + 0.70;
    const collarScoop = Math.sin(clamp((t - 0.18) / 0.74, 0, 1) * Math.PI) * (arch.silhouette === 'jordan_high' ? 0.06 : 0.10);
    heightCurve = collarH * (heelRound - collarScoop);
  } else if (u < 0.72) {
    const t = (u - 0.38) / 0.34;
    const ease = t * t * (3 - 2 * t);
    heightCurve = collarH * 0.92 * (1 - ease) + 0.35 * ease;
  } else {
    const t = (u - 0.72) / 0.28;
    heightCurve = 0.35 * Math.pow(1 - t, 0.65) + 0.05;
  }

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const rz = halfWidth * 0.94;
  const isTop = sinT >= 0;

  // Keep ankle collar zone full & broad (minimal top ridge pinching for u < 0.40)
  const pinchFactor = 0.03 + 0.18 * smoothstep(0.30, 0.50, u);
  const domeX = Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.78);
  const ridgePinch = isTop ? 1 - pinchFactor * Math.pow(sinT, 1.35) : 1.0;
  let z = medialShift + domeX * rz * ridgePinch;

  let y;
  if (isTop) {
    y = baseY + Math.pow(sinT, 0.80) * heightCurve;
  } else {
    y = baseY + sinT * 0.025;
  }

  if (outwardOffset !== 0) {
    z += cosT * outwardOffset;
    y += sinT * outwardOffset * 0.88;
  }

  return new THREE.Vector3(x, y, z);
}

function createSoleLoftGeometry(arch, { uSegments = 44, rSegments = 24, thicknessFn, widthScale = 1.0 }) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= uSegments; i += 1) {
    const u = i / uSegments;
    const { x, halfWidth, medialShift, toeSpring, heelBevel } = lastDimensions(u, arch);
    const { bottomY, topY, sideFlare = 1.0 } = thicknessFn(u);
    const cy = (bottomY + topY) * 0.5 + toeSpring + heelBevel;
    const ry = Math.max(0.014, (topY - bottomY) * 0.5);
    const rz = halfWidth * widthScale * sideFlare;

    for (let j = 0; j <= rSegments; j += 1) {
      const v = j / rSegments;
      const theta = v * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const sqPow = arch.cupsole ? 0.56 : 0.74;
      const sqCos = Math.sign(cosT) * Math.pow(Math.abs(cosT), sqPow);
      const sqSin = Math.sign(sinT) * Math.pow(Math.abs(sinT), sqPow);
      const topPinch = sinT > 0 && !arch.cupsole ? 1 - 0.05 * sinT : 1.0;

      positions.push(x, cy + sqSin * ry, medialShift + sqCos * rz * topPinch);
      uvs.push(u * 2.5, v);
    }
  }

  const ringCount = rSegments + 1;
  for (let i = 0; i < uSegments; i += 1) {
    for (let j = 0; j < rSegments; j += 1) {
      const a = i * ringCount + j;
      const b = (i + 1) * ringCount + j;
      const c = (i + 1) * ringCount + (j + 1);
      const d = i * ringCount + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const heelCenterIdx = positions.length / 3;
  const heelFirst = evalSoleCenter(arch, 0, thicknessFn);
  positions.push(heelFirst.x, heelFirst.y, heelFirst.z);
  uvs.push(0, 0.5);
  for (let j = 0; j < rSegments; j += 1) {
    indices.push(heelCenterIdx, j, j + 1);
  }

  const toeCenterIdx = positions.length / 3;
  const toeLast = evalSoleCenter(arch, 1, thicknessFn);
  positions.push(toeLast.x, toeLast.y, toeLast.z);
  uvs.push(1, 0.5);
  const lastRingStart = uSegments * ringCount;
  for (let j = 0; j < rSegments; j += 1) {
    indices.push(toeCenterIdx, lastRingStart + j + 1, lastRingStart + j);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function evalSoleCenter(arch, u, thicknessFn) {
  const { x, medialShift, toeSpring, heelBevel } = lastDimensions(u, arch);
  const { bottomY, topY } = thicknessFn(u);
  return {
    x,
    y: (bottomY + topY) * 0.5 + toeSpring + heelBevel,
    z: medialShift
  };
}

function createUpperBodyGeometry(arch) {
  const uSegments = 60;
  const rSegments = 40;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= uSegments; i += 1) {
    const u = i / uSegments;
    for (let j = 0; j <= rSegments; j += 1) {
      const v = j / rSegments;
      const theta = v * Math.PI * 2;
      const pt = evalUpperPoint(arch, u, theta, 0);

      // Widened, deeper ankle opening cavity (u in [0.08, 0.36], sinT > 0.52)
      const sinT = Math.sin(theta);
      if (u >= 0.08 && u <= 0.36 && sinT > 0.52) {
        const uBell = Math.sin(((u - 0.08) / 0.28) * Math.PI);
        const tBell = smoothstep(0.52, 0.88, sinT);
        pt.y -= uBell * tBell * 0.26;
      }

      positions.push(pt.x, pt.y, pt.z);
      uvs.push(u, v);
    }
  }

  const ringCount = rSegments + 1;
  for (let i = 0; i < uSegments; i += 1) {
    for (let j = 0; j < rSegments; j += 1) {
      const a = i * ringCount + j;
      const b = (i + 1) * ringCount + j;
      const c = (i + 1) * ringCount + (j + 1);
      const d = i * ringCount + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const heelTop = evalUpperPoint(arch, 0, Math.PI * 0.5, 0);
  const heelBot = evalUpperPoint(arch, 0, -Math.PI * 0.5, 0);
  const heelPoleIdx = positions.length / 3;
  positions.push(heelTop.x, (heelTop.y + heelBot.y) * 0.5, lastDimensions(0, arch).medialShift);
  uvs.push(0, 0.25);
  for (let j = 0; j < rSegments; j += 1) {
    indices.push(heelPoleIdx, j, j + 1);
  }

  const toeTop = evalUpperPoint(arch, 1, Math.PI * 0.5, 0);
  const toeBot = evalUpperPoint(arch, 1, -Math.PI * 0.5, 0);
  const toePoleIdx = positions.length / 3;
  positions.push(toeTop.x, (toeTop.y + toeBot.y) * 0.5, lastDimensions(1, arch).medialShift);
  uvs.push(1, 0.25);
  const lastRing = uSegments * ringCount;
  for (let j = 0; j < rSegments; j += 1) {
    indices.push(toePoleIdx, lastRing + j + 1, lastRing + j);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Widened cushioned ankle collar rim framing the larger ankle opening
 */
function createCollarRim(arch) {
  const collarPoints = [];
  const steps = 40;
  const centerU = 0.22;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = t * Math.PI * 2;
    const u = centerU - Math.cos(angle) * 0.145;
    const theta = Math.PI * 0.5 - Math.sin(angle) * 0.78;
    const pt = evalUpperPoint(arch, u, theta, 0.008);
    collarPoints.push(pt);
  }

  const collarCurve = new THREE.CatmullRomCurve3(collarPoints, true);
  return new THREE.TubeGeometry(collarCurve, 48, 0.038, 14, true);
}

function createInstepPatch(arch, uStart, uEnd, halfThetaSpan, offset, thickness) {
  const uSegments = 12;
  const tSegments = 10;
  const positions = [];
  const uvs = [];
  const indices = [];
  const ringPts = (tSegments + 1) * 2;

  for (let i = 0; i <= uSegments; i += 1) {
    const uFrac = i / uSegments;
    const u = uStart + uFrac * (uEnd - uStart);
    const edgeFeather = Math.sin(Math.PI * clamp(uFrac, 0.06, 0.94));
    const localThick = thickness * (0.4 + 0.6 * edgeFeather);

    for (let j = 0; j <= tSegments; j += 1) {
      const tFrac = j / tSegments;
      const theta = (Math.PI * 0.5 - halfThetaSpan) + tFrac * (halfThetaSpan * 2);
      const pt = evalUpperPoint(arch, u, theta, offset + localThick);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(uFrac, tFrac);
    }
    for (let j = tSegments; j >= 0; j -= 1) {
      const tFrac = j / tSegments;
      const theta = (Math.PI * 0.5 - halfThetaSpan) + tFrac * (halfThetaSpan * 2);
      const pt = evalUpperPoint(arch, u, theta, offset - 0.002);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(uFrac, tFrac);
    }
  }

  for (let i = 0; i < uSegments; i += 1) {
    for (let j = 0; j < ringPts; j += 1) {
      const jNext = (j + 1) % ringPts;
      const a = i * ringPts + j;
      const b = (i + 1) * ringPts + j;
      const c = (i + 1) * ringPts + jNext;
      const d = i * ringPts + jNext;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function createSwooshGeometry(arch, side = 1) {
  const s = arch.swooshScale || 1.0;
  const shape = new THREE.Shape();
  shape.moveTo(0.42 * s, 0.055 * s);
  shape.bezierCurveTo(0.28 * s, 0.005 * s, 0.14 * s, 0.03 * s, 0.06 * s, 0.095 * s);
  shape.bezierCurveTo(-0.04 * s, 0.185 * s, -0.30 * s, 0.14 * s, -0.56 * s, 0.25 * s);
  shape.bezierCurveTo(-0.32 * s, 0.06 * s, -0.02 * s, -0.065 * s, 0.24 * s, -0.045 * s);
  shape.bezierCurveTo(0.38 * s, -0.035 * s, 0.45 * s, 0.015 * s, 0.42 * s, 0.055 * s);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 20
  });

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);

    const worldX = lx - 0.10;
    const u = clamp((worldX + 1.26) / 2.62, 0.16, 0.74);
    const thetaOffset = clamp((ly + 0.05) * 1.15, 0, 0.34);
    const thetaSide = side > 0 ? 0.22 + thetaOffset : Math.PI - (0.22 + thetaOffset);
    const hullPt = evalUpperPoint(arch, u, thetaSide, 0.008);

    pos.setX(i, hullPt.x);
    pos.setY(i, hullPt.y + ly * 0.25 + 0.02);
    pos.setZ(i, hullPt.z + side * (lz - 0.003));
  }

  geom.computeVertexNormals();
  return geom;
}

function createLacingSystem(arch, laceMaterial, eyeletMaterial, accentMaterial) {
  const group = new THREE.Group();
  const pairs = arch.silhouette === 'jordan_high' || arch.silhouette === 'blazer_mid' ? 6 : 5;
  const startU = arch.silhouette === 'jordan_high' ? 0.37 : 0.40;
  const endU = 0.67;

  const leftEyelets = [];
  const rightEyelets = [];
  const eyeletGeom = new THREE.TorusGeometry(0.017, 0.005, 8, 16);

  for (let i = 0; i < pairs; i += 1) {
    const f = i / (pairs - 1);
    const u = startU + f * (endU - startU);
    const lPos = evalUpperPoint(arch, u, Math.PI * 0.5 - 0.42, 0.018);
    const rPos = evalUpperPoint(arch, u, Math.PI * 0.5 + 0.42, 0.018);
    leftEyelets.push(lPos);
    rightEyelets.push(rPos);

    for (const [idx, pos] of [lPos, rPos].entries()) {
      const eyelet = new THREE.Mesh(eyeletGeom, eyeletMaterial);
      eyelet.position.copy(pos);
      eyelet.rotation.x = Math.PI / 2;
      eyelet.rotation.y = (idx === 0 ? -1 : 1) * 0.24;
      eyelet.castShadow = true;
      group.add(eyelet);
    }
  }

  for (let i = 0; i < pairs - 1; i += 1) {
    const uA = startU + (i / (pairs - 1)) * (endU - startU);
    const uB = startU + ((i + 1) / (pairs - 1)) * (endU - startU);
    const uMid = (uA + uB) * 0.5;

    const aL = leftEyelets[i];
    const bR = rightEyelets[i + 1];
    const mid1a = evalUpperPoint(arch, uA * 0.65 + uB * 0.35, Math.PI * 0.5 - 0.14, 0.032);
    const crest1 = evalUpperPoint(arch, uMid, Math.PI * 0.5, 0.036);
    const mid1b = evalUpperPoint(arch, uA * 0.35 + uB * 0.65, Math.PI * 0.5 + 0.14, 0.032);

    const curve1 = new THREE.CatmullRomCurve3([aL, mid1a, crest1, mid1b, bR]);
    const tube1 = new THREE.Mesh(new THREE.TubeGeometry(curve1, 18, 0.011, 8, false), laceMaterial);
    tube1.castShadow = true;
    group.add(tube1);

    const aR = rightEyelets[i];
    const bL = leftEyelets[i + 1];
    const mid2a = evalUpperPoint(arch, uA * 0.65 + uB * 0.35, Math.PI * 0.5 + 0.14, 0.042);
    const crest2 = evalUpperPoint(arch, uMid, Math.PI * 0.5, 0.048);
    const mid2b = evalUpperPoint(arch, uA * 0.35 + uB * 0.65, Math.PI * 0.5 - 0.14, 0.042);

    const curve2 = new THREE.CatmullRomCurve3([aR, mid2a, crest2, mid2b, bL]);
    const tube2 = new THREE.Mesh(new THREE.TubeGeometry(curve2, 18, 0.011, 8, false), laceMaterial);
    tube2.castShadow = true;
    group.add(tube2);
  }

  if (arch.dubrae) {
    const botL = leftEyelets[pairs - 1];
    const botR = rightEyelets[pairs - 1];
    const dubraePos = new THREE.Vector3().lerpVectors(botL, botR, 0.5);
    dubraePos.y += 0.025;
    const dubraeGeom = new THREE.BoxGeometry(0.08, 0.022, 0.14);
    const dubraeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E3E6EA'),
      metalness: 0.90,
      roughness: 0.18
    });
    const dubrae = new THREE.Mesh(dubraeGeom, dubraeMat);
    dubrae.position.copy(dubraePos);
    dubrae.rotation.z = -0.35;
    group.add(dubrae);
  }

  const topL = leftEyelets[0];
  const topR = rightEyelets[0];
  const bowCenter = new THREE.Vector3().lerpVectors(topL, topR, 0.5);
  bowCenter.y += 0.032;

  const leftLoopCurve = new THREE.CatmullRomCurve3([
    bowCenter,
    new THREE.Vector3(bowCenter.x - 0.075, bowCenter.y + 0.04, bowCenter.z + 0.095),
    new THREE.Vector3(bowCenter.x - 0.115, bowCenter.y - 0.01, bowCenter.z + 0.05),
    bowCenter
  ]);
  const rightLoopCurve = new THREE.CatmullRomCurve3([
    bowCenter,
    new THREE.Vector3(bowCenter.x - 0.075, bowCenter.y + 0.04, bowCenter.z - 0.095),
    new THREE.Vector3(bowCenter.x - 0.115, bowCenter.y - 0.01, bowCenter.z - 0.05),
    bowCenter
  ]);

  const loopL = new THREE.Mesh(new THREE.TubeGeometry(leftLoopCurve, 18, 0.0105, 8, false), laceMaterial);
  const loopR = new THREE.Mesh(new THREE.TubeGeometry(rightLoopCurve, 18, 0.0105, 8, false), laceMaterial);
  loopL.castShadow = true;
  loopR.castShadow = true;
  group.add(loopL, loopR);

  const tipGeom = new THREE.CylinderGeometry(0.0095, 0.0095, 0.030, 8);
  const tipL = new THREE.Mesh(tipGeom, accentMaterial);
  tipL.position.set(bowCenter.x + 0.025, bowCenter.y - 0.02, bowCenter.z + 0.08);
  tipL.rotation.z = 0.55;
  const tipR = new THREE.Mesh(tipGeom, accentMaterial);
  tipR.position.set(bowCenter.x + 0.025, bowCenter.y - 0.02, bowCenter.z - 0.08);
  tipR.rotation.z = 0.55;
  group.add(tipL, tipR);

  return group;
}

export function buildSneakerModel(shoeSpec, colors, materialType) {
  const root = new THREE.Group();
  root.name = 'kineta-sneaker-root';

  const arch = shoeSpec.architecture;
  let activeColors = { ...colors };
  let activeMaterialType = materialType;

  const upperCanvas = document.createElement('canvas');
  upperCanvas.width = 1024;
  upperCanvas.height = 1024;
  paintUpperCanvas(upperCanvas, activeColors, activeMaterialType, arch);

  const upperMap = new THREE.CanvasTexture(upperCanvas);
  upperMap.flipY = false;
  upperMap.colorSpace = THREE.SRGBColorSpace;
  upperMap.anisotropy = 8;

  const upperMaps = createHeightAndNormalMaps(activeMaterialType);
  const leatherMaps = createHeightAndNormalMaps('leather');
  const foamMaps = createHeightAndNormalMaps('foam');

  const materials = {
    upper: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      map: upperMap,
      normalMap: upperMaps.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      bumpMap: upperMaps.bumpMap,
      bumpScale: activeMaterialType === 'knit' ? 0.015 : activeMaterialType === 'suede' ? 0.012 : 0.006,
      roughness: activeMaterialType === 'leather' ? 0.40 : activeMaterialType === 'suede' ? 0.88 : 0.74,
      metalness: 0.03,
      clearcoat: activeMaterialType === 'leather' ? 0.24 : 0.0,
      clearcoatRoughness: 0.28,
      sheen: activeMaterialType === 'suede' ? 0.55 : 0.12,
      sheenRoughness: 0.75,
      envMapIntensity: 1.15
    }),
    tongue: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(activeColors.upper),
      normalMap: upperMaps.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.76,
      metalness: 0.02,
      envMapIntensity: 1.05
    }),
    overlay: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(activeColors.overlay),
      normalMap: leatherMaps.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.48,
      metalness: 0.05,
      clearcoat: 0.18,
      envMapIntensity: 1.15
    }),
    midsole: new THREE.MeshStandardMaterial({
      color: new THREE.Color(activeColors.midsole),
      normalMap: foamMaps.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.58,
      metalness: 0.03,
      envMapIntensity: 1.0
    }),
    outsole: new THREE.MeshStandardMaterial({
      color: new THREE.Color(activeColors.outsole),
      normalMap: foamMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.82,
      metalness: 0.05,
      envMapIntensity: 0.9
    }),
    accent: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(activeColors.accent),
      roughness: 0.28,
      metalness: 0.22,
      clearcoat: 0.42,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.35
    }),
    laces: new THREE.MeshStandardMaterial({
      color: new THREE.Color(activeColors.laces),
      roughness: 0.84,
      metalness: 0.02
    }),
    airPod: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(activeColors.accent),
      roughness: 0.08,
      metalness: 0.05,
      transmission: 0.78,
      thickness: 0.32,
      ior: 1.48,
      clearcoat: 0.6,
      transparent: true,
      opacity: 0.94,
      envMapIntensity: 1.5
    })
  };

  const layers = {
    outsole: new THREE.Group(),
    midsole: new THREE.Group(),
    upper: new THREE.Group(),
    laces: new THREE.Group()
  };

  const outsoleGeom = createSoleLoftGeometry(arch, {
    uSegments: 42,
    rSegments: 20,
    widthScale: arch.cupsole ? 1.01 : 1.03,
    thicknessFn: (u) => ({
      bottomY: 0.0,
      topY: 0.082 + (1 - u) * 0.012,
      sideFlare: 1.01
    })
  });
  const outsoleMesh = new THREE.Mesh(outsoleGeom, materials.outsole);
  outsoleMesh.castShadow = true;
  outsoleMesh.receiveShadow = true;
  layers.outsole.add(outsoleMesh);

  const lugCount = arch.silhouette === 'trail_acg' || arch.silhouette === 'waffle_retro' ? 14 : 11;
  const lugDepth = arch.lugDepth;
  for (let i = 0; i < lugCount; i += 1) {
    const u = 0.08 + (i / (lugCount - 1)) * 0.84;
    const { x, halfWidth, medialShift, toeSpring } = lastDimensions(u, arch);
    const lugW = halfWidth * 1.56;
    const lugGeom = new THREE.BoxGeometry(
      arch.silhouette === 'trail_acg' ? 0.088 : arch.silhouette === 'waffle_retro' ? 0.075 : 0.064,
      lugDepth,
      lugW
    );
    const lug = new THREE.Mesh(lugGeom, materials.outsole);
    lug.position.set(x, -lugDepth * 0.35 + toeSpring, medialShift);
    lug.rotation.y = arch.silhouette === 'trail_acg' ? (i % 2 === 0 ? 0.16 : -0.16) : 0;
    lug.castShadow = true;
    layers.outsole.add(lug);
  }

  const midsoleGeom = createSoleLoftGeometry(arch, {
    uSegments: 44,
    rSegments: 24,
    widthScale: 1.01,
    thicknessFn: (u) => {
      const heelThick = (arch.cupsole ? 0.20 : 0.25) * arch.soleThickness;
      const foreThick = (arch.cupsole ? 0.18 : 0.14) * arch.soleThickness;
      const top = heelThick * (1 - smoothstep(0.15, 0.85, u)) + foreThick * smoothstep(0.15, 0.85, u);
      const flare = arch.cupsole ? 1.0 : 1.0 + 0.05 * (1 - smoothstep(0.0, 0.35, u));
      return { bottomY: 0.055, topY: 0.065 + top, sideFlare: flare };
    }
  });
  const midsoleMesh = new THREE.Mesh(midsoleGeom, materials.midsole);
  midsoleMesh.castShadow = true;
  midsoleMesh.receiveShadow = true;
  layers.midsole.add(midsoleMesh);

  if (arch.airUnitStyle === 'full') {
    const fullPodGeom = new THREE.CapsuleGeometry(0.052 * arch.soleThickness, 1.38, 8, 16);
    fullPodGeom.rotateZ(Math.PI / 2);
    const fullPod = new THREE.Mesh(fullPodGeom, materials.airPod);
    fullPod.position.set(-0.22, 0.165 * arch.soleThickness, 0.0);
    fullPod.scale.set(1.0, 0.68, 2.85);
    layers.midsole.add(fullPod);
  } else if (arch.airUnitStyle === 'heel' || arch.airUnitStyle === 'pod') {
    const podGeom = new THREE.CapsuleGeometry(0.056 * arch.soleThickness, 0.26, 8, 16);
    podGeom.rotateZ(Math.PI / 2);
    const pod = new THREE.Mesh(podGeom, materials.airPod);
    pod.position.set(-0.86, 0.175 * arch.soleThickness, 0.0);
    pod.scale.set(1.0, 0.72, 2.95);
    layers.midsole.add(pod);
  } else if (arch.cupsole) {
    const weltGeom = createSoleLoftGeometry(arch, {
      uSegments: 32,
      rSegments: 16,
      widthScale: 1.014,
      thicknessFn: () => ({
        bottomY: 0.20 * arch.soleThickness,
        topY: 0.222 * arch.soleThickness,
        sideFlare: 1.0
      })
    });
    const weltMesh = new THREE.Mesh(weltGeom, materials.accent);
    layers.midsole.add(weltMesh);
  }

  const upperGeom = createUpperBodyGeometry(arch);
  const upperMesh = new THREE.Mesh(upperGeom, materials.upper);
  upperMesh.castShadow = true;
  upperMesh.receiveShadow = true;
  layers.upper.add(upperMesh);

  const collarMesh = new THREE.Mesh(createCollarRim(arch), materials.overlay);
  collarMesh.castShadow = true;
  layers.upper.add(collarMesh);

  const tongueMesh = new THREE.Mesh(
    createInstepPatch(arch, 0.35, 0.66, 0.32, 0.006, 0.010),
    materials.tongue
  );
  tongueMesh.castShadow = true;
  layers.upper.add(tongueMesh);

  const patchMesh = new THREE.Mesh(
    createInstepPatch(arch, 0.37, 0.44, 0.16, 0.016, 0.007),
    materials.accent
  );
  layers.upper.add(patchMesh);

  const heelUpperAnchor = evalUpperPoint(arch, 0.06, Math.PI * 0.5, 0.002);
  const heelLowerAnchor = evalUpperPoint(arch, 0.015, Math.PI * 0.35, 0.0);
  const pullCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(heelLowerAnchor.x + 0.03, heelUpperAnchor.y - 0.16, 0),
    new THREE.Vector3(heelLowerAnchor.x - 0.08, heelUpperAnchor.y - 0.04, 0),
    new THREE.Vector3(heelUpperAnchor.x - 0.01, heelUpperAnchor.y - 0.01, 0)
  ]);
  const pullTab = new THREE.Mesh(new THREE.TubeGeometry(pullCurve, 14, 0.014, 8, false), materials.accent);
  pullTab.castShadow = true;
  layers.upper.add(pullTab);

  const lateralSwoosh = new THREE.Mesh(createSwooshGeometry(arch, 1), materials.accent);
  lateralSwoosh.castShadow = true;
  const medialSwoosh = new THREE.Mesh(createSwooshGeometry(arch, -1), materials.accent);
  medialSwoosh.castShadow = true;
  layers.upper.add(lateralSwoosh, medialSwoosh);

  const lacing = createLacingSystem(arch, materials.laces, materials.accent, materials.accent);
  layers.laces.add(lacing);

  root.add(layers.outsole, layers.midsole, layers.upper, layers.laces);

  return {
    root,
    layers,
    materials,
    updateColors(nextColors) {
      activeColors = { ...nextColors };
      paintUpperCanvas(upperCanvas, activeColors, activeMaterialType, arch);
      upperMap.needsUpdate = true;

      materials.tongue.color.set(activeColors.upper);
      materials.overlay.color.set(activeColors.overlay);
      materials.midsole.color.set(activeColors.midsole);
      materials.outsole.color.set(activeColors.outsole);
      materials.accent.color.set(activeColors.accent);
      materials.airPod.color.set(activeColors.accent);
      materials.laces.color.set(activeColors.laces);
    },
    updateMaterialType(nextType) {
      activeMaterialType = nextType;
      paintUpperCanvas(upperCanvas, activeColors, activeMaterialType, arch);
      upperMap.needsUpdate = true;

      const maps = createHeightAndNormalMaps(nextType);
      materials.upper.normalMap = maps.normalMap;
      materials.upper.bumpMap = maps.bumpMap;
      materials.upper.bumpScale = nextType === 'knit' ? 0.015 : nextType === 'suede' ? 0.012 : 0.006;
      materials.upper.roughness = nextType === 'leather' ? 0.40 : nextType === 'suede' ? 0.88 : 0.74;
      materials.upper.clearcoat = nextType === 'leather' ? 0.24 : 0.0;
      materials.upper.sheen = nextType === 'suede' ? 0.55 : 0.12;
      materials.upper.needsUpdate = true;
      materials.tongue.normalMap = maps.normalMap;
      materials.tongue.needsUpdate = true;
    },
    dispose() {
      root.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
          obj.geometry.dispose();
        }
      });
      upperMap.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    }
  };
}
