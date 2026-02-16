import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Check, Upload } from "lucide-react";
import { AddArtistDialog } from "./AddArtistDialog";
import { Playback } from "@/types/database";
import { useArtists, useUpdatePlayback } from "@/hooks/usePlaybacks";

interface EditPlaybackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playback: Playback | null;
}

export function EditPlaybackDialog({ open, onOpenChange, playback }: EditPlaybackDialogProps) {
  const { data: artists = [] } = useArtists();
  const updatePlayback = useUpdatePlayback();
  
  const [songName, setSongName] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [cost, setCost] = useState("");
  const [fileName, setFileName] = useState("");
  const [addArtistOpen, setAddArtistOpen] = useState(false);

  useEffect(() => {
    if (playback) {
      setSongName(playback.song_name);
      setSelectedArtistId(playback.artist_id || "");
      setCost(playback.cost.toString());
    }
  }, [playback]);

  const handleSubmit = () => {
    if (!playback) return;
    updatePlayback.mutate({
      id: playback.id,
      song_name: songName,
      artist_id: selectedArtistId || null,
      cost: parseFloat(cost) || 0,
    }, {
      onSuccess: () => onOpenChange(false)
    });
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setFileName(file.name);
      }
    };
    input.click();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
          <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
            <h2 className="text-[22px] font-normal text-[#742551]">עריכת פלייבק</h2>
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
                  הוספת אומן
                </button>
                <label className="text-[18px] font-bold text-[#742551]">אומן</label>
              </div>
              <div className="relative">
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none appearance-none"
                  dir="rtl"
                >
                  <option value="">בחר אומן</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>{artist.name}</option>
                  ))}
                </select>
                {selectedArtistId && <Check className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFBF66]" />}
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
            </div>
          </div>

          <div className="p-6 pt-0 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={updatePlayback.isPending}
              className="px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] hover:bg-[#742551]/90 disabled:opacity-50"
            >
              {updatePlayback.isPending ? 'שומר...' : 'עדכון +'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AddArtistDialog open={addArtistOpen} onOpenChange={setAddArtistOpen} />
    </>
  );
}
