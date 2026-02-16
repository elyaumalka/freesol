import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Eye, EyeOff } from "lucide-react";
import { Studio } from "@/types/database";
import { useUpdateStudio } from "@/hooks/useStudios";

interface EditStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: Studio | null;
}

export function EditStudioDialog({ open, onOpenChange, studio }: EditStudioDialogProps) {
  const updateStudio = useUpdateStudio();
  const [formData, setFormData] = useState({
    name: "",
    unique_id: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (studio) {
      setFormData({
        name: studio.name,
        unique_id: studio.unique_id,
        password: studio.password,
        confirmPassword: studio.password,
      });
    }
  }, [studio]);

  const handleSubmit = () => {
    if (!studio) return;
    if (formData.password !== formData.confirmPassword) {
      alert('הסיסמאות לא תואמות');
      return;
    }
    updateStudio.mutate({
      id: studio.id,
      name: formData.name,
      password: formData.password,
    }, {
      onSuccess: () => onOpenChange(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">עריכת פרטי אולפן</h2>
          <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">שם האולפן</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">
              מזהה ייחודי <span className="font-normal text-[14px]">( נוצר אוטומטי )</span>
            </label>
            <input
              type="text"
              value={formData.unique_id}
              readOnly
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">סיסמא</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#742551]/60 hover:text-[#742551]"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">חזרו על הסיסמא שנית</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#742551]/60 hover:text-[#742551]"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={updateStudio.isPending}
            className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50"
          >
            {updateStudio.isPending ? 'שומר...' : 'עדכון ושמירה +'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
