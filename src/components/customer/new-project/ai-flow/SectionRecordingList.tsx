import { useState, useEffect, useRef } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { Play, Pause, Mic } from "lucide-react";

interface SectionRecordingListProps {
  projectData: ProjectData;
  onStartRecording: (sectionIndex: number) => void;
  onFinish: () => void;
  onBack: () => void;
}

export function SectionRecordingList({ 
  projectData, 
  onStartRecording, 
  onFinish,
  onBack 
}: SectionRecordingListProps) {
  const sections = projectData.songSections || [];
  const songUrl = projectData.generatedSongUrl;
  
  // Filter to only recordable sections
  const recordableSections = sections.filter(
    s => s.type === 'verse' || s.type === 'chorus'
  );

  // Check if all sections have recordings
  const allRecorded = recordableSections.every(s => s.userRecordingUrl);

  // Audio playback for full song
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (songUrl) {
      audioRef.current = new Audio(songUrl);
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
    }
    return () => {
      audioRef.current?.pause();
    };
  }, [songUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const playSection = (section: SongSection) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = section.startTime;
    audioRef.current.play();
    setIsPlaying(true);

    // Stop at section end
    const checkEnd = setInterval(() => {
      if (audioRef.current && audioRef.current.currentTime >= section.endTime) {
        audioRef.current.pause();
        setIsPlaying(false);
        clearInterval(checkEnd);
      }
    }, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find original section index for recording
  const getSectionOriginalIndex = (section: SongSection) => {
    return sections.findIndex(s => 
      s.startTime === section.startTime && s.type === section.type
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Title */}
      <h2 
        className="text-[36px] font-bold text-[#D4A853] mb-2 text-right w-full"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטה על המוזיקה
      </h2>
      
      {/* Subtitle */}
      <p 
        className="text-[20px] text-[#D4A853] mb-6 text-right w-full"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        כעת הקלט את הקול שלך על המוזיקה שנוצרה
      </p>

      {/* Full Song Player */}
      <div className="w-full max-w-[800px] mb-6 p-4 rounded-[15px] bg-white/10 flex items-center gap-4">
        <button 
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-[#D4A853] flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-[#742551]" />
          ) : (
            <Play className="w-6 h-6 text-[#742551] ml-0.5" />
          )}
        </button>
        <div className="flex-1">
          <p className="text-white font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
            השיר המלא
          </p>
          <p className="text-white/60 text-sm" style={{ fontFamily: 'Discovery_Fs' }}>
            {formatTime(currentTime)} / {formatTime(projectData.songDuration || 0)}
          </p>
        </div>
      </div>

      {/* Section Cards */}
      <div className="w-full max-w-[800px] space-y-4 mb-8">
        {recordableSections.map((section, displayIndex) => {
          const originalIndex = getSectionOriginalIndex(section);
          const hasRecording = !!section.userRecordingUrl;
          
          return (
            <SectionCard
              key={`${section.type}-${section.startTime}`}
              section={section}
              hasRecording={hasRecording}
              onPlay={() => playSection(section)}
              onRecord={() => onStartRecording(originalIndex)}
              formatTime={formatTime}
            />
          );
        })}
      </div>

      {/* Bottom Button - Only finish button, exit is in the layout */}
      <div className="w-full flex justify-end items-center">
        <button
          onClick={onFinish}
          disabled={!allRecorded}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold text-[#742551] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            fontFamily: 'Discovery_Fs',
            background: '#D4A853'
          }}
        >
          ← לסיום
        </button>
      </div>
    </div>
  );
}

interface SectionCardProps {
  section: SongSection;
  hasRecording: boolean;
  onPlay: () => void;
  onRecord: () => void;
  formatTime: (seconds: number) => string;
}

function SectionCard({ section, hasRecording, onPlay, onRecord, formatTime }: SectionCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-[15px] bg-white">
      {/* Record button */}
      <button
        onClick={onRecord}
        className="flex items-center gap-2 px-5 py-3 rounded-[10px] text-[16px] font-bold text-white"
        style={{ 
          fontFamily: 'Discovery_Fs',
          background: hasRecording ? '#4CAF50' : '#D4A853'
        }}
      >
        <Mic className="w-5 h-5" />
        {hasRecording ? 'הקלטה מחדש' : 'הקלט'}
      </button>

      {/* Play section button */}
      <button 
        onClick={onPlay}
        className="w-10 h-10 rounded-full bg-[#742551] flex items-center justify-center"
      >
        <Play className="w-5 h-5 text-white fill-current ml-0.5" />
      </button>
      
      {/* Time info */}
      <div className="flex-1 text-right">
        <p className="text-[14px] text-gray-500" style={{ fontFamily: 'Discovery_Fs' }}>
          {formatTime(section.startTime)} - {formatTime(section.endTime)}
        </p>
      </div>

      {/* Status indicator */}
      {hasRecording && (
        <div className="w-3 h-3 rounded-full bg-green-500" />
      )}

      {/* Section Label */}
      <span 
        className="text-[20px] font-bold text-[#742551] min-w-[120px] text-right"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {section.label}
      </span>
    </div>
  );
}
