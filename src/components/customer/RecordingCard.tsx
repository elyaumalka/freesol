import { Play, Pause, Download } from "lucide-react";

interface RecordingCardProps {
  songName: string;
  recordingDate: string;
  duration: string;
  isPlaying?: boolean;
  onPlay?: () => void;
  onDownload?: () => void;
}

export function RecordingCard({ 
  songName, 
  recordingDate, 
  duration,
  isPlaying = false,
  onPlay,
  onDownload,
}: RecordingCardProps) {
  return (
    <div 
      className="text-right"
      style={{ 
        background: '#FFC97F',
        padding: 'var(--space-md)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <p 
          className="text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-xs)' }}
        >
          <span className="font-bold">שם השיר:</span> {songName}
        </p>
        <p 
          className="text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-xs)' }}
        >
          <span className="font-bold">תאריך הקלטה:</span> {recordingDate}
        </p>
        <p 
          className="text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)' }}
        >
          <span className="font-bold">משך זמן:</span> {duration}
        </p>
      </div>
      
      <div className="flex items-center justify-between" style={{ gap: 'var(--space-sm)' }}>
        {/* LEFT - Play/Pause button */}
        <button 
          onClick={onPlay}
          className="flex items-center rounded-full text-white"
          style={{ 
            background: '#742551', 
            fontFamily: 'Discovery_Fs',
            fontSize: 'var(--text-sm)',
            gap: 'var(--space-xs)',
            padding: 'var(--space-xs) var(--space-md)'
          }}
        >
          {isPlaying ? (
            <>
              <Pause style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="fill-current" />
              <span>עצור</span>
            </>
          ) : (
            <>
              <Play style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="fill-current" />
              <span>הפעל</span>
            </>
          )}
        </button>
        
        {/* RIGHT - Download button */}
        <button 
          onClick={onDownload}
          className="flex items-center rounded-full text-[#215F66]"
          style={{ 
            background: '#FFBF66', 
            fontFamily: 'Discovery_Fs',
            fontSize: 'var(--text-sm)',
            gap: 'var(--space-xs)',
            padding: 'var(--space-xs) var(--space-md)'
          }}
        >
          <Download style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
          <span>הורדה</span>
        </button>
      </div>
    </div>
  );
}