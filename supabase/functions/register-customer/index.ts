import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterRequest {
  name: string;
  phone: string;
  email?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { name, phone, email }: RegisterRequest = await req.json();

    // Validate required fields
    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: "נא למלא שם ומספר טלפון" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if phone already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("customer_number")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "מספר טלפון זה כבר רשום במערכת" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique customer number
    const { data: customerNumber, error: genError } = await supabase
      .rpc("generate_customer_number");

    if (genError) {
      console.error("Error generating customer number:", genError);
      return new Response(
        JSON.stringify({ error: "שגיאה ביצירת מספר לקוח" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new auth user with a random password (user won't use it)
    const randomPassword = crypto.randomUUID();
    const userEmail = email || `${phone}@freesol.local`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        phone: phone,
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return new Response(
        JSON.stringify({ error: "שגיאה ביצירת משתמש" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the profile with customer_number and phone
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        customer_number: customerNumber,
        phone: phone,
        full_name: name,
        email: email || userEmail,
      })
      .eq("user_id", authData.user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
    }

    // Create customer_hours record
    await supabase
      .from("customer_hours")
      .insert({
        user_id: authData.user.id,
        total_hours: 0,
        used_hours: 0,
      });

    // Generate a magic link for automatic login
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkError) {
      console.error("Error generating magic link:", linkError);
    }

    console.log("Link data properties:", linkData?.properties);

    return new Response(
      JSON.stringify({ 
        success: true, 
        customerNumber: customerNumber,
        userId: authData.user.id,
        // Return the OTP token for automatic login (not hashed_token!)
        emailOtp: linkData?.properties?.email_otp,
        email: userEmail
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in register-customer:", error);
    return new Response(
      JSON.stringify({ error: "שגיאה בלתי צפויה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
