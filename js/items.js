// ============ 物品 / 配方 / 科技树 ============
'use strict';

const ITEMS = {
  // 方块物品
  grass:        { name: '草方块', block: B.GRASS, stack: 64 },
  dirt:         { name: '泥土', block: B.DIRT, stack: 64 },
  stone:        { name: '石头', block: B.STONE, stack: 64 },
  cobble:       { name: '圆石', block: B.COBBLE, stack: 64 },
  sand:         { name: '沙子', block: B.SAND, stack: 64 },
  gravel:       { name: '沙砾', block: B.GRAVEL, stack: 64 },
  log:          { name: '橡木原木', block: B.LOG, stack: 64, fuel: 15 },
  planks:       { name: '橡木木板', block: B.PLANKS, stack: 64, fuel: 15 },
  leaves:       { name: '橡树树叶', block: B.LEAVES, stack: 64 },
  glass:        { name: '玻璃', block: B.GLASS, stack: 64 },
  stone_brick:  { name: '石砖', block: B.STONE_BRICK, stack: 64 },
  crafting:     { name: '工作台', block: B.CRAFTING, stack: 64, desc: '3×3 合成' },
  furnace:      { name: '熔炉', block: B.FURNACE, stack: 64, desc: '烧炼矿石（需燃料）' },
  chest:        { name: '箱子', block: B.CHEST, stack: 64, desc: '27 格存储，可与机器联动' },
  torch:        { name: '火把', block: B.TORCH, stack: 64, desc: '照亮黑夜' },
  // 材料
  stick:        { name: '木棍', stack: 64, fuel: 5 },
  coal:         { name: '煤炭', stack: 64, fuel: 80 },
  iron_ore:     { name: '铁矿石', stack: 64, desc: '可烧炼成铁锭' },
  copper_ore:   { name: '铜矿石', stack: 64, desc: '可烧炼成铜锭' },
  iron_ingot:   { name: '铁锭', stack: 64 },
  copper_ingot: { name: '铜锭', stack: 64 },
  magnet:       { name: '磁铁', stack: 64, desc: '电磁工业的基础' },
  gear:         { name: '齿轮', stack: 64 },
  circuit:      { name: '电路板', stack: 64 },
  coil:         { name: '磁线圈', stack: 64 },
  matrix:       { name: '电磁矩阵', stack: 64, desc: '蓝色科学的结晶，用于研究科技' },
  solar_sail:   { name: '太阳帆', stack: 64, desc: '发射到恒星轨道，构筑戴森云' },
  apple:        { name: '苹果', stack: 64, food: 4 },
  sapling:      { name: '橡树树苗', block: B.SAPLING, stack: 64, desc: '种在草地或泥土上，片刻后长成大树' },
  // 工具
  wood_pickaxe: { name: '木镐', stack: 1, tool: 'pickaxe', tier: 1, speed: 2, durability: 60 },
  stone_pickaxe:{ name: '石镐', stack: 1, tool: 'pickaxe', tier: 2, speed: 4, durability: 132 },
  iron_pickaxe: { name: '铁镐', stack: 1, tool: 'pickaxe', tier: 3, speed: 6, durability: 251 },
  wood_axe:     { name: '木斧', stack: 1, tool: 'axe', tier: 1, speed: 2, durability: 60 },
  stone_axe:    { name: '石斧', stack: 1, tool: 'axe', tier: 2, speed: 4, durability: 132 },
  iron_axe:     { name: '铁斧', stack: 1, tool: 'axe', tier: 3, speed: 6, durability: 251 },
  wood_shovel:  { name: '木锹', stack: 1, tool: 'shovel', tier: 1, speed: 2, durability: 60 },
  stone_shovel: { name: '石锹', stack: 1, tool: 'shovel', tier: 2, speed: 4, durability: 132 },
  iron_shovel:  { name: '铁锹', stack: 1, tool: 'shovel', tier: 3, speed: 6, durability: 251 },
  // 机器（戴森球侧）
  wind_turbine: { name: '风力涡轮机', stack: 16, machine: 'wind_turbine', tech: 'electromagnetism', desc: '发电 300kW · 供给全局电网' },
  miner:        { name: '采矿机', stack: 16, machine: 'miner', tech: 'electromagnetism', desc: '放置于矿石上方 · 自动开采下方 3×3 矿脉' },
  smelter:      { name: '电弧熔炉', stack: 16, machine: 'smelter', tech: 'smelting', desc: '电力驱动 · 自动烧炼（可选配方）' },
  belt:         { name: '传送带', stack: 64, machine: 'belt', tech: 'logistics', desc: '沿放置朝向输送物品' },
  assembler:    { name: '制造台 Mk.I', stack: 16, machine: 'assembler', tech: 'manufacturing', desc: '自动合成部件（可选配方）' },
  lab:          { name: '矩阵研究站', stack: 16, machine: 'lab', tech: 'em_matrix', desc: '自动合成电磁矩阵' },
  ejector:      { name: '电磁弹射器', stack: 8, machine: 'ejector', tech: 'solar_sail_tech', desc: '将太阳帆射入恒星轨道' },
};

function itemName(id) { return ITEMS[id] ? ITEMS[id].name : id; }

// ============ 网格合成配方（工作台 / 背包 2×2） ============
// pattern: 字符网格; key: 字符→物品
const RECIPES = [
  { out: 'planks', count: 4, shapeless: ['log'] },
  { out: 'stick', count: 4, pattern: ['P', 'P'], key: { P: 'planks' } },
  { out: 'crafting', count: 1, pattern: ['PP', 'PP'], key: { P: 'planks' } },
  { out: 'torch', count: 4, pattern: ['C', 'S'], key: { C: 'coal', S: 'stick' } },
  { out: 'chest', count: 1, pattern: ['PPP', 'P P', 'PPP'], key: { P: 'planks' } },
  { out: 'furnace', count: 1, pattern: ['CCC', 'C C', 'CCC'], key: { C: 'cobble' } },
  { out: 'stone_brick', count: 4, pattern: ['SS', 'SS'], key: { S: 'stone' } },
  { out: 'wood_pickaxe', count: 1, pattern: ['PPP', ' S ', ' S '], key: { P: 'planks', S: 'stick' } },
  { out: 'stone_pickaxe', count: 1, pattern: ['CCC', ' S ', ' S '], key: { C: 'cobble', S: 'stick' } },
  { out: 'iron_pickaxe', count: 1, pattern: ['III', ' S ', ' S '], key: { I: 'iron_ingot', S: 'stick' } },
  { out: 'wood_axe', count: 1, pattern: ['PP', 'PS', ' S'], key: { P: 'planks', S: 'stick' } },
  { out: 'stone_axe', count: 1, pattern: ['CC', 'CS', ' S'], key: { C: 'cobble', S: 'stick' } },
  { out: 'iron_axe', count: 1, pattern: ['II', 'IS', ' S'], key: { I: 'iron_ingot', S: 'stick' } },
  { out: 'wood_shovel', count: 1, pattern: ['P', 'S', 'S'], key: { P: 'planks', S: 'stick' } },
  { out: 'stone_shovel', count: 1, pattern: ['C', 'S', 'S'], key: { C: 'cobble', S: 'stick' } },
  { out: 'iron_shovel', count: 1, pattern: ['I', 'S', 'S'], key: { I: 'iron_ingot', S: 'stick' } },
  // ---- 戴森球工业部件 ----
  { out: 'magnet', count: 1, shapeless: ['iron_ingot', 'iron_ingot'], desc: '磁化铁锭' },
  { out: 'gear', count: 1, shapeless: ['iron_ingot'] },
  { out: 'coil', count: 2, shapeless: ['magnet', 'magnet', 'copper_ingot'] },
  { out: 'circuit', count: 2, shapeless: ['iron_ingot', 'iron_ingot', 'copper_ingot'] },
  { out: 'matrix', count: 1, shapeless: ['coil', 'circuit'], tech: 'em_matrix' },
  { out: 'solar_sail', count: 1, shapeless: ['glass', 'glass', 'glass', 'circuit', 'coil'], tech: 'solar_sail_tech' },
  // ---- 机器 ----
  { out: 'wind_turbine', count: 1, pattern: [' G ', 'LIL', ' I '], key: { G: 'gear', L: 'coil', I: 'iron_ingot' }, tech: 'electromagnetism' },
  { out: 'miner', count: 1, pattern: ['CLC', 'GIG', 'I I'], key: { C: 'circuit', L: 'coil', G: 'gear', I: 'iron_ingot' }, tech: 'electromagnetism' },
  { out: 'smelter', count: 1, pattern: ['CLC', 'IBI', 'BCB'], key: { C: 'circuit', L: 'coil', I: 'iron_ingot', B: 'stone_brick' }, tech: 'smelting' },
  { out: 'belt', count: 4, pattern: ['III', ' G '], key: { I: 'iron_ingot', G: 'gear' }, tech: 'logistics' },
  { out: 'assembler', count: 1, pattern: ['GCG', 'CIC', 'GCG'], key: { G: 'gear', C: 'circuit', I: 'iron_ingot' }, tech: 'manufacturing' },
  { out: 'lab', count: 1, pattern: ['GLG', 'CIC', 'III'], key: { G: 'glass', L: 'coil', C: 'circuit', I: 'iron_ingot' }, tech: 'em_matrix' },
  { out: 'ejector', count: 1, pattern: ['CIL', 'GII', 'III'], key: { C: 'circuit', I: 'iron_ingot', L: 'coil', G: 'gear' }, tech: 'solar_sail_tech' },
];

// ============ 熔炉烧炼配方 ============
const SMELT_RECIPES = {
  iron_ore: 'iron_ingot',
  copper_ore: 'copper_ingot',
  sand: 'glass',
  cobble: 'stone',
  log: 'coal',
};

// ============ 电弧熔炉（机器）配方 ============
const MACHINE_SMELT = [
  { id: 'iron_ingot', in: { iron_ore: 1 }, out: { iron_ingot: 1 }, time: 2 },
  { id: 'copper_ingot', in: { copper_ore: 1 }, out: { copper_ingot: 1 }, time: 2 },
  { id: 'magnet', in: { iron_ore: 1 }, out: { magnet: 1 }, time: 3 },
  { id: 'glass', in: { sand: 2 }, out: { glass: 2 }, time: 3 },
  { id: 'stone', in: { cobble: 1 }, out: { stone: 1 }, time: 2 },
];

// ============ 制造台配方 ============
const MACHINE_ASSEMBLE = [
  { id: 'gear', in: { iron_ingot: 1 }, out: { gear: 1 }, time: 2 },
  { id: 'coil', in: { magnet: 2, copper_ingot: 1 }, out: { coil: 2 }, time: 2 },
  { id: 'circuit', in: { iron_ingot: 2, copper_ingot: 1 }, out: { circuit: 2 }, time: 2 },
  { id: 'matrix', in: { coil: 1, circuit: 1 }, out: { matrix: 1 }, time: 4, tech: 'em_matrix' },
  { id: 'solar_sail', in: { glass: 3, circuit: 1, coil: 1 }, out: { solar_sail: 1 }, time: 6, tech: 'solar_sail_tech' },
];

// ============ 科技树（戴森球风格） ============
const TECHS = {
  electromagnetism: {
    name: '电磁学', icon: 'coil', col: 0, row: 1,
    cost: { iron_ingot: 10, copper_ingot: 5 },
    time: 6, requires: [],
    unlocks: ['wind_turbine', 'miner'],
    desc: '掌握电与磁的奥秘。解锁：风力涡轮机、采矿机、磁铁/磁线圈制作。',
  },
  smelting: {
    name: '自动冶金', icon: 'smelter', col: 1, row: 0,
    cost: { iron_ingot: 20, magnet: 6 },
    time: 8, requires: ['electromagnetism'],
    unlocks: ['smelter'],
    desc: '电弧高温冶炼技术。解锁：电弧熔炉（自动烧炼）。',
  },
  logistics: {
    name: '基础物流系统', icon: 'belt', col: 1, row: 2,
    cost: { iron_ingot: 15, gear: 8 },
    time: 8, requires: ['electromagnetism'],
    unlocks: ['belt'],
    desc: '让物质流动起来。解锁：传送带（与机器/箱子自动衔接）。',
  },
  manufacturing: {
    name: '基础制造工艺', icon: 'assembler', col: 2, row: 1,
    cost: { gear: 10, circuit: 6 },
    time: 10, requires: ['smelting', 'logistics'],
    unlocks: ['assembler'],
    desc: '自动化生产的开端。解锁：制造台 Mk.I。',
  },
  em_matrix: {
    name: '电磁矩阵', icon: 'matrix', col: 3, row: 1,
    cost: { coil: 10, circuit: 10 },
    time: 12, requires: ['manufacturing'],
    unlocks: ['lab', 'matrix'],
    desc: '将知识凝聚为蓝色立方。解锁：矩阵研究站、电磁矩阵配方。',
  },
  solar_sail_tech: {
    name: '太阳帆', icon: 'solar_sail', col: 4, row: 0,
    cost: { matrix: 15 },
    time: 15, requires: ['em_matrix'],
    unlocks: ['solar_sail', 'ejector'],
    desc: '轻若蝉翼的能量之帆。解锁：太阳帆、电磁弹射器。',
  },
  dyson_program: {
    name: '戴森球计划', icon: 'matrix', col: 5, row: 1,
    cost: { matrix: 30, solar_sail: 10 },
    time: 20, requires: ['solar_sail_tech'],
    unlocks: [],
    desc: '终极工程：环绕恒星的能量之壳。发射 100 张太阳帆即可完成戴森球！',
  },
};

// ============ 任务引导（前期流程 1:1） ============
const QUESTS = [
  { id: 'q_log', name: '伐木工', desc: '徒手砍伐 3 个原木', check: s => s.mined.log >= 3, hint: '按住左键攻击树干' },
  { id: 'q_planks', name: '木材加工', desc: '合成木板与木棍', check: s => s.crafted.planks >= 1 && s.crafted.stick >= 1, hint: '按 E 打开背包，使用 2×2 合成格' },
  { id: 'q_table', name: '工作台', desc: '合成并放置工作台', check: s => s.placed.crafting >= 1 },
  { id: 'q_wpick', name: '第一把镐', desc: '合成木镐', check: s => s.crafted.wood_pickaxe >= 1, hint: '右键点击工作台使用 3×3 合成' },
  { id: 'q_stone', name: '石器时代', desc: '挖掘 8 个圆石并合成石镐', check: s => s.crafted.stone_pickaxe >= 1 },
  { id: 'q_furnace', name: '烈火熔炉', desc: '合成并放置熔炉', check: s => s.placed.furnace >= 1 },
  { id: 'q_coal', name: '黑色燃料', desc: '挖到 3 个煤炭', check: s => s.mined.coal >= 3, hint: '石头层中的黑色斑点矿石' },
  { id: 'q_iron', name: '钢铁序曲', desc: '烧炼出 5 个铁锭', check: s => s.smelted.iron_ingot >= 5, hint: '铁矿石需要石镐开采' },
  { id: 'q_em', name: '电磁学', desc: '在科技面板（T）研究「电磁学」', check: s => s.tech.electromagnetism },
  { id: 'q_power', name: '第一度电', desc: '放置风力涡轮机', check: s => s.placed.wind_turbine >= 1 },
  { id: 'q_miner', name: '自动采矿', desc: '将采矿机放在矿石上方', check: s => s.placed.miner >= 1 },
  { id: 'q_smelter', name: '电弧冶炼', desc: '研究自动冶金并放置电弧熔炉', check: s => s.placed.smelter >= 1 },
  { id: 'q_belt', name: '物流动脉', desc: '铺设 5 段传送带', check: s => s.placed.belt >= 5, hint: '传送带朝向 = 放置时你的朝向' },
  { id: 'q_asm', name: '万物制造', desc: '放置制造台并选择配方', check: s => s.placed.assembler >= 1 },
  { id: 'q_matrix', name: '蓝色方糖', desc: '获得 10 个电磁矩阵', check: s => s.obtained.matrix >= 10 },
  { id: 'q_sail', name: '扬帆起航', desc: '制作 5 张太阳帆', check: s => s.obtained.solar_sail >= 5 },
  { id: 'q_eject', name: '射向太阳', desc: '用电磁弹射器发射太阳帆', check: s => s.sailsLaunched >= 1, hint: '弹射器需通电并装填太阳帆' },
  { id: 'q_dyson', name: '戴森球！', desc: '发射 100 张太阳帆，完成戴森球', check: s => s.sailsLaunched >= 100 },
];
