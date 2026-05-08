import { useState, useCallback, useMemo } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { MappingNode, SlotConfig, TransformStep } from "@/types";
import { generateId, getLeafColumns } from "@/utils/excel";
import { showToast } from "@/utils/toast";
import { usePreviewExport } from "./usePreviewExport";
import { useWorkbookState } from "./useWorkbookState";

export const useExcelMapping = () => {
  const [mappings, setMappings] = useState<Record<string, MappingNode[]>>({});
  const [slotConfigs, setSlotConfigs] = useState<Record<string, SlotConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"source" | "sortable" | null>(null);

  const workbookState = useWorkbookState({
    onMappingsReset: () => setMappings({}),
    onSlotConfigsReset: () => setSlotConfigs({}),
    onPreviewReset: () => previewExport.setPreviewData({}),
    onErrorReset: () => setError(null),
  });

  const previewExport = usePreviewExport({
    mappings,
    slotConfigs,
    rows: workbookState.rows,
    sourceColumns: workbookState.sourceColumns,
    targetColumns: workbookState.targetColumns,
    filePath: workbookState.filePath,
    templatePath: workbookState.templatePath,
    headerRowStart: workbookState.headerRowStart,
    headerRowEnd: workbookState.headerRowEnd,
    templateHeaderRowStart: workbookState.templateHeaderRowStart,
    templateHeaderRowEnd: workbookState.templateHeaderRowEnd,
    currentSheetIndex: workbookState.currentSheetIndex,
    templateRows: workbookState.templateRows,
    isHeaderConfirmed: workbookState.isHeaderConfirmed,
    setLoading: workbookState.setLoading,
  });

  const isSourceMapped = (sourceId: string): boolean => {
    for (const nodes of Object.values(mappings)) {
      for (const node of nodes) {
        if (node.sourceId === sourceId) {
          return true;
        }
      }
    }
    return false;
  };

  const findSourceTargetId = (nodeId: string): string | null => {
    for (const [targetId, nodes] of Object.entries(mappings)) {
      if (nodes.some((node) => node.id === nodeId)) {
        return targetId;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const nextActiveId = event.active.id as string;
    setActiveId(nextActiveId);
    setError(null);

    if (nextActiveId.startsWith("src-")) {
      setActiveType("source");
    } else if (event.active.data?.current?.node) {
      setActiveType("sortable");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveId(null);
    setActiveType(null);

    const draggedId = active.id as string;
    const overId = over?.id as string | undefined;
    const draggedNode = active.data?.current?.node as MappingNode | undefined;

    if (draggedNode) {
      const sourceTargetId = findSourceTargetId(draggedNode.id);
      if (!sourceTargetId) {
        return;
      }

      const sourceNodes = mappings[sourceTargetId] || [];
      if (!overId) {
        return;
      }

      if (overId.startsWith("slot-")) {
        const targetId = overId.replace("slot-", "");
        if (sourceTargetId !== targetId) {
          setMappings((prev) => ({
            ...prev,
            [sourceTargetId]: sourceNodes.filter((node) => node.id !== draggedNode.id),
            [targetId]: [...(prev[targetId] || []), draggedNode],
          }));
        }
        return;
      }

      if (overId.startsWith("mapping-")) {
        const targetTargetId = findSourceTargetId(overId.replace("mapping-", ""));
        if (targetTargetId && sourceTargetId !== targetTargetId) {
          setMappings((prev) => ({
            ...prev,
            [sourceTargetId]: sourceNodes.filter((node) => node.id !== draggedNode.id),
            [targetTargetId]: [...(prev[targetTargetId] || []), draggedNode],
          }));
        }
      }
      return;
    }

    if (!draggedId.startsWith("src-")) {
      return;
    }

    const sourceLabel =
      workbookState.sourceColumns.find((column) => column.id === draggedId)?.label || draggedId;

    if (isSourceMapped(draggedId)) {
      setError("该字段已被映射");
      return;
    }

    if (!overId || (!overId.startsWith("slot-") && !overId.startsWith("mapping-"))) {
      return;
    }

    const targetId = overId.startsWith("slot-")
      ? overId.replace("slot-", "")
      : findSourceTargetId(overId.replace("mapping-", ""));

    if (!targetId) {
      return;
    }

    const nextNode: MappingNode = {
      id: generateId(),
      sourceId: draggedId,
      sourceLabel,
      steps: [],
      forceText: false,
    };

    setMappings((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), nextNode],
    }));
  };

  const handleRemove = useCallback((id: string) => {
    setMappings((prev) => {
      const nextMappings: Record<string, MappingNode[]> = {};
      for (const [targetId, nodes] of Object.entries(prev)) {
        nextMappings[targetId] = nodes.filter((node) => node.id !== id);
      }
      return nextMappings;
    });
    setError(null);
  }, [setError]);

  const handleUpdate = useCallback((id: string, steps: TransformStep[], forceText?: boolean) => {
    setMappings((prev) => {
      const nextMappings = { ...prev };
      for (const [targetId, nodes] of Object.entries(prev)) {
        const targetNode = nodes.find((n) => n.id === id);
        if (targetNode) {
          nextMappings[targetId] = nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  steps,
                  forceText: forceText !== undefined ? forceText : node.forceText,
                }
              : node,
          );
          break;
        }
      }
      return nextMappings;
    });
  }, []);

  const handleUpdateSlotConfig = useCallback((columnId: string, config: SlotConfig) => {
    setSlotConfigs((prev) => ({
      ...prev,
      [columnId]: config,
    }));
  }, [setSlotConfigs]);

  const autoMap = () => {
    if (workbookState.sourceColumns.length === 0 || workbookState.targetColumns.length === 0) {
      showToast("info", "请先上传源文件和模板");
      return;
    }

    const nextMappings = { ...mappings };
    let matchCount = 0;
    const leafColumns = getLeafColumns(workbookState.targetColumns);
    const usedSourceIds = new Set<string>();

    for (const nodes of Object.values(mappings)) {
      for (const node of nodes) {
        usedSourceIds.add(node.sourceId);
      }
    }

    leafColumns.forEach((target) => {
      if ((nextMappings[target.id] || []).length > 0) {
        return;
      }

      const targetName = target.label.trim().toLowerCase();
      const match = workbookState.sourceColumns.find((source) => {
        if (usedSourceIds.has(source.id)) return false;
        const sourceName = source.label.trim().toLowerCase();
        return (
          sourceName === targetName ||
          sourceName.includes(targetName) ||
          targetName.includes(sourceName)
        );
      });

      if (match) {
        nextMappings[target.id] = [
          {
            id: generateId(),
            sourceId: match.id,
            sourceLabel: match.label,
            steps: [],
            forceText: false,
          },
        ];
        usedSourceIds.add(match.id);
        matchCount += 1;
      }
    });

    if (matchCount > 0) {
      setMappings(nextMappings);
      showToast("success", `智能匹配完成，已自动关联 ${matchCount} 个字段`);
      return;
    }

    showToast("info", "未找到名称匹配的字段，请手动拖拽");
  };

  const activeData = useMemo(
    () =>
      activeId?.startsWith("src-")
        ? { label: workbookState.sourceColumns.find((column) => column.id === activeId)?.label }
        : activeType === "sortable"
          ? { label: "已映射项" }
          : null,
    [activeId, activeType, workbookState.sourceColumns],
  );

  return {
    mappings,
    setMappings,
    slotConfigs,
    setSlotConfigs,
    previewData: previewExport.previewData,
    setPreviewData: previewExport.setPreviewData,
    sourceColumns: workbookState.sourceColumns,
    targetColumns: workbookState.targetColumns,
    error,
    setError,
    activeId,
    setActiveId,
    activeType,
    setActiveType,
    loading: workbookState.loading,
    setLoading: workbookState.setLoading,
    FilePath: workbookState.filePath,
    setFilePath: workbookState.setFilePath,
    sheets: workbookState.sheets,
    currentSheetIndex: workbookState.currentSheetIndex,
    last: workbookState.last,
    rows: workbookState.rows,
    headerRowStart: workbookState.headerRowStart,
    setHeaderRowStart: workbookState.setHeaderRowStart,
    headerRowEnd: workbookState.headerRowEnd,
    setHeaderRowEnd: workbookState.setHeaderRowEnd,
    templatePath: workbookState.templatePath,
    templateRows: workbookState.templateRows,
    templateHeaderRowStart: workbookState.templateHeaderRowStart,
    setTemplateHeaderRowStart: workbookState.setTemplateHeaderRowStart,
    templateHeaderRowEnd: workbookState.templateHeaderRowEnd,
    setTemplateHeaderRowEnd: workbookState.setTemplateHeaderRowEnd,
    handleDragStart,
    handleDragEnd,
    handleRemove,
    handleUpdate,
    handleUpdateSlotConfig,
    handleImport: workbookState.handleImport,
    handleSheetChange: (value: number | null) =>
      workbookState.handleSheetChange(value, Object.values(mappings).some((nodes) => nodes.length > 0)),
    handleUploadTemplate: workbookState.handleUploadTemplate,
    handleDownload: previewExport.handleDownload,
    handleLoadFile: workbookState.handleLoadFile,
    confirmHeader: workbookState.confirmHeader,
    skipHeader: workbookState.skipHeader,
    confirmTemplateHeader: workbookState.confirmTemplateHeader,
    activeData,
    isSourceMapped,
    isSheetLoaded: workbookState.isSheetLoaded,
    isHeaderConfirmed: workbookState.isHeaderConfirmed,
    validationDialogOpen: previewExport.validationDialogOpen,
    setValidationDialogOpen: previewExport.setValidationDialogOpen,
    validationErrors: previewExport.validationErrors,
    validationWarnings: previewExport.validationWarnings,
    performExport: previewExport.performExport,
    autoMap,
  };
};
