import { useState, useEffect } from "react";
import { ProjectData, SongSection, SectionRecording } from "@/pages/customer/NewProject";
import { Play, Pause, Mic, Plus, Volume2, AlertCircle } from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useDualAudioPlayer } from "@/hooks/useDualAudioPlayer";
interface ReadyToRecordProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onStartRecording: (sectionIndex: number, isAdditionalTrack?: boolean) => void;
  onBack: () => void;
  onSaveWithProcessing: () => void;
  onSaveWithoutProcessing: () => void;
  onSwitchToFreeRecording?: () => void;
}

// Default sections if none from analysis
const defaultSections: SongSection[] = [
  { type: 'intro', label: 'פתיח', startTime: 0, endTime: 15, duration: 15 },
  { type: 'verse', label: 'בית ראשון', startTime: 15, endTime: 75, duration: 60 },
  { type: 'chorus', label: 'פזמון ראשון', startTime: 75, endTime: 120, duration: 45 },
  { type: 'outro', label: 'סיום', startTime: 120, endTime: 150, duration: 30 },
];

export function ReadyToRecord({ 
  projectData, 
  updateProjectData, 
  onStartRecording, 
  onBack,
  onSaveWithProcessing,
  onSaveWithoutProcessing,
  onSwitchToFreeRecording
}: ReadyToRecordProps) {
  // Use analyzed sections or default
  const sections = projectData.songSections && projectData.songSections.length > 0 
    ? projectData.songSections 
    : defaultSections;

  // Filter to only recordable sections (verse, chorus, bridge - not intro/outro)
  const recordableSections = sections.filter(s => 
    s.type === 'verse' || s.type === 'chorus' || s.type === 'bridge'
  );

  const audioPlayer = useAudioPlayer();
  const dualAudioPlayer = useDualAudioPlayer(); // For playing recording + instrumental together
  const bgMusicVolume = projectData.bgMusicVolume ?? 0.6;

  // Apply bgMusicVolume to dual audio player whenever it changes
  useEffect(() => {
    dualAudioPlayer.setInstrumentalVolume(bgMusicVolume);
  }, [bgMusicVolume]);
  const [playingSectionIndex, setPlayingSectionIndex] = useState<number | null>(null);
  const [playingSectionEndTime, setPlayingSectionEndTime] = useState<number | null>(null);
  const [playingRecordingIndex, setPlayingRecordingIndex] = useState<number | null>(null);

  // Auto-stop when reaching section end time (original working logic)
  useEffect(() => {
    if (playingSectionIndex !== null && playingSectionEndTime !== null && audioPlayer.isPlaying) {
      // Check if we've reached or passed the end time (with small tolerance for timing precision)
      if (audioPlayer.currentTime >= playingSectionEndTime - 0.1) {
        console.log('Auto-stopping at section end:', audioPlayer.currentTime, 'endTime:', playingSectionEndTime);
        audioPlayer.pause();
        audioPlayer.seek(0); // Reset to beginning
        setPlayingSectionIndex(null);
        setPlayingSectionEndTime(null);
      }
    }
  }, [audioPlayer.currentTime, audioPlayer.isPlaying, playingSectionIndex, playingSectionEndTime]);

  // Auto-stop dual audio when reaching section duration
  useEffect(() => {
    const section = playingRecordingIndex !== null ? recordableSections[playingRecordingIndex] : null;
    if (playingRecordingIndex !== null && section && dualAudioPlayer.isPlaying) {
      if (dualAudioPlayer.currentTime >= section.duration - 0.1) {
        console.log('Auto-stopping recording preview at duration:', dualAudioPlayer.currentTime);
        dualAudioPlayer.pause();
        dualAudioPlayer.seek(0);
        setPlayingRecordingIndex(null);
      }
    }
  }, [dualAudioPlayer.currentTime, dualAudioPlayer.isPlaying, playingRecordingIndex, recordableSections]);

  // Check if a section has a recording from projectData
  const hasRecording = (index: number): string | undefined => {
    const section = recordableSections[index];
    return section?.userRecordingUrl;
  };

  // Get all recordings for a section
  const getSectionRecordings = (index: number): SectionRecording[] => {
    const section = recordableSections[index];
    return section?.recordings || [];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlaySection = (index: number, section: SongSection) => {
    if (playingSectionIndex === index && audioPlayer.isPlaying) {
      audioPlayer.pause();
      setPlayingSectionIndex(null);
      setPlayingSectionEndTime(null);
    } else {
      // Prefer pre-cut segment file, fallback to full instrumental with seeking
      const segmentUrl = section.segmentUrl;
      const playbackUrl = segmentUrl || projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
      if (playbackUrl) {
        audioPlayer.loadAudio(playbackUrl);
        setTimeout(() => {
          if (!segmentUrl && section.startTime) {
            audioPlayer.seek(section.startTime);
          }
          // Apply user's volume preference
          const audioEl = (audioPlayer as any).audioRef?.current;
          if (audioEl) audioEl.volume = bgMusicVolume;
          audioPlayer.play();
        }, 100);
        setPlayingSectionIndex(index);
        // For segment files, end time is the duration; for full file, use absolute endTime
        setPlayingSectionEndTime(segmentUrl ? section.duration : section.endTime);
      }
    }
  };

  const getSectionLabel = (section: SongSection, index: number) => {
    // If the section already has a good label, use it
    if (section.label && !['בית', 'פזמון', 'ברידג׳'].includes(section.label)) {
      return section.label;
    }

    // Generate numbered labels
    const sameTypeSections = recordableSections.filter(s => s.type === section.type);
    const typeIndex = sameTypeSections.findIndex(s => s === section) + 1;
    
    const typeLabels: Record<string, string> = {
      'verse': 'בית',
      'chorus': 'פזמון',
      'bridge': 'ברידג׳',
    };

    const baseLabel = typeLabels[section.type] || section.label;
    
    if (sameTypeSections.length > 1) {
      const ordinals = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
      return `${baseLabel} ${ordinals[typeIndex - 1] || typeIndex}`;
    }
    
    return baseLabel;
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 max-h-[calc(100vh-250px)]">
        {/* Two Column Layout - RTL: Right = Playback, Left = Recording */}
        <div className="w-full flex gap-8" dir="rtl">
          {/* Right Column - Playback/Music */}
          <div className="flex-1">
            <h2 
              className="text-[28px] font-bold text-[#D4A853] mb-4 text-right"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              מוזיקת רקע/פלייבק
            </h2>
            
            <div className="space-y-3">
              {recordableSections.map((section, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-[10px] bg-white"
                >
                  {/* Section Label */}
                  <span 
                    className="text-[18px] font-bold text-[#742551]"
                    style={{ fontFamily: 'Discovery_Fs' }}
                  >
                    {getSectionLabel(section, index)}
                  </span>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Duration */}
                  <span className="text-[14px] text-gray-600" style={{ fontFamily: 'Discovery_Fs' }}>
                    {formatDuration(section.duration)}
                  </span>

                  {/* Preview listen button */}
                  <button
                    onClick={() => handlePlaySection(index, section)}
                    className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-bold text-white"
                    style={{ 
                      fontFamily: 'Discovery_Fs',
                      background: '#D4A853'
                    }}
                  >
                    {playingSectionIndex === index && audioPlayer.isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    שמיעה מקדימה
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-[1px] bg-white/30" />

          {/* Left Column - Recordings */}
          <div className="flex-1">
            <h2 
              className="text-[28px] font-bold text-[#D4A853] mb-4 text-right"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              הקלטה
            </h2>
            
            <div className="space-y-3">
              {recordableSections.map((section, index) => {
                const recordingUrl = hasRecording(index);
                const additionalRecordings = getSectionRecordings(index);
                const isPlayingThisRecording = playingRecordingIndex === index && dualAudioPlayer.isPlaying;
                
                return (
                  <div key={index} className="space-y-2">
                    {/* Main Recording Row */}
                    <div 
                      className="flex items-center gap-3 p-3 rounded-[10px] bg-white"
                    >
                      {/* Duration - show current time when playing this recording */}
                      <div className="flex items-center gap-4 text-[14px] text-gray-500" style={{ fontFamily: 'Discovery_Fs' }}>
                        <span>{formatDuration(section.duration)}</span>
                        <span>
                          {isPlayingThisRecording 
                            ? dualAudioPlayer.formattedCurrentTime 
                            : '0:00'}
                        </span>
                      </div>

                      {/* Waveform / Play */}
                      <div className="flex-1 flex items-center gap-2">
                        {/* Waveform visualization */}
                        <div className="flex-1 h-[40px] flex items-center">
                          {recordingUrl ? (
                            <div className="w-full h-full flex items-center gap-[2px]">
                              {Array.from({ length: 50 }).map((_, i) => (
                                <div 
                                  key={i}
                                  className="w-[2px] bg-[#D4A853]"
                                  style={{ height: `${20 + Math.random() * 60}%` }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="w-full h-[2px] bg-gray-300" />
                          )}
                        </div>

                        {/* Play recording button - plays voice + instrumental together */}
                        {recordingUrl && (
                          <button 
                            onClick={() => {
                              if (isPlayingThisRecording) {
                                dualAudioPlayer.pause();
                                setPlayingRecordingIndex(null);
                              } else {
                                // Prefer pre-cut segment file over full instrumental
                                const segUrl = section.segmentUrl;
                                const instrumentalUrl = segUrl || projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
                                if (instrumentalUrl) {
                                  dualAudioPlayer.loadAudio(recordingUrl, instrumentalUrl);
                                  setTimeout(() => {
                                    // Only seek if using full file (no segment)
                                    if (!segUrl && section.startTime) {
                                      dualAudioPlayer.seekInstrumental(section.startTime);
                                    }
                                    dualAudioPlayer.play();
                                    setPlayingRecordingIndex(index);
                                  }, 100);
                                }
                              }
                            }}
                            className="w-8 h-8 rounded-full bg-[#742551] flex items-center justify-center"
                          >
                            {isPlayingThisRecording ? (
                              <Pause className="w-4 h-4 text-white fill-current" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Record/Re-record button */}
                      <button
                        onClick={() => onStartRecording(index, false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-bold text-white"
                        style={{ 
                          fontFamily: 'Discovery_Fs',
                          background: recordingUrl ? '#4ECDC4' : '#D4A853'
                        }}
                      >
                        <Mic className="w-4 h-4" />
                        {recordingUrl ? 'הקלטה מחדש' : 'תחילת הקלטה'}
                      </button>

                      {/* Add Additional Track Button - inside the white card */}
                      {recordingUrl && (
                        <button
                          onClick={() => onStartRecording(index, true)}
                          className="flex items-center gap-2 px-3 py-2 rounded-[6px] text-[12px] font-bold text-[#D4A853] border border-[#D4A853]/50 hover:bg-[#D4A853]/10 transition-all"
                          style={{ fontFamily: 'Discovery_Fs' }}
                        >
                          <Plus className="w-3 h-3" />
                          הוסף קול נוסף / הרמוניה
                        </button>
                      )}
                    </div>

                    {/* Additional Recording Layers */}
                    {additionalRecordings.length > 0 && (
                      <div className="mr-6 space-y-2">
                        {additionalRecordings.map((rec) => (
                          <div 
                            key={rec.id}
                            className="flex items-center gap-3 p-2 rounded-[8px] bg-white/80"
                          >
                            <Volume2 className="w-4 h-4 text-[#742551]" />
                            <span className="text-[12px] text-[#742551]" style={{ fontFamily: 'Discovery_Fs' }}>
                              {rec.label}
                            </span>
                            <div className="flex-1" />
                            <button 
                              onClick={() => {
                                const segUrl = section.segmentUrl;
                                const instrumentalUrl = segUrl || projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
                                if (instrumentalUrl) {
                                  dualAudioPlayer.loadAudio(rec.audioUrl, instrumentalUrl);
                                  setTimeout(() => {
                                    if (!segUrl && section.startTime) {
                                      dualAudioPlayer.seekInstrumental(section.startTime);
                                    }
                                    dualAudioPlayer.play();
                                  }, 100);
                                }
                              }}
                              className="w-6 h-6 rounded-full bg-[#742551]/20 flex items-center justify-center"
                            >
                              <Play className="w-3 h-3 text-[#742551] fill-current ml-0.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info about analyzed sections + Free Recording Option */}
        {projectData.songSections && projectData.songSections.length > 0 && (
          <div className="w-full mt-6 p-4 rounded-lg bg-[#D4A853]/20 border border-[#D4A853]/40">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-[#D4A853] text-center flex-1" style={{ fontFamily: 'Discovery_Fs' }}>
                ניתוח אוטומטי: נמצאו {projectData.songSections.length} חלקים בשיר 
                ({recordableSections.length} להקלטה)
              </p>
              {onSwitchToFreeRecording && (
                <button
                  onClick={onSwitchToFreeRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent border border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10 transition-all"
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  <AlertCircle className="w-4 h-4" />
                  לא מרוצה מהחלוקה?
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Buttons - Fixed at bottom */}
      <div className="shrink-0 w-full flex justify-between items-center pt-4 border-t border-white/20">
        {/* Back Button - Right side in RTL */}
        <button
          onClick={onBack}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all text-white hover:bg-white/10"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          חזרה →
        </button>
        
        {/* Action Buttons - Left side in RTL */}
        <div className="flex gap-4">
          <button
            onClick={onSaveWithoutProcessing}
            className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            ← שמירה ללא עיבוד
          </button>
          <button
            onClick={onSaveWithProcessing}
            className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold text-[#742551] transition-all"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#D4A853'
            }}
          >
            ← שמירה וסיום עיבוד
          </button>
        </div>
      </div>
    </div>
  );
}
