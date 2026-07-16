// ============ 天空：昼夜循环 / 星空 / 戴森云 ============
'use strict';

class Sky {
  constructor(scene) {
    this.scene = scene;
    this.dayLength = 600; // 10分钟一天
    this.time = 0.3;      // 0..1, 0.25=正午
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildSun();
    this.buildMoon();
    this.buildStars();
    this.buildDyson();
    this.buildClouds();
    this.ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(this.ambient);
    this.dirLight = new THREE.DirectionalLight(0xfff2dd, 0.7);
    scene.add(this.dirLight);
    this.fog = new THREE.Fog(0x9fd0ff, 40, 110);
    scene.fog = this.fog;
  }

  makeSprite(draw, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  buildSun() {
    const tex = this.makeSprite((g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.5);
      grd.addColorStop(0, 'rgba(255,250,220,1)');
      grd.addColorStop(0.35, 'rgba(255,235,160,1)');
      grd.addColorStop(0.6, 'rgba(255,200,90,0.55)');
      grd.addColorStop(1, 'rgba(255,180,60,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.fillStyle = '#fff6d8';
      g.fillRect(s * 0.34, s * 0.34, s * 0.32, s * 0.32);
    }, 128);
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
    this.sun.scale.set(22, 22, 1);
    this.sunGroup = new THREE.Group();
    this.sunGroup.add(this.sun);
    this.sun.position.set(0, 0, 0);
    this.group.add(this.sunGroup);
  }

  buildMoon() {
    const tex = this.makeSprite((g, s) => {
      g.fillStyle = '#dfe6f0';
      g.fillRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
      g.fillStyle = '#b9c2d4';
      g.fillRect(s * 0.38, s * 0.36, s * 0.12, s * 0.12);
      g.fillRect(s * 0.52, s * 0.5, s * 0.1, s * 0.14);
    }, 64);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
    this.moon.scale.set(10, 10, 1);
    this.group.add(this.moon);
  }

  buildStars() {
    const geo = new THREE.BufferGeometry();
    const pos = [], col = [];
    const rand = mulberry32(999);
    for (let i = 0; i < 600; i++) {
      const theta = rand() * Math.PI * 2, phi = Math.acos(rand() * 2 - 1);
      const r = 380;
      pos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      const b = 0.6 + rand() * 0.4;
      const tint = rand();
      col.push(b, b * (0.9 + tint * 0.1), b * (0.85 + tint * 0.15));
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.starMat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
    this.stars = new THREE.Points(geo, this.starMat);
    this.group.add(this.stars);
  }

  buildDyson() {
    // 戴森云：围绕太阳的粒子群
    this.dysonGroup = new THREE.Group();
    this.sunGroup.add(this.dysonGroup);
    const geo = new THREE.BufferGeometry();
    this.sailCount = 0;
    this.maxSails = 120;
    this.sailData = [];
    const pos = new Float32Array(this.maxSails * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, 0);
    this.sailMat = new THREE.PointsMaterial({ color: 0xaaddff, size: 2.2, transparent: true, opacity: 0.95, fog: false, sizeAttenuation: false });
    this.sailPoints = new THREE.Points(geo, this.sailMat);
    this.dysonGroup.add(this.sailPoints);
    // 戴森球框架
    const frameGeo = new THREE.IcosahedronGeometry(16, 1);
    this.dysonFrame = new THREE.LineSegments(
      new THREE.WireframeGeometry(frameGeo),
      new THREE.LineBasicMaterial({ color: 0x57c8ff, transparent: true, opacity: 0, fog: false })
    );
    this.dysonGroup.add(this.dysonFrame);
    const shellGeo = new THREE.IcosahedronGeometry(15.6, 1);
    this.dysonShell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
      color: 0x1a4a6e, transparent: true, opacity: 0, fog: false, side: THREE.DoubleSide,
    }));
    this.dysonGroup.add(this.dysonShell);
  }

  addSail() {
    if (this.sailCount >= this.maxSails) return;
    const i = this.sailCount++;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 17 + Math.random() * 4;
    this.sailData.push({ theta, phi, r, speed: 0.15 + Math.random() * 0.2 });
    this.sailPoints.geometry.setDrawRange(0, this.sailCount);
    this.updateSailPositions(0);
  }

  updateSailPositions(dt) {
    const pos = this.sailPoints.geometry.attributes.position;
    for (let i = 0; i < this.sailCount; i++) {
      const s = this.sailData[i];
      s.theta += s.speed * dt;
      pos.setXYZ(i,
        s.r * Math.sin(s.phi) * Math.cos(s.theta),
        s.r * Math.cos(s.phi),
        s.r * Math.sin(s.phi) * Math.sin(s.theta));
    }
    pos.needsUpdate = true;
  }

  setDysonProgress(p) {
    // p: 0..1
    this.dysonFrame.material.opacity = Math.min(0.85, p * 1.4);
    this.dysonShell.material.opacity = Math.max(0, (p - 0.4)) * 0.9;
  }

  buildClouds() {
    const tex = this.makeSprite((g, s) => {
      const rand = mulberry32(555);
      g.clearRect(0, 0, s, s);
      for (let i = 0; i < 26; i++) {
        const x = rand() * s, y = rand() * s;
        const w = 20 + rand() * 60, h = 8 + rand() * 18;
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.fillRect(x - w / 2 + 6, y - h / 2 - 5, w - 12, 5);
      }
    }, 256);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    const geo = new THREE.PlaneGeometry(600, 600);
    this.cloudMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.rotation.x = Math.PI / 2;
    this.clouds.position.y = 72;
    this.scene.add(this.clouds);
    this.cloudTex = tex;
  }

  lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    return ((r1 + (r2 - r1) * t) << 16) | (((g1 + (g2 - g1) * t) | 0) << 8) | ((b1 + (b2 - b1) * t) | 0);
  }

  update(dt, playerPos, renderer, scene) {
    this.time = (this.time + dt / this.dayLength) % 1;
    const ang = (this.time - 0.25) * Math.PI * 2; // 0.25 = 正午
    this.sunDir.set(Math.sin(ang) * 0.4, Math.cos(ang), Math.sin(ang)).normalize();

    const R = 320;
    this.sunGroup.position.copy(this.sunDir).multiplyScalar(R).add(playerPos);
    this.moon.position.copy(this.sunDir).multiplyScalar(-R).add(playerPos);
    this.stars.position.copy(playerPos);
    this.clouds.position.x = playerPos.x; this.clouds.position.z = playerPos.z;
    this.cloudTex.offset.x += dt * 0.0018;

    // 日光强度
    const dayness = Math.max(0, Math.min(1, (this.sunDir.y + 0.12) * 4));
    const duskness = Math.max(0, 1 - Math.abs(this.sunDir.y) * 5); // 黄昏程度
    // 天空色
    const daySky = 0x87bfff, nightSky = 0x070b18, duskSky = 0xff9a55;
    let sky = this.lerpColor(nightSky, daySky, dayness);
    sky = this.lerpColor(sky, duskSky, duskness * 0.45);
    scene.background = new THREE.Color(sky);
    let fogC = this.lerpColor(0x0a1020, 0x9fd0ff, dayness);
    fogC = this.lerpColor(fogC, 0xffb070, duskness * 0.4);
    this.fog.color.setHex(fogC);

    // 方块亮度（乘到共享材质上）
    const bright = 0.25 + dayness * 0.75;
    const tint = new THREE.Color().setHex(this.lerpColor(0x8090c0, 0xffffff, dayness));
    tint.multiplyScalar(bright);
    if (window.game && window.game.world.material) {
      window.game.world.material.color.copy(tint);
      window.game.world.materialT.color.copy(tint);
      window.game.world.materialW.color.copy(tint);
    }
    this.ambient.intensity = 0.35 + dayness * 0.45;
    this.dirLight.intensity = dayness * 0.6;
    this.dirLight.position.copy(this.sunDir);

    this.starMat.opacity = Math.max(0, 1 - dayness * 1.6);
    this.cloudMat.opacity = 0.15 + dayness * 0.45;

    this.updateSailPositions(dt);
    this.dysonGroup.rotation.y += dt * 0.05;
  }

  isNight() { return this.sunDir.y < -0.1; }
  clockText() {
    const h = Math.floor(((this.time + 0.25) % 1) * 24);
    const mm = Math.floor((((this.time + 0.25) % 1) * 24 % 1) * 60);
    return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
}
