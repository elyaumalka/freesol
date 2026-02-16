import { useState, useRef, useEffect, useCallback } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause, Mic, Trash2, Square, Loader2, Scissors, Volume2, VolumeX, SkipBack } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { useProMicrophone } from "@/hooks/useProMicrophone";
import { MicSettingsPanel } from "@/components/customer/new-project/MicSettingsPanel";

interface FreeRecordingModeProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onBack: () => void;
  onSaveWithProcessing: () => void;
  onSaveWithoutProcessing: () => void;
}

interface TimelineSegment {
  id: string;
  startTime: number; // Position on timeline (in seconds)
  duration: number;
  audioUrl: string;
  audioBlob: Blob;
  waveform: number[];
  trackIndex: number; // Which track this segment is on
}

const WAVEFORM_BARS = 150;
const TRACK_HEIGHT = 60;
const MAX_TRACKS = 5;

export function FreeRecordingMode({
  projectData,
  updateProjectData,
  onBack,
  onSaveWithProcessing,
  onSaveWithoutProcessing
}: FreeRecordingModeProps) {
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [backgroundWaveform, setBackgroundWaveform] = useState<number[]>([]);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
  
  // Pro microphone hook
  const proMic = useProMicrophone({ defaultGain: 2.5, enableCompressor: true });
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
  const timelineRef = useRef<HTMLDivElement>(null);
  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingDurationRef = useRef<number>(0); // Track duration in ref to avoid state timing issues
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveWaveformRef = useRef<number[]>([]);

  // Get background music URL (instrumental)
  const backgroundMusicUrl = projectData.instrumentalUrl || projectData.generatedPlaybackUrl;

  // Total song duration
  const totalDuration = projectData.songDuration || 180;

  // Analyze audio file and generate real waveform data
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

  // Initialize background music - without crossOrigin to avoid CORS issues
  useEffect(() => {
    if (backgroundMusicUrl) {
      console.log("Loading background music:", backgroundMusicUrl);
      
      // Create audio element WITHOUT crossOrigin to avoid CORS playback issues
      const audio = new Audio();
      audio.src = backgroundMusicUrl;
      audio.volume = backgroundVolume;
      audio.preload = "auto";
      audio.loop = false;
      backgroundAudioRef.current = audio;

      // Track progress
      audio.addEventListener('timeupdate', () => {
        setCurrentPlaybackTime(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        setIsBackgroundPlaying(false);
      });

      audio.addEventListener('canplaythrough', () => {
        console.log("Background music ready to play, duration:", audio.duration);
      });

      audio.addEventListener('loadeddata', () => {
        console.log("Background music data loaded");
      });

      audio.addEventListener('error', (e) => {
        console.error("Background music load error:", e, audio.error);
      });

      // Force load the audio
      audio.load();

      // Analyze waveform separately (this may fail due to CORS but we have fallback)
      setIsLoadingWaveform(true);
      analyzeAudioWaveform(backgroundMusicUrl)
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
  }, [backgroundMusicUrl]);

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
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
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
    };
  }, []);

  // Handle countdown and start recording
  const handleStartRecording = async () => {
    try {
      // Check if background audio is ready
      if (!backgroundAudioRef.current) {
        toast.error('מוזיקת רקע לא נטענה עדיין');
        return;
      }

      // Initialize pro microphone (Gain + Compressor chain)
      const processedStream = await proMic.initMicrophone();
      
      streamRef.current = processedStream;
      
      // Prepare background audio - DON'T play yet, just set position
      const bgAudio = backgroundAudioRef.current;
      bgAudio.currentTime = currentPlaybackTime;
      bgAudio.volume = isMuted ? 0 : backgroundVolume;
      
      // Start countdown (music NOT playing during countdown)
      setIsCountingDown(true);
      setCountdown(5);

      // Countdown - music stays paused
      for (let i = 5; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setIsCountingDown(false);

      // Save the start time on the timeline
      recordingStartTimeRef.current = bgAudio.currentTime;
      
      // NOW start the background music exactly when recording begins
      try {
        await bgAudio.play();
        console.log("Background music started at:", bgAudio.currentTime);
      } catch (playError) {
        console.error("Background music play error:", playError);
        toast.error('שגיאה בהפעלת מוזיקת רקע');
      }
      
      setIsBackgroundPlaying(true);
      console.log("Recording starting at:", recordingStartTimeRef.current);

      // Now start recording with processed stream
      startActualRecording(processedStream);
      
    } catch (error) {
      console.error('Error getting microphone:', error);
      if ((error as Error).name === 'NotAllowedError') {
        toast.error('נא לאשר גישה למיקרופון');
      } else {
        toast.error('שגיאה בהפעלת המיקרופון');
      }
    }
  };

  // Actually start recording
  const startActualRecording = (processedStream: MediaStream) => {
    setIsRecording(true);
    isRecordingRef.current = true;
    liveWaveformRef.current = [];
    setLiveRecordingWaveform([]); // Reset live waveform display
    
    // Use analyser from pro mic hook
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
      
      // Get waveform for the segment
      const segmentWaveform = [...liveWaveformRef.current];
      
      // Use ref for duration since state may have been reset
      const finalDuration = recordingDurationRef.current;
      console.log("Saving segment with duration:", finalDuration);
      
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

    // Start timer - update both state and ref
    timerRef.current = setInterval(() => {
      recordingDurationRef.current += 1;
      setRecordingTime(prev => prev + 1);
    }, 1000);

    // Start waveform capture with state updates for live display
    const updateWaveform = () => {
      if (analyserRef.current && isRecordingRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(100, (average / 255) * 150);
        liveWaveformRef.current.push(normalized);
        
        // Update state every 3 frames for smooth visual without too many re-renders
        if (liveWaveformRef.current.length % 3 === 0) {
          setLiveRecordingWaveform([...liveWaveformRef.current]);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  };

  // Stop recording
  const handleStopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setLiveRecordingWaveform([]); // Clear live waveform display
    
    // Pause background music
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

  // Delete segment
  const handleDeleteSegment = (segmentId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segmentId));
    if (selectedSegment === segmentId) {
      setSelectedSegment(null);
    }
    toast.success('הקטע נמחק');
  };

  // Ref to track active segment audio players
  const activeSegmentAudiosRef = useRef<HTMLAudioElement[]>([]);

  // Stop all segment audio
  const stopAllSegmentAudios = () => {
    activeSegmentAudiosRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeSegmentAudiosRef.current = [];
  };

  // Play all from beginning with all segments
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

  // Schedule segment playback based on their start times
  // Use a ref to get the latest segments to avoid closure issues
  const segmentsRef = useRef<TimelineSegment[]>([]);
  segmentsRef.current = segments;

  const scheduleSegmentPlayback = (fromTime: number) => {
    // Use ref to get latest segments
    const currentSegments = segmentsRef.current;
    
    console.log("Scheduling playback from:", fromTime, "segments:", currentSegments.length);
    
    currentSegments.forEach(segment => {
      const segmentEnd = segment.startTime + segment.duration;
      
      // Check if segment should play (either starts after fromTime, or is currently in progress)
      if (segmentEnd > fromTime) {
        let delay = 0;
        let seekTime = 0;
        
        if (segment.startTime >= fromTime) {
          // Segment starts in the future
          delay = (segment.startTime - fromTime) * 1000;
        } else {
          // Segment already started - play from current position
          seekTime = fromTime - segment.startTime;
        }
        
        console.log("Segment:", segment.id, "delay:", delay, "seekTime:", seekTime);
        
        setTimeout(() => {
          if (backgroundAudioRef.current && !backgroundAudioRef.current.paused) {
            const audio = new Audio(segment.audioUrl);
            audio.volume = 1;
            
            if (seekTime > 0) {
              audio.currentTime = seekTime;
            }
            
            activeSegmentAudiosRef.current.push(audio);
            audio.play()
              .then(() => console.log("Playing segment:", segment.id))
              .catch(err => console.error("Error playing segment:", err));
            
            // Auto-cleanup when segment ends
            audio.addEventListener('ended', () => {
              const idx = activeSegmentAudiosRef.current.indexOf(audio);
              if (idx > -1) activeSegmentAudiosRef.current.splice(idx, 1);
            });
          }
        }, delay);
      }
    });
  };

  // Play/Pause background music with segments
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

  // Seek on timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = 1 - (clickX / rect.width); // RTL
    const newTime = percentage * totalDuration;
    
    if (backgroundAudioRef.current) {
      // Stop current segment playback
      stopAllSegmentAudios();
      
      backgroundAudioRef.current.currentTime = Math.max(0, Math.min(newTime, totalDuration));
      setCurrentPlaybackTime(backgroundAudioRef.current.currentTime);
      
      // If playing, reschedule segment playback from new position
      if (!backgroundAudioRef.current.paused) {
        scheduleSegmentPlayback(backgroundAudioRef.current.currentTime);
      }
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate segment position on timeline (as percentage) - RTL
  // In RTL: time 0 is on the RIGHT, so segment starts from the right based on startTime
  const getSegmentPositionRight = (segment: TimelineSegment) => {
    // Position from RIGHT edge = (startTime / totalDuration) * 100
    return (segment.startTime / totalDuration) * 100;
  };

  const getSegmentWidth = (segment: TimelineSegment) => {
    return Math.max((segment.duration / totalDuration) * 100, 1); // Min 1%
  };

  // Calculate playhead position from RIGHT - RTL
  const playheadPositionFromRight = (currentPlaybackTime / totalDuration) * 100;

  // Get tracks with their segments
  const getTracksWithSegments = () => {
    const tracks: TimelineSegment[][] = [];
    for (let i = 0; i < MAX_TRACKS; i++) {
      tracks.push(segments.filter(s => s.trackIndex === i));
    }
    return tracks;
  };

  // Drag handlers for moving segments
  const handleSegmentDragStart = (e: React.MouseEvent, segmentId: string, startTime: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingSegment(segmentId);
    setDragStartX(e.clientX);
    setDragStartTime(startTime);
    setSelectedSegment(segmentId);
  };

  const handleSegmentDragMove = (e: React.MouseEvent) => {
    if (!draggingSegment || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    // RTL: moving right (positive deltaX) = earlier time, moving left = later time
    const deltaTime = -(deltaX / rect.width) * totalDuration;
    const newStartTime = Math.max(0, Math.min(totalDuration, dragStartTime + deltaTime));
    
    setSegments(prev => prev.map(seg => 
      seg.id === draggingSegment 
        ? { ...seg, startTime: newStartTime }
        : seg
    ));
  };

  const handleSegmentDragEnd = () => {
    if (draggingSegment) {
      // Keep the segment selected after drag
      const draggedId = draggingSegment;
      setDraggingSegment(null);
      // Ensure selection persists
      setTimeout(() => setSelectedSegment(draggedId), 0);
      toast.success('מיקום הקטע עודכן');
    }
  };

  // Save all segments
  const handleSaveWithProcessing = async () => {
    if (segments.length === 0) {
      toast.error('אין קטעים מוקלטים לשמירה');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('יש להתחבר מחדש');
        return;
      }

      const uploadedUrls: string[] = [];
      
      for (const segment of segments) {
        const fileName = `free-recording/${user.id}/segment_${segment.id}_${Date.now()}.webm`;
        
        const { error } = await supabase.storage
          .from('recordings')
          .upload(fileName, segment.audioBlob, {
            contentType: 'audio/webm',
            upsert: true
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('recordings')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      updateProjectData({
        songSections: [{
          type: 'verse',
          label: 'הקלטה חופשית',
          startTime: 0,
          endTime: totalDuration,
          duration: totalDuration,
          userRecordingUrl: uploadedUrls[0],
          recordings: uploadedUrls.slice(1).map((url, i) => ({
            id: `free-${i}`,
            audioUrl: url,
            label: `קטע ${i + 2}`,
            createdAt: Date.now()
          }))
        }]
      });

      onSaveWithProcessing();
    } catch (error) {
      console.error('Error uploading segments:', error);
      toast.error('שגיאה בהעלאת ההקלטות');
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
      {/* Header - Compact */}
      <h2 
        className="text-[22px] font-bold text-white mb-2 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטה חופשית - עורך טיימליין
      </h2>

      {/* Transport Controls - Compact */}
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
          style={{ background: isBackgroundPlaying ? '#4ECDC4' : '#215F66' }}
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

        {/* Mic Settings */}
        {!isRecording && (
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
        )}

        {/* Record button */}
        {isRecording ? (
          <button
            onClick={handleStopRecording}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors shadow-lg"
            title="עצור"
          >
            <Square className="w-6 h-6 text-white fill-current" />
          </button>
        ) : (
          <div className="relative group">
            <button
              onClick={handleStartRecording}
              disabled={isLoadingWaveform || isCountingDown}
              className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              title="הקלט"
            >
              <div className="w-6 h-6 rounded-full bg-white" />
            </button>
            {/* Hover tooltip */}
            <span 
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              הקלט
            </span>
          </div>
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
        {/* Time Ruler */}
        <div className="h-[25px] bg-[#0d0d1a] border-b border-white/10 flex" dir="rtl">
          <div className="w-[100px] border-l border-white/10" />
          <div className="flex-1 relative">
            {[0, 0.25, 0.5, 0.75, 1].map((percent, i) => (
              <span 
                key={i}
                className="absolute text-[10px] text-white/40 font-mono"
                style={{ right: `${percent * 100}%`, transform: 'translateX(50%)' }}
              >
                {formatTime(percent * totalDuration)}
              </span>
            ))}
          </div>
        </div>

        {/* Background Music Track */}
        <div className="flex border-b border-white/10" dir="rtl">
          <div className="w-[100px] bg-[#0d0d1a] p-2 border-l border-white/10 flex flex-col justify-center">
            <span className="text-[11px] text-[#4ECDC4] font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
              🎵 מוזיקת רקע
            </span>
          </div>
          <div 
            className="flex-1 h-[60px] relative cursor-pointer"
            onClick={handleTimelineClick}
            style={{ background: 'linear-gradient(to bottom, rgba(78, 205, 196, 0.1), rgba(78, 205, 196, 0.05))' }}
          >
            {isLoadingWaveform ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#4ECDC4] animate-spin" />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center gap-[1px] px-1">
                {backgroundWaveform.map((height, i) => {
                  const barPosition = i / WAVEFORM_BARS;
                  const isPlayed = barPosition < (currentPlaybackTime / totalDuration);
                  
                  return (
                    <div 
                      key={i}
                      className={`flex-1 rounded-sm transition-colors ${
                        isPlayed ? 'bg-[#4ECDC4]' : 'bg-[#4ECDC4]/30'
                      }`}
                      style={{ height: `${Math.max(8, height * 0.5)}%` }}
                    />
                  );
                })}
              </div>
            )}
            
            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-[#D4A853] z-20 pointer-events-none"
              style={{ right: `${playheadPositionFromRight}%` }}
            >
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#D4A853] absolute -top-0 -translate-x-[5px]" />
            </div>
          </div>
        </div>

        {/* Recording Tracks */}
        {Array.from({ length: Math.max(usedTracks + 1, 2) }).slice(0, MAX_TRACKS).map((_, trackIndex) => {
          const trackSegments = segments.filter(s => s.trackIndex === trackIndex);
          const isCurrentTrack = trackIndex === currentTrack;
          
          return (
            <div 
              key={trackIndex} 
              className={`flex border-b border-white/10 cursor-pointer ${isCurrentTrack ? 'bg-[#D4A853]/5' : ''}`}
              onClick={() => setCurrentTrack(trackIndex)}
              dir="rtl"
            >
              <div className="w-[100px] bg-[#0d0d1a] p-2 border-l border-white/10 flex flex-col justify-center">
                <span 
                  className={`text-[11px] font-bold ${isCurrentTrack ? 'text-[#D4A853]' : 'text-white/60'}`}
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  🎤 ערוץ {trackIndex + 1}
                </span>
                {isCurrentTrack && (
                  <span className="text-[9px] text-[#D4A853]/60">פעיל</span>
                )}
              </div>
              <div 
                className="flex-1 relative"
                style={{ 
                  height: `${TRACK_HEIGHT}px`,
                  background: isCurrentTrack 
                    ? 'linear-gradient(to bottom, rgba(212, 168, 83, 0.1), rgba(212, 168, 83, 0.02))'
                    : 'linear-gradient(to bottom, rgba(255,255,255,0.02), transparent)'
                }}
              >
                {/* Segments on this track */}
                {trackSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className={`absolute top-[4px] bottom-[4px] rounded transition-all select-none ${
                      draggingSegment === segment.id 
                        ? 'ring-2 ring-white shadow-xl cursor-grabbing z-20 scale-105' 
                        : selectedSegment === segment.id 
                          ? 'ring-2 ring-white shadow-lg cursor-grab' 
                          : 'hover:ring-1 hover:ring-white/50 cursor-grab'
                    }`}
                    style={{
                      right: `${getSegmentPositionRight(segment)}%`,
                      width: `${getSegmentWidth(segment)}%`,
                      minWidth: '20px',
                      background: draggingSegment === segment.id 
                        ? 'linear-gradient(to bottom, #E8C06A, #D4A853)' 
                        : 'linear-gradient(to bottom, #D4A853, #B8923F)'
                    }}
                    onMouseDown={(e) => handleSegmentDragStart(e, segment.id, segment.startTime)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draggingSegment) {
                        setSelectedSegment(segment.id === selectedSegment ? null : segment.id);
                      }
                    }}
                  >
                    {/* Segment waveform */}
                    <div className="absolute inset-0 flex items-center gap-[1px] px-1 overflow-hidden pointer-events-none">
                      {segment.waveform.map((h, i) => (
                        <div 
                          key={i}
                          className="w-[2px] bg-[#742551]/60 rounded-full flex-shrink-0"
                          style={{ height: `${Math.max(20, h * 0.6)}%` }}
                        />
                      ))}
                    </div>
                    
                    {/* Delete button - positioned inside segment */}
                    {selectedSegment === segment.id && !draggingSegment && (
                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteSegment(segment.id);
                        }}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors z-30"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    )}

                    {/* Drag hint - only show if no delete button visible */}
                    {selectedSegment === segment.id && !draggingSegment && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[9px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded mr-6">
                          גרור
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Live Recording Indicator - Real-time waveform like background music */}
                {isRecording && isCurrentTrack && (
                  <div
                    className="absolute top-[4px] bottom-[4px] rounded overflow-hidden"
                    style={{
                      right: `${(recordingStartTimeRef.current / totalDuration) * 100}%`,
                      width: `${(recordingTime / totalDuration) * 100}%`,
                      minWidth: liveRecordingWaveform.length > 0 ? '8px' : '0px',
                      background: 'linear-gradient(to bottom, rgba(212, 168, 83, 0.15), rgba(212, 168, 83, 0.05))',
                      borderRight: '2px solid #ef4444'
                    }}
                  >
                    {/* Live waveform bars - styled like background music */}
                    <div className="absolute inset-0 flex items-center gap-[1px] px-0.5 overflow-hidden" dir="ltr">
                      {liveRecordingWaveform.slice(-100).map((h, i) => {
                        // Calculate which bars are "played" based on position
                        const barPosition = i / Math.max(liveRecordingWaveform.slice(-100).length, 1);
                        
                        return (
                          <div 
                            key={i}
                            className="flex-1 rounded-sm transition-all"
                            style={{ 
                              height: `${Math.max(10, h * 0.5)}%`,
                              background: '#D4A853',
                              minWidth: '2px',
                              maxWidth: '4px'
                            }}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Recording indicator dot */}
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                )}

                {/* Playhead on this track too */}
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-[#D4A853] z-10 pointer-events-none"
                  style={{ right: `${playheadPositionFromRight}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recording Info */}
      {isRecording && (
        <div className="mt-4 text-center">
          <p className="text-white/60 text-[14px]" style={{ fontFamily: 'Discovery_Fs' }}>
            מקליט על ערוץ {currentTrack + 1} • מתחיל מ-{formatTime(recordingStartTimeRef.current)}
          </p>
        </div>
      )}

      {/* Compact Segments Info */}
      {segments.length > 0 && (
        <div className="w-full max-w-[1000px] mt-2 p-2 rounded-lg bg-white/5">
          <div className="flex items-center gap-3" dir="rtl">
            <span className="text-[12px] text-[#D4A853]" style={{ fontFamily: 'Discovery_Fs' }}>
              {segments.length} קטעים
            </span>
            <div className="flex flex-wrap gap-1 flex-1">
              {segments.map((seg, i) => (
                <div 
                  key={seg.id}
                  className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-all ${
                    selectedSegment === seg.id 
                      ? 'bg-[#D4A853] text-[#742551]' 
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                  onClick={() => setSelectedSegment(seg.id === selectedSegment ? null : seg.id)}
                >
                  {formatTime(seg.startTime)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Buttons - Compact */}
      <div className="w-full max-w-[1000px] flex justify-between items-center mt-4">
        <button
          onClick={onBack}
          className="text-[16px] text-[#D4A853] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ← חזרה לחלוקה רגילה
        </button>

        <div className="flex gap-3">
          <button
            onClick={onSaveWithoutProcessing}
            disabled={segments.length === 0}
            className="h-[40px] px-6 rounded-[20px] text-[14px] font-bold transition-all border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10 disabled:opacity-50"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            שמירה ללא עיבוד
          </button>
          <button
            onClick={handleSaveWithProcessing}
            disabled={segments.length === 0}
            className="h-[40px] px-6 rounded-[20px] text-[14px] font-bold text-[#742551] transition-all disabled:opacity-50"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: segments.length > 0 ? '#D4A853' : '#D4A853/50'
            }}
          >
            שמירה וסיום עיבוד
          </button>
        </div>
      </div>
    </div>
  );
}
