import { useNavigate } from "react-router-dom";

interface HoursBalanceProps {
  hours: number;
  minutes: number;
  onAddHours?: () => void;
}

export function HoursBalance({
  hours,
  minutes,
  onAddHours
}: HoursBalanceProps) {
  const navigate = useNavigate();
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  const handleAddHours = () => {
    if (onAddHours) {
      onAddHours();
    } else {
      navigate('/customer/packages');
    }
  };

  return (
    <div 
      className="inline-flex items-center justify-center rounded-full"
      style={{ 
        background: '#FFBF66',
        gap: 'var(--space-sm)',
        padding: 'var(--space-xs) var(--space-sm)'
      }}
    >
      {/* LEFT - Label */}
      <span 
        className="text-[#215F66]"
        style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}
      >
        יתרת שעות
      </span>
      
      {/* MIDDLE - Time */}
      <span 
        className="font-bold text-[#215F66]"
        style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-xl)' }}
      >
        {formattedTime}
      </span>
      
      {/* RIGHT - Add hours button */}
      <button 
        onClick={handleAddHours} 
        className="bg-white text-[#215F66] rounded-full hover:bg-white/90 transition-all flex items-center justify-center"
        style={{ 
          fontFamily: 'Discovery_Fs',
          fontSize: 'var(--text-xs)',
          padding: 'var(--space-xs) var(--space-sm)'
        }}
      >
        <span className="text-center">הוספת שעות ←</span>
      </button>
    </div>
  );
}