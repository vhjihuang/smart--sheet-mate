import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Settings } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import type { MappingNode } from "@/types";

interface SortableItemProps {
  node: MappingNode;
  onRemove: (id: string) => void;
  onUpdate: (id: string, transform: string) => void;
  canNest: boolean;
}

export const SortableItem = ({ node, onRemove, onUpdate, canNest }: SortableItemProps) => {
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition, 
    isDragging 
  } = useSortable({ 
    id: node.id, 
    data: { node } 
  });

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
        className={`border border-blue-500 rounded text-white px-2.5 py-1.5 text-xs relative min-w-[60px] cursor-grab ${isOver ? "bg-blue-700" : "bg-blue-500"}`}
      >
        <div className="flex items-center gap-1.5 relative">
          {node.transform && (
            <div className="absolute -top-3.5 -left-1.5 bg-amber-400 text-[8px] text-white px-1 rounded-full border border-white shadow-sm flex items-center justify-center font-bold">
              f(x)
            </div>
          )}
          <span className="truncate max-w-[100px] font-medium" title={node.sourceLabel}>
            {node.sourceLabel}
          </span>
          
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/20 hover:bg-white/40 border-none cursor-pointer p-0.5 rounded flex text-white transition-colors"
                title="转换设置"
              >
                <Settings size={11} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white p-3 shadow-xl rounded-xl border border-gray-100 w-52 z-50 animate-in fade-in zoom-in-95"
                sideOffset={5}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-2 mb-1">
                    <span className="text-[11px] font-bold text-gray-700">格式转换设置</span>
                    <span className="text-[10px] text-gray-400 font-mono">ID: {node.id.slice(0, 4)}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">常用预设</label>
                    <select 
                      className="w-full text-[11px] bg-gray-50 border border-gray-100 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                      value={["trim", "uppercase", "lowercase", "number", "date"].includes(node.transform.toLowerCase()) ? node.transform.toLowerCase() : (node.transform ? "custom" : "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") return;
                        onUpdate(node.id, val);
                      }}
                    >
                      <option value="">(空) 无转换</option>
                      <option value="trim">去除空格 (Trim)</option>
                      <option value="uppercase">大写 (UpperCase)</option>
                      <option value="lowercase">小写 (LowerCase)</option>
                      <option value="number">保留两位小数 (0.00)</option>
                      <option value="date">日期格式化 (YYYY-MM-DD)</option>
                      <option value="custom">-- 自定义逻辑 --</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">手动逻辑 (JS/指令)</label>
                    <input
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-full border border-gray-100 bg-gray-50 rounded p-1.5 text-[11px] font-mono text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. value.trim()"
                      value={node.transform}
                      onChange={(e) => onUpdate(node.id, e.target.value)}
                    />
                  </div>

                  <div className="pt-2 mt-1 border-t border-gray-50 flex gap-2">
                    <button
                      onClick={() => onRemove(node.id)}
                      className="flex-1 bg-red-50 text-red-600 border border-red-100 rounded py-1.5 text-[10px] font-semibold hover:bg-red-500 hover:text-white transition-all"
                    >
                      删除映射
                    </button>
                  </div>
                </div>
                <Popover.Arrow className="fill-white" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </div>
  );
};
