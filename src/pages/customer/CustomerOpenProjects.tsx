import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerLayout } from "@/components/customer/CustomerLayout";
import { ProjectCard } from "@/components/customer/ProjectCard";
import { Search } from "lucide-react";
import { getDraftProjects } from "@/lib/projectUtils";
import { format } from "date-fns";

interface DraftProject {
  id: string;
  song_name: string;
  created_at: string;
  updated_at: string;
  verses: any;
}

export default function CustomerOpenProjects() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<DraftProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const drafts = await getDraftProjects();
    setProjects(drafts as DraftProject[]);
    setLoading(false);
  };

  const filteredProjects = projects.filter(project =>
    project.song_name.includes(searchQuery)
  );

  const handleContinueEdit = (project: DraftProject) => {
    // Navigate to new project page with project ID to resume editing
    navigate(`/customer/new-project?resume=${project.id}`);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const getDuration = (project: DraftProject) => {
    // Try to get duration from stored state
    if (project.verses?.songDuration) {
      const mins = Math.floor(project.verses.songDuration / 60);
      const secs = Math.floor(project.verses.songDuration % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return '--:--';
  };

  return (
    <CustomerLayout>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 
          className="font-light text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-3xl)' }}
        >
          פרוייקטים פתוחים
        </h1>
        
        {/* Search */}
        <div 
          className="flex items-center bg-white rounded-full border border-gray-200"
          style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)' }}
        >
          <input
            type="text"
            placeholder="חיפוש פרוייקט"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-right"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', width: 'clamp(100px, 10vw, 180px)' }}
          />
          <Search style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="text-gray-400" />
        </div>
      </div>

      {/* Projects Grid */}
      <div 
        className="bg-white"
        style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)' }}
      >
        {loading ? (
          <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
            <p className="text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}>
              טוען פרויקטים...
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
            <p className="text-[#742551]" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}>
              אין פרויקטים פתוחים
            </p>
          </div>
        ) : (
          <div 
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6"
            style={{ gap: 'var(--space-lg)' }}
          >
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                songName={project.song_name}
                recordingDate={formatDate(project.updated_at)}
                duration={getDuration(project)}
                onContinueEdit={() => handleContinueEdit(project)}
              />
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}