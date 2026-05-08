import { useState, useMemo, useRef } from "react";
import {
  Download,
  Layers,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Columns,
  Search
} from "lucide-react";
import { DndContext, DragOverlay, closestCenter, type CollisionDetection, type DragStartEvent } from "@dnd-kit/core";
import { Toaster } from "sonner";
import { useExcelMapping } from "@/hooks/useExcelMapping";
import { MultiLevelTable } from "@/components/MultiLevelTable";
import { DraggableItem } from "@/components/DraggableItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceConfigBox } from "@/components/SourceConfigBox";
import { TemplateConfigBox } from "@/components/TemplateConfigBox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SourceColumn } from "@/types";

const columnClass = "px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50/30 transition-all";

function App() {
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  const {
    mappings,
    slotConfigs,
    previewData,
    sourceColumns,
    targetColumns,
    error,
    activeId,
    loading,
    filePath,
    sheets,
    currentSheetIndex,
    rows,
    headerRowStart, setHeaderRowStart,
    headerRowEnd, setHeaderRowEnd,
    dataRowStart, setDataRowStart,
    templatePath,
    templateRows,
    templateHeaderRowStart, setTemplateHeaderRowStart,
    templateHeaderRowEnd, setTemplateHeaderRowEnd,
    handleDragStart,
    handleDragEnd,
    handleRemove,
    handleUpdate,
    handleUpdateSlotConfig,
    handleImport,
    handleSheetChange,
    handleUploadTemplate,
    handleDownload,
    handleLoadFile,
    confirmHeader,
    skipHeader,
    confirmTemplateHeader,
    activeData,
    isSourceMapped,
    isSheetLoaded,
    isHeaderConfirmed,
    // 验证对话框相关
    validationDialogOpen,
    setValidationDialogOpen,
    validationErrors,
    validationWarnings,
    performExport,
    autoMap
  } = useExcelMapping();

  const [searchTerm, setSearchTerm] = useState("");

  const filteredSourceColumns = useMemo(() => {
    return sourceColumns.filter((col: SourceColumn) =>
      col.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sourceColumns, searchTerm]);



  const mappingContainerRect = useRef<DOMRect | null>(null);

  const onDragStartWrapper = (event: DragStartEvent) => {
    const mappingContainer = document.querySelector('[data-mapping-container="true"]');
    if (mappingContainer) {
      mappingContainerRect.current = mappingContainer.getBoundingClientRect();
    }
    handleDragStart(event);
  };

  const customCollisionDetection: CollisionDetection = (args) => {
    const collisions = closestCenter(args);
    const rect = mappingContainerRect.current;
    if (rect) {
      const { pointerCoordinates } = args;
      if (pointerCoordinates && (
        pointerCoordinates.x < rect.left ||
        pointerCoordinates.x > rect.right ||
        pointerCoordinates.y < rect.top ||
        pointerCoordinates.y > rect.bottom
      )) {
        return [];
      }
    }
    return collisions;
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 font-sans antialiased overflow-hidden select-none">
      <Toaster position="top-right" richColors />

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs shadow-sm flex items-center gap-2">
          <ShieldCheck size={14} />
          {error}
        </div>
      )}

      <DndContext onDragStart={onDragStartWrapper} onDragEnd={handleDragEnd} collisionDetection={customCollisionDetection}>
        <DragOverlay zIndex={1000}>
          {activeId && activeData && (
            <div className={`${columnClass} bg-blue-600 text-white border-blue-700 shadow-xl scale-105 rotate-1 transition-transform`}>
              {activeData.label}
            </div>
          )}
        </DragOverlay>

        <div className="flex-1 flex flex-col pt-12 px-6 pb-12 gap-6 min-h-0 overflow-hidden">
          <section className="flex-shrink-0">
            <Collapsible open={!isConfigCollapsed} onOpenChange={(open) => setIsConfigCollapsed(!open)}>
              <div
                className={`
                  bg-white/80 backdrop-blur-3xl border border-white/40 shadow-2xl relative overflow-hidden ring-1 ring-black/5 transition-all duration-300 ease-in-out
                  ${isConfigCollapsed ? "rounded-2xl border-blue-100 shadow-blue-500/5 cursor-pointer hover:border-blue-300" : "rounded-3xl shadow-indigo-500/5"}
                  p-4 
                `}
              >
                <div className={`flex items-center justify-between ${!isConfigCollapsed ? "mb-4" : ""} h-9 transition-all duration-300`}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer group">
                      <div className="flex items-center justify-center transition-all duration-300 w-9 h-9 bg-indigo-600 rounded-xl flex-shrink-0">
                        <LayoutGrid className="text-white transition-transform duration-300 group-hover:scale-110" size={18} />
                      </div>
                      <div className="flex flex-col justify-center h-9 font-sans overflow-hidden">
                        <h1 className={`font-extrabold text-gray-900 tracking-tight uppercase leading-none transition-all duration-300 ${isConfigCollapsed ? "text-[13px] text-gray-800" : "text-[15px]"}`}>
                          {isConfigCollapsed ? "配置工作台" : "配置中心"}
                          {isConfigCollapsed && (
                            <span className="ml-1.5 text-[9px] bg-blue-100/50 text-blue-600 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Collapsed</span>
                          )}
                        </h1>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleTrigger asChild>
                    <Button
                      variant={isConfigCollapsed ? "ghost" : "outline"}
                      size="sm"
                      className={`
                        shadow-blue-500/5 gap-2 h-9 px-4 justify-start rounded-xl font-black transition-all duration-300 text-[11px]
                        ${isConfigCollapsed ? "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white" : "bg-white/80 backdrop-blur-md border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white shadow-xl"}
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                        <div className="w-4 flex items-center justify-center flex-shrink-0">
                          {isConfigCollapsed ? (
                            <ChevronDown size={14} className="stroke-[3px]" />
                          ) : (
                            <ChevronUp size={14} className="stroke-[3px]" />
                          )}
                        </div>
                        <span className="truncate">
                          {isConfigCollapsed ? "修改配置" : "收起配置"}
                        </span>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent forceMount className="collapsible-content">
                  <div className="flex flex-row gap-4 pt-2 pb-1">
                    <SourceConfigBox
                      isSheetLoaded={isSheetLoaded}
                      loading={loading}
                      filePath={filePath}
                      sheets={sheets}
                      currentSheetIndex={currentSheetIndex}
                      rows={rows}
                      headerRowStart={headerRowStart}
                      headerRowEnd={headerRowEnd}
                      isHeaderConfirmed={isHeaderConfirmed}
                      onImport={handleImport}
                      onLoadFile={handleLoadFile}
                      onSheetChange={handleSheetChange}
                      onSetHeaderRowStart={setHeaderRowStart}
                      onSetHeaderRowEnd={setHeaderRowEnd}
                      dataRowStart={dataRowStart}
                      onSetDataRowStart={setDataRowStart}
                      onConfirmHeader={async () => {
                        await confirmHeader();
                        setSearchTerm("");
                      }}
                      onSkipHeader={() => {
                        skipHeader();
                        setSearchTerm("");
                      }}
                    />

                    <TemplateConfigBox
                      templateRows={templateRows}
                      loading={loading}
                      templatePath={templatePath}
                      templateHeaderRowStart={templateHeaderRowStart}
                      templateHeaderRowEnd={templateHeaderRowEnd}
                      onUploadTemplate={handleUploadTemplate}
                      onSetTemplateHeaderRowStart={setTemplateHeaderRowStart}
                      onSetTemplateHeaderRowEnd={setTemplateHeaderRowEnd}
                      onConfirmTemplateHeader={confirmTemplateHeader}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </section>

          {/* 2. Workspace Area */}
          <div className="flex-1 flex flex-row gap-6 min-h-0 overflow-hidden">
            <aside className="w-64 flex-shrink-0 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white relative z-10 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <Layers size={14} className="text-blue-500" />
                  </div>
                  <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">源文件字段</h2>
                </div>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black ring-1 ring-blue-100">{sourceColumns.length}</span>
              </div>
              <div className="px-4 pb-2">
                <div className="relative group">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    placeholder="搜索字段..."
                    className="pl-8 h-8 text-[11px] bg-gray-50/50 border-none rounded-lg focus-visible:ring-1 focus-visible:ring-blue-100 placeholder:text-gray-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pt-0 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-gray-200">
                {filteredSourceColumns.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center">
                      <Search size={14} className="text-gray-200" />
                    </div>
                    <p className="text-[10px] text-gray-300 font-bold uppercase italic tracking-widest">
                      {searchTerm ? "无匹配字段" : "等待上传"}
                    </p>
                  </div>
                ) : (
                  filteredSourceColumns.map((col: SourceColumn) => (
                    <DraggableItem key={col.id} id={col.id} name={col.label} isDisabled={isSourceMapped(col.id)} />
                  ))
                )}
              </div>
            </aside>

            <main className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-sm relative z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <Columns size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-800 tracking-tight flex items-center gap-2">
                      字段映射工坊
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full ring-1 ring-emerald-100 tracking-widest">LIVE</span>
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">多维转换流水线 &middot; 实时预览产出</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoMap}
                    disabled={sourceColumns.length === 0 || targetColumns.length === 0}
                    className="h-8 border-emerald-100 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 text-[10px] font-black rounded-lg transition-all active:scale-95 flex items-center gap-1.5 uppercase tracking-wider"
                  >
                    <ShieldCheck size={12} />
                    智能匹配
                  </Button>
                </div>
              </div>
              <div data-mapping-container="true" className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
                {targetColumns.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
                    <div className="w-16 h-16 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                      <Columns size={24} className="text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-500 mb-1">等待模板数据</p>
                      <p className="text-xs">请在上方区域配置并确认【目标模板表头】</p>
                    </div>
                  </div>
                ) : (
                  <MultiLevelTable
                    columns={targetColumns}
                    mappings={mappings}
                    previewData={previewData}
                    slotConfigs={slotConfigs}
                    firstRow={rows[0]?.DataList || []}
                    sourceColumns={sourceColumns}
                    onRemove={handleRemove}
                    onUpdate={handleUpdate}
                    onUpdateSlotConfig={handleUpdateSlotConfig}
                  />
                )}
              </div>
            </main>
          </div>

          {/* 3. Footer Area */}
          <footer className="flex-shrink-0 flex items-center justify-between py-1 px-1 mt-auto">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                <ShieldCheck size={12} className="text-green-500" />
                <span>引擎状态: 运行中</span>
              </div>
            </div>
            <Button onClick={handleDownload} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-10 text-[11px] font-black shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-95 rounded-xl flex items-center gap-2 uppercase tracking-widest disabled:opacity-50 disabled:pointer-events-none">
              <Download size={14} />
              生成并导出结果
            </Button>
          </footer>
        </div>
      </DndContext>

      {/* 验证对话框 */}
      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400" />

          <div className="p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-amber-50 rounded-xl">
                  {validationErrors.length > 0 ? (
                    <LayoutGrid size={20} className="text-red-500" />
                  ) : (
                    <ShieldCheck size={20} className="text-amber-500" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-gray-800 tracking-tight">
                    {validationErrors.length > 0 ? "映射验证失败" : "导出预警提示"}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                    在正式导出前，引擎发现了以下潜在问题
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
              {validationErrors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    阻塞性错误 ({validationErrors.length})
                  </h4>
                  {validationErrors.map((err, i) => (
                    <div key={i} className="p-3 bg-red-50/50 border border-red-100 rounded-2xl flex gap-3 items-start">
                      <LayoutGrid size={14} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-red-800 font-medium">{err}</p>
                    </div>
                  ))}
                </div>
              )}

              {validationWarnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    改进建议 ({validationWarnings.length})
                  </h4>
                  {validationWarnings.map((warn, i) => (
                    <div key={i} className="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl flex gap-3 items-start">
                      <ShieldCheck size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-amber-800 font-medium">{warn}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-8 flex flex-row gap-3 sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setValidationDialogOpen(false)}
                className="flex-1 sm:flex-none h-10 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                返回修改
              </Button>
              {validationErrors.length === 0 && (
                <Button
                  onClick={() => {
                    setValidationDialogOpen(false);
                    performExport();
                  }}
                  className="flex-1 sm:flex-none h-10 rounded-xl bg-gray-900 text-white hover:bg-black text-xs font-black px-6 shadow-xl shadow-black/10"
                >
                  忽略并继续导出
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
