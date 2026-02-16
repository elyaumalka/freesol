import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HoursBalance } from "../HoursBalance";
import { HoursAlertDialog } from "../HoursAlertDialog";
import { NoHoursDialog } from "../NoHoursDialog";
import { Play } from "lucide-react";
import aiVoiceGold from "@/assets/icons/ai-voice-gold.svg";
import { useCustomerHours } from "@/hooks/useCustomerData";
import { useHoursTimer } from "@/hooks/useHoursTimer";
import { clearAutoSavedProject } from "@/lib/projectUtils";

interface NewProjectLayoutProps {
  children: ReactNode;
  title?: string;
}

export function NewProjectLayout({
  children,
  title
}: NewProjectLayoutProps) {
  const navigate = useNavigate();
  const { data: hours } = useCustomerHours();

  // Start the hours timer - deducts 1 minute every minute while in project
  // Also get alert state for showing popups
  const { alertState, dismissAlert } = useHoursTimer();
  
  // Redirect to dashboard if out of hours
  useEffect(() => {
    if (alertState.outOfHours) {
      // Clear session and redirect
      sessionStorage.removeItem('freesol_project_session');
      clearAutoSavedProject();
      navigate('/customer/dashboard');
    }
  }, [alertState.outOfHours, navigate]);
  
  const handleExit = () => {
    // Clear session flag so next "new project" starts fresh
    sessionStorage.removeItem('freesol_project_session');
    // Clear auto-saved project data from localStorage
    clearAutoSavedProject();
    navigate('/customer/dashboard');
  };

  // Calculate remaining hours and minutes
  const remainingHours = hours ? hours.total_hours - hours.used_hours : 0;
  const displayHours = Math.floor(remainingHours);
  const displayMinutes = Math.round((remainingHours - displayHours) * 60);

  return (
    <div 
      className="h-screen w-full overflow-hidden" 
      style={{ background: '#F4F4F4', padding: 'var(--space-md)' }}
    >
      {/* Main Frame - Contains EVERYTHING */}
      <div 
        className="h-full w-full flex flex-col overflow-hidden relative"
        style={{
          background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {/* Header - Inside the frame */}
        <div 
          className="shrink-0 flex items-center justify-between"
          style={{ padding: 'var(--space-lg)' }}
        >
          {/* Left side - Logo/Icon with optional title */}
          <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
            <img 
              src={aiVoiceGold} 
              alt="AI Voice" 
              style={{ width: 'var(--icon-xl)', height: 'var(--icon-xl)' }}
            />
            {title && (
              <h1 
                className="font-bold text-white"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-2xl)' }}
              >
                {title}
              </h1>
            )}
          </div>

          {/* Right side - Video & Hours balance */}
          <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
            {/* Explanation Video - White text */}
            <button className="hidden lg:flex items-center hover:opacity-80 transition-all" style={{ gap: 'var(--space-sm)' }}>
              <span 
                className="text-white"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-lg)' }}
              >
                סרטון הסברה
              </span>
              <div 
                className="rounded-full flex items-center justify-center"
                style={{ 
                  background: '#FFC97F',
                  width: 'var(--icon-lg)',
                  height: 'calc(var(--icon-lg) * 0.9)'
                }}
              >
                <Play style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="text-[#742551] fill-current" />
              </div>
            </button>
            
            {/* Hours Balance */}
            <HoursBalance hours={displayHours} minutes={displayMinutes} />
          </div>
        </div>

        {/* Content Area - with scroll, starts from top */}
        <div 
          className="flex-1 overflow-y-auto flex flex-col items-center"
          style={{ 
            padding: '0 var(--space-lg)',
            paddingBottom: 'clamp(60px, 8vh, 100px)',
            paddingTop: 'var(--space-lg)'
          }}
        >
          {children}
        </div>

        {/* Exit Button - Bottom Right inside frame */}
        <button 
          onClick={handleExit} 
          className="absolute bg-white text-[#215F66] rounded-full hover:bg-white/90 transition-all shadow-lg z-10"
          style={{ 
            fontFamily: 'Discovery_Fs',
            fontSize: 'var(--text-sm)',
            bottom: 'var(--space-lg)',
            right: 'var(--space-lg)',
            padding: 'var(--space-sm) var(--space-lg)'
          }}
        >
          יציאה מהפרוייקט ←
        </button>
      </div>

      {/* Hours Alert Dialog - Shows on all recording screens */}
      <HoursAlertDialog
        open={alertState.showFirstAlert || alertState.showSecondAlert}
        onOpenChange={(open) => !open && dismissAlert()}
        remainingMinutes={alertState.remainingMinutes}
        isUrgent={alertState.showSecondAlert}
      />

      {/* No Hours Dialog - Blocks user when out of hours */}
      <NoHoursDialog open={alertState.outOfHours} />
    </div>
  );
}