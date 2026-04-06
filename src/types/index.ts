export interface TargetColumn {
  id: string;
  label: string;
  children?: TargetColumn[];
  isGroup?: boolean;
}

export interface SourceColumn {
  id: string;
  label: string;
}

// 转换步骤定义
export type TransformType = 
  | 'TRIM'           // 去空格
  | 'UPPER'          // 转大写
  | 'LOWER'          // 转小写
  | 'CROP'           // 裁剪/截取
  | 'REPLACE'        // 替换
  | 'PREFIX'         // 加前缀
  | 'SUFFIX'         // 加后缀
  | 'DATE_FORMAT'    // 日期格式化
  | 'SCORE_GRADE'    // 成绩分级 (基础教育常用)
  | 'ID_MASK'        // 证件脱敏 (保护学生隐私)
  | 'CUSTOM';        // 自定义转换

export interface TransformStep {
  type: TransformType;
  params: Record<string, any>;
}

// 插槽聚合配置 (多对一映射)
export interface SlotConfig {
  type: 'JOIN' | 'SUM' | 'CUSTOM';
  separator?: string; // 只有 JOIN 类型需要
  customCode?: string;
}

export interface MappingNode {
  id: string;
  sourceId: string;
  sourceLabel: string;
  steps: TransformStep[]; // 从单一 transform 升级为流水线 steps
  forceText?: boolean;    // 【物理硬化】开关：强制该列在写入 Excel 时设为文本格式 (@)
  children: MappingNode[]; // 保留嵌套逻辑
}

// 对应用户提出的最终生成协议
export interface TransformRule {
  targetColId: string;     // 目标列 ID
  targetName: string;      // 目标列名
  mappings: MappingNode[]; // 该列下的所有源字段映射 (支持多对一)
  slotConfig: SlotConfig;  // 该插槽的合并/自定义逻辑
  forceText: boolean;      // 深度锁定格式开关
}

export interface ExcelRow {
  DataList: string[];
  Index: number;
}

// 预览数据结果
export interface PreviewData {
  columnId: string;
  results: string[]; // 对应前几行数据的处理结果
}

// 模板数据类型（后端返回格式）
export interface TemplateCell {
  D: string;  // 数据值
  I: number;  // 列索引
}

export interface TemplateRow {
  I: number;  // 行索引
  R: TemplateCell[];  // 行数据数组
}

export interface TemplateSheet {
  Count_Columns: number;
  Count_Lines: number;
  Rows: TemplateRow[];
}

export interface TemplateResponse {
  LoadStatus: number;
  FilePath: string;
  Message: string;
  Template?: {
    Code: string;
    FilePath: string;
    Sheets: TemplateSheet[];
  };
}

export interface ExportResponse {
  Status: number;
  Message: string;
  FilePath?: string;
}
