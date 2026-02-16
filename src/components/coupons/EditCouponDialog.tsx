import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Check, ArrowLeft } from "lucide-react";
import { Coupon } from "@/types/database";
import { useUpdateCoupon } from "@/hooks/useCoupons";

interface EditCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: Coupon | null;
}

export function EditCouponDialog({ open, onOpenChange, coupon }: EditCouponDialogProps) {
  const updateCoupon = useUpdateCoupon();
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percentage" as 'percentage' | 'amount',
    discount_value: "",
  });

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value.toString(),
      });
    }
  }, [coupon]);

  const handleSubmit = () => {
    if (!coupon) return;
    updateCoupon.mutate({
      id: coupon.id,
      code: formData.code,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value) || 0,
    }, {
      onSuccess: () => onOpenChange(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">עריכת קופון קיים</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">קוד הקופון</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
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
        </div>

        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={updateCoupon.isPending}
            className="flex items-center gap-2 px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>{updateCoupon.isPending ? 'שומר...' : 'עדכון ושמירה'}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
