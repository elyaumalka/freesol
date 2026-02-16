import { Edit } from "lucide-react";

interface ProjectCardProps {
  songName: string;
  recordingDate: string;
  duration: string;
  onContinueEdit?: () => void;
}

export function ProjectCard({ 
  songName, 
  recordingDate, 
  duration,
  onContinueEdit,
}: ProjectCardProps) {
  return (
    <div 
      className="text-right h-full flex flex-col"
      style={{ 
        background: '#F7F7F7',
        padding: 'var(--space-md)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div className="flex-1" style={{ marginBottom: 'var(--space-sm)' }}>
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
      
      <button 
        onClick={onContinueEdit}
        className="flex items-center justify-center w-full rounded-full text-[#742551]"
        style={{ 
          background: '#F9AD44', 
          fontFamily: 'Discovery_Fs',
          fontSize: 'var(--text-sm)',
          gap: 'var(--space-xs)',
          padding: 'var(--space-xs) var(--space-md)'
        }}
      >
        <span>המשך עריכה</span>
        <div 
          className="flex items-center justify-center"
          style={{ 
            background: '#215F66',
            width: 'var(--icon-lg)',
            height: 'calc(var(--icon-lg) * 0.8)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <Edit style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="text-[#FFBF66]" />
        </div>
      </button>
    </div>
  );
}