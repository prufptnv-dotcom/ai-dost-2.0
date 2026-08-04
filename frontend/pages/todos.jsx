import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, ListTodo, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';

export default function TodosPage() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchTodos = async () => {
    try {
      const token = localStorage.getItem('ai_dost_token');
      const res = await fetch('/api/v1/todos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
      }
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('ai_dost_token');
      const res = await fetch('/api/v1/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTask.trim() })
      });
      if (res.ok) {
        const todo = await res.json();
        setTodos([todo, ...todos]);
        setNewTask('');
      } else {
        showToast?.({ type: 'error', message: 'Failed to create task.' });
      }
    } catch (err) {
      showToast?.({ type: 'error', message: 'Error connecting to server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTodo = async (todo) => {
    try {
      const token = localStorage.getItem('ai_dost_token');
      // Optimistic update
      setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t));
      
      await fetch(`/api/v1/todos/${todo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !todo.completed })
      });
    } catch (err) {
      // Revert on failure
      setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: todo.completed } : t));
      showToast?.({ type: 'error', message: 'Failed to update task.' });
    }
  };

  const deleteTodo = async (id) => {
    try {
      const token = localStorage.getItem('ai_dost_token');
      // Optimistic delete
      const previousTodos = [...todos];
      setTodos(todos.filter(t => t.id !== id));
      
      const res = await fetch(`/api/v1/todos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        setTodos(previousTodos);
        showToast?.({ type: 'error', message: 'Failed to delete task.' });
      }
    } catch (err) {
      showToast?.({ type: 'error', message: 'Error deleting task.' });
    }
  };

  return (
    <div className="min-h-screen text-[#f0f2f5] flex flex-col" style={{ background: '#05060a' }}>
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-cyan-400/10 border border-cyan-400/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <ListTodo className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Tasks</h1>
              <p className="text-sm text-[#64748b]">Manage your project goals</p>
            </div>
          </div>

          <form onSubmit={handleAddTodo} className="relative mb-10">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full h-14 pl-5 pr-14 rounded-2xl text-[15px] text-white placeholder-[#475569] focus:outline-none transition-all shadow-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; e.target.style.boxShadow = '0 0 20px rgba(6,182,212,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newTask.trim() || isSubmitting}
              className="absolute right-2 top-2 bottom-2 w-10 rounded-xl flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 transition-colors shadow-md cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Plus className="w-5 h-5 text-white" />}
            </button>
          </form>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-3xl" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)' }}>
              <ListTodo className="w-12 h-12 text-[#334155] mb-4" />
              <p className="text-white font-semibold">No tasks yet</p>
              <p className="text-sm text-[#64748b]">Add a task above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {todos.map((todo) => (
                  <motion.div
                    key={todo.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group flex items-center gap-4 p-4 rounded-2xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <button
                      onClick={() => toggleTodo(todo)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                        todo.completed ? 'bg-green-500 border-green-500' : 'border-[#475569] hover:border-cyan-400'
                      }`}
                    >
                      {todo.completed && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </button>
                    
                    <span className={`flex-1 text-[15px] font-medium transition-all ${todo.completed ? 'text-[#475569] line-through' : 'text-[#e2e8f0]'}`}>
                      {todo.title}
                    </span>
                    
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
