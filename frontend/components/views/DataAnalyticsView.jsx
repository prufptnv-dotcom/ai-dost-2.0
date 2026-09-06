import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Send, Loader2, AlertCircle, BarChart3, Database, Sparkles } from 'lucide-react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function DataAnalyticsView({ onToast }) {
  const [file, setFile] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [query, setQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, analyzing]);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
      } else {
        onToast?.('Only CSV and JSON files are supported', 'error');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Allow dynamic API route based on environment (Vite/Next mapping)
      const res = await axios.post('/api/analytics/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setDatasetInfo(res.data);
        onToast?.(`Dataset uploaded successfully (${res.data.totalRows} rows)`, 'success');
        setHistory([{
          role: 'system',
          content: `Dataset **${res.data.filename}** loaded. Contains ${res.data.totalRows} rows. I'm ready to answer questions about it!`
        }]);
      }
    } catch (err) {
      console.error(err);
      onToast?.(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleQuery = async (e) => {
    e?.preventDefault();
    if (!query.trim() || !datasetInfo || analyzing) return;
    
    const userQuery = query.trim();
    setQuery('');
    setHistory(prev => [...prev, { role: 'user', content: userQuery }]);
    setAnalyzing(true);
    setResult(null);

    try {
      const res = await axios.post('/api/analytics/query', {
        query: userQuery,
        columns: datasetInfo.columns,
        preview: datasetInfo.preview,
        totalRows: datasetInfo.totalRows
      });
      
      if (res.data.success) {
        const aiResult = res.data.result;
        setResult(aiResult);
        setHistory(prev => [...prev, {
          role: 'assistant',
          content: aiResult.narrative,
          chartData: aiResult.chartData,
          chartType: aiResult.chartType
        }]);
      }
    } catch (err) {
      console.error(err);
      onToast?.(err.response?.data?.error || 'Analysis failed', 'error');
      setHistory(prev => [...prev, { role: 'system', content: 'Analysis failed. Please try again.' }]);
    } finally {
      setAnalyzing(false);
    }
  };

  const renderChart = (type, data) => {
    if (!data || data.length === 0 || type === 'none') return null;

    return (
      <div className="h-64 w-full mt-4 bg-canvas-elevated p-2 rounded-md border border-border">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
              <YAxis stroke="#888" tick={{fontSize: 10}} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : type === 'pie' ? (
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
            </PieChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
              <YAxis stroke="#888" tick={{fontSize: 10}} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#82ca9d" strokeWidth={2} dot={{r: 4}} activeDot={{ r: 6 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-canvas-base">
      <header className="h-14 flex items-center px-4 border-b border-border bg-canvas-surface shrink-0">
        <BarChart3 className="w-5 h-5 text-accent-primary mr-3" />
        <div>
          <h1 className="text-sm font-semibold text-paper-100 font-display">Data Analytics Agent</h1>
          <p className="text-[10px] text-ink-muted">AI-powered insights & charting for CSV/JSON</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT PANEL: UPLOAD & DATASET INFO */}
        <div className="w-full lg:w-72 border-r border-border bg-canvas-subtle p-4 flex flex-col shrink-0">
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-paper-100 uppercase tracking-wider mb-3 flex items-center">
              <Database className="w-3.5 h-3.5 mr-1.5" />
              Dataset
            </h3>
            
            {!datasetInfo ? (
              <div className="border-2 border-dashed border-border rounded-md p-6 flex flex-col items-center justify-center text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.json"
                  className="hidden"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-full bg-canvas-surface flex items-center justify-center mb-3 cursor-pointer hover:bg-canvas-elevated transition-colors border border-border"
                >
                  <Upload className="w-4 h-4 text-ink-muted" />
                </div>
                <p className="text-xs text-paper-100 mb-1">Click to browse</p>
                <p className="text-[10px] text-ink-muted mb-4">Supports CSV & JSON (Max 5MB)</p>
                
                {file && (
                  <div className="w-full mb-3 bg-canvas-surface p-2 rounded-xs border border-border text-left">
                    <p className="text-xs text-paper-100 truncate">{file.name}</p>
                    <p className="text-[10px] text-ink-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                )}
                
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="w-full py-1.5 px-3 bg-accent-primary hover:bg-accent-primary-strong disabled:opacity-50 text-white rounded-xs text-xs font-medium transition-colors flex items-center justify-center"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {uploading ? 'Processing...' : 'Upload & Analyze'}
                </button>
              </div>
            ) : (
              <div className="bg-canvas-surface border border-border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-canvas-elevated border-b border-border flex items-center">
                  <FileText className="w-3.5 h-3.5 text-accent-primary mr-2" />
                  <span className="text-xs font-medium text-paper-100 truncate">{datasetInfo.filename}</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-muted">Rows:</span>
                    <span className="text-paper-100">{datasetInfo.totalRows.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-muted">Columns:</span>
                    <span className="text-paper-100">{datasetInfo.columns.length}</span>
                  </div>
                  <div className="pt-2 border-t border-border-subtle mt-2">
                    <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Columns</span>
                    <div className="flex flex-wrap gap-1">
                      {datasetInfo.columns.slice(0, 10).map((col, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-canvas-base border border-border rounded-xs text-[10px] text-paper-100">
                          {col}
                        </span>
                      ))}
                      {datasetInfo.columns.length > 10 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-ink-muted">+{datasetInfo.columns.length - 10} more</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setDatasetInfo(null); setFile(null); setHistory([]); }}
                  className="w-full py-2 bg-canvas-base hover:bg-canvas-elevated text-[11px] text-ink-muted transition-colors border-t border-border"
                >
                  Load Different Dataset
                </button>
              </div>
            )}
          </div>

          <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-md p-3">
            <h4 className="text-xs font-medium text-accent-primary mb-1 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Example Questions
            </h4>
            <ul className="space-y-1.5 mt-2">
              <li className="text-[11px] text-paper-100 cursor-pointer hover:text-accent-primary transition-colors" onClick={() => setQuery('What is the distribution of values in this dataset?')}>
                &quot;What is the distribution of values?&quot;
              </li>
              <li className="text-[11px] text-paper-100 cursor-pointer hover:text-accent-primary transition-colors" onClick={() => setQuery('Show me the top 5 categories by count as a pie chart.')}>
                &quot;Show me top 5 categories (Pie Chart)&quot;
              </li>
              <li className="text-[11px] text-paper-100 cursor-pointer hover:text-accent-primary transition-colors" onClick={() => setQuery('Are there any outliers or trends in this data?')}>
                &quot;Are there any outliers or trends?&quot;
              </li>
            </ul>
          </div>
        </div>

        {/* RIGHT PANEL: CHAT & VISUALIZATION */}
        <div className="flex-1 flex flex-col bg-canvas-base relative">
          {!datasetInfo ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="max-w-md">
                <BarChart3 className="w-12 h-12 text-border mx-auto mb-4" />
                <h2 className="text-base font-semibold text-paper-100 mb-2">No Dataset Uploaded</h2>
                <p className="text-sm text-ink-muted">
                  Upload a CSV or JSON file on the left to start analyzing. The Data Analytics Agent will automatically read the schema and help you extract insights, generate charts, and answer questions.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {history.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-md p-3.5 ${msg.role === 'user' ? 'bg-accent-primary text-white' : 'bg-canvas-surface border border-border text-paper-100'}`}>
                      {msg.role === 'user' ? null : (
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-accent-primary uppercase tracking-wider font-semibold">
                          {msg.role === 'system' ? <AlertCircle className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
                          {msg.role === 'system' ? 'System' : 'Data Analyst'}
                        </div>
                      )}
                      
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>

                      {/* Render Chart if available */}
                      {msg.chartData && msg.chartType !== 'none' && renderChart(msg.chartType, msg.chartData)}
                    </div>
                  </motion.div>
                ))}
                
                {analyzing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-canvas-surface border border-border rounded-md p-3.5 flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-accent-primary" />
                      <span className="text-xs text-ink-muted">Analyzing dataset and generating insights...</span>
                    </div>
                  </motion.div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-canvas-base border-t border-border">
                <form 
                  onSubmit={handleQuery}
                  className="max-w-4xl mx-auto relative flex items-end gap-2 bg-canvas-surface border border-border rounded-md focus-within:border-accent-primary transition-colors p-1 pl-3"
                >
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleQuery(e);
                      }
                    }}
                    placeholder="Ask a question about your data (e.g., 'What is the average value by category?')"
                    className="flex-1 max-h-32 min-h-[44px] py-3 bg-transparent text-sm text-paper-100 placeholder:text-ink-muted resize-none focus:outline-none"
                    rows={1}
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || analyzing}
                    className="mb-1 p-2 bg-accent-primary hover:bg-accent-primary-strong disabled:opacity-40 text-white rounded-sm transition-fast cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-ink-muted">Press Enter to send, Shift+Enter for new line</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
