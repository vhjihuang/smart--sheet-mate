import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Settings, MousePointer2 } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import type { TargetColumn, MappingNode, SlotConfig } from "@/types";
import { SortableItem } from "./SortableItem";

interface TargetSlotProps {
  target: TargetColumn;
  mappings: MappingNode[];
  slotConfig?: SlotConfig;
  onRemove: (id: string) => void;
  onUpdate: (id: string, steps: any[]) => void;
  onUpdateSlotConfig?: (columnId: string, config: SlotConfig) => void;
}

export const TargetSlot = ({ 
  target, 
  mappings, 
  slotConfig = { type: 'JOIN', separator: '' },
  onRemove, 
  onUpdate,
  onUpdateSlotConfig
}: TargetSlotProps) => {
  const { setNodeRef, isOver } = useDroppable({ 
    id: `slot-${target.id}` 
  });

  const handleSeparatorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSlotConfig?.(target.id, { ...slotConfig, separator: e.target.value });
  };

  return (
    <div
      ref={setNodeRef}
      className={`w-full min-h-[80px] flex flex-col p-2 transition-all duration-200 rounded gap-2 ${
        isOver 
          ? "border-2 border-blue-400 bg-blue-50/50 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]" 
          : "border border-dashed border-gray-200 bg-gray-50/30 hover:bg-gray-50/50"
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter flex items-center gap-1">
          {mappings.length > 1 && <span className="px-1 bg-amber-100 text-amber-700 rounded-sm">多字段</span>}
          {mappings.length === 0 ? "待映射" : `${mappings.length} 个字段`}
        </span>

        {/* 多字段聚合配置 */}
        {mappings.length > 1 && (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors">
                <Settings size={12} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content 
                className="z-50 bg-white p-3 rounded-lg shadow-xl border border-gray-100 w-48 animate-in fade-in zoom-in duration-200"
                sideOffset={5}
              >
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 border-b pb-1.5 mb-2">聚合设置</h4>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-gray-500">连接符号</label>
                    <div className="flex gap-1.5">
                      {['', ' ', ',', '-', '_'].map(s => (
                        <button 
                          key={s}
                          onClick={() => onUpdateSlotConfig?.(target.id, { ...slotConfig, separator: s })}
                          className={`flex-1 text-[10px] py-1 border rounded transition-all ${
                            slotConfig.separator === s 
                              ? "bg-blue-50 border-blue-200 text-blue-600 font-bold" 
                              : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300"
                          }`}
                        >
                          {s === '' ? '无' : s === ' ' ? '空' : s}
                        </button>
                      ))}
                    </div>
                    <input 
                      type="text"
                      placeholder="自定义..."
                      value={slotConfig.separator}
                      onChange={handleSeparatorChange}
                      className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:border-blue-300 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    当多个字段映射到此列时，将使用该符号连接它们。
                  </p>
                </div>
                <Popover.Arrow className="fill-white" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>

      <div className="flex-1 w-full flex flex-col gap-1.5">
        {mappings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
            <MousePointer2 size={14} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 select-none">拖入字段</span>
          </div>
        ) : (
          <SortableContext 
            items={mappings.map((m) => m.id)} 
            strategy={verticalListSortingStrategy}
          >
            {mappings.map((node) => (
              <SortableItem 
                key={node.id} 
                node={node} 
                onRemove={onRemove} 
                onUpdate={onUpdate} 
                canNest={true} 
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
};
