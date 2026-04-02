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

export interface MappingNode {
  id: string;
  sourceId: string;
  sourceLabel: string;
  transform: string;
  children: MappingNode[];
}

export interface ExcelRow {
  DataList: string[];
  Index: number;
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
