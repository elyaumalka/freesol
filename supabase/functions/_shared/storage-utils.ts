import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Downloads a file from a URL and uploads it to Supabase Storage
 * Returns a permanent public URL
 */
export async function downloadAndUploadToStorage(
  sourceUrl: string,
  bucketName: string,
  filePath: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Downloading file from: ${sourceUrl}`);

  // Download the file
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const arrayBuffer = await response.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  console.log(`Downloaded ${fileData.length} bytes, uploading to ${bucketName}/${filePath}`);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileData, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  console.log(`File uploaded successfully: ${publicUrlData.publicUrl}`);

  return publicUrlData.publicUrl;
}

/**
 * Check if a URL is from Replicate (temporary URL that will expire)
 */
export function isReplicateUrl(url: string): boolean {
  return url.includes("replicate.delivery") || url.includes("replicate.com");
}

/**
 * Generate a unique file path for storage
 */
export function generateStoragePath(prefix: string, extension: string = "mp3"): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `${prefix}/${timestamp}_${randomId}.${extension}`;
}
