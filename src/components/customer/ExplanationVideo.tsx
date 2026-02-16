import { Play } from "lucide-react";

export function ExplanationVideo() {
  return (
    <button className="flex items-center hover:opacity-80 transition-all" style={{ gap: 'var(--space-sm)' }}>
      <span 
        className="text-[#742551]"
        style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
      >
        סרטון הסברה
      </span>
      <div 
        className="rounded-full flex items-center justify-center"
        style={{ 
          background: '#FFC97F',
          width: 'var(--icon-lg)',
          height: 'calc(var(--icon-lg) * 0.9)'
        }}
      >
        <Play style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="text-[#742551] fill-current" />
      </div>
    </button>
  );
}