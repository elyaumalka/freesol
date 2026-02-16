import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";

interface AISelectStyleProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const MUSIC_STYLES = [
  {
    id: 'acoustic',
    label: 'אקוסטי',
    description: 'גיטרה, פסנתר, כלי מיתר',
    tags: 'Acoustic, Warm, Organic, Guitar, Piano',
    negativeTags: 'Electronic, Heavy Metal, Distorted, Aggressive',
    emoji: '🎸'
  },
  {
    id: 'rock',
    label: 'רוק',
    description: 'גיטרות חשמליות, תופים',
    tags: 'Rock, Electric Guitar, Drums, Energetic, Dynamic',
    negativeTags: 'Classical, Ambient, Soft, Quiet',
    emoji: '🎸'
  },
  {
    id: 'pop',
    label: 'פופ',
    description: 'מודרני, קליט, ריקודי',
    tags: 'Pop, Modern, Catchy, Upbeat, Dance',
    negativeTags: 'Classical, Heavy Metal, Dark, Aggressive',
    emoji: '🎤'
  },
  {
    id: 'electronic',
    label: 'אלקטרוני',
    description: 'סינתיסייזרים, ביטים',
    tags: 'Electronic, Synth, Modern, Digital, Beats',
    negativeTags: 'Acoustic, Organic, Classical, Traditional',
    emoji: '🎹'
  },
  {
    id: 'orchestral',
    label: 'תזמורתי',
    description: 'כלי תזמורת, סימפוני',
    tags: 'Orchestral, Symphonic, Classical, Strings, Cinematic',
    negativeTags: 'Electronic, Rock, Heavy Metal, Modern',
    emoji: '🎻'
  },
  {
    id: 'jewish',
    label: 'יהודי מסורתי',
    description: 'מוזיקה יהודית, חסידית',
    tags: 'Jewish Music, Traditional, Melodic, Warm, Klezmer, Chassidic',
    negativeTags: 'Heavy Metal, Electronic, Aggressive, Dark',
    emoji: '🕎'
  },
  {
    id: 'ballad',
    label: 'בלדה',
    description: 'איטי, רגשי, רומנטי',
    tags: 'Ballad, Slow, Emotional, Romantic, Soft, Piano',
    negativeTags: 'Fast, Aggressive, Heavy, Electronic, Drums',
    emoji: '💝'
  },
  {
    id: 'upbeat',
    label: 'שמח וקליל',
    description: 'אנרגטי, עליז, ריקודי',
    tags: 'Upbeat, Happy, Energetic, Dance, Fun, Joyful',
    negativeTags: 'Sad, Dark, Slow, Heavy, Aggressive',
    emoji: '🎉'
  },
];

export function AISelectStyle({ projectData, updateProjectData, onNext, onBack }: AISelectStyleProps) {
  const [selectedStyle, setSelectedStyle] = useState(projectData.musicStyle || '');

  const handleStyleSelect = (styleId: string) => {
    const style = MUSIC_STYLES.find(s => s.id === styleId);
    if (style) {
      setSelectedStyle(styleId);
      updateProjectData({
        musicStyle: styleId,
        musicStyleTags: style.tags,
        musicStyleNegativeTags: style.negativeTags
      });
    }
  };

  const handleNext = () => {
    if (!selectedStyle) {
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[900px] mx-auto">
      {/* Title */}
      <h2 
        className="text-[36px] font-bold text-[#D4A853] mb-2 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        בחירת סגנון מוזיקה
      </h2>
      
      <p 
        className="text-[18px] text-white/70 mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        באיזה סגנון תרצה שניצור את הליווי המוזיקלי?
      </p>

      {/* Style Grid */}
      <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {MUSIC_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => handleStyleSelect(style.id)}
            className={`p-5 rounded-[15px] text-center transition-all hover:scale-105 ${
              selectedStyle === style.id
                ? 'bg-[#D4A853] text-[#742551] ring-4 ring-[#D4A853]/50'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <span className="text-[36px] block mb-2">{style.emoji}</span>
            <span 
              className="text-[18px] font-bold block"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {style.label}
            </span>
            <span 
              className={`text-[12px] block mt-1 ${
                selectedStyle === style.id ? 'opacity-80' : 'opacity-60'
              }`}
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {style.description}
            </span>
          </button>
        ))}
      </div>

      {/* Selected Style Summary */}
      {selectedStyle && (
        <div className="w-full p-4 rounded-[15px] bg-white/5 mb-8 text-center">
          <span 
            className="text-white/60 text-[16px]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            סגנון נבחר:
          </span>
          <span 
            className="text-[#D4A853] text-[24px] font-bold mr-4"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {MUSIC_STYLES.find(s => s.id === selectedStyle)?.label}
          </span>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="w-full flex justify-between items-center">
        <button
          onClick={onBack}
          className="text-[18px] text-[#D4A853] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ← לשלב הקודם
        </button>

        <button
          onClick={handleNext}
          disabled={!selectedStyle}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold text-[#742551] transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            fontFamily: 'Discovery_Fs',
            background: '#D4A853'
          }}
        >
          ליצירת הפלייבק ←
        </button>
      </div>
    </div>
  );
}
