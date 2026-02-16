import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginRequest {
  customerNumber: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customerNumber }: LoginRequest = await req.json();

    // Validate customer number
    if (!customerNumber || customerNumber.length !== 5) {
      return new Response(
        JSON.stringify({ error: "נא להזין מספר לקוח בן 5 ספרות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find customer by customer_number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .eq("customer_number", customerNumber)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "מספר לקוח לא נמצא" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link / session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (sessionError) {
      console.error("Error generating session:", sessionError);
      return new Response(
        JSON.stringify({ error: "שגיאה בהתחברות" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: profile.user_id,
        name: profile.full_name,
        email: profile.email,
        token: sessionData.properties?.hashed_token,
        actionLink: sessionData.properties?.action_link
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in login-customer:", error);
    return new Response(
      JSON.stringify({ error: "שגיאה בלתי צפויה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
