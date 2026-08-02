import { useEffect, useState } from 'react';
import { FolderOpen, Plus, BookOpen, TrendingUp, Folder, ChevronRight, BarChart3, Sparkles } from 'lucide-react';
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

  const [showProgress, setShowProgress] = useState(false);

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
        <div className="flex-1 flex pt-20 px-4 sm:px-6 pb-6 w-full justify-center">
          <div className="w-full h-[calc(100vh-100px)] animate-fadeIn">
            <AICompanion />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex pt-20 px-6 gap-6 max-w-7xl mx-auto w-full">
          {/* Left Side: AI Companion */}
          <div className="hidden md:block w-[360px] lg:w-[390px] shrink-0 h-[calc(100vh-100px)] sticky top-20 animate-slideRight overflow-hidden">
            <AICompanion />
          </div>
          
          {/* Center: Main Dashboard */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-end mb-8 animate-fadeIn">
              <div className="relative">
                <h1 className="text-xl font-semibold text-text-primary mb-1">Projects</h1>
                <div className="h-1 w-8 rounded-full" style={{ background: 'var(--gradient-primary)' }}></div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowProgress(!showProgress)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-300 cursor-pointer ${
                    showProgress 
                      ? 'bg-primary/10 border-primary/40 text-primary shadow-[0_0_15px_var(--color-primary-glow)]' 
                      : 'glass-card text-text-muted hover:text-text-primary hover:border-primary/50'
                  }`}
                  title="Toggle Skill Progress Panel"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>{showProgress ? 'Hide Progress' : 'Skill Progress'}</span>
                </button>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="gradient-btn flex items-center gap-1.5 px-4 py-2 text-white font-medium rounded-xl transition-all cursor-pointer text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" /> New Project
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton rounded-xl h-[160px] w-full" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="glass-card animate-borderGlow flex flex-col items-center justify-center py-24 text-center rounded-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-16 h-16 rounded-2xl glass-card flex items-center justify-center mb-6 relative shadow-lg shadow-black/5">
                  <Folder className="w-8 h-8 text-text-muted group-hover:text-primary transition-colors duration-300" strokeWidth={1.5} />
                  <Sparkles className="w-5 h-5 text-primary absolute -top-1.5 -right-1.5 animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">Start Your Next Big Idea</h3>
                <p className="text-sm text-text-muted mb-6 max-w-sm">Launch your first project and experience the power of AI-assisted development.</p>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="gradient-btn flex items-center gap-2 px-6 py-2.5 text-white font-medium rounded-xl transition-all cursor-pointer text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" /> Create Project
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project, i) => (
                  <div 
                    key={project.project_id || project._id} 
                    className="animate-scaleIn"
                    style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                  >
                    <ProjectCard project={project} />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Right Side: Learning Progress */}
          {showProgress && (
            <div className="hidden lg:block w-72 shrink-0 h-[calc(100vh-120px)] sticky top-24 animate-fadeIn">
              <div className="glass-card p-5 rounded-2xl space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-text-primary">Your Skill Progress</h2>
                    </div>
                    <button 
                      onClick={() => setShowProgress(false)}
                      className="text-text-muted hover:text-text-primary text-xs cursor-pointer p-1 rounded-md hover:bg-bg-hover transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">Aapke coding &amp; skill learning track ka progress record.</p>
                </div>
                <div className="space-y-5">
                  {learningProgress.map((item) => (
                    <div key={item.topic} className="pb-4 border-b border-border/50 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-medium text-text-primary">{item.topic}</h3>
                        <span className="text-xs font-bold gradient-text">{item.progress}%</span>
                      </div>
                      <p className="text-xs text-text-muted mb-2.5">{item.description}</p>
                      <div className="w-full bg-bg-hover rounded-full h-2 overflow-hidden shadow-inner">
                        <div 
                          className="h-2 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_var(--color-primary-glow)]" 
                          style={{ width: `${item.progress}%`, background: 'var(--gradient-primary)' }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="glass-card backdrop-blur-xl rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden transform animate-scaleIn">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--gradient-primary)' }}></div>
            
            <div className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Plus className="w-4 h-4" />
                </div>
                New Project
              </h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. My Awesome App"
                    className="w-full h-10 px-3.5 rounded-xl bg-bg-hover border border-border text-sm text-text-primary focus:outline-none focus:border-primary/50 focus:shadow-[0_0_12px_var(--color-primary-glow)] transition-all"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    placeholder="What is this project about?"
                    rows="3"
                    className="w-full px-3.5 py-3 rounded-xl bg-bg-hover border border-border text-sm text-text-primary focus:outline-none focus:border-primary/50 focus:shadow-[0_0_12px_var(--color-primary-glow)] transition-all resize-none"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    className="px-4 py-2 glass-card text-text-primary rounded-xl text-sm font-medium hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="gradient-btn px-5 py-2 text-white font-medium rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
