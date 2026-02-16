import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");

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

    const { taskId } = await req.json();

    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Checking status for task: ${taskId}`);

    // First check our database
    const { data: taskData, error: taskError } = await supabaseAdmin
      .from('suno_tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    // If task is already complete in our DB, return it
    if (taskData && taskData.status === "complete" && taskData.audio_url) {
      console.log("Task already complete in DB");
      const vocalsUrl = taskData.callback_data?.original_vocals_url || null;
      return new Response(JSON.stringify({
        status: "complete",
        vocalsUrl: vocalsUrl,
        instrumentalUrl: taskData.audio_url,
        audioUrl: taskData.audio_url,
        streamAudioUrl: taskData.stream_audio_url,
        imageUrl: taskData.image_url,
        title: taskData.title,
        tags: taskData.tags,
        error: taskData.error,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If task is still pending/processing, poll Suno API directly
    if (SUNO_API_KEY) {
      console.log("Polling Suno API directly for status...");
      
      try {
        const sunoResponse = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${SUNO_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (sunoResponse.ok) {
          const sunoData = await sunoResponse.json();
          console.log("Suno API direct response:", JSON.stringify(sunoData));
          
          if (sunoData.code === 200 && sunoData.data) {
            const responseData = sunoData.data;
            const taskStatus = responseData.status; // "SUCCESS", "PENDING", "FAILED"
            
            // Check if we have error status
            if (taskStatus === "FAILED" || responseData.errorMessage) {
              console.log("Suno task failed:", responseData.errorMessage);
              
              // Update DB with error
              await supabaseAdmin
                .from('suno_tasks')
                .update({
                  status: "error",
                  error: responseData.errorMessage || "Suno processing failed",
                  updated_at: new Date().toISOString(),
                })
                .eq('task_id', taskId);
              
              return new Response(JSON.stringify({
                status: "error",
                error: responseData.errorMessage || "Suno processing failed",
              }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            
            // Check if complete - response.sunoData contains the tracks
            if (taskStatus === "SUCCESS" && responseData.response?.sunoData) {
              const tracks = responseData.response.sunoData;
              
              if (Array.isArray(tracks) && tracks.length > 0) {
                const track = tracks[0];
                
                if (track.audioUrl) {
                  console.log("Found complete track with audioUrl:", track.audioUrl);
                  
                  // Update DB with complete status
                  const vocalsUrl = taskData?.callback_data?.original_vocals_url || null;
                  
                  await supabaseAdmin
                    .from('suno_tasks')
                    .update({
                      status: "complete",
                      audio_url: track.audioUrl,
                      stream_audio_url: track.streamAudioUrl,
                      image_url: track.imageUrl,
                      title: track.title,
                      tags: track.tags,
                      callback_data: {
                        ...taskData?.callback_data,
                        instrumental_url: track.audioUrl,
                      },
                      updated_at: new Date().toISOString(),
                    })
                    .eq('task_id', taskId);
                  
                  return new Response(JSON.stringify({
                    status: "complete",
                    vocalsUrl: vocalsUrl,
                    instrumentalUrl: track.audioUrl,
                    audioUrl: track.audioUrl,
                    streamAudioUrl: track.streamAudioUrl,
                    imageUrl: track.imageUrl,
                    title: track.title,
                    tags: track.tags,
                  }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }
            }
            
            // Still processing
            if (taskStatus === "PENDING") {
              console.log("Task still pending");
              return new Response(JSON.stringify({
                status: "processing",
              }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } else {
          const errorText = await sunoResponse.text();
          console.error("Suno API error:", sunoResponse.status, errorText);
          
          // If Suno returns 500, report it
          if (sunoResponse.status === 500) {
            return new Response(JSON.stringify({
              status: "error",
              error: "Suno API internal error. Please try again later.",
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (pollError) {
        console.error("Error polling Suno:", pollError);
        // Continue with DB status
      }
    }

    // Return pending status if we couldn't get complete status
    const vocalsUrl = taskData?.callback_data?.original_vocals_url || null;
    
    return new Response(JSON.stringify({
      status: taskData?.status || "pending",
      vocalsUrl: vocalsUrl,
      instrumentalUrl: taskData?.audio_url || null,
      audioUrl: taskData?.audio_url || null,
      streamAudioUrl: taskData?.stream_audio_url,
      imageUrl: taskData?.image_url,
      title: taskData?.title,
      tags: taskData?.tags,
      error: taskData?.error,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in suno-check-status:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
