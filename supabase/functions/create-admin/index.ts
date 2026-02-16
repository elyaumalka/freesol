import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Use service role to manage users
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Handle password update action
    if (action === 'update-password') {
      const { userId, password } = body;
      
      if (!userId || !password) {
        return new Response(
          JSON.stringify({ error: "Missing userId or password" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Updating password for user:", userId);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: create admin user
    const { email, password, fullName, secret } = body;

    // Simple secret check to prevent unauthorized admin creation
    if (secret !== "freesol-admin-setup-2024") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating admin user:", email);

    // Create the user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (userError) {
      console.error("Error creating user:", userError);
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log("User created with ID:", userId);

    // Update the role to admin (the trigger already created a 'customer' role)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", userId);

    if (roleError) {
      console.error("Error updating role:", roleError);
      return new Response(
        JSON.stringify({ error: roleError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin role assigned successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin user created successfully",
        userId 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
