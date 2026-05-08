import type { TargetColumn, SourceColumn, ExcelRow } from "@/types";

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

export const getColumnLabel = (index: number): string => {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

// 按范围解析表头为扁平 SourceColumn 列表
export const parseSourceColumns = (
  rowsData: ExcelRow[],
  start: number,
  end: number
): SourceColumn[] => {
  if (!rowsData || rowsData.length === 0) return [];
  
  const headerRows = rowsData.slice(start, end + 1);
  if (headerRows.length === 0) return [];
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

// 根据表头行解析目标列（用于模板）
export const parseTargetColumnsFromRows = (
  rows: ExcelRow[],
  headerRowStart: number,
  headerRowEnd: number
): TargetColumn[] => {
  if (rows.length === 0) return [];

  // 确保索引在有效范围内
  const start = Math.max(0, Math.min(headerRowStart, rows.length - 1));
  const end = Math.max(start, Math.min(headerRowEnd, rows.length - 1));

  // 单行表头（简单情况）
  if (start === end) {
    const headerRow = rows[start];
    return headerRow.DataList.map((cell, index) => ({
      id: `col-${index}`,
      label: cell || `列${index + 1}`
    }));
  }

  // 多行表头（合并多行内容）
  const columnCount = rows[start]?.DataList.length || 0;
  const columns: TargetColumn[] = [];

  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    const labels: string[] = [];
    for (let rowIndex = start; rowIndex <= end; rowIndex++) {
      const cell = rows[rowIndex]?.DataList[colIndex];
      if (cell && cell.trim()) labels.push(cell.trim());
    }

    columns.push({
      id: `col-${colIndex}`,
      label: labels.join(' - ') || `列${colIndex + 1}`
    });
  }

  return columns;
};
