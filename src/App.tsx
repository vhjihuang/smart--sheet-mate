import { useState, useEffect, useRef } from "react";
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { Settings, X, Download, Upload } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { safeCall } from "./utils/goBridge.js";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// 多级目标列

interface TargetColumn {
  id: string;
  label: string;
  children?: TargetColumn[];
  isGroup?: boolean;
}

// 源字段（保持扁平）
interface SourceColumn {
  id: string;
  label: string;
}



// 多级目标列
// 默认目标列（可从后端获取更新）
const defaultTargetColumns: TargetColumn[] = [
  {
    id: "target-user",
    label: "用户信息",
    isGroup: true,
    children: [
      {
        id: "target-basic",
        label: "基本信息",
        isGroup: true,
        children: [
          { id: "target-name", label: "name" },
          { id: "target-gender", label: "gender" },
          { id: "target-age", label: "age" },
        ],
      },
      {
        id: "target-contact",
        label: "联系方式",
        isGroup: true,
        children: [
          { id: "target-phone", label: "phone" },
          { id: "target-email", label: "email" },
        ],
      },
    ],
  },
  { id: "target-note", label: "note" },
  { id: "target-address", label: "address" },
];

interface MappingNode {
  id: string;
  sourceId: string;
  sourceLabel: string;
  transform: string;
  children: MappingNode[];
}

const MAX_NEST_LEVEL = 3;

// 自定义碰撞检测：closestCenter + 边界检测
const customCollisionDetection = (args: any) => {
  const collisions = closestCenter(args);

  // 获取映射容器的边界
  const mappingContainer = document.querySelector('[data-mapping-container="true"]');
  if (mappingContainer) {
    const rect = mappingContainer.getBoundingClientRect();
    const { pointerCoordinates } = args;

    // 如果鼠标在映射容器外，返回空数组（表示拖出映射区）
    if (pointerCoordinates && (pointerCoordinates.x < rect.left || pointerCoordinates.x > rect.right || pointerCoordinates.y < rect.top || pointerCoordinates.y > rect.bottom)) {
      return [];
    }
  }

  return collisions;
};

const columnStyle: React.CSSProperties = {
  padding: "8px 16px",
  border: "1px solid #e5e5e5",
  borderRadius: "6px",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  cursor: "grab",
  fontSize: "14px",
};

const DraggableItem = ({ id, name, isDisabled }: { id: string; name: string; isDisabled?: boolean }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: isDisabled ? "" : id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...columnStyle,
        opacity: isDragging ? 0.5 : isDisabled ? 0.4 : 1,
        cursor: isDisabled ? "not-allowed" : "grab",
      }}
    >
      {name}
    </div>
  );
};

// 获取所有叶子列（可放置的列）
const getLeafColumns = (columns: TargetColumn[]): TargetColumn[] => {
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
const getColumnDepth = (column: TargetColumn): number => {
  if (!column.children || column.children.length === 0) return 1;
  return Math.max(...column.children.map(getColumnDepth)) + 1;
};

// 计算最大深度
const getMaxDepth = (columns: TargetColumn[]): number => {
  return Math.max(...columns.map(getColumnDepth));
};

// 计算列的跨度（叶子节点数量）
const getColumnSpan = (column: TargetColumn): number => {
  if (!column.children || column.children.length === 0) return 1;
  return column.children.reduce((sum, child) => sum + getColumnSpan(child), 0);
};

// 源数据表格（映射区）
const SourceDataTable = ({ 
  sourceColumns, 
  rows 
}: { 
  sourceColumns: { id: string; label: string }[]; 
  rows: { DataList: string[]; Index: number }[] 
}) => {
  return (
    <table style={{ borderCollapse: "collapse", minWidth: "100%", whiteSpace: "nowrap" }}>
      <thead>
        <tr>
          {sourceColumns.map((col) => (
            <th
              key={col.id}
              style={{
                border: "1px solid #e5e5e5",
                padding: "12px",
                textAlign: "left",
                fontSize: "14px",
                fontWeight: 500,
                color: "#333",
                background: "#f5f5f5",
                minWidth: "120px",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(1).map((row) => (
          <tr key={row.Index}>
            {sourceColumns.map((_, colIndex) => (
              <td
                key={`col-${colIndex}-${row.Index}`}
                style={{
                  border: "1px solid #e5e5e5",
                  padding: "8px",
                  fontSize: "13px",
                  color: "#333",
                  background: "#fff",
                  minWidth: "120px",
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.DataList[colIndex] || ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// 多级表头渲染（模板区）
const MultiLevelTable = ({ columns, mappings }: { columns: TargetColumn[]; mappings: Record<string, MappingNode[]> }) => {
  const maxDepth = getMaxDepth(columns);
  const leafColumns = getLeafColumns(columns);

  // 递归渲染表头行
  const renderHeaderRows = (cols: TargetColumn[], currentDepth: number): React.ReactNode => {
    if (currentDepth > maxDepth) return null;

    const cells: React.ReactNode[] = [];
    let currentCols = cols;

    if (currentDepth === 1) {
      currentCols = columns;
    }

    for (const col of currentCols) {
      const colSpan = getColumnSpan(col);
      const isLeaf = !col.children || col.children.length === 0;

      cells.push(
        <th
          key={col.id}
          rowSpan={isLeaf ? maxDepth - currentDepth + 1 : 1}
          colSpan={isLeaf ? 1 : colSpan}
          style={{
            border: "1px solid #e5e5e5",
            padding: "12px",
            textAlign: "left",
            fontSize: "14px",
            fontWeight: 500,
            color: "#333",
            background: "#f5f5f5",
          }}
        >
          {col.label}
        </th>,
      );
    }

    return (
      <>
        <tr>{cells}</tr>
        {currentDepth < maxDepth &&
          renderHeaderRows(
            cols.flatMap((c) => c.children || []),
            currentDepth + 1,
          )}
      </>
    );
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>{renderHeaderRows(columns, 1)}</thead>
      <tbody>
        <tr>
          {leafColumns.map((col) => {
            const colMappings = mappings[col.id] || [];
            return (
              <td
                key={col.id}
                style={{
                  border: "1px solid #e5e5e5",
                  padding: "8px",
                  minHeight: "60px",
                  background: "#e0f2fe",
                  verticalAlign: "top",
                }}
              >
                {colMappings.map((node) => (
                  <div
                    key={node.id}
                    style={{
                      background: "#3b82f6",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      marginBottom: "4px",
                    }}
                  >
                    {node.sourceLabel}
                  </div>
                ))}
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
};

// 渲染单个放置槽
const TargetSlot = ({ target, mappings, onRemove, onUpdate }: { target: TargetColumn; mappings: MappingNode[]; onRemove: (id: string) => void; onUpdate: (id: string, transform: string) => void }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${target.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minWidth: "80px",
        minHeight: "80px",
        borderLeft: isOver ? "2px solid #3b82f6" : "1px solid #d1d5db",
        borderRight: isOver ? "2px solid #3b82f6" : "1px solid #d1d5db",
        borderTop: isOver ? "2px solid #3b82f6" : "1px solid #d1d5db",
        borderBottom: isOver ? "2px solid #3b82f6" : "1px solid #d1d5db",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8px",
        transition: "all 0.2s",
        background: isOver ? "#dbeafe" : "#f9fafb",
        boxShadow: isOver ? "inset 0 0 0 2px #3b82f6" : "none",
      }}
    >
      {mappings.length === 0 ? (
        <span style={{ fontSize: "10px", color: "#bbb" }}>拖入字段</span>
      ) : (
        <SortableContext items={mappings.map((m) => m.id)} strategy={horizontalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
            {mappings.map((node) => (
              <SortableItem key={node.id} node={node} onRemove={onRemove} onUpdate={onUpdate} canNest={true} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

// 递归渲染目标列组
const TargetColumnGroup = ({
  column,
  mappings,
  onRemove,
  onUpdate,
  depth = 0,
}: {
  column: TargetColumn;
  mappings: Record<string, MappingNode[]>;
  onRemove: (id: string) => void;
  onUpdate: (id: string, transform: string) => void;
  depth?: number;
}) => {
  if (column.children && column.children.length > 0) {
    // 分组列
    const colSpan = getColumnSpan(column);

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: colSpan }}>
        {/* 分组标题 */}
        <div
          style={{
            background: depth === 0 ? "#e5e7eb" : "#f3f4f6",
            padding: "8px 12px",
            borderBottom: "1px solid #d1d5db",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            fontSize: "12px",
            fontWeight: 500,
            minHeight: "32px",
          }}
        >
          {column.label}
        </div>
        {/* 子列容器 */}
        <div style={{ display: "flex", flex: 1 }}>
          {column.children.map((child) => (
            <TargetColumnGroup key={child.id} column={child} mappings={mappings} onRemove={onRemove} onUpdate={onUpdate} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  // 叶子列
  return <TargetSlot target={column} mappings={mappings[column.id] || []} onRemove={onRemove} onUpdate={onUpdate} />;
};

const SortableItem = ({ node, onRemove, onUpdate, canNest }: { node: MappingNode; onRemove: (id: string) => void; onUpdate: (id: string, transform: string) => void; canNest: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id, data: { node } });

  // 嵌套放置区域
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: canNest ? `mapping-${node.id}` : "",
    disabled: !canNest,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} {...attributes} style={style}>
      <div
        ref={canNest ? setDroppableRef : undefined}
        {...listeners}
        style={{
          border: "1px solid #3b82f6",
          borderRadius: "4px",
          background: isOver ? "#1d4ed8" : "#3b82f6",
          color: "#fff",
          padding: "6px 10px",
          fontSize: "12px",
          position: "relative",
          minWidth: "60px",
          cursor: "grab",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>{node.sourceLabel}</span>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  color: "#fff",
                  opacity: 0.8,
                }}
              >
                <Settings size={10} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                style={{
                  background: "#fff",
                  padding: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  borderRadius: "8px",
                  border: "1px solid #e5e5e5",
                  width: "160px",
                  zIndex: 50,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input
                    autoFocus
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      width: "100%",
                      border: "1px solid #e5e5e5",
                      borderRadius: "4px",
                      padding: "6px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "#000",
                    }}
                    placeholder="转换函数"
                    value={node.transform}
                    onChange={(e) => onUpdate(node.id, e.target.value)}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Popover.Close asChild>
                      <button
                        style={{
                          flex: 1,
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "6px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        确认
                      </button>
                    </Popover.Close>
                    <button
                      onClick={() => onRemove(node.id)}
                      style={{
                        color: "#ef4444",
                        fontSize: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <X size={10} /> 删除
                    </button>
                  </div>
                </div>
                <Popover.Arrow style={{ fill: "#fff" }} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        {node.children.length > 0 && (
          <div style={{ marginTop: "4px", paddingLeft: "8px", borderLeft: "2px solid rgba(255,255,255,0.3)" }}>
            {node.children.map((child) => (
              <SortableItem key={child.id} node={child} onRemove={onRemove} onUpdate={onUpdate} canNest={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
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
  const [rows, setRows] = useState<{ DataList: string[]; Index: number }[]>([]);
  
  // 用于追踪是否是用户手动修改 last
  const isUserChange = useRef(false);

  // 监听 last 变化自动发起请求
  useEffect(() => {
    console.log('[useEffect] last changed:', last, 'FilePath:', FilePath, 'isUserChange:', isUserChange.current);
    if (FilePath && isUserChange.current) {
      isUserChange.current = false;
      handleExport(currentSheetIndex || 0, last);
    }
  }, [last]);

  const generateId = () => `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

  const getNodeDepth = (nodes: MappingNode[], targetId: string, currentDepth = 0): number => {
    for (const node of nodes) {
      if (node.id === targetId) return currentDepth;
      if (node.children.length > 0) {
        const depth = getNodeDepth(node.children, targetId, currentDepth + 1);
        if (depth >= 0) return depth;
      }
    }
    return -1;
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

  const handleDragStart = (event: { active: { id: string; data?: { current?: { node: MappingNode } } } }) => {
    const id = event.active.id as string;
    setActiveId(id);
    setError(null);
    if (id.startsWith("src-")) {
      setActiveType("source");
    } else if (event.active.data?.current?.node) {
      setActiveType("sortable");
    }
  };

  const handleDragEnd = (event: { over: { id: string } | null; active: { id: string; data?: { current?: { node: MappingNode; index: number } } } }) => {
    const { over, active } = event;
    console.log("DragEnd:", {
      activeId: active.id,
      overId: over?.id,
      hasNode: !!active.data?.current?.node,
    });

    setActiveId(null);
    setActiveType(null);

    const activeId = active.id as string;
    const overId = over?.id as string | undefined;

    // 处理已映射项的移动/删除（通过查找 mappings 来判断）
    const draggedNode = active.data?.current?.node as MappingNode | undefined;
    if (draggedNode) {
      const sourceTargetId = findSourceTargetId(draggedNode.id);
      if (!sourceTargetId) return;

      // 获取源列的节点列表和当前索引
      const sourceNodes = mappings[sourceTargetId] || [];
      const fromIndex = sourceNodes.findIndex((n) => n.id === draggedNode.id);
      if (fromIndex === -1) return;

      // 拖出映射区（over 为 null）→ 删除
      if (!overId) {
        setMappings((prev) => ({
          ...prev,
          [sourceTargetId]: sourceNodes.filter((n) => n.id !== draggedNode.id),
        }));
        return;
      }

      // 拖到另一个 slot
      if (overId.startsWith("slot-")) {
        const targetId = overId.replace("slot-", "");

        if (sourceTargetId === targetId) {
          // 同列内移动 - 已由 SortableContext 处理
          return;
        } else {
          // 跨列移动
          setMappings((prev) => ({
            ...prev,
            [sourceTargetId]: sourceNodes.filter((n) => n.id !== draggedNode.id),
            [targetId]: [...(prev[targetId] || []), draggedNode],
          }));
        }
        return;
      }

      // 拖到另一个已映射项上
      if (overId.startsWith("mapping-")) {
        const targetNodeId = overId.replace("mapping-", "");
        const targetTargetId = findSourceTargetId(targetNodeId);

        if (targetTargetId) {
          if (sourceTargetId === targetTargetId) {
            // 同列排序 - 已由 SortableContext 处理
            return;
          } else {
            // 跨列移动
            setMappings((prev) => ({
              ...prev,
              [sourceTargetId]: sourceNodes.filter((n) => n.id !== draggedNode.id),
              [targetTargetId]: [...(prev[targetTargetId] || []), draggedNode],
            }));
          }
        }
        return;
      }

      return;
    }

    // 处理从源字段拖入
    if (!activeId.startsWith("src-")) return;

    const sourceId = activeId;
    const sourceLabel = sourceColumns.find((c) => c.id === activeId)?.label || activeId;

    if (isSourceMapped(sourceId)) {
      setError("该字段已被映射");
      return;
    }

    // 没有放到有效区域
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

      const isDescendant = (parentId: string, childId: string): boolean => {
        for (const nodes of Object.values(mappings)) {
          const find = (list: MappingNode[]): boolean => {
            for (const node of list) {
              if (node.id === parentId && node.children.some((c) => c.id === childId)) return true;
              if (find(node.children)) return true;
            }
            return false;
          };
          if (find(nodes)) return true;
        }
        return false;
      };

      if (isDescendant(parentId, sourceId)) {
        setError("不能嵌套到自己或子孙节点上");
        return;
      }

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
        transform: "",
        children: [],
      };

      const addChildToParent = (nodes: MappingNode[]): MappingNode[] => {
        return nodes.map((node) => {
          if (node.id === parentId) {
            return { ...node, children: [...node.children, newNode] };
          }
          if (node.children.length > 0) {
            return { ...node, children: addChildToParent(node.children) };
          }
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

  const findAndRemoveNode = (nodes: MappingNode[], id: string): MappingNode[] => {
    return nodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        ...node,
        children: findAndRemoveNode(node.children, id),
      }));
  };

  const handleRemove = (id: string) => {
    setMappings((prev) => {
      const newMappings: Record<string, MappingNode[]> = {};
      for (const [_tid, nodes] of Object.entries(prev)) {
        newMappings[_tid] = findAndRemoveNode(nodes, id);
      }
      return newMappings;
    });
    setError(null);
  };

  const findAndUpdateNode = (nodes: MappingNode[], id: string, transform: string): MappingNode[] => {
    return nodes.map((node) => {
      if (node.id === id) {
        return { ...node, transform };
      }
      if (node.children.length > 0) {
        return { ...node, children: findAndUpdateNode(node.children, id, transform) };
      }
      return node;
    });
  };

  const handleUpdate = (id: string, transform: string) => {
    setMappings((prev) => {
      const newMappings: Record<string, MappingNode[]> = {};
      for (const [tid, nodes] of Object.entries(prev)) {
        newMappings[tid] = findAndUpdateNode(nodes, id, transform);
      }
      return newMappings;
    });
  };

  // 通用调用+解析函数
  const safeCallParse = async (method: string, params?: object) => {
    console.log(`[safeCall] ${method}`, params);
    const resopne = params 
      ? await safeCall("main", method, JSON.stringify(params))
      : await safeCall("main", method);
    console.log(`[safeCall] ${method} response:`, resopne);
    return JSON.parse(resopne);
  };

  // 通用加载Excel数据函数
  const loadExcelData = async (page: number, lastValue?: number) => {
    const lastParam = lastValue !== undefined ? lastValue : last;
    return safeCallParse("Excel_Original_Load", {
      FilePath: FilePath,
      Page: page,
      Last: lastParam
    });
  };

  // 加载excel
  const handleExport = async (sheetIndex?: number, lastValue?: number) => {
    setLoading(true);
    const data = await loadExcelData(sheetIndex !== undefined ? sheetIndex : 0, lastValue);
    console.log('[handleExport] data:', data);
    try {
      switch (data.LoadStatus) {
        case 1:
          if (data.Data?.Sheets) {
            if (data.Data.Sheets.length === 1) {
              const page = 1;
              setCurrentSheetIndex(page);
              const singleData = await loadExcelData(page, lastValue);
              console.log('[handleExport] singleData:', singleData);
              if (singleData.Data) {
                // 从 Rows[0].DataList 提取标题
                if (singleData.Data.Rows && singleData.Data.Rows.length > 0) {
                  const titles = singleData.Data.Rows[0].DataList;
                  setSourceColumns(titles.map((title: string, index: number) => ({
                    id: `src-${index}`,
                    label: title
                  })));
                  setRows(singleData.Data.Rows);
                }
                if (singleData.Data.Last !== undefined) {
                  setLast(singleData.Data.Last);
                }
              }
            } else {
              setSheets(data.Data.Sheets);
            }
          } else if (data.Data) {
            // 从 Rows[0].DataList 提取标题
            if (data.Data.Rows && data.Data.Rows.length > 0) {
              const titles = data.Data.Rows[0].DataList;
              setSourceColumns(titles.map((title: string, index: number) => ({
                id: `src-${index}`,
                label: title
              })));
              setRows(data.Data.Rows);
            }
            if (data.Data.Last !== undefined) {
              setLast(data.Data.Last);
            }
          }
          toast.success(data.Message || "加载成功");
          break;
        case 0:
          toast.error("未选择文件");
          break;
        default:
          toast.error(data.Message);
          break;
      }
    } catch (error) {}
    setLoading(false);
  };

  const handleSheetChange = async (value: number | null) => {
    if (value === null) return;
    const page = value + 1;
    setCurrentSheetIndex(page);
    setLoading(true);
    const data = await loadExcelData(page, last);
    console.log('[handleSheetChange] data:', data);
    try {
      if (data.LoadStatus === 1 && data.Data) {
        // 从 Rows[0].DataList 提取标题
        if (data.Data.Rows && data.Data.Rows.length > 0) {
          const titles = data.Data.Rows[0].DataList;
          setSourceColumns(titles.map((title: string, index: number) => ({
            id: `src-${index}`,
            label: title
          })));
          setRows(data.Data.Rows);
        }
        if (data.Data.Last !== undefined) {
          setLast(data.Data.Last);
        }
        toast.success(data.Message || "加载成功");
      } else if (data.LoadStatus === 0) {
        toast.error("未选择文件");
      } else {
        toast.error(data.Message);
      }
    } catch (error) {}
    setLoading(false);
  };

  // 选择excel
   /**
   * SelectStatus,success: code: 1 (成功) , unselect: code: 0 (未选择文件), error: 其他
   * {"SelectStatus":-999,"FilePath":"C:\\Users\\Administrator\\Desktop\\Demo\\Resources\\Runtime.Webview2","Message":"不支持的文件格式"}
   */
  const handleImport = async () => {
    setLoading(true);
    const { SelectStatus, FilePath, Message } = await safeCallParse("Excel_Original_Select")
    try {
      switch (SelectStatus) {
        case 1:
          setFilePath(FilePath)
          break;
        case 0:
          toast.error("未选择文件");
          break;
        default:
          toast.error(Message);
          break;
      }
    } catch (error) {}
    setLoading(false);
  };

  // 下载映射配置
  const handleDownload = () => {
    // TODO: 实现下载逻辑
  };

  // 上传模板
  const handleUploadTemplate = () => {
    // TODO: 实现上传模板逻辑
  };

  const activeData = activeId?.startsWith("src-") ? { label: sourceColumns.find((c) => c.id === activeId)?.label } : activeType === "sortable" ? { label: "已映射项" } : null;

  return (
    <DndContext onDragStart={handleDragStart as any} onDragEnd={handleDragEnd as any} collisionDetection={customCollisionDetection}>
      <DragOverlay>{activeId && activeData ? <div style={{ ...columnStyle, background: "#3b82f6", color: "#fff" }}>{activeData.label}</div> : null}</DragOverlay>

      <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto", padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#dc2626", fontSize: "13px" }}>{error}</div>}

        <Toaster position="bottom-left" richColors expand={false} closeButton={false} />

        {/* 导入导出按钮 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Button 
              onClick={handleImport} 
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Upload size={14} />
              选择Excel
            </Button>
            <div style={{ fontSize: "13px", color: "#666" }}>{FilePath}</div>
          </div>

          {FilePath ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {sheets.length > 1 && (
                <Select value={(currentSheetIndex - 1).toString()} onValueChange={(value) => handleSheetChange(value ? parseInt(value) : null)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="选择Sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((sheet, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {sheet.SheetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button 
                onClick={() => handleExport()} 
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Download size={14} />
                {loading ? "加载中..." : "加载Excel"}
              </Button>
            </div>
          ) : null}
        </div>

        {/* 分页控制区 */}
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "8px", padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
          <span style={{ fontSize: "13px", color: "#666", fontWeight: 500 }}>Last分页:</span>
          <input
            type="number"
            value={last}
            onChange={(e) => {
              isUserChange.current = true;
              setLast(parseInt(e.target.value) || 0);
            }}
            style={{
              width: "80px",
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              textAlign: "center",
            }}
            min="0"
          />
          <span style={{ fontSize: "12px", color: "#999", marginLeft: "8px" }}>
            (0=仅标题, &gt;0=数据行数，自动加载)
          </span>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", background: "#fff", padding: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: "12px", textTransform: "uppercase" }}>Excel 源字段 (拖拽到下方)</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {sourceColumns.map((col) => (
              <DraggableItem key={col.id} id={col.id} name={col.label} isDisabled={isSourceMapped(col.id)} />
            ))}
          </div>
        </div>

        {/* 映射区 - 显示源数据表格 */}
        <div
          data-mapping-container="true"
          style={{
            border: "2px solid #e5e5e5",
            borderRadius: "8px",
            background: "#fafafa",
            overflow: "auto",
            maxHeight: "300px",
          }}
        >
          <SourceDataTable sourceColumns={sourceColumns} rows={rows} />
        </div>

        {/* 上传模板按钮 - 映射区和模板表中间，靠左 */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button onClick={handleUploadTemplate} className="bg-blue-500 hover:bg-blue-600 text-white">
            <Upload size={14} />
            上传模板
          </Button>
        </div>

        {/* 模板表 - 有滚动条 */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", overflow: "auto", maxHeight: "400px" }}>
          <MultiLevelTable columns={targetColumns} mappings={mappings} />
        </div>

        {/* 下载按钮 - 模板表下面，靠右 */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleDownload} className="bg-green-500 hover:bg-green-600 text-white">
            <Download size={14} />
            下载
          </Button>
        </div>

        {/* <div style={{ padding: "16px", background: "#1e293b", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace", color: "#4ade80" }}>
          <pre>{JSON.stringify(mappings, null, 2)}</pre>
        </div> */}
      </div>
    </DndContext>
  );
}

export default App;
