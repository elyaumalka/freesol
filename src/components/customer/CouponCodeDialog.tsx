import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Loader2, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CouponCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPrice: number;
  onApplyCoupon: (couponId: string | null, clubId: string | null, discountedPrice: number, discountDescription: string) => void;
  onSkip: () => void;
}

export function CouponCodeDialog({
  open,
  onOpenChange,
  originalPrice,
  onApplyCoupon,
  onSkip,
}: CouponCodeDialogProps) {
  const [couponCode, setCouponCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    discountedPrice: number;
    discountDescription: string;
    isClub: boolean;
    clubName?: string;
  } | null>(null);

  const calculateDiscount = (discountType: string, discountValue: number): { discountedPrice: number; description: string } => {
    if (discountType === 'percentage') {
      const discountAmount = (originalPrice * discountValue) / 100;
      const discountedPrice = Math.max(0, originalPrice - discountAmount);
      return {
        discountedPrice: Math.round(discountedPrice * 100) / 100,
        description: `${discountValue}% הנחה`
      };
    } else {
      // Fixed amount
      const discountedPrice = Math.max(0, originalPrice - discountValue);
      return {
        discountedPrice: Math.round(discountedPrice * 100) / 100,
        description: `₪${discountValue} הנחה`
      };
    }
  };

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("נא להזין קוד קופון");
      return;
    }

    setIsValidating(true);
    try {
      const codeToCheck = couponCode.trim().toUpperCase();
      
      // First check regular coupons
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', codeToCheck)
        .maybeSingle();

      if (couponError) throw couponError;

      if (coupon) {
        const { discountedPrice, description } = calculateDiscount(
          coupon.discount_type,
          coupon.discount_value
        );

        setAppliedCoupon({
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          discountedPrice,
          discountDescription: description,
          isClub: false,
        });

        toast.success(`קופון "${coupon.code}" הופעל בהצלחה!`);
        return;
      }

      // If not found in coupons, check clubs
      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('*')
        .eq('coupon_code', codeToCheck)
        .maybeSingle();

      if (clubError) throw clubError;

      if (club) {
        const { discountedPrice, description } = calculateDiscount(
          club.discount_type,
          club.discount_value
        );

        setAppliedCoupon({
          id: club.id,
          code: club.coupon_code,
          discountType: club.discount_type,
          discountValue: club.discount_value,
          discountedPrice,
          discountDescription: `${description} (${club.name})`,
          isClub: true,
          clubName: club.name,
        });

        toast.success(`קופון מועדון "${club.name}" הופעל בהצלחה!`);
        return;
      }

      // Not found anywhere
      toast.error("קוד קופון לא נמצא");
      setAppliedCoupon(null);
    } catch (error) {
      console.error("Error validating coupon:", error);
      toast.error("שגיאה בבדיקת הקופון");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const handleContinue = () => {
    if (appliedCoupon) {
      onApplyCoupon(
        appliedCoupon.isClub ? null : appliedCoupon.id,
        appliedCoupon.isClub ? appliedCoupon.id : null,
        appliedCoupon.discountedPrice,
        appliedCoupon.discountDescription
      );
    }
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] border-none bg-gradient-to-br from-[#215F66] to-[#742551] text-white p-0 overflow-hidden"
        dir="rtl"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>הזן קוד קופון</DialogTitle>
        </VisuallyHidden>
        <div className="relative p-8 text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#D4A853]/20 flex items-center justify-center"
          >
            <Tag className="w-8 h-8 text-[#D4A853]" />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[28px] font-bold mb-2 text-[#D4A853]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            יש לך קוד קופון?
          </motion.h2>

          {/* Original Price */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white/70 text-[18px] mb-6"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            סכום לתשלום: <span className={appliedCoupon ? "line-through" : "text-[#D4A853]"}>₪{originalPrice}</span>
            {appliedCoupon && (
              <span className="text-[#D4A853] mr-2">₪{appliedCoupon.discountedPrice}</span>
            )}
          </motion.p>

          {/* Coupon Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            {appliedCoupon ? (
              <div className="flex items-center justify-center gap-2 p-4 rounded-[10px] bg-[#D4A853]/20 border border-[#D4A853]/50">
                <Tag className="w-5 h-5 text-[#D4A853]" />
                <span 
                  className="text-[#D4A853] text-[18px]"
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  {appliedCoupon.code} - {appliedCoupon.discountDescription}
                </span>
                <button
                  onClick={handleRemoveCoupon}
                  className="mr-2 p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="הזן קוד קופון"
                  className="flex-1 h-[50px] text-center text-[18px] bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-[#D4A853]"
                  style={{ fontFamily: 'Discovery_Fs' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleValidateCoupon();
                    }
                  }}
                />
                <button
                  onClick={handleValidateCoupon}
                  disabled={isValidating || !couponCode.trim()}
                  className="h-[50px] px-6 rounded-[10px] text-[16px] font-bold transition-all disabled:opacity-50 flex items-center justify-center"
                  style={{ 
                    fontFamily: 'Discovery_Fs',
                    background: '#D4A853',
                    color: '#742551'
                  }}
                >
                  {isValidating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "בדוק"
                  )}
                </button>
              </div>
            )}
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col gap-3"
          >
            {appliedCoupon ? (
              <button
                onClick={handleContinue}
                className="w-full h-[50px] rounded-[10px] text-[18px] font-bold transition-all flex items-center justify-center"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  background: '#D4A853',
                  color: '#742551'
                }}
              >
                המשך לתשלום - ₪{appliedCoupon.discountedPrice}
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="w-full h-[50px] rounded-[10px] text-[18px] font-bold transition-all flex items-center justify-center"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  background: '#D4A853',
                  color: '#742551'
                }}
              >
                המשך ללא קופון
              </button>
            )}
            
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-[50px] rounded-[10px] text-[18px] font-bold transition-all border-2 border-white/30 text-white hover:bg-white/10"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              ביטול
            </button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
