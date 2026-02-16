import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail } from "lucide-react";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";

export default function ForgotCustomerNumber() {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState<'phone' | 'email' | null>(null);

  const handleContinue = () => {
    if (selectedMethod === 'phone') {
      navigate('/customer/verify-phone');
    } else if (selectedMethod === 'email') {
      navigate('/customer/verify-email');
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
            className="text-[28px] lg:text-[34px] xl:text-[40px] font-bold text-[#FFBF66] text-center mb-3 lg:mb-4"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            לא נורא!
          </h1>
          <p 
            className="text-[16px] lg:text-[18px] xl:text-[20px] text-white text-center mb-6 lg:mb-8 leading-relaxed"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            לצורך שיחזור מספר הלקוח<br />
            בחרו את אפשרות האימות המועדפת<br />
            עליכם.
          </p>

          <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6">
            {/* Phone Option */}
            <button
              onClick={() => setSelectedMethod('phone')}
              className={`w-full h-[55px] lg:h-[62px] xl:h-[70px] rounded-[12px] lg:rounded-[15px] flex items-center justify-center gap-3 lg:gap-4 transition-all ${
                selectedMethod === 'phone'
                  ? 'bg-[#FFBF66]/20 border-2 border-[#FFBF66]'
                  : 'bg-white/10 border border-[#FFBF66]/50 hover:bg-white/20'
              }`}
            >
              <span 
                className="text-[16px] lg:text-[18px] xl:text-[22px] text-white"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                אימות לפי מספר טלפון
              </span>
              <Phone className="h-5 w-5 lg:h-6 lg:w-6 text-[#FFBF66]" />
            </button>

            {/* Email Option */}
            <button
              onClick={() => setSelectedMethod('email')}
              className={`w-full h-[55px] lg:h-[62px] xl:h-[70px] rounded-[12px] lg:rounded-[15px] flex items-center justify-center gap-3 lg:gap-4 transition-all ${
                selectedMethod === 'email'
                  ? 'bg-[#FFBF66]/20 border-2 border-[#FFBF66]'
                  : 'bg-white/10 border border-[#FFBF66]/50 hover:bg-white/20'
              }`}
            >
              <span 
                className="text-[16px] lg:text-[18px] xl:text-[22px] text-white"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                אימות לפי כתובת מייל
              </span>
              <Mail className="h-5 w-5 lg:h-6 lg:w-6 text-[#FFBF66]" />
            </button>
          </div>

          {/* Continue Button */}
          <button 
            onClick={handleContinue}
            disabled={!selectedMethod}
            className={`w-full h-[50px] lg:h-[55px] xl:h-[60px] rounded-[12px] lg:rounded-[15px] text-[18px] lg:text-[22px] xl:text-[25px] font-bold transition-colors ${
              selectedMethod
                ? 'bg-[#FFBF66] text-[#742551] hover:bg-[#FFBF66]/90'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            להמשך לחצו כאן ←
          </button>
        </div>
      </div>
    </div>
  );
}
