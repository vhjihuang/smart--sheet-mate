import { Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ExcelPreview } from "./ExcelPreview";
import type { ExcelRow } from "@/types";

interface SheetOption {
  SheetName: string;
}

interface SourceConfigBoxProps {
  isSheetLoaded: boolean;
  loading: boolean;
  filePath: string | null;
  sheets: SheetOption[];
  currentSheetIndex: number;
  rows: ExcelRow[];
  headerRowStart: number;
  headerRowEnd: number;
  isHeaderConfirmed: boolean;
  onImport: () => void;
  onLoadFile: () => void;
  onSheetChange: (index: number) => void;
  onSetHeaderRowStart: (row: number) => void;
  onSetHeaderRowEnd: (row: number) => void;
  dataRowStart: number;
  onSetDataRowStart: (row: number) => void;
  onConfirmHeader: () => void;
  onSkipHeader: () => void;
}

export const SourceConfigBox = ({
  isSheetLoaded,
  loading,
  filePath,
  sheets,
  currentSheetIndex,
  rows,
  headerRowStart,
  headerRowEnd,
  isHeaderConfirmed,
  onImport,
  onLoadFile,
  onSheetChange,
  onSetHeaderRowStart,
  onSetHeaderRowEnd,
  dataRowStart,
  onSetDataRowStart,
  onConfirmHeader,
  onSkipHeader
}: SourceConfigBoxProps) => {
  return (
    <section className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0 flex flex-col gap-2">
      {/* File Selection Header */}
      <div className="flex items-center gap-2.5 flex-wrap pb-3 border-b border-gray-100">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSheetLoaded ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}>
          {isSheetLoaded ? <Check size={14} /> : "1"}
        </div>
        <h2 className="text-sm font-bold text-gray-800 shrink-0">源文件</h2>
        
        <Button 
          onClick={onImport} 
          disabled={loading} 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-7 px-2.5 text-[11px]"
        >
          <Upload size={12} className="mr-1" /> 选择文件
        </Button>
        
        {filePath && (
          <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={filePath}>
            {filePath.split(/[/\\]/).pop()}
          </span>
        )}
        
        <div className="flex gap-1 ml-auto shrink-0">
          <Button 
            onClick={onLoadFile} 
            disabled={loading} 
            variant={isSheetLoaded ? "outline" : "default"} 
            className={!isSheetLoaded ? "bg-indigo-600 hover:bg-indigo-700 text-white h-7 px-2 text-[10px]" : "h-7 px-2 text-[10px]"} 
            size="sm"
          >
            {isSheetLoaded ? "刷新" : "加载"}
          </Button>
          
          {sheets.length > 1 && (
            <Select 
              disabled={loading}
              value={currentSheetIndex.toString()} 
              onValueChange={(v) => onSheetChange(Number(v))}
            >
              <SelectTrigger className="w-[85px] h-7 text-[10px]">
                <SelectValue placeholder="子表" />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s, i) => (
                  <SelectItem key={i} value={i.toString()}>{s.SheetName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Data Preview & Header Config */}
      {rows.length > 0 && (
        <>
          <ExcelPreview rows={rows} title="源文件" />
          
          <div className="pt-1.5 flex justify-between items-center bg-gray-50/40 p-2 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isHeaderConfirmed ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}>
                {isHeaderConfirmed ? <Check size={12} /> : "2"}
              </div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">表头范围</span>
              <div className="flex items-center gap-1">
                <Select 
                  value={headerRowStart.toString()} 
                  onValueChange={(v) => onSetHeaderRowStart(Number(v))}
                >
                  <SelectTrigger className="w-[85px] h-7 text-[11px] bg-white px-2">
                    <SelectValue placeholder="起始行">
                      {`第 ${headerRowStart + 1} 行`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rows.slice(0, 30).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>第 {i + 1} 行</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-gray-300 text-[10px]">至</span>
                <Select 
                  value={headerRowEnd.toString()} 
                  onValueChange={(v) => onSetHeaderRowEnd(Number(v))}
                >
                  <SelectTrigger className="w-[85px] h-7 text-[11px] bg-white px-2">
                    <SelectValue placeholder="结束行">
                      {`第 ${headerRowEnd + 1} 行`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rows.slice(0, 30).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>第 {i + 1} 行</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="h-4 w-px bg-gray-200 mx-1" />
              
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">数据起始</span>
                {rows.length > headerRowEnd + 1 ? (
                <Select 
                  value={dataRowStart.toString()} 
                  onValueChange={(v) => onSetDataRowStart(Number(v))}
                >
                  <SelectTrigger className="w-[85px] h-7 text-[11px] bg-white px-2 border-orange-100 focus:ring-orange-100">
                    <SelectValue placeholder="数据行">
                      {`第 ${dataRowStart + 1} 行`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rows.slice(headerRowEnd + 1, headerRowEnd + 50).map((_, i) => {
                      const idx = headerRowEnd + 1 + i;
                      return (
                        <SelectItem key={idx} value={idx.toString()}>第 {idx + 1} 行</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                ) : (
                  <span className="text-[10px] text-amber-500 font-bold">无可用数据行</span>
                )}
              </div>
            </div>
            
            <div className="flex gap-1 ml-2">
              <Button 
                onClick={onConfirmHeader} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-[10px] px-2 shadow-sm" 
                size="sm"
              >
                确认
              </Button>
              <Button 
                onClick={onSkipHeader} 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] text-gray-400 px-1 hover:text-gray-600"
              >
                跳过
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
