import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseAudioRecorderOptions {
  onRecordingComplete?: (audioUrl: string, duration: number) => void;
}

export function useAudioRecorder(options?: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const recordingTimeRef = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isRecordingRef.current = false;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      };
      try { (constraints as any).sampleRate = 48000; } catch {}

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      
      streamRef.current = stream;
      setPermissionDenied(false);
      isRecordingRef.current = true;
      
      // Setup audio chain: Source -> GainNode -> CompressorNode -> Destination + Analyser
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      
      // GainNode for mic boost
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 2.5;
      
      // CompressorNode for stable singing levels
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      compressor.knee.value = 10;
      
      // Analyser for waveform
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Destination for recording
      const destination = audioContext.createMediaStreamDestination();
      
      // Wire: source -> gain -> compressor -> destination + analyser
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(destination);
      compressor.connect(analyser);
      
      const boostedStream = destination.stream;

      // Determine supported MIME type - prioritize cross-browser compatibility
      const mimeTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log('Selected MIME type:', type);
          break;
        }
      }
      
      if (!selectedMimeType) {
        console.warn('No supported MIME type found, using browser default');
      }

      const mediaRecorder = new MediaRecorder(boostedStream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
      
      // Store the actual MIME type being used
      const actualMimeType = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
      console.log('MediaRecorder using MIME type:', actualMimeType);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        console.log('Recording completed. Blob type:', blob.type, 'Size:', blob.size);
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        options?.onRecordingComplete?.(url, recordingTimeRef.current);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      setWaveformData([]);

      // Start timer
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start waveform animation using ref to check recording state
      const updateWaveform = () => {
        if (analyserRef.current && isRecordingRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setWaveformData(prev => {
            const newData = [...prev, average];
            // Keep last 50 bars
            return newData.slice(-50);
          });
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateWaveform);

    } catch (error) {
      console.error('Error starting recording:', error);
      if ((error as Error).name === 'NotAllowedError') {
        setPermissionDenied(true);
        toast.error('נא לאשר גישה למיקרופון');
      } else {
        toast.error('שגיאה בהפעלת המיקרופון');
      }
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
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
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  }, []);

  const resetRecording = useCallback(() => {
    cleanup();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    setAudioUrl(null);
    setAudioBlob(null);
    setWaveformData([]);
  }, [cleanup]);

  const uploadRecording = useCallback(async (projectId: string, verseName: string): Promise<string | null> => {
    if (!audioBlob) {
      toast.error('אין הקלטה להעלאה');
      return null;
    }

    try {
      const timestamp = Date.now();
      const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedVerseName = verseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      // Determine file extension based on blob type
      let extension = 'webm';
      const blobType = audioBlob.type;
      if (blobType.includes('mp4') || blobType.includes('m4a')) {
        extension = 'm4a';
      } else if (blobType.includes('ogg')) {
        extension = 'ogg';
      } else if (blobType.includes('wav')) {
        extension = 'wav';
      }
      
      const fileName = `${sanitizedProjectId}/${sanitizedVerseName}_${timestamp}.${extension}`;
      
      console.log('Uploading recording to:', fileName, 'Content-Type:', blobType);
      
      const { data, error } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioBlob, {
          contentType: blobType || 'audio/webm',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('Upload successful:', data);

      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      console.log('Public URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading recording:', error);
      toast.error('שגיאה בהעלאת ההקלטה');
      return null;
    }
  }, [audioBlob]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioUrl,
    audioBlob,
    waveformData,
    permissionDenied,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    uploadRecording,
  };
}
