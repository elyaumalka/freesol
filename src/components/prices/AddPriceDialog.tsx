import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ChevronDown } from "lucide-react";
import { useCreatePackage } from "@/hooks/usePackages";

interface AddPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const displayOptions = ["אתר תדמית", "אולפן", "קופון", "מועדון"];

export function AddPriceDialog({ open, onOpenChange }: AddPriceDialogProps) {
  const createPackage = useCreatePackage();
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    recording_hours: "",
    display_settings: [] as string[],
    is_recommended: false,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSubmit = () => {
    createPackage.mutate({
      name: formData.name,
      price: parseFloat(formData.price) || 0,
      recording_hours: parseFloat(formData.recording_hours) || 0,
      display_settings: formData.display_settings,
      is_recommended: formData.is_recommended,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({ name: "", price: "", recording_hours: "", display_settings: [], is_recommended: false });
      }
    });
  };

  const toggleDisplayOption = (option: string) => {
    setFormData(prev => ({
      ...prev,
      display_settings: prev.display_settings.includes(option)
        ? prev.display_settings.filter(o => o !== option)
        : [...prev.display_settings, option]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">הוספת חבילה חדשה</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">שם החבילה</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">עלות</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">שעות הקלטה</label>
              <input
                type="number"
                value={formData.recording_hours}
                onChange={(e) => setFormData({ ...formData, recording_hours: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">
                הגדרות תצוגה <span className="font-normal text-[14px]">( ניתן לבחור כמה אופציות )</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none flex items-center justify-between"
                >
                  <ChevronDown className="h-5 w-5 text-[#FFBF66]" />
                  <span>{formData.display_settings.length > 0 ? formData.display_settings.join(", ") : "בחר אפשרויות"}</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] shadow-lg border border-[#742551]/20 z-50">
                    {displayOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleDisplayOption(option)}
                        className={`w-full px-6 py-3 text-[16px] text-[#742551] text-right hover:bg-[#F7F7F7] first:rounded-t-[20px] last:rounded-b-[20px] flex items-center justify-between ${
                          formData.display_settings.includes(option) ? "bg-[#FFBF66]/20" : ""
                        }`}
                      >
                        <span>{formData.display_settings.includes(option) ? "✓" : ""}</span>
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <label className="text-[18px] font-bold text-[#742551]">חבילה מומלצת</label>
            <input
              type="checkbox"
              checked={formData.is_recommended}
              onChange={(e) => setFormData({ ...formData, is_recommended: e.target.checked })}
              className="w-5 h-5"
            />
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={createPackage.isPending}
            className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50"
          >
            {createPackage.isPending ? 'שומר...' : 'הוספת חבילה +'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
