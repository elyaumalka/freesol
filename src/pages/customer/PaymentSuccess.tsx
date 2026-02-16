import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, FileText, Loader2, Mail } from "lucide-react";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CustomerNumberDialog } from "@/components/customer/CustomerNumberDialog";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [hoursAdded, setHoursAdded] = useState<number | undefined>();
  const [showCustomerNumberDialog, setShowCustomerNumberDialog] = useState(false);
  const [customerNumber, setCustomerNumber] = useState<string>("");

  useEffect(() => {
    const completePurchase = async () => {
      const hoursParam = searchParams.get('hours');
      // Get document info from Sumit redirect - they use OG- prefix for their parameters
      const documentId = searchParams.get('DocumentID') || searchParams.get('documentid') || 
                         searchParams.get('OG-DocumentID') || null;
      const documentNumber = searchParams.get('OG-DocumentNumber') || searchParams.get('DocumentNumber') || null;
      const sumitCustomerId = searchParams.get('OG-CustomerID') || searchParams.get('CustomerID') || null;
      const pendingPurchaseId = sessionStorage.getItem('pending_purchase_id');

      console.log('Payment success params:', { documentId, documentNumber, sumitCustomerId, pendingPurchaseId });

      if (hoursParam) {
        setHoursAdded(parseFloat(hoursParam));
      }

      // Get user email and profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        
        // Check if this is a new user (first purchase) - show customer number dialog
        const isNewRegistration = sessionStorage.getItem('is_new_registration') === 'true';
        
        if (isNewRegistration) {
          // Fetch the customer number from profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('customer_number')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (profile?.customer_number) {
            setCustomerNumber(profile.customer_number);
            setShowCustomerNumberDialog(true);
          }
          
          // Clear the flag
          sessionStorage.removeItem('is_new_registration');
        }
      }

      if (pendingPurchaseId) {
        try {
          const { data, error } = await supabase.functions.invoke('complete-purchase', {
            body: { 
              purchaseId: pendingPurchaseId,
              documentId: documentId || null,
              documentNumber: documentNumber || null,
              sumitCustomerId: sumitCustomerId || null
            }
          });

          if (error) {
            console.error('Error completing purchase:', error);
          } else {
            console.log('Purchase completed:', data);
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries({ queryKey: ['customer-hours'] });
            queryClient.invalidateQueries({ queryKey: ['customer-purchases'] });
            
            // If we have a documentId, try to get the invoice URL
            if (documentId) {
              const { data: invoiceData } = await supabase.functions.invoke('get-invoice-pdf', {
                body: { documentId }
              });
              if (invoiceData?.url) {
                setInvoiceUrl(invoiceData.url);
              }
            }
          }
        } catch (err) {
          console.error('Error:', err);
        }
        sessionStorage.removeItem('pending_purchase_id');
      }

      setIsLoading(false);
    };

    completePurchase();
  }, [searchParams, queryClient]);

  const handleViewInvoice = () => {
    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank');
    }
  };

  const handleContinue = () => {
    setShowCustomerNumberDialog(false);
    navigate('/customer/dashboard');
  };

  if (isLoading) {
    return (
      <div 
        className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex items-center justify-center"
        style={{ backgroundImage: `url(${studioBackground})` }}
      >
        <Loader2 className="h-10 w-10 lg:h-12 lg:w-12 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat overflow-auto"
      style={{ backgroundImage: `url(${studioBackground})` }}
    >
      {/* Logo */}
      <div className="absolute top-4 lg:top-6 right-4 lg:right-6">
        <div className="bg-white rounded-[16px] lg:rounded-[20px] p-3 lg:p-4">
          <img src={freeSolLogo} alt="FreeSol Logo" className="h-14 lg:h-16 xl:h-20" />
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center px-4 lg:px-8 xl:px-12 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-sm rounded-[20px] lg:rounded-[30px] p-6 lg:p-10 xl:p-12 max-w-[400px] lg:max-w-lg w-full text-center"
          style={{ boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.3)' }}
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="mx-auto mb-4 lg:mb-6 w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg, #215F66 0%, #742551 100%)' }}
          >
            <Check className="w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 text-white" strokeWidth={3} />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-[22px] lg:text-[28px] xl:text-[32px] font-bold text-[#742551] mb-3 lg:mb-4"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            התשלום עבר בהצלחה! 🎉
          </motion.h1>

          {/* Hours Added Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-4 lg:mb-6"
          >
            {hoursAdded && (
              <p
                className="text-[16px] lg:text-[18px] xl:text-[22px] text-[#215F66] mb-2"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                נוספו לך <span className="font-bold">{hoursAdded}</span> שעות הקלטה
              </p>
            )}
            <p
              className="text-[14px] lg:text-[16px] xl:text-[18px] text-[#742551]"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              החשבונית תישלח אליך למייל
            </p>
          </motion.div>

          {/* Invoice Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#F7F7F7] rounded-[14px] lg:rounded-[20px] p-4 lg:p-6 mb-4 lg:mb-6"
          >
            <div className="flex items-center justify-center gap-2 lg:gap-3 mb-2 lg:mb-3">
              <FileText className="w-5 h-5 lg:w-6 lg:h-6 text-[#742551]" />
              <span 
                className="text-[16px] lg:text-[18px] xl:text-[20px] text-[#742551] font-bold"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                חשבונית
              </span>
            </div>
            
            <div className="flex items-center justify-center gap-1.5 lg:gap-2 text-[#215F66] mb-3 lg:mb-4">
              <Mail className="w-4 h-4 lg:w-5 lg:h-5" />
              <span 
                className="text-[13px] lg:text-[14px] xl:text-[16px]"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                נשלחה לכתובת: {userEmail || 'המייל שלך'}
              </span>
            </div>

            {invoiceUrl && (
              <button
                onClick={handleViewInvoice}
                className="w-full py-2.5 lg:py-3 bg-[#742551] text-white rounded-full text-[14px] lg:text-[16px] xl:text-[18px] hover:bg-[#5a1c3f] transition-colors"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                צפייה בחשבונית ←
              </button>
            )}
          </motion.div>

          {/* Continue Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={handleContinue}
            className="w-full py-3 lg:py-4 rounded-full text-[18px] lg:text-[20px] xl:text-[22px] font-bold text-[#742551] hover:opacity-90 transition-all"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#FFBF66'
            }}
          >
            להמשיך לדשבורד ←
          </motion.button>
        </motion.div>
      </div>

      {/* Customer Number Dialog for new users */}
      <CustomerNumberDialog
        open={showCustomerNumberDialog}
        onOpenChange={setShowCustomerNumberDialog}
        customerNumber={customerNumber}
        onContinue={handleContinue}
        hoursAdded={hoursAdded}
      />
    </div>
  );
}
