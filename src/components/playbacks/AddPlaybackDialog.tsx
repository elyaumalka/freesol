import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, Check, Upload, Loader2, Search, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AddArtistDialog } from "./AddArtistDialog";
import { useArtists, useCreatePlayback, useDeleteArtist } from "@/hooks/usePlaybacks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface AddPlaybackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPlaybackDialog({ open, onOpenChange }: AddPlaybackDialogProps) {
  const { data: artists = [] } = useArtists();
  const createPlayback = useCreatePlayback();
  const deleteArtist = useDeleteArtist();
  
  const [songName, setSongName] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [artistSearch, setArtistSearch] = useState("");
  const [cost, setCost] = useState("");
  const [fileName, setFileName] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duration, setDuration] = useState("00:00");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'separating' | 'analyzing' | 'completed' | 'failed'>('idle');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [addArtistOpen, setAddArtistOpen] = useState(false);
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter artists based on search
  const filteredArtists = useMemo(() => {
    if (!artistSearch.trim()) return artists;
    return artists.filter(artist => 
      artist.name.toLowerCase().includes(artistSearch.toLowerCase())
    );
  }, [artists, artistSearch]);

  // Get selected artist name
  const selectedArtistName = useMemo(() => {
    const artist = artists.find(a => a.id === selectedArtistId);
    return artist?.name || "";
  }, [artists, selectedArtistId]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setFileName(file.name);
        setAudioFile(file);
        
        // Get audio duration
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
          setDuration(formatDuration(audio.duration));
          setDurationSeconds(audio.duration);
          URL.revokeObjectURL(audio.src);
        };
      }
    };
    input.click();
  };

  const handleSelectArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    setArtistSearch("");
    setShowArtistDropdown(false);
  };

  const handleDeleteArtist = (artistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('האם למחוק את האמן?')) {
      deleteArtist.mutate(artistId);
      if (selectedArtistId === artistId) {
        setSelectedArtistId("");
      }
    }
  };

  const handleSubmit = async () => {
    if (!songName.trim()) {
      toast.error('נא להזין שם שיר');
      return;
    }

    if (!audioFile) {
      toast.error('נא להעלות קובץ שמע');
      return;
    }

    setIsUploading(true);
    setProcessingStatus('uploading');
    setProcessingProgress(10);

    try {
      // Step 1: Upload audio file
      const fileExt = audioFile.name.split('.').pop();
      const filePath = `playbacks/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('playbacks')
        .upload(filePath, audioFile);

      if (uploadError) {
        throw new Error(`שגיאה בהעלאת הקובץ: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('playbacks')
        .getPublicUrl(filePath);

      setProcessingProgress(20);

      // Step 2: Create playback record
      const { data: newPlayback, error: createError } = await supabase
        .from('playbacks')
        .insert({
          song_name: songName,
          artist_id: selectedArtistId || null,
          cost: parseFloat(cost) || 0,
          duration: duration,
          audio_url: publicUrl, // Temporarily set to original, will be replaced with instrumental
          original_audio_url: publicUrl,
          processing_status: 'pending',
        })
        .select()
        .single();

      if (createError || !newPlayback) {
        throw new Error(`שגיאה ביצירת הפלייבק: ${createError?.message}`);
      }

      setProcessingProgress(30);
      setProcessingStatus('separating');
      setIsProcessing(true);

      // Step 3: Start AI processing (vocal separation + structure analysis)
      toast.info('מתחיל עיבוד AI - הורדת שירה וניתוח מבנה השיר...');
      
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-playback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          playbackId: newPlayback.id,
          audioUrl: publicUrl,
        }),
      });

      // Don't wait for the full processing - it will run in the background
      // Just show success and close dialog
      if (response.ok) {
        setProcessingProgress(50);
        toast.success('הפלייבק נוסף! העיבוד ימשיך ברקע...');
        
        // Start polling for completion
        pollProcessingStatus(newPlayback.id);
      } else {
        const error = await response.json();
        console.error('Processing started but may have issues:', error);
        toast.warning('הפלייבק נוסף אבל העיבוד עשוי להיכשל');
      }

      onOpenChange(false);
      resetForm();

    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'שגיאה בהעלאת הקובץ');
      setIsUploading(false);
      setIsProcessing(false);
      setProcessingStatus('failed');
    }
  };

  const pollProcessingStatus = async (playbackId: string) => {
    // Poll every 10 seconds for up to 5 minutes
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      attempts++;
      
      const { data: playback } = await supabase
        .from('playbacks')
        .select('processing_status')
        .eq('id', playbackId)
        .single();

      if (playback?.processing_status === 'completed') {
        toast.success('עיבוד הפלייבק הושלם בהצלחה!');
        return;
      }

      if (playback?.processing_status === 'failed') {
        toast.error('עיבוד הפלייבק נכשל');
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 10000);
      }
    };

    setTimeout(poll, 10000);
  };

  const resetForm = () => {
    setSongName("");
    setSelectedArtistId("");
    setArtistSearch("");
    setCost("");
    setFileName("");
    setAudioFile(null);
    setDuration("00:00");
    setDurationSeconds(0);
    setIsUploading(false);
    setIsProcessing(false);
    setProcessingStatus('idle');
    setProcessingProgress(0);
    setShowArtistDropdown(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden"
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>הוספת פלייבק חדש</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
            <h2 className="text-[22px] font-normal text-[#742551]">הוספת פלייבק חדש</h2>
            <button onClick={() => onOpenChange(false)} className="text-[#742551] hover:opacity-70">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">שם השיר</label>
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button onClick={() => setAddArtistOpen(true)} className="text-[#742551] underline text-sm hover:opacity-70">
                  הוספת אומן +
                </button>
                <label className="text-[18px] font-bold text-[#742551]">אומן</label>
              </div>
              
              {/* Artist Search and Select */}
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={selectedArtistId ? selectedArtistName : artistSearch}
                    onChange={(e) => {
                      setArtistSearch(e.target.value);
                      setSelectedArtistId("");
                      setShowArtistDropdown(true);
                    }}
                    onFocus={() => setShowArtistDropdown(true)}
                    placeholder="חפש או בחר אומן..."
                    className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-right outline-none pr-12"
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#742551]/50" />
                  {selectedArtistId && (
                    <button
                      onClick={() => {
                        setSelectedArtistId("");
                        setArtistSearch("");
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#742551]/50 hover:text-[#742551]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                {/* Dropdown */}
                {showArtistDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-[#742551]/20 rounded-2xl shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredArtists.length === 0 ? (
                      <div className="p-4 text-center text-[#742551]/60">
                        לא נמצאו אמנים
                      </div>
                    ) : (
                      filteredArtists.map((artist) => (
                        <div
                          key={artist.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-[#F7F7F7] cursor-pointer group"
                          onClick={() => handleSelectArtist(artist.id)}
                        >
                          <button
                            onClick={(e) => handleDeleteArtist(artist.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#EE0004]/10 rounded-full transition-opacity"
                          >
                            <Trash2 className="h-4 w-4 text-[#EE0004]" />
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-[#742551]">{artist.name}</span>
                            {selectedArtistId === artist.id && (
                              <Check className="h-4 w-4 text-[#FFBF66]" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">עלות</label>
              <div className="relative">
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#742551] font-medium">₪</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[18px] font-bold text-[#742551] text-right">העלאת קובץ</label>
              <button
                onClick={handleFileSelect}
                className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center flex items-center justify-center gap-2 hover:bg-[#F0F0F0]"
              >
                <Upload className="h-5 w-5 text-[#742551]" />
                <span>{fileName || "בחירת קובץ"}</span>
              </button>
              {duration !== "00:00" && (
                <p className="text-center text-sm text-[#215F66]">משך זמן: {duration}</p>
              )}
            </div>
          </div>

          <div className="p-6 pt-0 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={createPlayback.isPending || isUploading}
              className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50 flex items-center gap-2"
            >
              {(createPlayback.isPending || isUploading) && <Loader2 className="h-5 w-5 animate-spin" />}
              {createPlayback.isPending || isUploading ? 'שומר...' : 'הוספה +'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AddArtistDialog open={addArtistOpen} onOpenChange={setAddArtistOpen} />
    </>
  );
}