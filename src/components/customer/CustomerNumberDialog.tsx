import { motion } from "framer-motion";
import { Copy, Check, User } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomerNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerNumber: string;
  onContinue: () => void;
  hoursAdded?: number;
}

export function CustomerNumberDialog({
  open,
  onOpenChange,
  customerNumber,
  onContinue,
  hoursAdded,
}: CustomerNumberDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customerNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md border-0 p-0 overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, #215F66 0%, #742551 100%)',
          borderRadius: '30px'
        }}
      >
        <div className="p-8 text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-6 w-20 h-20 rounded-full bg-white/20 flex items-center justify-center"
          >
            <User className="w-10 h-10 text-white" />
          </motion.div>

          {/* Title */}
          <DialogHeader>
            <DialogTitle 
              className="text-[28px] font-bold text-white text-center mb-2"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              ברוכים הבאים! 🎉
            </DialogTitle>
          </DialogHeader>

          <p 
            className="text-white/90 text-[18px] mb-6"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            מספר הלקוח שלך הוא:
          </p>

          {/* Customer Number Display */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[20px] p-6 mb-6"
          >
            <div className="flex items-center justify-center gap-4">
              <span 
                className="text-[48px] font-bold text-[#742551] tracking-[0.2em]"
                style={{ fontFamily: 'Discovery_Fs' }}
                dir="ltr"
              >
                {customerNumber}
              </span>
              <button
                onClick={handleCopy}
                className="p-3 rounded-full bg-[#D4A853] hover:bg-[#c49943] transition-colors"
                title="העתק מספר לקוח"
              >
                {copied ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <Copy className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            {copied && (
              <p 
                className="text-[#4CAF50] text-[14px] mt-2"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                הועתק!
              </p>
            )}
          </motion.div>

          {/* Hours Added Message */}
          {hoursAdded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="bg-[#4CAF50]/20 rounded-[15px] p-4 mb-4 border border-[#4CAF50]/50"
            >
              <p 
                className="text-white text-[18px] font-bold"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                🎉 נוספו לך {hoursAdded} שעות הקלטה!
              </p>
              <p 
                className="text-white/80 text-[14px] mt-1"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                השעות מוכנות לשימוש בחשבונך
              </p>
            </motion.div>
          )}

          {/* Warning Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-[#FFBF66]/20 rounded-[15px] p-4 mb-6 border border-[#FFBF66]/50"
          >
            <p 
              className="text-white text-[16px]"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              ⚠️ שמור את המספר הזה!
              <br />
              תצטרך אותו בכל כניסה למערכת
            </p>
          </motion.div>

          {/* Continue Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onContinue}
            className="w-full py-4 rounded-full text-[20px] font-bold text-[#742551] hover:opacity-90 transition-all"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#FFBF66'
            }}
          >
            הבנתי, להמשיך ←
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
