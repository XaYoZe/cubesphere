// ============ 人物模型 / 第一人称手持视图 ============
'use strict';

// 物品→手持网格（方块=贴图立方体，道具=图标面片）
const _iconTexCache = {};
function iconTexture(itemId) {
  if (_iconTexCache[itemId]) return _iconTexCache[itemId];
  const tex = new THREE.TextureLoader().load(ICONS.get(itemId));
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  _iconTexCache[itemId] = tex;
  return tex;
}
function makeHeldMesh(itemId, size) {
  const item = ITEMS[itemId];
  if (!item) return null;
  // 方块物品：贴图立方体
  if (item.block != null) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const t = BLOCKS[item.block].tex;
    const faceTex = [t[4], t[5], t[0], t[1], t[3], t[2]];
    const uvAttr = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const uv = TEX.uv(faceTex[f]);
      uvAttr.setXY(f * 4 + 0, uv.u0, uv.v1);
      uvAttr.setXY(f * 4 + 1, uv.u1, uv.v1);
      uvAttr.setXY(f * 4 + 2, uv.u0, uv.v0);
      uvAttr.setXY(f * 4 + 3, uv.u1, uv.v0);
    }
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: window.atlasTexture }));
  }
  // 工具物品：立体程序化模型
  if (item.tool) {
    return makeToolMesh(itemId, item.tool, item.tier || 1, size);
  }
  // 普通物品：图标面片
  const geo = new THREE.PlaneGeometry(size * 1.5, size * 1.5);
  const mat = new THREE.MeshBasicMaterial({
    map: iconTexture(itemId), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

// 工具程序化立体模型（镐/斧/锹 × 木/石/铁材质配色）
function makeToolMesh(itemId, toolType, tier, size) {
  const pal = [
    { head: 0xb89468, headD: 0x9a7848, handle: 0x8a6238, handleD: 0x6b4820 }, // tier 1 木
    { head: 0xa0a0a0, headD: 0x787878, handle: 0x8a6238, handleD: 0x6b4820 }, // tier 2 石
    { head: 0xe8e8e8, headD: 0xb8b8b8, handle: 0x8a6238, handleD: 0x6b4820 }, // tier 3 铁
  ];
  const p = pal[Math.min(tier - 1, 2)] || pal[0];
  const headMat = new THREE.MeshLambertMaterial({ color: p.head });
  const headMatD = new THREE.MeshLambertMaterial({ color: p.headD });
  const hdlMat = new THREE.MeshLambertMaterial({ color: p.handle });
  const hdlMatD = new THREE.MeshLambertMaterial({ color: p.handleD });
  const s = size; // 基准尺寸(方块边长)
  const g = new THREE.Group();

  if (toolType === 'pickaxe') {
    // 手柄：细长棍
    const stick = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22, s * 1.5, s * 0.22), hdlMat);
    stick.position.set(0, -s * 0.15, 0);
    g.add(stick);
    stick.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.08, s * 1.2, s * 0.08), hdlMatD));
    // 镐头：中央方块 + 两侧斜三角
    const headG = new THREE.Group();
    const center = new THREE.Mesh(new THREE.BoxGeometry(s * 0.24, s * 0.24, s * 0.26), headMat);
    headG.add(center);
    // 左侧刃
    const left = new THREE.Mesh(new THREE.BoxGeometry(s * 0.58, s * 0.18, s * 0.26), headMatD);
    left.position.set(-s * 0.35, 0, 0);
    headG.add(left);
    // 右侧刃
    const right = new THREE.Mesh(new THREE.BoxGeometry(s * 0.58, s * 0.18, s * 0.26), headMatD);
    right.position.set(s * 0.35, 0, 0);
    headG.add(right);
    // 上尖
    const tip = new THREE.Mesh(new THREE.ConeGeometry(s * 0.22, s * 0.3, 4), headMat);
    tip.position.y = s * 0.25; tip.rotation.y = Math.PI / 4;
    headG.add(tip);
    headG.position.y = s * 0.52;
    g.add(headG);
  } else if (toolType === 'axe') {
    // 手柄
    const stick = new THREE.Mesh(new THREE.BoxGeometry(s * 0.2, s * 1.5, s * 0.2), hdlMat);
    stick.position.set(0, -s * 0.12, 0);
    g.add(stick);
    // 斧头：宽扁刃
    const blade = new THREE.Mesh(new THREE.BoxGeometry(s * 0.26, s * 0.54, s * 0.08), headMat);
    blade.position.set(0, s * 0.4, s * 0.15);
    g.add(blade);
    // 刃尖斜块
    const edge = new THREE.Mesh(new THREE.BoxGeometry(s * 0.4, s * 0.44, s * 0.06), headMatD);
    edge.position.set(0, s * 0.36, s * 0.2);
    g.add(edge);
    // 楔子
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(s * 0.13, s * 0.22, s * 0.13), hdlMatD);
    wedge.position.set(0, s * 0.15, 0);
    g.add(wedge);
  } else if (toolType === 'shovel') {
    // 手柄
    const stick = new THREE.Mesh(new THREE.BoxGeometry(s * 0.2, s * 1.5, s * 0.2), hdlMat);
    stick.position.set(0, -s * 0.05, 0);
    g.add(stick);
    // 锹头：扁平板
    const blade = new THREE.Mesh(new THREE.BoxGeometry(s * 0.65, s * 0.14, s * 0.45), headMat);
    blade.position.set(0, s * 0.64, s * 0.06);
    g.add(blade);
    // 刃边色深
    const edge = new THREE.Mesh(new THREE.BoxGeometry(s * 0.65, s * 0.08, s * 0.34), headMatD);
    edge.position.set(0, s * 0.56, 0);
    g.add(edge);
    // 连接处
    const joint = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22, s * 0.2, s * 0.22), hdlMatD);
    joint.position.set(0, s * 0.52, 0);
    g.add(joint);
  }
  return g;
}

// 像素皮肤纹理（原创小人：星际工程师）
function skinTex(draw, w = 8, h = 8) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}
const SKIN = {
  skin: '#e0ac74', skinD: '#c8945c', hair: '#3f2e1e', hairD: '#32241668',
  suit: '#2f7f95', suitD: '#226070', suitL: '#3d97ae',
  pants: '#31496b', pantsD: '#273a56', shoe: '#3a3a3a', glow: '#57e6ff',
};
function noisyFill(g, w, h, base, dark, seed) {
  const rand = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = dark;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rand() < 0.16) g.fillRect(x, y, 1, 1);
}
function lambert(tex) { return new THREE.MeshLambertMaterial({ map: tex }); }

class PlayerAvatar {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.walkPhase = 0;
    this.mineT = 0;
    this.buildBody();
    this.group.visible = false;
  }

  buildBody() {
    const S = SKIN;
    // 头（前脸带眼睛，顶部头发）
    const face = skinTex((g) => {
      noisyFill(g, 8, 8, S.skin, S.skinD, 21);
      g.fillStyle = S.hair; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 1); g.fillRect(7, 2, 1, 1);
      g.fillStyle = '#fff'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
      g.fillStyle = '#2b3d8f'; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
      g.fillStyle = S.skinD; g.fillRect(3, 6, 2, 1);
    });
    const hairTop = skinTex((g) => noisyFill(g, 8, 8, S.hair, '#2a1d12', 22));
    const headSide = skinTex((g) => {
      noisyFill(g, 8, 8, S.skin, S.skinD, 23);
      g.fillStyle = S.hair; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 8, 1);
    });
    const headBack = skinTex((g) => noisyFill(g, 8, 8, S.hair, '#2a1d12', 24));
    this.head = new THREE.Group();
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44),
      [lambert(headSide), lambert(headSide), lambert(hairTop), lambert(headSide), lambert(face), lambert(headBack)]);
    headBox.position.y = 0.22;
    this.head.add(headBox);
    this.head.position.set(0, 1.3, 0);
    this.group.add(this.head);

    // 躯干（工装 + 胸前发光徽章）
    const torsoFront = skinTex((g) => {
      noisyFill(g, 8, 10, S.suit, S.suitD, 25);
      g.fillStyle = S.suitD; g.fillRect(3, 0, 2, 10);
      g.fillStyle = S.glow; g.fillRect(1, 2, 2, 1);
      g.fillStyle = S.suitL; g.fillRect(0, 0, 8, 1);
    }, 8, 10);
    const torsoSide = skinTex((g) => noisyFill(g, 8, 10, S.suit, S.suitD, 26), 8, 10);
    const torsoTop = skinTex((g) => noisyFill(g, 8, 8, S.suitL, S.suit, 27));
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.24),
      [lambert(torsoSide), lambert(torsoSide), lambert(torsoTop), lambert(torsoTop), lambert(torsoFront), lambert(torsoSide)]);
    this.torso.position.set(0, 0.99, 0);
    this.group.add(this.torso);

    // 四肢（几何体下移使肩/髋为旋转轴心）
    const armTex = skinTex((g) => {
      noisyFill(g, 6, 12, S.suit, S.suitD, 28);
      g.fillStyle = S.skin; g.fillRect(0, 9, 6, 3);
      g.fillStyle = S.skinD; g.fillRect(0, 9, 1, 3);
    }, 6, 12);
    const legTex = skinTex((g) => {
      noisyFill(g, 6, 12, S.pants, S.pantsD, 29);
      g.fillStyle = S.shoe; g.fillRect(0, 10, 6, 2);
    }, 6, 12);
    const limb = (tex, w, h) => {
      const geo = new THREE.BoxGeometry(w, h, w);
      geo.translate(0, -h / 2 + 0.03, 0);
      return new THREE.Mesh(geo, lambert(tex));
    };
    this.armL = new THREE.Group(); this.armL.add(limb(armTex, 0.18, 0.6));
    this.armL.position.set(-0.32, 1.26, 0);
    this.armR = new THREE.Group(); this.armR.add(limb(armTex, 0.18, 0.6));
    this.armR.position.set(0.32, 1.26, 0);
    this.legL = new THREE.Group(); this.legL.add(limb(legTex, 0.2, 0.68));
    this.legL.position.set(-0.115, 0.68, 0);
    this.legR = new THREE.Group(); this.legR.add(limb(legTex, 0.2, 0.68));
    this.legR.position.set(0.115, 0.68, 0);
    this.group.add(this.armL, this.armR, this.legL, this.legR);

    // 右手持物挂点
    this.itemHolder = new THREE.Group();
    this.itemHolder.position.set(0, -0.52, -0.02);
    this.armR.add(this.itemHolder);
  }

  setHeld(itemId) {
    for (const c of [...this.itemHolder.children]) {
      this.itemHolder.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    if (!itemId) return;
    const mesh = makeHeldMesh(itemId, 0.28);
    if (!mesh) return;
    const item = ITEMS[itemId];
    if (item.block != null) {
      mesh.position.set(0, 0, 0.14);
      mesh.rotation.y = 0.5;
    } else if (item.tool) {
      // 第三人称：同样绕X轴CW 90° + 把柄轴CW 90°
      mesh.position.set(0, 0.1, 0.22);
      mesh.rotation.set(-0.22, -1.57, 0);
    } else {
      mesh.position.set(0.02, 0.05, 0.16);
      mesh.rotation.set(0, Math.PI / 2, -0.9);
    }
    this.itemHolder.add(mesh);
  }

  update(dt, player, mining) {
    this.group.position.set(player.pos.x, player.pos.y, player.pos.z);
    this.group.rotation.y = player.yaw + Math.PI;
    this.head.rotation.x = -player.pitch;
    // 行走摆动
    const hs = Math.hypot(player.vel.x, player.vel.z);
    this.walkPhase += dt * hs * 2.6;
    const k = Math.min(1, hs / 3.5);
    const s = Math.sin(this.walkPhase) * k;
    this.legL.rotation.x = s * 0.75;
    this.legR.rotation.x = -s * 0.75;
    this.armL.rotation.x = -s * 0.55;
    // 挖掘/放置时右臂快速挥动，否则随步伐摆动
    if (mining) {
      this.mineT += dt * 13;
      this.armR.rotation.x = -0.95 + Math.sin(this.mineT) * 0.5;
    } else {
      this.mineT = 0;
      this.armR.rotation.x = s * 0.55;
    }
    // 空中微张四肢
    if (!player.onGround && !player.inWater) {
      this.armL.rotation.z = 0.25; this.armR.rotation.z = -0.25;
    } else {
      this.armL.rotation.z = 0; this.armR.rotation.z = 0;
    }
  }
}

// ============ 第一人称手臂 + 手持物品 ============
class FirstPersonHand {
  constructor(camera) {
    this.group = new THREE.Group();
    camera.add(this.group);
    this.basePos = new THREE.Vector3(0.42, -0.4, -0.72);
    this.group.position.copy(this.basePos);
    // 手臂（袖口 + 手）
    const armTex = skinTex((g) => {
      noisyFill(g, 6, 12, SKIN.suit, SKIN.suitD, 31);
      g.fillStyle = SKIN.skin; g.fillRect(0, 0, 6, 4);
      g.fillStyle = SKIN.skinD; g.fillRect(0, 3, 6, 1);
    }, 6, 12);
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.5), lambert(armTex));
    this.arm.position.set(0.06, -0.16, 0.22);
    this.arm.rotation.set(-0.3, 0.15, 0);
    this.group.add(this.arm);
    this.itemHolder = new THREE.Group();
    this.group.add(this.itemHolder);
    this.walkT = 0;
    this.swing = 0;       // 0=静止, (0,1)=挥动进度
    this.swingLoop = false;
    this.heldId = null;
  }

  setHeld(itemId) {
    this.heldId = itemId;
    for (const c of [...this.itemHolder.children]) {
      this.itemHolder.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    if (!itemId) { this.arm.visible = true; return; }
    this.arm.visible = true;
    const mesh = makeHeldMesh(itemId, 0.3);
    if (!mesh) return;
    const item = ITEMS[itemId];
    if (item.block != null) {
      mesh.position.set(0, -0.02, 0);
      mesh.rotation.set(0.1, 0.8, 0);
    } else if (item.tool) {
      // 绕X轴CW旋转90° = -π/2，叠加在已有1.35前倾上 = 1.35-1.57=-0.22
      mesh.position.set(0.52, -0.44, -0.62);
      mesh.rotation.set(-0.22, -1.57, 0);
    } else {
      mesh.position.set(-0.05, 0.1, -0.05);
      mesh.rotation.set(0, -0.35, -0.6);
    }
    this.itemHolder.add(mesh);
  }

  swingOnce() { if (this.swing <= 0) this.swing = 0.001; }

  update(dt, moving, mining) {
    this.walkT += dt * (moving ? 9 : 2.2);
    if (mining) { this.swingLoop = true; if (this.swing <= 0) this.swing = 0.001; }
    else this.swingLoop = false;
    if (this.swing > 0) {
      this.swing += dt / 0.28;
      if (this.swing >= 1) this.swing = this.swingLoop ? 0.001 : 0;
    }
    const sw = Math.sin(Math.min(this.swing, 1) * Math.PI);
    // 走路晃动 + 挥动前探
    this.group.position.set(
      this.basePos.x + Math.cos(this.walkT * 0.5) * 0.012 - sw * 0.16,
      this.basePos.y + Math.abs(Math.sin(this.walkT * 0.5)) * -0.025 - sw * 0.1,
      this.basePos.z - sw * 0.12
    );
    this.group.rotation.set(-sw * 0.8, sw * 0.45, -sw * 0.2);
  }
}
