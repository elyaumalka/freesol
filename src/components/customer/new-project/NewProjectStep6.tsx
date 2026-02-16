import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Mic } from "lucide-react";

interface NewProjectStep6Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function NewProjectStep6({ projectData, updateProjectData, onNext, onBack }: NewProjectStep6Props) {
  const [recordings, setRecordings] = useState<{ [key: number]: { hasRecording: boolean; duration: string } }>({});

  const getVerseLabel = (verse: typeof projectData.verses[0], index: number) => {
    if (verse.type === 'chorus') {
      const chorusCount = projectData.verses.slice(0, index + 1).filter(v => v.type === 'chorus').length;
      return `פזמון ${chorusCount === 1 ? 'ראשון' : chorusCount === 2 ? 'שני' : chorusCount}`;
    }
    const verseCount = projectData.verses.slice(0, index + 1).filter(v => v.type === 'verse').length;
    return `בית ${verseCount === 1 ? 'ראשון' : verseCount === 2 ? 'שני' : verseCount}`;
  };

  const startRecording = (verseIndex: number) => {
    // Store the current verse index and go to recording screen
    updateProjectData({ currentVerseIndex: verseIndex } as any);
    onNext();
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Title */}
      <h1 
        className="text-[40px] font-bold text-[#D4A853] mb-8 text-right w-full"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        קדימה מוכנים להקליט....
      </h1>

      {/* Two Column Layout */}
      <div className="w-full flex gap-8">
        {/* Left Column - Recordings */}
        <div className="flex-1">
          <h2 
            className="text-[28px] font-bold text-[#D4A853] mb-4 text-right"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            הקלטה
          </h2>
          
          <div className="space-y-3">
            {projectData.verses.map((verse, index) => (
              <div 
                key={verse.id}
                className="flex items-center gap-3 p-3 rounded-[10px] bg-white"
              >
                {/* Re-record button */}
                <button
                  onClick={() => startRecording(index)}
                  className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-bold text-white"
                  style={{ 
                    fontFamily: 'Discovery_Fs',
                    background: '#D4A853'
                  }}
                >
                  <Mic className="w-4 h-4" />
                  {recordings[index]?.hasRecording ? 'הקלטה מחדש' : 'תחילת הקלטה'}
                </button>

                {/* Waveform / Play */}
                <div className="flex-1 flex items-center gap-2">
                  <button className="w-8 h-8 rounded-full bg-[#742551] flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                  </button>
                  
                  {/* Waveform visualization */}
                  <div className="flex-1 h-[40px] flex items-center">
                    {recordings[index]?.hasRecording ? (
                      <div className="w-full h-full flex items-center gap-[2px]">
                        {Array.from({ length: 50 }).map((_, i) => (
                          <div 
                            key={i}
                            className="w-[2px] bg-[#D4A853]"
                            style={{ height: `${Math.random() * 100}%` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-[2px] bg-gray-300" />
                    )}
                  </div>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2 text-[14px] text-gray-500" style={{ fontFamily: 'Discovery_Fs' }}>
                  <span>0:00</span>
                  <span>0:56</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-[1px] bg-white/30" />

        {/* Right Column - Playback/Music */}
        <div className="flex-1">
          <h2 
            className="text-[28px] font-bold text-[#D4A853] mb-4 text-right"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            מוזיקת רקע/פלייבק
          </h2>
          
          <div className="space-y-3">
            {projectData.verses.map((verse, index) => (
              <div 
                key={verse.id}
                className="flex items-center gap-3 p-3 rounded-[10px] bg-white"
              >
                {/* Preview listen button */}
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-bold text-white"
                  style={{ 
                    fontFamily: 'Discovery_Fs',
                    background: '#D4A853'
                  }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  שמיעה מקדימה
                </button>

                {/* Duration */}
                <span className="text-[14px] text-gray-600" style={{ fontFamily: 'Discovery_Fs' }}>
                  0:56
                </span>

                {/* Verse Label */}
                <span 
                  className="text-[18px] font-bold text-[#742551] mr-auto"
                  style={{ fontFamily: 'Discovery_Fs' }}
                >
                  {getVerseLabel(verse, index)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Buttons - Exit is in the layout */}
      <div className="w-full flex justify-end items-center mt-12">
        <div className="flex gap-4">
          <button
            className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            ← שמירה ללא עיבוד
          </button>
          <button
            className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold text-[#742551] transition-all"
            style={{ 
              fontFamily: 'Discovery_Fs',
              background: '#D4A853'
            }}
          >
            ← שמירה וסיום עיבוד
          </button>
        </div>
      </div>
    </div>
  );
}
