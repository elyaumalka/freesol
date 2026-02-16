import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCustomerDialog({ open, onOpenChange }: AddCustomerDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    recordingHours: "",
    paymentAmount: "",
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast.error("נא למלא את כל שדות החובה");
      return;
    }

    // Generate a random password for the customer
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-customer', {
        body: {
          email: formData.email,
          password: generatedPassword,
          fullName: formData.name,
          phone: formData.phone,
          recordingHours: formData.recordingHours,
          paymentAmount: formData.paymentAmount,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("לקוח נוסף בהצלחה");
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      onOpenChange(false);
      setFormData({ name: "", email: "", phone: "", recordingHours: "", paymentAmount: "" });
    } catch (error: any) {
      toast.error(error.message || "שגיאה ביצירת לקוח");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">הוספת פרטי לקוח</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">שם הלקוח *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-left outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">כתובת מייל *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-left outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">טלפון</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-left outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">שעות הקלטה</label>
              <input
                type="number"
                value={formData.recordingHours}
                onChange={(e) => setFormData({ ...formData, recordingHours: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-left outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">סכום תשלום</label>
              <input
                type="number"
                value={formData.paymentAmount}
                onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                placeholder="₪"
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-left outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {isLoading ? 'יוצר לקוח...' : 'הוספת לקוח +'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
