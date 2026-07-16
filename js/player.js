// ============ 玩家：控制 / 物理 / 掉落物 ============
'use strict';

class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3(8.5, 40, 8.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.width = 0.6; this.height = 1.8; this.eye = 1.62;
    this.health = 20; this.maxHealth = 20;
    this.sprint = false;
    this.stepTimer = 0;
    this.fallStart = null;
    this.dead = false;
  }

  spawn() {
    // 螺旋搜索一块陆地出生点
    let sx = 8, sz = 8, best = null;
    for (let r = 0; r < 12 && !best; r++) {
      for (let dx = -r; dx <= r && !best; dx += Math.max(1, r)) {
        for (let dz = -r; dz <= r && !best; dz++) {
          const h = this.world.surfaceHeight(sx + dx * 4, sz + dz * 4);
          if (h > SEA + 1) best = [sx + dx * 4, h, sz + dz * 4];
        }
      }
    }
    if (!best) best = [sx, this.world.surfaceHeight(sx, sz), sz];
    this.pos.set(best[0] + 0.5, best[1] + 2, best[2] + 0.5);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.dead = false;
  }

  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z); }

  lookDir() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
  }

  collides(px, py, pz) {
    const w = this.width / 2;
    const minX = Math.floor(px - w), maxX = Math.floor(px + w);
    const minY = Math.floor(py), maxY = Math.floor(py + this.height);
    const minZ = Math.floor(pz - w), maxZ = Math.floor(pz + w);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
          if (isSolid(this.world.getBlock(x, y, z))) return true;
    return false;
  }

  update(dt, input) {
    if (this.dead) return;
    dt = Math.min(dt, 0.05);
    const feetBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const headBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eye), Math.floor(this.pos.z));
    const wasInWater = this.inWater;
    this.inWater = feetBlock === B.WATER;
    this.headInWater = headBlock === B.WATER;
    if (this.inWater && !wasInWater && this.vel.y < -3) Sfx.splash();

    // 水平移动
    let mx = 0, mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    this.sprint = input.sprint && input.forward;
    const speed = this.inWater ? 3.2 : (this.sprint ? 6.8 : 4.3);
    // 前向 F=(-sin,-cos)，右向 R=(cos,-sin)：世界速度 = mx*R + (-mz)*F
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (mx * cos + mz * sin) * speed;
    const wz = (mz * cos - mx * sin) * speed;
    const accel = this.onGround ? 12 : 5;
    this.vel.x += (wx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wz - this.vel.z) * Math.min(1, accel * dt);

    // 重力 / 跳跃 / 游泳
    if (this.inWater) {
      this.vel.y -= 9 * dt;
      this.vel.y = Math.max(this.vel.y, -3.2);
      if (input.jump) this.vel.y = Math.min(this.vel.y + 22 * dt, 3.5);
      this.fallStart = null;
    } else {
      this.vel.y -= 26 * dt;
      this.vel.y = Math.max(this.vel.y, -50);
      if (input.jump && this.onGround) {
        this.vel.y = 8.2;
        this.onGround = false;
      }
    }

    // 分轴碰撞（含出水自动抬升：在水中/水面贴边时可爬上一格岸）
    const stepUp = 1.05;
    const belowFeet = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.3), Math.floor(this.pos.z));
    const canStep = this.inWater || belowFeet === B.WATER;
    const move = (dx, dy, dz) => {
      // X
      let nx = this.pos.x + dx;
      if (!this.collides(nx, this.pos.y, this.pos.z)) this.pos.x = nx;
      else if (canStep && dx !== 0 &&
        !this.collides(nx, this.pos.y + stepUp, this.pos.z) &&
        !this.collides(this.pos.x, this.pos.y + stepUp, this.pos.z)) {
        this.pos.y += stepUp; this.pos.x = nx;
        if (this.vel.y < 0) this.vel.y = 0;
      } else this.vel.x = 0;
      // Z
      let nz = this.pos.z + dz;
      if (!this.collides(this.pos.x, this.pos.y, nz)) this.pos.z = nz;
      else if (canStep && dz !== 0 &&
        !this.collides(this.pos.x, this.pos.y + stepUp, nz) &&
        !this.collides(this.pos.x, this.pos.y + stepUp, this.pos.z)) {
        this.pos.y += stepUp; this.pos.z = nz;
        if (this.vel.y < 0) this.vel.y = 0;
      } else this.vel.z = 0;
      // Y
      let ny = this.pos.y + dy;
      if (!this.collides(this.pos.x, ny, this.pos.z)) {
        this.pos.y = ny;
        this.onGround = false;
      } else {
        if (dy < 0) {
          this.onGround = true;
          // 摔落伤害
          if (this.fallStart !== null) {
            const fall = this.fallStart - this.pos.y;
            if (fall > 3.5) {
              const dmg = Math.floor(fall - 3);
              this.damage(dmg);
            }
            this.fallStart = null;
          }
        }
        this.vel.y = 0;
      }
    };
    move(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);

    if (!this.onGround && this.vel.y < 0 && this.fallStart === null) this.fallStart = this.pos.y;
    if (this.onGround || this.inWater) { if (this.vel.y >= 0) this.fallStart = null; }

    // 脚步声
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 1.5) {
      this.stepTimer -= dt * hSpeed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 2.4;
        const below = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.5), Math.floor(this.pos.z));
        const info = blockInfo(below);
        if (info.sound) Sfx.step(info.sound);
      }
    }

    // 掉出世界
    if (this.pos.y < -10) { this.damage(100); }

    // 缓慢回血
    if (this.health < this.maxHealth) {
      this.regenTimer = (this.regenTimer || 0) + dt;
      if (this.regenTimer > 6) { this.regenTimer = 0; this.health = Math.min(this.maxHealth, this.health + 1); UI.updateHealth(); }
    }
  }

  damage(n) {
    if (this.dead || n <= 0) return;
    this.health -= n;
    Sfx.hurt();
    UI.flashHurt();
    UI.updateHealth();
    if (this.health <= 0) { this.health = 0; this.dead = true; UI.showDeath(); }
  }
}

// ============ 掉落物实体 ============
class DropManager {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.drops = [];
    this.geoCache = {};
  }
  makeMesh(itemId) {
    const item = ITEMS[itemId];
    let mat;
    if (item && item.block != null) {
      mat = new THREE.MeshBasicMaterial({ map: window.atlasTexture, vertexColors: false });
      const t = BLOCKS[item.block].tex;
      const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      // 设置UV到对应贴图
      const uvAttr = geo.attributes.uv;
      const faceTex = [t[4], t[5], t[0], t[1], t[3], t[2]];
      for (let f = 0; f < 6; f++) {
        const uv = TEX.uv(faceTex[f]);
        uvAttr.setXY(f * 4 + 0, uv.u0, uv.v1);
        uvAttr.setXY(f * 4 + 1, uv.u1, uv.v1);
        uvAttr.setXY(f * 4 + 2, uv.u0, uv.v0);
        uvAttr.setXY(f * 4 + 3, uv.u1, uv.v0);
      }
      return new THREE.Mesh(geo, mat);
    }
    // 物品：面片贴图
    if (!this.geoCache.sprite) this.geoCache.sprite = new THREE.PlaneGeometry(0.36, 0.36);
    const tex = new THREE.TextureLoader().load(ICONS.get(itemId));
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
    return new THREE.Mesh(this.geoCache.sprite, mat);
  }
  spawn(x, y, z, itemId, count) {
    const mesh = this.makeMesh(itemId);
    // 出生点安全检查：若在实体方块内，就近寻找空位（当前格→邻格）
    let sx = x, sy = y, sz = z;
    if (this.posBlocked(sx, sy, sz)) {
      let found = false;
      const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
      const offsets = [[0, 0, 0], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
        [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 2, 0], [0, -2, 0]];
      for (const [dx, dy, dz] of offsets) {
        if (!isSolid(this.world.getBlock(cx + dx, cy + dy, cz + dz))) {
          sx = cx + dx + 0.5; sy = cy + dy + 0.5; sz = cz + dz + 0.5;
          found = true; break;
        }
      }
      if (!found) { sy = cy + 1.5; }
    }
    mesh.position.set(sx, sy, sz);
    this.scene.add(mesh);
    this.drops.push({
      mesh, itemId, count,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6),
      age: 0, rest: false,
    });
  }
  // 掉落物小包围盒（半径0.14）是否卡在实体方块中
  posBlocked(x, y, z) {
    const h = 0.14;
    for (const [ox, oz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
      for (const oy of [-h, h]) {
        if (isSolid(this.world.getBlock(Math.floor(x + ox), Math.floor(y + oy), Math.floor(z + oz)))) return true;
      }
    }
    return false;
  }
  update(dt, player, pickupCb) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      // 物理：分轴碰撞，不穿墙/不穿顶
      d.vel.y -= 18 * dt;
      d.vel.y = Math.max(d.vel.y, -30);
      const p = d.mesh.position;
      const step = (axis, delta) => {
        if (delta === 0) return;
        const nx = axis === 'x' ? p.x + delta : p.x;
        const ny = axis === 'y' ? p.y + delta : p.y;
        const nz = axis === 'z' ? p.z + delta : p.z;
        if (!this.posBlocked(nx, ny, nz)) {
          p.set(nx, ny, nz);
          if (axis === 'y') d.rest = false;
        } else {
          if (axis === 'y') {
            if (delta < 0) { d.rest = true; d.vel.x *= 0.6; d.vel.z *= 0.6; }
            d.vel.y = 0;
          } else d.vel[axis] = 0;
        }
      };
      step('y', d.vel.y * dt);
      step('x', d.vel.x * dt);
      step('z', d.vel.z * dt);
      // 兜底：若因方块更新被埋进实体中，向上顶出至空位
      if (this.posBlocked(p.x, p.y, p.z)) {
        for (let k = 1; k <= 3; k++) {
          if (!this.posBlocked(p.x, p.y + k, p.z)) { p.y += k; break; }
        }
      }
      d.mesh.rotation.y += dt * 1.8;
      // 磁吸拾取（仅在近距离直线无阻挡时拉动，避免隔墙吸取）
      const pc = new THREE.Vector3(player.pos.x, player.pos.y + 0.9, player.pos.z);
      const dist = d.mesh.position.distanceTo(pc);
      if (d.age > 0.5 && dist < 2.0) {
        const pull = pc.clone().sub(d.mesh.position).normalize().multiplyScalar(60 * dt / Math.max(dist, 0.4));
        d.vel.add(pull);
      }
      if (d.age > 0.5 && dist < 0.6) {
        const leftover = pickupCb(d.itemId, d.count);
        if (leftover === 0) {
          Sfx.pop();
          this.scene.remove(d.mesh);
          this.drops.splice(i, 1);
          continue;
        } else d.count = leftover;
      }
      if (d.age > 240) { this.scene.remove(d.mesh); this.drops.splice(i, 1); }
    }
  }
}
