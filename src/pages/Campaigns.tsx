import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Trash2, Copy, Loader2 } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddCampaignDialog } from "@/components/campaigns/AddCampaignDialog";
import { EditCampaignDialog } from "@/components/campaigns/EditCampaignDialog";
import { useCampaigns, useDeleteCampaign } from "@/hooks/useCampaigns";
import { Campaign } from "@/types/database";
import { toast } from "sonner";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Campaigns() {
  const { data: campaigns, isLoading } = useCampaigns();
  const deleteCampaign = useDeleteCampaign();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setEditDialogOpen(true);
  };

  const handleDelete = (campaignId: string) => {
    if (confirm('האם למחוק את הקמפיין?')) {
      deleteCampaign.mutate(campaignId);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("הלינק הועתק בהצלחה");
  };

  const filteredCampaigns = campaigns?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDiscount = (campaign: Campaign) => {
    if (campaign.discount_type === 'percentage') {
      return `${campaign.discount_value}%`;
    }
    return `${campaign.discount_value} ₪`;
  };

  const exportColumns = [
    { key: 'name' as const, label: 'שם הקמפיין' },
    { key: 'link' as const, label: 'לינק' },
    { key: 'discount_type' as const, label: 'סוג הנחה' },
    { key: 'discount_value' as const, label: 'סכום הנחה' },
    { key: 'usage_count' as const, label: 'כמות מימושים' },
    { key: 'created_at' as const, label: 'תאריך יצירה' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[25px] font-normal text-[#742551]">ניהול קמפיינים</h1>

          <div className="flex items-center gap-4">
            <ExportButton 
              data={campaigns as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="campaigns"
              title="ניהול קמפיינים"
            />
            
            <div className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#215F66]">
              <input 
                type="text" 
                placeholder="חיפוש קמפיין"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[18px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[150px]"
              />
              <Search className="h-5 w-5 text-[#215F66]" />
            </div>

            <button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#FFBF66] rounded-full hover:bg-[#FFBF66]/80 transition-colors"
            >
              <span className="text-[18px] font-normal text-white">הוספת קמפיין</span>
              <img src={PlusIcon} alt="Add" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[30px] overflow-hidden">
          <div className="grid grid-cols-5 py-4 px-6 border-b border-[#742551]/20">
            <div className="text-[20px] font-normal text-[#742551] text-center">שם האושייה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">לינק אישי</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">סכום ההנחה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">כמות מימושים</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין קמפיינים עדיין'}
            </div>
          ) : (
            filteredCampaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="grid grid-cols-5 items-center py-4 px-6 bg-[#F7F7F7] mx-4 my-2 rounded-[30px]"
              >
                <div className="text-[18px] font-normal text-[#742551] text-center">{campaign.name}</div>

                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleCopyLink(campaign.link)}
                    className="flex items-center gap-2 text-[#742551] hover:opacity-70 transition-opacity"
                  >
                    <Copy className="h-4 w-4" />
                    <span className="text-[16px]">העתקת הלינק</span>
                  </button>
                </div>

                <div className="text-[18px] font-normal text-[#742551] text-center">{formatDiscount(campaign)}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{campaign.usage_count}</div>

                <div className="flex items-center gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(campaign)}
                    className="w-10 h-10 rounded-full bg-[#215F66] flex items-center justify-center hover:bg-[#215F66]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(campaign.id)}
                    disabled={deleteCampaign.isPending}
                    className="w-10 h-10 rounded-full bg-[#EE0004] flex items-center justify-center hover:bg-[#EE0004]/80 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-5 w-5 text-white" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddCampaignDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditCampaignDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} campaign={selectedCampaign} />
    </AppLayout>
  );
}
