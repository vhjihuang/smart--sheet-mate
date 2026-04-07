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

interface TemplateConfigBoxProps {
  templateRows: ExcelRow[];
  loading: boolean;
  templatePath: string | null;
  templateHeaderRowStart: number;
  templateHeaderRowEnd: number;
  onUploadTemplate: () => void;
  onSetTemplateHeaderRowStart: (row: number) => void;
  onSetTemplateHeaderRowEnd: (row: number) => void;
  onConfirmTemplateHeader: () => void;
}

export const TemplateConfigBox = ({
  templateRows,
  loading,
  templatePath,
  templateHeaderRowStart,
  templateHeaderRowEnd,
  onUploadTemplate,
  onSetTemplateHeaderRowStart,
  onSetTemplateHeaderRowEnd,
  onConfirmTemplateHeader
}: TemplateConfigBoxProps) => {
  return (
    <section className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0 flex flex-col gap-2">
      {/* Target Template Header */}
      <div className="flex items-center gap-2.5 flex-wrap pb-3 border-b border-gray-100">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${templateRows.length > 0 ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}>
          {templateRows.length > 0 ? <Check size={14} /> : "3"}
        </div>
        <h2 className="text-sm font-bold text-gray-800 shrink-0">目标模板</h2>
        
        <Button 
          onClick={onUploadTemplate} 
          disabled={loading} 
          size="sm" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-7 px-2.5 text-[11px]"
        >
          <Upload size={12} className="mr-1" /> 上传模板
        </Button>
        
        {templatePath && (
          <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={templatePath}>
            {templatePath.split(/[/\\]/).pop()}
          </span>
        )}
      </div>

      {/* Template Preview & Hierarchy Config */}
      {templateRows.length > 0 && (
        <>
          <ExcelPreview rows={templateRows} title="模板" />
          
          <div className="pt-1.5 flex justify-between items-center bg-gray-50/40 p-2 rounded-lg">
            <div className="flex items-center gap-2 min-0">
              <div className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">4</div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">模板层级</span>
              <div className="flex items-center gap-1">
                <Select 
                  value={templateHeaderRowStart.toString()} 
                  onValueChange={(v) => onSetTemplateHeaderRowStart(Number(v))}
                >
                  <SelectTrigger className="w-[85px] h-7 text-[11px] bg-white px-2">
                    <SelectValue placeholder="起始行">
                      {`第 ${templateHeaderRowStart + 1} 行`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {templateRows.slice(0, 30).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>第 {i + 1} 行</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-gray-300 text-[10px]">至</span>
                <Select 
                  value={templateHeaderRowEnd.toString()} 
                  onValueChange={(v) => onSetTemplateHeaderRowEnd(Number(v))}
                >
                  <SelectTrigger className="w-[85px] h-7 text-[11px] bg-white px-2">
                    <SelectValue placeholder="结束行">
                      {`第 ${templateHeaderRowEnd + 1} 行`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {templateRows.slice(0, 30).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>第 {i + 1} 行</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={onConfirmTemplateHeader} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 text-[10px] px-2 ml-2 shadow-sm" 
              size="sm"
            >
              同步
            </Button>
          </div>
        </>
      )}
    </section>
  );
};
