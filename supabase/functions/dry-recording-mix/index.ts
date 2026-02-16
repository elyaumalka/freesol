import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MixRequest {
  vocalUrl: string;
  instrumentalUrl: string;
  offsetMs?: number;
  vocalGain?: number;
  instrumentalGain?: number;
}

// Helper to download file from URL
async function downloadFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${url} (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Helper to upload file to storage
async function uploadToStorage(
  supabase: any,
  bucket: string,
  path: string,
  data: Uint8Array,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, data, { contentType, upsert: true });
  
  if (error) throw new Error(`Upload failed: ${error.message}`);
  
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return urlData.publicUrl;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json() as MixRequest;
    const {
      vocalUrl,
      instrumentalUrl,
      offsetMs = 0,
      vocalGain = 1.5,
      instrumentalGain = 0.55,
    } = body;

    if (!vocalUrl || !instrumentalUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing vocalUrl or instrumentalUrl' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Mixing audio:', {
      vocalUrl: vocalUrl.substring(0, 50) + '...',
      instrumentalUrl: instrumentalUrl.substring(0, 50) + '...',
      offsetMs,
      vocalGain,
      instrumentalGain,
    });

    // Download both audio files
    console.log('Downloading audio files...');
    const [vocalData, instrumentalData] = await Promise.all([
      downloadFile(vocalUrl),
      downloadFile(instrumentalUrl),
    ]);

    console.log('Audio files downloaded:', {
      vocalSize: vocalData.length,
      instrumentalSize: instrumentalData.length,
    });

    // Create temporary files
    const tempDir = await Deno.makeTempDir();
    const vocalPath = `${tempDir}/vocal.wav`;
    const instrumentalPath = `${tempDir}/instrumental.wav`;
    const outputPath = `${tempDir}/output.wav`;

    await Deno.writeFile(vocalPath, vocalData);
    await Deno.writeFile(instrumentalPath, instrumentalData);

    // Calculate offset in FFmpeg format (in seconds)
    const offsetSec = offsetMs / 1000;

    // Build FFmpeg command
    // adelay: delay the audio by offsetMs
    // volume filter: apply gain to both tracks
    const ffmpegCmd = [
      'ffmpeg',
      '-i', instrumentalPath,
      '-i', vocalPath,
      '-filter_complex',
      `[0]volume=${instrumentalGain}[inst];[1]adelay=${Math.max(0, offsetMs)}|${Math.max(0, offsetMs)},volume=${vocalGain}[vocal];[inst][vocal]amix=inputs=2:duration=longest[a]`,
      '-map', '[a]',
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      outputPath,
    ];

    console.log('Running FFmpeg command...');
    const process = Deno.run({
      cmd: ffmpegCmd,
      stdout: 'piped',
      stderr: 'piped',
    });

    const { success } = await process.status();
    
    if (!success) {
      const stderr = new TextDecoder().decode(await process.stderrOutput());
      console.error('FFmpeg error:', stderr);
      throw new Error('FFmpeg failed: ' + stderr.substring(0, 200));
    }

    // Read the output file
    console.log('Reading output file...');
    const mixedData = await Deno.readFile(outputPath);

    // Upload to storage
    console.log('Uploading mixed audio to storage...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const timestamp = Date.now();
    const storagePath = `mixed/${timestamp}_mixed.wav`;
    const publicUrl = await uploadToStorage(
      supabase,
      'recordings',
      storagePath,
      new Uint8Array(mixedData),
      'audio/wav'
    );

    console.log('Mix completed successfully:', publicUrl);

    // Cleanup
    await Deno.remove(tempDir, { recursive: true });

    return new Response(
      JSON.stringify({
        success: true,
        mixedUrl: publicUrl,
        message: 'Audio mixed successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in dry-recording-mix:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
