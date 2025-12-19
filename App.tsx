
import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  FileUp, 
  FileCode, 
  Download, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2,
  Sparkles,
  Github
} from 'lucide-react';
import JSZip from 'jszip';
import { AppStatus, SplitFile } from './types';
import { parseNotebook, splitNotebook } from './utils/notebookParser';

// Initialize AI
// 注意这里加了 VITE_ 前缀，这是 Vite 的规则
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || '' });

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SplitFile[]>([]);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [isAiNaming, setIsAiNaming] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ipynb')) {
      setError('Only .ipynb files are supported.');
      return;
    }

    setOriginalFileName(file.name.replace('.ipynb', ''));
    setStatus(AppStatus.PARSING);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const notebook = parseNotebook(content);
        const splitFiles = splitNotebook(notebook, 3);
        setFiles(splitFiles);
        setStatus(AppStatus.COMPLETED);
      } catch (err: any) {
        setError(err.message);
        setStatus(AppStatus.ERROR);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setStatus(AppStatus.ERROR);
    };
    reader.readAsText(file);
  };

  const handleDownloadSingle = (file: SplitFile) => {
    const blob = new Blob([file.content], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.aiSuggestedName ? `${file.aiSuggestedName}.py` : file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    files.forEach((file) => {
      const fileName = file.aiSuggestedName ? `${file.aiSuggestedName}.py` : file.name;
      zip.file(fileName, file.content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${originalFileName}_split.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateAiNames = async () => {
    if (files.length === 0) return;
    setIsAiNaming(true);

    try {
      const prompts = files.map(f => `Content of file ${f.name}:\n${f.content.substring(0, 1000)}`).join('\n---\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these Python code chunks and suggest a concise, descriptive snake_case filename for each. 
        Return a JSON array of strings corresponding to each chunk. 
        Do not include file extensions.
        
        Chunks:
        ${prompts}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const names = JSON.parse(response.text || '[]');
      setFiles(prev => prev.map((f, i) => ({
        ...f,
        aiSuggestedName: names[i] || f.name.replace('.py', '')
      })));
    } catch (err) {
      console.error('AI naming failed', err);
      // Fallback: stay with default names
    } finally {
      setIsAiNaming(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setStatus(AppStatus.IDLE);
    setError(null);
    setOriginalFileName('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Layers size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notebook Splitter <span className="text-indigo-600">Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-slate-500 hover:text-slate-800 transition-colors">
              <Github size={20} />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {status === AppStatus.IDLE && (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Decompose your Notebooks</h2>
              <p className="text-slate-600 text-lg">
                Automatically split your Jupyter Notebook files into clean, modular Python scripts. 
                Every 3 cells will be grouped into a single file for better organization.
              </p>
            </div>

            <label className="group relative block w-full border-2 border-dashed border-slate-300 rounded-2xl p-12 transition-all hover:border-indigo-500 hover:bg-white cursor-pointer overflow-hidden">
              <input type="file" className="hidden" accept=".ipynb" onChange={handleFileUpload} />
              <div className="flex flex-col items-center gap-4">
                <div className="bg-indigo-50 p-4 rounded-full text-indigo-600 group-hover:scale-110 transition-transform">
                  <FileUp size={48} />
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-slate-700">Click to upload or drag and drop</p>
                  <p className="text-slate-400 mt-1">Jupyter Notebook (.ipynb) files only</p>
                </div>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2">
                <div className="bg-green-100 w-fit p-2 rounded-lg text-green-700"><CheckCircle2 size={20} /></div>
                <h3 className="font-semibold text-slate-800">Clean Conversion</h3>
                <p className="text-sm text-slate-500">Markdown cells become docstrings, code cells stay pure Python.</p>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2">
                <div className="bg-blue-100 w-fit p-2 rounded-lg text-blue-700"><Layers size={20} /></div>
                <h3 className="font-semibold text-slate-800">Smart Chunking</h3>
                <p className="text-sm text-slate-500">Groups every 3 units to maintain context and logical flow.</p>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2">
                <div className="bg-purple-100 w-fit p-2 rounded-lg text-purple-700"><Sparkles size={20} /></div>
                <h3 className="font-semibold text-slate-800">AI Suggested Names</h3>
                <p className="text-sm text-slate-500">Optional AI analysis to name your files based on content.</p>
              </div>
            </div>
          </div>
        )}

        {status === AppStatus.PARSING && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={64} className="animate-spin text-indigo-600 mb-6" />
            <p className="text-xl font-medium text-slate-700">Analyzing Notebook Structure...</p>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex items-start gap-4 mb-8">
            <AlertCircle className="shrink-0" />
            <div>
              <h3 className="font-bold mb-1">Processing Error</h3>
              <p>{error}</p>
              <button onClick={reset} className="mt-4 text-sm font-semibold underline hover:no-underline">Try again</button>
            </div>
          </div>
        )}

        {status === AppStatus.COMPLETED && files.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1">Files Generated</h2>
                <p className="text-slate-500">Derived from <span className="font-semibold text-slate-700">{originalFileName}.ipynb</span></p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={generateAiNames}
                  disabled={isAiNaming}
                  className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-50"
                >
                  {isAiNaming ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  Suggest Names
                </button>
                <button 
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-lg text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                >
                  <Download size={18} />
                  Download All (.zip)
                </button>
                <button 
                  onClick={reset}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Clear results"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {files.map((file, idx) => (
                <div key={file.id} className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded text-blue-600">
                        <FileCode size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-400 block uppercase tracking-wider">Part {idx + 1}</span>
                        <span className="font-mono font-medium text-slate-800">
                          {file.aiSuggestedName ? `${file.aiSuggestedName}.py` : file.name}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDownloadSingle(file)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  <div className="p-4 bg-white">
                    <div className="max-h-32 overflow-hidden relative">
                      <pre className="text-xs text-slate-600 code-font whitespace-pre-wrap leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                        {file.content}
                      </pre>
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent"></div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded uppercase">
                        Cells: {file.cellIndices[0] + 1} - {file.cellIndices[file.cellIndices.length - 1] + 1}
                      </span>
                      <span className="text-[10px] text-slate-400">{file.content.length} characters</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">Built for high-performance Python development. 100% Client-side processing.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
