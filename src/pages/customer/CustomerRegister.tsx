import { useState } from "react";
import { useNavigate } from "react-router-dom";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function CustomerRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !phone) {
      toast.error('נא למלא שם ומספר טלפון');
      return;
    }

    // Validate phone number (Israeli format)
    const phoneRegex = /^0[5][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      toast.error('נא להזין מספר טלפון תקין');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('register-customer', {
        body: { name, phone, email: email || undefined }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'שגיאה בהרשמה');
        setIsLoading(false);
        return;
      }

      // Store customer number temporarily for the terms page
      sessionStorage.setItem('pendingCustomerNumber', data.customerNumber);
      sessionStorage.setItem('pendingUserId', data.userId);
      
      // Auto-login using the email OTP
      if (data.emailOtp && data.email) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: data.email,
          token: data.emailOtp,
          type: 'email'
        });
        
        if (verifyError) {
          console.error('Auto-login error:', verifyError);
          // Even if auto-login fails, continue to terms - user can login later
        } else {
          console.log('Auto-login successful!');
          // Mark as new registration to show customer number after first purchase
          sessionStorage.setItem('is_new_registration', 'true');
        }
      }
      
      toast.success('נרשמת בהצלחה!');
      navigate('/customer/terms');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('שגיאה בהרשמה');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex overflow-auto"
      style={{ backgroundImage: `url(${studioBackground})` }}
    >
      {/* Logo */}
      <div className="absolute top-0" style={{ right: 'var(--space-lg)' }}>
        <div 
          className="bg-white p-[var(--space-md)]"
          style={{ borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}
        >
          <img 
            src={freeSolLogo} 
            alt="FreeSol Logo" 
            style={{ height: 'clamp(56px, 5vw, 100px)' }}
          />
        </div>
      </div>

      {/* Registration Card */}
      <div 
        className="flex items-center justify-center lg:justify-end w-full min-h-screen"
        style={{ padding: 'var(--space-xl)' }}
      >
        <div 
          className="w-full"
          style={{
            maxWidth: 'clamp(350px, 28vw, 550px)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-xl)',
            background: 'rgba(116, 37, 81, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 191, 102, 0.3)'
          }}
        >
          <h1 
            className="font-bold text-[#FFBF66] text-center"
            style={{ 
              fontFamily: 'Discovery_Fs',
              fontSize: 'var(--text-3xl)',
              marginBottom: 'var(--space-md)'
            }}
          >
            ברוכים הבאים 🙂
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {/* Name Field */}
            <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label 
                className="text-[#FFBF66] block text-center"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
              >
                נעים להכיר מה שמך?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/90 text-[#742551] outline-none text-right rounded-full"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  height: 'var(--btn-md)',
                  padding: '0 var(--space-md)',
                  fontSize: 'var(--text-base)'
                }}
                required
              />
            </div>

            {/* Phone Field */}
            <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label 
                className="text-[#FFBF66] block text-center"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
              >
                מספר טלפון ליצירת קשר
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white/90 text-[#742551] outline-none text-center rounded-full"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  height: 'var(--btn-md)',
                  padding: '0 var(--space-md)',
                  fontSize: 'var(--text-base)'
                }}
                dir="ltr"
                placeholder="05XXXXXXXX"
                required
              />
            </div>

            {/* Email Field */}
            <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label 
                className="text-[#FFBF66] block text-center"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
              >
                כתובת מייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/90 text-[#742551] outline-none text-center rounded-full"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  height: 'var(--btn-md)',
                  padding: '0 var(--space-md)',
                  fontSize: 'var(--text-base)'
                }}
                dir="ltr"
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFBF66] text-[#742551] font-bold hover:bg-[#FFBF66]/90 transition-colors disabled:opacity-50 flex items-center justify-center"
              style={{ 
                fontFamily: 'Discovery_Fs',
                height: 'var(--btn-md)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-lg)',
                gap: 'var(--space-sm)'
              }}
            >
              {isLoading && <Loader2 style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="animate-spin" />}
              {isLoading ? 'נרשם...' : 'המשך ההרשמה ←'}
            </button>

            {/* Login Link */}
            <button
              type="button"
              onClick={() => navigate('/customer/existing-login')}
              className="w-full text-center text-[#FFBF66] hover:underline"
              style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
            >
              כבר רשום? התחבר עכשיו
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}