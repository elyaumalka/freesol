import { useNavigate, useLocation } from "react-router-dom";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";

export default function VerifySuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const customerNumber = location.state?.customerNumber || '450985474';

  const handleCopy = () => {
    navigator.clipboard.writeText(customerNumber);
    toast.success('מספר הלקוח הועתק!');
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex"
      style={{ backgroundImage: `url(${studioBackground})` }}
    >
      {/* Logo */}
      <div className="absolute top-0 right-6">
        <div className="bg-white rounded-b-[20px] p-4">
          <img src={freeSolLogo} alt="FreeSol Logo" className="h-20" />
        </div>
      </div>

      {/* Card */}
      <div className="flex items-center justify-end p-12 w-full">
        <div 
          className="w-[550px] rounded-[30px] p-10"
          style={{
            background: 'rgba(116, 37, 81, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 191, 102, 0.3)'
          }}
        >
          <h1 className="text-[40px] font-bold text-[#FFBF66] text-center mb-2">האימות עבר בהצלחה!</h1>
          <p className="text-[20px] text-white text-center mb-8">מספר הלקוח שלך הוא:</p>

          {/* Customer Number Display */}
          <div className="flex items-center justify-between h-[60px] px-6 rounded-[15px] bg-white/10 border border-[#FFBF66]/50 mb-6">
            <button
              onClick={handleCopy}
              className="text-[18px] text-[#FFBF66] hover:underline flex items-center gap-2"
            >
              העתקה
              <Copy className="h-5 w-5" />
            </button>
            <span className="text-[24px] text-white font-bold">{customerNumber}</span>
          </div>

          {/* Back Button */}
          <button 
            onClick={() => navigate('/customer/existing-login')}
            className="w-full h-[60px] bg-[#FFBF66] rounded-[15px] text-[#742551] text-[25px] font-bold hover:bg-[#FFBF66]/90 transition-colors"
          >
            חזרה למסך הכניסה ←
          </button>
        </div>
      </div>
    </div>
  );
}
