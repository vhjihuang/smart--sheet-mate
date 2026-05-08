import { FileSpreadsheet } from "lucide-react";
import type { ExcelRow } from "@/types";
import { getColumnLabel } from "@/utils/excel";

interface ExcelPreviewProps {
  rows: ExcelRow[];
  title: string;
}

export const ExcelPreview = ({ rows, title }: ExcelPreviewProps) => {
  if (!rows || rows.length === 0) return null;
  
  return (
    <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
      {/* Header */}
      <div className="bg-gray-50/80 px-2 py-1.5 border-b border-gray-100 flex justify-between items-center bg-white/50 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-blue-100 rounded">
            <FileSpreadsheet size={10} className="text-blue-600" />
          </div>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{title} 数据预览</span>
        </div>
        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-black">
          已加载 {rows.length} 行
        </span>
      </div>

      {/* Scrollable Table */}
      <div className="max-h-48 overflow-auto scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-sm z-10">
            <tr>
              <th className="p-1.5 border-b border-r border-gray-100 bg-gray-50/50 text-gray-400 w-10 text-center italic font-mono">#</th>
              {rows[0]?.DataList?.map((_, i) => (
                <th 
                  key={i} 
                  className="p-1.5 border-b border-gray-100 font-bold text-gray-400 bg-gray-50/30 min-w-[100px] uppercase tracking-tighter"
                >
                  列 {getColumnLabel(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.slice(0, 50).map((row, i) => (
              <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                <td className="p-1.5 border-r border-gray-50 bg-gray-50/20 text-gray-400 text-center font-mono font-bold group-hover:text-blue-500 transition-colors">
                  {i + 1}
                </td>
                {(row.DataList || []).map((cell, j) => (
                  <td 
                    key={j} 
                    className="p-1.5 text-gray-600 whitespace-nowrap truncate max-w-[180px] font-medium" 
                    title={cell}
                  >
                    {cell || <span className="text-gray-300 italic text-[9px]">null</span>}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length > 50 && (
              <tr>
                <td colSpan={(rows[0]?.DataList?.length || 0) + 1} className="p-2 text-center text-gray-400 italic bg-gray-50/10">
                  仅展示前 50 行数据以保证性能...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
