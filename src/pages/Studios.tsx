import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Trash2, Loader2 } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddStudioDialog } from "@/components/studios/AddStudioDialog";
import { EditStudioDialog } from "@/components/studios/EditStudioDialog";
import { useStudios, useDeleteStudio, useToggleStudioStatus } from "@/hooks/useStudios";
import { Studio } from "@/types/database";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Studios() {
  const { data: studios, isLoading } = useStudios();
  const deleteStudio = useDeleteStudio();
  const toggleStatus = useToggleStudioStatus();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);

  const handleEdit = (studio: Studio) => {
    setSelectedStudio(studio);
    setEditDialogOpen(true);
  };

  const handleDelete = (studioId: string) => {
    if (confirm('האם למחוק את האולפן?')) {
      deleteStudio.mutate(studioId);
    }
  };

  const handleToggleStatus = (studio: Studio) => {
    toggleStatus.mutate({ id: studio.id, status: !studio.status });
  };

  const filteredStudios = studios?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.unique_id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const exportColumns = [
    { key: 'name' as const, label: 'שם האולפן' },
    { key: 'unique_id' as const, label: 'מזהה ייחודי' },
    { key: 'status' as const, label: 'סטטוס' },
    { key: 'activity_time' as const, label: 'זמן פעילות' },
    { key: 'created_at' as const, label: 'תאריך יצירה' },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 lg:space-y-6 px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[20px] lg:text-[22px] xl:text-[25px] font-normal text-[#742551]">ניהול אולפנים</h1>

          <div className="flex flex-wrap items-center gap-3 lg:gap-4">
            <ExportButton 
              data={studios as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="studios"
              title="ניהול אולפנים"
            />
            
            <div className="flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 rounded-full border border-[#215F66]">
              <input 
                type="text" 
                placeholder="חיפוש אולפן"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[14px] lg:text-[16px] xl:text-[18px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[100px] lg:w-[130px] xl:w-[150px]"
              />
              <Search className="h-4 w-4 lg:h-5 lg:w-5 text-[#215F66]" />
            </div>

            <button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 bg-[#FFBF66] rounded-full hover:bg-[#FFBF66]/80 transition-colors"
            >
              <span className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-white">הוספת אולפן</span>
              <img src={PlusIcon} alt="Add" className="h-4 w-4 lg:h-5 lg:w-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[20px] lg:rounded-[30px] overflow-hidden overflow-x-auto">
          <div className="grid grid-cols-6 py-3 lg:py-4 px-4 lg:px-6 border-b border-[#742551]/20 min-w-[800px]">
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">שם האולפן</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">מזהה ייחודי</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">סיסמא</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">סטטוס</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">זמן פעילות</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredStudios.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין אולפנים עדיין'}
            </div>
          ) : (
            filteredStudios.map((studio) => (
              <div 
                key={studio.id} 
                className="grid grid-cols-6 items-center py-3 lg:py-4 px-4 lg:px-6 bg-[#F7F7F7] mx-3 lg:mx-4 my-2 rounded-[20px] lg:rounded-[30px] min-w-[800px]"
              >
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{studio.name}</div>
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{studio.unique_id}</div>
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{studio.password}</div>

                <div className="flex justify-center">
                  <button 
                    onClick={() => handleToggleStatus(studio)}
                    disabled={toggleStatus.isPending}
                    className={`w-12 h-6 lg:w-16 lg:h-8 rounded-full flex items-center px-0.5 lg:px-1 transition-all cursor-pointer ${
                      studio.status ? "bg-[#215F66] justify-end" : "bg-gray-300 justify-start"
                    }`}
                  >
                    <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded-full transition-all ${
                      studio.status ? "bg-white" : "bg-[#EE0004]"
                    }`} />
                  </button>
                </div>

                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{studio.activity_time}</div>

                <div className="flex items-center gap-1.5 lg:gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(studio)}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#742551] flex items-center justify-center hover:bg-[#742551]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-4 w-4 lg:h-5 lg:w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(studio.id)}
                    disabled={deleteStudio.isPending}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#EE0004] flex items-center justify-center hover:bg-[#EE0004]/80 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddStudioDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditStudioDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} studio={selectedStudio} />
    </AppLayout>
  );
}
