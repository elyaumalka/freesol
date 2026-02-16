import { useEffect, useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause, Mic, Download, Send, Volume2, Check } from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useDualAudioPlayer } from "@/hooks/useDualAudioPlayer";
import { Slider } from "@/components/ui/slider";
import { saveCompletedProject, clearAutoSavedProject } from "@/lib/projectUtils";

interface FinishProcessingProps {
  projectData: ProjectData;
  onReRecord: () => void;
  onDownload: () => void;
  onSendEmail: (audioUrl: string, songName: string) => void;
  onExit: () => void;
}

export function FinishProcessing({ 
  projectData, 
  onReRecord, 
  onDownload, 
  onSendEmail,
  onExit 
}: FinishProcessingProps) {
  // Check if we have dual-track mode (vocals + instrumental separately)
  const hasDualTrack = projectData.vocalsUrl && projectData.instrumentalUrl;
  
  // Single audio player for non-dual mode
  const singlePlayer = useAudioPlayer();
  
  // Dual audio player for vocals + instrumental
  const dualPlayer = useDualAudioPlayer();

  // State for mixer visibility and save status
  const [showMixer, setShowMixer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get the appropriate player data
  const isPlaying = hasDualTrack ? dualPlayer.isPlaying : singlePlayer.isPlaying;
  const currentTime = hasDualTrack ? dualPlayer.currentTime : singlePlayer.currentTime;
  const duration = hasDualTrack ? dualPlayer.duration : singlePlayer.duration;
  const formattedCurrentTime = hasDualTrack ? dualPlayer.formattedCurrentTime : singlePlayer.formattedCurrentTime;
  const formattedDuration = hasDualTrack ? dualPlayer.formattedDuration : singlePlayer.formattedDuration;
  const toggle = hasDualTrack ? dualPlayer.toggle : singlePlayer.toggle;

  useEffect(() => {
    // Priority: use the final merged song with vocals (always prefer single file)
    const finalAudioUrl = projectData.generatedSongUrl || // Final merged song with vocals
      projectData.recordedAudioUrl || // Direct recorded audio
      projectData.generatedPlaybackUrl ||
      projectData.songSections?.find(s => s.userRecordingUrl)?.userRecordingUrl ||
      projectData.verses.find(v => v.audioUrl)?.audioUrl || null;
    
    console.log("FinishProcessing - Loading audio:", {
      generatedSongUrl: projectData.generatedSongUrl,
      recordedAudioUrl: projectData.recordedAudioUrl,
      generatedPlaybackUrl: projectData.generatedPlaybackUrl,
      vocalsUrl: projectData.vocalsUrl,
      instrumentalUrl: projectData.instrumentalUrl,
      finalAudioUrl
    });
    
    if (finalAudioUrl) {
      console.log("Loading final audio (single player):", finalAudioUrl);
      singlePlayer.loadAudio(finalAudioUrl);
    } else if (hasDualTrack) {
      // Fallback to dual track mode only if no merged file exists
      console.log("Loading dual-track audio:");
      console.log("  Vocals:", projectData.vocalsUrl);
      console.log("  Instrumental:", projectData.instrumentalUrl);
      dualPlayer.loadAudio(projectData.vocalsUrl!, projectData.instrumentalUrl!);
    } else {
      console.warn("FinishProcessing - No audio URL found to load!");
    }
  }, [projectData.generatedSongUrl, projectData.recordedAudioUrl, projectData.vocalsUrl, projectData.instrumentalUrl, projectData.generatedPlaybackUrl]);

  // Save project when component mounts
  useEffect(() => {
    if (!isSaved && !isSaving) {
      const saveData = async () => {
        setIsSaving(true);
        try {
          const result = await saveCompletedProject({
            projectData: {
              projectName: projectData.projectName,
              backgroundMusic: projectData.backgroundMusic,
              playbackId: projectData.playbackId,
              playbackName: projectData.playbackName,
              verses: projectData.verses,
              generatedPlaybackUrl: projectData.generatedPlaybackUrl,
              generatedSongUrl: projectData.generatedSongUrl,
              vocalsUrl: projectData.vocalsUrl,
              instrumentalUrl: projectData.instrumentalUrl,
              uploadedFile: null,
              recordedAudio: null,
            },
          });
          if (result.projectId) {
            setIsSaved(true);
            // Clear auto-save since project is now completed and saved
            clearAutoSavedProject();
          }
        } catch (error) {
          console.error('Error saving project:', error);
        } finally {
          setIsSaving(false);
        }
      };
      saveData();
    }
  }, [projectData, isSaved, isSaving]);

  // Calculate total duration from all recordings (fallback)
  const getTotalDuration = () => {
    if (duration > 0) {
      return formattedDuration;
    }
    // Fallback: sum up durations from verses
    let totalSeconds = 0;
    projectData.verses.forEach(verse => {
      if (verse.duration) {
        const [mins, secs] = verse.duration.split(':').map(Number);
        totalSeconds += (mins * 60) + secs;
      }
    });
    if (totalSeconds > 0) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return "0:00";
  };

  const handleDownload = async () => {
    // Prioritize the final mastered/merged song
    const audioUrl = projectData.generatedSongUrl ||  // Final merged song
                     projectData.generatedPlaybackUrl ||  // Generated playback
                     projectData.vocalsUrl ||  // Mastered vocals
                     projectData.songSections?.find(s => s.userRecordingUrl)?.userRecordingUrl ||  // Section recording
                     projectData.verses.find(v => v.audioUrl)?.audioUrl;  // Verse recording
    
    console.log('Downloading audio from:', audioUrl);
    
    if (audioUrl) {
      try {
        // Fetch the file as a blob to force download
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        const extension = audioUrl.includes('.mp3') ? 'mp3' : audioUrl.includes('.wav') ? 'wav' : 'webm';
        link.download = `${projectData.projectName || 'recording'}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download error:', error);
        // Fallback to direct link
        window.open(audioUrl, '_blank');
      }
    }
    onDownload();
  };

  const hasAudio = hasDualTrack || projectData.generatedPlaybackUrl || 
    projectData.verses.some(v => v.audioUrl);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Title with fire emoji */}
      <h1 
        className="text-[36px] font-bold text-[#D4A853] mb-8 text-center flex items-center gap-2"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        <span>🔥</span>
        <span>היצירה מוכנה, והעולם עומד לשמוע אותה.</span>
      </h1>

      {/* Audio Player Card */}
      <div className="w-full max-w-[900px] bg-white rounded-[20px] p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {/* Project Name - on the right (RTL start) */}
          <span 
            className="text-[20px] font-bold text-[#742551] whitespace-nowrap"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {projectData.projectName || 'פרויקט חדש'}
          </span>

          {/* Play Button */}
          <button 
            onClick={toggle}
            disabled={!hasAudio}
            className="w-10 h-10 rounded-full bg-[#742551] flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
            )}
          </button>

          {/* Waveform */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-[40px] flex items-center gap-[2px]">
              {Array.from({ length: 60 }).map((_, i) => {
                const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
                const barProgress = (i / 60) * 100;
                return (
                  <div 
                    key={i}
                    className="w-[2px] rounded-full transition-colors"
                    style={{ 
                      height: `${20 + Math.sin(i * 0.2) * 30 + (i % 3) * 10}%`,
                      backgroundColor: barProgress <= progress ? '#742551' : '#D4A853'
                    }}
                  />
                );
              })}
            </div>
            
            <div className="flex gap-2 text-[14px] text-gray-500" style={{ fontFamily: 'Discovery_Fs' }}>
              <span>{getTotalDuration()}</span>
              <span>{formattedCurrentTime}</span>
            </div>
          </div>

          {/* Action Buttons - reversed order (Re-record, Download, Send) */}
          <button
            onClick={onReRecord}
            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[14px] font-bold text-[#742551] whitespace-nowrap"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#D4A853'
            }}
          >
            <Mic className="w-4 h-4" />
            הקלטה מחדש
          </button>

          <button
            onClick={handleDownload}
            disabled={!hasAudio}
            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[14px] font-bold text-white disabled:opacity-50 whitespace-nowrap"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#215F66'
            }}
          >
            <Download className="w-4 h-4" />
            הורדה למחשב
          </button>

          <button
            onClick={() => {
              const audioUrl = projectData.generatedSongUrl || 
                               projectData.generatedPlaybackUrl ||
                               projectData.vocalsUrl ||
                               projectData.songSections?.find(s => s.userRecordingUrl)?.userRecordingUrl ||
                               projectData.verses.find(v => v.audioUrl)?.audioUrl || '';
              onSendEmail(audioUrl, projectData.projectName || 'הקלטה');
            }}
            disabled={!hasAudio}
            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[14px] font-bold text-white whitespace-nowrap disabled:opacity-50"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#742551'
            }}
          >
            <Send className="w-4 h-4" />
            שליחה למייל
          </button>
        </div>

        {/* Mixer Panel (only for dual track) */}
        {hasDualTrack && showMixer && (
          <div className="flex items-center gap-8 p-4 bg-gray-50 rounded-[12px]">
            <div className="flex-1 flex items-center gap-4">
              <span className="text-[14px] font-bold text-[#742551] min-w-[60px]" style={{ fontFamily: 'Discovery_Fs' }}>
                קול
              </span>
              <Slider
                value={[dualPlayer.vocalsVolume * 100]}
                onValueChange={(value) => dualPlayer.setVocalsVolume(value[0] / 100)}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-[12px] text-gray-500 min-w-[40px]">
                {Math.round(dualPlayer.vocalsVolume * 100)}%
              </span>
            </div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-[14px] font-bold text-[#742551] min-w-[60px]" style={{ fontFamily: 'Discovery_Fs' }}>
                מוזיקה
              </span>
              <Slider
                value={[dualPlayer.instrumentalVolume * 100]}
                onValueChange={(value) => dualPlayer.setInstrumentalVolume(value[0] / 100)}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-[12px] text-gray-500 min-w-[40px]">
                {Math.round(dualPlayer.instrumentalVolume * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Info text for AI flow */}
      {projectData.backgroundMusic === 'ai' && hasDualTrack && (
        <p className="text-[14px] text-white/60 mt-4 text-center" style={{ fontFamily: 'Discovery_Fs' }}>
          ניגון כפול: הקולות שלך + מוזיקת רקע שנוצרה על ידי AI • השתמש במיקסר לאיזון
        </p>
      )}

      {/* Save Status Indicator - Moved to bottom */}
      <div className="mt-6">
        {isSaving && (
          <div className="text-[14px] text-white/60 flex items-center gap-2" style={{ fontFamily: 'Discovery_Fs' }}>
            <div className="w-3 h-3 rounded-full bg-[#D4A853] animate-pulse" />
            שומר את הפרויקט...
          </div>
        )}
        {isSaved && (
          <div className="text-[14px] text-green-400 flex items-center gap-2" style={{ fontFamily: 'Discovery_Fs' }}>
            <Check className="w-4 h-4" />
            הפרויקט נשמר להיסטוריה
          </div>
        )}
      </div>
    </div>
  );
}
