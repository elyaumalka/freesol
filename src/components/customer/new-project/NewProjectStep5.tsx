import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Plus, Trash2 } from "lucide-react";

interface NewProjectStep5Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

type VerseType = 'verse' | 'chorus';

interface Verse {
  id: number;
  type: VerseType;
  text: string;
}

export function NewProjectStep5({ projectData, updateProjectData, onNext, onBack }: NewProjectStep5Props) {
  const [verses, setVerses] = useState<Verse[]>(projectData.verses.length > 0 ? projectData.verses : [
    { id: 1, type: 'verse', text: '' }
  ]);

  const addVerse = (type: VerseType) => {
    const newVerse: Verse = {
      id: Date.now(),
      type,
      text: ''
    };
    setVerses([...verses, newVerse]);
  };

  const removeVerse = (id: number) => {
    setVerses(verses.filter(v => v.id !== id));
  };

  const updateVerseText = (id: number, text: string) => {
    setVerses(verses.map(v => v.id === id ? { ...v, text } : v));
  };

  const handleContinue = () => {
    updateProjectData({ verses });
    onNext();
  };

  const getVerseLabel = (verse: Verse, index: number) => {
    if (verse.type === 'chorus') return 'פזמון';
    const verseCount = verses.slice(0, index + 1).filter(v => v.type === 'verse').length;
    return `בית ${verseCount}`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Back Button */}
      <div className="w-full flex justify-end mb-4">
        <button
          onClick={onBack}
          className="text-[20px] text-[#742551] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          → חזרה
        </button>
      </div>

      {/* Title */}
      <h1 
        className="text-[50px] font-bold text-[#742551] mb-2"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        תכנון הקובץ
      </h1>
      
      {/* Subtitle */}
      <p 
        className="text-[30px] font-light text-[#742551] mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הוספת בתים ופזמונים
      </p>

      {/* Verses List */}
      <div className="w-full max-w-[700px] space-y-4 mb-6">
        {verses.map((verse, index) => (
          <div 
            key={verse.id}
            className="flex items-start gap-4 p-4 rounded-[20px] bg-[#F7F7F7]"
          >
            {/* Delete button */}
            {verses.length > 1 && (
              <button
                onClick={() => removeVerse(verse.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            
            {/* Text area */}
            <textarea
              value={verse.text}
              onChange={(e) => updateVerseText(verse.id, e.target.value)}
              placeholder={`הזן טקסט ל${getVerseLabel(verse, index)}...`}
              className="flex-1 min-h-[100px] p-4 rounded-[15px] border border-[#742551]/20 text-right resize-none text-[18px]"
              style={{ fontFamily: 'Discovery_Fs' }}
              dir="rtl"
            />
            
            {/* Label */}
            <div 
              className={`px-4 py-2 rounded-[10px] text-white text-[16px] font-bold ${
                verse.type === 'chorus' ? 'bg-[#215F66]' : 'bg-[#742551]'
              }`}
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {getVerseLabel(verse, index)}
            </div>
          </div>
        ))}
      </div>

      {/* Add Buttons */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => addVerse('verse')}
          className="flex items-center gap-2 h-[50px] px-6 rounded-[25px] text-[18px] font-bold text-[#742551] border-2 border-[#742551] hover:bg-[#742551]/10 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          <Plus className="w-5 h-5" />
          הוסף בית
        </button>
        <button
          onClick={() => addVerse('chorus')}
          className="flex items-center gap-2 h-[50px] px-6 rounded-[25px] text-[18px] font-bold text-[#215F66] border-2 border-[#215F66] hover:bg-[#215F66]/10 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          <Plus className="w-5 h-5" />
          הוסף פזמון
        </button>
      </div>

      {/* Continue Button */}
      <button
        onClick={handleContinue}
        className="h-[60px] px-12 rounded-[30px] text-[24px] font-bold text-white transition-all"
        style={{
          fontFamily: 'Discovery_Fs',
          background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
        }}
      >
        המשך ←
      </button>
    </div>
  );
}
