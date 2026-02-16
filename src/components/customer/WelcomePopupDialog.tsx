import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useWelcomePopupImage } from "@/hooks/useSystemSettings";

const WELCOME_POPUP_SESSION_KEY = 'freesol_welcome_popup_shown';

export function WelcomePopupDialog() {
  const { data: imageUrl, isLoading } = useWelcomePopupImage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only show if image exists and hasn't been shown this session
    if (!isLoading && imageUrl) {
      const hasShown = sessionStorage.getItem(WELCOME_POPUP_SESSION_KEY);
      if (!hasShown) {
        setOpen(true);
        sessionStorage.setItem(WELCOME_POPUP_SESSION_KEY, 'true');
      }
    }
  }, [imageUrl, isLoading]);

  const handleClose = () => {
    setOpen(false);
  };

  // Don't render if no image
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent 
        className="sm:max-w-[1128px] p-0 border-0 overflow-hidden bg-transparent shadow-none"
        style={{ borderRadius: '20px' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Welcome Image */}
          <img 
            src={imageUrl} 
            alt="ברוכים הבאים" 
            className="w-full h-auto max-h-[765px] object-contain rounded-[20px]"
            onClick={handleClose}
            style={{ cursor: 'pointer' }}
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
