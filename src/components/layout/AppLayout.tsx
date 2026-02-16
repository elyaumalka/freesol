import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/freesol-logo.png";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        {/* Fixed Top Header */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 lg:h-16 bg-[#F8F8F8] border-b border-border flex items-center justify-between px-4 lg:px-6" dir="ltr">
          {/* Logout button - left side */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 lg:px-4 py-2 rounded-full border border-primary text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="font-medium text-xs lg:text-sm">התנתקות מהמערכת</span>
            <ArrowLeft className="h-3 w-3 lg:h-4 lg:w-4" />
          </button>

          {/* Mobile menu trigger */}
          <SidebarTrigger className="lg:hidden p-2 hover:bg-muted rounded-lg">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>

          {/* Logo - right side */}
          <img src={logo} alt="FreeSol" className="h-10 lg:h-12 w-auto" />
        </header>
        
        {/* Spacer for fixed header */}
        <div className="h-14 lg:h-16" />

        {/* Main content with sidebar */}
        <div className="flex-1 flex w-full">
          <AppSidebar />
          
          {/* Main content - responsive margin for sidebar */}
          <main className="flex-1 py-4 lg:py-6 pr-4 lg:pr-6 pl-0 mr-[220px] lg:mr-[250px] xl:mr-[280px]">
            {/* Max-width container for large screens */}
            <div className="max-w-[1600px] 3xl:max-w-[1800px] 4xl:max-w-[2000px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
