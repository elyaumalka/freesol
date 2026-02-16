import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Prices from "./pages/Prices";
import Studios from "./pages/Studios";
import Playbacks from "./pages/Playbacks";
import Clubs from "./pages/Clubs";
import Coupons from "./pages/Coupons";
import Campaigns from "./pages/Campaigns";
import Inquiries from "./pages/Inquiries";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import CampaignRedirect from "./pages/CampaignRedirect";

// Customer pages
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerRegister from "./pages/customer/CustomerRegister";
import CustomerPackages from "./pages/customer/CustomerPackages";
import CustomerTerms from "./pages/customer/CustomerTerms";
import ExistingUserLogin from "./pages/customer/ExistingUserLogin";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import ForgotCustomerNumber from "./pages/customer/ForgotCustomerNumber";
import VerifyPhone from "./pages/customer/VerifyPhone";
import VerifyEmail from "./pages/customer/VerifyEmail";
import VerifySuccess from "./pages/customer/VerifySuccess";
import CustomerOpenProjects from "./pages/customer/CustomerOpenProjects";
import CustomerRecordingHistory from "./pages/customer/CustomerRecordingHistory";
import CustomerPurchaseHistory from "./pages/customer/CustomerPurchaseHistory";
import CustomerPersonalDetails from "./pages/customer/CustomerPersonalDetails";
import NewProject from "./pages/customer/NewProject";
import PaymentSuccess from "./pages/customer/PaymentSuccess";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/prices" element={<Prices />} />
            <Route path="/studios" element={<Studios />} />
            <Route path="/playbacks" element={<Playbacks />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/inquiries" element={<Inquiries />} />
            <Route path="/settings" element={<Settings />} />
            
            {/* Customer Routes */}
            <Route path="/customer" element={<CustomerLogin />} />
            <Route path="/customer/login" element={<CustomerLogin />} />
            <Route path="/customer/register" element={<CustomerRegister />} />
            <Route path="/customer/packages" element={<CustomerPackages />} />
            <Route path="/customer/terms" element={<CustomerTerms />} />
            <Route path="/customer/existing-login" element={<ExistingUserLogin />} />
            <Route path="/customer/forgot-number" element={<ForgotCustomerNumber />} />
            <Route path="/customer/verify-phone" element={<VerifyPhone />} />
            <Route path="/customer/verify-email" element={<VerifyEmail />} />
            <Route path="/customer/verify-success" element={<VerifySuccess />} />
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/open-projects" element={<CustomerOpenProjects />} />
            <Route path="/customer/recording-history" element={<CustomerRecordingHistory />} />
            <Route path="/customer/purchase-history" element={<CustomerPurchaseHistory />} />
            <Route path="/customer/personal-details" element={<CustomerPersonalDetails />} />
            <Route path="/customer/new-project" element={<NewProject />} />
            <Route path="/customer/payment-success" element={<PaymentSuccess />} />
            
            {/* Campaign Redirect */}
            <Route path="/c/:code" element={<CampaignRedirect />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
