import { useState, useEffect } from "react";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";
import { useCustomerPurchases, useCustomerPlaybackPurchases } from "@/hooks/useCustomerData";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CustomerPurchaseHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: purchases, isLoading, refetch } = useCustomerPurchases();
  const { data: playbackPurchases, isLoading: isLoadingPlaybacks, refetch: refetchPlaybacks } = useCustomerPlaybackPurchases();
  const [loadingInvoice, setLoadingInvoice] = useState<string | null>(null);
  const [loadingRepurchase, setLoadingRepurchase] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);

  // Refetch purchases when component mounts to get latest data
  useEffect(() => {
    refetch();
    refetchPlaybacks();
  }, [refetch, refetchPlaybacks]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const handleRepurchase = async (purchase: any) => {
    if (!user || !purchase.package_id || !purchase.package) {
      toast.error('לא ניתן לבצע רכישה מחדש');
      return;
    }

    setLoadingRepurchase(purchase.id);
    try {
      const { data, error } = await supabase.functions.invoke('sumit-create-payment', {
        body: {
          packageId: purchase.package_id,
          userId: user.id,
          amount: purchase.package.price,
          packageName: purchase.package.name,
          hours: purchase.package.recording_hours,
          campaignId: null,
          // Add correct URLs for redirect
          successUrl: `${window.location.origin}/customer/payment-success?hours=${purchase.package.recording_hours}`,
          cancelUrl: `${window.location.origin}/customer/purchase-history?payment=failed`,
        },
      });

      if (error) throw error;

      if (data?.paymentUrl && data?.purchaseId) {
        // Store purchaseId in sessionStorage for completion after payment
        sessionStorage.setItem('pending_purchase_id', data.purchaseId);
        
        // Redirect to payment page
        window.location.href = data.paymentUrl;
      } else if (data?.paymentUrl) {
        // Fallback if no purchaseId
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('לא התקבל קישור לתשלום');
      }
    } catch (error) {
      console.error('Error creating repurchase:', error);
      toast.error('שגיאה ביצירת הזמנה חדשה');
    } finally {
      setLoadingRepurchase(null);
    }
  };

  const handleViewInvoice = async (purchaseId: string, isPlayback = false) => {
    setLoadingInvoice(purchaseId);
    try {
      const { data, error } = await supabase.functions.invoke('get-invoice-pdf', {
        body: { purchaseId, isPlaybackPurchase: isPlayback },
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'שגיאה בטעינת החשבונית');
        return;
      }

      if (data.pdfUrl) {
        // Open URL in new tab
        window.open(data.pdfUrl, '_blank');
      } else if (data.pdfBase64) {
        // Convert base64 to blob and open
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setInvoicePdfUrl(url);
        setInvoiceDialogOpen(true);
      } else {
        toast.error('לא נמצא קובץ חשבונית');
      }
    } catch (error) {
      console.error('Error getting invoice:', error);
      toast.error('שגיאה בטעינת החשבונית');
    } finally {
      setLoadingInvoice(null);
    }
  };

  // Filter to show only completed purchases
  const completedPurchases = purchases?.filter(p => (p as any).status === 'completed') || [];
  const completedPlaybackPurchases = playbackPurchases?.filter(p => p.status === 'completed') || [];

  return (
    <CustomerLayout>
      <Tabs defaultValue="hours" className="w-full" dir="rtl">
        <div className="flex justify-start" style={{ marginBottom: 'var(--space-lg)' }}>
          <TabsList 
            className="grid grid-cols-2 bg-transparent p-0"
            style={{ width: 'auto', gap: 'var(--space-sm)' }}
          >
            <TabsTrigger 
              value="hours" 
              className="rounded-full bg-[#D4A853] data-[state=inactive]:bg-white/20 data-[state=inactive]:text-white"
              style={{ fontFamily: 'Discovery_Fs', color: '#702752', fontSize: 'var(--text-sm)', padding: 'var(--space-sm) var(--space-lg)' }}
            >
              רכישת שעות
            </TabsTrigger>
            <TabsTrigger 
              value="playbacks" 
              className="rounded-full bg-[#D4A853] data-[state=inactive]:bg-white/20 data-[state=inactive]:text-white"
              style={{ fontFamily: 'Discovery_Fs', color: '#702752', fontSize: 'var(--text-sm)', padding: 'var(--space-sm) var(--space-lg)' }}
            >
              רכישת פלייבקים
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Hours Purchases Tab */}
        <TabsContent value="hours">
          <div 
            className="overflow-hidden overflow-x-auto bg-white"
            style={{ borderRadius: 'var(--radius-xl)' }}
          >
            {/* Table Header */}
            <div 
              className="grid grid-cols-5 gap-2 lg:gap-4 min-w-[600px]"
              style={{ background: '#F7F7F7', padding: 'var(--space-md)', borderBottom: '1px solid #e5e5e5' }}
            >
              {['תאריך', 'חבילה', 'סכום', 'כמות שעות', 'פעולות'].map((title) => (
                <div 
                  key={title}
                  className="text-right font-bold text-[#742551]"
                  style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
                >
                  {title}
                </div>
              ))}
            </div>

            {/* Table Body */}
            {isLoading ? (
              <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                <Loader2 style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="animate-spin text-[#742551]" />
              </div>
            ) : completedPurchases.length === 0 ? (
              <div className="text-center text-[#742551]/60" style={{ padding: 'var(--space-2xl)', fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}>
                אין רכישות שעות עדיין
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {completedPurchases.map((purchase) => (
                  <div 
                    key={purchase.id} 
                    className="grid grid-cols-5 gap-2 lg:gap-4 items-center hover:bg-gray-50 transition-all min-w-[600px]"
                    style={{ padding: 'var(--space-md)' }}
                  >
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {formatDate(purchase.created_at)}
                    </div>
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {purchase.package?.name || 'חבילה'}
                    </div>
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {purchase.amount} ₪
                    </div>
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {purchase.hours_purchased}
                    </div>
                    <div className="flex flex-wrap items-center justify-end" style={{ gap: 'var(--space-xs)' }}>
                      <button 
                        onClick={() => handleRepurchase(purchase)}
                        disabled={loadingRepurchase === purchase.id || !purchase.package}
                        className="flex items-center rounded-full text-[#742551] disabled:opacity-50"
                        style={{ background: '#FFBF66', fontFamily: 'Discovery_Fs', fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-md)', gap: 'var(--space-xs)' }}
                      >
                        {loadingRepurchase === purchase.id ? (
                          <Loader2 style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="animate-spin" />
                        ) : (
                          <>
                            <span>רכישה מחדש</span>
                            <ArrowLeft style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => handleViewInvoice(purchase.id)}
                        disabled={loadingInvoice === purchase.id}
                        className="flex items-center rounded-full text-white disabled:opacity-50"
                        style={{ background: '#742551', fontFamily: 'Discovery_Fs', fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-md)', gap: 'var(--space-xs)' }}
                      >
                        {loadingInvoice === purchase.id ? (
                          <Loader2 style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="animate-spin" />
                        ) : (
                          <>
                            <span>חשבונית</span>
                            <Eye style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Playback Purchases Tab */}
        <TabsContent value="playbacks">
          <div className="bg-white" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {/* Table Header */}
            <div 
              className="grid grid-cols-4"
              style={{ background: '#F7F7F7', padding: 'var(--space-md)', gap: 'var(--space-md)', borderBottom: '1px solid #e5e5e5' }}
            >
              {['תאריך', 'שם השיר', 'סכום', 'פעולות'].map((title) => (
                <div 
                  key={title}
                  className="text-right font-bold text-[#742551]"
                  style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
                >
                  {title}
                </div>
              ))}
            </div>

            {/* Table Body */}
            {isLoadingPlaybacks ? (
              <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                <Loader2 style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="animate-spin text-[#742551]" />
              </div>
            ) : completedPlaybackPurchases.length === 0 ? (
              <div className="text-center text-[#742551]/60" style={{ padding: 'var(--space-2xl)', fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}>
                אין רכישות פלייבקים עדיין
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {completedPlaybackPurchases.map((purchase) => (
                  <div 
                    key={purchase.id} 
                    className="grid grid-cols-4 items-center hover:bg-gray-50 transition-all"
                    style={{ padding: 'var(--space-md)', gap: 'var(--space-md)' }}
                  >
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {formatDate(purchase.created_at)}
                    </div>
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {purchase.playback?.song_name || 'פלייבק'}
                    </div>
                    <div className="text-right text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}>
                      {purchase.amount} ₪
                    </div>
                    <div className="flex items-center justify-end" style={{ gap: 'var(--space-sm)' }}>
                      <button 
                        onClick={() => handleViewInvoice(purchase.id, true)}
                        disabled={loadingInvoice === purchase.id}
                        className="flex items-center rounded-full text-white disabled:opacity-50"
                        style={{ background: '#742551', fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-md)', gap: 'var(--space-xs)' }}
                      >
                        {loadingInvoice === purchase.id ? (
                          <Loader2 style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="animate-spin" />
                        ) : (
                          <>
                            <span>חשבונית</span>
                            <Eye style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice PDF Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Discovery_Fs' }}>חשבונית</DialogTitle>
          </DialogHeader>
          {invoicePdfUrl && (
            <iframe 
              src={invoicePdfUrl} 
              className="w-full h-full border-0"
              title="Invoice PDF"
            />
          )}
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}