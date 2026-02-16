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
    const SUMIT_COMPANY_ID = Deno.env.get('SUMIT_COMPANY_ID');
    const SUMIT_API_KEY = Deno.env.get('SUMIT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUMIT_COMPANY_ID || !SUMIT_API_KEY) {
      throw new Error('Missing Sumit API credentials');
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { purchaseId, isPlaybackPurchase } = await req.json();

    if (!purchaseId) {
      throw new Error('Missing purchaseId');
    }

    // Determine which table to query
    const tableName = isPlaybackPurchase ? 'playback_purchases' : 'purchases';

    // Verify the purchase belongs to the user
    const { data: purchase, error: purchaseError } = await supabase
      .from(tableName)
      .select('id, document_id, document_number, document_url, created_at, amount, sumit_customer_id')
      .eq('id', purchaseId)
      .eq('user_id', userData.user.id)
      .single();

    if (purchaseError || !purchase) {
      throw new Error('Purchase not found');
    }

    // If we have cached document_url, return it directly
    if (purchase.document_url) {
      return new Response(
        JSON.stringify({ success: true, pdfUrl: purchase.document_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BEST METHOD: If we have document_number, use getpdf API with DocumentNumber directly
    // This is the most reliable method as it doesn't require finding the DocumentID first
    if (purchase.document_number) {
      console.log('Getting PDF using DocumentNumber:', purchase.document_number);
      
      const pdfResponse = await fetch('https://api.sumit.co.il/accounting/documents/getpdf/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Credentials: {
            CompanyID: parseInt(SUMIT_COMPANY_ID),
            APIKey: SUMIT_API_KEY,
          },
          DocumentNumber: parseInt(purchase.document_number),
          DocumentType: 1, // Invoice (חשבונית מס/קבלה)
          Original: true,
        }),
      });

      // Check content type - Sumit may return PDF directly or JSON
      const contentType = pdfResponse.headers.get('content-type') || '';
      console.log('Response content-type:', contentType);

      if (contentType.includes('application/pdf')) {
        // Sumit returned PDF directly - convert to base64
        const pdfBuffer = await pdfResponse.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);
        
        // Convert to base64
        let binary = '';
        for (let i = 0; i < pdfBytes.length; i++) {
          binary += String.fromCharCode(pdfBytes[i]);
        }
        const pdfBase64 = btoa(binary);
        
        console.log('PDF received directly, size:', pdfBytes.length, 'bytes');
        
        return new Response(
          JSON.stringify({ success: true, pdfBase64 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Otherwise, parse as JSON
      const pdfData = await pdfResponse.json();
      console.log('Sumit getpdf by DocumentNumber response:', JSON.stringify(pdfData));

      if (pdfData.Data?.FileContent) {
        return new Response(
          JSON.stringify({ success: true, pdfBase64: pdfData.Data.FileContent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (pdfData.Data?.URL) {
        // Cache the URL
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        await adminClient
          .from(tableName)
          .update({ document_url: pdfData.Data.URL })
          .eq('id', purchaseId);

        return new Response(
          JSON.stringify({ success: true, pdfUrl: pdfData.Data.URL }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('getpdf by DocumentNumber failed, trying other methods...');
    }

    // If we have document_id, get the PDF from Sumit
    if (purchase.document_id) {
      console.log('Getting PDF for DocumentID:', purchase.document_id);
      
      // First try to get document details to find the download URL
      const detailsResponse = await fetch('https://api.sumit.co.il/accounting/documents/getdetails/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Credentials: {
            CompanyID: parseInt(SUMIT_COMPANY_ID),
            APIKey: SUMIT_API_KEY,
          },
          DocumentID: parseInt(purchase.document_id),
        }),
      });

      const detailsData = await detailsResponse.json();
      console.log('Sumit document details response:', JSON.stringify(detailsData));

      // Check if we got a download URL from details
      if (detailsData.Data?.DocumentDownloadURL) {
        const downloadUrl = detailsData.Data.DocumentDownloadURL;
        
        // Cache the URL for next time
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        await adminClient
          .from(tableName)
          .update({ document_url: downloadUrl })
          .eq('id', purchaseId);

        return new Response(
          JSON.stringify({ success: true, pdfUrl: downloadUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fallback to getpdf API with DocumentID
      const sumitResponse = await fetch('https://api.sumit.co.il/accounting/documents/getpdf/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Credentials: {
            CompanyID: parseInt(SUMIT_COMPANY_ID),
            APIKey: SUMIT_API_KEY,
          },
          DocumentID: parseInt(purchase.document_id),
        }),
      });

      const sumitData = await sumitResponse.json();
      console.log('Sumit PDF response:', sumitData);

      if (sumitData.Data?.FileContent) {
        return new Response(
          JSON.stringify({ success: true, pdfBase64: sumitData.Data.FileContent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (sumitData.Data?.URL) {
        return new Response(
          JSON.stringify({ success: true, pdfUrl: sumitData.Data.URL }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('לא ניתן לטעון את החשבונית. נסה שוב מאוחר יותר.');
    }

    // No document_id and no document_number - cannot retrieve invoice
    throw new Error('לא נמצאה חשבונית לרכישה זו. ייתכן שהחשבונית טרם הונפקה.');

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
