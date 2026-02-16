import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface PlaybackPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbackName: string;
  playbackCost: number;
  playbackId: string;
  onPaymentSuccess: () => void;
}

export function PlaybackPaymentDialog({
  open,
  onOpenChange,
  playbackName,
  playbackCost,
  playbackId,
  onPaymentSuccess,
}: PlaybackPaymentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר כדי לבצע תשלום");
        return;
      }

      // Get user profile for payment details
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Create a playback purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from("playback_purchases")
        .insert({
          user_id: user.id,
          playback_id: playbackId,
          amount: playbackCost,
          status: "pending",
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Get the current URL for redirect - preserve step params
      const currentUrl = new URL(window.location.href);
      // Remove only payment-related params, keep step params
      currentUrl.searchParams.delete('playback_payment');
      currentUrl.searchParams.delete('purchase_id');
      // Add payment success params
      const successUrl = new URL(currentUrl.toString());
      successUrl.searchParams.set('playback_payment', 'success');
      successUrl.searchParams.set('purchase_id', purchase.id);
      successUrl.searchParams.set('playback_id', playbackId);
      
      const cancelUrl = new URL(currentUrl.toString());
      cancelUrl.searchParams.set('playback_payment', 'cancelled');
      
      const redirectUrl = successUrl.toString();
      const cancelUrlStr = cancelUrl.toString();

      // Call playback payment function
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        "playback-payment",
        {
          body: {
            playbackId: playbackId,
            playbackName: playbackName,
            amount: playbackCost,
            userId: user.id,
            customerName: profile?.full_name || user.email,
            customerEmail: user.email,
            customerPhone: profile?.phone || "",
            playbackPurchaseId: purchase.id,
            successUrl: redirectUrl,
            cancelUrl: cancelUrlStr,
          },
        }
      );

      if (paymentError) throw paymentError;

      if (paymentData?.Data?.RedirectURL) {
        // Redirect to Sumit payment page
        window.location.href = paymentData.Data.RedirectURL;
      } else {
        throw new Error("לא התקבל קישור לתשלום");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("שגיאה ביצירת התשלום");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] border-none bg-gradient-to-br from-[#215F66] to-[#742551] text-white p-0 overflow-hidden"
        dir="rtl"
      >
        <div className="relative p-8 text-center">
          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[28px] font-bold mb-6 text-[#D4A853]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            תשלום עבור פלייבק
          </motion.h2>

          {/* Playback Name */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4"
          >
            <p
              className="text-white text-[20px] mb-4"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {playbackName}
            </p>
            <p
              className="text-[#D4A853] text-[36px] font-bold"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              ₪{playbackCost}
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white/70 text-[16px] mb-8"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            לאחר התשלום תוכל להמשיך להקלטה עם הפלייבק הנבחר
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-4"
          >
            <button
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 h-[50px] rounded-[10px] text-[18px] font-bold transition-all border-2 border-white/30 text-white hover:bg-white/10"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              ביטול
            </button>
            <button
              onClick={handlePayment}
              disabled={isLoading}
              className="flex-1 h-[50px] rounded-[10px] text-[18px] font-bold transition-all disabled:opacity-50 flex items-center justify-center"
              style={{ 
                fontFamily: 'Discovery_Fs',
                background: '#D4A853',
                color: '#742551'
              }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "לתשלום"
              )}
            </button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
