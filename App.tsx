import React, { useState, useCallback, useRef } from 'react';
import { MindMapNode, LogicDiagramData } from './types';
import { generateVisualizations } from './services/geminiService';
import MindMap from './components/MindMap';
import LogicDiagram from './components/LogicDiagram';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

const getDocumentContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reader.abort();
      reject(new Error(`Failed to read the file: ${file.name}`));
    };

    reader.onload = async (e) => {
      try {
        if (file.type === 'application/pdf') {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
            fullText += pageText + '\n\n';
          }
          resolve(fullText.trim());
        } else {
          // Handle text files
          resolve(e.target?.result as string);
        }
      } catch (error) {
        reject(new Error('Failed to parse the PDF file. It might be corrupted or protected.'));
      }
    };
    
    if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
};

type View = 'mindMap' | 'logicDiagram';

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [logicDiagramData, setLogicDiagramData] = useState<LogicDiagramData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeView, setActiveView] = useState<View>('mindMap');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('text/') || selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a valid text or PDF file.');
        setFile(null);
      }
    }
    event.target.value = '';
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = useCallback(async () => {
    if (!topic.trim() && !file) {
      setError('Please enter a topic or upload a document.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setMindMapData(null);
    setLogicDiagramData(null);
    setActiveView('mindMap');

    try {
      let documentContent: string | undefined;
      if (file) {
        documentContent = await getDocumentContent(file);
      }
      const { mindMapData, logicDiagramData } = await generateVisualizations(topic, documentContent);
      setMindMapData(mindMapData);
      setLogicDiagramData(logicDiagramData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [topic, file]);
  
  const ViewSwitcher = () => (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-gray-800/60 backdrop-blur-sm p-1 rounded-b-lg border-x border-b border-gray-700">
        <div className="flex items-center space-x-1">
            <button 
                onClick={() => setActiveView('mindMap')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${activeView === 'mindMap' ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
                Mind Map
            </button>
            {logicDiagramData && (
                 <button 
                    onClick={() => setActiveView('logicDiagram')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${activeView === 'logicDiagram' ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                    Logic Diagram
                </button>
            )}
        </div>
    </div>
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col font-sans">
      <header className="p-4 shadow-lg bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 w-full z-10">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-sky-400 text-center mb-4">AI Visualizer</h1>
          
          <div className="max-w-3xl mx-auto">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-2 space-y-2">
                  <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Enter a topic, paste a problem, or describe what to focus on in the document..."
                      className="w-full px-4 py-3 rounded-lg bg-gray-700 border-transparent focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition duration-200 resize-y text-base"
                      rows={4}
                      disabled={isLoading}
                  />
                  <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".txt,.md,text/plain,application/pdf"
                            disabled={isLoading}
                          />
                          <button
                            onClick={handleUploadClick}
                            disabled={isLoading}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap"
                          >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            Upload
                          </button>
                          <span className="text-sm text-gray-400 hidden sm:block">Supports .txt, .md, .pdf</span>
                      </div>

                      <button
                        onClick={handleGenerate}
                        disabled={isLoading || (!topic.trim() && !file)}
                        className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          'Generate'
                        )}
                      </button>
                  </div>
              </div>
               {file && (
                  <div className="text-center mt-3">
                    <div className="bg-gray-700/50 inline-flex items-center text-sm px-3 py-1 rounded-full">
                      <span className="mr-2">{file.name}</span>
                      <button onClick={() => setFile(null)} disabled={isLoading} className="text-gray-400 hover:text-white">&times;</button>
                    </div>
                  </div>
                )}
          </div>
        </div>
      </header>

      <main className="flex-grow relative">
         {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white p-4 rounded-lg shadow-xl z-20 max-w-md w-full text-center">
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}
        
        {(mindMapData || logicDiagramData) && <ViewSwitcher />}

        <div className="w-full h-full">
          {!mindMapData && !isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-2xl">Enter a topic or upload a document to create your mind map.</p>
                <p>Let AI expand your ideas visually.</p>
              </div>
            </div>
          ) : (
            <>
              {mindMapData && activeView === 'mindMap' && <MindMap data={mindMapData} />}
              {logicDiagramData && activeView === 'logicDiagram' && <LogicDiagram data={logicDiagramData} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;