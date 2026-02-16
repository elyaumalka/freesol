import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Pause, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { usePlaybacks } from "@/hooks/usePlaybacks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { PlaybackPaymentDialog } from "./PlaybackPaymentDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { autoSaveProject } from "@/lib/projectUtils";

interface SearchPlaybackProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SearchPlayback({
  projectData,
  updateProjectData,
  onNext,
  onBack
}: SearchPlaybackProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaybackId, setSelectedPlaybackId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 6;
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlaybackForPayment, setSelectedPlaybackForPayment] = useState<{
    id: string;
    name: string;
    cost: number;
  } | null>(null);
  const [paidPlaybackIds, setPaidPlaybackIds] = useState<Set<string>>(new Set());
  const [userPurchasedPlaybackIds, setUserPurchasedPlaybackIds] = useState<Set<string>>(new Set());
  const {
    data: playbacks,
    isLoading
  } = usePlaybacks();
  const audioPlayer = useAudioPlayer();
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Load user's previously purchased playbacks on mount
  useEffect(() => {
    const loadUserPurchases = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: purchases } = await supabase
        .from('playback_purchases')
        .select('playback_id')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (purchases && purchases.length > 0) {
        const purchasedIds = new Set(purchases.map(p => p.playback_id));
        setUserPurchasedPlaybackIds(purchasedIds);
      }
    };

    loadUserPurchases();
  }, []);

  // Check for payment success on mount - load playback from DB since state is reset
  useEffect(() => {
    const handlePaymentReturn = async () => {
      const paymentStatus = searchParams.get("playback_payment");
      const playbackId = searchParams.get("playback_id");
      
      if (paymentStatus === "success" && playbackId) {
        // Mark playback as paid
        setPaidPlaybackIds(prev => new Set([...prev, playbackId]));
        toast.success("התשלום בוצע בהצלחה!");
        
        // Clean up URL params but keep step params
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("playback_payment");
        newParams.delete("purchase_id");
        newParams.delete("playback_id");
        setSearchParams(newParams, { replace: true });
        
        // Fetch the playback data from database since state is reset after payment redirect
        const { data: playback, error } = await supabase
          .from('playbacks')
          .select('*, artist:artists(*)')
          .eq('id', playbackId)
          .single();
        
        if (error || !playback) {
          console.error('Error fetching playback after payment:', error);
          return;
        }
        
        // Parse duration string to seconds
        let durationSeconds = 180;
        if (playback.duration) {
          const parts = playback.duration.split(':').map(Number);
          if (parts.length === 2) {
            durationSeconds = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        // Parse pre-processed sections from database
        let songSections = undefined;
        if (playback.sections && Array.isArray(playback.sections)) {
          songSections = playback.sections.map((section: any) => ({
            type: section.type,
            label: section.label,
            startTime: section.startTime,
            endTime: section.endTime,
            duration: section.duration
          }));
        }
        
        // Update project data with playback info
        const newData = {
          playbackId: playback.id,
          playbackName: playback.song_name,
          generatedPlaybackUrl: playback.audio_url,
          instrumentalUrl: playback.instrumental_url || playback.audio_url,
          songDuration: durationSeconds,
          songSections: songSections,
          backgroundMusic: 'search' as const
        };
        
        updateProjectData(newData);
        
        // Auto-save and proceed to recording
        autoSaveProject({ ...projectData, ...newData }, 'ready-record');
        
        // Proceed to next step after a short delay
        setTimeout(() => {
          audioPlayer.stop();
          onNext();
        }, 500);
        
      } else if (paymentStatus === "cancelled") {
        toast.error("התשלום בוטל");
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("playback_payment");
        setSearchParams(newParams, { replace: true });
      }
    };
    
    handlePaymentReturn();
  }, [searchParams]);

  // Filter playbacks based on search query (live filtering) AND must have audio_url AND be processed
  const filteredPlaybacks = playbacks?.filter(playback => {
    // Only show playbacks that have an audio file AND are fully processed
    if (!playback.audio_url) return false;
    if (playback.processing_status !== 'completed') return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return playback.song_name.toLowerCase().includes(query) || playback.artist?.name?.toLowerCase().includes(query);
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredPlaybacks.length / ITEMS_PER_PAGE);
  const paginatedPlaybacks = filteredPlaybacks.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };
  const handleSelectPlayback = (playback: typeof filteredPlaybacks[0]) => {
    setSelectedPlaybackId(playback.id);

    // Parse duration string to seconds (format: "MM:SS" or "HH:MM:SS")
    let durationSeconds = 180; // default
    if (playback.duration) {
      const parts = playback.duration.split(':').map(Number);
      if (parts.length === 2) {
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }

    // Parse pre-processed sections from database
    let songSections = undefined;
    if (playback.sections && Array.isArray(playback.sections)) {
      songSections = playback.sections.map((section: any) => ({
        type: section.type,
        label: section.label,
        startTime: section.startTime,
        endTime: section.endTime,
        duration: section.duration
      }));
    }
    const newData = {
      playbackId: playback.id,
      playbackName: playback.song_name,
      generatedPlaybackUrl: playback.audio_url,
      // This is now the instrumental (vocals removed)
      instrumentalUrl: playback.instrumental_url || playback.audio_url,
      // The instrumental URL
      songDuration: durationSeconds,
      songSections: songSections // Pre-processed sections from admin upload
    };
    updateProjectData(newData);
    
    // Auto-save when playback is selected
    autoSaveProject({ ...projectData, ...newData, backgroundMusic: 'search' }, 'ready-record');
  };
  const handlePlayPreview = (playback: typeof filteredPlaybacks[0]) => {
    // Use original_audio_url as fallback if audio_url is from replicate (expired)
    const audioUrl = playback.audio_url?.includes('replicate.delivery') 
      ? playback.original_audio_url || playback.audio_url
      : playback.audio_url;
    
    if (playingId === playback.id) {
      audioPlayer.toggle();
      if (audioPlayer.isPlaying) {
        setPlayingId(null);
      }
    } else {
      if (audioUrl) {
        audioPlayer.loadAudio(audioUrl);
        audioPlayer.play();
        setPlayingId(playback.id);
      }
    }
  };
  const handleContinue = () => {
    if (!selectedPlaybackId) return;
    
    const selectedPlayback = playbacks?.find(p => p.id === selectedPlaybackId);
    if (!selectedPlayback) return;
    
    // Check if playback has a cost, hasn't been paid in this session, 
    // AND user hasn't purchased it before
    const alreadyPurchased = userPurchasedPlaybackIds.has(selectedPlaybackId);
    const paidInSession = paidPlaybackIds.has(selectedPlaybackId);
    
    if (selectedPlayback.cost > 0 && !paidInSession && !alreadyPurchased) {
      setSelectedPlaybackForPayment({
        id: selectedPlayback.id,
        name: selectedPlayback.song_name,
        cost: selectedPlayback.cost,
      });
      setShowPaymentDialog(true);
      return;
    }
    
    // Playback is free, already paid in session, or previously purchased - continue
    audioPlayer.stop();
    onNext();
  };

  const handlePaymentSuccess = () => {
    if (selectedPlaybackForPayment) {
      setPaidPlaybackIds(prev => new Set([...prev, selectedPlaybackForPayment.id]));
    }
    setShowPaymentDialog(false);
    audioPlayer.stop();
    onNext();
  };
  const formatPrice = (price: number | null) => {
    if (!price || price === 0) return 'חינם';
    return `${price}₪`;
  };
  return <div className="flex flex-col items-center w-full max-w-[1000px] mx-auto">
      {/* Search Input */}
      <div className="w-full max-w-[800px] mb-4 mx-auto">
        <p className="text-[14px] lg:text-[18px] xl:text-[20px] text-[#D4A853] text-right mb-2" style={{
        fontFamily: 'Discovery_Fs'
      }}>
          הזינו את שם השיר או האמן
        </p>
        <div className="relative w-full">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="לדוגמא: צעקה או מרדכי בן דוד" className="w-full h-[40px] lg:h-[50px] pr-4 pl-4 rounded-[25px] text-right text-[14px] lg:text-[18px] bg-white text-[#333] placeholder:text-[#742551]/60 placeholder:text-right" style={{
          fontFamily: 'Discovery_Fs'
        }} dir="rtl" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#D4A853] animate-spin" />
        </div>}

      {/* Results Grid with Navigation */}
      {!isLoading && (
        <div className="w-full max-w-[900px] mt-6 relative">
          {/* Navigation Arrows */}
          <div className="flex items-center gap-4">
            {/* Left Arrow - Previous */}
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                currentPage === 0
                  ? 'bg-white/20 cursor-not-allowed'
                  : 'bg-white hover:bg-white/90 cursor-pointer'
              }`}
            >
              <ChevronRight className={`w-6 h-6 ${currentPage === 0 ? 'text-white/50' : 'text-[#742551]'}`} />
            </button>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              {paginatedPlaybacks.length === 0 ? (
                <div className="col-span-2 text-center py-8">
                  <p className="text-white text-[18px]" style={{ fontFamily: 'Discovery_Fs' }}>
                    לא נמצאו תוצאות
                  </p>
                </div>
              ) : (
                paginatedPlaybacks.map(playback => (
                  <button
                    key={playback.id}
                    onClick={() => handleSelectPlayback(playback)}
                    className={`flex items-center justify-between p-3 rounded-[15px] transition-all ${
                      selectedPlaybackId === playback.id ? 'text-white' : 'bg-white hover:bg-white/90'
                    }`}
                    style={selectedPlaybackId === playback.id ? { background: 'linear-gradient(135deg, #8B5A8B 0%, #A0628A 50%, #B86B89 100%)' } : undefined}
                  >
                    {/* Left side - Album Cover & Song Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-[60px] h-[60px] rounded-lg flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #333 100%)' }}>
                        <span className="text-[#D4A853] text-[10px] font-bold text-center px-1" style={{ fontFamily: 'Discovery_Fs' }}>
                          {playback.song_name.substring(0, 8)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`text-[18px] font-bold ${selectedPlaybackId === playback.id ? 'text-white' : 'text-[#742551]'}`} style={{ fontFamily: 'Discovery_Fs' }}>
                          {playback.song_name}
                        </div>
                        <div className={`text-[14px] ${selectedPlaybackId === playback.id ? 'text-white/80' : 'text-[#742551]/70'}`} style={{ fontFamily: 'Discovery_Fs' }}>
                          {playback.artist?.name || 'לא ידוע'}
                        </div>
                      </div>
                    </div>

                    {/* Duration */}
                    <span className={`text-[16px] ${selectedPlaybackId === playback.id ? 'text-white' : 'text-[#333]'}`} style={{ fontFamily: 'Discovery_Fs' }}>
                      {playback.duration || '--:--'}
                    </span>

                    {/* Play Button */}
                    <div
                      onClick={e => {
                        e.stopPropagation();
                        handlePlayPreview(playback);
                      }}
                      className="w-10 h-10 rounded-full bg-[#D4A853] flex items-center justify-center cursor-pointer hover:opacity-90"
                    >
                      {playingId === playback.id && audioPlayer.isPlaying ? (
                        <Pause className="w-5 h-5 text-[#742551] fill-current" />
                      ) : (
                        <Play className="w-5 h-5 text-[#742551] fill-current ml-0.5" />
                      )}
                    </div>

                    {/* Right - Price Button */}
                    <div
                      className="px-4 py-2 rounded-lg text-[14px] font-bold"
                      style={{
                        fontFamily: 'Discovery_Fs',
                        background: userPurchasedPlaybackIds.has(playback.id) || paidPlaybackIds.has(playback.id) ? '#FFBF66' : '#D4A853',
                        color: '#742551'
                      }}
                    >
                      <div>{userPurchasedPlaybackIds.has(playback.id) || paidPlaybackIds.has(playback.id) ? 'שולם' : 'עלות'}</div>
                      <div>{formatPrice(playback.cost)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Right Arrow - Next */}
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages - 1}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                currentPage >= totalPages - 1
                  ? 'bg-white/20 cursor-not-allowed'
                  : 'bg-white hover:bg-white/90 cursor-pointer'
              }`}
            >
              <ChevronLeft className={`w-6 h-6 ${currentPage >= totalPages - 1 ? 'text-white/50' : 'text-[#742551]'}`} />
            </button>
          </div>

          {/* Page Indicator */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentPage ? 'bg-[#D4A853]' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Buttons */}
      <div className="w-full max-w-[900px] flex justify-between items-center mt-12">
        <button onClick={onBack} className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-white/50 text-white hover:bg-white/10 mr-[53px]" style={{
        fontFamily: 'Discovery_Fs'
      }}>
          לשלב הקודם    
        </button>

        <button onClick={handleContinue} disabled={!selectedPlaybackId} className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{
        fontFamily: 'Discovery_Fs',
        background: '#D4A853',
        color: '#742551'
      }}>
          לשלב הבא ←  
        </button>
      </div>

      {/* Payment Dialog */}
      {selectedPlaybackForPayment && (
        <PlaybackPaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          playbackName={selectedPlaybackForPayment.name}
          playbackCost={selectedPlaybackForPayment.cost}
          playbackId={selectedPlaybackForPayment.id}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>;
}