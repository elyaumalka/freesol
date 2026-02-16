import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendPlaybackRequest {
  email: string;
  audioUrl: string;
  songName: string;
  customerName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { email, audioUrl, songName, customerName }: SendPlaybackRequest = await req.json();

    // Validate required fields
    if (!email || !audioUrl || !songName) {
      throw new Error('Missing required fields: email, audioUrl, or songName');
    }

    console.log('Sending playback email to:', email, 'Song:', songName);

    // Send email with download link instead of attachment (to avoid memory limits)
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FreeSol <noreply@freesol.co.il>',
        to: [email],
        subject: `🎵 ההקלטה שלך מוכנה: ${songName}`,
        html: `
          <!DOCTYPE html>
          <html dir="rtl" lang="he">
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 32px; color: #742551; font-weight: bold; }
              h1 { color: #742551; font-size: 24px; text-align: center; }
              p { color: #333; font-size: 16px; line-height: 1.6; }
              .highlight { color: #215F66; font-weight: bold; }
              .button-container { text-align: center; margin: 30px 0; }
              .download-button {
                display: inline-block;
                background: linear-gradient(135deg, #742551, #D4A853);
                color: white !important;
                text-decoration: none;
                padding: 16px 40px;
                border-radius: 30px;
                font-size: 18px;
                font-weight: bold;
                box-shadow: 0 4px 15px rgba(116, 37, 81, 0.3);
              }
              .download-button:hover {
                opacity: 0.9;
              }
              .note { 
                background: #f8f4e8; 
                padding: 15px 20px; 
                border-radius: 10px; 
                margin: 20px 0;
                border-right: 4px solid #D4A853;
              }
              .footer { 
                text-align: center; 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #eee; 
                color: #888; 
                font-size: 14px; 
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🎤 FreeSol</div>
              </div>
              <h1>🎉 ההקלטה שלך מוכנה!</h1>
              <p>היי${customerName ? ` ${customerName}` : ''},</p>
              <p>ההקלטה שלך לשיר <span class="highlight">"${songName}"</span> מוכנה להורדה.</p>
              
              <div class="button-container">
                <a href="${audioUrl}" class="download-button" target="_blank">
                  ⬇️ הורד את ההקלטה
                </a>
              </div>
              
              <div class="note">
                <strong>💡 שים לב:</strong> לחץ על הכפתור כדי להוריד את הקובץ למחשב שלך. הקישור פעיל ומוכן להורדה.
              </div>
              
              <p>תודה שהשתמשת ב-FreeSol! 🎵</p>
              
              <div class="footer">
                <p>© FreeSol - אולפן הקלטות עצמאי</p>
                <p style="font-size: 12px; color: #aaa;">לא מצליח ללחוץ על הכפתור? העתק את הקישור הבא לדפדפן:</p>
                <p style="font-size: 11px; color: #aaa; word-break: break-all;">${audioUrl}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend API error:', emailResult);
      throw new Error(emailResult.message || 'Failed to send email');
    }

    console.log('Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResult.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error sending playback email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
