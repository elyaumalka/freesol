import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FreeRecordingConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function FreeRecordingConfirmDialog({
  open,
  onOpenChange,
  onConfirm
}: FreeRecordingConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md" dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle 
            className="text-[24px] text-right text-[#742551]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            מעבר להקלטה חופשית?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right text-[16px] leading-relaxed">
            במצב הקלטה חופשית, כל מוזיקת הרקע תנוגן ברצף ותוכל להקליט קטעים 
            בכל נקודה שתרצה. הקטעים ישמרו על הטיימליין ותוכל למחוק אותם או 
            להמשיך להקליט עוד.
            <br /><br />
            <strong>שים לב:</strong> לא תוכל לחזור לחלוקה לפי בית ופזמון אחרי שתתחיל.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-3">
          <AlertDialogCancel 
            className="border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            ביטול
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[#D4A853] text-[#742551] hover:bg-[#D4A853]/90"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            כן, עבור להקלטה חופשית
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
