import React from "react";
import type { TargetColumn, MappingNode } from "@/types";
import { getMaxDepth, getLeafColumns, getColumnSpan } from "@/utils/excel";
import { TargetSlot } from "./TargetSlot";

interface MultiLevelTableProps {
  columns: TargetColumn[];
  mappings: Record<string, MappingNode[]>;
  onRemove: (id: string) => void;
  onUpdate: (id: string, transform: string) => void;
}

export const MultiLevelTable = ({ 
  columns, 
  mappings, 
  onRemove, 
  onUpdate 
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
                  onRemove={onRemove} 
                  onUpdate={onUpdate} 
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
