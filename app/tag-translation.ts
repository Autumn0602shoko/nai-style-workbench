const exactTranslations: Record<string, string> = {
  "1girl": "1名女性",
  "1boy": "1名男性",
  solo: "单人",
  "hina (blue archive)": "空崎日奈（蔚蓝档案）",
  "demon horns": "恶魔角",
  "demon wings": "恶魔翅膀",
  "demon girl": "恶魔女孩",
  "multiple horns": "多只角",
  "very long hair": "超长发",
  "long hair": "长发",
  "short hair": "短发",
  "parted bangs": "中分刘海",
  ahoge: "呆毛",
  "small breasts": "小胸部",
  "large breasts": "大胸部",
  "looking at viewer": "看向观众",
  "from above": "俯视",
  "from below": "仰视",
  "upper body": "上半身",
  "full body": "全身",
  "cowboy shot": "牛仔镜头",
  "bare shoulders": "露肩",
  "open mouth": "张嘴",
  "closed mouth": "闭嘴",
  "one eye closed": "单眼闭合",
  "hair between eyes": "发丝垂于双眼之间",
  sidelocks: "鬓发",
  hairclip: "发夹",
  halo: "光环",
  forehead: "额头",
  "hair ornament": "发饰",
  "eyebrows visible through hair": "透过头发可见眉毛",
  "covered forehead": "遮住额头",
  "parted lips": "嘴唇微张",
  "closed eyes": "闭眼",
  earrings: "耳环",
  necklace: "项链",
  glasses: "眼镜",
  masterpiece: "杰作",
  "best quality": "最佳质量",
  "very aesthetic": "高审美",
};

const tokenTranslations: Record<string, string> = {
  black: "黑色", white: "白色", purple: "紫色", blue: "蓝色", red: "红色", pink: "粉色", green: "绿色",
  grey: "灰色", gray: "灰色", silver: "银色", brown: "棕色", blonde: "金色", yellow: "黄色", orange: "橙色", aqua: "水蓝色",
  hair: "头发", eyes: "眼睛", horns: "角", wings: "翅膀", dress: "连衣裙", skirt: "裙子", shirt: "衬衫", gloves: "手套",
  thighhighs: "过膝袜", stockings: "长袜", shoes: "鞋", boots: "靴子", ribbon: "丝带", choker: "颈饰", jacket: "夹克", uniform: "制服",
  demon: "恶魔", girl: "女孩", boy: "男孩", female: "女性", male: "男性", animal: "动物", cat: "猫", fox: "狐狸", dog: "狗", ears: "耳朵", tail: "尾巴", fang: "虎牙",
  sidelocks: "鬓发", hairclip: "发夹", halo: "光环", forehead: "额头", eyebrows: "眉毛", eyelashes: "睫毛", lips: "嘴唇", mouth: "嘴", teeth: "牙齿",
  earrings: "耳环", necklace: "项链", glasses: "眼镜", headwear: "头饰", ornament: "饰品", makeup: "妆容", mole: "痣", freckles: "雀斑",
  neck: "颈部", shoulders: "肩膀", arms: "手臂", hands: "手", fingers: "手指", waist: "腰部", hips: "臀部", thighs: "大腿", knees: "膝盖", feet: "脚",
  smile: "微笑", blush: "脸红", standing: "站立", sitting: "坐姿", lying: "躺卧", holding: "拿着", sleeping: "睡觉", looking: "看向", viewer: "观众",
  small: "小", large: "大", breasts: "胸部", multiple: "多个", long: "长", short: "短", very: "超", open: "张开", closed: "闭合",
  indoors: "室内", outdoors: "室外", city: "城市", street: "街道", room: "房间", beach: "海滩", forest: "森林", night: "夜晚", sunset: "日落",
};

export const normalizeTranslationKey = (value: string) => value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
export const getBuiltInTranslationCount = () => Object.keys(exactTranslations).length + Object.keys(tokenTranslations).length;

/** Translate common Danbooru tags locally while keeping the original English tag untouched. */
export function translateDanbooruTag(value: string, customTranslations: Record<string, string> = {}): string | null {
  const normalized = normalizeTranslationKey(value);
  if (!normalized) return null;
  if (customTranslations[normalized]?.trim()) return customTranslations[normalized].trim();
  if (exactTranslations[normalized]) return exactTranslations[normalized];
  const tokens = normalized.split(" ");
  if (tokens.every((token) => tokenTranslations[token])) return tokens.map((token) => tokenTranslations[token]).join("");
  const character = normalized.match(/^(.+?) \((.+?)\)$/);
  if (character) return `${character[1]}（${character[2]}）`;
  return null;
}
