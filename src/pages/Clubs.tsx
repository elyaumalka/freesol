import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Trash2, Loader2 } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddClubDialog } from "@/components/clubs/AddClubDialog";
import { EditClubDialog } from "@/components/clubs/EditClubDialog";
import { useClubs, useDeleteClub } from "@/hooks/useClubs";
import { Club } from "@/types/database";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Clubs() {
  const { data: clubs, isLoading } = useClubs();
  const deleteClub = useDeleteClub();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  const handleEdit = (club: Club) => {
    setSelectedClub(club);
    setEditDialogOpen(true);
  };

  const handleDelete = (clubId: string) => {
    if (confirm('האם למחוק את המועדון?')) {
      deleteClub.mutate(clubId);
    }
  };

  const filteredClubs = clubs?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.coupon_code.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDiscount = (club: Club) => {
    if (club.discount_type === 'percentage') {
      return `${club.discount_value}%`;
    }
    return `${club.discount_value} ₪`;
  };

  const exportColumns = [
    { key: 'name' as const, label: 'שם המועדון' },
    { key: 'coupon_code' as const, label: 'קוד קופון' },
    { key: 'discount_type' as const, label: 'סוג הנחה' },
    { key: 'discount_value' as const, label: 'סכום הנחה' },
    { key: 'usage_count' as const, label: 'כמות מימושים' },
    { key: 'created_at' as const, label: 'תאריך יצירה' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[25px] font-normal text-[#742551]">ניהול מועדונים</h1>

          <div className="flex items-center gap-4">
            <ExportButton 
              data={clubs as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="clubs"
              title="ניהול מועדונים"
            />
            
            <div className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#215F66]">
              <input 
                type="text" 
                placeholder="חיפוש מועדון"
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
              <span className="text-[18px] font-normal text-white">הוספת מועדון</span>
              <img src={PlusIcon} alt="Add" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[30px] overflow-hidden">
          <div className="grid grid-cols-6 py-4 px-6 border-b border-[#742551]/20">
            <div className="text-[20px] font-normal text-[#742551] text-center">שם המועדון</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">סוג ההנחה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">סכום ההנחה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">קוד קופון</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">כמות מימושים</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין מועדונים עדיין'}
            </div>
          ) : (
            filteredClubs.map((club) => (
              <div 
                key={club.id} 
                className="grid grid-cols-6 items-center py-4 px-6 bg-[#F7F7F7] mx-4 my-2 rounded-[30px]"
              >
                <div className="text-[18px] font-normal text-[#742551] text-center">{club.name}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">
                  {club.discount_type === 'percentage' ? 'אחוזים' : 'סכום'}
                </div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{formatDiscount(club)}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{club.coupon_code}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{club.usage_count}</div>

                <div className="flex items-center gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(club)}
                    className="w-10 h-10 rounded-full bg-[#215F66] flex items-center justify-center hover:bg-[#215F66]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(club.id)}
                    disabled={deleteClub.isPending}
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

      <AddClubDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditClubDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} club={selectedClub} />
    </AppLayout>
  );
}
