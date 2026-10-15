import { useState } from "react";

function AIAssistantModal({ activeTab, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});

  const handleFieldChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = () => {
    let prompt = "";
    switch (activeTab) {
      case 'writing':
        prompt = `Write a ${formData.type || 'essay'} about "${formData.topic || 'friendly robots'}" in a ${formData.tone || 'creative'} tone.`;
        break;
      case 'translation':
        prompt = `Translate the following text into ${formData.lang || 'Hindi/English'}:\n\n"${formData.text || ''}"`;
        break;
      case 'coding':
        if (formData.action === 'debug') {
          prompt = `Debug this code and explain/fix the bugs:\n\n\`\`\`\n${formData.code || ''}\n\`\`\``;
        } else {
          prompt = `Write a clean program in ${formData.lang || 'Python'} to solve this task:\n\n${formData.task || ''}`;
        }
        break;
      case 'math':
        prompt = `Solve this mathematical problem step-by-step and explain the logical concept:\n\n${formData.equation || 'x^2 - 3x + 2 = 0'}`;
        break;
      case 'examprep':
        prompt = `Generate a practice questionnaire of ${formData.count || 3} questions for the competitive "${formData.exam || 'JEE/UPSC'}" exam on the topic "${formData.subject || 'Indian Constitution'}" with answers and step-by-step explanations.`;
        break;
      case 'research':
        prompt = `Research and gather complete details on the topic: "${formData.topic || 'History of Bihar'}". Compile it into a summary covering history, science, geography, and context.`;
        break;
      default:
        return;
    }
    onSubmit(prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-bg-default/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-hover border border-secondary/20 rounded-xl max-w-md w-full p-5 shadow-2xl relative select-text">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-text-secondary hover:text-text-primary text-sm cursor-pointer"
        >
          ✕
        </button>
        
        <h2 className="text-sm font-bold text-primary mb-4 capitalize flex items-center gap-2">
          {activeTab === 'writing' && '✍️ Writing Assistant'}
          {activeTab === 'translation' && '🌐 Language Translator'}
          {activeTab === 'coding' && '💻 Coding & Debugging'}
          {activeTab === 'math' && '🔢 Step-by-Step Math Solver'}
          {activeTab === 'examprep' && '📚 Competitive Exam Prep'}
          {activeTab === 'research' && '🔍 Instant Research Tool'}
        </h2>

        <div className="space-y-4 text-xs text-text-primary">
          {activeTab === 'writing' && (
            <>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Content Type</label>
                <select 
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                >
                  <option value="essay">Essay</option>
                  <option value="email">Professional Email</option>
                  <option value="poem">Poem</option>
                  <option value="story">Creative Story</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Topic or Subject</label>
                <textarea 
                  onChange={(e) => handleFieldChange('topic', e.target.value)}
                  placeholder="Enter writing topic..."
                  className="w-full p-2 h-20 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none resize-none text-xs"
                />
              </div>
            </>
          )}

          {activeTab === 'translation' && (
            <>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Target Language</label>
                <input 
                  type="text" 
                  onChange={(e) => handleFieldChange('lang', e.target.value)}
                  placeholder="e.g. Hindi, Spanish, French..."
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Text to Translate</label>
                <textarea 
                  onChange={(e) => handleFieldChange('text', e.target.value)}
                  placeholder="Enter words or sentences..."
                  className="w-full p-2 h-20 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none resize-none text-xs"
                />
              </div>
            </>
          )}

          {activeTab === 'coding' && (
            <>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">I want to...</label>
                <select 
                  onChange={(e) => handleFieldChange('action', e.target.value)}
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                >
                  <option value="write">Write Code</option>
                  <option value="debug">Debug Code</option>
                </select>
              </div>
              {formData.action === 'debug' ? (
                <div>
                  <label className="block text-[10px] text-text-secondary mb-1">Paste Buggy Code</label>
                  <textarea 
                    onChange={(e) => handleFieldChange('code', e.target.value)}
                    placeholder="Paste your code here..."
                    className="w-full p-2 h-24 rounded bg-bg-default border border-secondary/30 text-text-primary font-mono focus:outline-none resize-none text-xs"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Programming Language</label>
                    <input 
                      type="text" 
                      onChange={(e) => handleFieldChange('lang', e.target.value)}
                      placeholder="e.g. Python, Javascript, C++..."
                      className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Task description</label>
                    <textarea 
                      onChange={(e) => handleFieldChange('task', e.target.value)}
                      placeholder="e.g. Create a fibonacci generator..."
                      className="w-full p-2 h-20 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none resize-none text-xs"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'math' && (
            <>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Equation or Math Problem</label>
                <input 
                  type="text" 
                  onChange={(e) => handleFieldChange('equation', e.target.value)}
                  placeholder="e.g. x^2 - 3x + 2 = 0"
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary font-mono focus:outline-none text-xs"
                />
              </div>
            </>
          )}

          {activeTab === 'examprep' && (
            <>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Target Exam Name</label>
                <input 
                  type="text" 
                  onChange={(e) => handleFieldChange('exam', e.target.value)}
                  placeholder="e.g. UPSC, JEE, SAT, Banking..."
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Subject Topic</label>
                <input 
                  type="text" 
                  onChange={(e) => handleFieldChange('subject', e.target.value)}
                  placeholder="e.g. Indian History, Calculus, Mechanics..."
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Number of Questions</label>
                <input 
                  type="number" 
                  min="1"
                  max="10"
                  onChange={(e) => handleFieldChange('count', e.target.value)}
                  placeholder="3"
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                />
              </div>
            </>
          )}

          {activeTab === 'research' && (
            <>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Topic for Research</label>
                <input 
                  type="text" 
                  onChange={(e) => handleFieldChange('topic', e.target.value)}
                  placeholder="e.g. Black Holes, Indus Valley Civilization..."
                  className="w-full p-2.5 rounded bg-bg-default border border-secondary/30 text-text-primary focus:outline-none text-xs"
                />
              </div>
            </>
          )}
        </div>

        <button 
          onClick={handleSubmit}
          className="w-full mt-5 py-2.5 bg-primary text-bg-default font-bold rounded-lg hover:bg-primary/80 transition text-xs cursor-pointer"
        >
          🚀 Generate Prompt Request
        </button>
      </div>
    </div>
  );
}


export default AIAssistantModal;