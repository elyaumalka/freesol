import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendInvoiceRequest {
  purchaseId: string;
  isPlaybackPurchase?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUMIT_COMPANY_ID = Deno.env.get('SUMIT_COMPANY_ID');
    const SUMIT_API_KEY = Deno.env.get('SUMIT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY');
    }

    if (!SUMIT_COMPANY_ID || !SUMIT_API_KEY) {
      throw new Error('Missing Sumit API credentials');
    }

    const { purchaseId, isPlaybackPurchase }: SendInvoiceRequest = await req.json();

    if (!purchaseId) {
      throw new Error('Missing purchaseId');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Determine which table to query
    const tableName = isPlaybackPurchase ? 'playback_purchases' : 'purchases';

    // Get purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from(tableName)
      .select('id, document_id, document_url, amount, user_id, created_at')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase not found:', purchaseError);
      throw new Error('Purchase not found');
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', purchase.user_id)
      .single();

    if (!profile?.email) {
      throw new Error('User email not found');
    }

    let pdfUrl = purchase.document_url;
    let pdfBase64: string | null = null;

    // If we have document_id but no cached URL, fetch from Sumit
    if (purchase.document_id && !pdfUrl) {
      console.log('Fetching PDF from Sumit for document:', purchase.document_id);

      // Try to get document details first
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
      console.log('Sumit document details:', JSON.stringify(detailsData));

      if (detailsData.Data?.DocumentDownloadURL) {
        pdfUrl = detailsData.Data.DocumentDownloadURL;

        // Cache the URL
        await supabase
          .from(tableName)
          .update({ document_url: pdfUrl })
          .eq('id', purchaseId);
      } else {
        // Fallback to getpdf API for base64 content
        const pdfResponse = await fetch('https://api.sumit.co.il/accounting/documents/getpdf/', {
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

        const pdfData = await pdfResponse.json();
        if (pdfData.Data?.FileContent) {
          pdfBase64 = pdfData.Data.FileContent;
        } else if (pdfData.Data?.URL) {
          pdfUrl = pdfData.Data.URL;
        }
      }
    }

    // If still no document, try to find it from Sumit by matching
    if (!pdfUrl && !pdfBase64 && !purchase.document_id) {
      console.log('No document_id, searching in Sumit...');
      
      const purchaseDate = new Date(purchase.created_at);
      const dateFrom = new Date(purchaseDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dateTo = new Date(purchaseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const listResponse = await fetch('https://api.sumit.co.il/accounting/documents/list/', {
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

      const listData = await listResponse.json();

      if (listData.Data?.Documents?.length > 0) {
        const matchingDoc = listData.Data.Documents.find((doc: any) =>
          doc.DocumentValue === purchase.amount || doc.CompanyValue === purchase.amount
        );

        if (matchingDoc) {
          console.log('Found matching document:', matchingDoc.DocumentID);
          pdfUrl = matchingDoc.DocumentDownloadURL;

          // Save for next time
          await supabase
            .from(tableName)
            .update({
              document_id: matchingDoc.DocumentID.toString(),
              document_url: matchingDoc.DocumentDownloadURL
            })
            .eq('id', purchaseId);
        }
      }
    }

    if (!pdfUrl && !pdfBase64) {
      console.log('No invoice document found yet, skipping email');
      return new Response(
        JSON.stringify({ success: false, message: 'Invoice not ready yet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the date
    const purchaseDate = new Date(purchase.created_at);
    const formattedDate = purchaseDate.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build email content
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; direction: rtl; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #742551; }
          .logo { font-size: 28px; font-weight: bold; color: #742551; }
          .content { padding: 30px 0; }
          .amount { font-size: 24px; color: #215F66; font-weight: bold; margin: 20px 0; }
          .button { display: inline-block; background: linear-gradient(180deg, #215F66 0%, #742551 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin-top: 20px; }
          .footer { text-align: center; padding-top: 30px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FreeSol</div>
          </div>
          <div class="content">
            <h2>שלום ${profile.full_name || 'לקוח יקר'},</h2>
            <p>תודה על הרכישה שלך ב-FreeSol!</p>
            <p>מצורפת החשבונית עבור הרכישה מתאריך ${formattedDate}.</p>
            <div class="amount">סכום: ₪${purchase.amount}</div>
            ${pdfUrl ? `<a href="${pdfUrl}" class="button">צפייה בחשבונית</a>` : '<p>החשבונית מצורפת לאימייל זה.</p>'}
          </div>
          <div class="footer">
            <p>FreeSol - אולפן הקלטות</p>
            <p>נשמח לראותך שוב!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Build email request
    const emailPayload: any = {
      from: 'FreeSol <noreply@freesol.co.il>',
      to: [profile.email],
      subject: `חשבונית מ-FreeSol - ${formattedDate}`,
      html: emailHtml,
    };

    // If we have base64 PDF, attach it
    if (pdfBase64) {
      emailPayload.attachments = [{
        filename: `invoice-${purchaseId.slice(0, 8)}.pdf`,
        content: pdfBase64,
      }];
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const emailResult = await emailResponse.json();
    console.log('Email sent result:', emailResult);

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${JSON.stringify(emailResult)}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Invoice email sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
