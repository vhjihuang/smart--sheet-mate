import { DndContext, DragOverlay, closestCenter, type CollisionDetection } from "@dnd-kit/core";
import { Download, Upload, Check, ChevronDown, ChevronUp, Layers, ListFilter } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

// Custom Hooks & Components
import { useExcelMapping } from "@/hooks/useExcelMapping";
import { DraggableItem, columnClass } from "@/components/DraggableItem";
import { MultiLevelTable } from "@/components/MultiLevelTable";

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

  // Custom collision detection: closestCenter + boundary check
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
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6 bg-gray-50 min-h-screen font-sans antialiased">
      <Toaster position="top-right" richColors />
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm shadow-sm animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* DndContext must wrap both Draggables (Sidebar) and Droppables (Mapping Area) */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={customCollisionDetection}>
        
        {/* DragOverlay for visualizing movement */}
        <DragOverlay zIndex={1000}>
          {activeId && activeData && (
            <div className={`${columnClass} bg-blue-600 text-white border-blue-700 shadow-xl scale-105 rotate-1 transition-transform`}>
              {activeData.label}
            </div>
          )}
        </DragOverlay>

        {/* Main Layout Container */}
        <div className="flex flex-row gap-6 items-start flex-1 overflow-hidden">
          {/* 左侧边栏: 源字段 */}
          <aside className="w-64 flex-shrink-0 sticky top-0 max-h-[calc(100vh-8rem)] overflow-y-auto bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Layers size={16} className="text-blue-500" />
              <h2 className="text-sm font-bold text-gray-800 font-sans">源文件字段</h2>
            </div>
            
            <div className="flex flex-col gap-2">
              {sourceColumns.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-300 italic px-2">请先上传并确认源文件表头</div>
              ) : (
                sourceColumns.map((col: any) => (
                  <DraggableItem
                    key={col.id}
                    id={col.id}
                    name={col.label}
                    isDisabled={isSourceMapped(col.id)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* 右侧主工作区 */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            {/* 进度/配置摘要层 (折叠后显示) */}
            {isConfigCollapsed ? (
              <div className="bg-white border border-blue-200 rounded-xl p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-6 overflow-hidden">
                  <div className="flex items-center gap-2 border-r border-gray-100 pr-4">
                    <Check size={14} className="text-green-500" />
                    <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">源文件:</span>
                    <span className="text-[11px] text-gray-500 font-mono truncate max-w-[150px]">{FilePath?.split(/[/\\]/).pop() || "未选择"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className={templatePath ? "text-green-500" : "text-gray-300"} />
                    <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">目标模板:</span>
                    <span className="text-[11px] text-gray-500 font-mono truncate max-w-[150px]">{templatePath?.split(/[/\\]/).pop() || "未选择"}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsConfigCollapsed(false)} className="text-blue-600 h-8 hover:bg-blue-50 text-xs gap-1">
                  <ChevronDown size={14} /> 修改配置
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">导入与配置</h3>
                  <Button variant="ghost" size="sm" onClick={() => setIsConfigCollapsed(true)} className="h-6 text-[10px] text-gray-400 hover:text-gray-900 border-none shadow-none">
                    收起配置 <ChevronUp size={12} className="ml-1" />
                  </Button>
                </div>

                {/* Box 1: Source File */}
                <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-gray-100">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSheetLoaded ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}>
                      {isSheetLoaded ? <Check size={14} /> : "1"}
                    </div>
                    <h2 className="text-sm font-semibold text-gray-800">源文件</h2>
                    <Button onClick={handleImport} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm">
                      <Upload size={14} className="mr-2" /> 选择Excel
                    </Button>
                    <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-[200px]">
                      {FilePath || "未选择文件"}
                    </span>
                    {FilePath && (
                      <>
                        {sheets.length > 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-600">子表:</span>
                            <Select value={(currentSheetIndex - 1).toString()} onValueChange={(v) => handleSheetChange(Number(v))}>
                              <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder="选择子表" /></SelectTrigger>
                              <SelectContent>
                                {sheets.map((s: any, i: any) => <SelectItem key={i} value={i.toString()}>{s.SheetName}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Button onClick={handleLoadFile} disabled={loading} variant={isSheetLoaded ? "outline" : "default"} className={!isSheetLoaded ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""} size="sm">
                          {isSheetLoaded ? "重新加载" : "执行加载"}
                        </Button>
                      </>
                    )}
                  </div>
                  {rows.length > 0 && (
                    <div className="pt-4">
                      <div className="flex justify-between items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isHeaderConfirmed ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}>
                            {isHeaderConfirmed ? <Check size={14} /> : "3"}
                          </div>
                          <h2 className={`text-sm font-semibold ${isHeaderConfirmed ? "text-green-700" : "text-gray-800"}`}>确认表头</h2>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-500">起始:</span>
                            <Select value={headerRowStart.toString()} onValueChange={(v) => setHeaderRowStart(Number(v))}>
                              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {rows.slice(0, 10).map((_: any, i: any) => <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-500">截止:</span>
                            <Select value={headerRowEnd.toString()} onValueChange={(v) => setHeaderRowEnd(Number(v))}>
                              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {rows.slice(0, 10).map((_: any, i: any) => <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={confirmHeader} className="bg-green-600 hover:bg-green-700 text-white shadow-sm" size="sm">确认范围</Button>
                          <Button onClick={skipHeader} variant="outline" size="sm">跳过</Button>
                        </div>
                      </div>
                      <div className="overflow-auto max-h-[160px] border border-gray-100 rounded-lg bg-gray-50/10">
                        <table className="w-full border-collapse text-xs">
                          <tbody>
                            {rows.slice(0, 10).map((row: any, rowIndex: any) => (
                              <tr key={rowIndex} className={`hover:bg-blue-50/30 ${rowIndex >= headerRowStart && rowIndex <= headerRowEnd ? "bg-blue-50/80" : ""}`}>
                                <td className="px-3 py-2 text-gray-400 border-r border-gray-100 w-10 text-center">{rowIndex + 1}</td>
                                {row.DataList.map((cell: any, i: any) => <td key={i} className="px-3 py-2 border-b border-gray-100 max-w-[200px] truncate">{cell}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>

                {/* Box 2: Target Template */}
                <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-gray-100">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${templateRows.length > 0 ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}>
                      {templateRows.length > 0 ? <Check size={14} /> : "4"}
                    </div>
                    <h2 className="text-sm font-semibold text-gray-800">目标模板</h2>
                    <Button onClick={handleUploadTemplate} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                      <Upload size={14} className="mr-1" /> 上传模板
                    </Button>
                    {templateRows.length > 0 && (
                      <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">5</div>
                        <div className="flex items-center gap-1.5 font-sans">
                          <Select value={templateHeaderRowStart.toString()} onValueChange={(v) => setTemplateHeaderRowStart(Number(v))}>
                            <SelectTrigger className="w-[80px] h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {templateRows.slice(0, 10).map((_: any, i: any) => <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span>~</span>
                          <Select value={templateHeaderRowEnd.toString()} onValueChange={(v) => setTemplateHeaderRowEnd(Number(v))}>
                            <SelectTrigger className="w-[80px] h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {templateRows.slice(0, 10).map((_: any, i: any) => <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={confirmTemplateHeader} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-7 text-[11px]" size="sm">确认</Button>
                      </div>
                    )}
                  </div>
                  {templateRows.length > 0 && (
                    <div className="pt-4 overflow-auto max-h-[160px] border border-gray-100 rounded-lg bg-gray-50/10 mt-2">
                      <table className="w-full border-collapse text-xs">
                        <tbody>
                          {templateRows.slice(0, 10).map((row: any, rowIndex: any) => (
                            <tr key={rowIndex} className={`hover:bg-indigo-50/30 ${rowIndex >= templateHeaderRowStart && rowIndex <= templateHeaderRowEnd ? "bg-indigo-50/80" : ""}`}>
                              <td className="px-3 py-2 text-gray-400 border-r border-gray-100 w-10 text-center">{rowIndex + 1}</td>
                              {row.DataList.map((cell: any, i: any) => <td key={i} className="px-3 py-2 border-b border-gray-100 max-w-[200px] truncate font-mono text-[11px]">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Mapping Area */}
            <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm overflow-hidden flex flex-col gap-3 mb-10">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <ListFilter size={16} className="text-green-500" />
                  <h2 className="text-xs font-semibold text-gray-800">字段映射中心</h2>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider ml-2 border-l border-gray-200 pl-2">Excel 视图 (横向滚动)</span>
                </div>
              </div>
              <div data-mapping-container="true" className="w-full pt-2">
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
            </section>
          </div>
        </div>
      </DndContext>

      {/* Floating Footer */}
      <footer className="mt-auto py-4 border-t border-gray-200 flex justify-end sticky bottom-0 bg-gray-50/90 backdrop-blur-sm z-50">
        <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 h-auto text-lg font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95">
          <Download size={20} className="mr-2" />
          生成并导出结果
        </Button>
      </footer>
    </div>
  );
}

export default App;
