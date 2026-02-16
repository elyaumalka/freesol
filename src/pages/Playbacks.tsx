import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Trash2, ArrowUpDown, Loader2, Filter, ChevronDown, X, Play, Pause } from "lucide-react";
import EditIcon from "@/assets/icons/edit.svg";
import PlusIcon from "@/assets/icons/plus.svg";
import { AddPlaybackDialog } from "@/components/playbacks/AddPlaybackDialog";
import { EditPlaybackDialog } from "@/components/playbacks/EditPlaybackDialog";
import { usePlaybacks, useDeletePlayback, useArtists } from "@/hooks/usePlaybacks";
import { Playback } from "@/types/database";
import { ExportButton } from "@/components/admin/ExportButton";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Playbacks() {
  const { data: playbacks, isLoading } = usePlaybacks();
  const { data: artists = [] } = useArtists();
  const deletePlayback = useDeletePlayback();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlayback, setSelectedPlayback] = useState<Playback | null>(null);
  const [playingPlaybackId, setPlayingPlaybackId] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer();
  
  // Filter states
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  const handleEdit = (playback: Playback) => {
    setSelectedPlayback(playback);
    setEditDialogOpen(true);
  };

  const handleDelete = (playbackId: string) => {
    if (confirm('האם למחוק את הפלייבק?')) {
      deletePlayback.mutate(playbackId);
    }
  };

  const handlePlayToggle = (playback: Playback) => {
    // Use original_audio_url as fallback if audio_url is from replicate (expired)
    const audioUrl = playback.audio_url?.includes('replicate.delivery') 
      ? playback.original_audio_url || playback.audio_url
      : playback.audio_url;
    
    if (!audioUrl) return;
    
    if (playingPlaybackId === playback.id && audioPlayer.isPlaying) {
      // Currently playing this track - pause it
      audioPlayer.pause();
    } else if (playingPlaybackId === playback.id && !audioPlayer.isPlaying) {
      // Same track paused - resume
      audioPlayer.play();
    } else {
      // Different track or no track - load and play
      audioPlayer.loadAudio(audioUrl);
      setPlayingPlaybackId(playback.id);
      setTimeout(() => audioPlayer.play(), 100);
    }
  };

  // Get unique song names for filter
  const uniqueSongNames = useMemo(() => {
    const songs = playbacks?.map(p => p.song_name) || [];
    return [...new Set(songs)].sort();
  }, [playbacks]);

  // Toggle artist filter
  const toggleArtistFilter = (artistId: string) => {
    setSelectedArtists(prev => 
      prev.includes(artistId) 
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
  };

  // Toggle song filter
  const toggleSongFilter = (songName: string) => {
    setSelectedSongs(prev => 
      prev.includes(songName) 
        ? prev.filter(name => name !== songName)
        : [...prev, songName]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedArtists([]);
    setSelectedSongs([]);
    setSearchQuery("");
  };

  const hasActiveFilters = selectedArtists.length > 0 || selectedSongs.length > 0;

  const filteredPlaybacks = useMemo(() => {
    let result = playbacks || [];
    
    // Apply search filter
    if (searchQuery) {
      result = result.filter(p => 
        p.song_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.artist?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply artist filter
    if (selectedArtists.length > 0) {
      result = result.filter(p => 
        p.artist_id && selectedArtists.includes(p.artist_id)
      );
    }
    
    // Apply song filter
    if (selectedSongs.length > 0) {
      result = result.filter(p => 
        selectedSongs.includes(p.song_name)
      );
    }
    
    return result;
  }, [playbacks, searchQuery, selectedArtists, selectedSongs]);

  const exportColumns = [
    { key: 'song_name' as const, label: 'שם השיר' },
    { key: 'duration' as const, label: 'משך זמן' },
    { key: 'cost' as const, label: 'עלות' },
    { key: 'usage_count' as const, label: 'כמות שימושים' },
    { key: 'created_at' as const, label: 'תאריך יצירה' },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 lg:space-y-6 px-4 lg:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[20px] lg:text-[22px] xl:text-[25px] font-normal text-[#742551]">ניהול פלייבקים</h1>

          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <ExportButton 
              data={playbacks as unknown as Record<string, unknown>[]} 
              columns={exportColumns as { key: string; label: string }[]} 
              filename="playbacks"
              title="ניהול פלייבקים"
            />

            {/* Artist Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-3 rounded-full border transition-colors ${
                  selectedArtists.length > 0 
                    ? 'border-[#742551] bg-[#742551]/10 text-[#742551]' 
                    : 'border-[#215F66] text-[#215F66]'
                }`}>
                  <Filter className="h-3 w-3 lg:h-4 lg:w-4" />
                  <span className="text-[14px] lg:text-[16px]">אמן</span>
                  {selectedArtists.length > 0 && (
                    <span className="bg-[#742551] text-white text-xs px-1.5 lg:px-2 py-0.5 rounded-full">
                      {selectedArtists.length}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto">
                {artists.map((artist) => (
                  <DropdownMenuCheckboxItem
                    key={artist.id}
                    checked={selectedArtists.includes(artist.id)}
                    onCheckedChange={() => toggleArtistFilter(artist.id)}
                  >
                    {artist.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Song Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-3 rounded-full border transition-colors ${
                  selectedSongs.length > 0 
                    ? 'border-[#742551] bg-[#742551]/10 text-[#742551]' 
                    : 'border-[#215F66] text-[#215F66]'
                }`}>
                  <Filter className="h-3 w-3 lg:h-4 lg:w-4" />
                  <span className="text-[14px] lg:text-[16px]">שיר</span>
                  {selectedSongs.length > 0 && (
                    <span className="bg-[#742551] text-white text-xs px-1.5 lg:px-2 py-0.5 rounded-full">
                      {selectedSongs.length}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto">
                {uniqueSongNames.map((songName) => (
                  <DropdownMenuCheckboxItem
                    key={songName}
                    checked={selectedSongs.includes(songName)}
                    onCheckedChange={() => toggleSongFilter(songName)}
                  >
                    {songName}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 lg:px-3 py-2 lg:py-3 text-[#EE0004] hover:bg-[#EE0004]/5 rounded-full transition-colors"
              >
                <X className="h-3 w-3 lg:h-4 lg:w-4" />
                <span className="text-[12px] lg:text-[14px]">נקה</span>
              </button>
            )}
            
            <div className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-3 rounded-full border border-[#215F66]">
              <input 
                type="text" 
                placeholder="חיפוש פלייבק"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[14px] lg:text-[16px] text-[#215F66] placeholder-[#215F66]/60 outline-none w-[80px] lg:w-[100px] xl:w-[120px]"
              />
              <Search className="h-4 w-4 lg:h-5 lg:w-5 text-[#215F66]" />
            </div>

            <button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-1.5 lg:gap-2 px-4 lg:px-6 py-2 lg:py-3 bg-[#FFBF66] rounded-full hover:bg-[#FFBF66]/80 transition-colors"
            >
              <span className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-white">הוספת פלייבק</span>
              <img src={PlusIcon} alt="Add" className="h-4 w-4 lg:h-5 lg:w-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[20px] lg:rounded-[30px] overflow-hidden overflow-x-auto">
          <div className="grid grid-cols-6 py-3 lg:py-4 px-4 lg:px-6 border-b border-[#742551]/20 min-w-[800px]">
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">שם השיר</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">אומן</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">משך זמן</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center flex items-center justify-center gap-1 cursor-pointer hover:opacity-70">
              עלות
              <ArrowUpDown className="h-3 w-3 lg:h-4 lg:w-4" />
            </div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">כמות שימושים</div>
            <div className="text-[16px] lg:text-[18px] xl:text-[20px] font-normal text-[#742551] text-center">פעולות</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#742551]" />
            </div>
          ) : filteredPlaybacks.length === 0 ? (
            <div className="text-center py-12 text-[#742551]/60">
              {searchQuery || hasActiveFilters ? 'לא נמצאו תוצאות' : 'אין פלייבקים עדיין'}
            </div>
          ) : (
            filteredPlaybacks.map((playback) => (
              <div 
                key={playback.id} 
                className="grid grid-cols-6 items-center py-3 lg:py-4 px-4 lg:px-6 bg-[#F7F7F7] mx-3 lg:mx-4 my-2 rounded-[20px] lg:rounded-[30px] min-w-[800px]"
              >
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{playback.song_name}</div>
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{playback.artist?.name || '-'}</div>
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{playback.duration}</div>
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{playback.cost} ₪</div>
                <div className="text-[14px] lg:text-[16px] xl:text-[18px] font-normal text-[#742551] text-center">{playback.usage_count}</div>

                <div className="flex items-center gap-1.5 lg:gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(playback)}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#742551] flex items-center justify-center hover:bg-[#742551]/80 transition-colors"
                  >
                    <img src={EditIcon} alt="Edit" className="h-4 w-4 lg:h-5 lg:w-5" />
                  </button>
                  <button
                    onClick={() => handlePlayToggle(playback)}
                    disabled={!playback.audio_url}
                    className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                      playingPlaybackId === playback.id && audioPlayer.isPlaying
                        ? 'bg-[#742551] hover:bg-[#742551]/80'
                        : 'bg-[#FFBF66] hover:bg-[#FFBF66]/80'
                    }`}
                  >
                    {playingPlaybackId === playback.id && audioPlayer.isPlaying ? (
                      <Pause className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                    ) : (
                      <Play className="w-4 h-4 lg:w-5 lg:h-5 text-white ml-0.5" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleDelete(playback.id)}
                    disabled={deletePlayback.isPending}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#EE0004] flex items-center justify-center hover:bg-[#EE0004]/80 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddPlaybackDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditPlaybackDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen}
        playback={selectedPlayback}
      />
    </AppLayout>
  );
}
