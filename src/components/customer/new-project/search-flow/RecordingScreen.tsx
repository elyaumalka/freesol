import { useState, useEffect, useCallback, useRef } from "react";
import { ProjectData, SongSection, SectionRecording } from "@/pages/customer/NewProject";
import { Play, Pause, Square, Music, Mic, Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMasterAudio } from "@/hooks/useMasterAudio";
import { autoSaveProject } from "@/lib/projectUtils";
import { Slider } from "@/components/ui/slider";
import { useProMicrophone } from "@/hooks/useProMicrophone";
import { MicSettingsPanel } from "@/components/customer/new-project/MicSettingsPanel";

interface RecordingScreenProps {
  projectData: ProjectData;
  updateProjectData?: (data: Partial<ProjectData>) => void;
  verseIndex: number;
  isAdditionalTrack?: boolean; // Recording additional layer
  skipMastering?: boolean; // Skip mastering for raw recording (used for multi-track)
  noBackgroundMusic?: boolean; // For AI flow - voice only recording without background
  dryRecordingMode?: boolean; // Record only voice without mixing background music into the recording
  onFinish: (audioUrl?: string, duration?: number) => void;
  onBack: () => void;
}

type RecordingPhase = 'idle' | 'countdown' | 'recording' | 'finished' | 'saving';

export function RecordingScreen({ 
  projectData, 
  updateProjectData,
  verseIndex,
  isAdditionalTrack = false,
  skipMastering = false,
  noBackgroundMusic = false,
  dryRecordingMode = false,
  onFinish, 
  onBack 
}: RecordingScreenProps) {
  // Recording state
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [countdown, setCountdown] = useState(5);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceWaveformData, setVoiceWaveformData] = useState<number[]>([]);
  const [musicWaveformData, setMusicWaveformData] = useState<number[]>([]);
  const [musicProgress, setMusicProgress] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [masteredAudioUrl, setMasteredAudioUrl] = useState<string | null>(null);
  
  // Master audio hook
  const { masterAudio, mixAudioTracks, isProcessing: isMastering, progress: masteringProgress } = useMasterAudio();
  
  // Pro microphone hook
  const proMic = useProMicrophone({ defaultGain: 2.5, enableCompressor: true });
  
  // Background music state
  const [backgroundPlaying, setBackgroundPlaying] = useState(false);
  const [bgMusicVolume, setBgMusicVolume] = useState(projectData.bgMusicVolume ?? 0.6);
  const [voiceVolume, setVoiceVolume] = useState(projectData.voiceVolume ?? 1.5);
  const [voiceOffsetMs, setVoiceOffsetMs] = useState(projectData.voiceOffsetMs ?? 0);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const shouldAutoStopRef = useRef<boolean>(false);

  const WAVEFORM_BARS = 100; // Number of bars to display

  // Get the current section info
  const getCurrentSection = (): SongSection | null => {
    const sections = projectData.songSections || [];
    const recordableSections = sections.filter(s => 
      s.type === 'verse' || s.type === 'chorus' || s.type === 'bridge'
    );
    return recordableSections[verseIndex] || null;
  };

  const section = getCurrentSection();
  const sectionDuration = section?.duration || 60;

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get verse label
  const getVerseLabel = () => {
    if (section?.label) return section.label;
    const verses = projectData.verses;
    if (verses.length === 0) return 'בית ראשון';
    const verse = verses[verseIndex];
    if (!verse) return 'בית ראשון';
    if (verse.type === 'chorus') {
      const chorusCount = verses.slice(0, verseIndex + 1).filter(v => v.type === 'chorus').length;
      return `פזמון ${chorusCount === 1 ? 'ראשון' : chorusCount === 2 ? 'שני' : chorusCount}`;
    }
    const verseCount = verses.slice(0, verseIndex + 1).filter(v => v.type === 'verse').length;
    return `בית ${verseCount === 1 ? 'ראשון' : verseCount === 2 ? 'שני' : verseCount}`;
  };

  // Analyze audio file and generate waveform data
  const analyzeAudioWaveform = async (audioUrl: string): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const audioContext = new AudioContext();
      
      fetch(audioUrl)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          const channelData = audioBuffer.getChannelData(0);
          const samples = channelData.length;
          const blockSize = Math.floor(samples / WAVEFORM_BARS);
          const waveform: number[] = [];
          
          for (let i = 0; i < WAVEFORM_BARS; i++) {
            const start = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
              sum += Math.abs(channelData[start + j] || 0);
            }
            const average = sum / blockSize;
            // Normalize to 0-100 range with some amplification
            waveform.push(Math.min(100, average * 300));
          }
          
          audioContext.close();
          resolve(waveform);
        })
        .catch(error => {
          audioContext.close();
          reject(error);
        });
    });
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
    }
    isRecordingRef.current = false;
  }, []);

  // Initialize and analyze background music waveform (skip if noBackgroundMusic)
  useEffect(() => {
    // Skip background music setup for voice-only recording
    if (noBackgroundMusic) {
      setIsLoadingWaveform(false);
      return cleanup;
    }
    
    // Prefer pre-cut segment file over full instrumental
    const musicUrl = section?.segmentUrl || projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
    
    if (musicUrl) {
      // Create audio element
      const audio = new Audio(musicUrl);
      audio.crossOrigin = "anonymous";
      backgroundAudioRef.current = audio;
      
      // Only seek to section start if using full file (no segment)
      audio.addEventListener('loadedmetadata', () => {
        if (!section?.segmentUrl && section?.startTime) {
          audio.currentTime = section.startTime;
        }
      });

      // Track progress
      audio.addEventListener('timeupdate', () => {
        const startTime = section?.segmentUrl ? 0 : (section?.startTime || 0);
        const currentPos = audio.currentTime - startTime;
        const progress = Math.min(1, Math.max(0, currentPos / sectionDuration));
        setMusicProgress(progress);
      });
      
      // Analyze waveform
      setIsLoadingWaveform(true);
      analyzeAudioWaveform(musicUrl)
        .then(waveform => {
          setMusicWaveformData(waveform);
          setIsLoadingWaveform(false);
        })
        .catch(error => {
          console.error('Error analyzing waveform:', error);
          // Fallback: generate random waveform pattern
          const fallback = Array.from({ length: WAVEFORM_BARS }, () => 
            20 + Math.random() * 60
          );
          setMusicWaveformData(fallback);
          setIsLoadingWaveform(false);
        });
    } else {
      setIsLoadingWaveform(false);
    }
    
    return cleanup;
  }, [cleanup, projectData.instrumentalUrl, projectData.generatedPlaybackUrl, section?.startTime, sectionDuration, noBackgroundMusic]);

  // Start the countdown and then recording
  const handleStartRecording = async () => {
    try {
      // Initialize pro microphone (Gain + Compressor chain, device selection)
      const processedStream = await proMic.initMicrophone();
      
      // Keep raw stream ref for cleanup
      streamRef.current = processedStream;
      setPermissionDenied(false);
      
      // Start countdown
      setPhase('countdown');
      setCountdown(5);
      
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            startActualRecording(processedStream);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error getting microphone:', error);
      if ((error as Error).name === 'NotAllowedError') {
        setPermissionDenied(true);
        toast.error('נא לאשר גישה למיקרופון');
      } else {
        toast.error('שגיאה בהפעלת המיקרופון');
      }
    }
  };

  // Actually start recording after countdown
  const startActualRecording = async (processedStream: MediaStream) => {
    setPhase('recording');
    isRecordingRef.current = true;
    
    // Use analyser from pro mic hook (already connected to the gain/compressor chain)
    const analyser = proMic.getAnalyser();
    if (analyser) {
      analyserRef.current = analyser;
    }

    // Determine supported MIME type
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }
    }

    // Record from the processed (Gain+Compressor) stream
    const mediaRecorder = new MediaRecorder(processedStream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
      
      // Convert to WAV for better AI enhancement compatibility
      try {
        const wavBlob = await convertToWav(webmBlob, 48000);
        const url = URL.createObjectURL(wavBlob);
        setAudioBlob(wavBlob);
        setAudioUrl(url);
      } catch (convErr) {
        console.error('WAV conversion failed, using original:', convErr);
        const url = URL.createObjectURL(webmBlob);
        setAudioBlob(webmBlob);
        setAudioUrl(url);
      }
      setPhase('finished');
    };

    mediaRecorder.start(100);
    
    // In DRY RECORDING MODE: play background music for monitoring (but don't record it)
    // In normal mode: play background music and record it
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = bgMusicVolume;
      backgroundAudioRef.current.play();
      setBackgroundPlaying(true);
    }
    
    setRecordingTime(0);
    setVoiceWaveformData([]);

    // Start timer with auto-stop using ref
    shouldAutoStopRef.current = false;
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        // Flag for auto-stop when section duration is reached
        if (newTime >= sectionDuration) {
          shouldAutoStopRef.current = true;
        }
        return newTime;
      });
    }, 1000);

    // Start waveform animation - builds bars over time
    let barIndex = 0;
    const barsPerSecond = WAVEFORM_BARS / sectionDuration;
    
    const updateWaveform = () => {
      if (analyserRef.current && isRecordingRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        // Calculate how many bars should be filled based on progress
        const elapsed = (Date.now() - startTime) / 1000;
        const targetBars = Math.floor(elapsed * barsPerSecond);
        
        if (targetBars > barIndex && barIndex < WAVEFORM_BARS) {
          setVoiceWaveformData(prev => {
            const newData = [...prev];
            // Add new bar(s)
            while (newData.length <= targetBars && newData.length < WAVEFORM_BARS) {
              newData.push(Math.min(100, (average / 255) * 150));
            }
            return newData;
          });
          barIndex = targetBars;
        }
        
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      }
    };
    
    const startTime = Date.now();
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  };

  // Check for auto-stop
  useEffect(() => {
    if (shouldAutoStopRef.current && phase === 'recording') {
      shouldAutoStopRef.current = false;
      stopRecordingInternal();
    }
  }, [recordingTime, phase]);

  // Internal stop function
  const stopRecordingInternal = useCallback(() => {
    isRecordingRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
      setBackgroundPlaying(false);
    }
  }, []);

  // Stop recording (manual)
  const handleStopRecording = () => {
    stopRecordingInternal();
  };

  // Preview audio context ref for Web Audio API gain (supports volume > 100%)
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewGainNodeRef = useRef<GainNode | null>(null);

  // Preview playback - play voice + music together with Web Audio API for volume boost
  const handlePreviewPlayback = () => {
    if (!audioUrl) return;
    
    if (isPreviewPlaying) {
      // Stop preview
      if (previewVoiceAudioRef.current) previewVoiceAudioRef.current.pause();
      if (previewMusicAudioRef.current) previewMusicAudioRef.current.pause();
      if (previewAudioContextRef.current && previewAudioContextRef.current.state !== 'closed') {
        previewAudioContextRef.current.close();
        previewAudioContextRef.current = null;
      }
      setIsPreviewPlaying(false);
    } else {
      // Start preview - sync both audio tracks
      const musicUrl = section?.segmentUrl || projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
      
      // Create voice audio with Web Audio API for volume boost above 100%
      const voiceAudio = new Audio(audioUrl);
      voiceAudio.crossOrigin = "anonymous";
      previewVoiceAudioRef.current = voiceAudio;
      
      // Use Web Audio API gain node for volume > 1.0
      const ctx = new AudioContext();
      previewAudioContextRef.current = ctx;
      const source = ctx.createMediaElementSource(voiceAudio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = voiceVolume;
      previewGainNodeRef.current = gainNode;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Apply latency offset - delay voice start
      const offsetSec = voiceOffsetMs / 1000;
      
      // Create music audio
      if (musicUrl) {
        const musicAudio = new Audio(musicUrl);
        previewMusicAudioRef.current = musicAudio;
        
        // Only seek if using full file (no segment)
        if (!section?.segmentUrl && section?.startTime) {
          musicAudio.currentTime = section.startTime;
        }
        
        // Lower music volume based on user's slider setting
        musicAudio.volume = bgMusicVolume;
        
        // Sync ended events
        voiceAudio.addEventListener('ended', () => {
          musicAudio.pause();
          if (previewAudioContextRef.current && previewAudioContextRef.current.state !== 'closed') {
            previewAudioContextRef.current.close();
            previewAudioContextRef.current = null;
          }
          setIsPreviewPlaying(false);
        });
        
        // Play with offset: positive offset = voice starts later, negative = music starts later
        if (offsetSec >= 0) {
          musicAudio.play().catch(console.error);
          setTimeout(() => voiceAudio.play().catch(console.error), offsetSec * 1000);
        } else {
          voiceAudio.play().catch(console.error);
          setTimeout(() => musicAudio.play().catch(console.error), Math.abs(offsetSec) * 1000);
        }
      } else {
        voiceAudio.addEventListener('ended', () => {
          if (previewAudioContextRef.current && previewAudioContextRef.current.state !== 'closed') {
            previewAudioContextRef.current.close();
            previewAudioContextRef.current = null;
          }
          setIsPreviewPlaying(false);
        });
        voiceAudio.play().catch(console.error);
      }
      
      setIsPreviewPlaying(true);
    }
  };

  // Reset and record again
  const handleResetRecording = () => {
    // Stop any preview
    if (previewVoiceAudioRef.current) previewVoiceAudioRef.current.pause();
    if (previewMusicAudioRef.current) previewMusicAudioRef.current.pause();
    setIsPreviewPlaying(false);
    
    cleanup();
    setPhase('idle');
    setRecordingTime(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setVoiceWaveformData([]);
    setMusicProgress(0);
    
    // Reset background audio position
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.currentTime = (!section?.segmentUrl && section?.startTime) ? section.startTime : 0;
    }
  };

  // Convert WebM blob to WAV for AI enhancement compatibility
  const convertToWav = async (webmBlob: Blob, sampleRate: number): Promise<Blob> => {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioCtx = new AudioContext({ sampleRate });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  // Denoise singing voice using Demucs (designed for music/singing source separation)
  const enhanceVoiceWithAI = async (audioUrl: string): Promise<string> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.log('No session, skipping denoising');
        return audioUrl;
      }

      console.log('Denoising singing voice with Demucs:', audioUrl);
      toast.info('מסנן רעשים ונשימות מההקלטה...');
      
      // Step 1: Start the Demucs vocal separation
      const startResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/denoise-singing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            audioUrl,
            projectName: projectData.projectName || 'recording',
          }),
        }
      );

      if (!startResponse.ok) {
        console.error('Demucs denoising start failed:', startResponse.status);
        toast.error('סינון רעשים נכשל - ממשיך עם הקלטה רגילה');
        return audioUrl;
      }

      const startResult = await startResponse.json();
      
      if (!startResult.success || !startResult.predictionId) {
        console.error('No predictionId from denoising:', startResult);
        return audioUrl;
      }

      const predictionId = startResult.predictionId;
      console.log('Demucs denoising started:', predictionId);

      // Step 2: Poll for completion (max 120 seconds)
      const maxAttempts = 24;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(`Polling denoising status (${attempt + 1}/${maxAttempts})...`);

        const pollResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/denoise-singing`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              predictionId,
              projectName: projectData.projectName || 'recording',
            }),
          }
        );

        if (!pollResponse.ok) {
          console.error('Poll failed:', pollResponse.status);
          continue;
        }

        const pollResult = await pollResponse.json();

        if (pollResult.status === 'succeeded' && pollResult.cleanVocalUrl) {
          console.log('Singing denoised successfully:', pollResult.cleanVocalUrl);
          toast.success('רעשים ונשימות סוננו בהצלחה! ✨');
          return pollResult.cleanVocalUrl;
        }

        if (pollResult.status === 'failed') {
          console.error('Denoising failed:', pollResult.error);
          toast.error('סינון רעשים נכשל - ממשיך עם הקלטה רגילה');
          return audioUrl;
        }
      }

      // Timeout
      console.log('Denoising timed out after 120s');
      toast.error('סינון רעשים לקח יותר מדי זמן - ממשיך עם הקלטה רגילה');
      return audioUrl;
    } catch (error) {
      console.error('Error denoising voice:', error);
      toast.error('שגיאה בסינון רעשים');
      return audioUrl;
    }
  };

  // Save the recording - with AI enhancement like narration flow
  const handleSaveRecording = async () => {
    if (!audioBlob) {
      toast.error('אין הקלטה לשמירה');
      return;
    }

    setIsUploading(true);
    setPhase('saving');
    
    try {
      const verseName = getVerseLabel().replace(/\s/g, '_');
      const projectId = projectData.projectName || 'temp_project';
      const timestamp = Date.now();
      const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedVerseName = verseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const trackLabel = isAdditionalTrack ? `track_${(getCurrentSection()?.recordings?.length || 0) + 2}` : 'main';
      
      // Step 1: Upload raw voice recording
      toast.info('מעלה את ההקלטה...');
      const isWav = audioBlob.type === 'audio/wav';
      const ext = isWav ? 'wav' : 'webm';
      const rawFileName = `${sanitizedProjectId}/${sanitizedVerseName}_${trackLabel}_raw_${timestamp}.${ext}`;
      
      const { error: rawUploadError } = await supabase.storage
        .from('recordings')
        .upload(rawFileName, audioBlob, {
          contentType: isWav ? 'audio/wav' : 'audio/webm',
          upsert: true
        });

      if (rawUploadError) throw rawUploadError;

      const { data: rawUrlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(rawFileName);

      const rawVoiceUrl = rawUrlData.publicUrl;
      
      // In dry recording mode: mix vocals with instrumental on the server
      let finalAudioUrl = rawVoiceUrl;
      
      if (dryRecordingMode) {
        const musicUrl = section?.segmentUrl || projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
        
        if (musicUrl) {
          toast.info('מערבב קול עם מוזיקה (FFmpeg)...');
          
          try {
            const mixResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dry-recording-mix`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  vocalUrl: rawVoiceUrl,
                  instrumentalUrl: musicUrl,
                  offsetMs: voiceOffsetMs || 0,
                  vocalGain: voiceVolume || 1.5,
                  instrumentalGain: bgMusicVolume || 0.55,
                }),
              }
            );
            
            if (!mixResponse.ok) {
              const error = await mixResponse.json();
              console.error('Mix failed:', error);
              toast.error('מיזוג הקול עם המוזיקה נכשל - משתמש בקול הגולמי');
              finalAudioUrl = rawVoiceUrl;
            } else {
              const mixResult = await mixResponse.json();
              if (mixResult.mixedUrl) {
                finalAudioUrl = mixResult.mixedUrl;
                toast.success('הקול מיוזג בהצלחה עם מוזיקה!');
              }
            }
          } catch (mixError) {
            console.error('Error calling mix function:', mixError);
            toast.error('שגיאה במיזוג - משתמש בקול הגולמי');
            finalAudioUrl = rawVoiceUrl;
          }
        }
      }
      
      if (updateProjectData) {
        // Check if we're in AI flow (using verses) or search/upload flow (using songSections)
        const isAIFlow = noBackgroundMusic && projectData.verses && projectData.verses.length > 0;
        
        if (isAIFlow) {
          // AI Flow: Update verses array with audioUrl
          const updatedVerses = [...projectData.verses];
          if (updatedVerses[verseIndex]) {
            updatedVerses[verseIndex] = {
              ...updatedVerses[verseIndex],
              audioUrl: finalAudioUrl,
              duration: formatTime(recordingTime),
            };
          }
          updateProjectData({ verses: updatedVerses });
          
          // Auto-save after recording
          autoSaveProject({ ...projectData, verses: updatedVerses, backgroundMusic: 'ai' }, 'initial-recording');
        } else {
          // Search/Upload Flow: Update song sections with the recording URL
          // Find the actual index in the full sections array, not the filtered one
          const allSections = [...(projectData.songSections || [])];
          let recordableIndex = 0;
          for (let i = 0; i < allSections.length; i++) {
            const section = allSections[i];
            if (section.type === 'verse' || section.type === 'chorus' || section.type === 'bridge') {
              if (recordableIndex === verseIndex) {
                if (isAdditionalTrack) {
                  // Add to recordings array (enhanced URL)
                  const newRecording: SectionRecording = {
                    id: `rec_${Date.now()}`,
                    audioUrl: finalAudioUrl,
                    label: `קול ${(section.recordings?.length || 0) + 2}`,
                    createdAt: Date.now(),
                  };
                  const existingRecordings = section.recordings || [];
                  allSections[i] = { 
                    ...section, 
                    recordings: [...existingRecordings, newRecording]
                  };
                } else {
                  // Replace main recording with enhanced URL
                  allSections[i] = { ...section, userRecordingUrl: finalAudioUrl };
                }
                break;
              }
              recordableIndex++;
            }
          }
          updateProjectData({ songSections: allSections });
          
          // Auto-save after recording
          autoSaveProject({ ...projectData, songSections: allSections }, 'ready-record');
        }
      }
      
      // Recording enhanced and saved!
      toast.success('ההקלטה נשמרה באיכות גבוהה!');
      onFinish(finalAudioUrl, recordingTime);
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('שגיאה בשמירת ההקלטה');
      setPhase('finished');
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate how many bars should be "active" (highlighted) based on music progress
  const activeMusicBars = Math.floor(musicProgress * WAVEFORM_BARS);
  const activeVoiceBars = voiceWaveformData.length;

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden">
      {/* Microphone Icon - Compact */}
      <div className="mb-2">
        <svg width="48" height="48" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M40 8C35.5817 8 32 11.5817 32 16V40C32 44.4183 35.5817 48 40 48C44.4183 48 48 44.4183 48 40V16C48 11.5817 44.4183 8 40 8Z" stroke="#D4A853" strokeWidth="3" fill="none"/>
          <path d="M24 36V40C24 48.8366 31.1634 56 40 56C48.8366 56 56 48.8366 56 40V36" stroke="#D4A853" strokeWidth="3" strokeLinecap="round"/>
          <path d="M40 56V68" stroke="#D4A853" strokeWidth="3" strokeLinecap="round"/>
          <path d="M32 68H48" stroke="#D4A853" strokeWidth="3" strokeLinecap="round"/>
          <path d="M20 28C20 28 16 32 16 40C16 48 20 52 20 52" stroke="#D4A853" strokeWidth="2" strokeLinecap="round" opacity={phase === 'recording' ? "1" : "0.3"}/>
          <path d="M60 28C60 28 64 32 64 40C64 48 60 52 60 52" stroke="#D4A853" strokeWidth="2" strokeLinecap="round" opacity={phase === 'recording' ? "1" : "0.3"}/>
        </svg>
      </div>

      {/* Recording Label - Compact */}
      <h2 
        className="text-[24px] font-bold text-[#D4A853] mb-2"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטת {getVerseLabel()}
      </h2>

      {/* Countdown Display */}
      {phase === 'countdown' && (
        <div className="mb-4">
          <div 
            className="text-[80px] font-bold text-white animate-pulse"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {countdown}
          </div>
          <p className="text-[14px] text-white/60 text-center" style={{ fontFamily: 'Discovery_Fs' }}>
            מתכוננים...
          </p>
        </div>
      )}

      {/* Permission denied message */}
      {permissionDenied && (
        <p className="text-red-400 mb-2 text-center text-sm" style={{ fontFamily: 'Discovery_Fs' }}>
          נא לאשר גישה למיקרופון בהגדרות הדפדפן
        </p>
      )}

      {/* Time Display - Compact */}
      {phase !== 'countdown' && (
        <div className="w-full max-w-[800px] flex justify-between items-center mb-4 px-4">
          <span 
            className="text-[24px] font-bold text-[#D4A853]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {formatTime(recordingTime)}
          </span>
          <span 
            className="text-[24px] font-bold text-white/50"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {formatTime(sectionDuration)}
          </span>
        </div>
      )}

      {/* Record Button - Compact */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-2 mb-4">
          {/* Mic Settings Panel */}
          <MicSettingsPanel
            micGain={proMic.micGain}
            onMicGainChange={proMic.setMicGain}
            vuLevel={proMic.vuLevel}
            devices={proMic.devices}
            selectedDeviceId={proMic.selectedDeviceId}
            onDeviceChange={(id) => {
              proMic.setSelectedDeviceId(id);
              // Re-init mic with new device
              proMic.initMicrophone(id).catch(console.error);
            }}
            compact
          />
          <button
            onClick={handleStartRecording}
            className="w-[80px] h-[80px] rounded-full flex items-center justify-center transition-all hover:scale-105 mt-2"
            style={{
              background: '#D4A853',
              boxShadow: '0 0 0 6px rgba(212, 168, 83, 0.3)'
            }}
          >
            <div className="w-8 h-8 rounded-full bg-red-600" />
          </button>
          <p className="text-[14px] text-white/80" style={{ fontFamily: 'Discovery_Fs' }}>
            לחץ להתחלת הקלטה
          </p>
        </div>
      )}

      {/* Recording in progress - Stop button - Compact */}
      {phase === 'recording' && (
        <div className="flex flex-col items-center gap-2 mb-4">
          <button
            onClick={handleStopRecording}
            className="w-[80px] h-[80px] rounded-full flex items-center justify-center transition-all hover:scale-105 animate-pulse"
            style={{
              background: '#DC2626',
              boxShadow: '0 0 0 6px rgba(220, 38, 38, 0.3)'
            }}
          >
            <Square className="w-8 h-8 text-white fill-white" />
          </button>
          <p className="text-[14px] text-white/80" style={{ fontFamily: 'Discovery_Fs' }}>
            מקליט... לחץ לעצירה
          </p>
        </div>
      )}

      {/* Two Channel Display - Studio Style - Compact */}
      <div className="w-full max-w-[900px] space-y-2 mb-4">
        {/* Background Music Channel */}
        <div className="bg-[#1a3a4a] rounded-[12px] p-3">
          <div className="flex items-center gap-4 mb-1">
            <div className="flex items-center gap-2 min-w-[100px]">
              <Music className="w-4 h-4 text-[#4ECDC4]" />
              <span className="text-[12px] text-white font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
                מוזיקת רקע
              </span>
            </div>
            {/* Volume Slider */}
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <Volume2 className="w-3 h-3 text-[#4ECDC4]/70" />
              <Slider
                value={[bgMusicVolume * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={(val) => {
                  const newVol = val[0] / 100;
                  setBgMusicVolume(newVol);
                  if (backgroundAudioRef.current) {
                    backgroundAudioRef.current.volume = newVol;
                  }
                  if (updateProjectData) {
                    updateProjectData({ bgMusicVolume: newVol });
                  }
                }}
                className="flex-1 [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-[#4ECDC4]/20 [&_[data-radix-slider-range]]:bg-[#4ECDC4] [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:border-[#4ECDC4]"
              />
              <span className="text-[10px] text-white/50 min-w-[28px] text-center">{Math.round(bgMusicVolume * 100)}%</span>
            </div>
            <span className="text-[10px] text-white/60" style={{ fontFamily: 'Discovery_Fs' }}>
              {backgroundPlaying ? '🔊 מנגן' : ''}
            </span>
          </div>
          
          {/* Music Waveform */}
          <div className="h-[40px] flex items-center gap-[2px] bg-[#0d2530] rounded-lg p-1">
            {isLoadingWaveform ? (
              <div className="w-full flex items-center justify-center text-white/40 text-xs">
                טוען צורת גל...
              </div>
            ) : (
              musicWaveformData.map((height, i) => (
                <div 
                  key={i}
                  className="flex-1 rounded-sm transition-all duration-75"
                  style={{ 
                    height: `${Math.max(8, height)}%`,
                    backgroundColor: i < activeMusicBars 
                      ? '#4ECDC4' // Teal for played part
                      : '#2a5a6a', // Darker for unplayed
                    opacity: i < activeMusicBars ? 1 : 0.5
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Voice Recording Channel */}
        <div className="bg-[#3a1a2a] rounded-[12px] p-3">
          <div className="flex items-center gap-4 mb-1">
            <div className="flex items-center gap-2 min-w-[100px]">
              <Mic className="w-4 h-4 text-[#D4A853]" />
              <span className="text-[12px] text-white font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
                הקול שלך
              </span>
            </div>
            <span className="text-[10px] text-white/60" style={{ fontFamily: 'Discovery_Fs' }}>
              {phase === 'recording' ? '🎤 מקליט' : ''}
            </span>
          </div>
          
          {/* Voice Waveform - Builds as you record */}
          <div className="h-[40px] flex items-center gap-[2px] bg-[#250d1a] rounded-lg p-1">
            {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
              const hasData = i < voiceWaveformData.length;
              const height = hasData ? voiceWaveformData[i] : 0;
              
              return (
                <div 
                  key={i}
                  className="flex-1 rounded-sm transition-all duration-75"
                  style={{ 
                    height: hasData ? `${Math.max(8, height)}%` : '3px',
                    backgroundColor: hasData 
                      ? '#D4A853' // Gold for recorded
                      : '#4a2a3a', // Placeholder for unrecorded
                    opacity: hasData ? 1 : 0.3
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Saving/Processing in progress */}
      {phase === 'saving' && (
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-[#D4A853] to-[#4ECDC4] flex items-center justify-center animate-pulse">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
          <div className="text-center">
            <h3 
              className="text-[24px] font-bold text-[#D4A853] mb-2"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {isAdditionalTrack || skipMastering ? 'שומר את ההקלטה...' : 'מעבד מאסטרינג מקצועי'}
            </h3>
            <p className="text-[16px] text-white/60" style={{ fontFamily: 'Discovery_Fs' }}>
              {isAdditionalTrack || skipMastering 
                ? 'המאסטרינג יתבצע על כל הערוצים יחד בסוף' 
                : (masteringProgress || 'ממזג ומשדרג את האודיו...')}
            </p>
          </div>
          <div className="w-[300px] h-[4px] bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#D4A853] to-[#4ECDC4] animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Finished state - action buttons */}
      {phase === 'finished' && audioUrl && (
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* Preview button */}
          <button
            onClick={handlePreviewPlayback}
            className="w-[80px] h-[80px] rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: isPreviewPlaying ? '#4ECDC4' : '#D4A853',
              boxShadow: `0 0 0 6px ${isPreviewPlaying ? 'rgba(78, 205, 196, 0.3)' : 'rgba(212, 168, 83, 0.3)'}`
            }}
          >
            {isPreviewPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>
          <p className="text-[16px] text-white/60" style={{ fontFamily: 'Discovery_Fs' }}>
            {isPreviewPlaying ? 'מנגן...' : 'לחץ להאזנה'}
          </p>

          {/* Action buttons */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleResetRecording}
              className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              הקלטה מחדש
            </button>
            <button
              onClick={handleSaveRecording}
              disabled={isUploading || isMastering}
              className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold text-[#742551] transition-all disabled:opacity-50"
              style={{ 
                fontFamily: 'Discovery_Fs',
                background: '#D4A853'
              }}
            >
              {isUploading || isMastering ? 'מעבד...' : (isAdditionalTrack ? '← שמירת קול נוסף' : '← שמירה')}
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="w-full flex justify-end mt-12">
        <button
          onClick={onBack}
          className="text-[18px] text-[#D4A853] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ← חזרה
        </button>
      </div>
    </div>
  );
}
