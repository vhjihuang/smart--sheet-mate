import { useState, useEffect, useRef } from "react";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import type {
  TargetColumn,
  SourceColumn,
  MappingNode,
  ExcelRow,
  TemplateResponse,
  ExportResponse
} from "@/types";
import { defaultTargetColumns, MAX_NEST_LEVEL, DEFAULT_SLOT_CONFIG } from "@/constants";
import { generateId, parseSourceColumns, getNodeDepth, parseTargetColumnsFromRows } from "@/utils/excel";
import { safeCallParse } from "@/utils/bridge";
import { showToast } from "@/utils/toast";
import type { SlotConfig, TransformStep, PreviewData } from "@/types";

export const useExcelMapping = () => {
  const [mappings, setMappings] = useState<Record<string, MappingNode[]>>({});
  const [slotConfigs, setSlotConfigs] = useState<Record<string, SlotConfig>>({});
  const [previewData, setPreviewData] = useState<Record<string, string[]>>({});
  const [sourceColumns, setSourceColumns] = useState<SourceColumn[]>([]);
  const [targetColumns, setTargetColumns] = useState<TargetColumn[]>(defaultTargetColumns);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"source" | "sortable" | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [FilePath, setFilePath] = useState<string | null>(null);
  const [sheets, setSheets] = useState<{ SheetName: string }[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);
  const [last, setLast] = useState<number>(0);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [isSheetLoaded, setIsSheetLoaded] = useState<boolean>(false);
  
  const [headerRowStart, setHeaderRowStart] = useState<number>(0);
  const [headerRowEnd, setHeaderRowEnd] = useState<number>(0);
  const [isHeaderConfirmed, setIsHeaderConfirmed] = useState<boolean>(false);
  
  const [templatePath, setTemplatePath] = useState<string | null>(null);
  const [templateRows, setTemplateRows] = useState<ExcelRow[]>([]);
  const [templateHeaderRowStart, setTemplateHeaderRowStart] = useState<number>(0);
  const [templateHeaderRowEnd, setTemplateHeaderRowEnd] = useState<number>(0);
  
  const isUserChange = useRef(false);

  useEffect(() => {
    if (FilePath && isUserChange.current) {
      isUserChange.current = false;
      loadSheetData(FilePath, currentSheetIndex || 0, last);
    }
  }, [last]);

  const isSourceMapped = (sourceId: string): boolean => {
    for (const nodes of Object.values(mappings)) {
      const check = (list: MappingNode[]): boolean => {
        for (const node of list) {
          if (node.sourceId === sourceId) return true;
          if (node.children.length > 0 && check(node.children)) return true;
        }
        return false;
      };
      if (check(nodes)) return true;
    }
    return false;
  };

  const findSourceTargetId = (nodeId: string): string | null => {
    for (const [tid, nodes] of Object.entries(mappings)) {
      const findInList = (list: MappingNode[]): boolean => {
        for (const n of list) {
          if (n.id === nodeId) return true;
          if (n.children.length > 0 && findInList(n.children)) return true;
        }
        return false;
      };
      if (findInList(nodes)) return tid;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    setError(null);
    if (id.startsWith("src-")) {
      setActiveType("source");
    } else if (event.active.data?.current?.node) {
      setActiveType("sortable");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveId(null);
    setActiveType(null);

    const activeId = active.id as string;
    const overId = over?.id as string | undefined;

    const draggedNode = active.data?.current?.node as MappingNode | undefined;
    if (draggedNode) {
      const sourceTargetId = findSourceTargetId(draggedNode.id);
      if (!sourceTargetId) return;
      const sourceNodes = mappings[sourceTargetId] || [];

      if (!overId) {
        setMappings((prev) => ({
          ...prev,
          [sourceTargetId]: sourceNodes.filter((n) => n.id !== draggedNode.id),
        }));
        return;
      }

      if (overId.startsWith("slot-")) {
        const targetId = overId.replace("slot-", "");
        if (sourceTargetId !== targetId) {
          setMappings((prev) => ({
            ...prev,
            [sourceTargetId]: sourceNodes.filter((n) => n.id !== draggedNode.id),
            [targetId]: [...(prev[targetId] || []), draggedNode],
          }));
        }
        return;
      }

      if (overId.startsWith("mapping-")) {
        const targetNodeId = overId.replace("mapping-", "");
        const targetTargetId = findSourceTargetId(targetNodeId);
        if (targetTargetId && sourceTargetId !== targetTargetId) {
          setMappings((prev) => ({
            ...prev,
            [sourceTargetId]: sourceNodes.filter((n) => n.id !== draggedNode.id),
            [targetTargetId]: [...(prev[targetTargetId] || []), draggedNode],
          }));
        }
        return;
      }
      return;
    }

    if (!activeId.startsWith("src-")) return;

    const sourceId = activeId;
    const sourceLabel = sourceColumns.find((c) => c.id === activeId)?.label || activeId;

    if (isSourceMapped(sourceId)) {
      setError("该字段已被映射");
      return;
    }

    if (!overId || (!overId.startsWith("slot-") && !overId.startsWith("mapping-"))) return;

    if (overId.startsWith("slot-")) {
      const targetId = overId.replace("slot-", "");
      const newNode: MappingNode = {
        id: generateId(),
        sourceId,
        sourceLabel,
        steps: [],
        children: [],
      };
      setMappings((prev) => ({
        ...prev,
        [targetId]: [...(prev[targetId] || []), newNode],
      }));
      return;
    }

    if (overId.startsWith("mapping-")) {
      const parentId = overId.replace("mapping-", "");
      let parentDepth = -1;
      for (const [_tid, nodes] of Object.entries(mappings)) {
        parentDepth = getNodeDepth(nodes, parentId);
        if (parentDepth >= 0) break;
      }
      
      if (parentDepth >= MAX_NEST_LEVEL - 1) {
        setError(`最多嵌套 ${MAX_NEST_LEVEL} 层`);
        return;
      }

      const newNode: MappingNode = { 
        id: generateId(), 
        sourceId, 
        sourceLabel, 
        steps: [], 
        children: [] 
      };
      const addChildToParent = (nodes: MappingNode[]): MappingNode[] => {
        return nodes.map((node) => {
          if (node.id === parentId) return { ...node, children: [...node.children, newNode] };
          if (node.children.length > 0) return { ...node, children: addChildToParent(node.children) };
          return node;
        });
      };

      setMappings((prev) => {
        const newMappings: Record<string, MappingNode[]> = {};
        for (const [tid, nodes] of Object.entries(prev)) {
          newMappings[tid] = addChildToParent(nodes);
        }
        return newMappings;
      });
    }
  };

  const handleRemove = (id: string) => {
    const findAndRemoveNode = (nodes: MappingNode[], id: string): MappingNode[] => {
      return nodes.filter((node) => node.id !== id).map((node) => ({
        ...node,
        children: findAndRemoveNode(node.children, id),
      }));
    };
    setMappings((prev) => {
      const newMappings: Record<string, MappingNode[]> = {};
      for (const [_tid, nodes] of Object.entries(prev)) {
        newMappings[_tid] = findAndRemoveNode(nodes, id);
      }
      return newMappings;
    });
    setError(null);
  };

  const handleUpdate = (id: string, steps: TransformStep[]) => {
    const findAndUpdateNode = (nodes: MappingNode[], id: string, steps: TransformStep[]): MappingNode[] => {
      return nodes.map((node) => {
        if (node.id === id) return { ...node, steps };
        if (node.children.length > 0) return { ...node, children: findAndUpdateNode(node.children, id, steps) };
        return node;
      });
    };
    setMappings((prev) => {
      const newMappings: Record<string, MappingNode[]> = {};
      for (const [tid, nodes] of Object.entries(prev)) {
        newMappings[tid] = findAndUpdateNode(nodes, id, steps);
      }
      return newMappings;
    });
  };

  const handleUpdateSlotConfig = (columnId: string, config: SlotConfig) => {
    setSlotConfigs(prev => ({
      ...prev,
      [columnId]: config
    }));
  };

  // -------------------------
  // 核心：实时预览逻辑 (防抖调用后端)
  // -------------------------
  const previewTimer = useRef<any>(null);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    
    // 只在有映射时尝试预览
    const hasAnyMapping = Object.values(mappings).some(m => m.length > 0);
    if (!hasAnyMapping) {
      setPreviewData({});
      return;
    }

    previewTimer.current = setTimeout(() => {
      fetchPreviewData();
    }, 600); // 600ms 防抖，避免输入时频繁刷新

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [mappings, slotConfigs]);

  const fetchPreviewData = async () => {
    if (rows.length === 0) return;

    // 准备发送给后端的 Payload
    // 包含：前几行源数据、当前的映射结构、聚合配置
    const payload = {
      SourceSamples: rows.slice(0, 5), // 取前 5 行作为样本
      Mappings: mappings,
      SlotConfigs: slotConfigs
    };

    try {
      // 预留后端空接口: Preview_Transform
      const resp = await safeCallParse("Preview_Transform", payload) as { Results: Record<string, string[]> };
      if (resp && resp.Results) {
        setPreviewData(resp.Results);
      }
    } catch (err) {
      // 如果后端没实现，这里保持安静
      console.warn("Backend Preview_Transform not implemented or failed");
    }
  };

  const loadExcelData = async (filePath: string | null, page: number, lastValue?: number) => {
    if (!filePath) throw new Error("未指定文件路径");
    const lastParam = lastValue !== undefined ? lastValue : last;
    return safeCallParse("Excel_Original_Load", { FilePath: filePath, Page: page, Last: lastParam });
  };

  const loadSheetData = async (filePath: string | null, sheetIndex?: number, lastValue?: number) => {
    if (!filePath) return;
    setLoading(true);
    try {
      const targetPage = sheetIndex !== undefined ? sheetIndex : 0;
      const data = await loadExcelData(filePath, targetPage, lastValue);
      if (data.LoadStatus === 1) {
        if (data.Data?.Sheets) {
          if (data.Data.Sheets.length === 1) {
            const page = 1;
            setCurrentSheetIndex(page);
            const singleData = await loadExcelData(filePath, page, lastValue);
            if (singleData.Data) {
              if (singleData.Data.Rows?.length > 0) {
                const titles = singleData.Data.Rows[0].DataList;
                setSourceColumns(titles.map((t: string, i: number) => ({ id: `src-${i}`, label: t || `列${i + 1}` })));
                setRows(singleData.Data.Rows);
              }
              if (singleData.Data.Last !== undefined) setLast(singleData.Data.Last);
            }
          } else {
            setSheets(data.Data.Sheets);
          }
        } else if (data.Data) {
          if (data.Data.Rows?.length > 0) {
            const titles = data.Data.Rows[0].DataList;
            setSourceColumns(titles.map((t: string, i: number) => ({ id: `src-${i}`, label: t || `列${i + 1}` })));
            setRows(data.Data.Rows);
          }
          if (data.Data.Last !== undefined) setLast(data.Data.Last);
        }
        setIsSheetLoaded(true);
      showToast("success", data.Message || "加载成功");
    } else {
      showToast("error", data.Message || "加载失败");
    }
  } catch (err: any) {
    showToast("error", err.message || "通信失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = async (value: number | null) => {
    if (value === null) return;
    const page = value + 1;
    setCurrentSheetIndex(page);
    setRows([]);
    setIsSheetLoaded(false);
    setIsHeaderConfirmed(false);
  };

  const handleImport = async () => {
    try {
      const resp = await safeCallParse("Excel_Original_Select");
      if (resp.SelectStatus === 1) {
        setFilePath(resp.FilePath);
        setSheets([]);
        setRows([]);
        setMappings({});
        setHeaderRowStart(0);
        setHeaderRowEnd(0);
        setIsSheetLoaded(false);
        setIsHeaderConfirmed(false);
      } else {
        showToast("error", resp.Message || "选择失败");
      }
    } catch (err: any) {
      showToast("error", err.message || "导入失败");
    }
  };

  const handleLoadFile = async () => {
    if (!FilePath) {
      showToast("error", "请先选择源文件");
      return;
    }
    await loadSheetData(FilePath, currentSheetIndex);
  };

  const handleUploadTemplate = async () => {
    setLoading(true);
    try {
      const resp = await safeCallParse("Excel_Template_Load") as TemplateResponse;
      
      // 检查加载状态
      if (resp.LoadStatus !== 1) {
        showToast("error", resp.Message || "模板加载失败");
        return;
      }

      // 检查 Template 数据是否存在
      if (!resp.Template) {
        showToast("error", "模板数据为空");
        return;
      }

      setTemplatePath(resp.FilePath || null);

      // 转换模板数据为内部格式
      if (resp.Template.Sheets?.length > 0) {
        const firstSheet = resp.Template.Sheets[0];
        const convertedRows: ExcelRow[] = firstSheet.Rows.map(row => ({
          Index: row.I,
          DataList: row.R.map(cell => cell.D)
        }));
        setTemplateRows(convertedRows);
      } else {
        setTemplateRows([]);
      }

      showToast("success", resp.Message || "模板加载成功");
    } catch (error) {
      showToast("error", "模板加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!isHeaderConfirmed) {
      showToast("error", "请先确认源文件表头");
      return;
    }
    if (templateRows.length === 0) {
      showToast("error", "请先上传目标模板");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        SourcePath: FilePath,
        TemplatePath: templatePath,
        SourceHeaderRows: {
          Start: headerRowStart,
          End: headerRowEnd
        },
        TemplateHeaderRows: {
          Start: templateHeaderRowStart,
          End: templateHeaderRowEnd
        },
        CurrentSheetIndex: currentSheetIndex,
        Mappings: mappings
      };

      console.log("准备导出，Payload:", payload);

      // 后端导出功能开发中，暂存逻辑
      showToast("info", "导出功能开发中，逻辑已在前端预留");

      /*
      const resp = await safeCallParse("Excel_Export", payload) as ExportResponse;
      if (resp.Status === 1) {
        showToast("success", resp.Message || "导出成功");
      } else {
        showToast("error", resp.Message || "导出失败");
      }
      */
    } catch (error: any) {
      showToast("error", error.message || "导出异常");
    } finally {
      setLoading(false);
    }
  };

  const confirmHeader = async () => {
    const data = await safeCallParse("Excel_SetHeaderRows", {
      FilePath,
      HeaderRowStart: headerRowStart,
      HeaderRowEnd: headerRowEnd
    });
    if (data.Status === 1) {
      setSourceColumns(parseSourceColumns(rows, headerRowStart, headerRowEnd));
      setMappings({});
      setIsHeaderConfirmed(true);
      showToast("success", "表头已确认");
    } else {
      showToast("error", data.Message || "表头设置失败");
    }
  };

  const skipHeader = () => {
    setHeaderRowStart(0);
    setHeaderRowEnd(0);
    setSourceColumns(parseSourceColumns(rows, 0, 0));
    setMappings({});
    showToast("success", "已跳过");
  };

  const confirmTemplateHeader = async () => {
    // 解析模板表头生成 targetColumns
    const newTargetColumns = parseTargetColumnsFromRows(
      templateRows,
      templateHeaderRowStart,
      templateHeaderRowEnd
    );
    setTargetColumns(newTargetColumns);

    // 清空之前的映射（因为列结构变了）
    setMappings({});

    // 调用后端接口（如果存在）
    try {
      const data = await safeCallParse("Excel_SetTemplateHeaderRows", {
        FilePath: templatePath,
        HeaderRowStart: templateHeaderRowStart,
        HeaderRowEnd: templateHeaderRowEnd
      });
      if (data.Status === 1) {
        showToast("success", "模板表头已确认，目标列已更新");
      } else {
        showToast("error", data.Message || "模板表头设置失败");
      }
    } catch (error) {
      // 后端接口可能不存在，只显示前端更新成功
      showToast("success", "模板表头已确认，目标列已更新");
    }
  };

  const activeData = activeId?.startsWith("src-") 
    ? { label: sourceColumns.find((c) => c.id === activeId)?.label } 
    : activeType === "sortable" ? { label: "已映射项" } : null;

  return {
    mappings, setMappings,
    slotConfigs, setSlotConfigs,
    previewData, setPreviewData,
    sourceColumns, setSourceColumns,
    targetColumns, setTargetColumns,
    error, setError,
    activeId, setActiveId,
    activeType, setActiveType,
    loading, setLoading,
    FilePath, setFilePath,
    sheets, setSheets,
    currentSheetIndex, setCurrentSheetIndex,
    last, setLast,
    rows, setRows,
    headerRowStart, setHeaderRowStart,
    headerRowEnd, setHeaderRowEnd,
    templatePath, setTemplatePath,
    templateRows, setTemplateRows,
    templateHeaderRowStart, setTemplateHeaderRowStart,
    templateHeaderRowEnd, setTemplateHeaderRowEnd,
    isUserChange,
    handleDragStart, handleDragEnd,
    handleRemove, handleUpdate,
    handleUpdateSlotConfig,
    handleImport, handleSheetChange,
    handleUploadTemplate, handleDownload,
    handleLoadFile,
    confirmHeader, skipHeader,
    confirmTemplateHeader,
    activeData,
    isSourceMapped,
    isSheetLoaded,
    isHeaderConfirmed
  };
};
