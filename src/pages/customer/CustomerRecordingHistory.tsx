import { useState } from "react";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { RecordingCard } from "@/components/customer/RecordingCard";
import { Search, Loader2 } from "lucide-react";
import { useCustomerRecordings } from "@/hooks/useCustomerData";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { format } from "date-fns";
import { toast } from "sonner";

export default function CustomerRecordingHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const { data: recordings, isLoading } = useCustomerRecordings();
  const audioPlayer = useAudioPlayer({
    onEnded: () => setPlayingRecordingId(null)
  });

  const filteredRecordings = recordings?.filter(recording =>
    recording.song_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handlePlayRecording = async (recordingId: string, audioUrl: string | null) => {
    if (!audioUrl) {
      toast.error('אין קובץ שמע להפעלה');
      return;
    }
    
    // If same recording is playing, stop it
    if (playingRecordingId === recordingId && audioPlayer.isPlaying) {
      audioPlayer.stop();
      setPlayingRecordingId(null);
      return;
    }
    
    // Play recording
    try {
      console.log('Playing audio from:', audioUrl);
      audioPlayer.loadAudio(audioUrl);
      await audioPlayer.play();
      setPlayingRecordingId(recordingId);
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('שגיאה בהפעלת הקובץ');
      setPlayingRecordingId(null);
    }
  };

  const handleDownloadRecording = async (audioUrl: string | null, songName: string) => {
    if (!audioUrl) {
      toast.error('אין קובץ להורדה');
      return;
    }
    try {
      console.log('Downloading audio from:', audioUrl);
      
      const link = document.createElement('a');
      link.href = audioUrl;
      const extension = audioUrl.includes('.mp3') ? 'mp3' : 'webm';
      link.download = `${songName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
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
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 
          className="font-light text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-3xl)' }}
        >
          היסטוריית הקלטות
        </h1>
        
        {/* Search */}
        <div 
          className="flex items-center bg-white rounded-full border border-gray-200"
          style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)' }}
        >
          <input
            type="text"
            placeholder="חיפוש הקלטה"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-right"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', width: 'clamp(100px, 10vw, 180px)' }}
          />
          <Search style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="text-gray-400" />
        </div>
      </div>

      {/* Recordings Grid */}
      <div 
        className="bg-white"
        style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)' }}
      >
        {isLoading ? (
          <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
            <Loader2 style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="animate-spin text-[#742551]" />
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="text-center text-[#742551]/60" style={{ padding: 'var(--space-2xl)', fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}>
            {searchQuery ? 'לא נמצאו הקלטות' : 'אין הקלטות עדיין'}
          </div>
        ) : (
          <div 
            className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5"
            style={{ gap: 'var(--space-lg)' }}
          >
            {filteredRecordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                songName={recording.song_name}
                recordingDate={formatDate(recording.created_at)}
                duration={recording.duration}
                isPlaying={playingRecordingId === recording.id && audioPlayer.isPlaying}
                onPlay={() => handlePlayRecording(recording.id, recording.audio_url)}
                onDownload={() => handleDownloadRecording(recording.audio_url, recording.song_name)}
              />
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}