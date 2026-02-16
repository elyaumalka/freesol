import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Trash2, Loader2 } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddCouponDialog } from "@/components/coupons/AddCouponDialog";
import { EditCouponDialog } from "@/components/coupons/EditCouponDialog";
import { useCoupons, useDeleteCoupon } from "@/hooks/useCoupons";
import { Coupon } from "@/types/database";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Coupons() {
  const { data: coupons, isLoading } = useCoupons();
  const deleteCoupon = useDeleteCoupon();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  const handleEdit = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setEditDialogOpen(true);
  };

  const handleDelete = (couponId: string) => {
    if (confirm('האם למחוק את הקופון?')) {
      deleteCoupon.mutate(couponId);
    }
  };

  const filteredCoupons = coupons?.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}%`;
    }
    return `${coupon.discount_value} ₪`;
  };

  const exportColumns = [
    { key: 'code' as const, label: 'קוד קופון' },
    { key: 'discount_type' as const, label: 'סוג הנחה' },
    { key: 'discount_value' as const, label: 'סכום הנחה' },
    { key: 'usage_count' as const, label: 'כמות מימושים' },
    { key: 'created_at' as const, label: 'תאריך יצירה' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[25px] font-normal text-[#742551]">ניהול קופונים</h1>

          <div className="flex items-center gap-4">
            <ExportButton 
              data={coupons as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="coupons"
              title="ניהול קופונים"
            />
            
            <div className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#215F66]">
              <input 
                type="text" 
                placeholder="חיפוש קופון"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[18px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[150px]"
              />
              <Search className="h-5 w-5 text-[#215F66]" />
            </div>

            <button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#FFBF66] rounded-full hover:bg-[#FFBF66]/80 transition-colors"
            >
              <span className="text-[18px] font-normal text-white">הוספת קופון</span>
              <img src={PlusIcon} alt="Add" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[30px] overflow-hidden">
          <div className="grid grid-cols-5 py-4 px-6 border-b border-[#742551]/20">
            <div className="text-[20px] font-normal text-[#742551] text-center">קוד הקופון</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">סוג ההנחה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">סכום ההנחה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">כמות מימושים</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין קופונים עדיין'}
            </div>
          ) : (
            filteredCoupons.map((coupon) => (
              <div 
                key={coupon.id} 
                className="grid grid-cols-5 items-center py-4 px-6 bg-[#F7F7F7] mx-4 my-2 rounded-[30px]"
              >
                <div className="text-[18px] font-normal text-[#742551] text-center">{coupon.code}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">
                  {coupon.discount_type === 'percentage' ? 'אחוזים' : 'סכום'}
                </div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{formatDiscount(coupon)}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{coupon.usage_count}</div>

                <div className="flex items-center gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(coupon)}
                    className="w-10 h-10 rounded-full bg-[#215F66] flex items-center justify-center hover:bg-[#215F66]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(coupon.id)}
                    disabled={deleteCoupon.isPending}
                    className="w-10 h-10 rounded-full bg-[#EE0004] flex items-center justify-center hover:bg-[#EE0004]/80 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-5 w-5 text-white" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddCouponDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditCouponDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} coupon={selectedCoupon} />
    </AppLayout>
  );
}
