import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";
import { usePackages } from "@/hooks/usePackages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CouponCodeDialog } from "@/components/customer/CouponCodeDialog";

export default function CustomerPackages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: packages, isLoading } = usePackages();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponId: string | null;
    clubId: string | null;
    discountedPrice: number;
    description: string;
  } | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Check for payment failure in URL
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'failed') {
      toast.error('התשלום נכשל, אנא נסה שוב');
      searchParams.delete('payment');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const sortedPackages = packages?.sort((a, b) => a.price - b.price) || [];

  const handleContinue = () => {
    if (!selectedPackage || !user) {
      toast.error('נא לבחור חבילה');
      return;
    }
    // Show coupon dialog before payment
    setShowCouponDialog(true);
  };

  const handleApplyCoupon = (couponId: string | null, clubId: string | null, discountedPrice: number, description: string) => {
    setAppliedCoupon({ couponId, clubId, discountedPrice, description });
    // Proceed to payment with coupon/club
    proceedToPayment(couponId, clubId, discountedPrice);
  };

  const handleSkipCoupon = () => {
    // Proceed to payment without coupon
    proceedToPayment(null, null, null);
  };

  const proceedToPayment = async (couponId: string | null, clubId: string | null, discountedPrice: number | null) => {
    if (!selectedPackage || !user) return;

    setIsPurchasing(true);
    
    const pkg = packages?.find(p => p.id === selectedPackage);
    if (!pkg) {
      setIsPurchasing(false);
      return;
    }

    // Check for campaign from sessionStorage
    const campaignId = sessionStorage.getItem('campaign_id');
    
    // Use discounted price if coupon applied, otherwise original price
    const finalAmount = discountedPrice !== null ? discountedPrice : pkg.price;

    try {
      // Call edge function to create Sumit payment page
      const { data, error } = await supabase.functions.invoke('sumit-create-payment', {
        body: {
          packageId: pkg.id,
          userId: user.id,
          amount: finalAmount,
          packageName: pkg.name,
          hours: pkg.recording_hours,
          campaignId: campaignId || null,
          couponId: couponId || null,
          clubId: clubId || null,
          // URLs will be updated by edge function with purchaseId
          successUrl: `${window.location.origin}/customer/payment-success?hours=${pkg.recording_hours}`,
          cancelUrl: `${window.location.origin}/customer/packages?payment=failed`,
        },
      });

      if (error) {
        console.error('Payment error:', error);
        toast.error('שגיאה ביצירת דף התשלום');
        setIsPurchasing(false);
        return;
      }

      if (data?.paymentUrl && data?.purchaseId) {
        // Store purchaseId in sessionStorage for completion after payment
        sessionStorage.setItem('pending_purchase_id', data.purchaseId);
        
        // Clear campaign from sessionStorage before redirect
        if (campaignId) {
          sessionStorage.removeItem('campaign_id');
          sessionStorage.removeItem('campaign_name');
        }
        
        // Redirect to Sumit payment page
        window.location.href = data.paymentUrl;
      } else if (data?.paymentUrl) {
        // Fallback if no purchaseId
        window.location.href = data.paymentUrl;
      } else {
        toast.error('שגיאה ביצירת דף התשלום');
        setIsPurchasing(false);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('שגיאה בתהליך התשלום');
      setIsPurchasing(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat overflow-auto"
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
            style={{ height: 'clamp(48px, 4.5vw, 90px)' }}
          />
        </div>
      </div>

      {/* Packages Container */}
      <div 
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ padding: 'clamp(48px, 6vh, 80px) var(--space-lg)' }}
      >
        {isLoading ? (
          <Loader2 style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="animate-spin text-white" />
        ) : sortedPackages.length === 0 ? (
          <div className="text-white" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-xl)' }}>אין חבילות זמינות כרגע</div>
        ) : (
          <>
            {/* Wrapper with border around all packages */}
            <div 
              className="flex flex-col items-end"
              style={{
                padding: 'var(--space-lg)',
                borderRadius: 'var(--radius-xl)',
                gap: 'var(--space-lg)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0px 4px 12px rgba(255, 201, 128, 0.4)',
                background: 'rgba(116, 37, 81, 0.2)',
              }}
            >
              <div className="flex flex-wrap items-end justify-center" dir="rtl" style={{ gap: 'var(--space-md)' }}>
                {sortedPackages.map((pkg) => {
                  const isRecommended = pkg.is_recommended;
                  const isSelected = selectedPackage === pkg.id;
                  
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={`relative cursor-pointer transition-all duration-300 ${
                        isSelected ? 'scale-105' : 'hover:scale-[1.02]'
                      }`}
                      style={{
                        width: isRecommended ? 'clamp(200px, 20vw, 380px)' : 'clamp(180px, 17vw, 320px)',
                        height: isRecommended ? 'clamp(240px, 24vw, 450px)' : 'clamp(200px, 20vw, 380px)',
                        background: 'linear-gradient(0deg, rgba(116, 37, 81, 0.47) 0%, rgba(116, 37, 81, 0.47) 100%), linear-gradient(180deg, rgba(116, 37, 81, 0.30) 0%, rgba(255, 255, 255, 0) 100%)',
                        boxShadow: isRecommended 
                          ? '0px 4px 12px 6px rgba(255, 201, 128, 0.6)' 
                          : '0px 4px 12px rgba(255, 201, 128, 0.4)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                      }}
                    >
                      {/* Gold Header */}
                      <div 
                        className="w-full flex items-center justify-center"
                        style={{
                          height: isRecommended ? 'clamp(50px, 5.5vw, 100px)' : 'clamp(45px, 4.5vw, 85px)',
                          background: '#FFC97F',
                        }}
                      >
                        <span 
                          className="text-center"
                          style={{
                            color: '#742551',
                            fontSize: isRecommended ? 'clamp(16px, 1.6vw, 32px)' : 'clamp(14px, 1.4vw, 28px)',
                            fontFamily: 'Discovery_Fs',
                            fontWeight: isRecommended ? 800 : 500,
                          }}
                        >
                          {pkg.name}
                        </span>
                      </div>

                      {/* Recommended Badge */}
                      {isRecommended && (
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
                          style={{
                            top: 'clamp(28px, 3.5vw, 62px)',
                            background: '#EDB096',
                            borderRadius: 'var(--radius-full)',
                            padding: 'var(--space-xs) var(--space-sm)'
                          }}
                        >
                          <span 
                            style={{
                              color: '#215F66',
                              fontSize: 'clamp(9px, 0.9vw, 18px)',
                              fontFamily: 'Discovery_Fs',
                              fontWeight: 800,
                              textAlign: 'center',
                            }}
                          >
                            מומלצת
                          </span>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex flex-col items-center" style={{ marginTop: isRecommended ? 'clamp(28px, 3.5vw, 65px)' : 'clamp(18px, 2vw, 40px)' }}>
                        {/* Hours Number */}
                        <span 
                          style={{
                            color: 'white',
                            fontSize: isRecommended ? 'clamp(42px, 4.5vw, 90px)' : 'clamp(36px, 4vw, 80px)',
                            fontFamily: 'Discovery_Fs',
                            fontWeight: 800,
                            textAlign: 'center',
                            lineHeight: 1,
                          }}
                        >
                          {pkg.recording_hours}
                        </span>

                        {/* Hours Text */}
                        <span 
                          style={{
                            color: 'white',
                            fontSize: isRecommended ? 'clamp(12px, 1.2vw, 26px)' : 'clamp(11px, 1.1vw, 24px)',
                            fontFamily: 'Discovery_Fs',
                            fontWeight: 400,
                            textAlign: 'center',
                            marginTop: 'clamp(6px, 0.7vw, 12px)',
                          }}
                        >
                          שעות שימוש באולפן
                        </span>

                        {/* Price */}
                        <span 
                          style={{
                            color: '#FFBF66',
                            fontSize: isRecommended ? 'clamp(32px, 3.2vw, 70px)' : 'clamp(28px, 2.8vw, 60px)',
                            fontFamily: 'Discovery_Fs',
                            fontWeight: 800,
                            textAlign: 'center',
                            opacity: 0.9,
                            marginTop: 'clamp(12px, 1.5vw, 28px)',
                          }}
                        >
                          {pkg.price} ₪
                        </span>
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            border: '3px solid #FFBF66',
                            borderRadius: 'var(--radius-lg)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Button inside the wrapper */}
              <button 
                onClick={handleContinue}
                disabled={!selectedPackage || isPurchasing}
                className={`flex items-center justify-center transition-all ${
                  selectedPackage 
                    ? 'hover:opacity-90' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{
                  width: 'clamp(140px, 12vw, 240px)',
                  height: 'var(--btn-md)',
                  background: '#FFBF66',
                  borderRadius: 'var(--radius-full)',
                  gap: 'var(--space-xs)'
                }}
              >
                {isPurchasing && <Loader2 style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)', color: '#742551' }} className="animate-spin" />}
                <span 
                  style={{
                    color: '#742551',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'Discovery_Fs',
                    fontWeight: 400,
                    textAlign: 'center',
                  }}
                >
                  {isPurchasing ? 'מעבד...' : 'מעבר לתשלום ←'}
                </span>
              </button>
            </div>
          </>
        )}

        {/* Skip Button */}
        <button
          onClick={() => navigate('/customer/dashboard')}
          className="fixed text-white hover:underline"
          style={{ 
            fontFamily: 'Discovery_Fs',
            fontSize: 'var(--text-sm)',
            bottom: 'var(--space-lg)',
            right: 'var(--space-lg)'
          }}
        >
          דלג והמשך לדשבורד
        </button>
      </div>

      {/* Coupon Code Dialog */}
      <CouponCodeDialog
        open={showCouponDialog}
        onOpenChange={setShowCouponDialog}
        originalPrice={packages?.find(p => p.id === selectedPackage)?.price || 0}
        onApplyCoupon={handleApplyCoupon}
        onSkip={handleSkipCoupon}
      />
    </div>
  );
}