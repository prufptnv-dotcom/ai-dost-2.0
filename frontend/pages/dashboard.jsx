import { useEffect, useState } from 'react';
import { FaFilm, FaUserFriends, FaCode } from 'react-icons/fa';
import ProjectCard from '../components/ProjectCard';
import AICompanion from '../components/AICompanion';
import Header from '../components/Header';
import { fetchProjects, createProject } from '../services/api';
import { useMode } from '../context/ModeContext';

const Dashboard = () => {
  const { mode } = useMode();
  const [projects, setProjects] = useState([]);
  const [learningProgress, setLearningProgress] = useState([
    { topic: "Python Basics", description: "Variables, Lists, Dicts", progress: 85 },
    { topic: "FastAPI Development", description: "Routing and Pydantic schemas", progress: 60 },
    { topic: "React Components", description: "State, hooks, and lifecycle", progress: 40 }
  ]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let userId = localStorage.getItem('ai_dost_user_id');
        if (!userId) {
          // If no user is logged in, use a fallback demo id
          userId = 'demo_user_id';
        }
        const data = await fetchProjects(userId);
        setProjects(data || []);
      } catch (error) {
        console.error("Failed to load projects", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setCreating(true);
    try {
      let userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
      const newProj = await createProject(newProjectName.trim(), newProjectDesc.trim(), userId);
      if (newProj && newProj.project_id) {
        setProjects(prev => [...prev, newProj]);
        setShowCreateModal(false);
        setNewProjectName('');
        setNewProjectDesc('');
        window.location.href = `/project/${newProj.project_id}`;
      }
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col">
      <Header />
      
      {mode === 'chat' ? (
        <div className="flex-1 flex pt-24 px-6 pb-6 max-w-4xl mx-auto w-full justify-center">
          <div className="w-full max-w-2xl h-[calc(100vh-120px)]">
            <AICompanion />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex pt-24 px-6 gap-6 max-w-7xl mx-auto w-full">
          {/* Left Side: AI Companion */}
          <div className="hidden md:block w-80 shrink-0 h-[calc(100vh-120px)] sticky top-24">
            <AICompanion />
          </div>
          
          {/* Center: Main Dashboard */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-primary">My Workspace Projects</h1>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-bg-default font-bold rounded-lg hover:bg-transparent hover:text-primary border border-primary transition text-sm cursor-pointer"
              >
                + Create Project
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-12 text-text-secondary">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="border border-dashed border-secondary/20 p-12 rounded-xl text-center">
                <div className="text-4xl mb-4">📂</div>
                <h3 className="text-lg font-bold text-primary mb-2">No projects found</h3>
                <p className="text-sm text-text-secondary mb-6">Create a new project context to get started with AI Dost.</p>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-primary text-bg-default font-bold rounded-lg hover:bg-transparent hover:text-primary border border-primary transition text-sm cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.project_id || project._id} project={project} />
                ))}
              </div>
            )}
          </div>
          
          {/* Right Side: Learning Progress */}
          <div className="hidden lg:block w-72 shrink-0 h-[calc(100vh-120px)] sticky top-24">
            <div className="bg-bg-hover border border-secondary/10 p-5 rounded-xl space-y-4">
              <h2 className="text-lg font-bold text-primary mb-2">Learning Progress</h2>
              <div className="space-y-4">
                {learningProgress.map((item) => (
                  <div key={item.topic} className="pb-3 border-b border-secondary/10 last:border-b-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-sm font-semibold text-text-primary">{item.topic}</h3>
                      <span className="text-xs font-bold text-primary">{item.progress}%</span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">{item.description}</p>
                    <div className="w-full bg-secondary/10 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-1.5 rounded-full" 
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-bg-hover border border-secondary/20 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-primary mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Awesome App"
                  className="w-full p-2.5 rounded-lg bg-bg-default border border-secondary/30 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Description</label>
                <textarea
                  placeholder="What is this project about?"
                  rows="4"
                  className="w-full p-2.5 rounded-lg bg-bg-default border border-secondary/30 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-secondary/30 text-text-secondary rounded-lg text-sm font-semibold hover:bg-secondary/10 transition cursor-pointer"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary text-bg-default font-bold rounded-lg text-sm hover:bg-opacity-80 transition cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
