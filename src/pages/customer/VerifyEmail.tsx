import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Loader2 } from "lucide-react";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    
    if (!email) {
      toast.error('נא להזין כתובת מייל');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('recover-customer-number', {
        body: { type: 'email', value: email }
      });

      if (fnError || data?.error) {
        setError(true);
        setIsLoading(false);
        return;
      }

      navigate('/customer/verify-success', { 
        state: { customerNumber: data.customerNumber } 
      });
    } catch (err) {
      console.error('Verify error:', err);
      setError(true);
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex overflow-auto"
      style={{ backgroundImage: `url(${studioBackground})` }}
    >
      {/* Logo */}
      <div className="absolute top-0 right-4 lg:right-6">
        <div className="bg-white rounded-b-[16px] lg:rounded-b-[20px] p-3 lg:p-4">
          <img src={freeSolLogo} alt="FreeSol Logo" className="h-14 lg:h-16 xl:h-20" />
        </div>
      </div>

      {/* Card */}
      <div className="flex items-center justify-center lg:justify-end p-6 lg:p-12 w-full min-h-screen">
        <div 
          className="w-full max-w-[420px] lg:max-w-[550px] rounded-[20px] lg:rounded-[30px] p-6 lg:p-10"
          style={{
            background: 'rgba(116, 37, 81, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 191, 102, 0.3)'
          }}
        >
          <h1 
            className="text-[24px] lg:text-[30px] xl:text-[35px] font-bold text-[#FFBF66] text-center mb-1.5 lg:mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            אימות כתובת מייל
          </h1>
          <p 
            className="text-[14px] lg:text-[16px] xl:text-[18px] text-white text-center mb-6 lg:mb-8"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            הזינו את כתובת המייל איתה נרשמתם<br />
            למערכת.
          </p>

          <form onSubmit={handleVerify} className="space-y-4 lg:space-y-6">
            {/* Email Input */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="el********@gmail.com"
                className="w-full h-[50px] lg:h-[55px] xl:h-[60px] px-4 lg:px-6 pr-12 lg:pr-16 rounded-[12px] lg:rounded-[15px] bg-white/10 border border-[#FFBF66]/50 text-[16px] lg:text-[18px] xl:text-[20px] text-white placeholder-white/50 outline-none text-center"
                style={{ fontFamily: 'Discovery_Fs' }}
                dir="ltr"
                required
              />
              <Mail className="absolute right-4 lg:right-5 top-1/2 -translate-y-1/2 h-5 w-5 lg:h-6 lg:w-6 text-[#FFBF66]" />
            </div>

            {/* Verify Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-[50px] lg:h-[55px] xl:h-[60px] bg-[#FFBF66] rounded-[12px] lg:rounded-[15px] text-[#742551] text-[18px] lg:text-[22px] xl:text-[25px] font-bold hover:bg-[#FFBF66]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {isLoading && <Loader2 className="h-5 w-5 lg:h-6 lg:w-6 animate-spin" />}
              {isLoading ? 'מאמת...' : 'אימות כתובת המייל ←'}
            </button>

            {/* Error Message */}
            {error && (
              <p 
                className="text-[#FFBF66] text-[14px] lg:text-[16px] xl:text-[18px] text-center leading-relaxed"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                אופס! האימות לא עבר בהצלחה.<br />
                נסו שנית, או פנו למשרד לצורך שיחזור מספר<br />
                לקוח.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
