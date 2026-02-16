import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Search, Download, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  source: string | null;
  total_purchases: number;
}

interface ViewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

// Helper to get audio duration
function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      reject(new Error('Failed to load audio'));
    });
    setTimeout(() => reject(new Error('Timeout')), 15000);
    audio.src = url;
  });
}

// Format seconds to mm:ss
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ViewCustomerDialog({ open, onOpenChange, customer }: ViewCustomerDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingDurations, setUpdatingDurations] = useState(false);
  const queryClient = useQueryClient();

  // Fetch real recordings for this customer
  const { data: recordings, isLoading } = useQuery({
    queryKey: ['customer-recordings', customer?.user_id],
    queryFn: async () => {
      if (!customer?.user_id) return [];
      
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', customer.user_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customer?.user_id && open,
  });

  // Function to update durations for recordings with missing or default duration
  const updateRecordingDurations = async () => {
    if (!recordings || recordings.length === 0) return;
    
    setUpdatingDurations(true);
    let updated = 0;
    
    for (const recording of recordings) {
      // Check if duration needs updating (is default or invalid)
      const needsUpdate = !recording.duration || 
                          recording.duration === '00:00' || 
                          recording.duration === '0:00' ||
                          recording.duration === '';
      
      if (needsUpdate && recording.audio_url) {
        try {
          const duration = await getAudioDuration(recording.audio_url);
          const formattedDuration = formatDuration(duration);
          
          await supabase
            .from('recordings')
            .update({ duration: formattedDuration })
            .eq('id', recording.id);
          
          updated++;
        } catch (e) {
          console.log('Could not get duration for:', recording.id);
        }
      }
    }
    
    if (updated > 0) {
      queryClient.invalidateQueries({ queryKey: ['customer-recordings', customer?.user_id] });
      toast.success(`עודכנו ${updated} הקלטות`);
    } else {
      toast.info('כל משכי הזמן מעודכנים');
    }
    
    setUpdatingDurations(false);
  };

  if (!customer) return null;

  const filteredRecordings = recordings?.filter(r =>
    r.song_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] p-0 bg-white rounded-[30px] border-none max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">פרטי לקוח מלאים - {customer.full_name}</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="text-[#742551] hover:opacity-70 transition-opacity"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Customer Info Card */}
        <div className="px-6 pt-6">
          <div 
            className="rounded-[20px] p-6 grid grid-cols-4 gap-4"
            style={{
              background: "linear-gradient(to right, #1E4D5C, #2A5A5E, #3E6B5F, #4A7560)"
            }}
          >
            <div className="text-center">
              <div className="text-white/70 text-[14px] mb-1">שם הלקוח</div>
              <div className="text-white text-[18px] font-normal">{customer.full_name}</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 text-[14px] mb-1">טלפון</div>
              <div className="text-white text-[18px] font-normal">{customer.phone || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 text-[14px] mb-1">אימייל</div>
              <div className="text-white text-[18px] font-normal">{customer.email}</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 text-[14px] mb-1">מקור הגעה</div>
              <div className="text-white text-[18px] font-normal">{customer.source || 'ישיר'}</div>
            </div>
          </div>
        </div>

        {/* Recordings History Section */}
        <div className="p-6 space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-[20px] font-normal text-[#742551]">היסטוריית הקלטות</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={updateRecordingDurations}
                disabled={updatingDurations || isLoading}
                className="flex items-center gap-1 px-3 py-2 rounded-full border border-[#742551] text-[#742551] text-[14px] hover:bg-[#742551]/5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${updatingDurations ? 'animate-spin' : ''}`} />
                <span>עדכן משכי זמן</span>
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#215F66]">
                <input
                  type="text"
                  placeholder="חיפוש הקלטות"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-[14px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[120px]"
                />
                <Search className="h-4 w-4 text-[#215F66]" />
              </div>
            </div>
          </div>

          {/* Recordings Table */}
          <div className="bg-white rounded-[20px] overflow-hidden border border-[#215F66]/20">
            {/* Table Header */}
            <div className="grid grid-cols-4 py-3 px-4 border-b border-[#215F66]/20">
              <div className="text-[16px] font-normal text-[#742551] text-center">שם השיר</div>
              <div className="text-[16px] font-normal text-[#742551] text-center">משך זמן</div>
              <div className="text-[16px] font-normal text-[#742551] text-center">תאריך הקלטה</div>
              <div className="text-[16px] font-normal text-[#742551] text-center">פעולות</div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
              </div>
            ) : filteredRecordings.length === 0 ? (
              <div className="text-center py-12 text-[#742551]/60">
                {searchQuery ? 'לא נמצאו תוצאות' : 'אין הקלטות עדיין'}
              </div>
            ) : (
              /* Table Rows */
              filteredRecordings.map((recording) => (
                <div 
                  key={recording.id}
                  className="grid grid-cols-4 items-center py-3 px-4 bg-[#F7F7F7] mx-2 my-2 rounded-[20px] border border-[#215F66]/30"
                >
                  {/* Song Name */}
                  <div className="text-[16px] font-normal text-[#742551] text-center">{recording.song_name}</div>

                  {/* Duration */}
                  <div className="text-[16px] font-normal text-[#742551] text-center">{recording.duration}</div>

                  {/* Date */}
                  <div className="text-[16px] font-normal text-[#742551] text-center">{formatDate(recording.created_at)}</div>

                  {/* Actions */}
                  <div className="flex justify-center">
                    {recording.audio_url ? (
                      <a 
                        href={recording.audio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-4 py-2 bg-[#742551] text-white rounded-full text-[14px] hover:bg-[#742551]/90 transition-colors"
                      >
                        <span>הורדה</span>
                        <Download className="h-4 w-4 text-[#FFBF66]" />
                      </a>
                    ) : (
                      <span className="text-[14px] text-[#742551]/50">אין קובץ</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}