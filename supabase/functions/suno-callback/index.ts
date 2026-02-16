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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callbackData = await req.json();
    console.log("Suno callback received:", JSON.stringify(callbackData));

    // Handle the callback format from Suno API
    // Format: { code: 200, data: { callbackType: "text"|"first"|"complete", data: [...], task_id: "..." }, msg: "..." }
    const { code, data: responseData, msg } = callbackData;
    
    if (code !== 200) {
      console.error("Suno callback error:", msg);
      return new Response(JSON.stringify({ received: true, error: msg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { callbackType, data: tracks, task_id } = responseData || {};
    
    if (!task_id) {
      console.error("No task_id in callback");
      return new Response(JSON.stringify({ received: true, error: "No task_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Callback type: ${callbackType}, Task ID: ${task_id}`);

    // First, get the existing record to get vocals_url
    const { data: existingTask } = await supabaseAdmin
      .from('suno_tasks')
      .select('*')
      .eq('task_id', task_id)
      .single();

    const vocalsUrl = existingTask?.callback_data?.vocals_url;
    console.log(`Existing vocals URL: ${vocalsUrl}`);

    // Determine status based on callback type
    let status = "processing";
    let audioUrl = null;
    let streamAudioUrl = null;
    let imageUrl = null;
    let title = null;
    let tags = null;

    if (callbackType === "complete") {
      // Suno returns multiple tracks - pick the one with audio_url
      if (tracks && Array.isArray(tracks) && tracks.length > 0) {
        console.log(`Received ${tracks.length} tracks from Suno`);
        
        let selectedTrack = tracks[0];
        
        // Find the track with a complete audio_url
        for (const track of tracks) {
          console.log(`Track ${track.id}: audio_url=${track.audio_url ? 'yes' : 'no'}`);
          if (track.audio_url) {
            selectedTrack = track;
            break;
          }
        }
        
        audioUrl = selectedTrack.audio_url || null;
        streamAudioUrl = selectedTrack.stream_audio_url || null;
        imageUrl = selectedTrack.image_url || null;
        title = selectedTrack.title || null;
        tags = selectedTrack.tags || null;
        
        console.log(`Selected track: ${selectedTrack.id}, instrumentalUrl: ${audioUrl}`);
        
        // Only mark as complete if we have the final audio_url
        if (audioUrl) {
          status = "complete";
        }
      }
    } else if (callbackType === "text") {
      status = "processing";
      if (tracks && Array.isArray(tracks) && tracks.length > 0) {
        const firstTrack = tracks[0];
        streamAudioUrl = firstTrack.stream_audio_url || null;
        imageUrl = firstTrack.image_url || null;
        title = firstTrack.title || null;
        tags = firstTrack.tags || null;
      }
    } else if (callbackType === "first") {
      status = "processing";
      if (tracks && Array.isArray(tracks) && tracks.length > 0) {
        const firstTrack = tracks[0];
        streamAudioUrl = firstTrack.stream_audio_url || null;
        imageUrl = firstTrack.image_url || null;
        title = firstTrack.title || null;
        tags = firstTrack.tags || null;
      }
    } else if (callbackType === "error") {
      status = "error";
    }

    console.log(`Updating task ${task_id} with status: ${status}, instrumentalUrl: ${audioUrl}`);

    // Merge callback data with existing, preserving vocals_url
    const mergedCallbackData = {
      ...callbackData,
      vocals_url: vocalsUrl, // Preserve the vocals URL
      instrumental_url: audioUrl, // Store the instrumental URL
    };

    // Update the suno_tasks table
    const { error: updateError } = await supabaseAdmin
      .from('suno_tasks')
      .update({
        status,
        audio_url: audioUrl,
        stream_audio_url: streamAudioUrl,
        image_url: imageUrl,
        title,
        tags,
        callback_data: mergedCallbackData,
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', task_id);

    if (updateError) {
      console.error("Error updating suno_tasks:", updateError);
      // Try to insert if update failed (task might not exist yet)
      const { error: insertError } = await supabaseAdmin
        .from('suno_tasks')
        .insert({
          task_id,
          user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
          status,
          audio_url: audioUrl,
          stream_audio_url: streamAudioUrl,
          image_url: imageUrl,
          title,
          tags,
          callback_data: callbackData,
        });
      
      if (insertError) {
        console.error("Error inserting suno_tasks:", insertError);
      }
    }

    return new Response(JSON.stringify({ received: true, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in suno-callback:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
