import { useState } from "react";
import type { ExcelRow, SourceColumn, TargetColumn, TemplateResponse } from "@/types";
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
}

export const useWorkbookState = ({
  onMappingsReset,
  onSlotConfigsReset,
  onPreviewReset,
  onErrorReset,
}: UseWorkbookStateOptions) => {
  const [loading, setLoading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [last, setLast] = useState(0);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [sourceColumns, setSourceColumns] = useState<SourceColumn[]>([]);
  const [isSheetLoaded, setIsSheetLoaded] = useState(false);
  const [headerRowStart, setHeaderRowStart] = useState(0);
  const [headerRowEnd, setHeaderRowEnd] = useState(0);
  const [isHeaderConfirmed, setIsHeaderConfirmed] = useState(false);

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
      setSourceColumns([]);
      setRows([]);
      return;
    }

    const titles = loadedRows[0].DataList;
    setSourceColumns(titles.map((title, index) => ({ id: `src-${index}`, label: title || `列${index + 1}` })));
    
    // 性能优化：React State 仅保留前 100 行用于前端预览，防止大文件导致内存溢出
    setRows(loadedRows.slice(0, 100));
  };

  const resetSourceFlow = () => {
    setSheets([]);
    setRows([]);
    setSourceColumns([]);
    setHeaderRowStart(0);
    setHeaderRowEnd(0);
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
      const page = sheetIndex + 1;
      const data = await loadExcelData(selectedFilePath, page, lastValue);
      if (data.LoadStatus !== 1) {
        showToast("error", data.Message || "加载失败");
        return;
      }

      if (data.Data?.Sheets) {
        if (data.Data.Sheets.length === 1) {
          setCurrentSheetIndex(0);
          setSheets(data.Data.Sheets);
          const singleData = await loadExcelData(selectedFilePath, 1, lastValue);
          if (singleData.Data?.Rows) {
            applyRows(singleData.Data.Rows);
          }
          if (singleData.Data?.Last !== undefined) {
            setLast(singleData.Data.Last);
          }
        } else {
          setSheets(data.Data.Sheets);
        }
      } else if (data.Data) {
        if (data.Data.Rows) {
          applyRows(data.Data.Rows);
        }
        if (data.Data.Last !== undefined) {
          setLast(data.Data.Last);
        }
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
      setSourceColumns([]);
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
    try {
      const response = await safeCallParse<SimpleStatusResponse>("Excel_SetHeaderRows", {
        FilePath: filePath,
        HeaderRowStart: headerRowStart,
        HeaderRowEnd: headerRowEnd,
      });

      if (response.Status === 1) {
        setSourceColumns(parseSourceColumns(rows, headerRowStart, headerRowEnd));
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
    setSourceColumns(parseSourceColumns(rows, 0, 0));
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
    setHeaderRowStart,
    headerRowEnd,
    setHeaderRowEnd,
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
