// ============ 种子随机 & 噪声 ============
'use strict';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Noise2D {
  constructor(seed) {
    const rand = mulberry32(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + (b - a) * t; }
  grad(h, x, y) {
    switch (h & 7) {
      case 0: return x + y; case 1: return x - y;
      case 2: return -x + y; case 3: return -x - y;
      case 4: return x; case 5: return -x;
      case 6: return y; default: return -y;
    }
  }
  get(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = this.fade(x), v = this.fade(y);
    const p = this.perm;
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    return this.lerp(
      this.lerp(this.grad(aa, x, y), this.grad(ba, x - 1, y), u),
      this.lerp(this.grad(ab, x, y - 1), this.grad(bb, x - 1, y - 1), u),
      v
    );
  }
  fbm(x, y, octaves, lacunarity, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.get(x * freq, y * freq);
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }
}

// 简单3D哈希噪声（矿石分布用）
function hash3(x, y, z, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ x, 0x27d4eb2d);
  h = Math.imul(h ^ y, 0x165667b1);
  h = Math.imul(h ^ z, 0x9e3779b1);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}
