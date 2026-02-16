import { useState, useRef, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause, Download, RotateCcw, Mail } from "lucide-react";
import { toast } from "sonner";
import { SendEmailDialog } from "@/components/customer/SendEmailDialog";
import { supabase } from "@/integrations/supabase/client";

interface NarrationFinishProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onReRecord: () => void;
  onExit: () => void;
}

export function NarrationFinish({
  projectData,
  updateProjectData,
  onReRecord,
  onExit
}: NarrationFinishProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Fetch user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    };
    fetchUserInfo();
  }, []);

  const handlePlayPause = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(projectData.recordedAudioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = async () => {
    if (!projectData.recordedAudioUrl) return;
    
    try {
      const response = await fetch(projectData.recordedAudioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectData.projectName || 'narration'}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('ההקלטה הורדה בהצלחה');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('שגיאה בהורדת הקובץ');
    }
  };

  const handleSendEmail = () => {
    if (projectData.recordedAudioUrl) {
      setShowEmailDialog(true);
    } else {
      toast.error('אין קובץ אודיו לשליחה');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[800px] mx-auto flex-1">
      {/* Finish Card */}
      <div className="bg-white rounded-[20px] p-8 w-full">
        <h2 
          className="text-[28px] font-bold text-[#742551] text-center mb-2"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ההקלטה מוכנה! 🎉
        </h2>
        <p 
          className="text-[20px] text-[#742551]/70 text-center mb-8"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {projectData.projectName}
        </p>

        {/* Player */}
        <div className="flex items-center gap-4 bg-gray-100 rounded-xl p-4 mb-8">
          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-[#742551] flex items-center justify-center hover:opacity-90 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" fill="white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-1" fill="white" />
            )}
          </button>

          {/* Waveform placeholder */}
          <div className="flex-1 h-12 bg-gray-200 rounded-lg flex items-center px-4">
            <div className="flex items-center gap-1 w-full">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[#D4A853] rounded-full"
                  style={{
                    height: `${Math.random() * 30 + 10}px`,
                    opacity: currentTime > 0 && i < (currentTime / (projectData.songDuration || 60)) * 40 ? 1 : 0.4
                  }}
                />
              ))}
            </div>
          </div>

          <span 
            className="text-[18px] text-[#742551] min-w-[60px]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={onReRecord}
            className="flex items-center gap-2 h-[50px] px-6 rounded-full border-2 border-[#742551] text-[#742551] hover:bg-[#742551]/10 transition-all"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            <RotateCcw className="w-5 h-5" />
            הקלטה מחדש
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 h-[50px] px-6 rounded-full bg-[#D4A853] text-[#742551] hover:opacity-90 transition-all"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            <Download className="w-5 h-5" />
            הורדה
          </button>

          <button
            onClick={handleSendEmail}
            className="flex items-center gap-2 h-[50px] px-6 rounded-full bg-[#742551] text-white hover:opacity-90 transition-all"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            <Mail className="w-5 h-5" />
            שליחה למייל
          </button>
        </div>
      </div>

      {/* Exit Button */}
      <button
        onClick={onExit}
        className="mt-8 h-[50px] px-8 rounded-full text-[20px] text-white border-2 border-white hover:bg-white/10 transition-all"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        סיום ויציאה
      </button>

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        audioUrl={projectData.recordedAudioUrl || ''}
        songName={projectData.projectName || 'הקלטה'}
        customerName={userName}
        defaultEmail={userEmail}
      />
    </div>
  );
}