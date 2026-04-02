import { useState, useEffect, useRef } from "react";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import type { 
  TargetColumn, 
  SourceColumn, 
  MappingNode, 
  ExcelRow,
  TemplateResponse
} from "@/types";
import { defaultTargetColumns, MAX_NEST_LEVEL } from "@/constants";
import { generateId, parseSourceColumns, getNodeDepth, parseTargetColumnsFromRows } from "@/utils/excel";
import { safeCallParse } from "@/utils/bridge";

export const useExcelMapping = () => {
  const [mappings, setMappings] = useState<Record<string, MappingNode[]>>({});
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
        transform: "",
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

      const newNode: MappingNode = { id: generateId(), sourceId, sourceLabel, transform: "", children: [] };
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

  const handleUpdate = (id: string, transform: string) => {
    const findAndUpdateNode = (nodes: MappingNode[], id: string, transform: string): MappingNode[] => {
      return nodes.map((node) => {
        if (node.id === id) return { ...node, transform };
        if (node.children.length > 0) return { ...node, children: findAndUpdateNode(node.children, id, transform) };
        return node;
      });
    };
    setMappings((prev) => {
      const newMappings: Record<string, MappingNode[]> = {};
      for (const [tid, nodes] of Object.entries(prev)) {
        newMappings[tid] = findAndUpdateNode(nodes, id, transform);
      }
      return newMappings;
    });
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
        toast.success(data.Message || "加载成功");
      } else {
        toast.error(data.Message || "加载失败");
      }
    } catch (err: any) {
      toast.error(err.message || "通信失败");
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
        toast.error(resp.Message || "选择失败");
      }
    } catch (err: any) {
      toast.error(err.message || "导入失败");
    }
  };

  const handleLoadFile = async () => {
    if (!FilePath) {
      toast.error("请先选择源文件");
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
        toast.error(resp.Message || "模板加载失败");
        return;
      }
      
      // 检查 Template 数据是否存在
      if (!resp.Template) {
        toast.error("模板数据为空");
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
      
      toast.success(resp.Message || "模板加载成功");
    } catch (error) {
      toast.error("模板加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // TODO: Implementation
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
      toast.success("表头已确认");
    } else {
      toast.error(data.Message || "表头设置失败");
    }
  };

  const skipHeader = () => {
    setHeaderRowStart(0);
    setHeaderRowEnd(0);
    setSourceColumns(parseSourceColumns(rows, 0, 0));
    setMappings({});
    toast.success("已跳过");
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
        toast.success("模板表头已确认，目标列已更新");
      } else {
        toast.error(data.Message || "模板表头设置失败");
      }
    } catch (error) {
      // 后端接口可能不存在，只显示前端更新成功
      toast.success("模板表头已确认，目标列已更新");
    }
  };

  const activeData = activeId?.startsWith("src-") 
    ? { label: sourceColumns.find((c) => c.id === activeId)?.label } 
    : activeType === "sortable" ? { label: "已映射项" } : null;

  return {
    mappings, setMappings,
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
