import { ReactNode, useEffect } from "react";
import freeSolLogo from "@/assets/freesol-logo.png";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { HoursBalance } from "./HoursBalance";
import { ExplanationVideo } from "./ExplanationVideo";
import { HoursAlertDialog } from "./HoursAlertDialog";
import { NoHoursDialog } from "./NoHoursDialog";
import { WelcomePopupDialog } from "./WelcomePopupDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerHours } from "@/hooks/useCustomerData";
import { useHoursTimer } from "@/hooks/useHoursTimer";
import { Loader2 } from "lucide-react";

const menuItems = [
  { title: "שולחן עבודה", url: "/customer/dashboard" },
  { title: "פרוייקט חדש", url: "/customer/new-project", highlight: true },
  { title: "פרוייקטים פתוחים", url: "/customer/open-projects" },
  { title: "היסטוריית רכישות", url: "/customer/purchase-history" },
  { title: "היסטוריית הקלטות", url: "/customer/recording-history" },
  { title: "פרטים אישיים", url: "/customer/personal-details" },
];

interface CustomerLayoutProps {
  children: ReactNode;
}

export function CustomerLayout({ children }: CustomerLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { data: hours, isLoading: hoursLoading } = useCustomerHours();
  
  // Start the hours timer - deducts 1 minute every minute while connected
  const { alertState, dismissAlert } = useHoursTimer();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/customer/login");
    }
  }, [user, authLoading, navigate]);

  // Redirect to dashboard if out of hours and not on packages page
  useEffect(() => {
    const allowedPaths = ['/customer/dashboard', '/customer/packages', '/customer/purchase-history', '/customer/personal-details'];
    const isAllowed = allowedPaths.some(path => location.pathname.startsWith(path));
    
    if (alertState.outOfHours && !isAllowed) {
      navigate('/customer/dashboard');
    }
  }, [alertState.outOfHours, location.pathname, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/customer/login");
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
        <Loader2 style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="animate-spin text-[#742551]" />
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  // Calculate hours and minutes from total hours
  const totalHours = hours?.total_hours ?? 0;
  const usedHours = hours?.used_hours ?? 0;
  const remainingHours = Math.max(0, totalHours - usedHours);
  const displayHours = Math.floor(remainingHours);
  const displayMinutes = Math.round((remainingHours - displayHours) * 60);

  return (
    <div className="h-screen w-full bg-[#F4F4F4] flex overflow-hidden">
      {/* Main Content Area - LEFT side of screen */}
      <div 
        className="flex-1 flex flex-col overflow-hidden bg-white"
        style={{
          margin: 'var(--space-md)',
          marginRight: 'clamp(150px, 12vw, 250px)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderBottomLeftRadius: 'var(--radius-xl)',
        }}
      >
        {/* Header - Hours balance on RIGHT - Fixed */}
        <div className="flex justify-end shrink-0" style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
          <div className="flex flex-col items-end" style={{ gap: 'var(--space-sm)' }}>
            {hoursLoading ? (
              <div className="flex items-center" style={{ height: 'clamp(50px, 4vh, 70px)' }}>
                <Loader2 style={{ width: 'var(--icon-md)', height: 'var(--icon-md)' }} className="animate-spin text-[#742551]" />
              </div>
            ) : (
              <HoursBalance 
                hours={displayHours} 
                minutes={displayMinutes}
                onAddHours={() => navigate('/customer/packages')}
              />
            )}
            <ExplanationVideo />
          </div>
        </div>
        
        {/* Page Content - Scrollable with max-width for large screens */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ maxWidth: 'clamp(1200px, 85vw, 2200px)', margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </div>
      </div>

      {/* Sidebar - RIGHT side of screen, FIXED - Responsive width */}
      <div 
        className="fixed flex flex-col bg-white"
        style={{
          width: 'clamp(140px, 11vw, 230px)',
          right: 'var(--space-md)',
          top: 'var(--space-md)',
          bottom: 'var(--space-md)',
          borderTopRightRadius: 'var(--radius-xl)',
          borderBottomRightRadius: 'var(--radius-xl)',
        }}
      >
        {/* Logo at top */}
        <div className="flex justify-center border-b border-black/10" style={{ padding: 'var(--space-md)' }}>
          <img 
            src={freeSolLogo} 
            alt="FreeSol Logo" 
            style={{ height: 'clamp(60px, 6vw, 110px)' }}
          />
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto" style={{ paddingTop: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.url;
              const isHighlight = 'highlight' in item && item.highlight;
              return (
                <NavLink 
                  key={item.title}
                  to={item.url} 
                  className={`flex items-center justify-start transition-all ${
                    isActive 
                      ? "bg-[#742551] text-white" 
                      : isHighlight
                        ? "text-white"
                        : "bg-white text-[#742551] hover:bg-[#742551]/10"
                  }`}
                  style={{
                    padding: `0 var(--space-md)`,
                    height: 'clamp(36px, 4vh, 60px)',
                    marginRight: 'var(--space-xs)',
                    borderTopLeftRadius: 'var(--radius-lg)',
                    borderBottomLeftRadius: 'var(--radius-lg)',
                    ...(isHighlight && !isActive ? {
                      background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
                    } : {}),
                  }}
                >
                  <span style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                    {item.title}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full transition-all text-[#742551] hover:bg-[#742551]/10"
            style={{
              padding: `0 var(--space-md)`,
              height: 'clamp(44px, 5vh, 75px)',
              background: '#F7F7F7',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
              fontFamily: 'Discovery_Fs',
              fontSize: 'var(--text-sm)',
            }}
          >
          <span>יציאה מהמערכת ←</span>
          </button>
        </div>
      </div>

      {/* Hours Alert Dialog */}
      <HoursAlertDialog
        open={alertState.showFirstAlert || alertState.showSecondAlert}
        onOpenChange={(open) => !open && dismissAlert()}
        remainingMinutes={alertState.remainingMinutes}
        isUrgent={alertState.showSecondAlert}
      />

      {/* No Hours Dialog - Blocks user when out of hours */}
      <NoHoursDialog open={alertState.outOfHours} />

      {/* Welcome Popup Dialog - Shows once per session */}
      <WelcomePopupDialog />
    </div>
  );
}