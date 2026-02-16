import { useState, useRef, useEffect, useCallback } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { Mic, Pause, Play, StopCircle, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SectionRecordingScreenProps {
  projectData: ProjectData;
  sectionIndex: number;
  onFinish: (sectionIndex: number, recordingUrl: string) => void;
  onBack: () => void;
}

export function SectionRecordingScreen({ 
  projectData, 
  sectionIndex, 
  onFinish, 
  onBack 
}: SectionRecordingScreenProps) {
  const sections = projectData.songSections || [];
  const section = sections[sectionIndex];
  const songUrl = projectData.generatedSongUrl;

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Initialize audio element
  useEffect(() => {
    if (songUrl) {
      audioRef.current = new Audio(songUrl);
      audioRef.current.crossOrigin = "anonymous";
    }
    return () => {
      audioRef.current?.pause();
      stopRecording();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [songUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording with mixed audio (vocals + music)
  const startRecording = async () => {
    try {
      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      // Create audio context for mixing
      audioContextRef.current = new AudioContext();
      const audioContext = audioContextRef.current;

      // Create destination for mixed recording
      destinationRef.current = audioContext.createMediaStreamDestination();
      const destination = destinationRef.current;

      // Connect microphone to destination
      const micSource = audioContext.createMediaStreamSource(micStream);
      const micGain = audioContext.createGain();
      micGain.gain.value = 1.0; // Mic volume
      micSource.connect(micGain);
      micGain.connect(destination);

      // Create audio element source for the music
      if (audioRef.current) {
        // We need to create a new audio element with CORS
        const musicElement = new Audio(songUrl);
        musicElement.crossOrigin = "anonymous";
        
        // Wait for it to be ready
        await new Promise<void>((resolve, reject) => {
          musicElement.oncanplaythrough = () => resolve();
          musicElement.onerror = () => reject(new Error("Could not load audio"));
          musicElement.load();
        });

        const musicSource = audioContext.createMediaElementSource(musicElement);
        const musicGain = audioContext.createGain();
        musicGain.gain.value = 0.7; // Music volume (lower than vocals)
        
        musicSource.connect(musicGain);
        musicGain.connect(destination);
        musicGain.connect(audioContext.destination); // Also play through speakers
        
        audioRef.current = musicElement;
      }

      // Setup media recorder for mixed stream
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        micStream.getTracks().forEach(track => track.stop());
      };

      // Countdown before recording
      setCountdown(3);
      
      for (let i = 3; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setCountdown(i - 1);
      }
      
      setCountdown(null);
      
      // Start playback at section start
      if (audioRef.current) {
        audioRef.current.currentTime = section.startTime;
        await audioRef.current.play();
        setIsPlaying(true);
      }

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

      // Auto-stop at section end
      const sectionDuration = (section.endTime - section.startTime) * 1000;
      setTimeout(() => {
        stopRecording();
      }, sectionDuration);

    } catch (error: any) {
      console.error("Error starting recording:", error);
      if (error.name === 'NotAllowedError') {
        toast.error("לא ניתן לגשת למיקרופון - נא לאשר גישה");
      } else if (error.message?.includes("CORS") || error.message?.includes("audio")) {
        // Fallback: record only microphone if CORS fails
        startMicOnlyRecording();
      } else {
        toast.error("שגיאה בהפעלת ההקלטה");
      }
    }
  };

  // Fallback: record only microphone (without music mixing)
  const startMicOnlyRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      toast.info("מקליט קול בלבד - המוזיקה תנוגן ברקע");

      // Start playback at section start
      if (audioRef.current) {
        audioRef.current = new Audio(songUrl);
        audioRef.current.currentTime = section.startTime;
        audioRef.current.volume = 0.5;
        await audioRef.current.play();
        setIsPlaying(true);
      }

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

      // Auto-stop at section end
      const sectionDuration = (section.endTime - section.startTime) * 1000;
      setTimeout(() => {
        stopRecording();
      }, sectionDuration);

    } catch (error) {
      console.error("Error in mic-only recording:", error);
      toast.error("לא ניתן לגשת למיקרופון");
    }
  };

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    audioRef.current?.pause();
    setIsRecording(false);
    setIsPlaying(false);
  }, []);

  const playRecording = () => {
    if (recordingUrl) {
      const audio = new Audio(recordingUrl);
      audio.play();
    }
  };

  const saveRecording = async () => {
    if (!recordingBlob) return;

    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      const userId = sessionData.session.user.id;
      const timestamp = Date.now();
      const projectName = (projectData.projectName || "project").replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `sections/${userId}/${projectName}_section_${sectionIndex}_${timestamp}.webm`;

      const { data, error } = await supabase.storage
        .from('recordings')
        .upload(fileName, recordingBlob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      toast.success("ההקלטה נשמרה!");
      onFinish(sectionIndex, urlData.publicUrl);

    } catch (error: any) {
      console.error("Error saving recording:", error);
      toast.error(error.message || "שגיאה בשמירת ההקלטה");
    } finally {
      setIsSaving(false);
    }
  };

  if (!section) {
    return (
      <div className="text-center text-white">
        <p>לא נמצא חלק להקלטה</p>
        <button onClick={onBack} className="text-[#D4A853] mt-4">חזור</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full min-h-[60vh] justify-center">
      {/* Section info */}
      <h2 
        className="text-[36px] font-bold text-[#D4A853] mb-2 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטת {section.label}
      </h2>
      
      <p 
        className="text-[18px] text-white/80 mb-4 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {formatTime(section.startTime)} - {formatTime(section.endTime)} ({Math.round(section.duration)} שניות)
      </p>

      {/* Music indicator */}
      <div className="flex items-center gap-2 mb-8 text-white/60">
        <Volume2 className="w-5 h-5" />
        <span style={{ fontFamily: 'Discovery_Fs' }}>המוזיקה תנוגן ברקע בזמן ההקלטה</span>
      </div>

      {/* Countdown */}
      {countdown !== null && (
        <div className="text-[80px] font-bold text-[#D4A853] mb-8 animate-pulse">
          {countdown === 0 ? 'התחל!' : countdown}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 text-xl font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
              מקליט...
            </span>
          </div>
          <span className="text-white text-2xl" style={{ fontFamily: 'Discovery_Fs' }}>
            {formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Recorded audio preview */}
      {recordingUrl && !isRecording && (
        <div className="mb-8 flex items-center gap-4 p-4 rounded-[15px] bg-white/10">
          <button 
            onClick={playRecording}
            className="w-12 h-12 rounded-full bg-[#D4A853] flex items-center justify-center"
          >
            <Play className="w-6 h-6 text-[#742551] ml-0.5" />
          </button>
          <span className="text-white" style={{ fontFamily: 'Discovery_Fs' }}>
            האזנה להקלטה
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4 mb-8">
        {!isRecording && !recordingUrl && (
          <button
            onClick={startRecording}
            disabled={countdown !== null}
            className="flex items-center gap-3 px-8 py-4 rounded-[25px] text-[20px] font-bold text-[#742551] bg-[#D4A853] hover:opacity-90 transition-all disabled:opacity-50"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            <Mic className="w-6 h-6" />
            התחל הקלטה
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-3 px-8 py-4 rounded-[25px] text-[20px] font-bold text-white bg-red-500 hover:opacity-90 transition-all"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            <StopCircle className="w-6 h-6" />
            עצור הקלטה
          </button>
        )}

        {recordingUrl && !isRecording && (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-3 px-6 py-4 rounded-[25px] text-[18px] font-bold text-[#D4A853] border-2 border-[#D4A853] hover:bg-[#D4A853]/10 transition-all"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              <Mic className="w-5 h-5" />
              הקלט מחדש
            </button>
            <button
              onClick={saveRecording}
              disabled={isSaving}
              className="flex items-center gap-3 px-8 py-4 rounded-[25px] text-[18px] font-bold text-[#742551] bg-[#D4A853] hover:opacity-90 transition-all disabled:opacity-50"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {isSaving ? 'שומר...' : 'שמור והמשך'}
            </button>
          </>
        )}
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="text-[18px] text-[#D4A853] hover:opacity-80 transition-all"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        ← חזור לרשימה
      </button>
    </div>
  );
}