import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ExcelRow,
  ExportResponse,
  MappingNode,
  SlotConfig,
  SourceColumn,
  TargetColumn,
} from "@/types";
import { getLeafColumns } from "@/utils/excel";
import { safeCallParse } from "@/utils/bridge";
import { openFolder } from "@/utils/goBridge";
import { showToast } from "@/utils/toast";
import { validateFilePath, validateMappings } from "@/utils/validation";
import { previewTransform } from "../../shared/transform";

interface UsePreviewExportOptions {
  mappings: Record<string, MappingNode[]>;
  slotConfigs: Record<string, SlotConfig>;
  rows: ExcelRow[];
  sourceColumns: SourceColumn[];
  targetColumns: TargetColumn[];
  filePath: string | null;
  templatePath: string | null;
  headerRowStart: number;
  headerRowEnd: number;
  templateHeaderRowStart: number;
  templateHeaderRowEnd: number;
  currentSheetIndex: number;
  templateRows: ExcelRow[];
  dataRowStart: number;
  isHeaderConfirmed: boolean;
  setLoading: (loading: boolean) => void;
}

export const usePreviewExport = ({
  mappings,
  slotConfigs,
  rows,
  sourceColumns,
  targetColumns,
  filePath,
  templatePath,
  headerRowStart,
  headerRowEnd,
  templateHeaderRowStart,
  templateHeaderRowEnd,
  currentSheetIndex,
  templateRows,
  dataRowStart,
  isHeaderConfirmed,
  setLoading,
}: UsePreviewExportOptions) => {
  const [previewData, setPreviewData] = useState<Record<string, string[]>>({});
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreviewData = useCallback(() => {
    if (rows.length === 0) return;

    let sampleStart = dataRowStart;
    if (sampleStart >= rows.length) {
      sampleStart = Math.max(0, rows.length - 5);
    }
    const response = previewTransform({
      SourceSamples: rows.slice(sampleStart, sampleStart + 5),
      Mappings: mappings,
      SlotConfigs: slotConfigs,
    });

    const adjustedResults = { ...(response.Results || {}) };
    Object.keys(adjustedResults).forEach((key) => {
      const samples = adjustedResults[key] || [];
      const hasSciNotation = samples.some(
        (sample) => sample && ((sample.length > 11 && /^\d+$/.test(sample)) || /e\+/i.test(sample)),
      );
      if (hasSciNotation && !mappings[key]?.some((node) => node.forceText)) {
        console.warn(`检测到目标列 ${key} 包含长数字，建议开启物理硬化`);
      }
    });

    setPreviewData(adjustedResults);
  }, [mappings, rows, slotConfigs, dataRowStart]);

  useEffect(() => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
    }

    const hasAnyMapping = Object.values(mappings).some((nodes) => nodes.length > 0);
    if (!hasAnyMapping) {
      setPreviewData({});
      return;
    }

    previewTimer.current = setTimeout(() => {
      fetchPreviewData();
    }, 600);

    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
    };
  }, [fetchPreviewData, mappings]);

  const performExport = useCallback(async () => {
    setLoading(true);

    try {
      const leafColumns = getLeafColumns(targetColumns);
      const payload = {
        SourcePath: filePath,
        TemplatePath: templatePath,
        SourceHeaderRows: { Start: headerRowStart, End: headerRowEnd },
        DataRowStart: dataRowStart,
        TemplateHeaderRows: { Start: templateHeaderRowStart, End: templateHeaderRowEnd },
        CurrentSheetIndex: currentSheetIndex,
        TransformRules: leafColumns.map((column) => ({
          targetColId: column.id,
          targetName: column.label,
          mappings: mappings[column.id] || [],
          slotConfig: slotConfigs[column.id] || { type: "JOIN" as const, separator: "" },
          forceText: (mappings[column.id] || []).some((node) => node.forceText),
        })),
      };

      const response = await safeCallParse<ExportResponse>("Excel_Export", payload);
      if (response.Status === 1) {
        showToast("success", response.Message || "导出成功", undefined, {
          label: "打开文件夹",
          onClick: () => {
            if (response.FilePath) {
              void openFolder(response.FilePath);
            }
          },
        });
      } else {
        showToast("error", response.Message || "导出失败");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "系统导出异常";
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  }, [
    currentSheetIndex,
    filePath,
    headerRowEnd,
    headerRowStart,
    mappings,
    setLoading,
    slotConfigs,
    targetColumns,
    templateHeaderRowEnd,
    templateHeaderRowStart,
    templatePath,
    dataRowStart,
  ]);

  const handleDownload = useCallback(async () => {
    const sourceValidation = validateFilePath(filePath, "source");
    if (!sourceValidation.valid) {
      showToast("error", sourceValidation.errors[0]);
      return;
    }

    const templateValidation = validateFilePath(templatePath, "template");
    if (!templateValidation.valid) {
      showToast("error", templateValidation.errors[0]);
      return;
    }

    if (!isHeaderConfirmed) {
      showToast("error", "请先确认源文件表头");
      return;
    }

    if (templateRows.length === 0) {
      showToast("error", "请先上传目标模板");
      return;
    }

    const hasAnyMapping = Object.values(mappings).some((nodes) => nodes.length > 0);
    if (!hasAnyMapping) {
      showToast("error", "请至少完成一个字段映射");
      return;
    }

    const validation = validateMappings(mappings, sourceColumns, rows, slotConfigs, targetColumns);
    if (!validation.valid || validation.warnings.length > 0) {
      setValidationErrors(validation.errors);
      setValidationWarnings(validation.warnings);
      setValidationDialogOpen(true);
      return;
    }

    await performExport();
  }, [
    filePath,
    isHeaderConfirmed,
    mappings,
    performExport,
    rows,
    slotConfigs,
    sourceColumns,
    targetColumns,
    templatePath,
    templateRows.length,
  ]);

  return {
    previewData,
    setPreviewData,
    validationDialogOpen,
    setValidationDialogOpen,
    validationErrors,
    validationWarnings,
    performExport,
    handleDownload,
  };
};
