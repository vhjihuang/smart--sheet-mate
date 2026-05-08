import { BrowserWindow, dialog } from 'electron';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { applyPipeline, aggregateValues } from './transformEngine';
import type {
  SharedMappingNode,
  SharedSlotConfig,
} from '../../shared/transform';

// ══════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════

type MappingNode = SharedMappingNode;
type SlotConfig = SharedSlotConfig;

interface TransformRule {
  targetColId: string;
  targetName: string;
  mappings: MappingNode[];
  slotConfig: SlotConfig;
  forceText: boolean;
}

interface ExportPayload {
  SourcePath: string;
  TemplatePath: string;
  SourceHeaderRows: { Start: number; End: number };
  DataRowStart: number;
  TemplateHeaderRows: { Start: number; End: number };
  CurrentSheetIndex: number;
  TransformRules: TransformRule[];
}

interface ExportResult {
  Status: number;
  Message: string;
  FilePath?: string;
}

// ══════════════════════════════════════════
// 样式复制工具函数
// ══════════════════════════════════════════

/**
 * 深度复制单元格样式
 * 包括: 字体、边框、填充、对齐、数字格式、保护
 */
function copyCellStyle(sourceCell: ExcelJS.Cell, targetCell: ExcelJS.Cell): void {
  try {
    // 1. 复制字体
    if (sourceCell.font) {
      targetCell.font = {
        name: sourceCell.font.name,
        size: sourceCell.font.size,
        bold: sourceCell.font.bold,
        italic: sourceCell.font.italic,
        underline: sourceCell.font.underline,
        color: sourceCell.font.color ? JSON.parse(JSON.stringify(sourceCell.font.color)) : undefined,
        family: sourceCell.font.family,
        scheme: sourceCell.font.scheme,
        charset: sourceCell.font.charset,
        strike: sourceCell.font.strike,
        outline: sourceCell.font.outline,
        vertAlign: sourceCell.font.vertAlign
      };
    }
    
    // 2. 复制边框
    if (sourceCell.border) {
      targetCell.border = {
        top: sourceCell.border.top ? JSON.parse(JSON.stringify(sourceCell.border.top)) : undefined,
        left: sourceCell.border.left ? JSON.parse(JSON.stringify(sourceCell.border.left)) : undefined,
        bottom: sourceCell.border.bottom ? JSON.parse(JSON.stringify(sourceCell.border.bottom)) : undefined,
        right: sourceCell.border.right ? JSON.parse(JSON.stringify(sourceCell.border.right)) : undefined,
        diagonal: sourceCell.border.diagonal ? JSON.parse(JSON.stringify(sourceCell.border.diagonal)) : undefined
      };
    }
    
    // 3. 复制填充
    if (sourceCell.fill) {
      targetCell.fill = JSON.parse(JSON.stringify(sourceCell.fill));
    }
    
    // 4. 复制对齐
    if (sourceCell.alignment) {
      targetCell.alignment = {
        horizontal: sourceCell.alignment.horizontal,
        vertical: sourceCell.alignment.vertical,
        wrapText: sourceCell.alignment.wrapText,
        shrinkToFit: sourceCell.alignment.shrinkToFit,
        indent: sourceCell.alignment.indent,
        readingOrder: sourceCell.alignment.readingOrder,
        textRotation: sourceCell.alignment.textRotation
      };
    }
    
    // 5. 复制数字格式 (如果不是强制文本)
    if (sourceCell.numFmt && sourceCell.numFmt !== '@') {
      targetCell.numFmt = sourceCell.numFmt;
    }
    
    // 6. 复制保护
    if (sourceCell.protection) {
      targetCell.protection = { ...sourceCell.protection };
    }
  } catch (err) {
    console.warn('样式复制失败:', err);
    // 样式复制失败不影响数据写入
  }
}

function shouldWriteAsNumber(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;

  // 保守策略：
  // 1. 只接受普通整数/小数，拒绝科学计数法
  // 2. 保留前导零字符串，如学号/邮编/身份证片段
  const plainNumberPattern = /^-?(0|[1-9]\d*)(\.\d+)?$/;
  if (!plainNumberPattern.test(trimmed)) return false;

  if (/^-?0\d+/.test(trimmed)) return false;
  if (/^-?0\d+\./.test(trimmed)) return false;

  return Number.isFinite(Number(trimmed));
}

// ══════════════════════════════════════════
// 导出引擎
// ══════════════════════════════════════════

/**
 * 核心导出流程：
 * 1. SheetJS 读取源数据（兼容 .xls/.xlsx）
 * 2. ExcelJS 读取模板（保留样式）
 * 3. 遍历源数据行 → 应用映射+转换 → 写入模板
 * 4. 保存输出文件
 */
export async function exportToTemplate(
  payload: ExportPayload,
  win: BrowserWindow
): Promise<ExportResult> {

  // ── 前置检查：源文件 ──
  try {
    fs.accessSync(payload.SourcePath, fs.constants.R_OK);
  } catch {
    return { Status: 0, Message: '源文件不存在或无法访问，请重新选择' };
  }

  // ── 前置检查：模板文件 ──
  try {
    fs.accessSync(payload.TemplatePath, fs.constants.R_OK);
  } catch {
    return { Status: 0, Message: '模板文件不存在或无法访问，请重新上传' };
  }

  // ── 前置检查：映射规则 ──
  const validRules = payload.TransformRules.filter(r => r.mappings && r.mappings.length > 0);
  if (validRules.length === 0) {
    return { Status: 0, Message: '请至少完成一个字段映射' };
  }

  // ── 选择保存路径 ──
  const templateBaseName = path.basename(payload.TemplatePath, path.extname(payload.TemplatePath));
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const defaultName = `${templateBaseName}_输出_${timestamp}.xlsx`;

  const saveResult = await dialog.showSaveDialog(win, {
    title: '选择导出保存位置',
    defaultPath: defaultName,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { Status: 0, Message: '已取消导出' };
  }

  const outputPath = saveResult.filePath;

  // ── 检查输出路径权限 ──
  try {
    fs.accessSync(path.dirname(outputPath), fs.constants.W_OK);
  } catch {
    return { Status: 0, Message: '没有写入权限，请选择其他保存位置' };
  }

  try {
    // ══════════════════════════════════════
    // Step 1: SheetJS 读取源数据
    // ══════════════════════════════════════
    const sourceWb = XLSX.readFile(payload.SourcePath, {
      cellDates: true,
      raw: false, // 全部转字符串
    });

    const sheetIndex = payload.CurrentSheetIndex ?? 0;
    const sheetName = sourceWb.SheetNames[sheetIndex];
    if (!sheetName) {
      return { Status: 0, Message: `源文件工作表 ${payload.CurrentSheetIndex} 不存在` };
    }

    const sourceWs = sourceWb.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json<string[]>(sourceWs, {
      header: 1,
      raw: false,
      defval: '',
    });

    // 数据行 = 使用用户指定的数据起始行
    const dataStartRow = payload.DataRowStart;
    const dataRows = allRows.slice(dataStartRow);

    if (dataRows.length === 0) {
      if (dataStartRow >= allRows.length) {
        return { Status: 0, Message: `数据起始行(第${dataStartRow + 1}行)超出文件总行数(${allRows.length}行)，请检查设置` };
      }
      return { Status: 0, Message: '源文件表头之后没有数据行' };
    }

    // ══════════════════════════════════════
    // Step 2: ExcelJS 读取模板（保留样式）
    // ══════════════════════════════════════
    const templateWb = new ExcelJS.Workbook();

    // 检测模板文件格式
    const templateExt = path.extname(payload.TemplatePath).toLowerCase();
    if (templateExt === '.xlsx') {
      await templateWb.xlsx.readFile(payload.TemplatePath);
    } else if (templateExt === '.xls') {
      // ExcelJS 不直接支持 .xls 读取
      // 策略：用 SheetJS 读 .xls → 转为内存中的 .xlsx buffer → ExcelJS 读取
      const xlsWb = XLSX.readFile(payload.TemplatePath);
      const xlsxBuffer = XLSX.write(xlsWb, { type: 'buffer', bookType: 'xlsx' });
      await templateWb.xlsx.load(xlsxBuffer);
    } else {
      return { Status: 0, Message: '模板文件格式不支持' };
    }

    const templateWs = templateWb.worksheets[0];
    if (!templateWs) {
      return { Status: 0, Message: '模板文件没有工作表' };
    }

    // ══════════════════════════════════════
    // Step 3: 构建列索引映射
    // ══════════════════════════════════════
    // targetColId = "col-N" → 模板的第 N+1 列（ExcelJS 从1开始）
    const colIndexMap: Record<string, number> = {};
    for (const rule of validRules) {
      const match = rule.targetColId.match(/^col-(\d+)$/);
      if (match) {
        colIndexMap[rule.targetColId] = parseInt(match[1], 10) + 1;
      }
    }

    // ══════════════════════════════════════
    // Step 4: 写入数据行
    // ══════════════════════════════════════
    const writeStartRow = payload.TemplateHeaderRows.End + 2; // ExcelJS 行号从1开始

    // 获取模板写入起始行的样式（用于复制到后续行）
    const styleTemplateRow = templateWs.getRow(writeStartRow);
    const hasStyleRow = styleTemplateRow && styleTemplateRow.cellCount > 0;

    let writeRowIdx = writeStartRow;
    let writtenCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const sourceRow = dataRows[i];

      if (sourceRow.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }

      const outputRowIdx = writeRowIdx;
      writeRowIdx += 1;
      writtenCount += 1;

      // 复制行高
      if (hasStyleRow) {
        const targetRow = templateWs.getRow(outputRowIdx);
        if (styleTemplateRow.height) {
          targetRow.height = styleTemplateRow.height;
        }
      }

      for (const rule of validRules) {
        const colIdx = colIndexMap[rule.targetColId];
        if (!colIdx) continue;

        // 计算该列的输出值
        const values = rule.mappings.map(node => {
          const srcIdx = parseInt(node.sourceId.replace('src-', ''), 10);
          const rawValue = sourceRow[srcIdx] != null ? String(sourceRow[srcIdx]) : '';
          return applyPipeline(rawValue, node.steps || []);
        });

        const finalValue = aggregateValues(values, rule.slotConfig);

        // 写入单元格
        const cell = templateWs.getCell(outputRowIdx, colIdx);

        // 深度复制样式
        if (hasStyleRow) {
          const templateCell = styleTemplateRow.getCell(colIdx);
          copyCellStyle(templateCell, cell);
        }

        if (rule.forceText) {
          // ── forceText: 强制文本格式，防止科学计数法 ──
          cell.value = finalValue;
          cell.numFmt = '@';
        } else {
          // 保守的数字推断，避免吞掉前导零
          const trimmed = finalValue.trim();
          if (shouldWriteAsNumber(trimmed) && trimmed.length <= 15) {
            cell.value = Number(trimmed);
          } else {
            cell.value = finalValue;
          }
        }
      }
    }

    // ══════════════════════════════════════
    // Step 5: 保存输出
    // ══════════════════════════════════════
    await templateWb.xlsx.writeFile(outputPath);

    return {
      Status: 1,
      Message: `导出成功，共处理 ${writtenCount} 行数据`,
      FilePath: outputPath,
    };
  } catch (err: unknown) {
    const code = err instanceof Error && "code" in err ? String(err.code ?? "") : "";
    const msg = err instanceof Error ? err.message : "";

    if (code === 'EBUSY' || code === 'EPERM') {
      return { Status: 0, Message: '输出文件被占用，请关闭相关程序后重试' };
    }
    if (code === 'ENOSPC') {
      return { Status: 0, Message: '磁盘空间不足' };
    }

    return { Status: 0, Message: `导出失败: ${msg}` };
  }
}
