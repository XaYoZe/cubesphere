// ============ 工业机器系统：电力 / 传送带 / 自动化 ============
'use strict';

const MACHINE_DEFS = {
  wind_turbine: { name: '风力涡轮机', power: +300, size: 1 },
  miner:        { name: '采矿机', power: -120, size: 1 },
  smelter:      { name: '电弧熔炉', power: -180, size: 1 },
  assembler:    { name: '制造台 Mk.I', power: -150, size: 1 },
  lab:          { name: '矩阵研究站', power: -200, size: 1 },
  ejector:      { name: '电磁弹射器', power: -250, size: 1 },
  belt:         { name: '传送带', power: 0, size: 1 },
};

class MachineSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.machines = new Map();   // "x,y,z" -> machine
    this.containers = new Map(); // "x,y,z" -> {slots:[]} 箱子/熔炉
    this.tickAcc = 0;
    this.powerGen = 0; this.powerUse = 0; this.powerSat = 1;
    this.beltItemMeshes = [];
    this.beltItemPool = [];
    this.time = 0;
  }

  key(x, y, z) { return x + ',' + y + ',' + z; }

  // ============ 放置 / 拆除 ============
  place(type, x, y, z, facing) {
    const k = this.key(x, y, z);
    if (this.machines.has(k)) return false;
    const m = {
      type, x, y, z, facing: facing || 0,
      buffer: {}, output: {},
      recipe: null, progress: 0, working: false,
      items: type === 'belt' ? [] : null, // 传送带上的物品 {id, pos:0..1, mesh}
      sails: 0, launchT: 0,
      mineT: 0,
    };
    this.machines.set(k, m);
    this.world.setBlock(x, y, z, B.MACHINE);
    m.group = this.buildModel(m);
    this.scene.add(m.group);
    return true;
  }

  remove(x, y, z) {
    const k = this.key(x, y, z);
    const m = this.machines.get(k);
    if (!m) return null;
    if (m.group) this.scene.remove(m.group);
    if (m.items) for (const it of m.items) if (it.mesh) this.scene.remove(it.mesh);
    this.machines.delete(k);
    this.world.setBlock(x, y, z, B.AIR);
    return m;
  }

  get(x, y, z) { return this.machines.get(this.key(x, y, z)); }

  // ============ 3D 模型（程序化几何体，科幻风） ============
  buildModel(m) {
    const g = new THREE.Group();
    const metal = new THREE.MeshLambertMaterial({ color: 0x51617a });
    const metalDark = new THREE.MeshLambertMaterial({ color: 0x323d4e });
    const glow = new THREE.MeshBasicMaterial({ color: 0x57e6ff });
    const glowY = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
    const add = (geo, mat, x, y, z, ry) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (ry) mesh.rotation.y = ry;
      g.add(mesh);
      return mesh;
    };
    const T = m.type;
    if (T === 'wind_turbine') {
      add(new THREE.CylinderGeometry(0.3, 0.42, 0.15, 8), metalDark, 0, 0.08, 0);
      add(new THREE.CylinderGeometry(0.06, 0.1, 2.2, 6), metal, 0, 1.2, 0);
      const hub = add(new THREE.BoxGeometry(0.18, 0.18, 0.3), metalDark, 0, 2.3, 0.05);
      const rotor = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.03), new THREE.MeshLambertMaterial({ color: 0xdfe9f5 }));
        blade.position.y = 0.5;
        const holder = new THREE.Group();
        holder.rotation.z = i * Math.PI * 2 / 3;
        holder.add(blade);
        rotor.add(holder);
      }
      rotor.position.set(0, 2.3, 0.24);
      g.add(rotor);
      m.rotor = rotor;
      add(new THREE.BoxGeometry(0.1, 0.06, 0.1), glow, 0, 0.18, 0);
    } else if (T === 'miner') {
      add(new THREE.BoxGeometry(0.9, 0.25, 0.9), metalDark, 0, 0.125, 0);
      add(new THREE.BoxGeometry(0.65, 0.5, 0.65), metal, 0, 0.5, 0);
      add(new THREE.CylinderGeometry(0.12, 0.05, 0.5, 6), metalDark, 0, 0.95, 0);
      m.drill = add(new THREE.ConeGeometry(0.14, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0x8a94a5 }), 0, 1.15, 0);
      add(new THREE.BoxGeometry(0.5, 0.06, 0.12), glow, 0, 0.62, 0.3);
      m.lamp = add(new THREE.BoxGeometry(0.1, 0.1, 0.1), glowY, 0.25, 0.79, 0.25);
    } else if (T === 'smelter') {
      add(new THREE.BoxGeometry(0.95, 0.2, 0.95), metalDark, 0, 0.1, 0);
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.7, 8), metal, 0, 0.55, 0);
      add(new THREE.CylinderGeometry(0.28, 0.34, 0.25, 8), metalDark, 0, 1.0, 0);
      m.fire = add(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xff7722 }), 0, 1.1, 0);
      const ringGeo = new THREE.TorusGeometry(0.42, 0.03, 6, 16);
      const ring = new THREE.Mesh(ringGeo, glow);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.35;
      g.add(ring);
      m.ring = ring;
    } else if (T === 'assembler' || T === 'lab') {
      const col = T === 'lab' ? 0x3a4d6b : 0x51617a;
      add(new THREE.BoxGeometry(0.95, 0.25, 0.95), metalDark, 0, 0.125, 0);
      add(new THREE.BoxGeometry(0.8, 0.45, 0.8), new THREE.MeshLambertMaterial({ color: col }), 0, 0.47, 0);
      if (T === 'lab') {
        add(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 6), metal, 0, 0.85, 0);
        m.core = add(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x3f9fff }), 0, 1.15, 0);
      } else {
        m.core = add(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshLambertMaterial({ color: 0x8a94a5 }), 0, 0.88, 0);
      }
      add(new THREE.BoxGeometry(0.82, 0.08, 0.2), glow, 0, 0.3, 0.32);
    } else if (T === 'ejector') {
      add(new THREE.BoxGeometry(0.95, 0.3, 0.95), metalDark, 0, 0.15, 0);
      add(new THREE.CylinderGeometry(0.35, 0.4, 0.2, 8), metal, 0, 0.4, 0);
      const barrel = new THREE.Group();
      barrel.rotation.order = 'YXZ';
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 8), metal);
      tube.position.y = 0.55;
      barrel.add(tube);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.15, 8), glow);
      tip.position.y = 1.2;
      barrel.add(tip);
      barrel.position.y = 0.5;
      barrel.rotation.x = 0.7;
      g.add(barrel);
      m.barrel = barrel;
    } else if (T === 'belt') {
      add(new THREE.BoxGeometry(0.98, 0.1, 0.98), metalDark, 0, 0.05, 0);
      const beltTop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.98), new THREE.MeshLambertMaterial({ color: 0x232a35 }));
      beltTop.position.y = 0.11;
      g.add(beltTop);
      // 方向箭头
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0x57e6ff });
      for (let i = 0; i < 2; i++) {
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 3), arrowMat);
        a.rotation.x = Math.PI / 2;
        a.position.set(0, 0.14, -0.22 + i * 0.44);
        g.add(a);
      }
      const rails = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.98), metal);
      rails.position.set(0.43, 0.06, 0); g.add(rails);
      const rails2 = rails.clone(); rails2.position.x = -0.43; g.add(rails2);
    }
    g.position.set(m.x + 0.5, m.y, m.z + 0.5);
    g.rotation.y = m.facing * Math.PI / 2;
    return g;
  }

  facingVec(f) {
    return [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]][f & 3]; // 0南 1东 2北 3西
  }

  // ============ 电力 ============
  computePower() {
    let gen = 0, use = 0;
    for (const m of this.machines.values()) {
      const def = MACHINE_DEFS[m.type];
      if (def.power > 0) gen += def.power;
      else if (def.power < 0 && m.working) use += -def.power;
    }
    this.powerGen = gen; this.powerUse = use;
    this.powerSat = use <= 0 ? 1 : Math.min(1, gen / use);
  }

  // ============ 物品缓存工具 ============
  bufAdd(buf, id, n) { buf[id] = (buf[id] || 0) + n; }
  bufTotal(buf) { let s = 0; for (const k in buf) s += buf[k]; return s; }
  bufTake(buf, id, n) {
    const have = buf[id] || 0;
    const take = Math.min(have, n);
    if (take > 0) { buf[id] -= take; if (buf[id] <= 0) delete buf[id]; }
    return take;
  }

  // ============ 主模拟（每 0.05s 一 tick） ============
  update(dt, game) {
    this.time += dt;
    this.tickAcc += dt;
    while (this.tickAcc > 0.05) {
      this.tickAcc -= 0.05;
      this.tick(0.05, game);
    }
    this.animate(dt);
  }

  tick(dt, game) {
    this.computePower();
    const sat = this.powerSat;
    for (const m of this.machines.values()) {
      switch (m.type) {
        case 'miner': this.tickMiner(m, dt * sat, game); break;
        case 'smelter': this.tickCrafter(m, dt * sat, MACHINE_SMELT, game); break;
        case 'assembler': this.tickCrafter(m, dt * sat, MACHINE_ASSEMBLE, game); break;
        case 'lab': this.tickLab(m, dt * sat, game); break;
        case 'ejector': this.tickEjector(m, dt * sat, game); break;
        case 'belt': this.tickBelt(m, dt); break;
      }
    }
  }

  tickMiner(m, dt, game) {
    // 输出满则停
    if (this.bufTotal(m.output) >= 20) { m.working = false; this.tryOutput(m); return; }
    // 找矿
    if (!m.oreTarget || this.world.getBlock(m.oreTarget[0], m.oreTarget[1], m.oreTarget[2]) === B.AIR
      || !blockInfo(this.world.getBlock(...m.oreTarget)).ore) {
      m.oreTarget = null;
      outer:
      for (let dy = 1; dy <= 6; dy++) {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const bx = m.x + dx, by = m.y - dy, bz = m.z + dz;
          const info = blockInfo(this.world.getBlock(bx, by, bz));
          if (info.ore) { m.oreTarget = [bx, by, bz]; break outer; }
        }
      }
    }
    if (!m.oreTarget) { m.working = false; return; }
    m.working = true;
    m.mineT += dt;
    if (m.mineT >= 2.0) {
      m.mineT = 0;
      const info = blockInfo(this.world.getBlock(...m.oreTarget));
      if (info.ore) {
        this.bufAdd(m.output, info.ore, 1);
        m.oreYield = (m.oreYield || 0) + 1;
        if (m.oreYield >= 12) {  // 一块矿产 12 个后耗尽
          m.oreYield = 0;
          this.world.setBlock(m.oreTarget[0], m.oreTarget[1], m.oreTarget[2], B.STONE);
          m.oreTarget = null;
        }
      }
    }
    this.tryOutput(m);
  }

  tickCrafter(m, dt, recipeList, game) {
    this.pullInputs(m);
    if (!m.recipe) { m.working = false; return; }
    const r = recipeList.find(x => x.id === m.recipe);
    if (!r) { m.working = false; return; }
    if (this.bufTotal(m.output) >= 30) { m.working = false; this.tryOutput(m); return; }
    if (m.progress <= 0) {
      // 检查原料
      let ok = true;
      for (const k in r.in) if ((m.buffer[k] || 0) < r.in[k]) ok = false;
      if (!ok) { m.working = false; this.tryOutput(m); return; }
      for (const k in r.in) this.bufTake(m.buffer, k, r.in[k]);
      m.progress = 0.0001;
    }
    m.working = true;
    m.progress += dt / r.time;
    if (m.progress >= 1) {
      m.progress = 0;
      for (const k in r.out) {
        this.bufAdd(m.output, k, r.out[k]);
        game.stats.obtained[k] = (game.stats.obtained[k] || 0) + r.out[k];
        if (m.type === 'smelter') game.stats.smelted[k] = (game.stats.smelted[k] || 0) + r.out[k];
      }
    }
    this.tryOutput(m);
  }

  tickLab(m, dt, game) {
    if (!m.recipe) m.recipe = 'matrix';
    this.tickCrafter(m, dt, MACHINE_ASSEMBLE, game);
  }

  tickEjector(m, dt, game) {
    this.pullInputs(m);
    // 从缓存装填太阳帆
    if (m.buffer.solar_sail) {
      m.sails = (m.sails || 0) + m.buffer.solar_sail;
      delete m.buffer.solar_sail;
    }
    const sunUp = game.sky ? game.sky.sunDir.y > 0.08 : true;
    if (m.sails > 0 && sunUp && game.dyson.progress < game.dyson.goal * 5) {
      m.working = true;
      const speed = game.stats.tech.dyson_program ? 2 : 1;
      m.launchT += dt * speed;
      if (m.launchT >= 4) {
        m.launchT = 0;
        m.sails--;
        game.launchSail(m);
      }
    } else m.working = false;
  }

  // 机器从相邻传送带/箱子拉取原料
  pullInputs(m) {
    if (this.bufTotal(m.buffer) >= 30) return;
    const want = this.machineWants(m);
    for (let f = 0; f < 4; f++) {
      const [dx, , dz] = this.facingVec(f);
      const nb = this.get(m.x + dx, m.y, m.z + dz);
      if (nb && nb.type === 'belt') {
        // 传送带朝向指向本机才输入
        const [bx, , bz] = this.facingVec(nb.facing);
        if (nb.x + bx === m.x && nb.z + bz === m.z) {
          for (let i = nb.items.length - 1; i >= 0; i--) {
            const it = nb.items[i];
            if (it.pos > 0.72 && (!want || want.has(it.id))) {
              this.bufAdd(m.buffer, it.id, 1);
              if (it.mesh) this.releaseBeltMesh(it.mesh);
              nb.items.splice(i, 1);
              break;
            }
          }
        }
      }
      // 从箱子拉取
      const ck = this.key(m.x + dx, m.y, m.z + dz);
      if (this.world.getBlock(m.x + dx, m.y, m.z + dz) === B.CHEST) {
        const chest = this.containers.get(ck);
        if (chest && want) {
          for (const slot of chest.slots) {
            if (slot && want.has(slot.id)) {
              slot.count--;
              this.bufAdd(m.buffer, slot.id, 1);
              if (slot.count <= 0) chest.slots[chest.slots.indexOf(slot)] = null;
              break;
            }
          }
        }
      }
    }
  }

  machineWants(m) {
    if (m.type === 'ejector') return new Set(['solar_sail']);
    const list = m.type === 'smelter' ? MACHINE_SMELT : MACHINE_ASSEMBLE;
    if (!m.recipe) return new Set();
    const r = list.find(x => x.id === m.recipe);
    if (!r) return new Set();
    return new Set(Object.keys(r.in));
  }

  // 机器把产物推到面前的传送带或箱子
  tryOutput(m) {
    const [dx, , dz] = this.facingVec(m.facing);
    const ox = m.x + dx, oz = m.z + dz;
    const first = Object.keys(m.output)[0];
    if (!first) return;
    const belt = this.get(ox, m.y, oz);
    if (belt && belt.type === 'belt') {
      if (this.beltHasSpace(belt, 0.1)) {
        this.bufTake(m.output, first, 1);
        belt.items.push({ id: first, pos: 0.02, mesh: null });
        return;
      }
    }
    if (this.world.getBlock(ox, m.y, oz) === B.CHEST) {
      const chest = this.containers.get(this.key(ox, m.y, oz));
      if (chest && this.chestAdd(chest, first, 1)) {
        this.bufTake(m.output, first, 1);
      }
    }
  }

  chestAdd(chest, id, n) {
    const max = ITEMS[id] ? ITEMS[id].stack : 64;
    for (const slot of chest.slots) {
      if (slot && slot.id === id && slot.count < max) { slot.count += n; return true; }
    }
    for (let i = 0; i < chest.slots.length; i++) {
      if (!chest.slots[i]) { chest.slots[i] = { id, count: n }; return true; }
    }
    return false;
  }

  beltHasSpace(belt, pos) {
    for (const it of belt.items) if (Math.abs(it.pos - pos) < 0.24) return false;
    return true;
  }

  tickBelt(m, dt) {
    const speed = 0.9;
    m.items.sort((a, b) => b.pos - a.pos);
    const [dx, , dz] = this.facingVec(m.facing);
    const nx = m.x + dx, nz = m.z + dz;
    const next = this.get(nx, m.y, nz);
    for (let i = 0; i < m.items.length; i++) {
      const it = m.items[i];
      let maxPos = 1.0;
      if (i > 0) maxPos = Math.min(maxPos, m.items[i - 1].pos - 0.26);
      it.pos = Math.min(it.pos + speed * dt, Math.max(it.pos, maxPos));
      if (it.pos >= 0.99) {
        // 传给下一段传送带
        if (next && next.type === 'belt' && this.beltHasSpace(next, 0.0)) {
          m.items.splice(i, 1); i--;
          next.items.push({ id: it.id, pos: 0.0, mesh: it.mesh });
        }
        // 传给箱子
        else if (this.world.getBlock(nx, m.y, nz) === B.CHEST) {
          const chest = this.containers.get(this.key(nx, m.y, nz));
          if (chest && this.chestAdd(chest, it.id, 1)) {
            if (it.mesh) this.releaseBeltMesh(it.mesh);
            m.items.splice(i, 1); i--;
          }
        }
      }
    }
  }

  // ============ 动画与渲染 ============
  getBeltMesh(itemId) {
    let mesh = this.beltItemPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      this.scene.add(mesh);
    }
    mesh.visible = true;
    const colors = {
      iron_ore: 0xd8af93, copper_ore: 0xe07f4f, coal: 0x2a2a2e, iron_ingot: 0xd8d8d8,
      copper_ingot: 0xe0904f, magnet: 0xc93b3b, gear: 0xb0b0b0, circuit: 0x3e9e3e,
      coil: 0xcc5533, matrix: 0x3f9fff, solar_sail: 0xdfe9f5, glass: 0xbfe4ff,
      stone: 0x8a8a8a, cobble: 0x767676, sand: 0xd9cf9c,
    };
    mesh.material.color.setHex(colors[itemId] != null ? colors[itemId] : 0xaaaaaa);
    return mesh;
  }
  releaseBeltMesh(mesh) { mesh.visible = false; this.beltItemPool.push(mesh); }

  animate(dt) {
    let humNear = 0, fireNear = 0;
    const ppos = window.game ? window.game.player.pos : null;
    for (const m of this.machines.values()) {
      const def = MACHINE_DEFS[m.type];
      let dist = 999;
      if (ppos) dist = Math.hypot(m.x - ppos.x, m.y - ppos.y, m.z - ppos.z);
      if (m.working && dist < 14 && def.power < 0) humNear += (14 - dist) / 14;
      if (m.type === 'wind_turbine' && m.rotor) {
        m.rotor.rotation.z += dt * 2.4;
        if (dist < 14) humNear += (14 - dist) / 28;
      }
      if (m.type === 'miner' && m.drill) {
        if (m.working) m.drill.rotation.y += dt * 8;
        if (m.lamp) m.lamp.material.color.setHex(m.working ? 0x57ff8a : 0xff5544);
      }
      if (m.type === 'smelter' && m.fire) {
        m.fire.visible = m.working;
        if (m.working && dist < 10) fireNear += (10 - dist) / 10;
        if (m.ring) m.ring.rotation.z += dt * (m.working ? 2 : 0.2);
      }
      if ((m.type === 'assembler' || m.type === 'lab') && m.core) {
        if (m.working) { m.core.rotation.y += dt * 3; m.core.rotation.x += dt * 1.5; }
      }
      if (m.type === 'ejector' && m.barrel) {
        // 瞄准太阳方向
        if (window.game) {
          const sunDir = window.game.sky.sunDir;
          if (sunDir && sunDir.y > 0.05) {
            const targetYaw = Math.atan2(sunDir.x, sunDir.z);
            m.barrel.rotation.y = targetYaw - m.facing * Math.PI / 2;
            const elev = Math.asin(Math.max(-1, Math.min(1, sunDir.y)));
            m.barrel.rotation.x = Math.max(0.3, Math.min(1.25, Math.PI / 2 - elev));
          }
        }
      }
      // 传送带物品网格
      if (m.type === 'belt') {
        const [dx, , dz] = this.facingVec(m.facing);
        for (const it of m.items) {
          if (!it.mesh) it.mesh = this.getBeltMesh(it.id);
          const t = it.pos - 0.5;
          it.mesh.position.set(m.x + 0.5 + dx * t, m.y + 0.26, m.z + 0.5 + dz * t);
        }
      }
    }
    Sfx.setHum(humNear);
    Sfx.setFire(fireNear + (window.game ? (window.game.furnFireNear || 0) : 0));
  }

  // ============ 存档 ============
  serialize() {
    const arr = [];
    for (const m of this.machines.values()) {
      arr.push({
        type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing,
        buffer: m.buffer, output: m.output, recipe: m.recipe, sails: m.sails || 0,
        items: m.items ? m.items.map(i => ({ id: i.id, pos: i.pos })) : null,
      });
    }
    const chests = [];
    for (const [k, c] of this.containers) chests.push({ k, slots: c.slots });
    return { machines: arr, chests };
  }
  deserialize(data) {
    if (!data) return;
    for (const md of data.machines || []) {
      this.place(md.type, md.x, md.y, md.z, md.facing);
      const m = this.get(md.x, md.y, md.z);
      if (m) {
        m.buffer = md.buffer || {}; m.output = md.output || {};
        m.recipe = md.recipe; m.sails = md.sails || 0;
        if (md.items && m.items) for (const it of md.items) m.items.push({ id: it.id, pos: it.pos, mesh: null });
      }
    }
    for (const cd of data.chests || []) this.containers.set(cd.k, { slots: cd.slots });
  }
}
