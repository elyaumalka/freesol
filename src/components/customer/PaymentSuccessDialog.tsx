import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

interface PaymentSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hoursAdded?: number;
}

export function PaymentSuccessDialog({ open, onOpenChange, hoursAdded }: PaymentSuccessDialogProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-none bg-gradient-to-br from-[#215F66] to-[#742551] text-white p-0 overflow-hidden">
        <div className="relative p-8 text-center">
          {/* Confetti Animation */}
          <AnimatePresence>
            {showConfetti && (
              <>
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      opacity: 1, 
                      y: -20, 
                      x: Math.random() * 300 - 150,
                      scale: 0
                    }}
                    animate={{ 
                      opacity: 0, 
                      y: 400,
                      rotate: Math.random() * 720 - 360,
                      scale: Math.random() * 1.5 + 0.5
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                      duration: 2 + Math.random(),
                      delay: Math.random() * 0.5
                    }}
                    className="absolute top-0 left-1/2 pointer-events-none"
                    style={{
                      width: 10 + Math.random() * 10,
                      height: 10 + Math.random() * 10,
                      backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][Math.floor(Math.random() * 6)],
                      borderRadius: Math.random() > 0.5 ? '50%' : '0%',
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              delay: 0.1
            }}
            className="mx-auto mb-6 w-24 h-24 rounded-full bg-white/20 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-[#215F66]" strokeWidth={3} />
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            התשלום עבר בהצלחה! 🎉
          </motion.h2>

          {/* Hours Added */}
          {hoursAdded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-2 mb-4"
            >
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-xl" style={{ fontFamily: 'Discovery_Fs' }}>
                נוספו לך {hoursAdded} שעות הקלטה
              </span>
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </motion.div>
          )}

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-white/80 text-lg mb-8"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            השעות נוספו לחשבונך ומוכנות לשימוש
          </motion.p>

          {/* Close Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpenChange(false)}
            className="px-8 py-3 bg-white text-[#215F66] rounded-full font-bold text-lg hover:shadow-lg transition-shadow"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            בואו נתחיל! 🎤
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
