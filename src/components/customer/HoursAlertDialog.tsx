import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface HoursAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remainingMinutes: number;
  isUrgent: boolean; // true = second alert (urgent), false = first alert (important)
}

export function HoursAlertDialog({
  open,
  onOpenChange,
  remainingMinutes,
  isUrgent,
}: HoursAlertDialogProps) {
  const navigate = useNavigate();

  const formatTime = (totalMinutes: number) => {
    const mins = Math.floor(totalMinutes);
    const secs = Math.round((totalMinutes - mins) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePurchase = () => {
    onOpenChange(false);
    navigate('/customer/packages');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md border-0 p-0 overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
          borderRadius: '30px'
        }}
      >
        <div className="p-10 text-center">
          {/* Alert Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-8 w-24 h-24 rounded-full border-4 border-[#D4A853] flex items-center justify-center"
          >
            <AlertTriangle className="w-12 h-12 text-[#D4A853]" strokeWidth={2.5} />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[32px] font-bold text-white mb-6"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {isUrgent ? 'התראה דחופה' : 'התראה חשובה'}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/90 text-[18px] mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            נותרו לכם עוד
          </motion.p>

          {/* Time Display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[48px] font-bold text-[#D4A853] mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
            dir="ltr"
          >
            {formatTime(remainingMinutes)}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/90 text-[18px] mb-8"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            דקות לשימוש באולפן שלנו
          </motion.p>

          {/* Purchase Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={handlePurchase}
            className="w-full py-4 rounded-full text-[18px] font-bold text-[#D4A853] border-2 border-[#D4A853] hover:bg-[#D4A853]/10 transition-all"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            + לרכישת שעות נוספות
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
