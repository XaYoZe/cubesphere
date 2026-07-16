// ============ 方块定义 ============
'use strict';

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, WATER: 6,
  LOG: 7, LEAVES: 8, PLANKS: 9, COAL_ORE: 10, IRON_ORE: 11, COPPER_ORE: 12,
  BEDROCK: 13, GLASS: 14, STONE_BRICK: 15, CRAFTING: 16, FURNACE: 17,
  CHEST: 18, GRAVEL: 19, MACHINE: 20, TORCH: 21, SAPLING: 22,
};

// tex: [top, bottom, north, south, east, west] 图集索引
const BLOCKS = {
  [B.AIR]:      { name: '空气', solid: false, tex: null },
  [B.GRASS]:    { name: '草方块', solid: true, tex: [0, 2, 1, 1, 1, 1], hardness: 0.9, tool: 'shovel', drop: 'dirt', sound: 'grass' },
  [B.DIRT]:     { name: '泥土', solid: true, tex: [2, 2, 2, 2, 2, 2], hardness: 0.75, tool: 'shovel', drop: 'dirt', sound: 'grass' },
  [B.STONE]:    { name: '石头', solid: true, tex: [3, 3, 3, 3, 3, 3], hardness: 2.5, tool: 'pickaxe', tier: 1, drop: 'cobble', sound: 'stone' },
  [B.COBBLE]:   { name: '圆石', solid: true, tex: [4, 4, 4, 4, 4, 4], hardness: 3.0, tool: 'pickaxe', tier: 1, drop: 'cobble', sound: 'stone' },
  [B.SAND]:     { name: '沙子', solid: true, tex: [5, 5, 5, 5, 5, 5], hardness: 0.75, tool: 'shovel', drop: 'sand', sound: 'sand' },
  [B.WATER]:    { name: '水', solid: false, liquid: true, transparent: true, tex: [6, 6, 6, 6, 6, 6] },
  [B.LOG]:      { name: '橡木原木', solid: true, tex: [8, 8, 7, 7, 7, 7], hardness: 3.0, tool: 'axe', drop: 'log', sound: 'wood' },
  [B.LEAVES]:   { name: '橡树树叶', solid: true, transparent: true, tex: [9, 9, 9, 9, 9, 9], hardness: 0.35, drop: null, dropChance: { sapling: 0.08, apple: 0.04 }, sound: 'grass' },
  [B.PLANKS]:   { name: '橡木木板', solid: true, tex: [10, 10, 10, 10, 10, 10], hardness: 3.0, tool: 'axe', drop: 'planks', sound: 'wood' },
  [B.COAL_ORE]: { name: '煤矿石', solid: true, tex: [11, 11, 11, 11, 11, 11], hardness: 4.5, tool: 'pickaxe', tier: 1, drop: 'coal', sound: 'stone', ore: 'coal' },
  [B.IRON_ORE]: { name: '铁矿石', solid: true, tex: [12, 12, 12, 12, 12, 12], hardness: 4.5, tool: 'pickaxe', tier: 2, drop: 'iron_ore', sound: 'stone', ore: 'iron_ore' },
  [B.COPPER_ORE]:{ name: '铜矿石', solid: true, tex: [13, 13, 13, 13, 13, 13], hardness: 4.5, tool: 'pickaxe', tier: 2, drop: 'copper_ore', sound: 'stone', ore: 'copper_ore' },
  [B.BEDROCK]:  { name: '基岩', solid: true, tex: [14, 14, 14, 14, 14, 14], hardness: -1, sound: 'stone' },
  [B.GLASS]:    { name: '玻璃', solid: true, transparent: true, tex: [15, 15, 15, 15, 15, 15], hardness: 0.45, drop: null, sound: 'stone' },
  [B.STONE_BRICK]:{ name: '石砖', solid: true, tex: [16, 16, 16, 16, 16, 16], hardness: 3.0, tool: 'pickaxe', tier: 1, drop: 'stone_brick', sound: 'stone' },
  [B.CRAFTING]: { name: '工作台', solid: true, tex: [17, 10, 18, 18, 19, 19], hardness: 3.0, tool: 'axe', drop: 'crafting', sound: 'wood', interact: 'crafting' },
  [B.FURNACE]:  { name: '熔炉', solid: true, tex: [21, 21, 22, 20, 22, 22], hardness: 4.5, tool: 'pickaxe', tier: 1, drop: 'furnace', sound: 'stone', interact: 'furnace' },
  [B.CHEST]:    { name: '箱子', solid: true, tex: [24, 24, 25, 23, 25, 25], hardness: 3.0, tool: 'axe', drop: 'chest', sound: 'wood', interact: 'chest' },
  [B.GRAVEL]:   { name: '沙砾', solid: true, tex: [26, 26, 26, 26, 26, 26], hardness: 0.9, tool: 'shovel', drop: 'gravel', sound: 'sand' },
  [B.MACHINE]:  { name: '机器', solid: true, tex: [27, 27, 27, 27, 27, 27], hardness: 3.0, tool: 'pickaxe', drop: null, sound: 'metal' },
  [B.TORCH]:    { name: '火把', solid: false, transparent: true, tex: [28, 28, 28, 28, 28, 28], hardness: 0.1, drop: 'torch', sound: 'wood', nonCube: true },
  [B.SAPLING]:  { name: '橡树树苗', solid: false, transparent: true, tex: [29, 29, 29, 29, 29, 29], hardness: 0.1, drop: 'sapling', sound: 'grass', nonCube: true },
};

function blockInfo(id) { return BLOCKS[id] || BLOCKS[B.AIR]; }
function isSolid(id) { return !!(BLOCKS[id] && BLOCKS[id].solid); }
function isOpaqueBlock(id) {
  const b = BLOCKS[id];
  return !!(b && b.solid && !b.transparent && !b.nonCube);
}
