import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useCreateArtist, useArtists } from "@/hooks/usePlaybacks";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddArtistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddArtistDialog({ open, onOpenChange }: AddArtistDialogProps) {
  const [artistName, setArtistName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createArtist = useCreateArtist();
  const { data: artists = [] } = useArtists();

  const handleSubmit = () => {
    const trimmedName = artistName.trim();
    if (!trimmedName) return;

    // Check if artist already exists (case-insensitive)
    const exists = artists.some(
      (artist) => artist.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      setError("אמן זה כבר קיים במערכת");
      return;
    }

    setError(null);
    createArtist.mutate(trimmedName, {
      onSuccess: () => {
        setArtistName("");
        setError(null);
        onOpenChange(false);
      }
    });
  };

  const handleNameChange = (value: string) => {
    setArtistName(value);
    if (error) setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 bg-white rounded-[30px] border-none [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#742551]/20">
          <h2 className="text-[22px] font-normal text-[#742551]">הוספת אומן חדש</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="text-[#742551] hover:opacity-70 transition-opacity"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-8 space-y-6">
          {/* Artist Name */}
          <div className="space-y-2">
            <label className="block text-[18px] font-bold text-[#742551] text-right">שם האומן</label>
            <input
              type="text"
              value={artistName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-6 py-4 bg-[#F7F7F7] rounded-full text-[16px] text-[#742551] text-center outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {error && (
              <Alert variant="destructive" className="mt-2 border-red-300 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-right">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="p-6 pt-0 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={createArtist.isPending || !artistName.trim()}
            className="flex items-center gap-2 px-8 py-4 bg-[#742551] text-white rounded-full text-[18px] font-normal hover:bg-[#742551]/90 transition-colors disabled:opacity-50"
          >
            {createArtist.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            <ArrowLeft className="h-5 w-5" />
            <span>{createArtist.isPending ? 'שומר...' : 'שמירה'}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
