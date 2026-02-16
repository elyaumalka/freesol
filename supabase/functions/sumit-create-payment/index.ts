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

    const { packageId, userId, amount, packageName, hours, campaignId, couponId, clubId, successUrl, cancelUrl } = await req.json();

    if (!packageId || !userId || amount === undefined) {
      throw new Error('Missing required parameters');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user profile for customer details
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('user_id', userId)
      .single();

    // Create a pending purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        package_id: packageId,
        amount: amount,
        hours_purchased: hours,
        campaign_id: campaignId || null,
        coupon_id: couponId || null,
        club_id: clubId || null,
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Error creating purchase:', purchaseError);
      throw new Error('Failed to create purchase record');
    }

    // If coupon was used, increment its usage count
    if (couponId) {
      const { error: couponError } = await supabase.rpc('increment_coupon_usage', { coupon_id: couponId });
      if (couponError) {
        console.error('Error incrementing coupon usage:', couponError);
        // Don't fail the payment, just log the error
      }
    }

    // If club coupon was used, increment the club usage count
    if (clubId) {
      const { data: club } = await supabase
        .from('clubs')
        .select('usage_count')
        .eq('id', clubId)
        .single();

      if (club) {
        await supabase
          .from('clubs')
          .update({ usage_count: club.usage_count + 1 })
          .eq('id', clubId);
      }
    }

    // Build the webhook URL with purchase ID
    const webhookUrl = `${SUPABASE_URL}/functions/v1/sumit-webhook?purchaseId=${purchase.id}`;
    
    // Build redirect URLs with purchase ID
    const baseSuccessUrl = successUrl || `${req.headers.get('origin')}/customer/dashboard`;
    const baseCancelUrl = cancelUrl || `${req.headers.get('origin')}/customer/packages`;
    const successRedirectUrl = `${baseSuccessUrl}?payment=success&purchaseId=${purchase.id}`;
    const cancelRedirectUrl = `${baseCancelUrl}?payment=failed&purchaseId=${purchase.id}`;

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
          Name: profile?.full_name || 'לקוח',
          EmailAddress: profile?.email || '',
          Phone: profile?.phone || '',
          ExternalIdentifier: purchase.id, // Add purchase ID to customer for tracking
        },
        Items: [
          {
            Item: {
              Name: packageName || 'חבילת שעות אולפן',
              ExternalIdentifier: purchase.id, // Add purchase ID to item
            },
            Quantity: 1,
            UnitPrice: amount,
          },
        ],
        VATIncluded: true,
        DocumentType: 1, // InvoiceAndReceipt (חשבונית מס/קבלה)
        RedirectURL: successRedirectUrl,
        CancelRedirectURL: cancelRedirectUrl,
        ExternalIdentifier: purchase.id, // Store purchase ID for callback
        IPNURL: webhookUrl, // Webhook for payment notification with purchaseId
        SendUpdateByEmailAddress: profile?.email || null,
        DocumentDescription: `רכישה: ${purchase.id}`, // Add purchase ID to document description
      }),
    });

    const sumitData = await sumitResponse.json();

    console.log('Sumit response:', sumitData);

    // Sumit returns RedirectURL in Data object
    const paymentUrl = sumitData.Data?.RedirectURL || sumitData.RedirectURL;

    if (!paymentUrl) {
      // Delete the purchase if payment page creation failed
      await supabase.from('purchases').delete().eq('id', purchase.id);
      throw new Error(sumitData.UserErrorMessage || 'Failed to create payment page');
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: paymentUrl,
        purchaseId: purchase.id,
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
