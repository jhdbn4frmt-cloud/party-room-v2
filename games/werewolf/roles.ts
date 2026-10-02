export const roles = [
  {
    id: "wolf",
    name: "狼人",
    faction: "wolves",
    description: "夜晚依主持指示選擇襲擊目標。",
    ability: "attack",
  },
  {
    id: "villager",
    name: "村民",
    faction: "village",
    description: "白天討論，投票找出狼人。",
    ability: "none",
  },
  {
    id: "seer",
    name: "預言家",
    faction: "village",
    description: "每夜可查驗一位玩家是否為狼人。",
    ability: "inspect",
  },
  {
    id: "witch",
    name: "女巫",
    faction: "village",
    description: "整局一瓶解藥、一瓶毒藥；由主持人記錄使用。",
    ability: "potions",
  },
  {
    id: "hunter",
    name: "獵人",
    faction: "village",
    description: "出局後依主持人採用的規則開槍帶走一人。",
    ability: "shoot",
  },
];
export const phaseOrder = ["night", "day", "vote"] as const;
