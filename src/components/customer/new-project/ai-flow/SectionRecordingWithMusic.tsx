import { useState, useEffect, useRef, useCallback } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { ArrowRight, Mic, Square, Play, Pause, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProMicrophone } from "@/hooks/useProMicrophone";
import { MicSettingsPanel } from "@/components/customer/new-project/MicSettingsPanel";

interface SectionRecordingWithMusicProps {
  projectData: ProjectData;
  sectionIndex: number;
  onFinish: (sectionIndex: number, recordingUrl: string) => void;
  onBack: () => void;
}

export function SectionRecordingWithMusic({
  projectData,
  sectionIndex,
  onFinish,
  onBack,
}: SectionRecordingWithMusicProps) {
  // Pro microphone hook
  const proMic = useProMicrophone({ defaultGain: 2.5, enableCompressor: true });
  
  const verse = projectData.verses[sectionIndex];
  const instrumentalUrl = (verse as any)?.instrumentalUrl;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Get verse label
  const getVerseLabel = () => {
    if (verse.type === 'chorus') {
      const chorusCount = projectData.verses.slice(0, sectionIndex + 1).filter(v => v.type === 'chorus').length;
      return `פזמון ${chorusCount === 1 ? 'ראשון' : chorusCount === 2 ? 'שני' : chorusCount}`;
    }
    const verseCount = projectData.verses.slice(0, sectionIndex + 1).filter(v => v.type === 'verse').length;
    return `בית ${verseCount === 1 ? 'ראשון' : verseCount === 2 ? 'שני' : verseCount}`;
  };

  // Load instrumental audio
  useEffect(() => {
    if (instrumentalUrl) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = instrumentalUrl;
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        if (isRecording) {
          stopRecording();
        }
      });
      audioRef.current = audio;
    }

    return () => {
      audioRef.current?.pause();
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [instrumentalUrl]);

  // Start recording with music
  const startRecording = async () => {
    try {
      setIsPreparing(true);
      
      // Initialize pro microphone (Gain + Compressor chain)
      const processedStream = await proMic.initMicrophone();
      streamRef.current = processedStream;

      // Create audio context for mixing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create destination for recording
      const destination = audioContext.createMediaStreamDestination();

      // Add microphone to mix
      const micSource = audioContext.createMediaStreamSource(processedStream);
      micSource.connect(destination);

      // Try to add music to mix
      if (audioRef.current) {
        try {
          const musicSource = audioContext.createMediaElementSource(audioRef.current);
          musicSource.connect(destination);
          musicSource.connect(audioContext.destination); // Also play through speakers
        } catch (e) {
          console.warn("Could not connect music to recorder, recording mic only:", e);
          // Music will still play but won't be in the recording
        }
      }

      // Start recorder
      const recorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      
      // Start playing music
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      }

      setIsRecording(true);
      setIsPreparing(false);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("שגיאה בהפעלת המיקרופון");
      setIsPreparing(false);
    }
  };

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Play recorded audio
  const playRecording = () => {
    if (recordingUrl && playbackAudioRef.current) {
      if (isPlaying) {
        playbackAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        playbackAudioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Re-record
  const reRecord = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    setRecordingBlob(null);
    setRecordingUrl(null);
  };

  // Save and continue
  const saveAndContinue = async () => {
    if (!recordingBlob) return;

    setIsUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      const userId = sessionData.session.user.id;
      const timestamp = Date.now();
      const fileName = `final/${userId}/section_${sectionIndex}_${timestamp}.webm`;

      const { data, error } = await supabase.storage
        .from('recordings')
        .upload(fileName, recordingBlob, {
          contentType: 'audio/webm',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      toast.success("ההקלטה נשמרה בהצלחה!");
      onFinish(sectionIndex, urlData.publicUrl);
    } catch (error: any) {
      console.error("Error uploading recording:", error);
      toast.error("שגיאה בשמירת ההקלטה");
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="self-end mb-4 text-[#D4A853] flex items-center gap-2 hover:opacity-80"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        <span>חזרה</span>
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Title */}
      <h2 
        className="text-[36px] font-bold text-[#D4A853] mb-2 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטה על המנגינה
      </h2>
      
      {/* Section Label */}
      <p 
        className="text-[24px] text-white mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {getVerseLabel()}
      </p>

      {/* Recording Visualization */}
      <div className="w-full max-w-[600px] h-[200px] rounded-[20px] bg-white/10 flex items-center justify-center mb-8 overflow-hidden">
        {isRecording ? (
          // Waveform animation during recording
          <div className="flex items-center gap-1 h-full">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-2 bg-[#D4A853] rounded-full animate-pulse"
                style={{
                  height: `${30 + Math.sin(i * 0.3 + Date.now() * 0.001) * 50}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        ) : recordingUrl ? (
          // Playback waveform
          <div className="flex items-center gap-1 h-full opacity-60">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-2 bg-green-500 rounded-full"
                style={{
                  height: `${30 + Math.sin(i * 0.3) * 50}%`,
                }}
              />
            ))}
          </div>
        ) : (
          // Empty state
          <Mic className="w-20 h-20 text-[#D4A853]/30" />
        )}
      </div>

      {/* Timer */}
      <p 
        className="text-[32px] font-bold text-white mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </p>

      {/* Controls */}
      <div className="flex gap-4 mb-8">
        {!recordingUrl ? (
          // Recording controls
          <>
            {/* Mic Settings */}
            <MicSettingsPanel
              micGain={proMic.micGain}
              onMicGainChange={proMic.setMicGain}
              vuLevel={proMic.vuLevel}
              devices={proMic.devices}
              selectedDeviceId={proMic.selectedDeviceId}
              onDeviceChange={(id) => {
                proMic.setSelectedDeviceId(id);
                proMic.initMicrophone(id).catch(console.error);
              }}
              compact
            />
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isPreparing}
                className="w-20 h-20 rounded-full bg-[#D4A853] flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
              >
                {isPreparing ? (
                  <div className="w-8 h-8 border-4 border-[#742551] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mic className="w-10 h-10 text-[#742551]" />
                )}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <Square className="w-10 h-10 text-white fill-current" />
              </button>
            )}
          </>
        ) : (
          // Playback controls
          <>
            <button
              onClick={reRecord}
              className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="w-8 h-8 text-white" />
            </button>
            
            <button
              onClick={playRecording}
              className="w-20 h-20 rounded-full bg-[#D4A853] flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10 text-[#742551]" />
              ) : (
                <Play className="w-10 h-10 text-[#742551] ml-1" />
              )}
            </button>

            <button
              onClick={saveAndContinue}
              disabled={isUploading}
              className="h-16 px-8 rounded-full bg-green-500 flex items-center justify-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span 
                  className="text-white text-[18px] font-bold"
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  שמור והמשך
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Hidden audio for playback */}
      {recordingUrl && (
        <audio
          ref={playbackAudioRef}
          src={recordingUrl}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Instructions */}
      <p 
        className="text-[16px] text-white/60 text-center max-w-[400px]"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {isRecording 
          ? "שר על המנגינה... לחץ עצור כשתסיים"
          : recordingUrl 
          ? "האזן להקלטה או הקלט שוב"
          : "לחץ על המיקרופון להתחלת הקלטה עם המנגינה"}
      </p>
    </div>
  );
}
