import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    console.log("RoEx webhook received:", JSON.stringify(body));

    // Extract task ID and result URL from webhook payload
    const taskId = body.multitrack_task_id || body.task_id || body.mastering_task_id;
    const outputUrl = body.preview_mix_url || body.result_url || body.output_url || body.mastered_track_url || body.mixed_track_url;
    const error = body.error ? (body.message || "Processing failed") : null;

    if (!taskId) {
      console.log("No task ID in webhook, ignoring");
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the task in DB
    const updateData: Record<string, any> = {
      webhook_data: body,
      updated_at: new Date().toISOString(),
    };

    if (error) {
      updateData.status = "failed";
      updateData.error = error;
    } else if (outputUrl) {
      // Download and re-upload to permanent storage
      const { data: taskData } = await supabaseAdmin
        .from("roex_tasks")
        .select("user_id, project_name, mode")
        .eq("task_id", taskId)
        .single();

      if (taskData) {
        try {
          console.log("Downloading RoEx output:", outputUrl);
          const dlResponse = await fetch(outputUrl);
          if (!dlResponse.ok) throw new Error(`Download failed: ${dlResponse.status}`);

          const arrayBuffer = await dlResponse.arrayBuffer();
          const fileData = new Uint8Array(arrayBuffer);
          console.log(`Downloaded ${fileData.length} bytes`);

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const sanitizedName = (taskData.project_name || "mixed")
            .replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "mixed";
          const suffix = taskData.mode === "mastering" ? "mastered" : "mixed";
          const storagePath = `roex/${taskData.user_id}/${sanitizedName}_${suffix}_${timestamp}_${randomId}.wav`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("recordings")
            .upload(storagePath, fileData, { contentType: "audio/wav", upsert: true });

          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

          const { data: publicUrlData } = supabaseAdmin.storage
            .from("recordings")
            .getPublicUrl(storagePath);

          updateData.status = "succeeded";
          updateData.output_url = publicUrlData.publicUrl;
          console.log("Permanent URL:", publicUrlData.publicUrl);
        } catch (dlErr) {
          console.error("Re-upload failed, using RoEx URL:", dlErr);
          updateData.status = "succeeded";
          updateData.output_url = outputUrl;
        }
      } else {
        updateData.status = "succeeded";
        updateData.output_url = outputUrl;
      }
    }

    const { error: dbError } = await supabaseAdmin
      .from("roex_tasks")
      .update(updateData)
      .eq("task_id", taskId);

    if (dbError) {
      console.error("DB update error:", dbError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
