import { useState, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Mic, Pause } from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

interface AIRecordingScreenProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onStartRecording: (verseIndex: number) => void;
  onBack: () => void;
  onCreatePlayback: () => void;
  onSaveWithoutProcessing: () => void;
}

export function AIRecordingScreen({ 
  projectData, 
  updateProjectData, 
  onStartRecording, 
  onBack,
  onCreatePlayback,
  onSaveWithoutProcessing
}: AIRecordingScreenProps) {
  const verses = projectData.verses;

  const getVerseLabel = (verse: typeof verses[0], index: number) => {
    if (verse.type === 'chorus') {
      const chorusCount = verses.slice(0, index + 1).filter(v => v.type === 'chorus').length;
      return `פזמון ${chorusCount === 1 ? 'ראשון' : chorusCount === 2 ? 'שני' : chorusCount}`;
    }
    const verseCount = verses.slice(0, index + 1).filter(v => v.type === 'verse').length;
    return `בית ${verseCount === 1 ? 'ראשון' : verseCount === 2 ? 'שני' : verseCount}`;
  };

  // Check if verse has recording
  const hasRecording = (index: number) => {
    return !!verses[index]?.audioUrl;
  };

  // Get recording duration for a verse
  const getRecordingDuration = (index: number) => {
    const verse = verses[index];
    if (!verse?.audioUrl) return "0:00";
    // Duration will be stored in verse data
    return verse.duration || "0:00";
  };

  // Check if all verses have recordings
  const allRecorded = verses.every((_, index) => hasRecording(index));

  return (
    <div className="flex flex-col items-center w-full">
      {/* Title */}
      <h2 
        className="text-[36px] font-bold text-[#D4A853] mb-2 text-right w-full"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הקלטה
      </h2>
      
      {/* Subtitle */}
      <p 
        className="text-[20px] text-[#D4A853] mb-8 text-right w-full"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        בכדי שנוכל ליצור לך פלייבק מותאם עבורך יש להקליט את השיר
      </p>

      {/* Recording Cards */}
      <div className="w-full max-w-[800px] space-y-4 mb-8">
        {verses.map((verse, index) => (
          <VerseRecordingCard
            key={verse.id}
            verse={verse}
            index={index}
            label={getVerseLabel(verse, index)}
            hasRecording={hasRecording(index)}
            duration={getRecordingDuration(index)}
            onStartRecording={() => onStartRecording(index)}
          />
        ))}
      </div>

      {/* Bottom Buttons */}
      <div className="w-full flex justify-end items-center gap-4">
        <button
          onClick={onSaveWithoutProcessing}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          שמירה ללא עיבוד
        </button>
        <button
          onClick={onCreatePlayback}
          disabled={!allRecorded}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold text-[#742551] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            fontFamily: 'Discovery_Fs',
            background: '#D4A853'
          }}
        >
          ליצירת הפלייבק ←
        </button>
      </div>
    </div>
  );
}

interface VerseRecordingCardProps {
  verse: { id: number; type: 'verse' | 'chorus'; text: string; audioUrl?: string; duration?: string };
  index: number;
  label: string;
  hasRecording: boolean;
  duration: string;
  onStartRecording: () => void;
}

function VerseRecordingCard({ 
  verse, 
  index, 
  label, 
  hasRecording, 
  duration,
  onStartRecording 
}: VerseRecordingCardProps) {
  const { isPlaying, currentTime, duration: audioDuration, toggle, loadAudio } = useAudioPlayer();

  useEffect(() => {
    if (verse.audioUrl) {
      loadAudio(verse.audioUrl);
    }
  }, [verse.audioUrl, loadAudio]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-[15px] bg-white">
      {/* Verse Label */}
      <span 
        className="text-[20px] font-bold text-[#742551] min-w-[120px] text-right"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {label}
      </span>

      {/* Duration */}
      <div className="flex items-center gap-4 text-[14px] text-gray-500" style={{ fontFamily: 'Discovery_Fs' }}>
        <span>{hasRecording ? (verse.duration || formatTime(audioDuration)) : '0:00'}</span>
        <span>{formatTime(currentTime)}</span>
      </div>

      {/* Waveform / Play */}
      <div className="flex-1 flex items-center gap-3">
        {/* Waveform visualization */}
        <div className="flex-1 h-[50px] flex items-center">
          {hasRecording ? (
            <div className="w-full h-full flex items-center gap-[2px]">
              {Array.from({ length: 60 }).map((_, i) => (
                <div 
                  key={i}
                  className="w-[2px] bg-[#D4A853]"
                  style={{ 
                    height: `${20 + Math.sin(i * 0.3) * 30 + Math.random() * 20}%`,
                    opacity: hasRecording ? 1 : 0.3
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-[2px] bg-gray-300" />
          )}
        </div>
        
        <button 
          onClick={toggle}
          disabled={!hasRecording}
          className="w-10 h-10 rounded-full bg-[#742551] flex items-center justify-center disabled:opacity-50"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Re-record button */}
      <button
        onClick={onStartRecording}
        className="flex items-center gap-2 px-5 py-3 rounded-[10px] text-[16px] font-bold text-white"
        style={{ 
          fontFamily: 'Discovery_Fs',
          background: '#D4A853'
        }}
      >
        <Mic className="w-5 h-5" />
        {hasRecording ? 'הקלטה מחדש' : 'תחילת הקלטה'}
      </button>
    </div>
  );
}
