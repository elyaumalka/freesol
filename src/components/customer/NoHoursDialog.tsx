import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface NoHoursDialogProps {
  open: boolean;
}

export function NoHoursDialog({ open }: NoHoursDialogProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handlePurchase = () => {
    navigate('/customer/packages');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/customer/login');
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-[500px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[#EE0004]/10 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-[#EE0004]" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-[28px] font-bold text-[#742551]" style={{ fontFamily: 'Discovery_Fs' }}>
              אופס, חבל שנגמר לנו הזמן!
            </h2>
            <p className="text-[18px] text-[#742551]/70" style={{ fontFamily: 'Discovery_Fs' }}>
              על מנת להמשיך להשתמש במערכת, יש לרכוש חבילת שעות נוספת.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePurchase}
              className="w-full py-4 text-white rounded-full text-[20px] font-bold"
              style={{
                background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
                fontFamily: 'Discovery_Fs',
              }}
            >
              רכישת שעות נוספות
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-4 text-[#742551] rounded-full text-[18px] font-medium bg-[#F7F7F7] hover:bg-[#EFEFEF] transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              <span>יציאה מהמערכת</span>
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
