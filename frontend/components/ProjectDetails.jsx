import React, { useState, useEffect } from 'react';
import { FaUserFriends, FaChartLine, FaTools, FaBell, FaCheck, FaTrash, FaPlus } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';

const ProjectDetails = ({ project }) => {
  const collaborators = project.collaborators || [];
  const techStack = project.tech_stack || [];
  
  const [tasks, setTasks] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [timerMin, setTimerMin] = useState(1);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setHasNotificationPermission(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setHasNotificationPermission(true);
          }
        });
      }
    }
  }, []);

  const playAlertSound = () => {
    if (typeof window !== 'undefined') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5 note
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (err) {
        console.error('Audio synthesis failed:', err);
      }
    }
  };

  const handleAddTask = () => {
    if (!taskText.trim()) return;

    const taskId = Date.now();
    const minutes = parseFloat(timerMin);
    const hasTimer = !isNaN(minutes) && minutes > 0;
    
    const newTask = {
      id: taskId,
      text: taskText.trim(),
      completed: false,
      hasTimer,
      duration: minutes,
      createdAt: new Date()
    };

    setTasks(prev => [...prev, newTask]);
    setTaskText('');
    showToast({ type: 'success', message: 'Task added!' });

    if (hasTimer) {
      const delayMs = minutes * 60 * 1000;
      setTimeout(() => {
        playAlertSound();
        showToast({ type: 'info', message: `⏰ Reminder: ${newTask.text}` });
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('AI-Dost Task Alert', {
            body: newTask.text
          });
        }
        
        setTasks(currentTasks => 
          currentTasks.map(t => t.id === taskId ? { ...t, completed: true } : t)
        );
      }, delayMs);
    }
  };

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-6 p-6 bg-bg-default border border-secondary/10 rounded-xl max-h-full overflow-y-auto">
      {/* Project Stats */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-primary flex items-center">
          <FaChartLine className="mr-2 text-sm text-primary" /> Project Stats
        </h3>
        <div className="grid grid-cols-2 gap-4 bg-bg-hover p-4 rounded-lg">
          <div>
            <div className="text-xs text-text-secondary">Status</div>
            <div className="text-sm font-semibold text-primary capitalize">{project.status || 'mvp'}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Commits</div>
            <div className="text-sm font-semibold text-primary">{project.total_commits || 0}</div>
          </div>
        </div>
      </div>
      
      {/* Tech Stack */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-primary flex items-center">
          <FaTools className="mr-2 text-sm text-primary" /> Tech Stack
        </h3>
        {techStack.length === 0 ? (
          <div className="text-xs text-text-secondary italic">No tech stack declared.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech, i) => (
              <span key={i} className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                {typeof tech === 'string' ? tech : (tech.name || tech.language || '')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Daily Reminders & Tasks Panel */}
      <div className="space-y-3 border-t border-secondary/10 pt-5">
        <h3 className="text-lg font-bold text-primary flex items-center">
          <FaBell className="mr-2 text-sm text-primary" /> Tasks & Reminders
        </h3>
        
        <div className="space-y-2">
          {/* Quick Task Input Form */}
          <div className="flex flex-col gap-2 bg-bg-hover p-3 rounded-lg border border-secondary/5">
            <input 
              type="text"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="Task name (e.g. Code Review)..."
              className="p-2 bg-bg-default border border-secondary/30 rounded text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary w-full"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-secondary">Timer:</span>
                <input 
                  type="number"
                  min="0"
                  step="0.5"
                  value={timerMin}
                  onChange={(e) => setTimerMin(e.target.value)}
                  className="w-12 p-1 bg-bg-default border border-secondary/30 rounded text-xs text-text-primary text-center"
                />
                <span className="text-[10px] text-text-secondary">min</span>
              </div>
              <button 
                onClick={handleAddTask}
                className="flex items-center gap-1 px-3 py-1 bg-primary text-bg-default rounded text-xs font-bold hover:bg-primary/80 transition cursor-pointer"
              >
                <FaPlus className="text-[10px]" /> Add
              </button>
            </div>
          </div>

          {/* Checklist Area */}
          <div className="max-y-[150px] overflow-y-auto space-y-2 pt-1 pr-1">
            {tasks.length === 0 ? (
              <div className="text-xs text-text-secondary italic text-center py-2 bg-bg-hover/30 rounded">No active tasks or alarms.</div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 bg-bg-hover rounded border border-secondary/5 text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button 
                      onClick={() => toggleTask(task.id)}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer shrink-0 transition ${
                        task.completed 
                          ? 'bg-success border-success text-bg-default' 
                          : 'border-secondary/40 hover:border-primary'
                      }`}
                    >
                      {task.completed && <FaCheck className="text-[8px] font-bold" />}
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-text-primary truncate ${task.completed ? 'line-through text-text-secondary' : ''}`}>
                        {task.text}
                      </span>
                      {task.hasTimer && (
                        <span className="text-[9px] text-warning font-semibold">
                          ⏰ Alarm: {task.duration}m
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="text-text-secondary hover:text-danger p-1 transition cursor-pointer"
                  >
                    <FaTrash className="text-[10px]" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Collaborators */}
      <div className="space-y-3 border-t border-secondary/10 pt-5">
        <h3 className="text-lg font-bold text-primary flex items-center">
          <FaUserFriends className="mr-2 text-sm text-primary" /> Collaborators
        </h3>
        {collaborators.length === 0 ? (
          <div className="text-xs text-text-secondary italic">Solo project.</div>
        ) : (
          <div className="flex flex-col space-y-3">
            {collaborators.map((collab, i) => (
              <div key={i} className="flex items-center space-x-3 bg-bg-hover p-2 rounded-lg">
                {collab.avatar_url ? (
                  <img src={collab.avatar_url} className="w-8 h-8 rounded-full border border-secondary/20" alt={collab.name} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-secondary/30 flex items-center justify-center text-xs font-bold text-primary">
                    {collab.name ? collab.name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="text-sm text-text-primary">{collab.name || collab.username || 'User'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;
