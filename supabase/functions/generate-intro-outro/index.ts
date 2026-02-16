import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Using Suno's generate endpoint to create intro and outro
const SUNO_API_URL = "https://api.sunoapi.org/api/v1/generate";

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
      title,
      tags,
      type, // 'intro' or 'outro'
      duration = 10, // seconds
    } = await req.json();

    if (!title || !type) {
      return new Response(JSON.stringify({ error: "Missing required fields: title and type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build callback URL
    const callBackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;

    // Create prompt for intro/outro
    const prompt = type === 'intro' 
      ? `[Instrumental intro] ${tags || 'Melodic, Warm'} intro music, building up energy`
      : `[Instrumental outro] ${tags || 'Melodic, Warm'} outro music, fading out peacefully`;

    console.log(`Generating ${type} for "${title}" with prompt: ${prompt}`);

    // Call Suno Generate API for instrumental
    const sunoResponse = await fetch(SUNO_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        tags: tags || "Instrumental, Melodic, Warm",
        title: `${title} - ${type === 'intro' ? 'Intro' : 'Outro'}`,
        instrumental: true, // Make it instrumental only
        callBackUrl,
        model: "V4_5",
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
          title: `${title} - ${type}`,
          tags: tags,
          callback_data: {
            flow_type: `generate-${type}`,
            section_type: type,
          },
        });

      if (insertError) {
        console.error("Error inserting suno_task:", insertError);
      } else {
        console.log(`Created suno_task record for ${type}: ${taskId}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      type,
      message: `${type} generation started`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in generate-intro-outro:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
