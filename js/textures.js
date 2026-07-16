// ============ 程序化纹理生成（像素风原创美术） ============
'use strict';

const ATLAS_TILE = 16, ATLAS_COLS = 8, ATLAS_ROWS = 8;

const TEX = {
  canvas: null, ctx: null,
  crackBase: 32,
  init() {
    const c = document.createElement('canvas');
    c.width = ATLAS_COLS * ATLAS_TILE; c.height = ATLAS_ROWS * ATLAS_TILE;
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.genAll();
  },
  tilePos(i) { return [(i % ATLAS_COLS) * ATLAS_TILE, Math.floor(i / ATLAS_COLS) * ATLAS_TILE]; },
  uv(i) {
    const [x, y] = this.tilePos(i);
    const w = this.canvas.width, h = this.canvas.height, e = 0.02;
    return {
      u0: (x + e) / w, v0: 1 - (y + ATLAS_TILE - e) / h,
      u1: (x + ATLAS_TILE - e) / w, v1: 1 - (y + e) / h,
    };
  },

  // --- 像素绘制工具 ---
  px(i, x, y, color) {
    const [tx, ty] = this.tilePos(i);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(tx + x, ty + y, 1, 1);
  },
  noiseFill(i, base, vary, seed) {
    const rand = mulberry32(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = (rand() - 0.5) * 2 * vary;
      this.px(i, x, y, this.shade(base, v));
    }
  },
  shade(hex, amt) {
    const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt * 255));
    const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt * 255));
    const b = Math.max(0, Math.min(255, (hex & 255) + amt * 255));
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  },
  blob(i, cx, cy, r, color, seed) {
    const rand = mulberry32(seed);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + rand() * 1.5) {
        const px = cx + x, py = cy + y;
        if (px >= 0 && px < 16 && py >= 0 && py < 16) this.px(i, px, py, color);
      }
    }
  },
  oreTex(i, oreColor, oreDark, seed) {
    this.noiseFill(i, 0x7d7d7d, 0.06, seed);
    const rand = mulberry32(seed + 7);
    for (let n = 0; n < 5; n++) {
      const cx = 2 + (rand() * 12) | 0, cy = 2 + (rand() * 12) | 0;
      const r = 1 + (rand() * 1.4) | 0;
      this.blob(i, cx, cy, r, this.shade(oreDark, 0), seed + n * 13);
      this.blob(i, cx, cy, r - 1 < 1 ? 1 : r - 1, this.shade(oreColor, 0), seed + n * 29);
      this.px(i, cx, cy - 1 < 0 ? 0 : cy - 1, this.shade(oreColor, 0.18));
    }
  },

  genAll() {
    const g = this.ctx;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 0 草顶
    this.noiseFill(0, 0x5fae3f, 0.07, 11);
    // 1 草侧
    this.noiseFill(1, 0x8a6244, 0.07, 12);
    { const rand = mulberry32(31);
      for (let x = 0; x < 16; x++) {
        const d = 2 + (rand() * 3) | 0;
        for (let y = 0; y < d; y++) this.px(1, x, y, this.shade(0x5fae3f, (rand() - 0.5) * 0.14));
      } }
    // 2 泥土
    this.noiseFill(2, 0x8a6244, 0.08, 13);
    // 3 石头
    this.noiseFill(3, 0x7d7d7d, 0.06, 14);
    // 4 圆石
    this.noiseFill(4, 0x767676, 0.05, 15);
    { const rand = mulberry32(44);
      for (let n = 0; n < 9; n++) {
        const cx = (rand() * 14 + 1) | 0, cy = (rand() * 14 + 1) | 0, r = 2 + (rand() * 2) | 0;
        this.blob(4, cx, cy, r, this.shade(0x8b8b8b, (rand() - 0.5) * 0.1), 90 + n);
        this.px(4, cx - 1, cy - 1, this.shade(0x9a9a9a, 0));
      } }
    // 5 沙子
    this.noiseFill(5, 0xd9cf9c, 0.05, 16);
    // 6 水
    this.noiseFill(6, 0x3f68d9, 0.05, 17);
    { const rand = mulberry32(70);
      for (let n = 0; n < 6; n++) {
        const y = (rand() * 15) | 0, x = (rand() * 12) | 0;
        for (let k = 0; k < 3; k++) this.px(6, x + k, y, this.shade(0x5b83e8, 0.04));
      } }
    // 7 原木侧
    this.noiseFill(7, 0x6b5232, 0.06, 18);
    { const rand = mulberry32(80);
      for (let x = 0; x < 16; x += 2 + (rand() * 2 | 0)) {
        for (let y = 0; y < 16; y++) if (rand() > 0.2) this.px(7, x, y, this.shade(0x54402a, (rand() - 0.5) * 0.1));
      } }
    // 8 原木顶（年轮）
    this.noiseFill(8, 0x6b5232, 0.04, 19);
    for (let r = 6; r >= 1; r -= 2) {
      for (let a = 0; a < 40; a++) {
        const x = 8 + Math.round(Math.cos(a / 40 * 6.283) * r);
        const y = 8 + Math.round(Math.sin(a / 40 * 6.283) * r);
        if (x >= 0 && x < 16 && y >= 0 && y < 16) this.px(8, x, y, r % 4 === 0 ? '#a8845a' : '#54402a');
      }
    }
    this.px(8, 8, 8, '#a8845a');
    // 9 树叶
    { const rand = mulberry32(91);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rand();
        if (v < 0.12) { /* 透明孔 */ }
        else this.px(9, x, y, this.shade(0x3e7a25, (v - 0.5) * 0.16));
      } }
    // 10 木板
    this.noiseFill(10, 0xa8845a, 0.045, 20);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) this.px(10, x, y, '#6e5432');
    for (const [x, y0] of [[4, 0], [12, 4], [4, 8], [12, 12]])
      for (let y = y0; y < y0 + 4; y++) this.px(10, x, y, '#7d6038');
    // 11-13 矿石
    this.oreTex(11, 0x2a2a2e, 0x141416, 101); // 煤
    this.oreTex(12, 0xd8af93, 0xa87755, 102); // 铁
    this.oreTex(13, 0xe07f4f, 0xa04f28, 103); // 铜
    // 14 基岩
    this.noiseFill(14, 0x3a3a3a, 0.14, 104);
    // 15 玻璃
    { const [tx, ty] = this.tilePos(15);
      g.clearRect(tx, ty, 16, 16);
      g.fillStyle = 'rgba(200,230,255,0.28)'; g.fillRect(tx, ty, 16, 16);
      g.fillStyle = '#dff2ff';
      for (let k = 0; k < 16; k++) { g.fillRect(tx + k, ty, 1, 1); g.fillRect(tx + k, ty + 15, 1, 1); g.fillRect(tx, ty + k, 1, 1); g.fillRect(tx + 15, ty + k, 1, 1); }
      for (let k = 2; k < 7; k++) g.fillRect(tx + k, ty + 9 - k, 1, 1);
      for (let k = 4; k < 12; k++) g.fillRect(tx + k, ty + 15 - k, 1, 1);
    }
    // 16 石砖
    this.noiseFill(16, 0x8a8a8a, 0.04, 105);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) this.px(16, x, y, '#5a5a5a');
    for (let y = 0; y < 16; y += 8) { for (let k = 0; k < 4; k++) { this.px(16, 8, y + k, '#5a5a5a'); this.px(16, 0, y + 4 + k, '#5a5a5a'); } }
    // 17 工作台顶
    this.noiseFill(17, 0xa8845a, 0.05, 106);
    { const [tx, ty] = this.tilePos(17);
      g.fillStyle = '#6e5432'; g.fillRect(tx, ty, 16, 1); g.fillRect(tx, ty + 15, 16, 1); g.fillRect(tx, ty, 1, 16); g.fillRect(tx + 15, ty, 1, 16);
      g.fillStyle = '#c8b28a'; g.fillRect(tx + 2, ty + 2, 5, 5); g.fillRect(tx + 9, ty + 2, 5, 5); g.fillRect(tx + 2, ty + 9, 5, 5); g.fillRect(tx + 9, ty + 9, 5, 5);
      g.fillStyle = '#54402a'; g.fillRect(tx + 7, ty + 2, 2, 12); g.fillRect(tx + 2, ty + 7, 12, 2);
    }
    // 18 工作台正面 / 19 侧面
    for (const [idx, hasTools] of [[18, true], [19, false]]) {
      this.noiseFill(idx, 0xa8845a, 0.05, 107 + idx);
      const [tx, ty] = this.tilePos(idx);
      g.fillStyle = '#8f6f45'; g.fillRect(tx, ty, 16, 2);
      g.fillStyle = '#54402a'; g.fillRect(tx, ty + 8, 16, 1);
      if (hasTools) {
        g.fillStyle = '#7d7d7d'; g.fillRect(tx + 3, ty + 3, 3, 2); g.fillRect(tx + 10, ty + 3, 2, 3);
        g.fillStyle = '#54402a'; g.fillRect(tx + 4, ty + 5, 1, 3); g.fillRect(tx + 10, ty + 6, 1, 2);
      }
    }
    // 20 熔炉正面 21 顶 22 侧
    this.noiseFill(21, 0x6f6f6f, 0.05, 110);
    this.noiseFill(22, 0x767676, 0.05, 111);
    { const [tx, ty] = this.tilePos(22); g.fillStyle = '#4c4c4c'; g.fillRect(tx, ty, 1, 16); g.fillRect(tx + 15, ty, 1, 16); }
    this.noiseFill(20, 0x767676, 0.05, 112);
    { const [tx, ty] = this.tilePos(20);
      g.fillStyle = '#333'; g.fillRect(tx + 4, ty + 8, 8, 6);
      g.fillStyle = '#1a1a1a'; g.fillRect(tx + 5, ty + 9, 6, 4);
      g.fillStyle = '#4c4c4c'; g.fillRect(tx, ty, 1, 16); g.fillRect(tx + 15, ty, 1, 16); g.fillRect(tx, ty + 15, 16, 1);
    }
    // 23 箱子正面 24 顶 25 侧
    for (const idx of [23, 24, 25]) {
      this.noiseFill(idx, 0x9a6b34, 0.05, 113 + idx);
      const [tx, ty] = this.tilePos(idx);
      g.fillStyle = '#5e3f1c';
      g.fillRect(tx, ty, 16, 1); g.fillRect(tx, ty + 15, 16, 1); g.fillRect(tx, ty, 1, 16); g.fillRect(tx + 15, ty, 1, 16);
      if (idx !== 24) { g.fillStyle = '#5e3f1c'; g.fillRect(tx, ty + 6, 16, 1); }
      if (idx === 23) { g.fillStyle = '#c9c9c9'; g.fillRect(tx + 7, ty + 4, 2, 4); g.fillStyle = '#8a8a8a'; g.fillRect(tx + 7, ty + 7, 2, 1); }
    }
    // 26 沙砾
    this.noiseFill(26, 0x8a8078, 0.1, 120);
    { const rand = mulberry32(121);
      for (let n = 0; n < 14; n++) this.blob(26, (rand() * 14) | 0, (rand() * 14) | 0, 1, this.shade(0x9a9088, (rand() - 0.5) * 0.25), 200 + n); }
    // 27 机器基座（科技风金属板）
    this.noiseFill(27, 0x3c4654, 0.03, 122);
    { const [tx, ty] = this.tilePos(27);
      g.fillStyle = '#2a323e';
      g.fillRect(tx, ty, 16, 1); g.fillRect(tx, ty + 15, 16, 1); g.fillRect(tx, ty, 1, 16); g.fillRect(tx + 15, ty, 1, 16);
      g.fillStyle = '#57e6ff'; g.fillRect(tx + 2, ty + 2, 2, 1); g.fillRect(tx + 12, ty + 13, 2, 1);
      g.fillStyle = '#556274'; g.fillRect(tx + 3, ty + 7, 10, 2);
    }
    // 28 火把
    { const [tx, ty] = this.tilePos(28);
      g.clearRect(tx, ty, 16, 16);
      g.fillStyle = '#8f6f45'; g.fillRect(tx + 7, ty + 6, 2, 9);
      g.fillStyle = '#54402a'; g.fillRect(tx + 7, ty + 14, 2, 1);
      g.fillStyle = '#ffcc33'; g.fillRect(tx + 6, ty + 4, 4, 3);
      g.fillStyle = '#ff8814'; g.fillRect(tx + 7, ty + 3, 2, 2);
      g.fillStyle = '#fff2a8'; g.fillRect(tx + 7, ty + 5, 2, 1);
    }
    // 29 树苗
    { const [tx, ty] = this.tilePos(29);
      g.clearRect(tx, ty, 16, 16);
      g.fillStyle = '#54402a'; g.fillRect(tx + 7, ty + 9, 2, 6);
      const rand = mulberry32(311);
      for (const [cx, cy, r] of [[8, 5, 3], [6, 7, 2], [10, 7, 2], [8, 3, 2]]) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r + 0.5 && rand() > 0.15)
            this.px(29, cx + x, cy + y, this.shade(0x3e7a25, (rand() - 0.5) * 0.2));
        }
      }
    }
    // 32-36 裂纹阶段
    for (let s = 0; s < 5; s++) {
      const idx = this.crackBase + s;
      const [tx, ty] = this.tilePos(idx);
      g.clearRect(tx, ty, 16, 16);
      const rand = mulberry32(400 + s);
      g.fillStyle = 'rgba(20,16,12,0.85)';
      const cracks = 2 + s * 2;
      for (let c = 0; c < cracks; c++) {
        let x = 4 + (rand() * 8) | 0, y = 4 + (rand() * 8) | 0;
        const len = 3 + s * 2;
        for (let k = 0; k < len; k++) {
          g.fillRect(tx + x, ty + y, 1, 1);
          x += (rand() * 3 | 0) - 1; y += (rand() * 3 | 0) - 1;
          x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
        }
      }
    }
  },
};

// ============ 物品图标（原创像素画） ============
const ICONS = {
  cache: {},
  // 图例调色板
  pal: {
    ' ': null, k: '#1c1c1c', K: '#333', w: '#deb76a', W: '#a8845a', d: '#6e5432',
    s: '#8a8a8a', S: '#b0b0b0', i: '#d8d8d8', I: '#f4f4f4', c: '#e07f4f', C: '#f0a06f',
    r: '#c93b3b', R: '#ff6b6b', b: '#2f6fdb', B: '#57a0ff', g: '#3e9e3e', G: '#6fd06f',
    y: '#ffd94a', Y: '#fff2a8', o: '#ff8814', m: '#b04fe0', n: '#57e6ff', N: '#0e4a5e',
    e: '#3c4654', E: '#556274', t: '#23d18b', p: '#dfe9f5', x: '#7d7d7d',
  },
  art: {},
  drawArt(id, size) {
    const rows = this.art[id]; if (!rows) return null;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const n = rows.length, s = size / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < rows[y].length; x++) {
      const col = this.pal[rows[y][x]];
      if (col) { g.fillStyle = col; g.fillRect(Math.floor(x * s), Math.floor(y * s), Math.ceil(s), Math.ceil(s)); }
    }
    return c;
  },
  isoCube(topIdx, sideIdx, size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const a = TEX.canvas, T = ATLAS_TILE;
    const [t0x, t0y] = TEX.tilePos(topIdx), [s0x, s0y] = TEX.tilePos(sideIdx);
    const u = size / 32;
    // 顶面
    g.save(); g.setTransform(u, -0.5 * u, u, 0.5 * u, 0 * u, 8 * u);
    g.drawImage(a, t0x, t0y, T, T, 0, 0, 16, 16); g.restore();
    // 左面（暗）
    g.save(); g.setTransform(u, 0.5 * u, 0, u, 0, 8 * u);
    g.drawImage(a, s0x, s0y, T, T, 0, 0, 16, 16);
    g.globalAlpha = 0.28; g.fillStyle = '#000'; g.fillRect(0, 0, 16, 16); g.restore();
    // 右面（更暗）
    g.save(); g.setTransform(u, -0.5 * u, 0, u, 16 * u, 16 * u);
    g.drawImage(a, s0x, s0y, T, T, 0, 0, 16, 16);
    g.globalAlpha = 0.42; g.fillStyle = '#000'; g.fillRect(0, 0, 16, 16); g.restore();
    return c;
  },
  get(itemId) {
    if (this.cache[itemId]) return this.cache[itemId];
    const item = ITEMS[itemId];
    let canvas = null;
    if (this.art[itemId]) canvas = this.drawArt(itemId, 48);
    else if (item && item.block != null) {
      const t = BLOCKS[item.block].tex;
      canvas = this.isoCube(t[0], t[2], 48);
    }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = canvas.height = 48; }
    const url = canvas.toDataURL();
    this.cache[itemId] = url;
    return url;
  },
};

// 16x16 像素画定义
ICONS.art = {
  stick: [
    '                ', '                ', '            d   ', '           dw  ',
    '          dwd   ', '         dwd    ', '        dwd     ', '       dwd      ',
    '      dwd       ', '     dwd        ', '    dwd         ', '   dwd          ',
    '  dwd           ', '  d             ', '                ', '                '],
  coal: [
    '                ', '                ', '     kkk        ', '    kKKkk       ',
    '   kKKKKkk      ', '  kKKkKKKkk     ', '  kKKKKkKKk     ', ' kKkKKKKKKkk    ',
    ' kKKKKkKKKKk    ', ' kKKKkKKKkKk    ', '  kKKKKKKKk     ', '  kkKKkKKkk     ',
    '   kkKKKkk      ', '     kkk        ', '                ', '                '],
  iron_ore: [
    '                ', '                ', '     xxx        ', '    xCcxx       ',
    '   xcCCcxx      ', '  xxcCcxxxx     ', '  xCcxxxCcx     ', ' xxCCcxxCCcx    ',
    ' xcCCcxcCCcx    ', ' xxccxxxccxx    ', '  xxxCcxxxx     ', '   xxCCcxx      ',
    '    xxcxx       ', '     xxx        ', '                ', '                '],
  copper_ore: [
    '                ', '                ', '     xxx        ', '    xCcxx       ',
    '   xoccoxx      ', '  xxcocxxxx     ', '  xocxxxocx     ', ' xxoocxxoocx    ',
    ' xcoocxcoocx    ', ' xxccxxxccxx    ', '  xxxocxxxx     ', '   xxoocxx      ',
    '    xxcxx       ', '     xxx        ', '                ', '                '],
  iron_ingot: [
    '                ', '                ', '                ', '                ',
    '      IIIIIi    ', '     IiiiiiSi   ', '    ISSSSSSSsi  ', '   IiSSSSSSss   ',
    '  IiSSSSSSss    ', '  isssssssss    ', '  ssssssssss    ', '                ',
    '                ', '                ', '                ', '                '],
  copper_ingot: [
    '                ', '                ', '                ', '                ',
    '      CCCCCc    ', '     CccccccC   ', '    Ccccccccc   ', '   CcccccccC    ',
    '  Ccccccccc     ', '  ccccccccc     ', '  ccccccccc     ', '                ',
    '                ', '                ', '                ', '                '],
  magnet: [
    '                ', '                ', '   rrr    bbb   ', '  rRRr    bBb   ',
    '  rRr      bb   ', '  rRr      bb   ', '  rRr      bb   ', '  rRrr    bbb   ',
    '  rRRrr  bbbb   ', '   rRRrrbbbb    ', '    rRRbbbb     ', '     rrbb       ',
    '                ', '                ', '                ', '                '],
  gear: [
    '                ', '      ss        ', '   s  SS  s     ', '  sS sSSs Ss    ',
    '   sSSSSSSs     ', '   sSSssSSs     ', ' sSSSs  sSSSs   ', ' sSSs    sSSs   ',
    ' sSSs    sSSs   ', ' sSSSs  sSSSs   ', '   sSSssSSs     ', '   sSSSSSSs     ',
    '  sS sSSs Ss    ', '   s  SS  s     ', '      ss        ', '                '],
  circuit: [
    '                ', '                ', '  gggggggggggg  ', '  gGGGGGGGGGGg  ',
    '  gGyGGyGGyGGg  ', '  gGyGGyGGyGGg  ', '  gGyyyyGGyGGg  ', '  gGGGGyGGyGGg  ',
    '  gGyGGyyyyGGg  ', '  gGyGGGGGGGGg  ', '  gGyyyyyGGGGg  ', '  gGGGGGGGGGGg  ',
    '  gggggggggggg  ', '   y  y  y  y   ', '                ', '                '],
  coil: [
    '                ', '                ', '    ssssss      ', '   sSSSSSSs     ',
    '  sSccccccSs    ', '  sScCCCCcSs    ', '  sScCsSCcSs    ', '  sScCsSCcSs    ',
    '  sScCsSCcSs    ', '  sScCsSCcSs    ', '  sScCCCCcSs    ', '  sSccccccSs    ',
    '   sSSSSSSs     ', '    ssssss      ', '                ', '                '],
  matrix: [
    '                ', '                ', '     nnnnnn     ', '    nBBBBBBn    ',
    '   nBnnnnnnBn   ', '   nBnNNNNnBn   ', '   nBnNBBNnBn   ', '   nBnNBBNnBn   ',
    '   nBnNNNNnBn   ', '   nBnnnnnnBn   ', '    nBBBBBBn    ', '     nnnnnn     ',
    '      n  n      ', '                ', '                ', '                '],
  solar_sail: [
    '                ', '  nppppppppn    ', '  pnppppppnp    ', '  ppnppppnpp    ',
    '  pppnppnppp    ', '  ppppnnpppp    ', '  ppppnnpppp    ', '  pppnppnppp    ',
    '  ppnppppnpp    ', '  pnppppppnp    ', '  nppppppppn    ', '       e        ',
    '      eee       ', '       e        ', '                ', '                '],
  apple: [
    '                ', '       d        ', '      d         ', '     ggd        ',
    '    g rr rr     ', '   rrRRrrrrr    ', '   rRRrrrrrr    ', '  rRRrrrrrrrr   ',
    '  rRrrrrrrrrr   ', '  rrrrrrrrrrr   ', '   rrrrrrrrr    ', '   rrrrrrrrr    ',
    '    rrr rrr     ', '                ', '                ', '                '],
  sapling: [
    '                ', '                ', '      gg        ', '     gGGg       ',
    '    gGGGGg      ', '   gGGgGGGg     ', '    gGGGGg      ', '     gGg        ',
    '      d         ', '      dd        ', '      d         ', '     ddd        ',
    '                ', '                ', '                ', '                '],
  wind_turbine: [
    '       i        ', '       i        ', '       i        ', '   iiiiSii i    ',
    '       SS ii    ', '      iSSi      ', '     i iSi      ', '    ii  i i     ',
    '   i    ee      ', '        ee      ', '        ee      ', '        ee      ',
    '        ee      ', '       eEe      ', '      eEEEe     ', '                '],
  miner: [
    '                ', '     nn         ', '    eEEe        ', '   eEEEEe       ',
    '  eEnEEnEe      ', '  eEEEEEEe      ', '  eeEEEEee      ', '   sSsSsS       ',
    '   ssssss       ', '    sSSs        ', '    KssK        ', '   K ss K       ',
    '  K  ss  K      ', '     ss         ', '     KK         ', '                '],
  smelter: [
    '                ', '   eeeeeeee     ', '  eEEEEEEEEe    ', '  eEnnnnnnEe    ',
    '  eEnooyonEe    ', '  eEnoyyyonEe   ', '  eEnoyoyonEe   ', '  eEnooooonEe   ',
    '  eEnnnnnnnEe   ', '  eEEEEEEEEEe   ', '  eeeeeeeeeee   ', '   K K  K K     ',
    '   K K  K K     ', '                ', '                ', '                '],
  assembler: [
    '                ', '   eeeeeeee     ', '  eEEEEEEEEe    ', '  eEssssssEe    ',
    '  eEsSnnSsEe    ', '  eEsnttnsEe    ', '  eEsnttnsEe    ', '  eEsSnnSsEe    ',
    '  eEssssssEe    ', '  eEEEEEEEEe    ', '  eeeeeeeeee    ', '   K      K     ',
    '   K      K     ', '                ', '                ', '                '],
  belt: [
    '                ', '                ', '                ', '  kkkkkkkkkkkk  ',
    ' kEEEEEEEEEEEEk ', ' kEnEEnEEnEEnEk ', ' kEEnEEnEEnEEnk ', ' kEnEEnEEnEEnEk ',
    ' kEEEEEEEEEEEEk ', '  kkkkkkkkkkkk  ', '   s   s   s    ', '                ',
    '                ', '                ', '                ', '                '],
  lab: [
    '                ', '      nn        ', '     nBBn       ', '    nBnnBn      ',
    '   eEEEEEEe     ', '  eEEnEEnEEe    ', '  eEEEEEEEEe    ', '  eEnEEEEnEe    ',
    '   eEEEEEEe     ', '    eEEEEe      ', '   eEEEEEEe     ', '  eEEEEEEEEe    ',
    '  eeeeeeeeee    ', '                ', '                ', '                '],
  ejector: [
    '                ', '          nn    ', '         nBn    ', '        nBn     ',
    '       eEEn     ', '      eEEEe     ', '     eEEEe      ', '    eEEEe       ',
    '   eEEEe        ', '  eEEEe         ', '  eEEe          ', '  eEEEEEEe      ',
    '  eEEEEEEEe     ', '  eeeeeeeee     ', '   K      K     ', '                '],
};

// 工具像素画生成（按材质换色）
(function genTools() {
  const heads = { wood: ['w', 'W'], stone: ['S', 's'], iron: ['I', 'i'] };
  for (const [mat, [hi, lo]] of Object.entries(heads)) {
    ICONS.art[mat + '_pickaxe'] = [
      '                ', `     ${hi}${hi}${hi}${hi}${hi}      `, `   ${hi}${hi}${lo}${lo}${lo}${hi}${hi}     `, `  ${hi}${lo}    ${lo}${hi}${hi}    `,
      ` ${hi}${lo}      d${lo}${hi}   `, ` ${hi}${lo}      dw ${hi}${lo}  `, `  ${lo}      dw  ${lo}  `, '       dw       ',
      '      dw        ', '     dw         ', '    dw          ', '   dw           ',
      '  dw            ', ' dw             ', ' d              ', '                '];
    ICONS.art[mat + '_axe'] = [
      '                ', `    ${hi}${hi}${hi}       `, `   ${hi}${lo}${lo}${hi}${hi}      `, `  ${hi}${lo}  ${lo}${hi}${hi}     `,
      `  ${hi}${lo} dw${lo}${lo}${hi}     `, `   ${lo}dw ${lo}${lo}      `, '    dw          ', '   dw           ',
      '  dw            ', ' dw             ', ' d              ', '                ',
      '                ', '                ', '                ', '                '];
    ICONS.art[mat + '_shovel'] = [
      '                ', `      ${hi}${hi}${hi}     `, `     ${hi}${lo}${lo}${lo}${hi}    `, `     ${hi}${lo}${lo}${lo}${hi}    `,
      `      ${lo}d${lo}     `, '      dw        ', '     dw         ', '    dw          ',
      '   dw           ', '  dw            ', ' dw             ', ' d              ',
      '                ', '                ', '                ', '                '];
  }
})();
