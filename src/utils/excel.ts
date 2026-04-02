import type { TargetColumn, SourceColumn, ExcelRow } from "@/types";
import type { MappingNode } from "@/types";

// 获取所有叶子列（可放置的列）
export const getLeafColumns = (columns: TargetColumn[]): TargetColumn[] => {
  const result: TargetColumn[] = [];
  const traverse = (cols: TargetColumn[]) => {
    for (const col of cols) {
      if (col.children && col.children.length > 0) {
        traverse(col.children);
      } else {
        result.push(col);
      }
    }
  };
  traverse(columns);
  return result;
};

// 计算列的深度
export const getColumnDepth = (column: TargetColumn): number => {
  if (!column.children || column.children.length === 0) return 1;
  return Math.max(...column.children.map(getColumnDepth)) + 1;
};

// 计算最大深度
export const getMaxDepth = (columns: TargetColumn[]): number => {
  if (columns.length === 0) return 0;
  return Math.max(...columns.map(getColumnDepth));
};

// 计算列的跨度（叶子节点数量）
export const getColumnSpan = (column: TargetColumn): number => {
  if (!column.children || column.children.length === 0) return 1;
  return column.children.reduce((sum, child) => sum + getColumnSpan(child), 0);
};

export const generateId = () => `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// 按范围解析表头为扁平 SourceColumn 列表
export const parseSourceColumns = (
  rowsData: ExcelRow[],
  start: number,
  end: number
): SourceColumn[] => {
  if (!rowsData || rowsData.length === 0) return [];
  
  const headerRows = rowsData.slice(start, end + 1);
  const colCount = Math.max(...headerRows.map(r => r.DataList.length));
  
  const result: SourceColumn[] = [];
  for (let col = 0; col < colCount; col++) {
    const labelPath: string[] = [];
    headerRows.forEach(row => {
      const cell = row?.DataList?.[col];
      if (cell && cell.trim()) labelPath.push(cell.trim());
    });
    
    const lastLabel = headerRows[headerRows.length - 1]?.DataList[col];
    result.push({
      id: `src-${col}`,
      label: lastLabel?.trim() || labelPath.join("/") || `列${col + 1}`
    });
  }
  return result;
};

export const getNodeDepth = (nodes: MappingNode[], targetId: string, currentDepth = 0): number => {
  for (const node of nodes) {
    if (node.id === targetId) return currentDepth;
    if (node.children.length > 0) {
      const depth = getNodeDepth(node.children, targetId, currentDepth + 1);
      if (depth >= 0) return depth;
    }
  }
  return -1;
};
