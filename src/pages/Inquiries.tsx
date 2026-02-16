import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Star, Eye, Loader2 } from "lucide-react";
import { ViewInquiryDialog } from "@/components/inquiries/ViewInquiryDialog";
import { RespondInquiryDialog } from "@/components/inquiries/RespondInquiryDialog";
import { useInquiries } from "@/hooks/useInquiries";
import { Inquiry } from "@/types/database";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Inquiries() {
  const { data: inquiries, isLoading } = useInquiries();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const handleView = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setViewDialogOpen(true);
  };

  const handleRespond = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setRespondDialogOpen(true);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= rating ? 'fill-[#FFBF66] text-[#FFBF66]' : 'fill-transparent text-[#FFBF66]'}`}
          />
        ))}
      </div>
    );
  };

  const filteredInquiries = inquiries?.filter(i => 
    i.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.inquiry_type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  const exportColumns = [
    { key: 'customer_name' as const, label: 'שם הפונה' },
    { key: 'inquiry_type' as const, label: 'סוג הפנייה' },
    { key: 'rating' as const, label: 'דירוג' },
    { key: 'content' as const, label: 'תוכן' },
    { key: 'response' as const, label: 'מענה' },
    { key: 'created_at' as const, label: 'תאריך' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[25px] font-normal text-[#742551]">ניהול פניות</h1>

          <div className="flex items-center gap-4">
            <ExportButton 
              data={inquiries as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="inquiries"
              title="פניות"
            />

            <div className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#215F66]">
              <input 
                type="text" 
                placeholder="חיפוש פנייה"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[18px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[150px]"
              />
              <Search className="h-5 w-5 text-[#215F66]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[30px] overflow-hidden">
          <div className="grid grid-cols-4 py-4 px-6 border-b border-[#742551]/20">
            <div className="text-[20px] font-normal text-[#742551] text-center">שם הפונה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">דירוג</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">סוג הפנייה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">מענה לפנייה</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין פניות עדיין'}
            </div>
          ) : (
            filteredInquiries.map((inquiry) => (
              <div 
                key={inquiry.id} 
                className="grid grid-cols-4 items-center py-4 px-6 bg-[#F7F7F7] mx-4 my-2 rounded-[30px]"
              >
                <div className="text-[18px] font-normal text-[#742551] text-center">{inquiry.customer_name}</div>
                <div>{renderStars(inquiry.rating)}</div>

                <div className="text-center">
                  <span className="text-[18px] font-normal text-[#742551]">{inquiry.inquiry_type}</span>
                  <span className="text-[16px] font-normal text-[#742551] mr-4">{formatDate(inquiry.created_at)}</span>
                </div>

                <div className="flex items-center gap-2 justify-center">
                  <button 
                    onClick={() => handleView(inquiry)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#F9AD44] rounded-full text-white hover:bg-[#F9AD44]/90 transition-colors"
                  >
                    <span className="text-[14px]">צפייה בפנייה</span>
                    <Eye className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleRespond(inquiry)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#742551] rounded-full text-white hover:bg-[#742551]/90 transition-colors"
                  >
                    <span className="text-[14px]">
                      {inquiry.response ? 'עודכן' : 'מענה לפנייה'}
                    </span>
                    <span>←</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ViewInquiryDialog 
        open={viewDialogOpen} 
        onOpenChange={setViewDialogOpen} 
        inquiry={selectedInquiry}
        onRespond={() => {
          setRespondDialogOpen(true);
        }}
      />
      <RespondInquiryDialog 
        open={respondDialogOpen} 
        onOpenChange={setRespondDialogOpen} 
        inquiry={selectedInquiry}
      />
    </AppLayout>
  );
}
