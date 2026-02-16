import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Star } from "lucide-react";
import { Inquiry } from "@/types/database";

interface ViewInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: Inquiry | null;
  onRespond: () => void;
}

export function ViewInquiryDialog({ open, onOpenChange, inquiry, onRespond }: ViewInquiryDialogProps) {
  if (!inquiry) return null;

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= rating ? 'fill-[#FFBF66] text-[#FFBF66]' : 'fill-white text-white'}`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 bg-white rounded-[20px] overflow-hidden [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-[#742551]/20">
          <DialogTitle className="text-[22px] font-normal text-[#742551]">צפייה בפנייה</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 flex items-center justify-center">
            <X className="h-6 w-6 text-[#742551]" />
          </button>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="bg-[#742551] rounded-[15px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[18px] text-white">{inquiry.customer_name}</span>
              <span className="text-[16px] text-white">{formatDate(inquiry.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[16px] text-white">{inquiry.inquiry_type}</span>
              {renderStars(inquiry.rating)}
            </div>
          </div>

          <div className="bg-[#F0F0F0] rounded-[15px] p-6 min-h-[200px]">
            <p className="text-[16px] text-[#742551] text-center leading-relaxed whitespace-pre-line">
              {inquiry.content}
            </p>
          </div>

          {inquiry.response && (
            <div className="bg-[#FFBF66]/20 rounded-[15px] p-6">
              <h4 className="text-[16px] font-bold text-[#742551] mb-2">תשובה:</h4>
              <p className="text-[16px] text-[#742551] whitespace-pre-line">{inquiry.response}</p>
            </div>
          )}

          <button 
            onClick={() => {
              onOpenChange(false);
              onRespond();
            }}
            className="w-full py-4 bg-[#742551] rounded-full text-white text-[18px] hover:bg-[#742551]/90 flex items-center justify-center gap-2"
          >
            <span>{inquiry.response ? 'עדכון תשובה' : 'מענה לפנייה'}</span>
            <span>←</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
