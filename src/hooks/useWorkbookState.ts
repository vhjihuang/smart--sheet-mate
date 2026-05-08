import { useState, useMemo } from "react";
import type { ExcelRow, TargetColumn, TemplateResponse } from "@/types";
import { safeCallParse } from "@/utils/bridge";
import { showToast } from "@/utils/toast";
import { parseSourceColumns, parseTargetColumnsFromRows } from "@/utils/excel";

interface SheetOption {
  SheetName: string;
}

interface SourceLoadResponse {
  LoadStatus: number;
  Message?: string;
  Data?: {
    Sheets?: SheetOption[];
    Rows?: ExcelRow[];
    Last?: number;
  };
}

interface SimpleStatusResponse {
  Status: number;
  Message?: string;
}

interface UseWorkbookStateOptions {
  onMappingsReset: () => void;
  onSlotConfigsReset: () => void;
  onPreviewReset: () => void;
  onErrorReset: () => void;
  hasMappings: () => boolean;
}

export const useWorkbookState = ({
  onMappingsReset,
  onSlotConfigsReset,
  onPreviewReset,
  onErrorReset,
  hasMappings,
}: UseWorkbookStateOptions) => {
  const [loading, setLoading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [last, setLast] = useState(0);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  // 使用 confirmedRange 来驱动 sourceColumns 的派生，确保状态同步
  const [confirmedRange, setConfirmedRange] = useState<{ start: number; end: number } | null>(null);
  
  const [isSheetLoaded, setIsSheetLoaded] = useState(false);
  const [headerRowStart, setHeaderRowStart] = useState(0);
  const [headerRowEnd, setHeaderRowEnd] = useState(0);
  const [dataRowStart, setDataRowStart] = useState(1); // 新增：数据起始行
  const [isHeaderConfirmed, setIsHeaderConfirmed] = useState(false);

  // 派生源字段列表
  const sourceColumns = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    // 如果已确认表头，使用确认的范围；否则默认使用第一行（索引 0）
    const start = confirmedRange ? confirmedRange.start : 0;
    const end = confirmedRange ? confirmedRange.end : 0;
    
    return parseSourceColumns(rows, start, end);
  }, [rows, confirmedRange]);

  const [templatePath, setTemplatePath] = useState<string | null>(null);
  const [templateRows, setTemplateRows] = useState<ExcelRow[]>([]);
  const [targetColumns, setTargetColumns] = useState<TargetColumn[]>([]);
  const [templateHeaderRowStart, setTemplateHeaderRowStart] = useState(0);
  const [templateHeaderRowEnd, setTemplateHeaderRowEnd] = useState(0);

  const loadExcelData = async (selectedFilePath: string, page: number, lastValue = last) => {
    return safeCallParse<SourceLoadResponse>("Excel_Original_Load", {
      FilePath: selectedFilePath,
      Page: page,
      Last: lastValue,
    });
  };

  const applyRows = (loadedRows: ExcelRow[]) => {
    if (loadedRows.length === 0) {
      setConfirmedRange(null);
      setRows([]);
      return;
    }

    // 性能优化：React State 仅保留前 100 行用于前端预览，防止大文件导致内存溢出
    setRows(loadedRows.slice(0, 100));
    setConfirmedRange(null); // 加载新文件时重置确认范围，默认显示第一行
  };

  const resetSourceFlow = () => {
    setSheets([]);
    setRows([]);
    setConfirmedRange(null);
    setHeaderRowStart(0);
    setHeaderRowEnd(0);
    setDataRowStart(1);
    setIsSheetLoaded(false);
    setIsHeaderConfirmed(false);
    onMappingsReset();
    onSlotConfigsReset();
    onPreviewReset();
    onErrorReset();
  };

  const loadSheetData = async (selectedFilePath: string, sheetIndex = 0, lastValue = last) => {
    setLoading(true);
    try {
      // Step 1: 请求 page=0 获取 Sheet 列表
      const sheetListData = await loadExcelData(selectedFilePath, 0, lastValue);
      if (sheetListData.LoadStatus !== 1) {
        showToast("error", sheetListData.Message || "加载失败");
        return;
      }

      if (sheetListData.Data?.Sheets) {
        setSheets(sheetListData.Data.Sheets);
      }

      // Step 2: 加载指定 Sheet 的数据
      const page = sheetIndex + 1;
      const data = await loadExcelData(selectedFilePath, page, lastValue);
      if (data.LoadStatus !== 1) {
        showToast("error", data.Message || "加载失败");
        return;
      }

      setCurrentSheetIndex(sheetIndex);

      if (data.Data?.Rows) {
        applyRows(data.Data.Rows);
      }
      if (data.Data?.Last !== undefined) {
        setLast(data.Data.Last);
      }

      setIsSheetLoaded(true);
      showToast("success", data.Message || "加载成功");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "通信失败";
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const response = await safeCallParse<{ SelectStatus: number; FilePath?: string; Message?: string }>(
        "Excel_Original_Select",
      );
      if (response.SelectStatus !== 1 || !response.FilePath) {
        showToast("error", response.Message || "选择失败");
        return;
      }

      setFilePath(response.FilePath);
      resetSourceFlow();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "导入失败";
      showToast("error", message);
    }
  };

  const handleLoadFile = async () => {
    if (!filePath) {
      showToast("error", "请先选择源文件");
      return;
    }
    await loadSheetData(filePath, currentSheetIndex, last);
  };

  const handleSheetChange = async (value: number | null, hasMappings: boolean) => {
    if (value === null) return;

    if (hasMappings) {
      const confirmed = window.confirm(
        "切换工作表将清空当前的映射配置，是否继续？\n\n提示：建议先导出当前配置，避免数据丢失。",
      );
      if (!confirmed) {
        return;
      }
    }

    const page = value + 1;

    if (!filePath) return;

    setLoading(true);
    try {
      const data = await loadExcelData(filePath, page, last);
      if (data.LoadStatus !== 1) {
        showToast("error", data.Message || "加载失败");
        return;
      }

      setCurrentSheetIndex(value);
      setRows([]);
      setConfirmedRange(null);
      setIsSheetLoaded(false);
      setIsHeaderConfirmed(false);
      onMappingsReset();
      onSlotConfigsReset();
      onPreviewReset();
      onErrorReset();

      if (data.Data?.Rows) {
        applyRows(data.Data.Rows);
      }
      if (data.Data?.Last !== undefined) {
        setLast(data.Data.Last);
      }

      setIsSheetLoaded(true);
      showToast("success", data.Message || "加载成功");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "通信失败";
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  const confirmHeader = async () => {
    if (!filePath) {
      showToast("error", "请先选择源文件");
      return;
    }
    if (headerRowStart > headerRowEnd) {
      showToast("error", "起始行不能大于结束行");
      return;
    }
    
    try {
      const response = await safeCallParse<SimpleStatusResponse>("Excel_SetHeaderRows", {
        FilePath: filePath,
        HeaderRowStart: headerRowStart,
        HeaderRowEnd: headerRowEnd,
      });

      if (response.Status === 1) {
        setConfirmedRange({ start: headerRowStart, end: headerRowEnd });
        if (dataRowStart < headerRowEnd + 1) {
          setDataRowStart(headerRowEnd + 1);
        }
        onMappingsReset();
        setIsHeaderConfirmed(true);
        showToast("success", "表头已确认");
        return;
      }

      showToast("error", response.Message || "表头设置失败");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "表头确认失败";
      showToast("error", message);
    }
  };

  const skipHeader = () => {
    setHeaderRowStart(0);
    setHeaderRowEnd(0);
    setDataRowStart(1);
    setConfirmedRange({ start: 0, end: 0 });
    setIsHeaderConfirmed(true);
    onMappingsReset();
    showToast("success", "已跳过");
  };

  const handleUploadTemplate = async () => {
    setLoading(true);
    try {
      const response = await safeCallParse<TemplateResponse>("Excel_Template_Load");
      if (response.LoadStatus !== 1) {
        showToast("error", response.Message || "模板加载失败");
        return;
      }

      if (!response.Template) {
        showToast("error", "模板数据为空");
        return;
      }

      setTemplatePath(response.FilePath || null);

      if (response.Template.Sheets?.length > 0) {
        const firstSheet = response.Template.Sheets[0];
        setTemplateRows(
          firstSheet.Rows.map((row) => ({
            Index: row.I,
            DataList: row.R.map((cell) => cell.D),
          })),
        );
      } else {
        setTemplateRows([]);
      }

      showToast("success", response.Message || "模板加载成功");
    } catch {
      showToast("error", "模板加载失败");
    } finally {
      setLoading(false);
    }
  };

  const confirmTemplateHeader = async () => {
    if (!templatePath) {
      showToast("error", "请先上传模板文件");
      return;
    }
    if (templateHeaderRowStart > templateHeaderRowEnd) {
      showToast("error", "模板表头起始行不能大于结束行");
      return;
    }

    if (hasMappings()) {
      const confirmed = window.confirm(
        "重新确认模板表头将清空当前的映射配置，是否继续？",
      );
      if (!confirmed) return;
    }

    const nextTargetColumns = parseTargetColumnsFromRows(
      templateRows,
      templateHeaderRowStart,
      templateHeaderRowEnd,
    );

    try {
      const response = await safeCallParse<SimpleStatusResponse>("Excel_SetTemplateHeaderRows", {
        FilePath: templatePath,
        HeaderRowStart: templateHeaderRowStart,
        HeaderRowEnd: templateHeaderRowEnd,
      });

      if (response.Status === 1) {
        setTargetColumns(nextTargetColumns);
        onMappingsReset();
        showToast("success", "模板表头已确认，目标列已更新");
      } else {
        showToast("error", response.Message || "模板表头设置失败");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "模板表头确认失败";
      showToast("error", message);
    }
  };

  const onHeaderRowStartChange = (value: number) => {
    setHeaderRowStart(value);
    if (isHeaderConfirmed) setIsHeaderConfirmed(false);
  };

  const onHeaderRowEndChange = (value: number) => {
    setHeaderRowEnd(value);
    if (isHeaderConfirmed) setIsHeaderConfirmed(false);
  };

  return {
    loading,
    setLoading,
    filePath,
    setFilePath,
    sheets,
    currentSheetIndex,
    last,
    rows,
    sourceColumns,
    targetColumns,
    isSheetLoaded,
    headerRowStart,
    setHeaderRowStart: onHeaderRowStartChange,
    headerRowEnd,
    setHeaderRowEnd: onHeaderRowEndChange,
    dataRowStart,
    setDataRowStart,
    isHeaderConfirmed,
    templatePath,
    templateRows,
    templateHeaderRowStart,
    setTemplateHeaderRowStart,
    templateHeaderRowEnd,
    setTemplateHeaderRowEnd,
    handleImport,
    handleLoadFile,
    handleSheetChange,
    handleUploadTemplate,
    loadSheetData,
    confirmHeader,
    skipHeader,
    confirmTemplateHeader,
  };
};
