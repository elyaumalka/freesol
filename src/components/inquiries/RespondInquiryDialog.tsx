import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Star } from "lucide-react";
import { Inquiry } from "@/types/database";
import { useRespondToInquiry } from "@/hooks/useInquiries";

interface RespondInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiry: Inquiry | null;
}

export function RespondInquiryDialog({ open, onOpenChange, inquiry }: RespondInquiryDialogProps) {
  const respondToInquiry = useRespondToInquiry();
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (inquiry) {
      setResponse(inquiry.response || "");
    }
  }, [inquiry]);

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

  const handleSubmit = () => {
    respondToInquiry.mutate({
      id: inquiry.id,
      response,
    }, {
      onSuccess: () => {
        setResponse("");
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 bg-white rounded-[20px] overflow-hidden [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-[#742551]/20">
          <DialogTitle className="text-[22px] font-normal text-[#742551]">מענה לפנייה</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 flex items-center justify-center">
            <X className="h-6 w-6 text-[#742551]" />
          </button>
        </DialogHeader>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6" dir="rtl">
            <div className="space-y-4">
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
            </div>

            <div className="bg-[#F7F7F7] rounded-[15px] p-6">
              <h3 className="text-[18px] font-medium text-[#742551] text-center mb-4">מענה לפנייה</h3>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="הכנס את התשובה כאן..."
                className="w-full h-[250px] bg-transparent text-[16px] text-[#742551] placeholder-[#742551]/50 outline-none resize-none text-center"
              />
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={respondToInquiry.isPending}
            className="w-full max-w-[300px] mt-6 py-4 bg-[#FFBF66] rounded-full text-white text-[18px] hover:bg-[#FFBF66]/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{respondToInquiry.isPending ? 'שולח...' : 'שליחת התשובה'}</span>
            <span>←</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
