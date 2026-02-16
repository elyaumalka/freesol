import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Music, Zap, Guitar, Sparkles, Waves, Drum } from "lucide-react";
import { autoSaveProject } from "@/lib/projectUtils";

interface SelectMusicStyleProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface MusicStyle {
  id: string;
  name: string;
  description: string;
  tags: string;
  negativeTags: string;
  icon: React.ReactNode;
}

const musicStyles: MusicStyle[] = [
  {
    id: 'acoustic',
    name: 'אקוסטי',
    description: 'גיטרות אקוסטיות, רגוע ונעים',
    tags: 'Jewish Music, Acoustic Guitar, Melodic, Traditional, Warm, Soft, Peaceful',
    negativeTags: 'Electric Guitar, Distortion, Heavy Metal, Electronic, Loud, Aggressive',
    icon: <Guitar className="w-8 h-8" />,
  },
  {
    id: 'rock',
    name: 'רוק',
    description: 'גיטרות חשמליות עם דיסטורשן',
    tags: 'Jewish Music, Rock, Electric Guitar, Distortion, Energetic, Powerful, Driving Beat',
    negativeTags: 'Acoustic, Soft, Quiet, Ambient, Classical',
    icon: <Zap className="w-8 h-8" />,
  },
  {
    id: 'upbeat',
    name: 'שמח',
    description: 'קצבי, אנרגטי ושמח',
    tags: 'Jewish Music, Upbeat, Happy, Energetic, Celebratory, Dance, Fast Tempo, Joyful',
    negativeTags: 'Sad, Slow, Melancholic, Dark, Heavy Metal',
    icon: <Sparkles className="w-8 h-8" />,
  },
  {
    id: 'electronic',
    name: 'אלקטרוני',
    description: 'סינתיסייזרים וביטים מודרניים',
    tags: 'Jewish Music, Electronic, Synth, Modern, Beats, Production, Contemporary',
    negativeTags: 'Acoustic, Traditional, Classical, Organic',
    icon: <Waves className="w-8 h-8" />,
  },
  {
    id: 'orchestral',
    name: 'תזמורתי',
    description: 'כלי תזמורת, מקהלה וכינורות',
    tags: 'Jewish Music, Orchestral, Choir, Strings, Violin, Grand, Epic, Classical',
    negativeTags: 'Electric Guitar, Electronic, Rock, Simple',
    icon: <Music className="w-8 h-8" />,
  },
  {
    id: 'drums',
    name: 'מקצב',
    description: 'תופים חזקים וביט אגרסיבי',
    tags: 'Jewish Music, Drums, Percussion, Strong Beat, Rhythmic, Powerful, Dynamic',
    negativeTags: 'Soft, Ambient, Quiet, Gentle',
    icon: <Drum className="w-8 h-8" />,
  },
];

export function SelectMusicStyle({ projectData, updateProjectData, onNext, onBack }: SelectMusicStyleProps) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(projectData.musicStyle || null);

  const handleSelectStyle = (styleId: string) => {
    setSelectedStyle(styleId);
    const style = musicStyles.find(s => s.id === styleId);
    if (style) {
      updateProjectData({
        musicStyle: styleId,
        musicStyleTags: style.tags,
        musicStyleNegativeTags: style.negativeTags,
      });
    }
  };

  const handleContinue = () => {
    if (selectedStyle) {
      const style = musicStyles.find(s => s.id === selectedStyle);
      // Auto-save before moving to initial-recording
      autoSaveProject({ 
        ...projectData, 
        musicStyle: selectedStyle,
        musicStyleTags: style?.tags,
        musicStyleNegativeTags: style?.negativeTags,
        backgroundMusic: 'ai' 
      }, 'initial-recording');
      onNext();
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Subtitle */}
      <p 
        className="text-[24px] text-[#D4A853] text-center mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        באיזה סגנון תרצו את מוזיקת הרקע?
      </p>

      {/* Style Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-[800px] mb-8">
        {musicStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelectStyle(style.id)}
            className={`
              p-6 rounded-[20px] text-center transition-all flex flex-col items-center gap-3
              ${selectedStyle === style.id 
                ? 'bg-[#D4A853] text-[#742551] scale-105 shadow-lg' 
                : 'bg-white/90 text-[#742551] hover:bg-white hover:scale-102'
              }
            `}
          >
            <div className={`
              ${selectedStyle === style.id ? 'text-[#742551]' : 'text-[#D4A853]'}
            `}>
              {style.icon}
            </div>
            <span 
              className="text-[20px] font-bold"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {style.name}
            </span>
            <span 
              className="text-[14px] opacity-70"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {style.description}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Buttons */}
      <div className="w-full max-w-[800px] flex justify-between items-center">
        <button
          onClick={onBack}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-white/50 text-white hover:bg-white/10"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הקודם
        </button>

        <button
          onClick={handleContinue}
          disabled={!selectedStyle}
          className={`
            h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all
            ${selectedStyle 
              ? 'bg-[#D4A853] text-[#742551] hover:opacity-90' 
              : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }
          `}
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הבא ←
        </button>
      </div>
    </div>
  );
}
