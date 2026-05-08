import React, { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Settings, Trash2, GripVertical, Wand2, Scissors, Type, Eye, ChevronDown, Check } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import type { MappingNode, TransformStep, TransformType } from "@/types";
import type { TextTransformStep, CropTransformStep } from "shared/transform";
import { CROP_SHORTCUTS, TEACHER_PRESETS } from "@/constants";
import { applyTransformPipeline } from "@/utils/transformPreview";

// 不依赖组件状态，提取到外部避免每次渲染创建新函数
const createDefaultStep = (type: TransformType): TransformStep => {
  switch (type) {
    case "TRIM":
    case "UPPER":
    case "LOWER":
      return { type, params: {} };
    case "CROP":
      return { type, params: { start: 0 } };
    case "REPLACE":
      return { type, params: { from: "", to: "" } };
    case "PREFIX":
    case "SUFFIX":
      return { type, params: { text: "" } };
    case "DATE_FORMAT":
      return { type, params: { toFormat: "YYYY-MM-DD" } };
    case "SCORE_GRADE":
      return { type, params: { rules: [] } };
    case "ID_MASK":
      return { type, params: { keepStart: 6, keepEnd: 4 } };
  }
};

interface SortableItemProps {
  node: MappingNode;
  sampleValue?: string; // 来自源数据的第一行样本
  onRemove: (id: string) => void;
  onUpdate: (id: string, steps: TransformStep[], forceText?: boolean) => void;
  canNest: boolean;
}

export const SortableItem = ({ node, sampleValue = "样例数据", onRemove, onUpdate, canNest }: SortableItemProps) => {
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

  const steps: TransformStep[] = useMemo(() => node.steps || [], [node.steps]);
  const forceText = node.forceText || false;
  const [showPresets, setShowPresets] = useState(false);

  // -------------------------
  // 辅助函数：提取平铺的配置
  // steps 通常只有 0-5 个元素，直接计算比 useMemo 更快
  // -------------------------
  const prefixStep = steps.find((step): step is TextTransformStep => step.type === "PREFIX");
  const suffixStep = steps.find((step): step is TextTransformStep => step.type === "SUFFIX");
  const cropStep = steps.find((step): step is CropTransformStep => step.type === "CROP");
  const prefix = prefixStep?.params.text || "";
  const suffix = suffixStep?.params.text || "";
  const cropStart = cropStep?.params.start ?? null;
  const cropLength = cropStep?.params.length ?? null;
  const isTrim = steps.some(s => s.type === 'TRIM');
  const isUpper = steps.some(s => s.type === 'UPPER');
  const isLower = steps.some(s => s.type === 'LOWER');

  // -------------------------
  // 本地预览引擎 (支持所有转换类型)
  // -------------------------
  const transformedPreview = useMemo(() => {
    const val = sampleValue || "样例数据";
    return applyTransformPipeline(val, steps);
  }, [sampleValue, steps]);

  // -------------------------
  // 统一更新逻辑
  // -------------------------
  const updateConfig = (updates: { steps?: TransformStep[], forceText?: boolean }) => {
    onUpdate(node.id, updates.steps ?? steps, updates.forceText ?? forceText);
  };

  const setPrefix = (val: string) => {
    const otherSteps = steps.filter(s => s.type !== 'PREFIX');
    updateConfig({ steps: val ? [{ type: 'PREFIX', params: { text: val } }, ...otherSteps] : otherSteps });
  };

  const setSuffix = (val: string) => {
    const otherSteps = steps.filter(s => s.type !== 'SUFFIX');
    updateConfig({ steps: val ? [...otherSteps, { type: 'SUFFIX', params: { text: val } }] : otherSteps });
  };

  const setCrop = (start: number | null, length: number | null) => {
    const otherSteps = steps.filter(s => s.type !== 'CROP');
    if (start === null || length === null) {
      updateConfig({ steps: otherSteps });
    } else {
      updateConfig({ steps: [...otherSteps, { type: 'CROP', params: { start, length } }] });
    }
  };

  const toggleStep = (type: TransformType) => {
    const exists = steps.some(s => s.type === type);
    if (exists) {
      updateConfig({ steps: steps.filter(s => s.type !== type) });
    } else {
      updateConfig({ steps: [...steps, createDefaultStep(type)] });
    }
  };

  // 常用预设快捷逻辑（智能合并模式：同类型替换，不同类型追加）
  const handleApplyPreset = (presetSteps: TransformStep[]) => {
    const newSteps = [...steps];
    for (const ps of presetSteps) {
      const existingIdx = newSteps.findIndex(s => s.type === ps.type);
      if (existingIdx >= 0) {
        newSteps[existingIdx] = ps;
      } else {
        newSteps.push(ps);
      }
    }
    updateConfig({ steps: newSteps });
  };

  return (
    <div ref={setNodeRef} {...attributes} style={style}>
      <div
        ref={canNest ? setDroppableRef : undefined}
        className={`group border border-emerald-500 rounded-lg text-white px-3 py-2 text-xs relative min-w-[100px] cursor-grab transition-all hover:shadow-lg ${
          isOver ? "bg-emerald-600 border-emerald-400 scale-[1.02]" : "bg-emerald-500 border-emerald-400"
        }`}
      >
        <div className="flex items-center gap-2 relative">
          <div {...listeners} className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 p-0.5">
            <GripVertical size={11} />
          </div>

          <div className="flex flex-col min-w-0">
            {steps.length > 0 && (
              <div className="absolute -top-4 -left-1.5 bg-amber-400 text-[9px] text-white px-1.5 py-0.5 rounded-full border border-white shadow-sm font-black flex items-center gap-0.5 animate-in zoom-in-50">
                <Wand2 size={8} /> FACTORY({steps.length})
              </div>
            )}
            <span className="truncate max-w-[120px] font-bold tracking-tight" title={node.sourceLabel}>
              {node.sourceLabel}
            </span>
          </div>
          
          <div className="flex-1" />

          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/20 hover:bg-white/40 p-1.5 rounded-md flex text-white transition-all scale-95 hover:scale-100"
                title="转换工厂"
              >
                <Settings size={13} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-3xl border border-gray-100 w-80 z-100 animate-in fade-in zoom-in-95 max-h-[70vh] overflow-y-auto"
                sideOffset={10}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-3">
                  {/* 实时预览区域 */}
                  {steps.length > 0 && (
                    <div className="p-3 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye size={10} className="text-blue-600" />
                        <span className="text-[9px] text-blue-600 font-black uppercase tracking-wider">实时预览</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <div className="text-[10px] text-gray-400 mb-1">原始值</div>
                        <div className="text-xs font-mono text-gray-600 mb-2 truncate" title={sampleValue}>
                          {sampleValue || "样例数据"}
                        </div>
                        <div className="text-[10px] text-gray-400 mb-1">转换后</div>
                        <div className="text-xs font-mono text-blue-700 font-bold truncate" title={transformedPreview}>
                          {transformedPreview}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Component A: Addon (补充组件) */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                      <Type size={10} /> 补充组件 (Addon)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="前缀"
                        className="w-16 h-8 text-[11px] px-2 border border-blue-100 rounded-lg bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                      />
                      <div className="flex-1 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-[10px] text-gray-400 font-bold border border-gray-200 px-2 truncate">
                        {node.sourceLabel}
                      </div>
                      <input
                        type="text"
                        placeholder="后缀"
                        className="w-16 h-8 text-[11px] px-2 border border-blue-100 rounded-lg bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                        value={suffix}
                        onChange={(e) => setSuffix(e.target.value)}
                      />
                    </div>
                    {/* Quick Toggles: Trim & Upper */}
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => toggleStep('TRIM')}
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all border ${
                          isTrim ? "bg-emerald-500 text-white border-emerald-400" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {isTrim ? '✓ ' : ''}Trim
                      </button>
                      <button
                        onClick={() => toggleStep('UPPER')}
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all border ${
                          isUpper ? "bg-emerald-500 text-white border-emerald-400" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {isUpper ? '✓ ' : ''}Upper
                      </button>
                      <button
                        onClick={() => toggleStep('LOWER')}
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all border ${
                          isLower ? "bg-emerald-500 text-white border-emerald-400" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {isLower ? '✓ ' : ''}Lower
                      </button>
                    </div>
                  </div>

                  {/* Component B: Smart Crop (智能裁剪) */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                      <Scissors size={10} /> 智能裁剪 (Extract)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-400 pl-1">开始位置</span>
                        <input 
                          type="number" 
                          className="w-full h-8 px-2 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={cropStart ?? ""}
                          onChange={(e) => setCrop(e.target.value ? parseInt(e.target.value) : null, cropLength)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-400 pl-1">长度</span>
                        <input 
                          type="number" 
                          className="w-full h-8 px-2 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={cropLength ?? ""}
                          onChange={(e) => setCrop(cropStart, e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="全部"
                        />
                      </div>
                    </div>
                    {/* Shortcuts */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {CROP_SHORTCUTS.map(sc => (
                        <button
                          key={sc.label}
                          onClick={() => setCrop(sc.start, sc.length)}
                          className="px-1.5 py-0.5 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-100 rounded-md text-[9px] font-bold transition-all"
                        >
                          {sc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Presets: Collapsible */}
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setShowPresets(!showPresets)}
                      className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <span>⚡ 快捷方案</span>
                      <ChevronDown size={12} className={`transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showPresets && (
                      <div className="grid grid-cols-2 gap-1.5 animate-in slide-in-from-top-2 duration-150">
                        {TEACHER_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            onClick={() => handleApplyPreset(p.steps)}
                            className="px-2 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-[9px] font-bold transition-all truncate"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer: Actions */}
                  <div className="pt-1.5 space-y-2">
                    <button
                      onClick={() => {
                        const previewEl = document.querySelector('[data-preview-row]');
                        previewEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        previewEl?.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2');
                        setTimeout(() => previewEl?.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2'), 1500);
                      }}
                      className="w-full py-2 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[10px] font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye size={11} /> 查看预览结果 ↓
                    </button>

                    <div className="flex items-center gap-2">
                      <label
                        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                        onClick={(e) => { e.stopPropagation(); updateConfig({ forceText: !forceText }); }}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border-2 transition-colors ${
                          forceText ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                        }`}>
                          {forceText && <Check size={9} className="text-white" />}
                        </div>
                        <span className="text-[9px] text-gray-600">深度锁定格式</span>
                      </label>

                      <button
                        onClick={() => onRemove(node.id)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
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
