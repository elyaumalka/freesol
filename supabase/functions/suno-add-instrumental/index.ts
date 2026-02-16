import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUNO_API_URL = "https://api.sunoapi.org/api/v1/generate/add-instrumental";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
    if (!SUNO_API_KEY) {
      throw new Error("SUNO_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { 
      uploadUrl, 
      title, 
      tags, 
      negativeTags,
      vocalGender = "m",
      styleWeight = 0.6,
      audioWeight = 0.65,
      weirdnessConstraint = 0.5,
      model = "V4_5PLUS",
      projectId
    } = await req.json();

    if (!uploadUrl || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields: uploadUrl and title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build callback URL for Suno to notify us when done
    const callBackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;

    // Call Suno Add Instrumental API
    const sunoResponse = await fetch(SUNO_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadUrl,
        title,
        tags: tags || "Acoustic, Melodic, Warm, Traditional",
        negativeTags: negativeTags || "Heavy Metal, Electronic, Aggressive",
        callBackUrl,
        vocalGender,
        styleWeight,
        weirdnessConstraint,
        audioWeight,
        model,
      }),
    });

    if (!sunoResponse.ok) {
      const errorText = await sunoResponse.text();
      console.error("Suno API error:", sunoResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to call Suno API", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sunoData = await sunoResponse.json();
    console.log("Suno API response:", sunoData);

    const taskId = sunoData.data?.taskId;

    // Store the task in suno_tasks for tracking
    if (taskId) {
      const { error: insertError } = await supabaseAdmin
        .from('suno_tasks')
        .insert({
          task_id: taskId,
          user_id: userId,
          status: 'pending',
          title: title,
          tags: tags || "Acoustic, Melodic, Warm, Traditional",
          callback_data: {
            flow_type: 'add-instrumental',
          },
        });

      if (insertError) {
        console.error("Error inserting suno_task:", insertError);
      } else {
        console.log(`Created suno_task record for task: ${taskId}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      message: "Instrumental generation started"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in suno-add-instrumental:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
