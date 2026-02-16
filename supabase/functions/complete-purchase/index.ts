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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUMIT_COMPANY_ID = Deno.env.get('SUMIT_COMPANY_ID');
    const SUMIT_API_KEY = Deno.env.get('SUMIT_API_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { purchaseId, documentId: providedDocumentId, documentNumber, sumitCustomerId: providedSumitCustomerId } = await req.json();

    if (!purchaseId) {
      throw new Error('Missing purchase ID');
    }

    console.log('Completing purchase:', purchaseId, 'Provided DocumentID:', providedDocumentId, 'DocumentNumber:', documentNumber, 'SumitCustomerID:', providedSumitCustomerId);

    // Get purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      console.log('Purchase not found:', purchaseId);
      throw new Error('Purchase not found');
    }

    // Check if this purchase was already processed (by webhook or previous call)
    if (purchase.status === 'completed') {
      console.log('Purchase already completed, skipping hours addition:', purchaseId);
      
      // Return success but don't add hours again
      return new Response(
        JSON.stringify({ 
          success: true, 
          hoursAdded: purchase.hours_purchased,
          alreadyProcessed: true,
          message: 'Already processed by webhook'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark as processing to prevent race conditions
    const { error: lockError } = await supabase
      .from('purchases')
      .update({ status: 'processing' })
      .eq('id', purchaseId)
      .eq('status', 'pending'); // Only update if still pending
    
    if (lockError) {
      console.log('Could not lock purchase, may already be processing:', purchaseId);
    }

    // Re-fetch to ensure we have latest status
    const { data: lockedPurchase } = await supabase
      .from('purchases')
      .select('status')
      .eq('id', purchaseId)
      .single();
    
    // If status is already completed (webhook processed it), skip
    if (lockedPurchase?.status === 'completed') {
      console.log('Purchase was completed by webhook during processing:', purchaseId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          hoursAdded: purchase.hours_purchased,
          alreadyProcessed: true,
          message: 'Processed by webhook'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Try to get DocumentID from Sumit
    // If we have DocumentNumber from the redirect, use it to find the exact document
    let documentId = providedDocumentId;
    let sumitCustomerId = providedSumitCustomerId;
    
    if (!documentId && documentNumber && SUMIT_COMPANY_ID && SUMIT_API_KEY) {
      try {
        console.log('Fetching DocumentID from Sumit using DocumentNumber:', documentNumber);
        
        // Use accounting/documents/list to find by DocumentNumber
        const purchaseDate = new Date(purchase.created_at);
        const dateFrom = purchaseDate.toISOString().split('T')[0];
        const dateTo = new Date().toISOString().split('T')[0];
        
        const sumitResponse = await fetch('https://api.sumit.co.il/accounting/documents/list/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Credentials: {
              CompanyID: parseInt(SUMIT_COMPANY_ID),
              APIKey: SUMIT_API_KEY,
            },
            FromDate: dateFrom,
            ToDate: dateTo,
          }),
        });
        
        const sumitData = await sumitResponse.json();
        console.log('Sumit accounting/documents/list response - searching for DocumentNumber:', documentNumber);
        
        if (sumitData.Data?.Documents && sumitData.Data.Documents.length > 0) {
          // Find by exact DocumentNumber match
          const matchingDoc = sumitData.Data.Documents.find((doc: any) => 
            doc.DocumentNumber?.toString() === documentNumber?.toString()
          );
          
          if (matchingDoc) {
            documentId = matchingDoc.DocumentID?.toString() || null;
            console.log('Found document by DocumentNumber:', documentNumber, '-> DocumentID:', documentId);
          } else {
            console.log('No document found with DocumentNumber:', documentNumber);
          }
        }
      } catch (sumitError) {
        console.error('Error fetching from Sumit:', sumitError);
      }
    }

    // Update customer hours
    const { data: existingHours } = await supabase
      .from('customer_hours')
      .select('*')
      .eq('user_id', purchase.user_id)
      .maybeSingle();

    if (existingHours) {
      const { error: updateError } = await supabase
        .from('customer_hours')
        .update({
          total_hours: existingHours.total_hours + purchase.hours_purchased
        })
        .eq('user_id', purchase.user_id);

      if (updateError) {
        console.error('Error updating hours:', updateError);
        throw new Error('Failed to update hours');
      }
    } else {
      const { error: insertError } = await supabase
        .from('customer_hours')
        .insert({
          user_id: purchase.user_id,
          total_hours: purchase.hours_purchased,
          used_hours: 0
        });

      if (insertError) {
        console.error('Error inserting hours:', insertError);
        throw new Error('Failed to insert hours');
      }
    }

    // Mark purchase as completed and save document_id, document_number, and sumit_customer_id
    await supabase
      .from('purchases')
      .update({ 
        status: 'completed',
        document_id: documentId || null,
        document_number: documentNumber || null,
        sumit_customer_id: sumitCustomerId || null
      })
      .eq('id', purchaseId);

    console.log('Purchase completed with DocumentID:', documentId, 'DocumentNumber:', documentNumber);

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

    console.log('Purchase completed successfully:', purchaseId, 'Hours added:', purchase.hours_purchased);

    return new Response(
      JSON.stringify({ 
        success: true, 
        hoursAdded: purchase.hours_purchased 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('Complete purchase error:', error);
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
