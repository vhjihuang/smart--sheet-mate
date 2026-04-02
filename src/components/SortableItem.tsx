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
        <div className="flex items-center gap-1">
          <span className="truncate max-w-[120px]" title={node.sourceLabel}>
            {node.sourceLabel}
          </span>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-none cursor-pointer p-0.5 flex text-white opacity-80 hover:opacity-100"
              >
                <Settings size={10} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white p-3 shadow-lg rounded-lg border border-gray-200 w-40 z-50"
                sideOffset={5}
              >
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-gray-500 mb-1">转换函数 (JS)</div>
                  <input
                    autoFocus
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full border border-gray-200 rounded p-1.5 text-[11px] font-mono text-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. value.trim()"
                    value={node.transform}
                    onChange={(e) => onUpdate(node.id, e.target.value)}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => onRemove(node.id)}
                      className="flex-1 bg-red-50 text-red-600 border border-red-100 rounded py-1 text-[10px] hover:bg-red-100"
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
