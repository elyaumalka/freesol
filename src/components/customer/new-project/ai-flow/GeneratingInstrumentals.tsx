import { useEffect, useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { useMusicGenRemixer } from "@/hooks/useMusicGenRemixer";
import { toast } from "sonner";
import { Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GeneratingInstrumentalsProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onComplete: () => void;
  onError: () => void;
}

export function GeneratingInstrumentals({
  projectData,
  updateProjectData,
  onComplete,
  onError,
}: GeneratingInstrumentalsProps) {
  const [statusMessage, setStatusMessage] = useState("מכין את ההקלטות...");
  const [hasStarted, setHasStarted] = useState(false);
  const { startGeneration, pollForCompletion } = useMusicGenRemixer();

  useEffect(() => {
    if (hasStarted) return;
    setHasStarted(true);

    const generateMusic = async () => {
      try {
        // Get all sections with recordings
        const sectionsWithRecordings = projectData.verses
          .filter(v => v.audioUrl)
          .map(v => v.audioUrl as string);

        if (sectionsWithRecordings.length === 0) {
          toast.error("אין הקלטות לעיבוד");
          onError();
          return;
        }

        setStatusMessage("מעלה את ההקלטות...");

        // First, merge all audio URLs into one file and upload
        const mergedAudioUrl = await mergeAndUploadAudio(sectionsWithRecordings);
        
        if (!mergedAudioUrl) {
          toast.error("שגיאה באיחוד ההקלטות");
          onError();
          return;
        }

        setStatusMessage("יוצר מוזיקה סביב הקול שלך...");

        // Build prompt from music style
        const stylePrompt = projectData.musicStyleTags || "Jewish music, melodic, warm, acoustic";
        
        // Start generation with MusicGen Remixer
        const predictionId = await startGeneration({
          audioUrl: mergedAudioUrl,
          prompt: stylePrompt,
          returnInstrumental: true,
        });

        if (!predictionId) {
          toast.error("שגיאה בהתחלת יצירת המוזיקה");
          onError();
          return;
        }

        setStatusMessage("MusicGen Remixer יוצר מוזיקה... (עד 7 דקות)");

        // Poll for completion - don't show raw progress logs
        pollForCompletion(
          predictionId,
          (audioUrl, instrumentalUrl) => {
            console.log("Music generation complete:", { audioUrl, instrumentalUrl });
            
            // Update project data with the generated song
            updateProjectData({ 
              generatedSongUrl: audioUrl,
              instrumentalUrl: instrumentalUrl,
              originalVocalsUrl: mergedAudioUrl,
            });

            toast.success("המוזיקה נוצרה בהצלחה!");
            onComplete();
          },
          (error) => {
            console.error("Generation error:", error);
            toast.error(error);
            onError();
          },
          // Don't show raw progress - it contains technical logs
          undefined
        );
      } catch (error: any) {
        console.error("Error generating music:", error);
        toast.error(error.message || "שגיאה ביצירת המוזיקה");
        onError();
      }
    };

    generateMusic();
  }, [hasStarted, projectData, startGeneration, pollForCompletion, updateProjectData, onComplete, onError]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
      {/* Main Text */}
      <p 
        className="text-[24px] text-[#D4A853] mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        אנחנו יוצרים בשבילך את הפלייבק המושלם
      </p>

      {/* Loading Dots Animation */}
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div 
            key={i}
            className="w-2 h-2 rounded-full bg-[#D4A853] animate-pulse"
            style={{ 
              animationDelay: `${i * 100}ms`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Helper function to merge audio files and upload as WAV
async function mergeAndUploadAudio(audioUrls: string[]): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error("יש להתחבר למערכת");
    }

    // Create audio context for processing
    const audioContext = new AudioContext();
    const audioBuffers: AudioBuffer[] = [];

    // Download and decode all audio files
    for (const url of audioUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffers.push(audioBuffer);
        }
      } catch (err) {
        console.error("Error loading audio:", url, err);
      }
    }

    if (audioBuffers.length === 0) {
      return null;
    }

    // Calculate total duration
    const totalDuration = audioBuffers.reduce((sum, buf) => sum + buf.duration, 0);
    const sampleRate = audioBuffers[0].sampleRate;
    const numberOfChannels = Math.max(...audioBuffers.map(b => b.numberOfChannels));

    // Create merged buffer
    const mergedBuffer = audioContext.createBuffer(
      numberOfChannels,
      Math.ceil(totalDuration * sampleRate),
      sampleRate
    );

    // Copy audio data
    let offset = 0;
    for (const buffer of audioBuffers) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = channel < buffer.numberOfChannels 
          ? buffer.getChannelData(channel) 
          : buffer.getChannelData(0);
        mergedBuffer.getChannelData(channel).set(channelData, offset);
      }
      offset += buffer.length;
    }

    // Convert to WAV format (better compatibility with MusicGen)
    const wavBlob = audioBufferToWav(mergedBuffer);
    
    // Upload to Supabase Storage
    const fileName = `merged-vocals-${Date.now()}.wav`;
    const { data, error } = await supabase.storage
      .from('recordings')
      .upload(fileName, wavBlob, {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(fileName);

    await audioContext.close();
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error merging audio:", error);
    return null;
  }
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write audio data
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
