import { useState, useRef, useEffect, useCallback } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause, Mic, Trash2, Square, Loader2, Volume2, VolumeX, SkipBack } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { useProMicrophone } from "@/hooks/useProMicrophone";
import { MicSettingsPanel } from "@/components/customer/new-project/MicSettingsPanel";

interface AIFinalRecordingProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onFinish: (audioUrl: string) => void;
  onBack: () => void;
}

interface TimelineSegment {
  id: string;
  startTime: number;
  duration: number;
  audioUrl: string;
  audioBlob: Blob;
  waveform: number[];
  trackIndex: number;
}

const WAVEFORM_BARS = 150;
const TRACK_HEIGHT = 60;
const MAX_TRACKS = 3;

export function AIFinalRecording({ projectData, updateProjectData, onFinish, onBack }: AIFinalRecordingProps) {
  // Pro microphone hook
  const proMic = useProMicrophone({ defaultGain: 2.5, enableCompressor: true });
  
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [backgroundWaveform, setBackgroundWaveform] = useState<number[]>([]);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isBackgroundPlaying, setIsBackgroundPlaying] = useState(false);
  const [backgroundVolume, setBackgroundVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [liveRecordingWaveform, setLiveRecordingWaveform] = useState<number[]>([]);
  const [draggingSegment, setDraggingSegment] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [totalDuration, setTotalDuration] = useState(180);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingDurationRef = useRef<number>(0);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const liveWaveformRef = useRef<number[]>([]);
  const activeSegmentAudiosRef = useRef<HTMLAudioElement[]>([]);
  const segmentsRef = useRef<TimelineSegment[]>([]);

  const instrumentalUrl = projectData.instrumentalUrl || projectData.generatedPlaybackUrl;

  // Keep segments ref updated
  segmentsRef.current = segments;

  // Analyze audio waveform
  const analyzeAudioWaveform = async (audioUrl: string, bars: number = WAVEFORM_BARS): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const audioContext = new AudioContext();
      
      fetch(audioUrl)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          const channelData = audioBuffer.getChannelData(0);
          const samples = channelData.length;
          const blockSize = Math.floor(samples / bars);
          const waveform: number[] = [];
          
          for (let i = 0; i < bars; i++) {
            const start = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
              sum += Math.abs(channelData[start + j] || 0);
            }
            const average = sum / blockSize;
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

  // Initialize background music
  useEffect(() => {
    if (instrumentalUrl) {
      const audio = new Audio();
      audio.src = instrumentalUrl;
      audio.volume = backgroundVolume;
      audio.preload = "auto";
      audio.loop = false;
      backgroundAudioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setTotalDuration(audio.duration || 180);
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentPlaybackTime(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        setIsBackgroundPlaying(false);
        stopAllSegmentAudios();
      });

      audio.load();

      setIsLoadingWaveform(true);
      analyzeAudioWaveform(instrumentalUrl)
        .then(waveform => {
          setBackgroundWaveform(waveform);
          setIsLoadingWaveform(false);
        })
        .catch(error => {
          console.warn('CORS waveform analysis failed, using fallback:', error);
          const fallback = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
            const phase = (i / WAVEFORM_BARS) * Math.PI * 8;
            return 30 + Math.sin(phase) * 20 + Math.random() * 25;
          });
          setBackgroundWaveform(fallback);
          setIsLoadingWaveform(false);
        });

      return () => {
        audio.pause();
        audio.src = '';
      };
    } else {
      setIsLoadingWaveform(false);
    }
  }, [instrumentalUrl]);

  // Update volume when changed
  useEffect(() => {
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = isMuted ? 0 : backgroundVolume;
    }
  }, [backgroundVolume, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
      stopAllSegmentAudios();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stopAllSegmentAudios = () => {
    activeSegmentAudiosRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeSegmentAudiosRef.current = [];
  };

  const scheduleSegmentPlayback = (fromTime: number) => {
    const currentSegments = segmentsRef.current;
    
    console.log('Scheduling playback from time:', fromTime, 'Segments:', currentSegments.length);
    
    currentSegments.forEach(segment => {
      const segmentEnd = segment.startTime + segment.duration;
      
      console.log('Segment:', segment.id, 'Start:', segment.startTime, 'End:', segmentEnd, 'URL:', segment.audioUrl);
      
      // Only play segments that haven't ended yet
      if (segmentEnd > fromTime) {
        let delay = 0;
        let seekTime = 0;
        
        if (segment.startTime >= fromTime) {
          // Segment starts after current position - schedule with delay
          delay = (segment.startTime - fromTime) * 1000;
        } else {
          // Segment already started - seek into it
          seekTime = fromTime - segment.startTime;
        }
        
        console.log('Playing segment with delay:', delay, 'seekTime:', seekTime);
        
        const timeoutId = setTimeout(() => {
          // Check if background is still playing when timeout fires
          if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {
            const audio = new Audio(segment.audioUrl);
            audio.volume = 1;
            
            audio.addEventListener('canplaythrough', () => {
              if (seekTime > 0) {
                audio.currentTime = seekTime;
              }
              audio.play()
                .then(() => console.log('Segment playing:', segment.id))
                .catch(err => console.error('Segment play error:', err));
            }, { once: true });
            
            audio.addEventListener('error', (e) => {
              console.error('Audio load error for segment:', segment.id, e);
            });
            
            activeSegmentAudiosRef.current.push(audio);
            audio.load();
            
            audio.addEventListener('ended', () => {
              const idx = activeSegmentAudiosRef.current.indexOf(audio);
              if (idx > -1) activeSegmentAudiosRef.current.splice(idx, 1);
            });
          }
        }, delay);
        
        // Store timeout for potential cleanup
        return timeoutId;
      }
    });
  };

  const playFromStart = () => {
    if (!backgroundAudioRef.current) return;
    
    stopAllSegmentAudios();
    backgroundAudioRef.current.currentTime = 0;
    setCurrentPlaybackTime(0);
    
    backgroundAudioRef.current.play()
      .then(() => {
        setIsBackgroundPlaying(true);
        scheduleSegmentPlayback(0);
      })
      .catch(console.error);
  };

  const toggleBackgroundMusic = () => {
    if (!backgroundAudioRef.current) return;
    
    if (backgroundAudioRef.current.paused) {
      const currentTime = backgroundAudioRef.current.currentTime;
      backgroundAudioRef.current.play()
        .then(() => {
          setIsBackgroundPlaying(true);
          scheduleSegmentPlayback(currentTime);
        })
        .catch(console.error);
    } else {
      backgroundAudioRef.current.pause();
      stopAllSegmentAudios();
      setIsBackgroundPlaying(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      if (!backgroundAudioRef.current) {
        toast.error('מוזיקת רקע לא נטענה עדיין');
        return;
      }

      // Initialize pro microphone (Gain + Compressor chain)
      const processedStream = await proMic.initMicrophone();
      
      streamRef.current = processedStream;
      
      const bgAudio = backgroundAudioRef.current;
      // Always reset cursor to the beginning when recording
      bgAudio.currentTime = 0;
      setCurrentPlaybackTime(0);

      // Countdown WITHOUT music
      setIsCountingDown(true);
      setCountdown(5);

      for (let i = 5; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setIsCountingDown(false);

      // Start background music exactly when recording begins
      recordingStartTimeRef.current = bgAudio.currentTime;
      bgAudio.volume = isMuted ? 0 : backgroundVolume;
      
      try {
        await bgAudio.play();
      } catch (playError) {
        console.error("Background music play error:", playError);
        toast.error('שגיאה בהפעלת מוזיקת רקע');
      }
      
      setIsBackgroundPlaying(true);
      startActualRecording(processedStream);
      
    } catch (error) {
      console.error('Error getting microphone:', error);
      toast.error('נא לאשר גישה למיקרופון');
    }
  };

  const startActualRecording = (processedStream: MediaStream) => {
    setIsRecording(true);
    isRecordingRef.current = true;
    liveWaveformRef.current = [];
    setLiveRecordingWaveform([]);
    
    // Use analyser from pro mic hook
    const analyser = proMic.getAnalyser();
    if (analyser) {
      analyserRef.current = analyser;
    }

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

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      
      const segmentWaveform = [...liveWaveformRef.current];
      const finalDuration = recordingDurationRef.current;
      
      const newSegment: TimelineSegment = {
        id: Date.now().toString(),
        startTime: recordingStartTimeRef.current,
        duration: finalDuration,
        audioUrl: url,
        audioBlob: blob,
        waveform: segmentWaveform.slice(0, 50),
        trackIndex: currentTrack
      };
      
      setSegments(prev => [...prev, newSegment]);
      setRecordingTime(0);
      recordingDurationRef.current = 0;
    };

    mediaRecorder.start(100);
    setRecordingTime(0);
    recordingDurationRef.current = 0;

    timerRef.current = setInterval(() => {
      recordingDurationRef.current += 1;
      setRecordingTime(prev => prev + 1);
    }, 1000);

    const updateWaveform = () => {
      if (analyserRef.current && isRecordingRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(100, (average / 255) * 150);
        liveWaveformRef.current.push(normalized);
        
        if (liveWaveformRef.current.length % 3 === 0) {
          setLiveRecordingWaveform([...liveWaveformRef.current]);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  };

  const handleStopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setLiveRecordingWaveform([]);
    
    if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {
      backgroundAudioRef.current.pause();
      setIsBackgroundPlaying(false);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleDeleteSegment = (segmentId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segmentId));
    if (selectedSegment === segmentId) {
      setSelectedSegment(null);
    }
    toast.success('הקטע נמחק');
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isRecording || draggingSegment) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    // RTL: clicking on the right = start (0), clicking on the left = end (totalDuration)
    const clickPercent = clickX / trackWidth;
    const newTime = (1 - clickPercent) * totalDuration;
    
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.currentTime = Math.max(0, Math.min(newTime, totalDuration));
      setCurrentPlaybackTime(backgroundAudioRef.current.currentTime);
    }
    
    setSelectedSegment(null);
  };

  const handleSegmentClick = (e: React.MouseEvent, segmentId: string) => {
    e.stopPropagation();
    setSelectedSegment(selectedSegment === segmentId ? null : segmentId);
  };

  const handleSegmentDragStart = (e: React.MouseEvent, segment: TimelineSegment) => {
    e.stopPropagation();
    setDraggingSegment(segment.id);
    setDragStartX(e.clientX);
    setDragStartTime(segment.startTime);
    setSelectedSegment(segment.id);
  };

  const handleSegmentDragMove = (e: React.MouseEvent) => {
    if (!draggingSegment || !timelineRef.current) return;
    
    const deltaX = e.clientX - dragStartX;
    const rect = timelineRef.current.getBoundingClientRect();
    const trackWidth = rect.width - 100;
    // RTL: dragging left = later in time, dragging right = earlier
    const deltaTime = (deltaX / trackWidth) * totalDuration;
    
    setSegments(prev => prev.map(s => {
      if (s.id === draggingSegment) {
        const newStartTime = Math.max(0, Math.min(dragStartTime - deltaTime, totalDuration - s.duration));
        return { ...s, startTime: newStartTime };
      }
      return s;
    }));
  };

  const handleSegmentDragEnd = () => {
    setDraggingSegment(null);
  };

  const getTracksWithSegments = () => {
    const tracks: TimelineSegment[][] = Array.from({ length: MAX_TRACKS }, () => []);
    segments.forEach(segment => {
      if (segment.trackIndex < MAX_TRACKS) {
        tracks[segment.trackIndex].push(segment);
      }
    });
    return tracks;
  };

  const getSegmentPosition = (segment: TimelineSegment) => {
    // RTL: segments start from the right side, so we use "left" to position from the end
    const endPercent = ((totalDuration - segment.startTime) / totalDuration) * 100;
    const widthPercent = (segment.duration / totalDuration) * 100;
    // Position from right side: left = 100% - startPercent - width
    return { left: `${endPercent - widthPercent}%`, width: `${Math.max(2, widthPercent)}%` };
  };

  // Merge vocals with instrumental using OfflineAudioContext
  const mergeVocalsWithInstrumental = async (vocalBlobs: Blob[]): Promise<Blob> => {
    const audioContext = new AudioContext();
    
    // Load instrumental
    const instrumentalResponse = await fetch(instrumentalUrl!);
    const instrumentalArrayBuffer = await instrumentalResponse.arrayBuffer();
    const instrumentalBuffer = await audioContext.decodeAudioData(instrumentalArrayBuffer);
    
    // Load all vocal segments
    const vocalBuffers: { buffer: AudioBuffer; startTime: number }[] = [];
    for (const segment of segments) {
      const arrayBuffer = await segment.audioBlob.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      vocalBuffers.push({ buffer, startTime: segment.startTime });
    }
    
    // Calculate total duration (use instrumental length or max vocal end time)
    const maxVocalEnd = Math.max(...segments.map(s => s.startTime + s.duration));
    const outputDuration = Math.max(instrumentalBuffer.duration, maxVocalEnd);
    
    // Create offline context for mixing
    const offlineContext = new OfflineAudioContext(
      2, // stereo
      Math.ceil(outputDuration * instrumentalBuffer.sampleRate),
      instrumentalBuffer.sampleRate
    );
    
    // Add instrumental track
    const instrumentalSource = offlineContext.createBufferSource();
    instrumentalSource.buffer = instrumentalBuffer;
    const instrumentalGain = offlineContext.createGain();
    instrumentalGain.gain.value = 0.7; // 70% volume for instrumental
    instrumentalSource.connect(instrumentalGain);
    instrumentalGain.connect(offlineContext.destination);
    instrumentalSource.start(0);
    
    // Add each vocal segment at its correct position
    for (const { buffer, startTime } of vocalBuffers) {
      const vocalSource = offlineContext.createBufferSource();
      vocalSource.buffer = buffer;
      const vocalGain = offlineContext.createGain();
      vocalGain.gain.value = 1.0; // 100% volume for vocals
      vocalSource.connect(vocalGain);
      vocalGain.connect(offlineContext.destination);
      vocalSource.start(startTime);
    }
    
    // Render the mixed audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV blob
    const wavBlob = audioBufferToWav(renderedBuffer);
    
    audioContext.close();
    return wavBlob;
  };
  
  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    
    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const handleSaveRecording = async () => {
    if (segments.length === 0) {
      toast.error('אין הקלטות לשמירה');
      return;
    }

    if (!instrumentalUrl) {
      toast.error('אין מוזיקת רקע למיזוג');
      return;
    }

    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('יש להתחבר מחדש');
        return;
      }

      toast.info('ממזג את ההקלטה עם מוזיקת הרקע...');
      
      // Merge all vocals with instrumental
      const mergedBlob = await mergeVocalsWithInstrumental(segments.map(s => s.audioBlob));
      
      const projectId = projectData.projectName || 'ai_project';
      const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = Date.now();
      const fileName = `${sanitizedProjectId}/ai_final_mixed_${timestamp}.wav`;
      
      const { error } = await supabase.storage
        .from('recordings')
        .upload(fileName, mergedBlob, {
          contentType: 'audio/wav',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      const finalAudioUrl = urlData.publicUrl;

      // Save to recordings table
      await supabase.from('recordings').insert({
        user_id: user.id,
        song_name: projectData.projectName || 'הקלטת AI',
        audio_url: finalAudioUrl,
        duration: formatTime(segments.reduce((acc, s) => Math.max(acc, s.startTime + s.duration), 0))
      });
      
      updateProjectData({ 
        generatedSongUrl: finalAudioUrl,
        recordedAudioUrl: finalAudioUrl,
        vocalsUrl: finalAudioUrl
      });
      
      toast.success('ההקלטה מוזגה ונשמרה בהצלחה');
      onFinish(finalAudioUrl);
      
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('שגיאה בשמירת ההקלטה');
    } finally {
      setIsUploading(false);
    }
  };

  const tracksWithSegments = getTracksWithSegments();
  const usedTracks = tracksWithSegments.filter(t => t.length > 0).length || 1;

  return (
    <div 
      className="flex flex-col items-center w-full h-full overflow-hidden pt-2"
      onMouseMove={draggingSegment ? handleSegmentDragMove : undefined}
      onMouseUp={draggingSegment ? handleSegmentDragEnd : undefined}
      onMouseLeave={draggingSegment ? handleSegmentDragEnd : undefined}
    >
      {/* Header */}
      <h2 
        className="text-[22px] font-bold text-white mb-2 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטה על הפלייבק - עורך טיימליין
      </h2>

      {/* Mic Settings */}
      {!isRecording && (
        <div className="w-full max-w-[1000px] mb-2">
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
        </div>
      )}

      {/* Transport Controls */}
      <div className="w-full max-w-[1000px] mb-2 flex items-center gap-3 p-2 rounded-lg bg-[#1a1a2e]" dir="rtl">
        <button
          onClick={playFromStart}
          className="w-10 h-10 rounded bg-white/10 flex items-center justify-center hover:bg-white/20"
          title="חזור להתחלה"
        >
          <SkipBack className="w-5 h-5 text-white" />
        </button>
        
        <button 
          onClick={toggleBackgroundMusic}
          disabled={isLoadingWaveform || isRecording}
          className="w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50"
          style={{ background: isBackgroundPlaying ? '#D4A853' : '#5a4a2a' }}
        >
          {isBackgroundPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white mr-0.5" />
          )}
        </button>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-[#D4A853] font-mono text-[16px]">
            {formatTime(currentPlaybackTime)}
          </span>
          <span className="text-white/30">/</span>
          <span className="text-white/60 font-mono text-[14px]">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/10"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-white/60" />
            ) : (
              <Volume2 className="w-4 h-4 text-white/60" />
            )}
          </button>
          <Slider
            value={[backgroundVolume * 100]}
            onValueChange={([v]) => setBackgroundVolume(v / 100)}
            max={100}
            step={1}
            className="w-[80px]"
          />
        </div>

        {/* Record button */}
        {isRecording ? (
          <button
            onClick={handleStopRecording}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors shadow-lg"
          >
            <Square className="w-6 h-6 text-white fill-current" />
          </button>
        ) : (
          <button
            onClick={handleStartRecording}
            disabled={isLoadingWaveform || isCountingDown}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg group relative"
            title="הקלט"
          >
            <div className="w-6 h-6 rounded-full bg-white" />
            <span className="absolute -bottom-8 text-white/80 text-[12px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" style={{ fontFamily: 'Discovery_Fs' }}>
              הקלט
            </span>
          </button>
        )}

        {isRecording && (
          <span className="text-red-400 font-mono animate-pulse">
            ● REC {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {/* Full Screen Countdown Overlay */}
      {isCountingDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <span 
              className="text-[200px] font-bold text-[#D4A853] animate-pulse drop-shadow-2xl"
              style={{ fontFamily: 'Discovery_Fs', textShadow: '0 0 60px rgba(212, 168, 83, 0.5)' }}
            >
              {countdown}
            </span>
            <p 
              className="text-[32px] text-white/80 mt-4"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              מתכוננים להקלטה...
            </p>
          </div>
        </div>
      )}

      {/* DAW Timeline Container */}
      <div 
        ref={timelineRef}
        className="w-full max-w-[1000px] bg-[#1a1a2e] rounded-lg overflow-hidden border border-white/10"
      >
        {/* Time Ruler - RTL: 0:00 on right, max on left */}
        <div className="h-[25px] bg-[#0d0d1a] border-b border-white/10 flex" dir="rtl">
          <div className="w-[100px] border-l border-white/10" />
          <div className="flex-1 relative">
            {[0, 0.25, 0.5, 0.75, 1].map((percent, i) => (
              <span 
                key={i}
                className="absolute text-[10px] text-white/40 font-mono"
                style={{ right: `${(1 - percent) * 100}%`, transform: 'translateX(50%)' }}
              >
                {formatTime(percent * totalDuration)}
              </span>
            ))}
          </div>
        </div>

        {/* Background Music Track */}
        <div className="flex border-b border-white/10" dir="rtl">
          <div className="w-[100px] bg-[#0d0d1a] p-2 border-l border-white/10 flex flex-col justify-center">
            <span className="text-[11px] text-[#D4A853] font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
              🎵 מוזיקת רקע
            </span>
          </div>
          <div 
            className="flex-1 h-[60px] relative cursor-pointer"
            onClick={handleTimelineClick}
          >
            {/* Progress overlay - RTL: fills from right */}
            <div 
              className="absolute inset-y-0 right-0 bg-[#D4A853]/10 pointer-events-none"
              style={{ width: `${(currentPlaybackTime / totalDuration) * 100}%` }}
            />
            
            {/* Waveform - RTL: fills entire width from right to left */}
            <div className="absolute inset-0 flex items-center p-2" dir="rtl">
              {isLoadingWaveform ? (
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="w-6 h-6 text-[#D4A853] animate-spin" />
                </div>
              ) : (
                <div className="flex items-center w-full h-full gap-[1px]">
                  {backgroundWaveform.map((height, i) => {
                    const barProgress = i / WAVEFORM_BARS;
                    const playProgress = currentPlaybackTime / totalDuration;
                    const isPlayed = barProgress <= playProgress;
                    return (
                      <div 
                        key={i}
                        className={`flex-1 min-w-[1px] rounded-full transition-colors ${
                          isPlayed ? 'bg-[#D4A853]' : 'bg-[#D4A853]/30'
                        }`}
                        style={{ height: `${Math.max(10, height)}%` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Playhead - RTL: moves from right to left */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-white z-10 pointer-events-none"
              style={{ left: `${(1 - currentPlaybackTime / totalDuration) * 100}%` }}
            >
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white absolute -top-1 left-1/2 -translate-x-1/2" />
            </div>
          </div>
        </div>

        {/* Recording Tracks */}
        {Array.from({ length: Math.max(1, usedTracks + 1, MAX_TRACKS) }).slice(0, MAX_TRACKS).map((_, trackIndex) => (
          <div key={trackIndex} className="flex border-b border-white/10 last:border-b-0" dir="rtl">
            <div 
              className={`w-[100px] bg-[#0d0d1a] p-2 border-l border-white/10 flex flex-col justify-center cursor-pointer ${
                currentTrack === trackIndex ? 'bg-[#1a1a2e]' : ''
              }`}
              onClick={() => setCurrentTrack(trackIndex)}
            >
              <span 
                className={`text-[11px] font-bold ${currentTrack === trackIndex ? 'text-[#D4A853]' : 'text-white/60'}`}
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                🎤 ערוץ {trackIndex + 1}
              </span>
            </div>
            <div 
              className="flex-1 h-[60px] bg-[#0d0d1a]/50 relative cursor-pointer"
              onClick={handleTimelineClick}
            >
              {/* Segments on this track */}
              {tracksWithSegments[trackIndex]?.map(segment => {
                const pos = getSegmentPosition(segment);
                return (
                  <div
                    key={segment.id}
                    className={`absolute top-1 bottom-1 rounded cursor-move ${
                      selectedSegment === segment.id ? 'ring-2 ring-[#D4A853]' : ''
                    }`}
                    style={{
                      ...pos,
                      background: 'linear-gradient(180deg, rgba(212, 168, 83, 0.3) 0%, rgba(212, 168, 83, 0.1) 100%)',
                      border: '1px solid rgba(212, 168, 83, 0.5)'
                    }}
                    onClick={(e) => handleSegmentClick(e, segment.id)}
                    onMouseDown={(e) => handleSegmentDragStart(e, segment)}
                  >
                    {/* Segment waveform - fill entire segment width */}
                    <div className="absolute inset-0 flex items-center p-1 overflow-hidden" dir="rtl">
                      <div className="flex items-center w-full h-full gap-[1px]">
                        {segment.waveform.length > 0 ? (
                          segment.waveform.map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 min-w-[1px] bg-[#D4A853] rounded-full"
                              style={{ height: `${Math.max(20, h)}%` }}
                            />
                          ))
                        ) : (
                          // Fallback placeholder if no waveform data
                          Array.from({ length: 30 }).map((_, i) => (
                            <div
                              key={i}
                              className="flex-1 min-w-[1px] bg-[#D4A853] rounded-full"
                              style={{ height: `${30 + Math.sin(i * 0.5) * 20}%` }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                    
                    {/* Delete button - always visible */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSegment(segment.id);
                      }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 z-20 shadow-md"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                );
              })}

              {/* Live recording indicator - RTL position */}
              {isRecording && currentTrack === trackIndex && (
                <div
                  className="absolute top-1 bottom-1 rounded bg-red-500/30 border border-red-500"
                  style={{
                    left: `${((totalDuration - recordingStartTimeRef.current - recordingTime) / totalDuration) * 100}%`,
                    width: `${(recordingTime / totalDuration) * 100}%`,
                    minWidth: '4px'
                  }}
                >
                  <div className="absolute inset-0 flex items-center gap-[1px] p-1 overflow-hidden justify-end" dir="rtl">
                    {liveRecordingWaveform.slice(-30).map((h, i) => (
                      <div
                        key={i}
                        className="w-[2px] bg-[#D4A853] rounded-full flex-shrink-0"
                        style={{ height: `${Math.max(20, h)}%` }}
                      />
                    ))}
                  </div>
                  <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              )}

              {/* Playhead - RTL: moves from right to left */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-white/50 z-10 pointer-events-none"
                style={{ left: `${(1 - currentPlaybackTime / totalDuration) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-[1000px] mt-4 flex justify-between items-center px-4" dir="rtl">
        <button
          onClick={onBack}
          className="h-[45px] px-6 rounded-[25px] bg-white/10 text-white hover:bg-white/20 transition-colors"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ← חזרה
        </button>
        
        <button
          onClick={handleSaveRecording}
          disabled={segments.length === 0 || isUploading}
          className="h-[45px] px-8 rounded-[25px] bg-[#D4A853] text-[#742551] font-bold hover:bg-[#c49843] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              שומר...
            </>
          ) : (
            'שמור וסיים →'
          )}
        </button>
      </div>
    </div>
  );
}
