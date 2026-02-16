import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Trash2, Loader2 } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddPriceDialog } from "@/components/prices/AddPriceDialog";
import { EditPriceDialog } from "@/components/prices/EditPriceDialog";
import { usePackages, useDeletePackage } from "@/hooks/usePackages";
import { Package } from "@/types/database";
import { ExportButton } from "@/components/admin/ExportButton";

export default function Prices() {
  const { data: packages, isLoading } = usePackages();
  const deletePackage = useDeletePackage();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  const handleEdit = (pkg: Package) => {
    setSelectedPackage(pkg);
    setEditDialogOpen(true);
  };

  const handleDelete = (packageId: string) => {
    if (confirm('האם למחוק את החבילה?')) {
      deletePackage.mutate(packageId);
    }
  };

  const exportColumns = [
    { key: 'name' as const, label: 'שם החבילה' },
    { key: 'price' as const, label: 'מחיר' },
    { key: 'recording_hours' as const, label: 'שעות הקלטה' },
    { key: 'is_recommended' as const, label: 'מומלץ' },
    { key: 'created_at' as const, label: 'תאריך יצירה' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[25px] font-normal text-[#742551]">חבילות ומחירים</h1>

          <div className="flex items-center gap-4">
            <ExportButton 
              data={packages as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="packages"
              title="חבילות ומחירים"
            />
            
            <button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#FFBF66] rounded-full hover:bg-[#FFBF66]/80 transition-colors"
            >
              <span className="text-[18px] font-normal text-white">הוספת חבילה</span>
              <img src={PlusIcon} alt="Add" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[30px] overflow-hidden">
          <div className="grid grid-cols-5 py-4 px-6 border-b border-[#742551]/20">
            <div className="text-[20px] font-normal text-[#742551] text-center">שם החבילה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">עלות</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">שעות הקלטה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">הגדרות תצוגה</div>
            <div className="text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : packages?.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              אין חבילות עדיין
            </div>
          ) : (
            packages?.map((pkg) => (
              <div 
                key={pkg.id} 
                className="grid grid-cols-5 items-center py-4 px-6 bg-[#F7F7F7] mx-4 my-2 rounded-[30px]"
              >
                <div className="text-[18px] font-normal text-[#742551] text-center">
                  {pkg.name}
                  {pkg.is_recommended && (
                    <span className="mr-2 px-2 py-1 bg-[#FFBF66] text-white text-[12px] rounded-full">
                      מומלץ
                    </span>
                  )}
                </div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{pkg.price} ₪</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">{pkg.recording_hours}</div>
                <div className="text-[18px] font-normal text-[#742551] text-center">
                  {pkg.display_settings?.join(", ") || '-'}
                </div>

                <div className="flex items-center gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(pkg)}
                    className="w-10 h-10 rounded-full bg-[#742551] flex items-center justify-center hover:bg-[#742551]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(pkg.id)}
                    disabled={deletePackage.isPending}
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

      <AddPriceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditPriceDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} package_={selectedPackage} />
    </AppLayout>
  );
}
