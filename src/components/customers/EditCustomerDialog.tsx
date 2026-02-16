import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ChevronDown, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  source: string | null;
  total_purchases: number;
}

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export function EditCustomerDialog({ open, onOpenChange, customer }: EditCustomerDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    source: "",
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.full_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        source: customer.source || "ישיר",
      });
    }
  }, [customer]);

  const handleSubmit = async () => {
    if (!customer) return;
    
    setIsLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          phone: formData.phone,
        })
        .eq('id', customer.id);
      
      if (profileError) throw profileError;

      toast.success("פרטי הלקוח עודכנו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "שגיאה בעדכון הלקוח");
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">עריכת פרטי לקוח - {customer.full_name}</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="text-[#742551] hover:opacity-70 transition-opacity"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-8 space-y-6">
          {/* Row 1: Name & Email */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">שם הלקוח</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-right outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">כתובת מייל</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551]/60 text-right outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Row 2: Phone & Source */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">טלפון</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-right outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">מקור הגעה</label>
              <div className="relative">
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-right outline-none appearance-none cursor-pointer"
                >
                  <option value="ישיר">ישיר</option>
                  <option value="קמפיין גיטי וינר">קמפיין גיטי וינר</option>
                  <option value="פייסבוק">פייסבוק</option>
                  <option value="אינסטגרם">אינסטגרם</option>
                  <option value="המלצה">המלצה</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFBF66] pointer-events-none" />
              </div>
            </div>
          </div>

        </div>

        {/* Submit Button */}
        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] font-normal hover:bg-[#742551]/90 transition-colors disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            <span>עדכון ושמירה</span>
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}