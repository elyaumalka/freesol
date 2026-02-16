import { useState, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause } from "lucide-react";

interface NewProjectStep8Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function NewProjectStep8({ projectData, updateProjectData, onNext, onBack }: NewProjectStep8Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const totalDuration = 56; // 0:56

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= totalDuration) {
            setIsRecording(false);
            setIsPaused(true);
            return prev;
          }
          return prev + 1;
        });
        // Add waveform bar
        setWaveformBars(prev => [...prev, Math.random() * 100]);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setIsPaused(false);
    } else {
      setIsPaused(!isPaused);
    }
  };

  const getCurrentVerseLabel = () => {
    const currentIndex = (projectData as any).currentVerseIndex || 0;
    const verse = projectData.verses[currentIndex];
    if (!verse) return 'בית ראשון';
    
    if (verse.type === 'chorus') {
      const chorusCount = projectData.verses.slice(0, currentIndex + 1).filter(v => v.type === 'chorus').length;
      return `פזמון ${chorusCount === 1 ? 'ראשון' : chorusCount === 2 ? 'שני' : chorusCount}`;
    }
    const verseCount = projectData.verses.slice(0, currentIndex + 1).filter(v => v.type === 'verse').length;
    return `בית ${verseCount === 1 ? 'ראשון' : verseCount === 2 ? 'שני' : verseCount}`;
  };

  // Calculate waveform progress
  const progressPercentage = (recordingTime / totalDuration) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {/* Microphone Icon */}
      <div className="mb-6">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M40 8C35.5817 8 32 11.5817 32 16V40C32 44.4183 35.5817 48 40 48C44.4183 48 48 44.4183 48 40V16C48 11.5817 44.4183 8 40 8Z" stroke="#D4A853" strokeWidth="3" fill="none"/>
          <path d="M24 36V40C24 48.8366 31.1634 56 40 56C48.8366 56 56 48.8366 56 40V36" stroke="#D4A853" strokeWidth="3" strokeLinecap="round"/>
          <path d="M40 56V68" stroke="#D4A853" strokeWidth="3" strokeLinecap="round"/>
          <path d="M32 68H48" stroke="#D4A853" strokeWidth="3" strokeLinecap="round"/>
          {/* Sound waves */}
          <path d="M20 28C20 28 16 32 16 40C16 48 20 52 20 52" stroke="#D4A853" strokeWidth="2" strokeLinecap="round" opacity={isRecording && !isPaused ? "1" : "0.3"}/>
          <path d="M60 28C60 28 64 32 64 40C64 48 60 52 60 52" stroke="#D4A853" strokeWidth="2" strokeLinecap="round" opacity={isRecording && !isPaused ? "1" : "0.3"}/>
        </svg>
      </div>

      {/* Recording Label */}
      <h2 
        className="text-[32px] font-bold text-[#D4A853] mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטת {getCurrentVerseLabel()}
      </h2>

      {/* Time Display */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-8 px-4">
        <span 
          className="text-[36px] font-bold text-[#D4A853]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {formatTime(recordingTime)}
        </span>
        <span 
          className="text-[36px] font-bold text-[#D4A853]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Record Button */}
      <button
        onClick={toggleRecording}
        className="w-[120px] h-[120px] rounded-full flex items-center justify-center mb-8 transition-all hover:scale-105"
        style={{
          background: '#DC2626',
          boxShadow: '0 0 0 8px rgba(255,255,255,0.3)'
        }}
      >
        {isRecording && !isPaused ? (
          <Pause className="w-12 h-12 text-white" />
        ) : (
          <Play className="w-12 h-12 text-white ml-2" />
        )}
      </button>

      {/* Waveform */}
      <div className="w-full max-w-[900px] h-[80px] flex items-center relative">
        {/* Recorded waveform */}
        <div 
          className="h-full flex items-center gap-[2px] overflow-hidden"
          style={{ width: `${progressPercentage}%` }}
        >
          {waveformBars.map((height, i) => (
            <div 
              key={i}
              className="w-[3px] bg-[#D4A853] rounded-full flex-shrink-0"
              style={{ height: `${Math.max(20, height)}%` }}
            />
          ))}
        </div>
        
        {/* Remaining line */}
        <div 
          className="h-[2px] bg-white/50"
          style={{ width: `${100 - progressPercentage}%` }}
        />
      </div>

    </div>
  );
}
