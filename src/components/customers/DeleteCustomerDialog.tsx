import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    user_id: string;
    full_name: string;
  } | null;
}

export function DeleteCustomerDialog({ open, onOpenChange, customer }: DeleteCustomerDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!customer) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-customer', {
        body: { userId: customer.user_id }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("הלקוח נמחק בהצלחה");
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "שגיאה במחיקת הלקוח");
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#EE0004]">מחיקת לקוח</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-50 rounded-[20px]">
            <AlertTriangle className="h-8 w-8 text-[#EE0004] flex-shrink-0" />
            <div className="text-right">
              <p className="text-[18px] font-bold text-[#742551]">האם אתה בטוח?</p>
              <p className="text-[16px] text-[#742551]/70">פעולה זו תמחק את הלקוח <strong>{customer.full_name}</strong> לצמיתות ולא ניתן לשחזר אותה.</p>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-8 py-4 bg-gray-200 text-[#742551] rounded-full text-[18px] hover:bg-gray-300"
          >
            ביטול
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="px-8 py-4 bg-[#EE0004] text-white rounded-full text-[18px] hover:bg-[#EE0004]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {isLoading ? 'מוחק...' : 'מחק לקוח'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
