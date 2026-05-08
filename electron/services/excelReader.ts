import { BrowserWindow, dialog } from 'electron';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

// ══════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════

interface ExcelRow {
  DataList: string[];
  Index: number;
}

interface LoadSourceResult {
  LoadStatus: number;
  Message: string;
  Data?: {
    Sheets?: { SheetName: string }[];
    Rows?: ExcelRow[];
    Last?: number;
  };
}

interface TemplateCell {
  D: string;
  I: number;
}

interface TemplateRow {
  I: number;
  R: TemplateCell[];
}

interface TemplateLoadResult {
  LoadStatus: number;
  FilePath: string;
  Message: string;
  Template?: {
    Code: string;
    FilePath: string;
    Sheets: {
      Count_Columns: number;
      Count_Lines: number;
      Rows: TemplateRow[];
    }[];
  };
}

// ══════════════════════════════════════════
// 合并单元格处理
// ══════════════════════════════════════════

/**
 * 处理 Excel 合并单元格：将合并区域的左上角值填充到所有子单元格
 * 教师的上级模板经常使用合并单元格作为多级表头
 */
function processMergedCells(ws: XLSX.WorkSheet): void {
  const merges = ws['!merges'] || [];

  for (const merge of merges) {
    const originAddr = XLSX.utils.encode_cell(merge.s);
    const originCell = ws[originAddr];
    const originValue = originCell?.v ?? '';
    const originType = originCell?.t ?? 's';

    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue; // 跳过原始单元格
        const addr = XLSX.utils.encode_cell({ r, c });
        ws[addr] = { v: originValue, t: originType };
      }
    }
  }
}

/**
 * 将 SheetJS WorkSheet 转换为内部 ExcelRow[] 格式
 */
function sheetToExcelRows(ws: XLSX.WorkSheet): ExcelRow[] {
  // 使用 sheet_to_json 以数组格式获取所有数据
  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,    // 返回数组
    raw: false,   // 全部转字符串（防止科学计数法）
    defval: '',   // 空值用空字符串
    range: 0,     // 从第 0 行开始
  });

  // 限制返回行数，防止大文件导致 IPC 通道阻塞或内存溢出
  // 预览只需要前面的数据，正式导出由 exportEngine 处理
  const limit = 1000;
  const slicedRows = rawRows.slice(0, limit);

  return slicedRows.map((dataList, index) => ({
    DataList: dataList.map(cell => (cell == null ? '' : String(cell))),
    Index: index,
  }));
}

// ══════════════════════════════════════════
// 源文件流水线
// ══════════════════════════════════════════

/**
 * S1: 选择源文件（只选路径，不读数据）
 */
export async function selectSourceFile(win: BrowserWindow): Promise<{
  SelectStatus: number;
  FilePath?: string;
  Message?: string;
}> {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: '选择源 Excel 文件',
      filters: [{ name: 'Excel 文件', extensions: ['xls', 'xlsx'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      // 用户取消 ≠ 错误，静默返回
      return { SelectStatus: 0, Message: '' };
    }

    const filePath = result.filePaths[0];

    // 检查文件是否可访问
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      return { SelectStatus: 0, Message: '文件不存在或无法访问' };
    }

    return { SelectStatus: 1, FilePath: filePath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { SelectStatus: 0, Message: `选择文件失败: ${message}` };
  }
}

/**
 * S2: 加载源文件数据
 * Page=0 → 返回 Sheet 列表
 * Page>=1 → 返回指定 Sheet 的行数据
 */
export function loadSourceData(params: {
  FilePath: string;
  Page: number;
  Last: number;
}): LoadSourceResult {
  const { FilePath: filePath, Page: page } = params;

  // 检查文件存在
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    return { LoadStatus: 0, Message: '源文件不存在或无法访问，请重新选择' };
  }

  try {
    const wb = XLSX.readFile(filePath, {
      cellDates: true,
      cellNF: true,
    });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { LoadStatus: 0, Message: '文件为空，没有工作表' };
    }

    // Page=0 → 返回 Sheet 列表
    if (page === 0) {
      if (wb.SheetNames.length === 1) {
        // 只有一个 Sheet，同时返回列表标记
        return {
          LoadStatus: 1,
          Message: '加载成功',
          Data: { Sheets: [{ SheetName: wb.SheetNames[0] }] },
        };
      }
      return {
        LoadStatus: 1,
        Message: '请选择工作表',
        Data: { Sheets: wb.SheetNames.map(s => ({ SheetName: s })) },
      };
    }

    // Page>=1 → 加载指定 Sheet
    const sheetIndex = page - 1;
    if (sheetIndex < 0 || sheetIndex >= wb.SheetNames.length) {
      return { LoadStatus: 0, Message: `工作表 ${page} 不存在` };
    }

    const sheetName = wb.SheetNames[sheetIndex];
    const ws = wb.Sheets[sheetName];

    if (!ws) {
      return { LoadStatus: 0, Message: `工作表 "${sheetName}" 为空` };
    }

    // 处理合并单元格
    processMergedCells(ws);

    const rows = sheetToExcelRows(ws);

    if (rows.length === 0) {
      return { LoadStatus: 0, Message: '该工作表没有数据' };
    }

    return {
      LoadStatus: 1,
      Message: '加载成功',
      Data: { Rows: rows, Last: rows.length },
    };
  } catch (err: unknown) {
    // 常见错误分类处理
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('password') || msg.includes('encrypt')) {
      return { LoadStatus: 0, Message: '不支持加密文件，请先去除密码保护' };
    }
    if (msg.includes('Unsupported')) {
      return { LoadStatus: 0, Message: '文件格式不支持，请使用 .xls 或 .xlsx 文件' };
    }
    return { LoadStatus: 0, Message: `读取失败: ${msg}` };
  }
}

// ══════════════════════════════════════════
// 模板流水线（独立于源文件）
// ══════════════════════════════════════════

/**
 * T1: 上传并加载模板文件（选择 + 读取一步完成）
 * 返回格式与原 Go 后端 TemplateResponse 兼容
 */
export async function loadTemplateFile(win: BrowserWindow): Promise<TemplateLoadResult> {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: '选择目标模板文件',
      filters: [{ name: 'Excel 文件', extensions: ['xls', 'xlsx'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { LoadStatus: 0, FilePath: '', Message: '' };
    }

    const filePath = result.filePaths[0];

    // 检查文件可访问
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      return { LoadStatus: 0, FilePath: filePath, Message: '模板文件不存在或无法访问' };
    }

    const wb = XLSX.readFile(filePath, {
      cellDates: true,
      cellNF: true,
    });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { LoadStatus: 0, FilePath: filePath, Message: '模板文件为空' };
    }

    // 读取第一个 Sheet
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    if (!ws) {
      return { LoadStatus: 0, FilePath: filePath, Message: '模板工作表为空' };
    }

    // 处理合并单元格
    processMergedCells(ws);

    const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
    });

    if (rawRows.length === 0) {
      return { LoadStatus: 0, FilePath: filePath, Message: '模板没有数据' };
    }

    // 计算列数
    const colCount = Math.max(...rawRows.map(r => r.length));

    // 转换为 TemplateResponse 兼容格式
    const templateRows: TemplateRow[] = rawRows.map((row, rowIndex) => ({
      I: rowIndex,
      R: row.map((cell, colIndex) => ({
        D: cell == null ? '' : String(cell),
        I: colIndex,
      })),
    }));

    return {
      LoadStatus: 1,
      FilePath: filePath,
      Message: '模板加载成功',
      Template: {
        Code: sheetName,
        FilePath: filePath,
        Sheets: [{
          Count_Columns: colCount,
          Count_Lines: rawRows.length,
          Rows: templateRows,
        }],
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('password') || msg.includes('encrypt')) {
      return { LoadStatus: 0, FilePath: '', Message: '不支持加密的模板文件' };
    }
    return { LoadStatus: 0, FilePath: '', Message: `模板加载失败: ${msg}` };
  }
}
