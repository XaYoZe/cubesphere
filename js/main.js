// ============ 主游戏逻辑 ============
'use strict';

class Game {
  constructor() {
    this.inventory = new Array(36).fill(null);
    this.hotbarSel = 0;
    this.stats = {
      mined: {}, crafted: {}, placed: {}, smelted: {}, obtained: {},
      tech: {}, sailsLaunched: 0,
    };
    this.dyson = { progress: 0, goal: 100 };
    this.furnaces = new Map(); // "x,y,z" -> {slots:[in,fuel,out], fuel, fuelMax, progress}
    this.saplings = new Map(); // "x,y,z" -> 剩余生长秒数
    this.breaking = null;      // {x,y,z,t,need}
    this.input = { forward: false, back: false, left: false, right: false, jump: false, sprint: false };
    this.mouseDown = [false, false, false];
    this.placeCooldown = 0;
    this.paused = false;
    this.won = false;
    this.launchFx = [];
  }

  init() {
    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 900);

    // 纹理
    TEX.init();
    const atlasTex = new THREE.CanvasTexture(TEX.canvas);
    atlasTex.magFilter = THREE.NearestFilter;
    atlasTex.minFilter = THREE.NearestFilter;
    atlasTex.generateMipmaps = false;
    window.atlasTexture = atlasTex;

    // 世界
    const seed = this.loadSeed();
    this.world = new World(this.scene, seed);
    this.world.initMaterials(atlasTex);
    this.player = new Player(this.world);
    this.drops = new DropManager(this.scene, this.world);
    this.machines = new MachineSystem(this.scene, this.world);
    this.sky = new Sky(this.scene);

    // 高亮框
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    // 裂纹
    this.crackMat = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.001, 1.001, 1.001), this.crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);
    this.setCrackStage(0);

    UI.init(this);
    this.bindEvents();

    // 读档或新建
    if (!this.loadGame()) {
      this.player.spawn();
      this.giveStarterItems();
    }
    // 预生成出生地块
    this.world.update(this.player.pos.x, this.player.pos.z, 3);
    let guard = 0;
    while (guard++ < 200) {
      let dirty = false;
      for (const c of this.world.chunks.values()) if (c.dirty) { this.world.buildChunkMesh(c); dirty = true; break; }
      if (!dirty) break;
    }
    // 确保脚下不卡
    while (this.player.collides(this.player.pos.x, this.player.pos.y, this.player.pos.z)) this.player.pos.y += 1;

    UI.updateHotbar();
    UI.renderQuest();

    this.clock = performance.now();
    this.saveTimer = 0;
    requestAnimationFrame(() => this.loop());
  }

  giveStarterItems() { /* 空手开局，忠实生存体验 */ }

  // ============ 背包操作 ============
  addItem(id, count, dur) {
    const item = ITEMS[id];
    if (!item) return count;
    let left = count;
    const max = item.stack;
    if (!item.tool) {
      for (let i = 0; i < 36 && left > 0; i++) {
        const s = this.inventory[i];
        if (s && s.id === id && s.count < max) {
          const mv = Math.min(left, max - s.count);
          s.count += mv; left -= mv;
        }
      }
    }
    for (let i = 0; i < 36 && left > 0; i++) {
      if (!this.inventory[i]) {
        const mv = Math.min(left, max);
        this.inventory[i] = { id, count: mv, dur: dur != null ? dur : (item.durability || undefined) };
        left -= mv;
      }
    }
    if (left < count) {
      UI.updateHotbar();
      if (UI.openPanel) UI.refresh();
    }
    return left;
  }
  addToRange(stack, from, to) {
    const max = ITEMS[stack.id].stack;
    for (let i = from; i < to && stack.count > 0; i++) {
      const s = this.inventory[i];
      if (s && s.id === stack.id && s.count < max && !ITEMS[stack.id].tool) {
        const mv = Math.min(stack.count, max - s.count);
        s.count += mv; stack.count -= mv;
      }
    }
    for (let i = from; i < to && stack.count > 0; i++) {
      if (!this.inventory[i]) { this.inventory[i] = { id: stack.id, count: stack.count, dur: stack.dur }; stack.count = 0; }
    }
    return stack.count > 0 ? stack : null;
  }
  addToSlots(slots, stack) {
    const max = ITEMS[stack.id].stack;
    for (let i = 0; i < slots.length && stack.count > 0; i++) {
      const s = slots[i];
      if (s && s.id === stack.id && s.count < max) {
        const mv = Math.min(stack.count, max - s.count);
        s.count += mv; stack.count -= mv;
      }
    }
    for (let i = 0; i < slots.length && stack.count > 0; i++) {
      if (!slots[i]) { slots[i] = { id: stack.id, count: stack.count, dur: stack.dur }; stack.count = 0; }
    }
    return stack.count > 0 ? stack : null;
  }
  countItem(id) {
    let n = 0;
    for (const s of this.inventory) if (s && s.id === id) n += s.count;
    return n;
  }
  removeItem(id, count) {
    let left = count;
    for (let i = 0; i < 36 && left > 0; i++) {
      const s = this.inventory[i];
      if (s && s.id === id) {
        const take = Math.min(left, s.count);
        s.count -= take; left -= take;
        if (s.count <= 0) this.inventory[i] = null;
      }
    }
    UI.updateHotbar();
    return count - left;
  }
  heldItem() { return this.inventory[this.hotbarSel]; }

  // ============ 事件绑定 ============
  bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (!UI.openPanel && !this.player.dead) this.relock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && !UI.openPanel && !this.player.dead && !this.victoryShown && this.startedOnce) {
        UI.open('pause');
      }
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.player.yaw -= e.movementX * 0.0024;
      this.player.pitch -= e.movementY * 0.0024;
      this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch));
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      this.mouseDown[e.button] = true;
      if (e.button === 2) this.tryInteractOrPlace();
    });
    document.addEventListener('mouseup', e => { this.mouseDown[e.button] = false; });
    document.addEventListener('wheel', e => {
      if (!this.locked) return;
      this.hotbarSel = (this.hotbarSel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      UI.updateHotbar();
      Sfx.click();
    });
    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (UI.openPanel && UI.openPanel !== 'pause') { UI.closeAll(); this.relock(); }
        else if (UI.openPanel === 'pause') { UI.closeAll(); this.relock(); }
        return;
      }
      if (UI.openPanel) {
        if (k === 'e' && (UI.openPanel === 'inventory' || UI.openPanel === 'crafting' || UI.openPanel === 'chest' || UI.openPanel === 'furnace' || UI.openPanel === 'machine')) { UI.closeAll(); this.relock(); }
        if (k === 't' && UI.openPanel === 'tech') { UI.closeAll(); this.relock(); }
        return;
      }
      switch (k) {
        case 'w': this.input.forward = true; break;
        case 's': this.input.back = true; break;
        case 'a': this.input.left = true; break;
        case 'd': this.input.right = true; break;
        case ' ': this.input.jump = true; e.preventDefault(); break;
        case 'control': this.input.sprint = true; break;
        case 'shift': this.input.sprint = true; break;
        case 'e': UI.open('inventory'); break;
        case 't': UI.open('tech'); break;
        case 'q': this.dropHeld(); break;
        case 'f': this.eatHeld(); break;
        case 'm': { const on = Sfx.toggleMusic(); UI.toast(on ? '♪ 音乐：开' : '♪ 音乐：关'); break; }
        case 'f3': this.debug = !this.debug; e.preventDefault(); break;
        default:
          if (k >= '1' && k <= '9') {
            this.hotbarSel = parseInt(k) - 1;
            UI.updateHotbar(); Sfx.click();
          }
      }
    });
    document.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      switch (k) {
        case 'w': this.input.forward = false; break;
        case 's': this.input.back = false; break;
        case 'a': this.input.left = false; break;
        case 'd': this.input.right = false; break;
        case ' ': this.input.jump = false; break;
        case 'control': case 'shift': this.input.sprint = false; break;
      }
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    window.addEventListener('beforeunload', () => this.saveGame());
  }

  relock() {
    if (this.player.dead) return;
    try {
      const p = this.renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  dropHeld() {
    const s = this.heldItem();
    if (!s) return;
    const dir = this.player.lookDir();
    const p = this.player.eyePos();
    this.drops.spawn(p.x + dir.x, p.y - 0.2, p.z + dir.z, s.id, 1);
    const d = this.drops.drops[this.drops.drops.length - 1];
    d.vel.set(dir.x * 5, 2, dir.z * 5);
    d.age = -0.8; // 防立即拾取
    s.count--;
    if (s.count <= 0) this.inventory[this.hotbarSel] = null;
    UI.updateHotbar();
    Sfx.pop();
  }

  eatHeld() {
    const s = this.heldItem();
    if (!s || !ITEMS[s.id].food) return;
    if (this.player.health >= this.player.maxHealth) { UI.toast('生命值已满'); return; }
    this.player.health = Math.min(this.player.maxHealth, this.player.health + ITEMS[s.id].food);
    s.count--;
    if (s.count <= 0) this.inventory[this.hotbarSel] = null;
    Sfx.eat();
    UI.updateHealth(); UI.updateHotbar();
  }

  // ============ 交互 / 放置 ============
  tryInteractOrPlace() {
    const hit = this.world.raycast(this.player.eyePos(), this.player.lookDir(), 5);
    if (!hit) return;
    const info = blockInfo(hit.id);
    // 机器交互
    if (hit.id === B.MACHINE) {
      const m = this.machines.get(hit.x, hit.y, hit.z);
      if (m && m.type !== 'belt' && m.type !== 'wind_turbine') { UI.open('machine', m); return; }
      if (m && m.type === 'wind_turbine') { UI.toast('风力涡轮机：+300 kW'); return; }
      if (m && m.type === 'belt') { /* 传送带无UI，直接放置 */ }
      else return;
    }
    // 方块交互
    if (info.interact === 'crafting') { UI.open('crafting'); return; }
    if (info.interact === 'furnace') {
      const k = hit.x + ',' + hit.y + ',' + hit.z;
      let f = this.furnaces.get(k);
      if (!f) { f = { slots: [null, null, null], fuel: 0, fuelMax: 0, progress: 0 }; this.furnaces.set(k, f); }
      UI.open('furnace', f);
      return;
    }
    if (info.interact === 'chest') {
      const k = hit.x + ',' + hit.y + ',' + hit.z;
      let c = this.machines.containers.get(k);
      if (!c) { c = { slots: new Array(27).fill(null) }; this.machines.containers.set(k, c); }
      UI.open('chest', c);
      return;
    }
    this.tryPlace(hit);
  }

  tryPlace(hit) {
    const s = this.heldItem();
    if (!s) return;
    const item = ITEMS[s.id];
    const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
    if (py < 1 || py >= WORLD_H) return;
    const cur = this.world.getBlock(px, py, pz);
    if (cur !== B.AIR && cur !== B.WATER) return;

    // 不能放在玩家身体里
    const p = this.player;
    const overlap = px + 1 > p.pos.x - 0.3 && px < p.pos.x + 0.3 &&
      pz + 1 > p.pos.z - 0.3 && pz < p.pos.z + 0.3 &&
      py + 1 > p.pos.y && py < p.pos.y + p.height;

    if (item.machine) {
      if (overlap && MACHINE_DEFS[item.machine].size) return;
      if (item.machine !== 'belt' && !isSolid(this.world.getBlock(px, py - 1, pz))) { UI.toast('需要放置在坚实地面上'); Sfx.error(); return; }
      // 朝向：玩家面朝方向
      const yaw = ((this.player.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const facing = Math.round(yaw / (Math.PI / 2)) % 4; // 0:-z? 转换如下
      // yaw=0 面向 -z(北)，我们的 facing 0=+z南 1=+x东 2=-z北 3=-x西
      const map = [2, 3, 0, 1];
      const f = map[facing];
      if (this.machines.place(item.machine, px, py, pz, f)) {
        s.count--;
        if (s.count <= 0) this.inventory[this.hotbarSel] = null;
        this.stats.placed[item.machine] = (this.stats.placed[item.machine] || 0) + 1;
        Sfx.machinePlace();
        UI.updateHotbar();
        UI.renderQuest();
      }
      return;
    }
    if (item.block == null) return;
    if (overlap && BLOCKS[item.block].solid) return;
    if (item.block === B.SAPLING) {
      const below = this.world.getBlock(px, py - 1, pz);
      if (below !== B.GRASS && below !== B.DIRT) { UI.toast('树苗需要种在草地或泥土上'); Sfx.error(); return; }
      this.saplings.set(px + ',' + py + ',' + pz, 20 + Math.random() * 25);
    }
    if (item.block === B.TORCH && !isSolid(this.world.getBlock(px, py - 1, pz))) { UI.toast('火把需要放在方块上'); return; }
    this.world.setBlock(px, py, pz, item.block);
    if (item.block === B.CHEST) {
      this.machines.containers.set(px + ',' + py + ',' + pz, { slots: new Array(27).fill(null) });
    }
    s.count--;
    if (s.count <= 0) this.inventory[this.hotbarSel] = null;
    this.stats.placed[s.id] = (this.stats.placed[s.id] || 0) + 1;
    Sfx.place(BLOCKS[item.block].sound || 'stone');
    UI.updateHotbar();
    UI.renderQuest();
  }

  // ============ 挖掘 ============
  updateBreaking(dt) {
    if (!this.mouseDown[0] || !this.locked || UI.openPanel) {
      if (this.breaking) { this.breaking = null; this.crackMesh.visible = false; }
      return;
    }
    const hit = this.world.raycast(this.player.eyePos(), this.player.lookDir(), 5);
    if (!hit) { this.breaking = null; this.crackMesh.visible = false; return; }
    const info = blockInfo(hit.id);
    if (info.hardness < 0) { this.breaking = null; this.crackMesh.visible = false; return; }

    if (!this.breaking || this.breaking.x !== hit.x || this.breaking.y !== hit.y || this.breaking.z !== hit.z) {
      // 计算挖掘时间
      const held = this.heldItem();
      const tool = held ? ITEMS[held.id] : null;
      let speed = 1;
      let canHarvest = true;
      if (info.tool && tool && tool.tool === info.tool) speed = tool.speed;
      if (info.tier) {
        const tier = (tool && tool.tool === info.tool) ? tool.tier : 0;
        if (tier < info.tier) { canHarvest = false; speed = 0.3; }
      }
      const need = Math.max(0.15, info.hardness / speed);
      // 按方块坐标哈希选择裂纹变体 + 镜像，增加多样性
      const h = ((hit.x * 73856093) ^ (hit.y * 19349663) ^ (hit.z * 83492791)) >>> 0;
      this.breaking = {
        x: hit.x, y: hit.y, z: hit.z, t: 0, need, canHarvest, id: hit.id,
        crackVar: h % TEX.crackVariants, crackFlip: ((h >> 4) & 1) === 1,
      };
      this.digSndT = 0;
    }
    const bk = this.breaking;
    bk.t += dt;
    this.digSndT -= dt;
    if (this.digSndT <= 0) { this.digSndT = 0.25; Sfx.dig(info.sound || 'stone'); }
    // 裂纹显示
    this.crackMesh.visible = true;
    this.crackMesh.position.set(bk.x + 0.5, bk.y + 0.5, bk.z + 0.5);
    this.setCrackStage(Math.min(4, Math.floor(bk.t / bk.need * 5)), bk.crackVar, bk.crackFlip);
    if (bk.t >= bk.need) {
      this.breakBlock(bk.x, bk.y, bk.z, bk.canHarvest);
      this.breaking = null;
      this.crackMesh.visible = false;
    }
  }

  setCrackStage(s, v = 0, flip = false) {
    const uv = TEX.uv(TEX.crackBase + v * 5 + s);
    const u0 = flip ? uv.u1 : uv.u0, u1 = flip ? uv.u0 : uv.u1;
    const geo = this.crackMesh.geometry;
    const uvAttr = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      uvAttr.setXY(f * 4 + 0, u0, uv.v1);
      uvAttr.setXY(f * 4 + 1, u1, uv.v1);
      uvAttr.setXY(f * 4 + 2, u0, uv.v0);
      uvAttr.setXY(f * 4 + 3, u1, uv.v0);
    }
    uvAttr.needsUpdate = true;
  }

  breakBlock(x, y, z, canHarvest) {
    const id = this.world.getBlock(x, y, z);
    const info = blockInfo(id);
    // 机器拆除返还
    if (id === B.MACHINE) {
      const m = this.machines.remove(x, y, z);
      if (m) {
        const itemId = m.type === 'belt' ? 'belt' : m.type;
        this.drops.spawn(x + 0.5, y + 0.5, z + 0.5, itemId, 1);
        for (const buf of [m.buffer, m.output]) for (const k in buf) this.drops.spawn(x + 0.5, y + 0.6, z + 0.5, k, buf[k]);
        if (m.items) for (const it of m.items) this.drops.spawn(x + 0.5, y + 0.6, z + 0.5, it.id, 1);
        if (m.sails) this.drops.spawn(x + 0.5, y + 0.6, z + 0.5, 'solar_sail', m.sails);
      }
      Sfx.breakBlock('metal');
      return;
    }
    // 熔炉/箱子内容掉落
    const posKey = x + ',' + y + ',' + z;
    if (id === B.FURNACE && this.furnaces.has(posKey)) {
      for (const s of this.furnaces.get(posKey).slots) if (s) this.drops.spawn(x + 0.5, y + 0.6, z + 0.5, s.id, s.count);
      this.furnaces.delete(posKey);
    }
    if (id === B.CHEST && this.machines.containers.has(posKey)) {
      for (const s of this.machines.containers.get(posKey).slots) if (s) this.drops.spawn(x + 0.5, y + 0.6, z + 0.5, s.id, s.count);
      this.machines.containers.delete(posKey);
    }
    this.world.setBlock(x, y, z, B.AIR);
    Sfx.breakBlock(info.sound || 'stone');
    // 掉落
    if (canHarvest) {
      if (info.drop) {
        this.drops.spawn(x + 0.5, y + 0.4, z + 0.5, info.drop, 1);
        this.stats.mined[info.drop] = (this.stats.mined[info.drop] || 0) + 1;
      } else if (info.dropChance) {
        for (const [did, ch] of Object.entries(info.dropChance)) {
          if (Math.random() < ch) this.drops.spawn(x + 0.5, y + 0.4, z + 0.5, did, 1);
        }
      }
    }
    // 工具耐久
    const held = this.heldItem();
    if (held && ITEMS[held.id].tool && held.dur != null) {
      held.dur--;
      if (held.dur <= 0) {
        this.inventory[this.hotbarSel] = null;
        Sfx.breakBlock('metal');
        UI.toast('工具耐久耗尽！');
      }
      UI.updateHotbar();
    }
    UI.renderQuest();
  }

  // ============ 树苗生长 ============
  tickSaplings(dt) {
    for (const [k, t] of this.saplings) {
      const nt = t - dt;
      if (nt > 0) { this.saplings.set(k, nt); continue; }
      this.saplings.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      if (this.world.getBlock(x, y, z) !== B.SAPLING) continue;
      this.growTree(x, y, z);
    }
  }

  growTree(x, y, z) {
    const th = 4 + (Math.random() * 2 | 0);
    for (let k = 0; k < th; k++) {
      const cur = this.world.getBlock(x, y + k, z);
      if (k > 0 && cur !== B.AIR && cur !== B.LEAVES) return;
    }
    for (let k = 0; k < th; k++) this.world.setBlock(x, y + k, z, B.LOG);
    for (let dy = th - 3; dy <= th; dy++) {
      const r = dy >= th - 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy < th) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && Math.random() < 0.5) continue;
        if (this.world.getBlock(x + dx, y + dy, z + dz) === B.AIR)
          this.world.setBlock(x + dx, y + dy, z + dz, B.LEAVES);
      }
    }
    Sfx.place('grass');
  }

  // ============ 熔炉模拟 ============
  tickFurnaces(dt) {
    let anyBurning = false;
    for (const [k, f] of this.furnaces) {
      const inS = f.slots[0], fuelS = f.slots[1];
      const recipe = inS ? SMELT_RECIPES[inS.id] : null;
      const outOk = recipe && (!f.slots[2] || (f.slots[2].id === recipe && f.slots[2].count < ITEMS[recipe].stack));
      // 点火
      if (f.fuel <= 0 && recipe && outOk && fuelS && ITEMS[fuelS.id].fuel) {
        f.fuel = ITEMS[fuelS.id].fuel;
        f.fuelMax = f.fuel;
        fuelS.count--;
        if (fuelS.count <= 0) f.slots[1] = null;
      }
      if (f.fuel > 0) {
        f.fuel -= dt;
        anyBurning = true;
        if (recipe && outOk) {
          f.progress = (f.progress || 0) + dt / 10;
          if (f.progress >= 1) {
            f.progress = 0;
            inS.count--;
            if (inS.count <= 0) f.slots[0] = null;
            if (!f.slots[2]) f.slots[2] = { id: recipe, count: 1 };
            else f.slots[2].count++;
            this.stats.smelted[recipe] = (this.stats.smelted[recipe] || 0) + 1;
            this.stats.obtained[recipe] = (this.stats.obtained[recipe] || 0) + 1;
            if (UI.openPanel === 'furnace') UI.refresh();
            UI.renderQuest();
          }
        } else f.progress = 0;
      } else f.progress = 0;
      // 世界方块亮/灭状态（懒惰处理：不切换贴图，仅音效）
    }
    // 炉火音效（靠近任一燃烧的熔炉）
    let near = 0;
    for (const [k, f] of this.furnaces) {
      if (f.fuel > 0) {
        const [x, y, z] = k.split(',').map(Number);
        const d = Math.hypot(x - this.player.pos.x, y - this.player.pos.y, z - this.player.pos.z);
        if (d < 9) near += (9 - d) / 9;
      }
    }
    this.furnFireNear = near;
    if (UI.openPanel === 'furnace' && (this._furnRe = (this._furnRe || 0) + dt) > 0.2) {
      this._furnRe = 0;
      UI.updateFurnaceGauges();
    }
  }

  // ============ 太阳帆发射 ============
  launchSail(machine) {
    this.stats.sailsLaunched++;
    this.dyson.progress = this.stats.sailsLaunched;
    Sfx.launch();
    this.sky.addSail();
    this.sky.setDysonProgress(this.dyson.progress / this.dyson.goal);
    // 发射光迹
    const geo = new THREE.CylinderGeometry(0.03, 0.08, 1.6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xaee8ff, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(machine.x + 0.5, machine.y + 1.2, machine.z + 0.5);
    this.scene.add(mesh);
    this.launchFx.push({ mesh, t: 0, from: mesh.position.clone() });
    UI.updateDysonHUD();
    UI.renderQuest();
    if (this.dyson.progress >= this.dyson.goal && !this.won) {
      this.won = true;
      this.victoryShown = true;
      setTimeout(() => UI.showVictory(), 1200);
    }
  }

  updateLaunchFx(dt) {
    for (let i = this.launchFx.length - 1; i >= 0; i--) {
      const fx = this.launchFx[i];
      fx.t += dt;
      const sunPos = this.sky.sunGroup.position;
      const p = fx.from.clone().lerp(sunPos, Math.min(1, fx.t / 3.2));
      fx.mesh.position.copy(p);
      fx.mesh.lookAt(sunPos);
      fx.mesh.rotateX(Math.PI / 2);
      fx.mesh.material.opacity = Math.max(0, 0.95 - fx.t / 3.4);
      if (fx.t > 3.4) {
        this.scene.remove(fx.mesh);
        this.launchFx.splice(i, 1);
      }
    }
  }

  // ============ 存档 ============
  saveGame() {
    try {
      const data = {
        v: 2,
        seed: this.world.seed,
        edits: this.world.edits,
        flow: [...this.world.flow.entries()],
        inventory: this.inventory,
        hotbarSel: this.hotbarSel,
        stats: this.stats,
        dyson: this.dyson,
        player: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw, pitch: this.player.pitch, health: this.player.health },
        furnaces: [...this.furnaces.entries()],
        saplings: [...this.saplings.entries()],
        machines: this.machines.serialize(),
        skyTime: this.sky.time,
        won: this.won,
      };
      localStorage.setItem('cubesphere_save', JSON.stringify(data));
    } catch (e) { console.warn('保存失败', e); }
  }
  loadSeed() {
    try {
      const raw = localStorage.getItem('cubesphere_save');
      if (raw) return JSON.parse(raw).seed || 1337;
    } catch (e) {}
    return (Math.random() * 100000) | 0;
  }
  loadGame() {
    try {
      const raw = localStorage.getItem('cubesphere_save');
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.v !== 2) return false;
      this.world.edits = d.edits || {};
      this.world.flow = new Map(d.flow || []);
      this.inventory = d.inventory || new Array(36).fill(null);
      this.hotbarSel = d.hotbarSel || 0;
      this.stats = Object.assign(this.stats, d.stats);
      this.dyson = d.dyson || this.dyson;
      this.player.pos.set(d.player.x, d.player.y, d.player.z);
      this.player.yaw = d.player.yaw; this.player.pitch = d.player.pitch;
      this.player.health = d.player.health;
      this.furnaces = new Map(d.furnaces || []);
      this.saplings = new Map(d.saplings || []);
      this.machines.deserialize(d.machines);
      this.sky.time = d.skyTime != null ? d.skyTime : 0.3;
      this.won = !!d.won;
      for (let i = 0; i < this.dyson.progress && i < 120; i++) this.sky.addSail();
      this.sky.setDysonProgress(this.dyson.progress / this.dyson.goal);
      return true;
    } catch (e) { console.warn('读档失败', e); return false; }
  }
  static clearSave() { localStorage.removeItem('cubesphere_save'); }

  respawn() {
    this.player.spawn();
    document.getElementById('deathPanel').style.display = 'none';
    UI.updateHealth();
    this.relock();
  }

  // ============ 主循环 ============
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    let dt = (now - this.clock) / 1000;
    this.clock = now;
    if (dt > 0.1) dt = 0.1;
    if (this.paused) return;

    const uiOpen = !!UI.openPanel;
    if (!uiOpen && !this.player.dead) {
      this.player.update(dt, this.input);
      this.updateBreaking(dt);
    } else {
      this.player.update(dt, { forward: false, back: false, left: false, right: false, jump: false });
    }

    // 相机
    const eye = this.player.eyePos();
    this.camera.position.copy(eye);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    // 视野变化（冲刺）
    const targetFov = this.player.sprint ? 82 : 75;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    // 世界与系统
    this.world.update(this.player.pos.x, this.player.pos.z, 4);
    this.world.updateWater(dt);
    this.machines.update(dt, this);
    this.tickFurnaces(dt);
    this.tickSaplings(dt);
    this.drops.update(dt, this.player, (id, n) => this.addItem(id, n));
    this.sky.update(dt, this.player.pos, this.renderer, this.scene);
    this.updateLaunchFx(dt);
    UI.tickResearch(dt);
    Sfx.tickMusic(dt);

    // 准星高亮
    if (!uiOpen) {
      const hit = this.world.raycast(this.player.eyePos(), this.player.lookDir(), 5);
      if (hit) {
        this.highlight.visible = true;
        this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else this.highlight.visible = false;
    } else this.highlight.visible = false;

    // HUD 刷新（低频）
    this._hudT = (this._hudT || 0) + dt;
    if (this._hudT > 0.3) {
      this._hudT = 0;
      UI.updatePowerHUD();
      UI.updateDysonHUD();
      UI.renderQuest();
      const clockEl = document.getElementById('clockHud');
      clockEl.textContent = '☀ ' + this.sky.clockText();
      if (this.debug) {
        clockEl.textContent += ` | XYZ: ${this.player.pos.x.toFixed(1)} ${this.player.pos.y.toFixed(1)} ${this.player.pos.z.toFixed(1)}`;
      }
      if (UI.openPanel === 'machine') UI.renderMachine();
    }
    // 自动存档
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.saveGame(); }

    // 水下滤镜
    document.getElementById('waterOverlay').style.opacity = this.player.headInWater ? 0.35 : 0;

    this.renderer.render(this.scene, this.camera);
  }
}

// ============ 启动 ============
window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('btnStart');
  const newBtn = document.getElementById('btnNew');
  const hasSave = !!localStorage.getItem('cubesphere_save');
  startBtn.textContent = hasSave ? '继续游戏' : '开始游戏';
  newBtn.style.display = hasSave ? 'inline-block' : 'none';

  const boot = () => {
    document.getElementById('titleScreen').style.display = 'none';
    Sfx.init();
    Sfx.resume();
    window.game = new Game();
    game.init();
    game.startedOnce = true;
    document.getElementById('hud').style.display = 'block';
    game.relock();
  };
  startBtn.onclick = boot;
  newBtn.onclick = () => { Game.clearSave(); boot(); };

  // 暂停面板按钮
  document.getElementById('btnResume').onclick = () => { UI.closeAll(); game.relock(); };
  document.getElementById('btnSave').onclick = () => { game.saveGame(); UI.toast('✓ 已保存'); };
  document.getElementById('btnHelp').onclick = () => {
    const h = document.getElementById('helpBox');
    h.style.display = h.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btnRespawn').onclick = () => game.respawn();
  document.getElementById('btnVictoryContinue').onclick = () => {
    document.getElementById('victoryPanel').style.display = 'none';
    game.relock();
  };
});
