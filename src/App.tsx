import { DndContext, DragOverlay, closestCenter, type CollisionDetection } from "@dnd-kit/core";
import { Download, Upload } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Custom Hooks & Components
import { useExcelMapping } from "@/hooks/useExcelMapping";
import { DraggableItem, columnClass } from "@/components/DraggableItem";
import { MultiLevelTable } from "@/components/MultiLevelTable";

function App() {
  const {
    mappings,
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
    handleImport,
    handleSheetChange,
    handleUploadTemplate,
    handleDownload,
    confirmHeader,
    skipHeader,
    confirmTemplateHeader,
    activeData,
    isSourceMapped
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
    <div className="w-full max-w-6xl mx-auto p-8 flex flex-col gap-6 bg-gray-50 min-h-screen font-sans antialiased">
      <Toaster position="top-right" richColors />
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm shadow-sm animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">Smart Sheet Mate</h1>
        <p className="text-sm text-gray-500">Excel 数据处理与多级字段映射工具</p>
      </header>

      {/* 步骤1: 上传源文件 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</div>
          <h2 className="text-sm font-semibold text-gray-800">上传源文件</h2>
        </div>
        
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleImport} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
            >
              <Upload size={14} className="mr-2" />
              选择源文件
            </Button>
            <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-[400px]">
              {FilePath || "未选择文件"}
            </span>
          </div>

          {FilePath && sheets.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-gray-600">子表:</span>
              <Select 
                value={(currentSheetIndex - 1).toString()} 
                onValueChange={(v) => handleSheetChange(Number(v))}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="选择子表" />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((s, i) => (
                    <SelectItem key={i} value={i.toString()}>{s.SheetName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      {/* 步骤2: 选择表头 */}
      {rows.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</div>
            <h2 className="text-sm font-semibold text-gray-800">确认表头范围</h2>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-gray-500">起始行:</span>
              <Select value={headerRowStart.toString()} onValueChange={(v) => setHeaderRowStart(Number(v))}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rows.slice(0, 10).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-gray-500">截止行:</span>
              <Select value={headerRowEnd.toString()} onValueChange={(v) => setHeaderRowEnd(Number(v))}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rows.slice(0, 10).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button onClick={confirmHeader} className="bg-green-600 hover:bg-green-700 text-white shadow-sm" size="sm">确认范围</Button>
              <Button onClick={skipHeader} variant="outline" size="sm">跳过 (首行)</Button>
            </div>
          </div>
          
          <div className="text-[11px] text-gray-400 mb-2 uppercase tracking-wide font-semibold">数据预览</div>
          <div className="overflow-auto max-h-[160px] border border-gray-100 rounded-lg bg-gray-50/30">
            <table className="w-full border-collapse whitespace-nowrap text-xs">
              <tbody>
                {rows.slice(0, 10).map((row, rowIndex) => (
                  <tr key={rowIndex} className={`hover:bg-blue-50/30 transition-colors ${rowIndex >= headerRowStart && rowIndex <= headerRowEnd ? "bg-blue-50/80" : ""}`}>
                    <td className="px-3 py-2 text-gray-400 border-r border-gray-100 w-12 text-center sticky left-0 bg-inherit">
                      {rowIndex + 1}
                    </td>
                    {row.DataList.map((cell, i) => (
                      <td key={i} className="px-3 py-2 border-b border-gray-100 max-w-[200px] truncate" title={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 步骤3: 上传模板 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</div>
          <h2 className="text-sm font-semibold text-gray-800">目标模板设置</h2>
        </div>
        
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={handleUploadTemplate} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            <Upload size={14} className="mr-2" />
            上传模板
          </Button>
          <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-[400px]">
            {templatePath || "未读取模板，使用默认结构"}
          </span>
        </div>
        
        {templateRows.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2">
             <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-[13px] text-indigo-700 font-medium">模板表头确认:</span>
                <Select value={templateHeaderRowStart.toString()} onValueChange={(v) => setTemplateHeaderRowStart(Number(v))}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {templateRows.slice(0, 10).map((_, i) => <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-indigo-300">~</span>
                <Select value={templateHeaderRowEnd.toString()} onValueChange={(v) => setTemplateHeaderRowEnd(Number(v))}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {templateRows.slice(0, 10).map((_, i) => <SelectItem key={i} value={i.toString()}>第{i + 1}行</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={confirmTemplateHeader} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs px-4">确认</Button>
             </div>
          </div>
        )}
      </section>

      {/* 步骤4: 字段映射 */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={customCollisionDetection}>
        <DragOverlay zIndex={1000}>
          {activeId && activeData && (
            <div className={`${columnClass} bg-blue-600 text-white border-blue-700 shadow-xl scale-105 rotate-1 transition-transform`}>
              {activeData.label}
            </div>
          )}
        </DragOverlay>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">4</div>
            <h2 className="text-sm font-semibold text-gray-800">字段映射中心</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">目标模板映射区</div>
            <div data-mapping-container="true" className="w-full">
              <MultiLevelTable 
                columns={targetColumns} 
                mappings={mappings} 
                onRemove={handleRemove} 
                onUpdate={handleUpdate} 
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <div className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">源文件可用字段</div>
            <div className="flex gap-2 flex-wrap min-h-[48px]">
              {sourceColumns.length === 0 ? (
                <div className="w-full py-4 text-center text-sm text-gray-300 italic">请先上传并确认源文件表头</div>
              ) : (
                sourceColumns.map((col) => (
                  <DraggableItem 
                    key={col.id} 
                    id={col.id} 
                    name={col.label} 
                    isDisabled={isSourceMapped(col.id)} 
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </DndContext>

      <footer className="mt-4 pt-6 border-t border-gray-200 flex justify-end">
        <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 h-auto text-base font-semibold shadow-md transition-all hover:scale-[1.02]">
          <Download size={18} className="mr-2" />
          生成并导出结果
        </Button>
      </footer>
    </div>
  );
}

export default App;
