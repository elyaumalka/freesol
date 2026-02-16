import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecoverRequest {
  type: "phone" | "email";
  value: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, value }: RecoverRequest = await req.json();

    if (!type || !value) {
      return new Response(
        JSON.stringify({ error: "נא למלא את כל השדות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find customer by phone or email
    let query = supabase
      .from("profiles")
      .select("customer_number, full_name");

    if (type === "phone") {
      query = query.eq("phone", value);
    } else {
      query = query.eq("email", value);
    }

    const { data: profile, error: profileError } = await query.maybeSingle();

    if (profileError || !profile || !profile.customer_number) {
      return new Response(
        JSON.stringify({ error: "לא נמצא משתמש עם פרטים אלו" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        customerNumber: profile.customer_number,
        name: profile.full_name
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in recover-customer-number:", error);
    return new Response(
      JSON.stringify({ error: "שגיאה בלתי צפויה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
