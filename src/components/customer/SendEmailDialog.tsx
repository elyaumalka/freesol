import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioUrl: string;
  songName: string;
  customerName?: string;
  defaultEmail?: string;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  audioUrl,
  songName,
  customerName,
  defaultEmail = "",
}: SendEmailDialogProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSend = async () => {
    if (!email || !email.includes('@')) {
      toast.error('נא להזין כתובת מייל תקינה');
      return;
    }

    if (!audioUrl) {
      toast.error('אין קובץ אודיו לשליחה');
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-playback-email', {
        body: {
          email,
          audioUrl,
          songName,
          customerName,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setIsSent(true);
        toast.success('ההקלטה נשלחה בהצלחה למייל!');
        
        // Close dialog after a short delay
        setTimeout(() => {
          onOpenChange(false);
          setIsSent(false);
          setEmail(defaultEmail);
        }, 2000);
      } else {
        throw new Error(data?.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('שגיאה בשליחת המייל. נסה שוב.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      onOpenChange(false);
      setIsSent(false);
      setEmail(defaultEmail);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="bg-white rounded-[20px] p-8 max-w-md"
        style={{ direction: 'rtl' }}
      >
        <DialogHeader>
          <DialogTitle 
            className="text-[24px] font-bold text-[#742551] text-center"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            שליחת ההקלטה למייל
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 mt-4">
          {isSent ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(180deg, #215F66 0%, #742551 100%)' }}
              >
                <Check className="w-8 h-8 text-white" />
              </div>
              <p 
                className="text-[18px] text-[#215F66] text-center"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                ההקלטה נשלחה בהצלחה!
              </p>
            </div>
          ) : (
            <>
              <p 
                className="text-[16px] text-gray-600 text-center"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                הזן את כתובת המייל שאליה תרצה לשלוח את ההקלטה
              </p>

              <Input
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-center text-[18px] h-[50px] rounded-full border-2 border-[#742551]/30 focus:border-[#742551]"
                style={{ fontFamily: 'Discovery_Fs', direction: 'ltr' }}
                disabled={isSending}
              />

              <p 
                className="text-[14px] text-gray-400 text-center"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                שיר: {songName}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isSending}
                  className="flex-1 h-[50px] rounded-full border-2 border-[#742551] text-[#742551] font-bold text-[18px] hover:bg-[#742551]/10 transition-colors disabled:opacity-50"
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  ביטול
                </button>
                
                <button
                  onClick={handleSend}
                  disabled={isSending || !email}
                  className="flex-1 h-[50px] rounded-full bg-[#742551] text-white font-bold text-[18px] hover:bg-[#5a1c3f] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      שלח למייל
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
