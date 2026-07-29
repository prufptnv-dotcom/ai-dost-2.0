import { useState, useRef, useEffect } from 'react';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

// Extract image URLs from AI text
const IMAGE_URL_REGEX = /https?:\/\/[^\s"'<>]+?\.(png|jpg|jpeg|gif|webp)(\?[^\s"'<>]*)?/gi;
const POLLINATIONS_REGEX = /https?:\/\/image\.pollinations\.ai\/[^\s"'<>]+/gi;

function extractImages(text) {
  const all = [
    ...(text.match(IMAGE_URL_REGEX) || []),
    ...(text.match(POLLINATIONS_REGEX) || []),
  ];
  return [...new Set(all)];
}

function stripImageUrls(text) {
  return text
    .replace(IMAGE_URL_REGEX, '')
    .replace(POLLINATIONS_REGEX, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Render citations as styled clickable badges
function formatTextWithCitations(text, query) {
  if (!text) return null;
  const citationRegex = /\[([0-9]+)\]/g;
  const searchUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query || 'Bihar')}`;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = citationRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }
    
    const num = match[1];
    parts.push(
      <a 
        key={`cite-${num}-${matchIndex}`}
        href={searchUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full mx-0.5 hover:bg-primary hover:text-bg-default transition select-none cursor-pointer align-super"
        title={`Click to check Wikipedia source search for: ${query}`}
      >
        {num}
      </a>
    );
    
    lastIndex = citationRegex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

// Custom component to parse and render message content with apply button on code blocks
function MessageContent({ text, onWriteCode, query = '' }) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Match fenced code blocks: ```lang\ncode```
  const regex = /```(\w*)\n([\s\S]*?)```/g;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    parts.push({
      type: 'code',
      language: match[1],
      content: match[2]
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  if (parts.length === 0) {
    return <div className="whitespace-pre-wrap break-words">{formatTextWithCitations(text, query)}</div>;
  }

  return (
    <div className="space-y-2.5 p-3">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <div key={i} className="whitespace-pre-wrap break-words">{formatTextWithCitations(part.content, query)}</div>;
        } else {
          return (
            <div key={i} className="my-2 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0c0c10] font-mono text-xs shadow-inner">
              <div className="flex justify-between items-center px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.08] text-text-secondary select-none">
                <span className="capitalize text-[10px] font-bold text-primary">{part.language || 'code'}</span>
                {onWriteCode && (
                  <button
                    onClick={() => onWriteCode(part.content)}
                    className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary font-bold rounded-lg text-[9px] hover:bg-primary hover:text-bg-default transition cursor-pointer"
                  >
                    Apply Code
                  </button>
                )}
              </div>
              <pre className="p-3 overflow-x-auto select-text">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }
      })}
    </div>
  );
}

function GeneratedImage({ url, alt }) {
  const [status, setStatus] = useState('loading');

  return (
    <div className="rounded-lg overflow-hidden border border-secondary/20 bg-black/20 min-h-[120px] flex items-center justify-center relative">
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">Generating image...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="p-4 text-center">
          <div className="text-2xl mb-1">⚠️</div>
          <p className="text-xs text-text-secondary">Image load nahi hui.</p>
          <button
            onClick={() => setStatus('loading')}
            className="mt-2 text-xs text-primary underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      <img
        src={url}
        alt={alt || 'Generated image'}
        className={`w-full h-auto max-h-64 object-contain transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0 h-0'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}

function MessageBubble({ msg, onWriteCode, onCreatePage }) {
  const isAI = msg.sender === 'ai';
  const images = msg.images || [];
  const cleanText = msg.text ? stripImageUrls(msg.text) : '';
  const inlineImages = msg.text ? extractImages(msg.text) : [];
  const allImages = [...new Set([...images, ...inlineImages])];

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-1`}>
      <div className={`max-w-[92%] rounded-xl text-sm overflow-hidden shadow-md backdrop-blur-md transition-all duration-200 ${
        isAI
          ? 'bg-white/[0.03] border border-white/[0.08] text-text-primary hover:border-primary/15'
          : 'bg-primary/10 border border-primary/30 text-text-primary'
      }`}>
        {cleanText && (
          <MessageContent text={cleanText} onWriteCode={onWriteCode} query={msg.query || ''} />
        )}
        
        {/* Perplexity Styled Sources Grid */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="px-3 pb-3 pt-1.5 border-t border-white/[0.05] bg-black/10 select-text">
            <div className="text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>🌐</span> Sources & Citations
            </div>
            <div className="grid grid-cols-2 gap-2">
              {msg.sources.map((src, idx) => (
                <a 
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] rounded flex flex-col text-[10px] min-w-0 transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <span className="font-semibold text-primary truncate">{src.title}</span>
                  <span className="text-[8px] text-text-secondary truncate">{src.domain}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {msg.pdfUrl && (
          <div className="px-3 pb-3">
            <a
              href={msg.pdfUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-2 p-2 bg-success text-bg-default font-bold rounded-lg hover:bg-success/80 transition text-xs cursor-pointer text-center"
            >
              📥 Download PDF: {msg.pdfName || 'Document'}
            </a>
          </div>
        )}
        
        {allImages.length > 0 && (
          <div className={`space-y-2 ${cleanText ? 'px-3 pb-3' : 'p-3'}`}>
            {allImages.map((url, idx) => (
              <GeneratedImage key={`${url}-${idx}`} url={url} alt={cleanText} />
            ))}
          </div>
        )}

        {/* Perplexity Page Creation Action */}
        {isAI && cleanText && onCreatePage && (
          <div className="px-3 pb-2 pt-1 flex justify-end border-t border-secondary/5 mt-1 bg-secondary/5">
            <button
              onClick={() => onCreatePage(msg.query || 'Research Article', cleanText)}
              className="px-2 py-1 bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-text-secondary hover:text-text-primary rounded text-[9px] transition cursor-pointer flex items-center gap-1 font-semibold"
              title="Convert this research response into a shareable Page document"
            >
              📄 Create Perplexity Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AIPageView({ page, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [pageContent, setPageContent] = useState(page.content);

  return (
    <div className="fixed inset-0 bg-bg-default z-50 overflow-y-auto flex flex-col select-text">
      {/* Header */}
      <div className="sticky top-0 bg-bg-hover border-b border-secondary/10 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">📄</span>
          <h1 className="text-sm font-bold text-primary">AI-Dost Pages</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 border border-secondary/30 rounded-lg text-xs font-semibold text-text-secondary hover:bg-secondary/10 transition cursor-pointer"
          >
            {isEditing ? 'Save Page' : '✏️ Edit Page'}
          </button>
          <button 
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.href);
                alert('Page share link copied to clipboard!');
              }
            }}
            className="px-3 py-1.5 bg-primary text-bg-default rounded-lg text-xs font-bold hover:bg-primary/80 transition cursor-pointer"
          >
            🔗 Share Page
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary text-sm cursor-pointer ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Table of Contents */}
        <div className="hidden md:block col-span-1 border-r border-secondary/10 pr-6 space-y-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Sections</h3>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li className="font-semibold text-primary cursor-pointer">1. Introduction</li>
            <li className="cursor-pointer hover:text-primary transition">2. Key Findings</li>
            <li className="cursor-pointer hover:text-primary transition">3. Logical Summary</li>
          </ul>
        </div>

        {/* Article Body */}
        <div className="col-span-1 md:col-span-3 space-y-6">
          <h2 className="text-2xl font-bold text-primary">{page.title}</h2>
          
          {isEditing ? (
            <textarea
              value={pageContent}
              onChange={(e) => setPageContent(e.target.value)}
              className="w-full h-[500px] p-4 bg-bg-hover text-text-primary border border-secondary/30 rounded-xl focus:outline-none font-mono text-sm resize-none"
            />
          ) : (
            <div className="prose prose-invert max-w-none text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {pageContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

const AICompanion = ({ onWriteCode, currentCode, currentFile }) => {
  const { mode } = useMode();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `Namaste! 🤖 Main Ai-Dost hoon.\n\n💬 Chat karo ya /image <description> type karo image banane ke liye!\n\n💡 Aap mujhse code likhva sakte hain. Main jo code block suggest karunga, use aap direct 'Apply Code' button se editor me insert kar sakte hain!`,
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const bottomRef = useRef(null);
  const [assistantTab, setAssistantTab] = useState(null);
  
  // Perplexity-style Advanced Search & Document states
  const [selectedModel, setSelectedModel] = useState('auto');
  const [localModels, setLocalModels] = useState([]);
  const [focusMode, setFocusMode] = useState('all');
  const [isProSearch, setIsProSearch] = useState(false);
  const [proSearchStages, setProSearchStages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);

  // Voice Call States
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [voiceCallStatus, setVoiceCallStatus] = useState('Connecting...');
  const [voiceCallText, setVoiceCallText] = useState('');
  const isVoiceCallActiveRef = useRef(false);
  const callRecognitionRef = useRef(null);

  // Speech Recognition & Synthesis states
  const [isListening, setIsListening] = useState(false);
  const [speakOutput, setSpeakOutput] = useState(false); // Default to muted, togglable by user
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'hi-IN'; // Works great for Hinglish, Hindi, and English
        
        rec.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
        };
        
        rec.onend = () => {
          isListeningRef.current = false;
          setIsListening(false);
        };
        
        rec.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
        };
        
        rec.onerror = (e) => {
          console.error('Speech recognition error:', e);
          isListeningRef.current = false;
          setIsListening(false);
        };
        
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => {
    const fetchLocalModels = async () => {
      try {
        const res = await fetch('/api/chat/local-models');
        const data = await res.json();
        if (data.success && data.models) {
          setLocalModels(data.models);
        }
      } catch (err) {
        console.error('Failed to fetch local models:', err);
      }
    };
    fetchLocalModels();
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast({ type: 'warning', message: 'Speech Recognition not supported in this browser.' });
      return;
    }

    if (isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Failed to stop speech recognition:', err);
      }
    } else {
      try {
        // Prevent calling start if already in active starting phase
        isListeningRef.current = true; 
        recognitionRef.current.start();
      } catch (err) {
        isListeningRef.current = false;
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const speakText = (text, onFinishedCallback = null) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Mute ongoing audio

      // Strip markup tags for voice read readability
      const cleanReadText = text
        .replace(/```[\s\S]*?```/g, '[Coding block displayed on screen]')
        .replace(/\[GENERATE_PDF:[\s\S]*?\[\/GENERATE_PDF\]/g, '')
        .replace(/[*#_~]/g, '');

      const utterance = new SpeechSynthesisUtterance(cleanReadText);
      utterance.lang = 'hi-IN'; // Localized friendly sound accent

      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      }

      if (onFinishedCallback) {
        utterance.onend = () => {
          onFinishedCallback();
        };
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  const startListeningForCall = () => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast({ type: 'error', message: 'Speech recognition is not supported in this browser.' });
      return;
    }

    setVoiceCallStatus("Listening...");

    const callRec = new SpeechRecognition();
    callRec.continuous = false;
    callRec.interimResults = false;
    callRec.lang = 'hi-IN';

    callRec.onstart = () => {
      console.log('Voice Call Mic active');
    };

    callRec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      console.log('Spoken:', text);
      triggerVoiceCallTurn(text);
    };

    callRec.onerror = (e) => {
      console.error('Call mic error:', e);
      if (isVoiceCallActiveRef.current) {
        setTimeout(() => {
          if (isVoiceCallActiveRef.current) startListeningForCall();
        }, 1200);
      }
    };

    callRec.onend = () => {
      console.log('Call mic end');
    };

    callRec.start();
    callRecognitionRef.current = callRec;
  };

  const triggerVoiceCallTurn = async (spokenText) => {
    if (!spokenText.trim()) return;
    setVoiceCallStatus("Thinking...");
    setVoiceCallText(`You: "${spokenText}"`);

    try {
      const historyPayload = messages.map(msg => ({
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.text || ''
      }));

      const customKeys = {
        gemini: localStorage.getItem('customGeminiKey') || '',
        groq: localStorage.getItem('customGroqKey') || '',
        deepseek: localStorage.getItem('customDeepSeekKey') || '',
        nvidia: localStorage.getItem('customNvidiaKey') || '',
        openrouter: localStorage.getItem('customOpenRouterKey') || ''
      };

      const payload = {
        message: spokenText,
        mode: mode,
        history: historyPayload,
        customKeys: customKeys,
        uploadedDocs: uploadedDocs.map(d => ({ name: d.name, content: d.content }))
      };

      if (selectedModel !== 'auto') {
        payload.model = selectedModel;
      }

      if (mode === 'project' && currentCode) {
        payload.fileContent = currentCode;
        payload.section = 'coding';
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.reply) {
        setMessages(prev => [
          ...prev, 
          { sender: 'user', text: spokenText, timestamp: new Date().toLocaleTimeString() },
          { sender: 'ai', text: data.reply, timestamp: new Date().toLocaleTimeString() }
        ]);

        setVoiceCallText(data.reply);
        setVoiceCallStatus("Speaking...");
        
        speakText(data.reply, () => {
          if (isVoiceCallActiveRef.current) {
            startListeningForCall();
          }
        });
      } else {
        setVoiceCallText("Server returned an error. Please try again.");
        setVoiceCallStatus("Error");
        setTimeout(() => {
          if (isVoiceCallActiveRef.current) startListeningForCall();
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      setVoiceCallText("Network connection failed.");
      setVoiceCallStatus("Error");
      setTimeout(() => {
        if (isVoiceCallActiveRef.current) startListeningForCall();
      }, 3000);
    }
  };

  const handleToggleVoiceCall = () => {
    if (isVoiceCallActive) {
      isVoiceCallActiveRef.current = false;
      setIsVoiceCallActive(false);
      if (callRecognitionRef.current) {
        callRecognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      showToast({ type: 'info', message: 'Voice call ended.' });
    } else {
      isVoiceCallActiveRef.current = true;
      setIsVoiceCallActive(true);
      setVoiceCallText("Connecting to AI-Dost voice server...");
      setVoiceCallStatus("Connecting...");
      
      speakText("Haan dost, mai sun raha hoon. Aap bolna shuru kijiye.", () => {
        if (isVoiceCallActiveRef.current) {
          startListeningForCall();
        }
      });
    }
  };

  const handleQuickAction = (templateText) => {
    setInput(templateText);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const isImage = file.type.startsWith('image/');
    
    reader.onload = (event) => {
      const fileData = {
        name: file.name,
        content: event.target.result,
        type: isImage ? 'image' : 'text',
        size: (file.size / 1024).toFixed(1) + ' KB',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setAttachedFile(fileData);
      setUploadedDocs(prev => {
        if (prev.some(d => d.name === file.name)) return prev;
        return [...prev, fileData];
      });
      showToast({ type: 'success', message: `Attached and added to Document Library: ${file.name}` });
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;

    const textInput = input.trim();
    let displayPrompt = textInput;
    let apiPrompt = textInput;

    if (attachedFile) {
      const getContextLimit = (model) => {
        switch (model) {
          case 'groq':
          case 'deepseek':
            return 25000;
          case 'gemini':
            return 300000;
          default:
            return 25000;
        }
      };

      const limit = getContextLimit(selectedModel);
      let fileContent = attachedFile.content || '';
      
      if (fileContent.length > limit) {
        fileContent = fileContent.substring(0, limit) + `\n\n...[Content truncated for model context window limits. Total original length: ${fileContent.length.toLocaleString()} characters]...`;
        showToast({
          type: 'warning',
          message: `File content truncated to ${limit.toLocaleString()} characters to fit AI context window.`
        });
      }

      displayPrompt = `📎 [Attached: ${attachedFile.name}]\n${textInput}`;
      apiPrompt = `[Uploaded ${attachedFile.type} file: ${attachedFile.name}]\nContent:\n${fileContent}\n\nUser request: ${textInput}`;
    }

    setMessages(prev => [...prev, { text: displayPrompt, sender: 'user', query: textInput || 'General Search' }]);
    setInput('');
    setAttachedFile(null); // Clear uploader

    // ---- /image command ----
    if (textInput.toLowerCase().startsWith('/image ')) {
      const imagePrompt = textInput.substring(7).trim();
      setIsGeneratingImage(true);
      setIsTyping(true);

      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=768&height=512&nologo=true`;

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: `🎨 "${imagePrompt}"`,
        images: [pollinationsUrl],
        query: textInput
      }]);

      setIsTyping(false);
      setIsGeneratingImage(false);
      return;
    }

    // ---- Normal chat ----
    setIsTyping(true);
    
    // ---- Pro Search Multi-Step Simulator ----
    if (isProSearch) {
      setProSearchStages(['🔍 Breaking down search queries...']);
      await new Promise(resolve => setTimeout(resolve, 800));
      setProSearchStages(prev => [...prev, `🌐 Searching ${focusMode} indices & web catalogs...`]);
      await new Promise(resolve => setTimeout(resolve, 800));
      setProSearchStages(prev => [...prev, '⚖️ Verifying 4 source publications & structural citations...']);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      const historyPayload = messages.map(msg => ({
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.text || ''
      }));

      const customKeys = {
        gemini: localStorage.getItem('customGeminiKey') || '',
        groq: localStorage.getItem('customGroqKey') || '',
        deepseek: localStorage.getItem('customDeepSeekKey') || '',
        nvidia: localStorage.getItem('customNvidiaKey') || '',
        openrouter: localStorage.getItem('customOpenRouterKey') || ''
      };

      const requestPayload = {
        message: apiPrompt,
        mode: mode,
        history: historyPayload,
        customKeys: customKeys,
        uploadedDocs: uploadedDocs.map(d => ({ name: d.name, content: d.content }))
      };
      
      if (selectedModel !== 'auto') {
        requestPayload.model = selectedModel;
      }
      
      // Inject current active file content for code editing context ONLY in project mode
      if (mode === 'project' && currentCode) {
        requestPayload.fileContent = currentCode;
        requestPayload.section = 'coding';
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();
      const replyText = data.reply || 'AI response here...';

      // Parse custom [GENERATE_PDF: Title] content [/GENERATE_PDF] tags
      const pdfRegex = /\[GENERATE_PDF:\s*(.*?)\]([\s\S]*?)\[\/GENERATE_PDF\]/i;
      const pdfMatch = replyText.match(pdfRegex);
      
      let finalReplyText = replyText;
      let pdfUrl = null;
      let pdfName = '';
      
      if (pdfMatch) {
        const pdfTitle = pdfMatch[1].trim();
        const innerContent = pdfMatch[2].trim();
        const cleanChatText = replyText.replace(pdfRegex, '').trim();
        
        // Strip tag block from message bubbles
        finalReplyText = replyText.replace(pdfRegex, `📄 Compiled PDF report: "${pdfTitle}"`).trim();
        
        // Fallback to full detailed text if tags content is summarized/shorter
        const pdfContent = innerContent.length > (cleanChatText.length * 0.7) ? innerContent : cleanChatText;
        
        try {
          const pdfRes = await fetch('/api/pdf/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: pdfTitle, content: pdfContent })
          });
          const pdfData = await pdfRes.json();
          if (pdfData.success && pdfData.downloadUrl) {
            pdfUrl = pdfData.downloadUrl;
            pdfName = pdfTitle;
          }
        } catch (err) {
          console.error('PDF route compilation failed:', err);
        }
      }

      // Parse custom [GENERATE_IMAGE: descriptive prompt] tags
      const imageTagRegex = /\[GENERATE_IMAGE:\s*(.*?)\]/i;
      const imageMatch = finalReplyText.match(imageTagRegex);
      
      let generatedImages = [];
      if (imageMatch) {
        const imagePromptText = imageMatch[1].trim();
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=768&height=512&nologo=true`;
        generatedImages.push(pollinationsUrl);
        // Replace tag in the chat message
        finalReplyText = finalReplyText.replace(imageTagRegex, `🎨 Generated Image for: "${imagePromptText}"`).trim();
      }

      // Generate mock clickable citations based on the query and focus mode
      let sources = [];
      if (isProSearch || focusMode !== 'all') {
        if (focusMode === 'academic') {
          sources = [
            { title: 'Semantic Scholar publication archive', domain: 'semanticscholar.org', url: `https://www.semanticscholar.org/search?q=${encodeURIComponent(textInput)}` },
            { title: 'arXiv Database of scientific preprints', domain: 'arxiv.org', url: `https://arxiv.org/search/?query=${encodeURIComponent(textInput)}&searchtype=all` }
          ];
        } else if (focusMode === 'reddit') {
          sources = [
            { title: 'Community discussions thread', domain: 'reddit.com', url: `https://www.reddit.com/search/?q=${encodeURIComponent(textInput)}` },
            { title: 'Subreddit forum answers', domain: 'reddit.com', url: `https://www.reddit.com/search/?q=${encodeURIComponent(textInput)}` }
          ];
        } else {
          sources = [
            { title: 'Wikipedia citation archives', domain: 'wikipedia.org', url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(textInput)}` },
            { title: 'Britannica global topic index', domain: 'britannica.com', url: `https://www.britannica.com/search?query=${encodeURIComponent(textInput)}&searchtype=all` }
          ];
        }
      }

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: finalReplyText,
        images: generatedImages.length > 0 ? generatedImages : undefined,
        pdfUrl: pdfUrl,
        pdfName: pdfName,
        sources: sources,
        query: textInput
      }]);
      speakText(finalReplyText);
    } catch {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Sorry, kuch connection issue hai.',
      }]);
    } finally {
      setIsTyping(false);
      setProSearchStages([]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-default/40 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden relative animate-fadeIn animate-pulseGlow">
      {/* Fullscreen Document Page View */}
      {activePage && (
        <AIPageView 
          page={activePage} 
          onClose={() => setActivePage(null)} 
        />
      )}

      {isVoiceCallActive && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-8 text-center text-text-primary select-none animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col items-center gap-1 mt-4">
            <div className="text-xs text-text-secondary tracking-widest font-bold uppercase">AI-Dost Voice Room</div>
            <div className="text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full flex items-center gap-1.5 font-semibold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {voiceCallStatus}
            </div>
          </div>

          {/* Dynamic Waveform Visualizer */}
          <div className="flex items-center justify-center relative w-48 h-48 my-auto">
            {voiceCallStatus === 'Listening...' && (
              <>
                <div className="absolute w-44 h-44 rounded-full bg-primary/5 border border-primary/10 animate-ping" />
                <div className="absolute w-36 h-36 rounded-full bg-primary/10 border border-primary/20 animate-pulse duration-1000" />
              </>
            )}
            {voiceCallStatus === 'Thinking...' && (
              <div className="absolute w-36 h-36 rounded-full border border-dashed border-warning/40 animate-spin duration-3000" />
            )}
            {voiceCallStatus === 'Speaking...' && (
              <>
                <div className="absolute w-40 h-40 rounded-full bg-success/5 border border-success/15 animate-ping duration-1500" />
                <div className="absolute w-32 h-32 rounded-full bg-success/10 border border-success/30 animate-pulse" />
              </>
            )}
            
            {/* Center Circle */}
            <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border ${
              voiceCallStatus === 'Listening...' ? 'bg-primary/20 border-primary text-primary shadow-primary/20' :
              voiceCallStatus === 'Thinking...' ? 'bg-warning/20 border-warning text-warning shadow-warning/20' :
              voiceCallStatus === 'Speaking...' ? 'bg-success/20 border-success text-success shadow-success/20' :
              'bg-white/5 border-white/10 text-text-secondary'
            }`}>
              <span className="text-4xl">
                {voiceCallStatus === 'Listening...' ? '🎙️' :
                 voiceCallStatus === 'Thinking...' ? '🧠' :
                 voiceCallStatus === 'Speaking...' ? '🗣️' :
                 '📞'}
              </span>
            </div>
          </div>

          {/* Transcript Display Bubble */}
          <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] p-4 rounded-2xl min-h-[90px] flex items-center justify-center mb-6 select-text">
            <p className="text-xs italic text-text-secondary leading-relaxed max-h-[80px] overflow-y-auto w-full select-text">
              {voiceCallText || 'Speak now... AI-Dost is listening.'}
            </p>
          </div>

          {/* Footer Actions */}
          <button
            onClick={handleToggleVoiceCall}
            className="w-14 h-14 bg-danger hover:bg-danger/80 text-bg-default rounded-full flex items-center justify-center shadow-xl shadow-danger/20 transition-transform active:scale-95 cursor-pointer text-xl shrink-0"
            title="End Voice Call"
          >
            <span>🛑</span>
          </button>
        </div>
      )}

      {assistantTab && (
        <AIAssistantModal 
          activeTab={assistantTab}
          onClose={() => setAssistantTab(null)}
          onSubmit={(prompt) => {
            setInput(prompt);
            showToast({ type: 'success', message: 'Prompt ready! Click send to query AI-Dost.' });
          }}
        />
      )}

      {showLibrary && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex flex-col p-6 overflow-y-auto select-text text-text-primary">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <span>🗂️ RAG Document Library</span>
            </div>
            <button 
              onClick={() => setShowLibrary(false)}
              className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            {uploadedDocs.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-xs">
                No documents uploaded yet. Use the paperclip icon in chat to attach books or text files!
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {uploadedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:border-primary/30 transition text-left">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-xs font-bold text-text-primary flex items-center gap-1.5 truncate">
                        <span>📄 {doc.name}</span>
                        <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-normal capitalize shrink-0">
                          {doc.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-secondary flex items-center gap-2">
                        <span>Size: {doc.size}</span>
                        <span>•</span>
                        <span>Added: {doc.timestamp}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary hover:text-bg-default text-primary text-[10px] font-bold rounded-lg transition cursor-pointer"
                      >
                        📖 View Doc
                      </button>
                      <button
                        onClick={() => {
                          setUploadedDocs(prev => prev.filter(d => d.name !== doc.name));
                          showToast({ type: 'info', message: `${doc.name} removed from library.` });
                        }}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition cursor-pointer"
                        title="Remove Document"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {viewingDoc && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col p-6 overflow-hidden select-text text-text-primary">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2 text-primary font-bold text-sm truncate font-sans">
              <span>📖 Reading: {viewingDoc.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold select-none">RAG Indexed</span>
              <button 
                onClick={() => setViewingDoc(null)}
                className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
              >
                ✕ Back to Library
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-white/[0.02] border border-white/[0.08] rounded-xl p-5 font-sans text-xs leading-relaxed text-left w-full select-text whitespace-pre-wrap">
            {viewingDoc.content}
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-secondary/10 shrink-0 bg-bg-hover/20">
        <div className="flex flex-col">
          <h1 className="text-sm font-bold text-primary flex items-center gap-1.5">
            🤖 Ai-Dost
            {currentFile && (
              <span className="text-[9px] font-normal text-text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/10">
                📄 {currentFile}
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Multi-Model Selector */}
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-bg-default text-text-primary border border-secondary/30 p-1 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-primary font-semibold cursor-pointer"
          >
            <option value="auto">🤖 Auto-Model</option>
            <option value="groq">🦙 Groq (Llama 3)</option>
            <option value="gemini">♊ Gemini Flash</option>
            <option value="deepseek">🐳 DeepSeek V3</option>
            <option value="nvidia">💚 NVIDIA NIM</option>
            <option value="openrouter">🪐 OpenRouter</option>
            {localModels.length > 0 && (
              <optgroup label="💻 Local Models (Ollama)">
                {localModels.map(m => (
                  <option 
                    key={m.id} 
                    value={m.id}
                    disabled={!m.isCompatible}
                    className={!m.isCompatible ? 'opacity-40 line-through text-text-secondary' : ''}
                  >
                    💻 {m.name} ({m.size} - {m.isCompatible ? m.category : '⚠️ Requires >6GB VRAM (Disabled)'})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            onClick={() => setShowLibrary(true)}
            className="bg-primary/10 border border-primary/20 hover:bg-primary hover:text-bg-default text-primary text-[10px] px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer select-none"
            title="Open RAG Document Library"
          >
            <span>🗂️ Library</span>
            {uploadedDocs.length > 0 && (
              <span className="bg-primary text-bg-default text-[8px] px-1 rounded-full">{uploadedDocs.length}</span>
            )}
          </button>
          <span className="text-[10px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold">Active</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 select-text">
        {messages.map((msg, i) => (
          <MessageBubble 
            key={i} 
            msg={msg} 
            onWriteCode={onWriteCode} 
            onCreatePage={(title, text) => setActivePage({ title, content: text })} 
          />
        ))}

        {/* Pro Search Stages log */}
        {isProSearch && proSearchStages.length > 0 && (
          <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-xl space-y-1.5 text-xs text-text-secondary max-w-[90%] select-text">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <span className="animate-spin text-[10px] border-2 border-primary border-t-transparent rounded-full w-3.5 h-3.5" />
              Agentic Pro Search Execution
            </div>
            {proSearchStages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-success text-[10px]">✓</span>
                <span className="font-mono text-[10px]">{stage}</span>
              </div>
            ))}
          </div>
        )}

        {isTyping && (!isProSearch || proSearchStages.length === 0) && (
          <div className="flex justify-start">
            <div className="bg-secondary/10 border border-secondary/20 text-text-primary p-3 rounded-xl text-sm">
              {isGeneratingImage
                ? <span className="animate-pulse">🎨 Generating image...</span>
                : <span className="animate-pulse">💭 Thinking...</span>
              }
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-secondary/10 shrink-0 flex flex-col gap-2.5 bg-bg-hover/30">

        {/* Attachment preview panel if a file is uploaded */}
        {attachedFile && (
          <div className="flex items-center justify-between p-2 bg-bg-default border border-primary/30 rounded-lg text-xs shrink-0 select-text">
            <div className="flex items-center gap-2 truncate">
              <span>{attachedFile.type === 'image' ? '🖼️' : '📎'}</span>
              <span className="font-semibold text-primary truncate">{attachedFile.name}</span>
            </div>
            <button 
              onClick={() => setAttachedFile(null)}
              className="text-text-secondary hover:text-danger cursor-pointer px-1 font-bold text-[10px]"
            >
              ✕ Remove
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-2 shadow-lg focus-within:border-primary/40 focus-within:shadow-[0_0_15px_rgba(0,245,255,0.08)] transition-all duration-300">
          <button
            onClick={() => setSpeakOutput(!speakOutput)}
            className={`p-2 rounded-lg transition-colors cursor-pointer text-sm shrink-0 flex items-center justify-center ${
              speakOutput
                ? 'text-success hover:text-success/80'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            title={speakOutput ? "Mute Speech Voice" : "Enable Speech Voice (Reads responses)"}
          >
            {speakOutput ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>

          {/* Microphone */}
          <button
            onClick={toggleListening}
            className={`p-2 rounded-lg transition-colors cursor-pointer text-sm shrink-0 flex items-center justify-center ${
              isListening
                ? 'text-danger animate-pulse'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            title={isListening ? "Listening... (Click to stop)" : "Speech Input (Click to speak)"}
          >
            {isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>

          {/* Real-time Voice Call Button */}
          <button
            onClick={handleToggleVoiceCall}
            className={`p-2 rounded-lg transition-colors cursor-pointer text-sm shrink-0 flex items-center justify-center ${
              isVoiceCallActive
                ? 'bg-danger/25 text-danger border border-danger/40 animate-pulse'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            title={isVoiceCallActive ? "End Voice Call" : "📞 Voice Call AI-Dost"}
          >
            <span>📞</span>
          </button>

          {/* Paperclip attachment button */}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".txt,.py,.js,.html,.css,.json,.pdf,.png,.jpg,.jpeg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer text-sm shrink-0 flex items-center justify-center"
            title="Attach a file/image"
          >
            📎
          </button>

          {/* Pro Search Toggle */}
          <button
            onClick={() => setIsProSearch(!isProSearch)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold border transition-all shrink-0 cursor-pointer ${
              isProSearch 
                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_8px_rgba(0,245,255,0.2)]' 
                : 'border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
            }`}
            title="Deep search internet indexes recursively"
          >
            PRO
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "Listening..." : "Ask Ai-Dost... or /image <prompt>"}
            className="flex-1 bg-transparent text-text-primary border-none focus:outline-none focus:ring-0 text-sm min-w-0 px-2"
          />
          <button
            onClick={handleSend}
            disabled={isTyping}
            className="p-2 bg-primary text-bg-default rounded-lg font-bold text-sm hover:bg-primary/80 transition disabled:opacity-40 cursor-pointer shrink-0 shadow-[0_0_10px_rgba(0,245,255,0.2)]"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICompanion;
