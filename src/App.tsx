import { useState } from "react";
import { 
  Upload,
  Download, 
  Layers, 
  ShieldCheck, 
  ChevronUp, 
  ChevronDown,
  LayoutGrid,
  Columns
} from "lucide-react";
import { DndContext, DragOverlay, closestCenter, type CollisionDetection } from "@dnd-kit/core";
import { Toaster } from "sonner";
import { useExcelMapping } from "@/hooks/useExcelMapping";
import { MultiLevelTable } from "@/components/MultiLevelTable";
import { DraggableItem } from "@/components/DraggableItem";
import { Button } from "@/components/ui/button";
import { SourceConfigBox } from "@/components/SourceConfigBox";
import { TemplateConfigBox } from "@/components/TemplateConfigBox";
import { 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent 
} from "@/components/ui/collapsible";

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
    FilePath,
    sheets,
    currentSheetIndex,
    rows,
    headerRowStart, setHeaderRowStart,
    headerRowEnd, setHeaderRowEnd,
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
    isHeaderConfirmed
  } = useExcelMapping();

  const customCollisionDetection: CollisionDetection = (args) => {
    const collisions = closestCenter(args);
    const mappingContainer = document.querySelector('[data-mapping-container="true"]');
    if (mappingContainer) {
      const rect = mappingContainer.getBoundingClientRect();
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

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={customCollisionDetection}>
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

                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up transition-all duration-300">
                  <div className="flex flex-row gap-4 pt-2">
                    <SourceConfigBox
                      isSheetLoaded={isSheetLoaded}
                      loading={loading}
                      FilePath={FilePath}
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
                      onConfirmHeader={confirmHeader}
                      onSkipHeader={skipHeader}
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
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-gray-200">
                {sourceColumns.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center">
                      <Upload size={14} className="text-gray-200" />
                    </div>
                    <p className="text-[10px] text-gray-300 font-bold uppercase italic tracking-widest">等待上传</p>
                  </div>
                ) : (
                  sourceColumns.map((col: any) => (
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
              </div>
              <div data-mapping-container="true" className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
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
            <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-10 text-[11px] font-black shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-95 rounded-xl flex items-center gap-2 uppercase tracking-widest">
              <Download size={14} />
              生成并导出结果
            </Button>
          </footer>
        </div>
      </DndContext>
    </div>
  );
}

export default App;
