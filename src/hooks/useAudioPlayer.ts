import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioPlayerOptions {
  onEnded?: () => void;
}

export function useAudioPlayer(options?: UseAudioPlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const loadAudio = useCallback((url: string) => {
    cleanup();
    setIsLoading(true);
    setCurrentUrl(url);
    
    const audio = new Audio();
    audioRef.current = audio;
    
    // Set up event listeners before setting src
    audio.addEventListener('loadedmetadata', () => {
      console.log('Audio loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    });
    
    audio.addEventListener('canplaythrough', () => {
      console.log('Audio can play through');
      setIsLoading(false);
    });
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      options?.onEnded?.();
    });
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio load error:', audio.error?.message, 'Code:', audio.error?.code);
      setIsLoading(false);
      setIsPlaying(false);
    });
    
    // For better cross-browser support, set crossOrigin before src
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = url;
    
    // Try to load the audio
    audio.load();
  }, [cleanup, options]);

  const play = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isPlaying,
    isLoading,
    currentTime,
    duration,
    currentUrl,
    progress: duration > 0 ? (currentTime / duration) * 100 : 0,
    formattedCurrentTime: formatTime(currentTime),
    formattedDuration: formatTime(duration),
    loadAudio,
    play,
    pause,
    toggle,
    seek,
    stop,
  };
}
