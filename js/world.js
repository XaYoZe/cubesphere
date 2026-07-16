// ============ 体素世界：地形生成 / 分块网格 ============
'use strict';

const CHUNK = 16, WORLD_H = 64, SEA = 20;

class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.noise = new Noise2D(seed);
    this.noise2 = new Noise2D(seed + 777);
    this.chunks = new Map();       // "cx,cz" -> {data, mesh, meshT, dirty}
    this.edits = {};               // 存档：被修改的方块 "x,y,z" -> id
    this.buildQueue = [];
    this.material = null;
    this.materialT = null;
    // ---- 水流模拟 ----
    this.flow = new Map();         // "x,y,z" -> 流动水位 1..7（不在表中的 WATER = 水源=8）
    this.waterActive = new Set();  // 待评估的水/空气格
    this.waterAccum = 0;
  }

  key(cx, cz) { return cx + ',' + cz; }

  initMaterials(atlasTex) {
    this.material = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
    this.materialT = new THREE.MeshBasicMaterial({
      map: atlasTex, vertexColors: true, transparent: true, opacity: 1.0,
      alphaTest: 0.15, side: THREE.DoubleSide, depthWrite: true,
    });
    this.materialW = new THREE.MeshBasicMaterial({
      map: atlasTex, vertexColors: true, transparent: true, opacity: 0.72,
      side: THREE.DoubleSide, depthWrite: false,
    });
  }

  // ---- 地形生成 ----
  surfaceHeight(x, z) {
    const n = this.noise.fbm(x * 0.012, z * 0.012, 4, 2.0, 0.5);
    const hills = this.noise2.fbm(x * 0.045, z * 0.045, 3, 2.2, 0.45);
    let h = 24 + n * 14 + hills * 6;
    return Math.max(4, Math.min(WORLD_H - 10, Math.floor(h)));
  }

  genChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
    const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
        const h = this.surfaceHeight(wx, wz);
        for (let y = 0; y < WORLD_H; y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y < h - 3) {
            id = B.STONE;
            const r = hash3(wx, y, wz, this.seed);
            if (r < 0.045 && y < 42) id = B.COAL_ORE;
            else if (r >= 0.05 && r < 0.085 && y < 34) id = B.IRON_ORE;
            else if (r >= 0.09 && r < 0.118 && y < 34) id = B.COPPER_ORE;
            else if (r >= 0.12 && r < 0.132 && y < 30) id = B.GRAVEL;
          }
          else if (y < h) id = (h <= SEA + 1) ? B.SAND : B.DIRT;
          else if (y === h) id = (h <= SEA + 1) ? B.SAND : B.GRASS;
          else if (y <= SEA) id = B.WATER;
          data[idx(lx, y, lz)] = id;
        }
      }
    }
    // 树
    const rand = mulberry32((cx * 341 + cz * 173 + this.seed) >>> 0);
    const treeCount = (rand() * 4) | 0;
    for (let t = 0; t < treeCount; t++) {
      const lx = 2 + (rand() * (CHUNK - 4)) | 0;
      const lz = 2 + (rand() * (CHUNK - 4)) | 0;
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
      const h = this.surfaceHeight(wx, wz);
      if (h <= SEA + 1) continue;
      if (data[idx(lx, h, lz)] !== B.GRASS) continue;
      const th = 4 + (rand() * 2 | 0);
      for (let k = 1; k <= th; k++) data[idx(lx, h + k, lz)] = B.LOG;
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const r = dy >= th ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy <= th) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() < 0.5) continue;
          const px = lx + dx, pz = lz + dz, py = h + dy;
          if (px < 0 || px >= CHUNK || pz < 0 || pz >= CHUNK || py >= WORLD_H) continue;
          if (data[idx(px, py, pz)] === B.AIR) data[idx(px, py, pz)] = B.LEAVES;
        }
      }
    }
    // 应用存档修改
    const c = { data, mesh: null, meshT: null, meshW: null, dirty: true, cx, cz };
    for (const k in this.edits) {
      const [x, y, z] = k.split(',').map(Number);
      if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz) {
        const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
        if (y >= 0 && y < WORLD_H) data[idx(lx, y, lz)] = this.edits[k];
      }
    }
    return c;
  }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) { c = this.genChunk(cx, cz); this.chunks.set(k, c); }
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_H) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return B.AIR;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    return c.data[(y * CHUNK + lz) * CHUNK + lx];
  }

  setBlock(x, y, z, id, record = true, queue = true) {
    if (y < 1 || y >= WORLD_H) return;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.ensureChunk(cx, cz);
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    c.data[(y * CHUNK + lz) * CHUNK + lx] = id;
    if (record) this.edits[x + ',' + y + ',' + z] = id;
    c.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
    if (queue) { this.queueWater(x, y, z); this.queueNeighbors(x, y, z); }
  }

  // ============ 水流模拟 ============
  queueWater(x, y, z) {
    if (y >= 1 && y < WORLD_H) this.waterActive.add(x + ',' + y + ',' + z);
  }
  queueNeighbors(x, y, z) {
    this.queueWater(x + 1, y, z); this.queueWater(x - 1, y, z);
    this.queueWater(x, y, z + 1); this.queueWater(x, y, z - 1);
    this.queueWater(x, y + 1, z); this.queueWater(x, y - 1, z);
  }
  waterLevel(x, y, z) {
    if (this.getBlock(x, y, z) !== B.WATER) return 0;
    const k = x + ',' + y + ',' + z;
    return this.flow.has(k) ? this.flow.get(k) : 8; // 8 = 无限水源
  }
  updateWater(dt) {
    this.waterAccum += dt;
    if (this.waterAccum < 0.16 || this.waterActive.size === 0) return;
    this.waterAccum = 0;
    const batch = this.waterActive;
    this.waterActive = new Set();
    let n = 0;
    for (const key of batch) {
      if (n++ > 1500) { this.waterActive.add(key); continue; }
      const [x, y, z] = key.split(',').map(Number);
      this.evalWater(x, y, z);
    }
  }
  evalWater(x, y, z) {
    const k = x + ',' + y + ',' + z;
    const id = this.getBlock(x, y, z);
    const isSource = id === B.WATER && !this.flow.has(k); // 海洋/水源
    if (isSource) return; // 水源恒满，由邻格主动汲取
    // 供给：正上方有水=垂直下落(视为满)，否则取四邻水位-1的最大值
    const fedAbove = this.getBlock(x, y + 1, z) === B.WATER;
    let best = 0;
    if (fedAbove) best = 8;
    else {
      best = Math.max(best,
        this.waterLevel(x + 1, y, z) - 1, this.waterLevel(x - 1, y, z) - 1,
        this.waterLevel(x, y, z + 1) - 1, this.waterLevel(x, y, z - 1) - 1);
    }
    if (id === B.WATER) {
      // 流动水：更新水位或干涸
      if (best <= 0) {
        this.setBlock(x, y, z, B.AIR, true, false);
        this.flow.delete(k);
        this.queueNeighbors(x, y, z);
      } else {
        const lvl = fedAbove ? 7 : best;
        if (this.flow.get(k) !== lvl) { this.flow.set(k, lvl); this.queueNeighbors(x, y, z); }
        this.queueWater(x, y - 1, z); // 继续向下流
      }
    } else if (id === B.AIR && best >= 1) {
      const lvl = fedAbove ? 7 : best;
      this.setBlock(x, y, z, B.WATER, true, false);
      this.flow.set(k, lvl);
      this.queueNeighbors(x, y, z);
    }
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(this.key(cx, cz));
    if (c) c.dirty = true;
  }

  // ---- 网格构建 ----
  static FACES = [
    { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, ti: 0 },
    { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, ti: 1 },
    { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8, ti: 2 },
    { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8, ti: 3 },
    { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.65, ti: 4 },
    { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.65, ti: 5 },
  ];

  buildChunkMesh(c) {
    const opq = { pos: [], uv: [], col: [], idx: [] };
    const trs = { pos: [], uv: [], col: [], idx: [] };
    const wtr = { pos: [], uv: [], col: [], idx: [] };
    const baseX = c.cx * CHUNK, baseZ = c.cz * CHUNK;
    const get = (x, y, z) => {
      if (y < 0 || y >= WORLD_H) return B.AIR;
      if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK)
        return c.data[(y * CHUNK + z) * CHUNK + x];
      return this.getBlock(baseX + x, y, baseZ + z);
    };

    for (let y = 0; y < WORLD_H; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          const id = c.data[(y * CHUNK + z) * CHUNK + x];
          if (id === B.AIR) continue;
          const info = BLOCKS[id];
          if (info.nonCube) { this.addCross(trs, x, y, z, info.tex[0]); continue; }
          const target = id === B.WATER ? wtr : (info.transparent ? trs : opq);
          for (const face of World.FACES) {
            const nb = get(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            if (id === B.WATER) {
              if (nb === B.WATER || isOpaqueBlock(nb)) continue;
            } else if (info.transparent) {
              if (nb === id && id !== B.LEAVES) continue;
              if (isOpaqueBlock(nb)) continue;
            } else {
              if (isOpaqueBlock(nb)) continue;
            }
            const uv = TEX.uv(info.tex[face.ti]);
            const vi = target.pos.length / 3;
            let topOffset = 0;
            if (id === B.WATER && face.ti === 0) topOffset = -0.12;
            for (const cn of face.corners) {
              target.pos.push(x + cn[0], y + cn[1] + (cn[1] === 1 ? topOffset : 0), z + cn[2]);
              target.col.push(face.shade, face.shade, face.shade);
            }
            target.uv.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
            target.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          }
        }
      }
    }

    for (const [meshKey, dat, mat] of [['mesh', opq, this.material], ['meshT', trs, this.materialT], ['meshW', wtr, this.materialW]]) {
      if (c[meshKey]) { this.scene.remove(c[meshKey]); c[meshKey].geometry.dispose(); c[meshKey] = null; }
      if (dat.pos.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(dat.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(dat.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(dat.col, 3));
      geo.setIndex(dat.idx);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(baseX, 0, baseZ);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      c[meshKey] = mesh;
    }
    c.dirty = false;
  }

  addCross(target, x, y, z, texIdx) {
    const uv = TEX.uv(texIdx);
    const quads = [
      [[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]],
      [[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]],
    ];
    for (const q of quads) {
      const vi = target.pos.length / 3;
      for (const cn of q) { target.pos.push(x + cn[0], y + cn[1], z + cn[2]); target.col.push(1, 1, 1); }
      target.uv.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
      target.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    }
  }

  // ---- 每帧更新：按需生成/卸载/重建 ----
  update(px, pz, radius) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz > (radius + 0.5) * (radius + 0.5)) continue;
        this.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    // 卸载远处
    for (const [k, c] of this.chunks) {
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > radius + 2) {
        for (const mk of ['mesh', 'meshT', 'meshW'])
          if (c[mk]) { this.scene.remove(c[mk]); c[mk].geometry.dispose(); }
        this.chunks.delete(k);
      }
    }
    // 每帧最多重建 2 个
    let built = 0;
    const dirty = [];
    for (const c of this.chunks.values()) if (c.dirty) dirty.push(c);
    dirty.sort((a, b) => {
      const da = (a.cx - pcx) ** 2 + (a.cz - pcz) ** 2, db = (b.cx - pcx) ** 2 + (b.cz - pcz) ** 2;
      return da - db;
    });
    for (const c of dirty) {
      this.buildChunkMesh(c);
      if (++built >= 2) break;
    }
    return dirty.length;
  }

  // ---- 射线投射 (DDA) ----
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-10)), tDeltaY = Math.abs(1 / (dir.y || 1e-10)), tDeltaZ = Math.abs(1 / (dir.z || 1e-10));
    let tMaxX = tDeltaX * (dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x));
    let tMaxY = tDeltaY * (dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y));
    let tMaxZ = tDeltaZ * (dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z));
    let face = [0, 0, 0];
    let t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER) {
        return { x, y, z, id, face, dist: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
    }
    return null;
  }
}
