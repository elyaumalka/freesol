import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Check } from "lucide-react";
import { useCreateClub } from "@/hooks/useClubs";

interface AddClubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddClubDialog({ open, onOpenChange }: AddClubDialogProps) {
  const createClub = useCreateClub();
  const [formData, setFormData] = useState({
    name: "",
    discount_type: "percentage" as 'percentage' | 'amount',
    discount_value: "",
    coupon_code: "",
  });

  const handleSubmit = () => {
    createClub.mutate({
      name: formData.name,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value) || 0,
      coupon_code: formData.coupon_code,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({ name: "", discount_type: "percentage", discount_value: "", coupon_code: "" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">הוספת מועדון חדש</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">שם המועדון</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">סוג ההנחה</label>
            <div className="relative">
              <select
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'amount' })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none appearance-none"
                dir="rtl"
              >
                <option value="percentage">אחוזים</option>
                <option value="amount">סכום</option>
              </select>
              <Check className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFBF66]" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">סכום ההנחה</label>
            <input
              type="number"
              value={formData.discount_value}
              onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">קוד הקופון</label>
            <input
              type="text"
              value={formData.coupon_code}
              onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value })}
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
            />
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={createClub.isPending}
            className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50"
          >
            {createClub.isPending ? 'שומר...' : 'הוספה +'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
