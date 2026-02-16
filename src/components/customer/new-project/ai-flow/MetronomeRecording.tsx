import { useState, useEffect, useRef, useCallback } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause, Square, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProMicrophone } from "@/hooks/useProMicrophone";
import { MicSettingsPanel } from "@/components/customer/new-project/MicSettingsPanel";

interface MetronomeRecordingProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onFinish: (audioUrl: string) => void;
  onBack: () => void;
}

type RecordingPhase = 'idle' | 'countdown' | 'recording' | 'finished' | 'saving';

export function MetronomeRecording({ projectData, updateProjectData, onFinish, onBack }: MetronomeRecordingProps) {
  // Pro microphone hook
  const proMic = useProMicrophone({ defaultGain: 2.5, enableCompressor: true });
  
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [countdown, setCountdown] = useState(5);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceWaveformData, setVoiceWaveformData] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [actualRecordingDuration, setActualRecordingDuration] = useState(0);
  
  // Metronome state
  const [metronomeActive, setMetronomeActive] = useState(false);
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimeRef = useRef<number>(0);

  const bpm = projectData.aiBpm || 100;
  const timeSignature = projectData.aiTimeSignature || "4/4";
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;
  const WAVEFORM_BARS = 150; // Total bars to show across the waveform
  const WAVEFORM_UPDATE_INTERVAL = 50; // Update waveform every 50ms for smooth animation
  const MAX_RECORDING_TIME = 180; // 3 minutes max

  // Initialize AudioContext on user interaction
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Generate metronome click sound - louder and more percussive
  const playMetronomeClick = useCallback(async (isAccent: boolean = false) => {
    const ctx = await initAudioContext();
    
    // Create a more percussive click using multiple oscillators
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filterNode = ctx.createBiquadFilter();
    
    // Connect: oscillators -> filter -> gain -> destination
    oscillator1.connect(filterNode);
    oscillator2.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Higher frequencies for more audible click
    oscillator1.frequency.value = isAccent ? 1500 : 1200;
    oscillator2.frequency.value = isAccent ? 2000 : 1600;
    oscillator1.type = 'square';
    oscillator2.type = 'triangle';
    
    // High-pass filter to make it more "clicky"
    filterNode.type = 'highpass';
    filterNode.frequency.value = 500;
    
    // Much louder gain - start at 1.0 for accent, 0.7 for normal
    const startGain = isAccent ? 1.0 : 0.7;
    gainNode.gain.setValueAtTime(startGain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    
    oscillator1.start(ctx.currentTime);
    oscillator2.start(ctx.currentTime);
    oscillator1.stop(ctx.currentTime + 0.08);
    oscillator2.stop(ctx.currentTime + 0.08);
  }, [initAudioContext]);

  // Start metronome
  const startMetronome = useCallback(() => {
    if (metronomeIntervalRef.current) return;
    
    const intervalMs = (60 / bpm) * 1000;
    let beatCount = 0;
    
    // Play first click immediately
    playMetronomeClick(true);
    beatCount++;
    
    metronomeIntervalRef.current = setInterval(() => {
      const isAccent = beatCount % beatsPerMeasure === 0;
      playMetronomeClick(isAccent);
      beatCount++;
    }, intervalMs);
    
    setMetronomeActive(true);
  }, [bpm, beatsPerMeasure, playMetronomeClick]);

  // Stop metronome
  const stopMetronome = useCallback(() => {
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    setMetronomeActive(false);
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    stopMetronome();
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isRecordingRef.current = false;
  }, [stopMetronome]);

  useEffect(() => cleanup, [cleanup]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      // Initialize AudioContext first with user interaction
      await initAudioContext();
      
      // Initialize pro microphone (Gain + Compressor chain)
      const processedStream = await proMic.initMicrophone();
      
      streamRef.current = processedStream;
      setPhase('countdown');
      setCountdown(5);
      
      // Countdown WITHOUT metronome - metronome starts after countdown
      for (let i = 5; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Start metronome exactly when recording begins
      startMetronome();
      startActualRecording(processedStream);
      
    } catch (error) {
      console.error('Error getting microphone:', error);
      toast.error('נא לאשר גישה למיקרופון');
    }
  };

  const startActualRecording = async (processedStream: MediaStream) => {
    setPhase('recording');
    isRecordingRef.current = true;
    
    // Use analyser from pro mic hook
    const analyser = proMic.getAnalyser();
    if (analyser) {
      analyserRef.current = analyser;
    }

    // Determine MIME type
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }
    }

    const mediaRecorder = new MediaRecorder(processedStream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
      setActualRecordingDuration(recordingTimeRef.current); // Use ref to get accurate time
      setPhase('finished');
      stopMetronome();
    };

    mediaRecorder.start(100);
    setRecordingTime(0);
    recordingTimeRef.current = 0; // Reset ref too
    setVoiceWaveformData([]);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        recordingTimeRef.current = newTime; // Keep ref in sync
        if (newTime >= MAX_RECORDING_TIME) {
          handleStopRecording();
        }
        return newTime;
      });
    }, 1000);

    // Waveform animation - capture audio levels at regular intervals
    let lastWaveformUpdate = Date.now();
    const updateWaveform = () => {
      if (analyserRef.current && isRecordingRef.current) {
        const now = Date.now();
        
        // Add a new bar every WAVEFORM_UPDATE_INTERVAL ms
        if (now - lastWaveformUpdate >= WAVEFORM_UPDATE_INTERVAL) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          
          // Normalize and add bar (ensure minimum height of 15 for visibility)
          const normalizedHeight = Math.max(15, Math.min(100, (average / 255) * 120 + 10));
          
          setVoiceWaveformData(prev => {
            // Keep only the last WAVEFORM_BARS bars
            const newData = [...prev, normalizedHeight];
            if (newData.length > WAVEFORM_BARS) {
              return newData.slice(-WAVEFORM_BARS);
            }
            return newData;
          });
          
          lastWaveformUpdate = now;
        }
        
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  };

  const handleStopRecording = () => {
    isRecordingRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    stopMetronome();
  };

  const handlePreviewPlayback = () => {
    if (!audioUrl) return;
    
    if (isPreviewPlaying) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      
      // Track playback progress
      audio.addEventListener('timeupdate', () => {
        setPreviewCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPreviewPlaying(false);
        setPreviewCurrentTime(0);
      });
      
      audio.play();
      setIsPreviewPlaying(true);
    }
  };
  
  // Stop preview audio helper
  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);
  };

  const handleResetRecording = () => {
    stopPreviewAudio();
    cleanup();
    setPhase('idle');
    setRecordingTime(0);
    setActualRecordingDuration(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setVoiceWaveformData([]);
  };

  const handleSaveRecording = async () => {
    if (!audioBlob) {
      toast.error('אין הקלטה לשמירה');
      return;
    }

    // Stop preview audio if playing
    stopPreviewAudio();

    setIsUploading(true);
    setPhase('saving');
    
    try {
      const projectId = projectData.projectName || 'ai_project';
      const timestamp = Date.now();
      const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${sanitizedProjectId}/ai_vocals_${timestamp}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      const audioPublicUrl = urlData.publicUrl;
      
      updateProjectData({ 
        aiVocalsUrl: audioPublicUrl,
        aiRecordingDuration: recordingTime
      });
      
      toast.success('ההקלטה נשמרה בהצלחה');
      onFinish(audioPublicUrl);
      
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('שגיאה בשמירת ההקלטה');
      setPhase('finished');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* Countdown Overlay */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div 
              className="text-[200px] font-bold text-[#D4A853] animate-pulse"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {countdown}
            </div>
            <p 
              className="text-[24px] text-white mt-4"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              התכוננו להקלטה...
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`w-4 h-4 rounded-full ${metronomeActive ? 'bg-[#D4A853] animate-ping' : 'bg-white/30'}`} />
              <span className="text-white/70" style={{ fontFamily: 'Discovery_Fs' }}>
                מטרונום פעיל: {bpm} BPM
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="mb-4 text-center">
        <h2 
          className="text-[32px] font-bold text-[#D4A853]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          הקלטה עם מטרונום
        </h2>
        <p 
          className="text-[16px] text-white/70"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {timeSignature} @ {bpm} BPM
        </p>
      </div>

      {/* Metronome Visual Indicator */}
      {phase === 'recording' && (
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-4 h-4 rounded-full bg-red-500 ${metronomeActive ? 'animate-pulse' : ''}`} />
          <span 
            className="text-white/70 text-[14px]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            מקליט עם מטרונום
          </span>
        </div>
      )}

      {/* Recording Time Display */}
      <div className="mb-6">
        {phase === 'finished' && isPreviewPlaying ? (
          // During playback - show current position / total
          <>
            <span 
              className="text-[48px] font-bold text-[#D4A853]"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {formatTime(previewCurrentTime)}
            </span>
            <span 
              className="text-[24px] text-white/50 mr-4"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              / {formatTime(actualRecordingDuration || recordingTime)}
            </span>
          </>
        ) : phase === 'finished' ? (
          // Finished but not playing - show total duration
          <>
            <span 
              className="text-[48px] font-bold text-[#D4A853]"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {formatTime(actualRecordingDuration || recordingTime)}
            </span>
            <span 
              className="text-[16px] text-white/50 mr-2"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              אורך ההקלטה
            </span>
          </>
        ) : (
          // During recording - show elapsed / max
          <>
            <span 
              className="text-[48px] font-bold text-[#D4A853]"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {formatTime(recordingTime)}
            </span>
            <span 
              className="text-[24px] text-white/50 mr-4"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              / {formatTime(MAX_RECORDING_TIME)}
            </span>
          </>
        )}
      </div>

      {/* Waveform */}
      <div className="w-full max-w-[800px] h-[100px] flex items-center mb-6 bg-white/5 rounded-[10px] px-4 relative overflow-hidden">
        {voiceWaveformData.length > 0 ? (
          <>
            {/* Waveform bars - fill the entire width */}
            <div className="flex items-center w-full h-full justify-end gap-[1px] relative z-10" dir="ltr">
              {voiceWaveformData.map((height, i) => {
                // Calculate if this bar is "played" during preview
                const totalBars = voiceWaveformData.length;
                const playedProgress = phase === 'finished' && actualRecordingDuration > 0 && isPreviewPlaying
                  ? previewCurrentTime / actualRecordingDuration
                  : phase === 'finished' ? 0 : 1; // During recording: all gold, After recording: all gray until play
                const barProgress = i / totalBars;
                const isPlayed = phase === 'recording' || (phase === 'finished' && barProgress <= playedProgress);
                
                return (
                  <div 
                    key={i}
                    className={`flex-1 min-w-[2px] max-w-[6px] rounded-sm transition-colors duration-100 ${
                      isPlayed ? 'bg-[#D4A853]' : 'bg-white/40'
                    }`}
                    style={{ height: `${Math.max(15, height)}%` }}
                  />
                );
              })}
            </div>
            
            {/* Playhead indicator during playback */}
            {phase === 'finished' && isPreviewPlaying && actualRecordingDuration > 0 && (
              <div 
                className="absolute top-2 bottom-2 w-[3px] bg-white rounded-full shadow-lg z-20"
                style={{ 
                  left: `calc(${(previewCurrentTime / actualRecordingDuration) * 100}% + 16px)` // 16px for padding
                }}
              />
            )}
          </>
        ) : (
          // Placeholder bars when no recording
          <div className="flex items-center w-full h-full justify-center gap-[2px]">
            {Array.from({ length: 50 }).map((_, i) => (
              <div 
                key={i}
                className="flex-1 min-w-[2px] max-w-[6px] bg-white/15 rounded-sm"
                style={{ height: `${15 + Math.sin(i * 0.3) * 20 + Math.random() * 15}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-6 mb-8">
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-4">
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
            <button
              onClick={handleStartRecording}
              className="w-[100px] h-[100px] rounded-full bg-red-500 flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
            >
              <Mic className="w-12 h-12 text-white" />
            </button>
          </div>
        )}

        {phase === 'recording' && (
          <button
            onClick={handleStopRecording}
            className="w-[100px] h-[100px] rounded-full bg-red-500 flex items-center justify-center hover:scale-105 transition-transform shadow-lg animate-pulse"
          >
            <Square className="w-12 h-12 text-white" />
          </button>
        )}

        {phase === 'finished' && (
          <>
            <button
              onClick={handlePreviewPlayback}
              className="w-[80px] h-[80px] rounded-full bg-[#D4A853] flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPreviewPlaying ? (
                <Pause className="w-10 h-10 text-[#742551]" />
              ) : (
                <Play className="w-10 h-10 text-[#742551] ml-1" />
              )}
            </button>
            
            <button
              onClick={handleResetRecording}
              className="px-6 py-3 rounded-[15px] bg-white/10 text-white hover:bg-white/20 transition-all"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              הקלט מחדש
            </button>
            
            <button
              onClick={handleSaveRecording}
              disabled={isUploading}
              className="px-8 py-3 rounded-[15px] bg-[#D4A853] text-[#742551] font-bold hover:scale-105 transition-all disabled:opacity-50"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {isUploading ? 'שומר...' : 'שמור והמשך'}
            </button>
          </>
        )}

        {phase === 'saving' && (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#D4A853] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/70" style={{ fontFamily: 'Discovery_Fs' }}>
              שומר הקלטה...
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      {phase === 'idle' && (
        <div className="text-center max-w-[500px]">
          <p 
            className="text-[#D4A853] text-[16px] font-bold mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            יש להקליט את השיר במלואו לצורך יצירת הפלייבק
          </p>
          <p 
            className="text-white/50 text-[14px]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            לחץ על הכפתור להתחלת הקלטה. המטרונום יתחיל לפעול ותוכל לשיר בקצב.
          </p>
        </div>
      )}

      {/* Back Button */}
      <div className="w-full flex justify-start mt-auto">
        <button
          onClick={onBack}
          className="text-[18px] text-[#D4A853] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ← לשלב הקודם
        </button>
      </div>
    </div>
  );
}
