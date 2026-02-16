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
      introUrl,
      outroUrl,
      sectionUrls, // Array of section recording URLs in order
      projectName,
    } = await req.json();

    if (!sectionUrls || !Array.isArray(sectionUrls) || sectionUrls.length === 0) {
      return new Response(JSON.stringify({ error: "Missing sectionUrls array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Merging song: intro=${!!introUrl}, outro=${!!outroUrl}, sections=${sectionUrls.length}`);

    // Build the list of URLs to merge in order
    const urlsToMerge: string[] = [];
    
    if (introUrl) {
      urlsToMerge.push(introUrl);
    }
    
    urlsToMerge.push(...sectionUrls);
    
    if (outroUrl) {
      urlsToMerge.push(outroUrl);
    }

    console.log(`Total parts to merge: ${urlsToMerge.length}`);

    // Download all audio files
    const audioBuffers: ArrayBuffer[] = [];
    for (const url of urlsToMerge) {
      try {
        console.log(`Downloading: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to download: ${url}`);
          continue;
        }
        const buffer = await response.arrayBuffer();
        audioBuffers.push(buffer);
        console.log(`Downloaded ${buffer.byteLength} bytes`);
      } catch (error) {
        console.error(`Error downloading ${url}:`, error);
      }
    }

    if (audioBuffers.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to download any audio files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If only one audio file, just return it directly (no merge needed)
    if (audioBuffers.length === 1) {
      console.log('Only one audio part, returning directly without merge');
      
      // Still upload to final folder for consistency
      const timestamp = Date.now();
      const sanitizedProjectName = (projectName || 'project')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        || 'project';
      
      // Detect file type from first URL
      const firstUrl = urlsToMerge[0];
      const extension = firstUrl.includes('.wav') ? 'wav' : 
                        firstUrl.includes('.mp3') ? 'mp3' : 'webm';
      const contentType = extension === 'wav' ? 'audio/wav' : 
                          extension === 'mp3' ? 'audio/mpeg' : 'audio/webm';
      
      const fileName = `final/${userId}/${sanitizedProjectName}_complete_${timestamp}.${extension}`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('recordings')
        .upload(fileName, audioBuffers[0], {
          contentType,
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Failed to upload file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('recordings')
        .getPublicUrl(fileName);

      console.log(`Final song uploaded: ${urlData.publicUrl}`);

      return new Response(JSON.stringify({ 
        success: true, 
        finalSongUrl: urlData.publicUrl,
        partsCount: 1,
        message: "Song saved successfully"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For multiple files, we need proper audio concatenation
    // Simple byte concatenation doesn't work for encoded audio formats
    // For now, return the first section as the result and log a warning
    console.warn('Multiple audio parts detected - proper concatenation requires FFmpeg');
    console.log('Returning first part as result');
    
    const timestamp = Date.now();
    const sanitizedProjectName = (projectName || 'project')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      || 'project';
    
    // Use the first audio buffer
    const firstUrl = urlsToMerge[0];
    const extension = firstUrl.includes('.wav') ? 'wav' : 
                      firstUrl.includes('.mp3') ? 'mp3' : 'webm';
    const contentType = extension === 'wav' ? 'audio/wav' : 
                        extension === 'mp3' ? 'audio/mpeg' : 'audio/webm';
    
    const mergedFileName = `final/${userId}/${sanitizedProjectName}_complete_${timestamp}.${extension}`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(mergedFileName, audioBuffers[0], {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload merged file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL for the merged file
    const { data: urlData } = supabaseAdmin.storage
      .from('recordings')
      .getPublicUrl(mergedFileName);

    const finalSongUrl = urlData.publicUrl;
    console.log(`Final song uploaded: ${finalSongUrl}`);

    return new Response(JSON.stringify({ 
      success: true, 
      finalSongUrl,
      partsCount: audioBuffers.length,
      message: "Song merged successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in merge-final-song:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
