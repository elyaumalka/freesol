import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToCSV, exportToJSON, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";

interface ExportColumn<T> {
  key: keyof T;
  label: string;
}

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[] | undefined;
  columns: ExportColumn<T>[];
  filename: string;
  title?: string;
}

export function ExportButton<T extends Record<string, unknown>>({ 
  data, 
  columns, 
  filename,
  title 
}: ExportButtonProps<T>) {
  const handleExportCSV = () => {
    if (!data || data.length === 0) {
      toast.error('אין נתונים לייצוא');
      return;
    }
    exportToCSV(data, filename, columns);
    toast.success('הקובץ הורד בהצלחה');
  };

  const handleExportJSON = () => {
    if (!data || data.length === 0) {
      toast.error('אין נתונים לייצוא');
      return;
    }
    exportToJSON(data, filename);
    toast.success('הקובץ הורד בהצלחה');
  };

  const handleExportPDF = () => {
    if (!data || data.length === 0) {
      toast.error('אין נתונים לייצוא');
      return;
    }
    exportToPDF(data, filename, columns, title);
    toast.success('הקובץ הורד בהצלחה');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="flex items-center gap-2 px-6 py-3 bg-[#215F66] rounded-full hover:bg-[#215F66]/80 transition-colors"
        >
          <span className="text-[18px] font-normal text-white">ייצוא נתונים</span>
          <Download className="h-5 w-5 text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          <span>ייצוא כ-PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>ייצוא כ-CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          <span>ייצוא כ-JSON</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
