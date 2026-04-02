import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import type { TargetColumn, MappingNode } from "@/types";
import { SortableItem } from "./SortableItem";

interface TargetSlotProps {
  target: TargetColumn;
  mappings: MappingNode[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, transform: string) => void;
}

export const TargetSlot = ({ target, mappings, onRemove, onUpdate }: TargetSlotProps) => {
  const { setNodeRef, isOver } = useDroppable({ 
    id: `slot-${target.id}` 
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-full min-h-[60px] flex items-center justify-center p-2 transition-all duration-200 rounded ${
        isOver 
          ? "border-2 border-blue-400 bg-blue-50/50 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]" 
          : "border border-dashed border-gray-200 bg-gray-50/30 hover:bg-gray-50/50"
      }`}
    >
      {mappings.length === 0 ? (
        <span className="text-[10px] text-gray-400 select-none">拖入源字段</span>
      ) : (
        <SortableContext 
          items={mappings.map((m) => m.id)} 
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-col gap-1.5 w-full">
            {mappings.map((node) => (
              <SortableItem 
                key={node.id} 
                node={node} 
                onRemove={onRemove} 
                onUpdate={onUpdate} 
                canNest={true} 
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};
