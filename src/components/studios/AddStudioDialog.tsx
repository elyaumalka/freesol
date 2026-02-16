import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useCreateStudio } from "@/hooks/useStudios";

interface AddStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStudioDialog({ open, onOpenChange }: AddStudioDialogProps) {
  const createStudio = useCreateStudio();
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const generateUniqueId = () => `ST-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const handleSubmit = () => {
    if (formData.password !== formData.confirmPassword) {
      alert('הסיסמאות לא תואמות');
      return;
    }
    createStudio.mutate({
      name: formData.name,
      unique_id: generateUniqueId(),
      password: formData.password,
      status: true,
      activity_time: "00:00:00",
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({ name: "", password: "", confirmPassword: "" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">הוספת אולפן חדש</h2>
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
            disabled={createStudio.isPending}
            className="flex items-center gap-2 px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50"
          >
            <ArrowRight className="h-5 w-5" />
            <span>{createStudio.isPending ? 'שומר...' : 'הוספת אולפן חדש'}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
