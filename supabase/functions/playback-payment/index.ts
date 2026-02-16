import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUMIT_COMPANY_ID = Deno.env.get('SUMIT_COMPANY_ID');
    const SUMIT_API_KEY = Deno.env.get('SUMIT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUMIT_COMPANY_ID || !SUMIT_API_KEY) {
      throw new Error('Missing Sumit API credentials');
    }

    const { 
      playbackId, 
      playbackName, 
      amount, 
      userId, 
      customerName, 
      customerEmail, 
      customerPhone,
      successUrl, 
      cancelUrl,
      playbackPurchaseId 
    } = await req.json();

    console.log('Received params:', { playbackId, playbackName, amount, userId, playbackPurchaseId });

    if (!playbackId || !amount || !userId || !playbackPurchaseId) {
      throw new Error('Missing required parameters: playbackId, amount, userId, playbackPurchaseId');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Build the webhook URL with playback purchase ID
    const webhookUrl = `${SUPABASE_URL}/functions/v1/playback-payment-webhook?playbackPurchaseId=${playbackPurchaseId}`;
    
    // Build redirect URLs
    const successRedirectUrl = successUrl || `${req.headers.get('origin')}/customer/new-project?playback_payment=success&playback_id=${playbackId}`;
    const cancelRedirectUrl = cancelUrl || `${req.headers.get('origin')}/customer/new-project?playback_payment=cancelled`;

    // Call Sumit API to create redirect payment page
    const sumitResponse = await fetch('https://api.sumit.co.il/billing/payments/beginredirect/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Credentials: {
          CompanyID: parseInt(SUMIT_COMPANY_ID),
          APIKey: SUMIT_API_KEY,
        },
        Customer: {
          Name: customerName || 'לקוח',
          EmailAddress: customerEmail || '',
          Phone: customerPhone || '',
          ExternalIdentifier: playbackPurchaseId,
        },
        Items: [
          {
            Item: {
              Name: `פלייבק: ${playbackName || 'שיר'}`,
              ExternalIdentifier: playbackId,
            },
            Quantity: 1,
            UnitPrice: amount,
          },
        ],
        VATIncluded: true,
        DocumentType: 1, // InvoiceAndReceipt
        RedirectURL: successRedirectUrl,
        CancelRedirectURL: cancelRedirectUrl,
        ExternalIdentifier: playbackPurchaseId,
        IPNURL: webhookUrl,
        SendUpdateByEmailAddress: customerEmail || null,
        DocumentDescription: `רכישת פלייבק: ${playbackName}`,
      }),
    });

    const sumitData = await sumitResponse.json();
    console.log('Sumit response:', sumitData);

    const paymentUrl = sumitData.Data?.RedirectURL || sumitData.RedirectURL;

    if (!paymentUrl) {
      // Delete the playback purchase if payment page creation failed
      await supabase.from('playback_purchases').delete().eq('id', playbackPurchaseId);
      throw new Error(sumitData.UserErrorMessage || 'Failed to create payment page');
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: paymentUrl,
        playbackPurchaseId: playbackPurchaseId,
        Data: { RedirectURL: paymentUrl },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
