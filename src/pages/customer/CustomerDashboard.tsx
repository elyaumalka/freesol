import { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { RecordingCard } from "@/components/customer/RecordingCard";
import { ProjectCard } from "@/components/customer/ProjectCard";
import { useNavigate, useSearchParams } from "react-router-dom";
import aiVoiceIcon from "@/assets/icons/ai-voice.svg";
import { useCustomerRecordings, useCustomerProjects, useCustomerHours } from "@/hooks/useCustomerData";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { toast } from "sonner";
import { PaymentSuccessDialog } from "@/components/customer/PaymentSuccessDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: recordings, isLoading: recordingsLoading } = useCustomerRecordings();
  const { data: projects, isLoading: projectsLoading } = useCustomerProjects();
  const { data: hours } = useCustomerHours();
  const audioPlayer = useAudioPlayer();
  const queryClient = useQueryClient();
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [purchasedHours, setPurchasedHours] = useState<number | undefined>();

  // Check for payment status in URL and complete purchase
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const hoursParam = searchParams.get('hours');
    const documentId = searchParams.get('DocumentID') || searchParams.get('documentid');
    
    if (paymentStatus === 'success') {
      // Get pending purchase ID from sessionStorage
      const pendingPurchaseId = sessionStorage.getItem('pending_purchase_id');
      
      if (pendingPurchaseId) {
        // Complete the purchase by calling the edge function with documentId
        supabase.functions.invoke('complete-purchase', {
          body: { 
            purchaseId: pendingPurchaseId,
            documentId: documentId || null
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error completing purchase:', error);
          } else {
            console.log('Purchase completed:', data);
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries({ queryKey: ['customer-hours'] });
            queryClient.invalidateQueries({ queryKey: ['customer-purchases'] });
          }
          // Clear the pending purchase ID
          sessionStorage.removeItem('pending_purchase_id');
        });
      }

      // Show the fancy dialog
      if (hoursParam) {
        setPurchasedHours(parseFloat(hoursParam));
      }
      setShowPaymentSuccess(true);
      searchParams.delete('payment');
      searchParams.delete('hours');
      searchParams.delete('DocumentID');
      searchParams.delete('documentid');
      setSearchParams(searchParams);
    } else if (paymentStatus === 'failed') {
      toast.error('התשלום נכשל, אנא נסה שוב');
      searchParams.delete('payment');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, queryClient]);
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'אורח';

  const recentRecordings = recordings?.slice(0, 3) || [];
  const openProjects = projects?.filter(p => p.status === 'open').slice(0, 4) || [];
  const hasMoreProjects = (projects?.filter(p => p.status === 'open').length || 0) > 4;

  const handlePlayRecording = async (audioUrl: string | null) => {
    if (!audioUrl) {
      toast.error('אין קובץ שמע להפעלה');
      return;
    }
    try {
      // If this is the same audio and it's playing, pause it
      if (audioPlayer.currentUrl === audioUrl && audioPlayer.isPlaying) {
        audioPlayer.pause();
        return;
      }
      // If this is the same audio but paused, resume it
      if (audioPlayer.currentUrl === audioUrl && !audioPlayer.isPlaying) {
        audioPlayer.play();
        return;
      }
      // Otherwise, load and play new audio
      console.log('Playing audio from:', audioUrl);
      await audioPlayer.loadAudio(audioUrl);
      audioPlayer.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('שגיאה בהפעלת הקובץ');
    }
  };

  const handleDownloadRecording = async (audioUrl: string | null, songName: string) => {
    if (!audioUrl) {
      toast.error('אין קובץ להורדה');
      return;
    }
    try {
      console.log('Downloading audio from:', audioUrl);
      
      // Fetch the file as a blob to force download
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      const extension = audioUrl.includes('.mp3') ? 'mp3' : audioUrl.includes('.wav') ? 'wav' : 'webm';
      link.download = `${songName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
      
      toast.success('הקובץ הורד בהצלחה');
    } catch (error) {
      console.error('Error downloading audio:', error);
      toast.error('שגיאה בהורדת הקובץ');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <CustomerLayout>
      {/* Payment Success Dialog */}
      <PaymentSuccessDialog 
        open={showPaymentSuccess} 
        onOpenChange={setShowPaymentSuccess}
        hoursAdded={purchasedHours}
      />
      
      {/* Full height container - with scroll */}
      <div className="h-full flex flex-col overflow-y-auto overflow-x-hidden">
        {/* Welcome Section - RIGHT aligned */}
        <div className="text-right shrink-0" style={{ marginBottom: 'var(--space-md)' }}>
          <h1 
            className="text-[#215F66]"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-3xl)' }}
          >
            <span className="font-light">שלום,</span>{" "}
            <span className="font-bold">{userName}!</span>
          </h1>
          <p 
            className="text-[#215F66] font-light"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-3xl)' }}
          >
            ברוכים הבאים לאיזור האישי שלכם.
          </p>
        </div>

        {/* Main content area - fills remaining height */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0" style={{ gap: 'var(--space-lg)' }}>
          {/* LEFT Column - Projects - flexible width */}
          <div className="flex flex-col min-h-0 flex-1 order-2 lg:order-1" style={{ gap: 'var(--space-md)' }}>
            {/* Create New Project Card */}
            <button 
              onClick={() => navigate('/customer/new-project')}
              className="text-center flex flex-col items-center justify-end w-full hover:scale-[1.02] transition-transform cursor-pointer shrink-0"
              style={{
                background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-lg)',
                height: 'clamp(120px, 15vh, 240px)'
              }}
            >
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                <img 
                  src={aiVoiceIcon} 
                  alt="Create Project" 
                  style={{ width: 'var(--icon-xl)', height: 'var(--icon-xl)' }}
                />
              </div>
              <h2 
                className="font-bold text-white"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-3xl)' }}
              >
                יצירת פרוייקט חדש
              </h2>
            </button>

            {/* Open Projects Section - Grid with 4 items max */}
            <div 
              className="shrink-0 bg-white overflow-hidden flex-1"
              style={{ 
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-md)'
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                <h3 
                  className="font-light text-[#742551]"
                  style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-lg)' }}
                >
                  פרוייקטים פתוחים
                </h3>
                <button 
                  onClick={() => navigate('/customer/open-projects')}
                  className="font-bold text-[#742551] hover:opacity-80 transition-all"
                  style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}
                >
                  לכל הפרוייקטים ←
                </button>
              </div>
              {projectsLoading ? (
                <div className="flex justify-center" style={{ padding: 'var(--space-lg)' }}>
                  <Loader2 style={{ width: 'var(--icon-md)', height: 'var(--icon-md)' }} className="animate-spin text-[#742551]" />
                </div>
              ) : openProjects.length === 0 ? (
                <div 
                  className="text-center text-[#742551]/60"
                  style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', padding: 'var(--space-lg)' }}
                >
                  אין פרויקטים פתוחים
                </div>
              ) : (
                <div 
                  className="grid grid-cols-2 lg:grid-cols-4"
                  style={{ direction: 'rtl', gap: 'var(--space-md)' }}
                >
                  {openProjects.map((project) => {
                    const verses = project.verses as any;
                    let duration = '--:--';
                    if (verses?.songDuration) {
                      const mins = Math.floor(verses.songDuration / 60);
                      const secs = Math.floor(verses.songDuration % 60);
                      duration = `${mins}:${secs.toString().padStart(2, '0')}`;
                    }
                    return (
                      <ProjectCard
                        key={project.id}
                        songName={project.song_name}
                        recordingDate={formatDate(project.created_at)}
                        duration={duration}
                        onContinueEdit={() => navigate(`/customer/new-project?resume=${project.id}`)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT Column - Recent Recordings */}
          <div 
            className="flex-shrink-0 flex flex-col order-1 lg:order-2 max-h-[200px] lg:max-h-none"
            style={{ 
              background: '#F9F9F9',
              width: 'clamp(180px, 18vw, 350px)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div className="flex items-center justify-between shrink-0" style={{ marginBottom: 'var(--space-md)' }}>
              <span 
                className="text-[#742551] whitespace-nowrap"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}
              >
                הקלטות האחרונות שלך..
              </span>
              <button 
                onClick={() => navigate('/customer/recording-history')}
                className="font-bold text-[#742551] hover:opacity-80 transition-all whitespace-nowrap"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}
              >
                להסטוריה ←
              </button>
            </div>
            
            {recordingsLoading ? (
              <div className="flex justify-center" style={{ padding: 'var(--space-xl)' }}>
                <Loader2 style={{ width: 'var(--icon-md)', height: 'var(--icon-md)' }} className="animate-spin text-[#742551]" />
              </div>
            ) : recentRecordings.length === 0 ? (
              <div 
                className="text-center text-[#742551]/60"
                style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', padding: 'var(--space-xl)' }}
              >
                אין הקלטות עדיין
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {recentRecordings.map((recording) => (
                  <RecordingCard
                    key={recording.id}
                    songName={recording.song_name}
                    recordingDate={formatDate(recording.created_at)}
                    duration={recording.duration}
                    isPlaying={audioPlayer.isPlaying && audioPlayer.currentUrl === recording.audio_url}
                    onPlay={() => handlePlayRecording(recording.audio_url)}
                    onDownload={() => handleDownloadRecording(recording.audio_url, recording.song_name)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
