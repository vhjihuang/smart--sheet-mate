import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Settings, X, Plus, Trash2, GripVertical, ChevronRight } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import type { MappingNode, TransformStep, TransformType } from "@/types";
import { TEACHER_PRESETS } from "@/constants";

interface SortableItemProps {
  node: MappingNode;
  onRemove: (id: string) => void;
  onUpdate: (id: string, steps: TransformStep[]) => void;
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

  const steps = node.steps || [];

  const handleAddStep = (type: TransformType, params: any = {}) => {
    onUpdate(node.id, [...steps, { type, params }]);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    onUpdate(node.id, newSteps);
  };

  const handleUpdateStepParams = (index: number, params: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], params };
    onUpdate(node.id, newSteps);
  };

  const handleApplyPreset = (presetSteps: TransformStep[]) => {
    onUpdate(node.id, presetSteps);
  };

  return (
    <div ref={setNodeRef} {...attributes} style={style}>
      <div
        ref={canNest ? setDroppableRef : undefined}
        className={`group border border-blue-500 rounded text-white px-2.5 py-1.5 text-xs relative min-w-[80px] cursor-grab transition-colors ${
          isOver ? "bg-blue-600 border-blue-400 shadow-md" : "bg-blue-500 border-blue-400"
        }`}
      >
        <div className="flex items-center gap-2 relative">
          <div {...listeners} className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 p-0.5">
            <GripVertical size={10} />
          </div>

          <div className="flex flex-col min-w-0">
            {steps.length > 0 && (
              <div className="absolute -top-3.5 -left-1.5 bg-amber-400 text-[8px] text-white px-1.5 py-0.5 rounded-full border border-white shadow-sm font-bold flex items-center gap-0.5 animate-in zoom-in-50">
                f({steps.length})
              </div>
            )}
            <span className="truncate max-w-[120px] font-semibold" title={node.sourceLabel}>
              {node.sourceLabel}
            </span>
          </div>
          
          <div className="flex-1" />

          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/10 hover:bg-white/30 p-1 rounded flex text-white transition-all scale-95 hover:scale-100"
                title="转换流编辑器"
              >
                <Settings size={12} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white p-4 shadow-2xl rounded-2xl border border-gray-100 w-72 z-[100] animate-in fade-in zoom-in-95 data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2"
                sideOffset={8}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex flex-col">
                      <h3 className="text-xs font-black text-gray-800 tracking-tight">转换流水线</h3>
                      <p className="text-[10px] text-gray-400">{node.sourceLabel}</p>
                    </div>
                    <Popover.Close className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                      <X size={14} />
                    </Popover.Close>
                  </div>

                  {/* 常用预设区 */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest px-1">教师专用预设</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TEACHER_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => handleApplyPreset(preset.steps)}
                          className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 rounded-[4px] text-[10px] font-medium transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 动态步骤列表 */}
                  <div className="flex flex-col gap-2.5 min-h-[40px] max-h-64 overflow-y-auto pr-1">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest px-1">处理步骤 (Pipeline)</label>
                    
                    {steps.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl text-[11px] text-gray-300">
                        暂无处理步骤，点击下方添加
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {steps.map((step, idx) => (
                          <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 group/step relative">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-4 h-4 bg-gray-200 text-gray-500 rounded-full text-[9px] font-bold">
                                  {idx + 1}
                                </span>
                                <span className="text-[11px] font-bold text-gray-700">{step.type}</span>
                              </div>
                              <button 
                                onClick={() => handleRemoveStep(idx)}
                                className="opacity-0 group-hover/step:opacity-100 p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-all"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* 条件渲染参数输入 */}
                            {step.type === 'CROP' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-gray-400">起始位置</label>
                                  <input 
                                    type="number"
                                    className="w-full text-xs p-1 border rounded"
                                    value={step.params.start || 0}
                                    onChange={(e) => handleUpdateStepParams(idx, { ...step.params, start: parseInt(e.target.value) })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-gray-400">截止位置</label>
                                  <input 
                                    type="number"
                                    className="w-full text-xs p-1 border rounded"
                                    value={step.params.end || 0}
                                    onChange={(e) => handleUpdateStepParams(idx, { ...step.params, end: parseInt(e.target.value) })}
                                  />
                                </div>
                              </div>
                            )}

                            {(step.type === 'PREFIX' || step.type === 'SUFFIX') && (
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-400">内容</label>
                                <input 
                                  type="text"
                                  className="w-full text-xs p-1 border rounded"
                                  value={step.params.text || ""}
                                  onChange={(e) => handleUpdateStepParams(idx, { ...step.params, text: e.target.value })}
                                />
                              </div>
                            )}

                            {step.type === 'CUSTOM' && (
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-400">脚本代码</label>
                                <textarea 
                                  className="w-full text-[10px] font-mono p-1 border rounded h-12"
                                  value={step.params.code || ""}
                                  onChange={(e) => handleUpdateStepParams(idx, { ...step.params, code: e.target.value })}
                                  placeholder="value.trim().toUpperCase()"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 添加步骤按钮 */}
                  <div className="grid grid-cols-3 gap-1.5 border-t border-gray-100 pt-3">
                    {['CROP', 'TRIM', 'UPPER', 'LOWER', 'PREFIX', 'SUFFIX', 'CUSTOM'].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleAddStep(type as TransformType)}
                        className="flex items-center justify-center gap-1 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded text-[10px] font-medium transition-all"
                      >
                        <Plus size={10} /> {type}
                      </button>
                    ))}
                  </div>

                  <div className="bg-red-50/50 p-2 rounded-lg mt-1">
                    <button
                      onClick={() => onRemove(node.id)}
                      className="w-full text-red-500 hover:text-red-700 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1 transition-colors"
                    >
                      <Trash2 size={12} /> 彻底移除该字段映射
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
