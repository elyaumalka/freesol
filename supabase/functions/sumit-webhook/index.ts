import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to fetch the correct DocumentID from Sumit using ExternalIdentifier
async function fetchCorrectDocumentId(
  purchaseId: string, 
  sumitCompanyId: string, 
  sumitApiKey: string,
  purchaseCreatedAt: string
): Promise<string | null> {
  try {
    console.log('Fetching correct DocumentID from Sumit for purchase:', purchaseId);
    
    const purchaseDate = new Date(purchaseCreatedAt);
    const now = new Date();
    const dateFrom = purchaseDate.toISOString().split('T')[0];
    const dateTo = now.toISOString().split('T')[0];
    
    const response = await fetch('https://api.sumit.co.il/billing/documents/list/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Credentials: {
          CompanyID: parseInt(sumitCompanyId),
          APIKey: sumitApiKey,
        },
        ExternalIdentifier: purchaseId,
        Date_From: dateFrom,
        Date_To: dateTo,
        PageSize: 10,
      }),
    });
    
    const data = await response.json();
    console.log('Sumit documents/list response:', JSON.stringify(data));
    
    if (data.Data?.Items && data.Data.Items.length > 0) {
      // Find exact match by ExternalIdentifier
      const matchingDoc = data.Data.Items.find((doc: any) => 
        doc.ExternalIdentifier === purchaseId
      );
      
      if (matchingDoc) {
        const docId = matchingDoc.ID || matchingDoc.DocumentID;
        console.log('Found exact matching DocumentID:', docId, 'DocNumber:', matchingDoc.DocumentNumber);
        return docId?.toString() || null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching DocumentID from Sumit:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUMIT_COMPANY_ID = Deno.env.get('SUMIT_COMPANY_ID');
    const SUMIT_API_KEY = Deno.env.get('SUMIT_API_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get purchaseId from query string (we add it to the webhook URL)
    const url = new URL(req.url);
    const purchaseIdFromQuery = url.searchParams.get('purchaseId');

    // Get the content type to determine how to parse the body
    const contentType = req.headers.get('content-type') || '';
    
    let webhookData: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse URL-encoded form data (Sumit sends this format)
      const formData = await req.text();
      console.log('Raw form data received:', formData);
      
      const params = new URLSearchParams(formData);
      params.forEach((value, key) => {
        webhookData[key] = value;
      });
    } else if (contentType.includes('application/json')) {
      // Parse JSON
      webhookData = await req.json();
    } else {
      // Try to parse as form data by default
      const formData = await req.text();
      console.log('Raw data received:', formData);
      
      const params = new URLSearchParams(formData);
      params.forEach((value, key) => {
        webhookData[key] = value;
      });
    }
    
    console.log('Sumit webhook parsed data:', JSON.stringify(webhookData));

    // Sumit IPN fields - they use lowercase field names
    const purchaseId = purchaseIdFromQuery || webhookData.ExternalIdentifier || webhookData.externalidentifier;
    const isValid = webhookData.valid === '1' || webhookData.Valid === '1';
    // Note: webhookData.documentid from IPN is NOT the correct DocumentID for PDF download
    // We need to fetch the correct one using ExternalIdentifier
    const webhookDocumentId = webhookData.DocumentID || webhookData.documentid;
    const sumitCustomerId = webhookData.CustomerID || webhookData.customerid;

    console.log('Purchase ID:', purchaseId, 'Valid:', isValid, 'Webhook DocID (may be wrong):', webhookDocumentId, 'Sumit Customer ID:', sumitCustomerId);

    // Try to find the purchase - first by ExternalIdentifier (purchaseId), then by sumit_customer_id
    let purchase = null;
    
    if (purchaseId) {
      const { data } = await supabase
        .from('purchases')
        .select('*, packages(*)')
        .eq('id', purchaseId)
        .single();
      purchase = data;
    }
    
    // If not found by purchaseId, try to find by sumit_customer_id
    if (!purchase && sumitCustomerId) {
      const { data } = await supabase
        .from('purchases')
        .select('*, packages(*)')
        .eq('sumit_customer_id', sumitCustomerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      purchase = data;
      console.log('Found purchase by sumit_customer_id:', purchase?.id);
    }

    if (!purchase) {
      console.log('Purchase not found for purchaseId:', purchaseId, 'or sumitCustomerId:', sumitCustomerId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If payment was valid/successful, update purchase status, document_id, customer hours and campaign usage
    if (isValid) {
      // Fetch the CORRECT DocumentID from Sumit using ExternalIdentifier
      let correctDocumentId: string | null = null;
      if (SUMIT_COMPANY_ID && SUMIT_API_KEY) {
        correctDocumentId = await fetchCorrectDocumentId(
          purchase.id,
          SUMIT_COMPANY_ID,
          SUMIT_API_KEY,
          purchase.created_at
        );
      }
      
      console.log('Correct DocumentID from Sumit API:', correctDocumentId);

      // Check if already processed to prevent double hours
      if (purchase.status === 'completed' || purchase.status === 'processing') {
        console.log('Purchase already processed, skipping hours addition. Status:', purchase.status);
        
        // But still update the document_id if we have the correct one and it's missing or different
        if (correctDocumentId && purchase.document_id !== correctDocumentId) {
          console.log('Updating document_id for already processed purchase:', correctDocumentId);
          await supabase
            .from('purchases')
            .update({ document_id: correctDocumentId })
            .eq('id', purchase.id);
        }
        
        return new Response(
          JSON.stringify({ success: true, alreadyProcessed: true, documentIdUpdated: !!correctDocumentId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try to atomically update status to 'processing' only if still 'pending'
      const { data: lockResult, error: lockError } = await supabase
        .from('purchases')
        .update({ status: 'processing' })
        .eq('id', purchase.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      // If we couldn't lock (someone else got it first), skip hours but update document_id
      if (!lockResult) {
        console.log('Could not lock purchase - already being processed by another request');
        
        // Still try to update document_id with the correct one
        if (correctDocumentId) {
          await supabase
            .from('purchases')
            .update({ document_id: correctDocumentId })
            .eq('id', purchase.id);
        }
        
        return new Response(
          JSON.stringify({ success: true, alreadyProcessed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update customer hours
      const { data: existingHours } = await supabase
        .from('customer_hours')
        .select('*')
        .eq('user_id', purchase.user_id)
        .maybeSingle();

      if (existingHours) {
        await supabase
          .from('customer_hours')
          .update({
            total_hours: existingHours.total_hours + purchase.hours_purchased
          })
          .eq('user_id', purchase.user_id);
      } else {
        await supabase
          .from('customer_hours')
          .insert({
            user_id: purchase.user_id,
            total_hours: purchase.hours_purchased,
            used_hours: 0
          });
      }

      // Now mark as completed with the correct document_id and save sumit_customer_id
      await supabase
        .from('purchases')
        .update({
          status: 'completed',
          document_id: correctDocumentId || null,
          sumit_customer_id: sumitCustomerId || null,
        })
        .eq('id', purchase.id);

      // If campaign was used, increment usage count
      if (purchase.campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('usage_count')
          .eq('id', purchase.campaign_id)
          .single();

        if (campaign) {
          await supabase
            .from('campaigns')
            .update({ usage_count: campaign.usage_count + 1 })
            .eq('id', purchase.campaign_id);
        }
      }

      console.log('Webhook: Payment successful, hours added for user:', purchase.user_id, 'Hours:', purchase.hours_purchased, 'Correct Document ID:', correctDocumentId);

      // Send invoice email via our edge function
      try {
        const invoiceResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            purchaseId: purchase.id,
          }),
        });
        
        const invoiceResult = await invoiceResponse.json();
        console.log('Invoice email result:', invoiceResult);
      } catch (emailError) {
        console.error('Error sending invoice email:', emailError);
        // Don't fail the webhook if email fails
      }

      return new Response(
        JSON.stringify({ success: true, hoursAdded: true, documentId: correctDocumentId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Payment failed or invalid
      console.log('Payment not valid for purchase:', purchase?.id);
      
      if (purchase) {
        await supabase
          .from('purchases')
          .update({ status: 'failed' })
          .eq('id', purchase.id);
      }
      
      return new Response(
        JSON.stringify({ success: true, paymentFailed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Sumit webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
