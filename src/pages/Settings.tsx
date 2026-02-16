import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Upload, Loader2, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAlertSettings } from "@/hooks/useAlertSettings";
import { useWelcomePopupImage, useUpdateWelcomePopup } from "@/hooks/useSystemSettings";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: alertSettings, isLoading: isLoadingAlerts } = useAlertSettings();
  const { data: currentWelcomeImage, isLoading: isLoadingWelcome } = useWelcomePopupImage();
  const updateWelcomePopup = useUpdateWelcomePopup();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstAlert, setFirstAlert] = useState(15);
  const [secondAlert, setSecondAlert] = useState(5);
  const [welcomeImage, setWelcomeImage] = useState<File | null>(null);
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
  const [isSavingWelcome, setIsSavingWelcome] = useState(false);

  // Load alert settings from database
  useEffect(() => {
    if (alertSettings) {
      setFirstAlert(alertSettings.first_alert_minutes);
      setSecondAlert(alertSettings.second_alert_minutes);
    }
  }, [alertSettings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWelcomeImage(e.target.files[0]);
    }
  };

  const handleSaveAlerts = async () => {
    setIsSavingAlerts(true);
    try {
      const { error } = await supabase
        .from('alert_settings')
        .update({
          first_alert_minutes: firstAlert,
          second_alert_minutes: secondAlert
        })
        .eq('id', alertSettings?.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['alert-settings'] });
      toast.success('הגדרות ההתראות נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving alert settings:', error);
      toast.error('שגיאה בשמירת הגדרות ההתראות');
    } finally {
      setIsSavingAlerts(false);
    }
  };

  const handleSaveWelcomePopup = async () => {
    if (!welcomeImage) {
      toast.error('יש לבחור תמונה להעלאה');
      return;
    }

    setIsSavingWelcome(true);
    try {
      // Upload image to storage
      const fileName = `welcome-popup-${Date.now()}.${welcomeImage.name.split('.').pop()}`;
      const filePath = `welcome/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('system-assets')
        .upload(filePath, welcomeImage, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('system-assets')
        .getPublicUrl(filePath);

      // Update database with new URL
      await updateWelcomePopup.mutateAsync(urlData.publicUrl);

      setWelcomeImage(null);
      toast.success('תמונת הפופאפ נשמרה בהצלחה');
    } catch (error) {
      console.error('Error saving welcome popup:', error);
      toast.error('שגיאה בשמירת תמונת הפופאפ');
    } finally {
      setIsSavingWelcome(false);
    }
  };

  const handleDeleteWelcomePopup = async () => {
    if (!confirm('האם למחוק את תמונת הפופאפ?')) return;

    setIsSavingWelcome(true);
    try {
      // Delete old image from storage if exists
      if (currentWelcomeImage) {
        const urlParts = currentWelcomeImage.split('/welcome/');
        if (urlParts[1]) {
          await supabase.storage.from('system-assets').remove([`welcome/${urlParts[1]}`]);
        }
      }
      
      await updateWelcomePopup.mutateAsync(null);
      toast.success('תמונת הפופאפ נמחקה');
    } catch (error) {
      console.error('Error deleting welcome popup:', error);
      toast.error('שגיאה במחיקת הפופאפ');
    } finally {
      setIsSavingWelcome(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-6">
        <div className="bg-white rounded-[30px] p-8">
          {/* Title */}
          <h1 className="text-[25px] font-normal text-[#742551] text-right mb-2">הגדרות מערכת</h1>
          
          {/* Divider */}
          <div className="w-full h-px bg-[#742551]/20 mb-8" />

          {/* Personal Details Section */}
          <div className="mb-8">
            <h2 className="text-[25px] font-normal text-[#742551] text-right mb-6">פרטים אישיים</h2>
            
            <div className="grid grid-cols-3 gap-6 mb-6" dir="rtl">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-[25px] text-[#742551] font-normal block text-right">כתובת מייל</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[60px] px-4 rounded-[30px] border border-[#742551] text-[16px] text-[#742551] outline-none text-right"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[25px] text-[#742551] font-normal block text-right">סיסמא</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[60px] px-4 rounded-[30px] border border-[#742551] text-[16px] text-[#742551] outline-none text-right"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-[25px] text-[#742551] font-normal block text-right">חזרו על הסיסמא שנית</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-[60px] px-4 rounded-[30px] border border-[#742551] text-[16px] text-[#742551] outline-none text-right"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button className="h-[60px] px-10 bg-[#FFBF66] rounded-[30px] text-[#742551] text-[25px] font-normal hover:bg-[#FFBF66]/90 transition-colors border border-[#FFC97F]">
                שמירת שינויים ←
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-[#742551]/20 mb-8" />

          {/* Alerts Section */}
          <div className="mb-8">
            <h2 className="text-[25px] font-normal text-[#742551] text-right mb-2">התראות למשתמשים</h2>
            <p className="text-[25px] text-[#742551] font-extralight text-right mb-8">
              לחץ על המקשי הפלוס והמינוס כדי לקבוע מתי תקפוץ התראה למשתמש כשהולך להסתיים לו הזמן.
            </p>

            <div className="space-y-6">
              {/* First Alert */}
              <div className="flex items-center justify-start gap-8" dir="rtl">
                <h3 className="text-[30px] text-[#742551] font-bold">התראה ראשונה</h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setFirstAlert(prev => prev + 1)}
                    className="w-[60px] h-[60px] rounded-[30px] bg-[#FFBF66] flex items-center justify-center text-black text-[50px] font-bold hover:bg-[#FFBF66]/80 transition-colors leading-none"
                  >
                    +
                  </button>
                  <input
                    type="number"
                    value={firstAlert}
                    onChange={(e) => setFirstAlert(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-[134px] h-[60px] rounded-[30px] bg-[#F7F7F7] text-center text-[50px] text-[#742551] font-light outline-none border-none"
                  />
                  <button 
                    onClick={() => setFirstAlert(prev => Math.max(1, prev - 1))}
                    className="w-[60px] h-[60px] rounded-[30px] bg-[#FFBF66] flex items-center justify-center text-black text-[50px] font-bold hover:bg-[#FFBF66]/80 transition-colors leading-none"
                  >
                    -
                  </button>
                </div>
              </div>

              {/* Second Alert */}
              <div className="flex items-center justify-start gap-8" dir="rtl">
                <h3 className="text-[30px] text-[#742551] font-bold">התראה שנייה</h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSecondAlert(prev => prev + 1)}
                    className="w-[60px] h-[60px] rounded-[30px] bg-[#FFBF66] flex items-center justify-center text-black text-[50px] font-bold hover:bg-[#FFBF66]/80 transition-colors leading-none"
                  >
                    +
                  </button>
                  <input
                    type="number"
                    value={secondAlert}
                    onChange={(e) => setSecondAlert(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-[134px] h-[60px] rounded-[30px] bg-[#F7F7F7] text-center text-[50px] text-[#742551] font-light outline-none border-none"
                  />
                  <button 
                    onClick={() => setSecondAlert(prev => Math.max(1, prev - 1))}
                    className="w-[60px] h-[60px] rounded-[30px] bg-[#FFBF66] flex items-center justify-center text-black text-[50px] font-bold hover:bg-[#FFBF66]/80 transition-colors leading-none"
                  >
                    -
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button 
                onClick={handleSaveAlerts}
                disabled={isSavingAlerts || isLoadingAlerts}
                className="h-[60px] px-10 bg-[#FFBF66] rounded-[30px] text-[#742551] text-[25px] font-normal hover:bg-[#FFBF66]/90 transition-colors border border-[#FFC97F] disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingAlerts && <Loader2 className="h-5 w-5 animate-spin" />}
                שמירת שינויים ←
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-[#742551]/20 mb-8" />

          {/* Welcome Popup Section */}
          <div>
            <h2 className="text-[25px] font-normal text-[#742551] text-right mb-2">פופאפ ברוכים הבאים!</h2>
            <p className="text-[25px] text-[#742551] font-extralight text-right mb-6">
              העלו תמונה ברוחב 1128PX ובגובה 765PX
            </p>

            {/* Current Image Preview */}
            {isLoadingWelcome ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
              </div>
            ) : currentWelcomeImage ? (
              <div className="mb-6 flex items-start gap-4" dir="rtl">
                <div className="relative">
                  <img 
                    src={currentWelcomeImage} 
                    alt="תמונת פופאפ נוכחית" 
                    className="max-w-[400px] h-auto rounded-[15px] border border-[#742551]/20"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    פעיל
                  </div>
                </div>
                <button
                  onClick={handleDeleteWelcomePopup}
                  disabled={isSavingWelcome}
                  className="p-3 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-6 h-6 text-red-600" />
                </button>
              </div>
            ) : (
              <p className="text-[18px] text-[#742551]/60 mb-6 text-right">אין תמונת פופאפ מוגדרת כרגע</p>
            )}

            <div className="flex items-center gap-4 justify-end" dir="rtl">
              <button 
                onClick={handleSaveWelcomePopup}
                disabled={isSavingWelcome || !welcomeImage}
                className="h-[60px] px-10 bg-[#FFBF66] rounded-[30px] text-[#742551] text-[25px] font-normal hover:bg-[#FFBF66]/90 transition-colors border border-[#FFC97F] disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingWelcome && <Loader2 className="h-5 w-5 animate-spin" />}
                שמירת שינויים ←
              </button>

              <label className="h-[60px] px-6 rounded-[30px] bg-[#F7F7F7] flex items-center gap-3 cursor-pointer hover:bg-[#F7F7F7]/80 transition-colors">
                <span className="text-[25px] text-[#742551] font-extralight">בחירת קובץ</span>
                <Upload className="h-[30px] w-[30px] text-[#742551]" />
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {welcomeImage && (
                <span className="text-[20px] text-[#742551]">{welcomeImage.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
