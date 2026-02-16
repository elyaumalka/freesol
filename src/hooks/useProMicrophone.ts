import { useState, useRef, useCallback, useEffect } from 'react';

interface ProMicrophoneOptions {
  defaultGain?: number;
  enableCompressor?: boolean;
}

interface ProMicrophoneResult {
  // State
  micGain: number;
  setMicGain: (gain: number) => void;
  vuLevel: number;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  isInitialized: boolean;

  // Methods
  initMicrophone: (deviceId?: string) => Promise<MediaStream>;
  getProcessedStream: () => MediaStream | null;
  getAnalyser: () => AnalyserNode | null;
  cleanup: () => void;
}

/**
 * Professional microphone hook with:
 * - GainNode for volume boost (1-4x, default 2.5)
 * - CompressorNode for stable singing levels
 * - Device selection (enumerateDevices)
 * - VU meter (AnalyserNode)
 * - Recording from processed stream (after Gain/Compressor)
 * 
 * Audio chain: Mic -> GainNode -> CompressorNode -> Destination (for recording)
 *                                                -> AnalyserNode (for VU meter)
 */
export function useProMicrophone(options?: ProMicrophoneOptions): ProMicrophoneResult {
  const defaultGain = options?.defaultGain ?? 2.5;
  const enableCompressor = options?.enableCompressor ?? true;

  const [micGain, setMicGainState] = useState(defaultGain);
  const [vuLevel, setVuLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vuAnimFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  // Enumerate audio input devices
  const refreshDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (!selectedDeviceId && audioInputs.length > 0) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
    }
  }, [selectedDeviceId]);

  // Listen for device changes
  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  // Update gain in real-time
  const setMicGain = useCallback((gain: number) => {
    const clampedGain = Math.max(1, Math.min(4, gain));
    setMicGainState(clampedGain);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedGain;
    }
  }, []);

  // VU meter animation loop
  const startVuMeter = useCallback(() => {
    const update = () => {
      if (analyserNodeRef.current && isActiveRef.current) {
        const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
        analyserNodeRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVuLevel(Math.min(100, (avg / 255) * 100));
        vuAnimFrameRef.current = requestAnimationFrame(update);
      }
    };
    vuAnimFrameRef.current = requestAnimationFrame(update);
  }, []);

  const stopVuMeter = useCallback(() => {
    if (vuAnimFrameRef.current) {
      cancelAnimationFrame(vuAnimFrameRef.current);
      vuAnimFrameRef.current = null;
    }
    setVuLevel(0);
  }, []);

  // Initialize microphone with full audio chain
  const initMicrophone = useCallback(async (deviceId?: string): Promise<MediaStream> => {
    // Cleanup previous
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
    }
    stopVuMeter();

    const constraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    };

    // Try to set sampleRate (not supported everywhere)
    try {
      (constraints as any).sampleRate = 48000;
    } catch {}

    const targetDeviceId = deviceId || selectedDeviceId;
    if (targetDeviceId) {
      constraints.deviceId = { exact: targetDeviceId };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    streamRef.current = stream;

    // Refresh devices after getting permission (labels now available)
    refreshDevices();

    // Create AudioContext
    const ctx = new AudioContext({ sampleRate: 48000 });
    audioContextRef.current = ctx;

    // Source
    const source = ctx.createMediaStreamSource(stream);

    // GainNode
    const gainNode = ctx.createGain();
    gainNode.gain.value = micGain;
    gainNodeRef.current = gainNode;

    // CompressorNode (gentle, for singing)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.knee.value = 10;
    compressorNodeRef.current = compressor;

    // AnalyserNode (for VU meter + waveform)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserNodeRef.current = analyser;

    // Destination (for recording)
    const destination = ctx.createMediaStreamDestination();
    destinationRef.current = destination;

    // Wire the chain: source -> gain -> compressor -> destination + analyser
    source.connect(gainNode);
    if (enableCompressor) {
      gainNode.connect(compressor);
      compressor.connect(destination);
      compressor.connect(analyser);
    } else {
      gainNode.connect(destination);
      gainNode.connect(analyser);
    }

    isActiveRef.current = true;
    setIsInitialized(true);
    startVuMeter();

    return destination.stream;
  }, [selectedDeviceId, micGain, enableCompressor, refreshDevices, startVuMeter, stopVuMeter]);

  // Get the processed stream (after Gain/Compressor)
  const getProcessedStream = useCallback((): MediaStream | null => {
    return destinationRef.current?.stream || null;
  }, []);

  // Get analyser for external waveform use
  const getAnalyser = useCallback((): AnalyserNode | null => {
    return analyserNodeRef.current;
  }, []);

  // Cleanup everything
  const cleanup = useCallback(() => {
    isActiveRef.current = false;
    stopVuMeter();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    gainNodeRef.current = null;
    compressorNodeRef.current = null;
    analyserNodeRef.current = null;
    destinationRef.current = null;
    setIsInitialized(false);
  }, [stopVuMeter]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    micGain,
    setMicGain,
    vuLevel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isInitialized,
    initMicrophone,
    getProcessedStream,
    getAnalyser,
    cleanup,
  };
}
