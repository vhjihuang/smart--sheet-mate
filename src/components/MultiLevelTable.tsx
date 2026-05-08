import React from "react";
import { Eye } from "lucide-react";
import type { TargetColumn, MappingNode, SlotConfig, TransformStep, SourceColumn } from "@/types";
import { getMaxDepth, getLeafColumns, getColumnSpan } from "@/utils/excel";
import { TargetSlot } from "./TargetSlot";

interface MultiLevelTableProps {
  columns: TargetColumn[];
  mappings: Record<string, MappingNode[]>;
  previewData?: Record<string, string[]>; 
  slotConfigs?: Record<string, SlotConfig>;
  firstRow?: string[];
  sourceColumns: SourceColumn[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, steps: TransformStep[], forceText?: boolean) => void;
  onUpdateSlotConfig?: (columnId: string, config: SlotConfig) => void;
}

export const MultiLevelTable = React.memo(({ 
  columns, 
  mappings, 
  previewData = {},
  slotConfigs = {},
  firstRow = [],
  sourceColumns,
  onRemove, 
  onUpdate,
  onUpdateSlotConfig
}: MultiLevelTableProps) => {
  const maxDepth = getMaxDepth(columns);
  const leafColumns = getLeafColumns(columns);

  // 递归渲染表头行
  const renderHeaderRows = (cols: TargetColumn[], currentDepth: number): React.ReactNode => {
    if (currentDepth > maxDepth) return null;

    const cells: React.ReactNode[] = [];
    let currentCols = cols;

    // 只有第一层递归使用全量列，后续层级使用父节点的子节点
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
          className={`border border-gray-200 p-2.5 text-center text-[13px] font-medium text-gray-700 bg-gray-50/80 ${isLeaf ? "min-w-[140px]" : ""}`}
        >
          {col.label}
        </th>,
      );
    }

    const nextCols = currentCols.flatMap((c) => c.children || []);

    return (
      <React.Fragment key={`level-${currentDepth}`}>
        <tr className="h-10">{cells}</tr>
        {currentDepth < maxDepth && nextCols.length > 0 &&
          renderHeaderRows(nextCols, currentDepth + 1)}
      </React.Fragment>
    );
  };

  return (
    <div className="w-full overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full border-collapse border-hidden min-w-max">
        <thead>
          {renderHeaderRows(columns, 1)}
        </thead>
        <tbody>
          <tr className="bg-white">
            {leafColumns.map((col) => (
              <td
                key={col.id}
                className="border border-gray-200 p-2 vertical-top align-top min-w-[140px]"
              >
                <TargetSlot 
                  target={col} 
                  mappings={mappings[col.id] || []} 
                  slotConfig={slotConfigs[col.id]}
                  firstRow={firstRow}
                  sourceColumns={sourceColumns}
                  onRemove={onRemove} 
                  onUpdate={onUpdate} 
                  onUpdateSlotConfig={onUpdateSlotConfig}
                />
              </td>
            ))}
          </tr>
          {/* 实时预览行 */}
          <tr className="bg-gray-50/30" data-preview-row>
            {leafColumns.map((col) => {
              const results = previewData[col.id] || [];
              const hasMappings = (mappings[col.id]?.length || 0) > 0;
              
              return (
                <td key={`preview-${col.id}`} className="border border-gray-200 p-2.5 min-w-[140px] align-top">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <Eye size={10} /> 结果预览
                      </div>
                      {!hasMappings && <span className="text-[10px] text-gray-300 italic">未配置</span>}
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      {hasMappings ? (
                        results.length > 0 ? (
                          results.slice(0, 3).map((res, idx) => (
                            <div key={idx} className="px-2 py-1 bg-white border border-gray-100 rounded text-[11px] text-blue-800 font-mono truncate" title={res}>
                              {res || <span className="text-gray-300 italic">空值</span>}
                            </div>
                          ))
                        ) : (
                          <div className="px-2 py-4 text-center border border-dashed border-gray-200 rounded text-[10px] text-gray-300">
                            等待计算...
                          </div>
                        )
                      ) : (
                        <div className="h-6" /> // 保持高度一致
                      )}
                    </div>
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
});
