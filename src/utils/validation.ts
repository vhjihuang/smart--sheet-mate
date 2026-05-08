import type { MappingNode, SourceColumn, ExcelRow, SlotConfig, TargetColumn } from "@/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证映射配置的完整性和合法性
 */
export function validateMappings(
  mappings: Record<string, MappingNode[]>,
  sourceColumns: SourceColumn[],
  rows: ExcelRow[],
  slotConfigs: Record<string, SlotConfig>,
  targetColumns: TargetColumn[] = [],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetLabelMap = new Map<string, string>();
  const buildLabelMap = (cols: TargetColumn[]) => {
    for (const col of cols) {
      targetLabelMap.set(col.id, col.label);
      if (col.children) buildLabelMap(col.children);
    }
  };
  buildLabelMap(targetColumns);

  const getTargetLabel = (id: string) => targetLabelMap.get(id) || id;

  if (sourceColumns.length === 0 && Object.values(mappings).some((nodes) => nodes.length > 0)) {
    errors.push('源字段列表为空，请确认表头设置是否正确');
    return { errors, warnings };
  }

  // 1. 检查源列索引有效性
  for (const [targetId, nodes] of Object.entries(mappings)) {
    for (const node of nodes) {
      const colIndex = parseInt(node.sourceId.replace('src-', ''), 10);
      if (isNaN(colIndex) || colIndex < 0 || colIndex >= sourceColumns.length) {
        errors.push(`目标列 "${getTargetLabel(targetId)}" 映射的源列 "${node.sourceLabel}" 不存在`);
      }
    }
  }

  // 2. 检查转换参数完整性
  for (const [targetId, nodes] of Object.entries(mappings)) {
    for (const node of nodes) {
      for (const step of node.steps) {
        switch (step.type) {
          case 'REPLACE': {
            if (!step.params.from) {
              warnings.push(`目标列 "${getTargetLabel(targetId)}" 的替换操作缺少 "查找内容" 参数，将跳过转换`);
            }
            break;
          }
          
          case 'SCORE_GRADE': {
            if (!step.params.rules || step.params.rules.length === 0) {
              errors.push(`目标列 "${getTargetLabel(targetId)}" 的成绩分级操作缺少分级规则`);
            } else {
              const rules = step.params.rules;
              for (const rule of rules) {
                if (typeof rule.min !== 'number' || !rule.grade) {
                  errors.push(`目标列 "${getTargetLabel(targetId)}" 的成绩分级规则格式错误`);
                  break;
                }
              }
            }
            break;
          }
          
          case 'CROP':
            if (step.params.start < 0) {
              errors.push(`目标列 "${getTargetLabel(targetId)}" 的裁剪起始位置不能为负数`);
            }
            if (step.params.length !== undefined && step.params.length < 0) {
              errors.push(`目标列 "${getTargetLabel(targetId)}" 的裁剪长度不能为负数`);
            }
            break;
          
          case 'ID_MASK': {
            const keepStart = step.params.keepStart ?? 6;
            const keepEnd = step.params.keepEnd ?? 4;
            if (keepStart < 0 || keepEnd < 0) {
              errors.push(`目标列 "${getTargetLabel(targetId)}" 的脱敏操作保留位数不能为负数`);
            }
            if (keepStart + keepEnd < 1) {
              warnings.push(`目标列 "${getTargetLabel(targetId)}" 的脱敏操作保留位数过少，可能无法识别`);
            }
            break;
          }
          
          case 'DATE_FORMAT':
            if (!step.params.toFormat) {
              warnings.push(`目标列 "${getTargetLabel(targetId)}" 的日期格式化缺少输出格式，将使用默认格式`);
            }
            break;
        }
      }
    }
  }

  // 3. 检查长数字列是否开启 forceText
  if (rows.length > 0) {
    for (const [targetId, nodes] of Object.entries(mappings)) {
      const hasForceText = nodes.some(n => n.forceText);
      if (!hasForceText) {
        for (const node of nodes) {
          const colIndex = parseInt(node.sourceId.replace('src-', ''), 10);
          if (colIndex >= 0 && colIndex < sourceColumns.length) {
            const sampleValue = rows[0]?.DataList[colIndex] || '';
            if (sampleValue.length > 11 && /^\d+$/.test(sampleValue)) {
              warnings.push(`目标列 "${getTargetLabel(targetId)}" 包含长数字 (${sampleValue.length}位)，建议开启"深度锁定格式"防止科学计数法`);
              break;
            }
            if (/e[+-]?\d+/i.test(sampleValue)) {
              warnings.push(`目标列 "${getTargetLabel(targetId)}" 包含科学计数法格式，建议开启"深度锁定格式"`);
              break;
            }
          }
        }
      }
    }
  }

  // 4. 检查多字段聚合配置
  for (const [targetId, nodes] of Object.entries(mappings)) {
    if (nodes.length > 1) {
      const config = slotConfigs[targetId];
      if (!config || config.type !== 'JOIN') {
        warnings.push(`目标列 "${getTargetLabel(targetId)}" 有 ${nodes.length} 个源字段，但未配置聚合方式`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证表头配置
 */
export function validateHeaderConfig(
  headerRowStart: number,
  headerRowEnd: number,
  totalRows: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (headerRowStart < 0) {
    errors.push('表头起始行不能为负数');
  }

  if (headerRowEnd < headerRowStart) {
    errors.push('表头结束行不能小于起始行');
  }

  if (headerRowEnd >= totalRows) {
    errors.push(`表头结束行 (${headerRowEnd + 1}) 超出文件总行数 (${totalRows})`);
  }

  if (headerRowEnd - headerRowStart > 5) {
    warnings.push(`表头跨度过大 (${headerRowEnd - headerRowStart + 1} 行)，请确认是否正确`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证文件路径
 */
export function validateFilePath(filePath: string | null, fileType: 'source' | 'template'): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!filePath) {
    errors.push(`请先选择${fileType === 'source' ? '源' : '模板'}文件`);
    return { valid: false, errors, warnings };
  }

  // 检查文件扩展名
  const ext = filePath.toLowerCase().split('.').pop();
  const allowedExts = ['xls', 'xlsx', 'csv'];
  if (!ext || !allowedExts.includes(ext)) {
    errors.push(`不支持的文件格式: .${ext}，请使用 .xls、.xlsx 或 .csv 文件`);
  }

  if (ext === 'csv' && fileType === 'template') {
    warnings.push('CSV 模板不含样式信息，导出文件将使用默认格式');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
