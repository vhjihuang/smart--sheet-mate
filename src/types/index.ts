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
