import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get playbackPurchaseId from query params
    const url = new URL(req.url);
    const playbackPurchaseId = url.searchParams.get('playbackPurchaseId');

    console.log('Webhook received for playback purchase:', playbackPurchaseId);

    // Parse form data (Sumit sends URL-encoded form data)
    const contentType = req.headers.get('content-type') || '';
    let formData: Record<string, string> = {};
    
    const text = await req.text();
    console.log('Raw webhook body:', text);
    
    // Try to parse as URL-encoded first (Sumit's default format)
    if (text.includes('=')) {
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        formData[key.toLowerCase()] = value; // Normalize to lowercase
      });
    } else {
      try {
        const parsed = JSON.parse(text);
        // Normalize keys to lowercase
        Object.keys(parsed).forEach(key => {
          formData[key.toLowerCase()] = parsed[key];
        });
      } catch {
        console.log('Could not parse body');
      }
    }

    console.log('Parsed webhook form data:', formData);

    // Extract payment status and document info (keys normalized to lowercase)
    const valid = formData['valid'];
    const documentId = formData['documentid'];
    const documentUrl = formData['documentdownloadurl'];
    const customerId = formData['customerid'];
    const externalId = formData['externalidentifier'] || playbackPurchaseId;

    console.log('Parsed values:', { valid, documentId, customerId, externalId });

    // Use either the query param or the external identifier from form data
    const purchaseIdToUpdate = playbackPurchaseId || externalId;

    if (!purchaseIdToUpdate) {
      console.error('No playback purchase ID found');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing playback purchase ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the playback purchase record
    // valid=1 means successful payment
    const isSuccess = valid === '1' || valid === 'true';
    const updateData: Record<string, any> = {
      status: isSuccess ? 'completed' : 'failed',
    };

    if (documentId) {
      updateData.document_id = documentId.toString();
    }
    if (documentUrl) {
      updateData.document_url = documentUrl;
    }

    console.log('Updating playback purchase:', purchaseIdToUpdate, 'with:', updateData);

    const { error: updateError } = await supabase
      .from('playback_purchases')
      .update(updateData)
      .eq('id', purchaseIdToUpdate);

    if (updateError) {
      console.error('Error updating playback purchase:', updateError);
      throw updateError;
    }

    // If payment was successful, increment the playback usage count and send invoice
    if (updateData.status === 'completed') {
      const { data: purchase } = await supabase
        .from('playback_purchases')
        .select('playback_id')
        .eq('id', purchaseIdToUpdate)
        .single();

      if (purchase?.playback_id) {
        await supabase.rpc('increment_playback_usage', { playback_id: purchase.playback_id });
      }

      // Send invoice email
      try {
        const invoiceResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            purchaseId: purchaseIdToUpdate,
            isPlaybackPurchase: true,
          }),
        });
        const invoiceResult = await invoiceResponse.json();
        console.log('Invoice email result:', invoiceResult);
      } catch (emailError) {
        console.error('Failed to send invoice email:', emailError);
        // Don't fail the webhook if email fails
      }
    }

    console.log('Playback purchase updated successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
