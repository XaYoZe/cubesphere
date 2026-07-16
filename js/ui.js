// ============ UI：背包 / 合成 / 容器 / 科技树 / HUD ============
'use strict';

const UI = {
  game: null,
  openPanel: null,      // null | 'inventory' | 'crafting' | 'furnace' | 'chest' | 'machine' | 'tech' | 'pause'
  cursorStack: null,    // 手上拿着的物品 {id,count}
  craftGrid: [],        // 当前合成格
  craftSize: 2,
  currentContainer: null,
  currentMachine: null,
  researching: null,    // {tech, t}

  $(id) { return document.getElementById(id); },

  init(game) {
    this.game = game;
    this.craftGrid = new Array(9).fill(null);
    this.buildHotbar();
    this.buildInventoryPanel();
    this.buildTechTree();
    this.buildQuestPanel();
    this.updateHealth();
    this.updateHotbar();

    // 光标物品跟随
    document.addEventListener('mousemove', e => {
      const el = this.$('cursorItem');
      el.style.left = e.clientX + 'px';
      el.style.top = e.clientY + 'px';
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
  },

  // ============ 通用格子渲染 ============
  slotHTML(stack, cls, data) {
    let inner = '';
    if (stack) {
      inner = `<img draggable="false" src="${ICONS.get(stack.id)}">` +
        (stack.count > 1 ? `<span class="cnt">${stack.count}</span>` : '');
      const it = ITEMS[stack.id];
      if (it && it.durability && stack.dur != null && stack.dur < it.durability) {
        const p = stack.dur / it.durability;
        const col = p > 0.5 ? '#6fd06f' : p > 0.25 ? '#ffd94a' : '#ff6b6b';
        inner += `<span class="dur" style="width:${(p * 80) | 0}%;background:${col}"></span>`;
      }
    }
    return `<div class="slot ${cls || ''}" ${data || ''}>${inner}</div>`;
  },

  tooltipFor(stack) {
    if (!stack) return '';
    const it = ITEMS[stack.id];
    let s = `<b>${it ? it.name : stack.id}</b>`;
    if (it && it.desc) s += `<br><span class="tt-desc">${it.desc}</span>`;
    if (it && it.tool) s += `<br><span class="tt-desc">${{ pickaxe: '镐', axe: '斧', shovel: '锹' }[it.tool]} · 效率 ${it.speed}x</span>`;
    if (it && it.fuel) s += `<br><span class="tt-desc">燃料 · 可烧 ${(it.fuel / 10).toFixed(1)} 个物品</span>`;
    if (it && it.food) s += `<br><span class="tt-desc">食物 · 回复 ${it.food} 生命</span>`;
    if (it && it.machine) s += `<br><span class="tt-mach">工业设施</span>`;
    return s;
  },

  attachSlotEvents(container, getSlots, setSlot, opts = {}) {
    container.querySelectorAll('.slot[data-i]').forEach(el => {
      const i = parseInt(el.dataset.i);
      el.onmousedown = e => {
        e.preventDefault();
        Sfx.click();
        const slots = getSlots();
        const cur = slots[i];
        if (e.button === 0) {
          if (this.cursorStack && opts.filter && !opts.filter(this.cursorStack, i)) return;
          if (e.shiftKey && cur && opts.quickMove) { opts.quickMove(i); this.refresh(); return; }
          if (!this.cursorStack && cur) { this.cursorStack = cur; setSlot(i, null); }
          else if (this.cursorStack && !cur) {
            if (opts.outputOnly) return;
            setSlot(i, this.cursorStack); this.cursorStack = null;
          }
          else if (this.cursorStack && cur) {
            if (opts.outputOnly) {
              if (cur.id === this.cursorStack.id) {
                const max = ITEMS[cur.id].stack;
                if (this.cursorStack.count + cur.count <= max) { this.cursorStack.count += cur.count; setSlot(i, null); }
              }
              this.refresh(); return;
            }
            if (cur.id === this.cursorStack.id && !ITEMS[cur.id].tool) {
              const max = ITEMS[cur.id].stack;
              const move = Math.min(this.cursorStack.count, max - cur.count);
              cur.count += move; this.cursorStack.count -= move;
              if (this.cursorStack.count <= 0) this.cursorStack = null;
              setSlot(i, cur);
            } else { setSlot(i, this.cursorStack); this.cursorStack = cur; }
          }
        } else if (e.button === 2) {
          if (opts.outputOnly) return;
          if (this.cursorStack) {
            if (opts.filter && !opts.filter(this.cursorStack, i)) return;
            if (!cur) { setSlot(i, { id: this.cursorStack.id, count: 1, dur: this.cursorStack.dur }); this.cursorStack.count--; }
            else if (cur.id === this.cursorStack.id && cur.count < ITEMS[cur.id].stack) { cur.count++; this.cursorStack.count--; setSlot(i, cur); }
            if (this.cursorStack && this.cursorStack.count <= 0) this.cursorStack = null;
          } else if (cur) {
            const half = Math.ceil(cur.count / 2);
            this.cursorStack = { id: cur.id, count: half, dur: cur.dur };
            cur.count -= half;
            setSlot(i, cur.count > 0 ? cur : null);
          }
        }
        this.refresh();
      };
      el.onmouseenter = () => {
        const slots = getSlots();
        if (slots[i]) this.showTooltip(this.tooltipFor(slots[i]));
      };
      el.onmouseleave = () => this.hideTooltip();
    });
  },

  showTooltip(html) {
    const t = this.$('tooltip');
    t.innerHTML = html; t.style.display = 'block';
    document.onmousemove = e => {
      t.style.left = Math.min(e.clientX + 14, innerWidth - 220) + 'px';
      t.style.top = (e.clientY + 14) + 'px';
    };
  },
  hideTooltip() { this.$('tooltip').style.display = 'none'; },

  // ============ 快捷栏 ============
  buildHotbar() {
    const hb = this.$('hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'hslot' + (i === this.game.hotbarSel ? ' sel' : '');
      d.dataset.i = i;
      hb.appendChild(d);
    }
  },
  updateHotbar() {
    const hb = this.$('hotbar');
    for (let i = 0; i < 9; i++) {
      const el = hb.children[i];
      if (!el) continue;
      el.className = 'hslot' + (i === this.game.hotbarSel ? ' sel' : '');
      const stack = this.game.inventory[i];
      let inner = '';
      if (stack) {
        inner = `<img draggable="false" src="${ICONS.get(stack.id)}">` + (stack.count > 1 ? `<span class="cnt">${stack.count}</span>` : '');
        const it = ITEMS[stack.id];
        if (it && it.durability && stack.dur != null && stack.dur < it.durability) {
          const p = stack.dur / it.durability;
          const col = p > 0.5 ? '#6fd06f' : p > 0.25 ? '#ffd94a' : '#ff6b6b';
          inner += `<span class="dur" style="width:${(p * 80) | 0}%;background:${col}"></span>`;
        }
      }
      el.innerHTML = inner;
    }
    // 手持物品名
    const stack = this.game.inventory[this.game.hotbarSel];
    const nameEl = this.$('heldName');
    if (stack) {
      nameEl.textContent = itemName(stack.id);
      nameEl.style.opacity = 1;
      clearTimeout(this._heldT);
      this._heldT = setTimeout(() => nameEl.style.opacity = 0, 1600);
    }
  },

  // ============ 背包 & 合成面板 ============
  buildInventoryPanel() { /* 动态渲染 */ },

  renderInventoryGrid() {
    const inv = this.$('invGrid');
    let html = '';
    for (let i = 9; i < 36; i++) html += this.slotHTML(this.game.inventory[i], '', `data-i="${i}"`);
    inv.innerHTML = html;
    const bar = this.$('invHotbar');
    html = '';
    for (let i = 0; i < 9; i++) html += this.slotHTML(this.game.inventory[i], '', `data-i="${i}"`);
    bar.innerHTML = html;
    const getSlots = () => this.game.inventory;
    const setSlot = (i, v) => { this.game.inventory[i] = v; };
    const quickMove = (i) => {
      const s = this.game.inventory[i];
      if (!s) return;
      const target = i < 9 ? [9, 36] : [0, 9];
      this.game.inventory[i] = this.game.addToRange(s, target[0], target[1]);
    };
    this.attachSlotEvents(inv, getSlots, setSlot, { quickMove });
    this.attachSlotEvents(bar, getSlots, setSlot, { quickMove });
  },

  renderCraftGrid() {
    const n = this.craftSize;
    const grid = this.$('craftGrid');
    grid.style.gridTemplateColumns = `repeat(${n}, 52px)`;
    let html = '';
    for (let i = 0; i < n * n; i++) html += this.slotHTML(this.craftGrid[i], '', `data-i="${i}"`);
    grid.innerHTML = html;
    this.attachSlotEvents(grid, () => this.craftGrid, (i, v) => { this.craftGrid[i] = v; this.updateCraftResult(); });
    this.updateCraftResult();
  },

  matchRecipe() {
    const n = this.craftSize;
    const grid = [];
    for (let i = 0; i < n * n; i++) grid.push(this.craftGrid[i] ? this.craftGrid[i].id : null);
    for (const r of RECIPES) {
      if (r.tech && !this.game.stats.tech[r.tech]) continue;
      if (r.shapeless) {
        const need = [...r.shapeless];
        const have = grid.filter(x => x);
        if (have.length !== need.length) continue;
        let ok = true;
        for (const id of have) {
          const idx = need.indexOf(id);
          if (idx === -1) { ok = false; break; }
          need.splice(idx, 1);
        }
        if (ok && need.length === 0) return r;
      } else {
        const rows = r.pattern.length, cols = Math.max(...r.pattern.map(p => p.length));
        if (rows > n || cols > n) continue;
        for (let oy = 0; oy <= n - rows; oy++) for (let ox = 0; ox <= n - cols; ox++) {
          let ok = true;
          for (let y = 0; y < n && ok; y++) for (let x = 0; x < n && ok; x++) {
            const inPat = y >= oy && y < oy + rows && x >= ox && x < ox + cols;
            const pc = inPat ? (r.pattern[y - oy][x - ox] || ' ') : ' ';
            const want = pc === ' ' ? null : r.key[pc];
            const has = grid[y * n + x];
            if (want !== has) ok = false;
          }
          if (ok) return r;
        }
      }
    }
    return null;
  },

  updateCraftResult() {
    const r = this.matchRecipe();
    const out = this.$('craftOut');
    this.craftResult = r;
    out.innerHTML = this.slotHTML(r ? { id: r.out, count: r.count } : null, 'out', 'data-i="0"');
    const el = out.querySelector('.slot');
    el.onmousedown = e => {
      if (!this.craftResult) return;
      e.preventDefault();
      const r2 = this.craftResult;
      const item = ITEMS[r2.out];
      const make = { id: r2.out, count: r2.count, dur: item.durability || undefined };
      if (this.cursorStack) {
        if (this.cursorStack.id !== r2.out || ITEMS[r2.out].tool) return;
        if (this.cursorStack.count + r2.count > item.stack) return;
        this.cursorStack.count += r2.count;
      } else this.cursorStack = make;
      // 消耗材料
      for (let i = 0; i < this.craftGrid.length; i++) {
        if (this.craftGrid[i]) {
          this.craftGrid[i].count--;
          if (this.craftGrid[i].count <= 0) this.craftGrid[i] = null;
        }
      }
      Sfx.craft();
      this.game.stats.crafted[r2.out] = (this.game.stats.crafted[r2.out] || 0) + r2.count;
      this.game.stats.obtained[r2.out] = (this.game.stats.obtained[r2.out] || 0) + r2.count;
      this.refresh();
    };
    el.onmouseenter = () => { if (this.craftResult) this.showTooltip(this.tooltipFor({ id: this.craftResult.out, count: this.craftResult.count })); };
    el.onmouseleave = () => this.hideTooltip();
  },

  // 配方书
  renderRecipeBook() {
    const book = this.$('recipeBook');
    let html = '';
    for (const r of RECIPES) {
      if (r.tech && !this.game.stats.tech[r.tech]) continue;
      const needSize = r.shapeless ? Math.ceil(Math.sqrt(r.shapeless.length)) : Math.max(r.pattern.length, ...r.pattern.map(p => p.length));
      const locked = needSize > this.craftSize;
      html += `<div class="rb-item ${locked ? 'rb-locked' : ''}" data-out="${r.out}" title="${itemName(r.out)}">
        <img draggable="false" src="${ICONS.get(r.out)}">${r.count > 1 ? `<span class="cnt">${r.count}</span>` : ''}</div>`;
    }
    book.innerHTML = html;
    book.querySelectorAll('.rb-item').forEach(el => {
      const out = el.dataset.out;
      const r = RECIPES.find(x => x.out === out && (!x.tech || this.game.stats.tech[x.tech]));
      el.onmouseenter = () => {
        let s = `<b>${itemName(r.out)}${r.count > 1 ? ' ×' + r.count : ''}</b><br><span class="tt-desc">`;
        const mats = {};
        if (r.shapeless) for (const id of r.shapeless) mats[id] = (mats[id] || 0) + 1;
        else for (const row of r.pattern) for (const ch of row) if (ch !== ' ') mats[r.key[ch]] = (mats[r.key[ch]] || 0) + 1;
        s += Object.entries(mats).map(([id, n]) => `${itemName(id)} ×${n}`).join('　');
        s += '</span>';
        if (el.classList.contains('rb-locked')) s += '<br><span class="tt-warn">需要工作台 (3×3)</span>';
        else s += '<br><span class="tt-hint">点击自动摆放材料</span>';
        this.showTooltip(s);
      };
      el.onmouseleave = () => this.hideTooltip();
      el.onmousedown = () => {
        if (el.classList.contains('rb-locked')) { Sfx.error(); return; }
        this.autoFillRecipe(r);
      };
    });
  },

  autoFillRecipe(r) {
    // 材料清点
    const mats = {};
    if (r.shapeless) for (const id of r.shapeless) mats[id] = (mats[id] || 0) + 1;
    else for (const row of r.pattern) for (const ch of row) if (ch !== ' ') mats[r.key[ch]] = (mats[r.key[ch]] || 0) + 1;
    // 清空合成格回背包
    for (let i = 0; i < this.craftGrid.length; i++) {
      if (this.craftGrid[i]) { this.game.addItem(this.craftGrid[i].id, this.craftGrid[i].count, this.craftGrid[i].dur); this.craftGrid[i] = null; }
    }
    // 检查数量
    for (const id in mats) {
      if (this.game.countItem(id) < mats[id]) { Sfx.error(); this.toast(`材料不足：${itemName(id)}`); this.refresh(); return; }
    }
    const n = this.craftSize;
    if (r.shapeless) {
      let i = 0;
      for (const id of r.shapeless) {
        this.game.removeItem(id, 1);
        this.craftGrid[i] = { id, count: 1 };
        i++;
      }
    } else {
      for (let y = 0; y < r.pattern.length; y++) {
        for (let x = 0; x < r.pattern[y].length; x++) {
          const ch = r.pattern[y][x];
          if (ch === ' ') continue;
          const id = r.key[ch];
          this.game.removeItem(id, 1);
          this.craftGrid[y * n + x] = { id, count: 1 };
        }
      }
    }
    Sfx.pop();
    this.refresh();
  },

  // ============ 面板开关 ============
  open(panel, extra) {
    this.closeAll(false);
    this.openPanel = panel;
    document.exitPointerLock();
    this.$('overlay').style.display = 'flex';
    Sfx.uiOpen();
    if (panel === 'inventory' || panel === 'crafting') {
      this.craftSize = panel === 'crafting' ? 3 : 2;
      this.craftGrid = new Array(9).fill(null);
      this.$('invPanel').style.display = 'flex';
      this.$('craftTitle').textContent = panel === 'crafting' ? '工作台' : '合成';
      this.refresh();
    } else if (panel === 'furnace') {
      this.currentContainer = extra;
      this.$('furnacePanel').style.display = 'flex';
      this.refresh();
    } else if (panel === 'chest') {
      this.currentContainer = extra;
      this.$('chestPanel').style.display = 'flex';
      this.refresh();
    } else if (panel === 'machine') {
      this.currentMachine = extra;
      this.$('machinePanel').style.display = 'flex';
      this.refresh();
    } else if (panel === 'tech') {
      this.$('techPanel').style.display = 'flex';
      this.renderTechTree();
    } else if (panel === 'pause') {
      this.$('pausePanel').style.display = 'flex';
    }
  },

  closeAll(sound = true) {
    if (this.openPanel && sound) Sfx.uiClose();
    this.openPanel = null;
    this.$('overlay').style.display = 'none';
    for (const id of ['invPanel', 'furnacePanel', 'chestPanel', 'machinePanel', 'techPanel', 'pausePanel'])
      this.$(id).style.display = 'none';
    // 合成格里的东西还回背包
    for (let i = 0; i < this.craftGrid.length; i++) {
      if (this.craftGrid[i]) { this.game.addItem(this.craftGrid[i].id, this.craftGrid[i].count, this.craftGrid[i].dur); this.craftGrid[i] = null; }
    }
    if (this.cursorStack) { this.game.addItem(this.cursorStack.id, this.cursorStack.count, this.cursorStack.dur); this.cursorStack = null; }
    this.hideTooltip();
    this.updateCursorItem();
    this.updateHotbar();
  },

  refresh() {
    this.updateCursorItem();
    if (this.openPanel === 'inventory' || this.openPanel === 'crafting') {
      this.renderInventoryGrid();
      this.renderCraftGrid();
      this.renderRecipeBook();
    } else if (this.openPanel === 'furnace') {
      this.renderFurnace();
      this.renderPlayerInvIn('furnInv', 'furnHotbar');
    } else if (this.openPanel === 'chest') {
      this.renderChest();
      this.renderPlayerInvIn('chestInv', 'chestHotbar');
    } else if (this.openPanel === 'machine') {
      this.renderMachine();
      this.renderPlayerInvIn('machInv', 'machHotbar');
    }
    this.updateHotbar();
  },

  updateCursorItem() {
    const el = this.$('cursorItem');
    if (this.cursorStack) {
      el.innerHTML = `<img draggable="false" src="${ICONS.get(this.cursorStack.id)}">` +
        (this.cursorStack.count > 1 ? `<span class="cnt">${this.cursorStack.count}</span>` : '');
      el.style.display = 'block';
    } else el.style.display = 'none';
  },

  renderPlayerInvIn(gridId, barId) {
    const inv = this.$(gridId);
    let html = '';
    for (let i = 9; i < 36; i++) html += this.slotHTML(this.game.inventory[i], '', `data-i="${i}"`);
    inv.innerHTML = html;
    const bar = this.$(barId);
    html = '';
    for (let i = 0; i < 9; i++) html += this.slotHTML(this.game.inventory[i], '', `data-i="${i}"`);
    bar.innerHTML = html;
    const getSlots = () => this.game.inventory;
    const setSlot = (i, v) => { this.game.inventory[i] = v; };
    const quickMove = (i) => {
      const s = this.game.inventory[i];
      if (!s) return;
      if (this.openPanel === 'chest' && this.currentContainer) {
        const left = this.game.addToSlots(this.currentContainer.slots, s);
        this.game.inventory[i] = left;
      } else if (this.openPanel === 'machine' && this.currentMachine) {
        const m = this.currentMachine;
        const want = this.game.machines.machineWants(m);
        if (want.has(s.id) || m.type === 'ejector' && s.id === 'solar_sail') {
          this.game.machines.bufAdd(m.buffer, s.id, s.count);
          this.game.inventory[i] = null;
        }
      } else {
        const target = i < 9 ? [9, 36] : [0, 9];
        this.game.inventory[i] = this.game.addToRange(s, target[0], target[1]);
      }
    };
    this.attachSlotEvents(inv, getSlots, setSlot, { quickMove });
    this.attachSlotEvents(bar, getSlots, setSlot, { quickMove });
  },

  // ============ 熔炉 ============
  renderFurnace() {
    const f = this.currentContainer;
    const inEl = this.$('furnIn'), fuelEl = this.$('furnFuel'), outEl = this.$('furnOut');
    inEl.innerHTML = this.slotHTML(f.slots[0], '', 'data-i="0"');
    fuelEl.innerHTML = this.slotHTML(f.slots[1], '', 'data-i="1"');
    outEl.innerHTML = this.slotHTML(f.slots[2], 'out', 'data-i="2"');
    this.attachSlotEvents(inEl, () => f.slots, (i, v) => { f.slots[i] = v; });
    this.attachSlotEvents(fuelEl, () => f.slots, (i, v) => { f.slots[i] = v; },
      { filter: s => !!ITEMS[s.id].fuel });
    this.attachSlotEvents(outEl, () => f.slots, (i, v) => { f.slots[i] = v; }, { outputOnly: true });
    this.updateFurnaceGauges();
  },

  updateFurnaceGauges() {
    const f = this.currentContainer;
    if (!f) return;
    this.$('furnFlame').style.height = (f.fuel > 0 ? Math.min(1, f.fuel / Math.max(f.fuelMax, 1)) * 22 : 0) + 'px';
    this.$('furnArrow').style.width = ((f.progress || 0) * 44 | 0) + 'px';
  },

  // ============ 箱子 ============
  renderChest() {
    const c = this.currentContainer;
    const grid = this.$('chestGrid');
    let html = '';
    for (let i = 0; i < 27; i++) html += this.slotHTML(c.slots[i], '', `data-i="${i}"`);
    grid.innerHTML = html;
    this.attachSlotEvents(grid, () => c.slots, (i, v) => { c.slots[i] = v; }, {
      quickMove: (i) => {
        const s = c.slots[i];
        if (!s) return;
        c.slots[i] = this.game.addToRange(s, 0, 36);
      },
    });
  },

  // ============ 机器面板 ============
  renderMachine() {
    const m = this.currentMachine;
    const def = MACHINE_DEFS[m.type];
    this.$('machName').textContent = def.name;
    const sat = this.game.machines.powerSat;
    let statusHtml = '';
    const powerCls = sat >= 0.999 ? 'ok' : sat > 0.5 ? 'warn' : 'bad';
    if (def.power < 0) {
      statusHtml += `<div class="mach-row">功耗 <b>${-def.power} kW</b> · 电网满足率 <b class="${powerCls}">${(sat * 100) | 0}%</b></div>`;
    } else if (def.power > 0) {
      statusHtml += `<div class="mach-row">发电 <b class="ok">${def.power} kW</b></div>`;
    }
    statusHtml += `<div class="mach-row">状态：<b class="${m.working ? 'ok' : ''}">${m.working ? '运行中' : '待机'}</b></div>`;

    // 配方选择（熔炉/制造台）
    let recipeHtml = '';
    if (m.type === 'smelter' || m.type === 'assembler' || m.type === 'lab') {
      const list = m.type === 'smelter' ? MACHINE_SMELT : MACHINE_ASSEMBLE;
      recipeHtml += '<div class="mach-recipes">';
      for (const r of list) {
        if (r.tech && !this.game.stats.tech[r.tech]) continue;
        const outId = Object.keys(r.out)[0];
        recipeHtml += `<div class="rb-item ${m.recipe === r.id ? 'rb-sel' : ''}" data-recipe="${r.id}">
          <img draggable="false" src="${ICONS.get(outId)}"></div>`;
      }
      recipeHtml += '</div>';
      const r = (m.type === 'smelter' ? MACHINE_SMELT : MACHINE_ASSEMBLE).find(x => x.id === m.recipe);
      if (r) {
        recipeHtml += `<div class="mach-row tt-desc">配方：${Object.entries(r.in).map(([id, n]) => `${itemName(id)}×${n}`).join(' + ')} → ${Object.entries(r.out).map(([id, n]) => `${itemName(id)}×${n}`).join(', ')} (${r.time}s)</div>`;
        recipeHtml += `<div class="progress-bar"><div class="progress-fill" style="width:${(m.progress * 100) | 0}%"></div></div>`;
      } else recipeHtml += '<div class="mach-row tt-warn">↑ 请选择配方</div>';
    }
    if (m.type === 'ejector') {
      const sunUp = this.game.sky ? this.game.sky.sunDir.y > 0.08 : true;
      recipeHtml += `<div class="mach-row">已装填太阳帆：<b class="ok">${m.sails || 0}</b></div>`;
      if (!sunUp) recipeHtml += `<div class="mach-row tt-warn">☾ 夜间无法瞄准恒星，等待日出…</div>`;
      recipeHtml += `<div class="progress-bar"><div class="progress-fill" style="width:${(m.launchT / 4 * 100) | 0}%"></div></div>`;
      recipeHtml += `<div class="mach-row tt-desc">Shift+点击背包中的太阳帆即可装填 · 也可用传送带输入</div>`;
    }
    if (m.type === 'miner') {
      recipeHtml += `<div class="mach-row tt-desc">${m.oreTarget ? '正在开采下方矿脉…' : '未发现矿脉！请放置于矿石上方(6格内)'}</div>`;
      recipeHtml += `<div class="progress-bar"><div class="progress-fill" style="width:${(m.mineT / 2 * 100) | 0}%"></div></div>`;
    }
    this.$('machStatus').innerHTML = statusHtml + recipeHtml;
    this.$('machStatus').querySelectorAll('[data-recipe]').forEach(el => {
      el.onmousedown = () => {
        m.recipe = el.dataset.recipe;
        m.progress = 0;
        Sfx.techClick();
        this.refresh();
      };
    });

    // 缓存/输出格
    const bufEl = this.$('machBuffer');
    let bh = '<div class="mach-sub">输入缓存</div><div class="buf-list">';
    const bufEntries = Object.entries(m.buffer);
    if (!bufEntries.length) bh += '<span class="tt-desc">（空）</span>';
    for (const [id, n] of bufEntries)
      bh += `<div class="buf-item" data-buf="${id}"><img draggable="false" src="${ICONS.get(id)}"><span class="cnt">${n}</span></div>`;
    bh += '</div><div class="mach-sub">输出缓存</div><div class="buf-list">';
    const outEntries = Object.entries(m.output);
    if (!outEntries.length) bh += '<span class="tt-desc">（空）</span>';
    for (const [id, n] of outEntries)
      bh += `<div class="buf-item" data-out="${id}"><img draggable="false" src="${ICONS.get(id)}"><span class="cnt">${n}</span></div>`;
    bh += '</div><div class="tt-hint" style="margin-top:6px">点击缓存图标取回物品</div>';
    bufEl.innerHTML = bh;
    bufEl.querySelectorAll('[data-buf]').forEach(el => {
      el.onmousedown = () => {
        const id = el.dataset.buf;
        const n = this.game.machines.bufTake(m.buffer, id, 999);
        this.game.addItem(id, n); Sfx.pop(); this.refresh();
      };
    });
    bufEl.querySelectorAll('[data-out]').forEach(el => {
      el.onmousedown = () => {
        const id = el.dataset.out;
        const n = this.game.machines.bufTake(m.output, id, 999);
        this.game.addItem(id, n);
        this.game.stats.obtained[id] = (this.game.stats.obtained[id] || 0) + 0; // 已在产出时统计
        Sfx.pop(); this.refresh();
      };
    });
  },

  // ============ 科技树 ============
  buildTechTree() { /* 打开时渲染 */ },
  renderTechTree() {
    const c = this.$('techNodes');
    let html = '';
    // 连线（SVG）
    let svg = '<svg id="techSvg">';
    const posOf = t => ({ x: 40 + TECHS[t].col * 170 + 70, y: 40 + TECHS[t].row * 130 + 45 });
    for (const [id, t] of Object.entries(TECHS)) {
      for (const req of t.requires) {
        const a = posOf(req), b = posOf(id);
        const done = this.game.stats.tech[req];
        svg += `<path d="M ${a.x + 60} ${a.y} C ${(a.x + b.x) / 2 + 30} ${a.y}, ${(a.x + b.x) / 2 - 90} ${b.y}, ${b.x - 62} ${b.y}"
          stroke="${done ? '#57e6ff' : '#33506a'}" stroke-width="2" fill="none" ${done ? '' : 'stroke-dasharray="6 4"'}/>`;
      }
    }
    svg += '</svg>';
    for (const [id, t] of Object.entries(TECHS)) {
      const done = this.game.stats.tech[id];
      const canDo = t.requires.every(r => this.game.stats.tech[r]);
      const researching = this.researching && this.researching.tech === id;
      let cls = done ? 'tech-done' : canDo ? 'tech-avail' : 'tech-locked';
      if (researching) cls += ' tech-active';
      html += `<div class="tech-node ${cls}" data-tech="${id}" style="left:${40 + t.col * 170}px;top:${40 + t.row * 130}px">
        <img draggable="false" src="${ICONS.get(t.icon)}">
        <div class="tech-name">${t.name}</div>
        ${researching ? `<div class="tech-prog"><div style="width:${(this.researching.t / t.time * 100) | 0}%"></div></div>` : ''}
        ${done ? '<div class="tech-check">✓</div>' : ''}
      </div>`;
    }
    c.innerHTML = svg + html;
    c.querySelectorAll('.tech-node').forEach(el => {
      const id = el.dataset.tech;
      el.onclick = () => { Sfx.techClick(); this.selectTech(id); };
    });
    if (this.selectedTech) this.renderTechDetail(this.selectedTech);
  },

  selectTech(id) {
    this.selectedTech = id;
    this.renderTechDetail(id);
  },

  renderTechDetail(id) {
    const t = TECHS[id];
    const el = this.$('techDetail');
    const done = this.game.stats.tech[id];
    const canDo = t.requires.every(r => this.game.stats.tech[r]);
    let html = `<h3>${t.name}</h3><p>${t.desc}</p>`;
    html += '<div class="tech-cost">';
    for (const [mid, n] of Object.entries(t.cost)) {
      const have = this.game.countItem(mid);
      html += `<div class="cost-item ${have >= n ? 'ok' : 'bad'}">
        <img draggable="false" src="${ICONS.get(mid)}"><span>${have}/${n}</span></div>`;
    }
    html += '</div>';
    if (t.unlocks.length) {
      html += '<div class="tech-unlocks">解锁：' + t.unlocks.map(u => `<img draggable="false" title="${itemName(u)}" src="${ICONS.get(u)}">`).join('') + '</div>';
    }
    if (done) html += '<div class="tech-donebadge">✓ 已研究</div>';
    else if (!canDo) html += '<div class="tt-warn">需要先研究前置科技</div>';
    else if (this.researching && this.researching.tech === id) html += `<button class="btn" id="techBtn" disabled>研究中… ${((this.researching.t / t.time) * 100) | 0}%</button>`;
    else {
      const afford = Object.entries(t.cost).every(([mid, n]) => this.game.countItem(mid) >= n);
      html += `<button class="btn ${afford ? '' : 'btn-dis'}" id="techBtn">${afford ? '开始研究 (' + t.time + 's)' : '材料不足'}</button>`;
    }
    el.innerHTML = html;
    const btn = this.$('techBtn');
    if (btn && !btn.disabled) {
      btn.onclick = () => {
        if (this.game.stats.tech[id] || !canDo) return;
        const afford = Object.entries(t.cost).every(([mid, n]) => this.game.countItem(mid) >= n);
        if (!afford) { Sfx.error(); return; }
        for (const [mid, n] of Object.entries(t.cost)) this.game.removeItem(mid, n);
        this.researching = { tech: id, t: 0 };
        Sfx.techClick();
        this.renderTechTree();
      };
    }
  },

  tickResearch(dt) {
    if (!this.researching) return;
    this.researching.t += dt;
    const t = TECHS[this.researching.tech];
    if (this.researching.t >= t.time) {
      this.game.stats.tech[this.researching.tech] = true;
      const name = t.name;
      this.researching = null;
      Sfx.research();
      this.toast(`⚡ 科技完成：${name}`, 'toast-tech');
      if (this.openPanel === 'tech') this.renderTechTree();
    } else if (this.openPanel === 'tech' && (this._techRefresh = (this._techRefresh || 0) + dt) > 0.2) {
      this._techRefresh = 0;
      this.renderTechTree();
    }
  },

  // ============ 任务引导 ============
  buildQuestPanel() { this.questIdx = 0; this.renderQuest(); },
  renderQuest() {
    const done = [];
    let current = null;
    for (const q of QUESTS) {
      if (q.check(this.game.stats)) done.push(q.id);
      else if (!current) current = q;
    }
    const el = this.$('questPanel');
    if (!current) {
      el.innerHTML = `<div class="q-title">🏆 全部完成！</div><div class="q-desc">你已建成戴森球！</div>`;
      return;
    }
    const idx = QUESTS.indexOf(current);
    let html = `<div class="q-head">任务 ${idx + 1}/${QUESTS.length}</div>`;
    if (idx > 0) html += `<div class="q-prev">✓ ${QUESTS[idx - 1].name}</div>`;
    html += `<div class="q-title">${current.name}</div><div class="q-desc">${current.desc}</div>`;
    if (current.hint) html += `<div class="q-hint">💡 ${current.hint}</div>`;
    el.innerHTML = html;
    if (this.lastQuest && this.lastQuest !== current.id) {
      Sfx.levelup();
      this.toast(`✓ 任务完成：${QUESTS[idx - 1] ? QUESTS[idx - 1].name : ''}`, 'toast-quest');
      el.classList.remove('q-flash'); void el.offsetWidth; el.classList.add('q-flash');
    }
    this.lastQuest = current.id;
  },

  // ============ HUD ============
  updateHealth() {
    const el = this.$('hearts');
    const hp = this.game ? this.game.player.health : 20;
    let html = '';
    for (let i = 0; i < 10; i++) {
      const full = hp >= (i + 1) * 2, half = !full && hp >= i * 2 + 1;
      html += `<span class="heart ${full ? 'h-full' : half ? 'h-half' : 'h-empty'}"></span>`;
    }
    el.innerHTML = html;
  },

  updatePowerHUD() {
    const ms = this.game.machines;
    const el = this.$('powerHud');
    if (ms.powerGen === 0 && ms.powerUse === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const sat = ms.powerSat;
    const cls = sat >= 0.999 ? 'ok' : sat > 0.5 ? 'warn' : 'bad';
    el.innerHTML = `<span class="p-ico">⚡</span> <b class="${cls}">${ms.powerUse}</b> / ${ms.powerGen} kW
      <div class="p-bar"><div class="p-fill ${cls}" style="width:${Math.min(100, ms.powerGen ? ms.powerUse / ms.powerGen * 100 : 100)}%"></div></div>`;
  },

  updateDysonHUD() {
    const d = this.game.dyson;
    const el = this.$('dysonHud');
    if (d.progress <= 0 && !this.game.stats.tech.solar_sail_tech) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<span class="p-ico">☀</span> 戴森球 <b class="ok">${d.progress}</b>/${d.goal}
      <div class="p-bar"><div class="p-fill dyson" style="width:${Math.min(100, d.progress / d.goal * 100)}%"></div></div>`;
  },

  flashHurt() {
    const el = this.$('hurtFlash');
    el.style.opacity = 0.45;
    setTimeout(() => el.style.opacity = 0, 120);
  },

  showDeath() {
    document.exitPointerLock();
    this.$('deathPanel').style.display = 'flex';
  },

  toast(text, cls) {
    const box = this.$('toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + (cls || '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(() => { d.classList.add('toast-out'); setTimeout(() => d.remove(), 500); }, 3200);
  },

  showVictory() {
    this.$('victoryPanel').style.display = 'flex';
    document.exitPointerLock();
    Sfx.victory();
  },
};
