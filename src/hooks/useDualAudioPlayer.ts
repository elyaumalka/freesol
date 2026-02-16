import { useState, useRef, useCallback, useEffect } from "react";

interface UseDualAudioPlayerReturn {
  isPlaying: boolean;
  vocalsVolume: number;
  instrumentalVolume: number;
  currentTime: number;
  duration: number;
  formattedCurrentTime: string;
  formattedDuration: string;
  setVocalsVolume: (volume: number) => void;
  setInstrumentalVolume: (volume: number) => void;
  seekInstrumental: (time: number) => void;
  loadAudio: (vocalsUrl: string, instrumentalUrl: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

export function useDualAudioPlayer(): UseDualAudioPlayerReturn {
  const vocalsRef = useRef<HTMLAudioElement | null>(null);
  const instrumentalRef = useRef<HTMLAudioElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [vocalsVolume, setVocalsVolumeState] = useState(0.8);
  const [instrumentalVolume, setInstrumentalVolumeState] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadAudio = useCallback((vocalsUrl: string, instrumentalUrl: string) => {
    // Clean up existing audio elements
    if (vocalsRef.current) {
      vocalsRef.current.pause();
      vocalsRef.current = null;
    }
    if (instrumentalRef.current) {
      instrumentalRef.current.pause();
      instrumentalRef.current = null;
    }

    console.log("Loading dual audio:");
    console.log("  Vocals:", vocalsUrl);
    console.log("  Instrumental:", instrumentalUrl);

    // Create new audio elements
    const vocalsAudio = new Audio(vocalsUrl);
    const instrumentalAudio = new Audio(instrumentalUrl);

    vocalsAudio.volume = vocalsVolume;
    instrumentalAudio.volume = instrumentalVolume;

    // Use instrumental duration as the master (usually longer)
    instrumentalAudio.addEventListener('loadedmetadata', () => {
      setDuration(instrumentalAudio.duration);
      console.log("Instrumental duration:", instrumentalAudio.duration);
    });

    instrumentalAudio.addEventListener('timeupdate', () => {
      setCurrentTime(instrumentalAudio.currentTime);
    });

    instrumentalAudio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      vocalsAudio.currentTime = 0;
      instrumentalAudio.currentTime = 0;
    });

    vocalsRef.current = vocalsAudio;
    instrumentalRef.current = instrumentalAudio;

    setIsPlaying(false);
    setCurrentTime(0);
  }, [vocalsVolume, instrumentalVolume]);

  const play = useCallback(() => {
    if (vocalsRef.current && instrumentalRef.current) {
      // Sync times before playing
      vocalsRef.current.currentTime = instrumentalRef.current.currentTime;
      
      Promise.all([
        vocalsRef.current.play(),
        instrumentalRef.current.play()
      ]).then(() => {
        setIsPlaying(true);
      }).catch(error => {
        console.error("Error playing audio:", error);
      });
    }
  }, []);

  const pause = useCallback(() => {
    if (vocalsRef.current) vocalsRef.current.pause();
    if (instrumentalRef.current) instrumentalRef.current.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (vocalsRef.current) vocalsRef.current.currentTime = time;
    if (instrumentalRef.current) instrumentalRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const seekInstrumental = useCallback((time: number) => {
    if (instrumentalRef.current) instrumentalRef.current.currentTime = time;
  }, []);

  const setVocalsVolume = useCallback((volume: number) => {
    setVocalsVolumeState(volume);
    if (vocalsRef.current) {
      vocalsRef.current.volume = volume;
    }
  }, []);

  const setInstrumentalVolume = useCallback((volume: number) => {
    setInstrumentalVolumeState(volume);
    if (instrumentalRef.current) {
      instrumentalRef.current.volume = volume;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vocalsRef.current) {
        vocalsRef.current.pause();
        vocalsRef.current = null;
      }
      if (instrumentalRef.current) {
        instrumentalRef.current.pause();
        instrumentalRef.current = null;
      }
    };
  }, []);

  return {
    isPlaying,
    vocalsVolume,
    instrumentalVolume,
    currentTime,
    duration,
    formattedCurrentTime: formatTime(currentTime),
    formattedDuration: formatTime(duration),
    setVocalsVolume,
    setInstrumentalVolume,
    seekInstrumental,
    loadAudio,
    play,
    pause,
    toggle,
    seek,
  };
}
