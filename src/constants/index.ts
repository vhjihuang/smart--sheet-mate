import type { SlotConfig, TransformStep } from "@/types";

export const MAX_NEST_LEVEL = 3;

// 默认聚合配置：空连接符
export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  type: 'JOIN',
  separator: '',
};

// 预设教师常用转换逻辑
export const TEACHER_PRESETS: { label: string; steps: TransformStep[] }[] = [
  {
    label: "姓名脱敏 (*)",
    steps: [
      { type: 'CROP', params: { start: 0, length: 1 } },
      { type: 'SUFFIX', params: { text: "*" } },
    ],
  },
  {
    label: "身份证号脱敏 (中段)",
    steps: [
      { type: 'ID_MASK', params: { keepStart: 6, keepEnd: 4 } },
    ],
  },
  {
    label: "成绩转等级 (A/B/C/D)",
    steps: [
      { type: 'SCORE_GRADE', params: { 
        rules: [
          { min: 90, grade: 'A' },
          { min: 80, grade: 'B' },
          { min: 60, grade: 'C' },
          { min: 0, grade: 'D' },
        ] 
      } },
    ],
  },
  {
    label: "学籍号加G前缀",
    steps: [
      { type: 'PREFIX', params: { text: "G" } },
    ],
  },
  {
    label: "数据清洗 (去空格+大写)",
    steps: [
      { type: 'TRIM', params: {} },
      { type: 'UPPER', params: {} },
    ],
  },
];

export const CROP_SHORTCUTS = [
  { label: "生日 (7-14位)", start: 6, length: 8 },
  { label: "性别 (17位)", start: 16, length: 1 },
  { label: "区划 (1-6位)", start: 0, length: 6 },
];
