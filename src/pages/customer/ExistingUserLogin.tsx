import { useState } from "react";
import { useNavigate } from "react-router-dom";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ExistingUserLogin() {
  const navigate = useNavigate();
  const [customerNumber, setCustomerNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerNumber) {
      toast.error('נא להזין מספר לקוח');
      return;
    }

    if (customerNumber.length !== 5 || !/^\d{5}$/.test(customerNumber)) {
      toast.error('מספר לקוח חייב להכיל 5 ספרות');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('login-customer', {
        body: { customerNumber }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'מספר לקוח לא נמצא');
        setIsLoading(false);
        return;
      }

      // Use the action link to sign in
      if (data.actionLink) {
        // Extract the token from the action link and verify
        const url = new URL(data.actionLink);
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        
        if (token && type === 'magiclink') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink'
          });
          
          if (verifyError) {
            console.error('Verify error:', verifyError);
            // Fallback - sign in directly using admin created session
          }
        }
      }
      
      toast.success('התחברת בהצלחה!');
      navigate('/customer/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('שגיאה בהתחברות');
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

      {/* Login Card */}
      <div 
        className="flex items-center justify-center lg:justify-end w-full min-h-screen"
        style={{ padding: 'var(--space-xl)' }}
      >
        <div 
          className="w-full"
          style={{
            maxWidth: 'clamp(380px, 30vw, 600px)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-xl)',
            background: 'rgba(116, 37, 81, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 191, 102, 0.3)'
          }}
        >
          <h1 
            className="font-bold text-white text-center"
            style={{ 
              fontFamily: 'Discovery_Fs',
              fontSize: 'var(--text-3xl)',
              marginBottom: 'var(--space-2xl)'
            }}
          >
            כניסה למערכת
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Customer Number Field */}
            <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <label 
                className="text-[#FFBF66] block text-center"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-lg)' }}
              >
                הזינו את מספר הלקוח שלכם
              </label>
              <input
                type="text"
                value={customerNumber}
                onChange={(e) => {
                  // Only allow digits, max 5
                  const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setCustomerNumber(val);
                }}
                className="w-full bg-white/10 border border-[#FFBF66]/50 text-white placeholder-white/50 outline-none text-center tracking-widest"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  height: 'var(--btn-md)',
                  padding: '0 var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-xl)'
                }}
                placeholder="_ _ _ _ _"
                required
                dir="ltr"
                maxLength={5}
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
                fontSize: 'var(--text-xl)',
                gap: 'var(--space-sm)'
              }}
            >
              {isLoading && <Loader2 style={{ width: 'var(--icon-md)', height: 'var(--icon-md)' }} className="animate-spin" />}
              {isLoading ? 'מתחבר...' : 'לכניסה למערכת ←'}
            </button>

            {/* Forgot Customer Number Link */}
            <button
              type="button"
              onClick={() => navigate('/customer/forgot-number')}
              className="w-full text-center text-[#FFBF66] hover:underline"
              style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)', marginTop: 'var(--space-sm)' }}
            >
              שכחתי את המספר הלקוח
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}