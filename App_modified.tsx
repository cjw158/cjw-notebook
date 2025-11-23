import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Note, Todo } from './types';

import { marked } from 'marked';
import JSZip from 'jszip';
import { 
  PlusIcon, 
  TrashIcon, 
  SearchIcon, 
  StarIcon, 
  MenuIcon,
  ChevronLeftIcon,
  EyeIcon,
  PenIcon,
  UndoIcon,
  RedoIcon,
  DownloadIcon,
  MoreVerticalIcon,
  SortIcon,
  SunIcon,
  MoonIcon,
  XIcon,
  CheckIcon
} from './components/Icons';

// --- Constants & Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);
const STORAGE_KEY = 'mindspace_notes_v1';
const THEME_KEY = 'mindspace_theme_v1';
const TODOS_KEY = 'mindspace_todos_v1';

// Type for html2pdf global variable
declare var html2pdf: any;

const formatDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).format(new Date(timestamp));
};

interface NoteSnapshot {
  title: string;
  content: string;
}

interface HistoryState {
  past: NoteSnapshot[];
  future: NoteSnapshot[];
}

type SortKey = 'updatedAt' | 'createdAt' | 'title';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

// --- Main Component ---

export default function App() {
  // --- State ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // For mobile responsive
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false); // For single note export
  const [showGlobalMenu, setShowGlobalMenu] = useState(false); // For "Export All"
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'favorites' | 'todos'>('all');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'updatedAt', direction: 'desc' });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [newTodoText, setNewTodoText] = useState('');
  
  // History State: map noteId -> { past[], future[] }
  const [history, setHistory] = useState<Record<string, HistoryState>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Effects ---

  // Load Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Load Notes & Prompts from local storage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY);
    const savedPrompts = localStorage.getItem(CUSTOM_PROMPTS_KEY);

    if (savedNotes) {
      try {
        const parsed: Note[] = JSON.parse(savedNotes);
        // Backfill createdAt if missing for existing notes
        const patched = parsed.map(n => ({
          ...n,
          createdAt: n.createdAt || n.updatedAt || Date.now()
        }));
        setNotes(patched);
      } catch (e) {
        console.error("Failed to load notes", e);
      }
    } else {
      // Create initial welcome note
      const initialNote: Note = {
        id: generateId(),
        title: '欢迎使用 MindSpace',
        content: '# 欢迎使用 MindSpace\n\n这是一个全新的极简工作区。\n\n## 功能介绍\n\n- **AI 增强**：尝试点击上方的“魔术棒”图标来体验功能，例如：\n  - 自动生成摘要\n  - 修正语法\n  - 续写内容\n  - **自定义指令**：点击设置图标，添加你自己的 AI 提示词！\n- **Markdown 支持**：点击右上角的眼睛图标即可预览 Markdown 格式。\n- **导出功能**：您可以将笔记导出为 TXT 或 PDF 文件，也支持批量导出。\n- **排序与整理**：支持按修改时间、创建时间或标题排序。\n- **深色模式**：点击侧边栏的月亮/太阳图标，随心切换主题。\n\n享受写作的乐趣吧！',
        excerpt: '这是一个全新的极简工作区。',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        isFavorite: false,
      };
      setNotes([initialNote]);
      setSelectedNoteId(initialNote.id);
    }

    if (savedPrompts) {
      try {
        setCustomPrompts(JSON.parse(savedPrompts));
      } catch (e) {
        console.error("Failed to load custom prompts", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(customPrompts));
  }, [customPrompts]);

  // Reset typing timer when switching notes
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [selectedNoteId]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedNoteId) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, history, notes]); // Deps ensure we have latest state access via closures or updated handlers

  // --- Computed ---

  const filteredNotes = useMemo(() => {
    let result = [...notes];
    
    // 1. Filter
    if (viewFilter === 'favorites') {
      result = result.filter(n => n.isFavorite);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    }

    // 2. Sort
    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA = a[key];
      let valB = b[key];

      // Handle strings (title)
      if (key === 'title') {
         valA = (valA as string).toLowerCase();
         valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [notes, searchQuery, viewFilter, sortConfig]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  const canUndo = selectedNoteId ? (history[selectedNoteId]?.past.length > 0) : false;
  const canRedo = selectedNoteId ? (history[selectedNoteId]?.future.length > 0) : false;

  // --- Handlers ---

  const handleCreateNote = useCallback(() => {
    const now = Date.now();
    const newNote: Note = {
      id: generateId(),
      title: '新笔记',
      content: '',
      excerpt: '无额外内容',
      updatedAt: now,
      createdAt: now,
      isFavorite: false,
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
    setIsPreviewMode(false); // Switch to edit mode for new note
    // On mobile, close sidebar after creating/selecting
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  // Core update function (does NOT handle history)
  const updateNoteState = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n))
    );
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm('确定要删除这条笔记吗？')) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (selectedNoteId === id) {
          setSelectedNoteId(null);
        }
        // Clean up history
        setHistory(prev => {
          const newHistory = { ...prev };
          delete newHistory[id];
          return newHistory;
        });
    }
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const note = notes.find(n => n.id === id);
    if (note) {
      updateNoteState(id, { isFavorite: !note.isFavorite });
    }
  };

  const handleSortChange = (key: SortKey, direction: SortDirection) => {
    setSortConfig({ key, direction });
    setShowSortMenu(false);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Helper to push current state to history before modification
  const saveToHistory = (note: Note) => {
    setHistory(prev => {
      const noteHistory = prev[note.id] || { past: [], future: [] };
      const snapshot: NoteSnapshot = { title: note.title, content: note.content };
      return {
        ...prev,
        [note.id]: {
          past: [...noteHistory.past, snapshot],
          future: [] // New change clears future (redo stack)
        }
      };
    });
  };

  // Handler for input changes (Title/Content) with Debounced History
  const handleTextChange = (key: 'title' | 'content', value: string) => {
    if (!selectedNote) return;

    // If this is the start of a new typing session, save snapshot
    if (!typingTimeoutRef.current) {
      saveToHistory(selectedNote);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to reset the typing session
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1000); // 1 second of inactivity resets the session

    // Update State
    updateNoteState(selectedNote.id, { 
      [key]: value,
      excerpt: key === 'content' ? value.substring(0, 100) : selectedNote.excerpt
    });
  };

  const handleUndo = () => {
    if (!selectedNote) return;
    const noteHistory = history[selectedNote.id];
    if (!noteHistory || noteHistory.past.length === 0) return;

    const previous = noteHistory.past[noteHistory.past.length - 1];
    const newPast = noteHistory.past.slice(0, -1);

    // Save current state to future
    const currentSnapshot: NoteSnapshot = { title: selectedNote.title, content: selectedNote.content };

    setHistory(prev => ({
      ...prev,
      [selectedNote.id]: {
        past: newPast,
        future: [currentSnapshot, ...noteHistory.future]
      }
    }));

    // Apply previous state
    updateNoteState(selectedNote.id, { title: previous.title, content: previous.content });
  };

  const handleRedo = () => {
    if (!selectedNote) return;
    const noteHistory = history[selectedNote.id];
    if (!noteHistory || noteHistory.future.length === 0) return;

    const next = noteHistory.future[0];
    const newFuture = noteHistory.future.slice(1);

    // Save current state to past
    const currentSnapshot: NoteSnapshot = { title: selectedNote.title, content: selectedNote.content };

    setHistory(prev => ({
      ...prev,
      [selectedNote.id]: {
        past: [...noteHistory.past, currentSnapshot],
        future: newFuture
      }
    }));

    // Apply next state
    updateNoteState(selectedNote.id, { title: next.title, content: next.content });
  };

  const handleAiAction = async (action: AIActionType, customPrompt?: CustomPrompt) => {
    if (!selectedNote) return;
    setShowAiMenu(false);
    setAiState({ isLoading: true, error: null });

    // Save state before AI modification
    saveToHistory(selectedNote);
    // Force reset typing timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      const result = await performAIAction(
        action, 
        selectedNote.content, 
        customPrompt?.template
      );

      if (action === AIActionType.GENERATE_TITLE) {
        updateNoteState(selectedNote.id, { title: result });
      } else if (action === AIActionType.SUMMARIZE) {
        const summaryBlock = `\n\n--- 摘要 ---\n${result}`;
        updateNoteState(selectedNote.id, { content: selectedNote.content + summaryBlock });
      } else if (action === AIActionType.CONTINUE_WRITING) {
        updateNoteState(selectedNote.id, { content: selectedNote.content + ' ' + result });
      } else if (action === AIActionType.FIX_GRAMMAR) {
        updateNoteState(selectedNote.id, { content: result });
      } else if (action === AIActionType.CUSTOM && customPrompt) {
        if (customPrompt.actionType === 'replace') {
           updateNoteState(selectedNote.id, { content: result });
        } else {
           updateNoteState(selectedNote.id, { content: selectedNote.content + '\n\n' + result });
        }
      }

    } catch (err: any) {
      setAiState({ isLoading: false, error: 'AI 请求失败，请检查 API Key。' });
      setTimeout(() => setAiState(prev => ({ ...prev, error: null })), 3000);
    } finally {
      setAiState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleAddCustomPrompt = () => {
    if (!newPromptName.trim() || !newPromptTemplate.trim()) return;
    const newPrompt: CustomPrompt = {
      id: generateId(),
      name: newPromptName,
      template: newPromptTemplate,
      actionType: newPromptAction
    };
    setCustomPrompts(prev => [...prev, newPrompt]);
    setNewPromptName('');
    setNewPromptTemplate('');
    setNewPromptAction('append');
  };

  const handleDeleteCustomPrompt = (id: string) => {
    setCustomPrompts(prev => prev.filter(p => p.id !== id));
  };

  // --- Export Functions ---

  const handleExportSingleTxt = () => {
    if (!selectedNote) return;
    const blob = new Blob([selectedNote.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNote.title || '未命名'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportSinglePdf = () => {
    if (!selectedNote) return;
    setShowExportMenu(false);
    
    // Create a temporary container for rendering
    const element = document.createElement('div');
    element.className = 'prose prose-slate max-w-none p-10 bg-white text-gray-900';
    element.style.width = '800px'; 
    element.innerHTML = `
      <h1 style="margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">${selectedNote.title || '未命名'}</h1>
      <div>${marked.parse(selectedNote.content)}</div>
    `;

    const opt = {
      margin: [10, 10],
      filename: `${selectedNote.title || '未命名'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleExportAllTxt = async () => {
    setShowGlobalMenu(false);
    if (notes.length === 0) return;

    const zip = new JSZip();
    notes.forEach(note => {
      const filename = (note.title || '未命名').replace(/[\\/:*?"<>|]/g, '_') + '.txt';
      zip.file(filename, note.content);
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MindSpace_Notes_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export ZIP failed", error);
      alert("导出失败");
    }
  };

  const handleExportAllPdf = () => {
    setShowGlobalMenu(false);
    if (notes.length === 0) return;

    const element = document.createElement('div');
    element.className = 'prose prose-slate max-w-none p-10 bg-white text-gray-900';
    element.style.width = '800px';

    notes.forEach((note, index) => {
       const noteDiv = document.createElement('div');
       noteDiv.style.pageBreakAfter = 'always';
       if (index === notes.length - 1) noteDiv.style.pageBreakAfter = 'avoid';
       
       noteDiv.innerHTML = `
         <h1 style="margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">${note.title || '未命名'}</h1>
         <div>${marked.parse(note.content)}</div>
       `;
       element.appendChild(noteDiv);
    });

    const opt = {
      margin: [10, 10],
      filename: `MindSpace_All_Notes_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // --- Render ---

  return (
    <div className="flex h-full w-full bg-white dark:bg-gray-950 overflow-hidden relative transition-colors duration-200">
      
      {/* Mobile Backdrop for Sidebar */}
      {!isSidebarOpen && (
        <div 
          className="md:hidden absolute top-4 left-4 z-20 p-2 bg-white dark:bg-gray-800 rounded-md shadow-md cursor-pointer border border-gray-100 dark:border-gray-700"
          onClick={() => setIsSidebarOpen(true)}
        >
          <MenuIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </div>
      )}

      {/* Sidebar */}
      <div 
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transform transition-transform duration-300 absolute md:relative z-10 w-80 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col md:translate-x-0 shadow-xl md:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
           <div className="flex justify-between items-center mb-4 relative">
             <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">MindSpace 笔记</h1>
             
             <div className="flex items-center">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 mr-1 transition-colors text-gray-500 dark:text-gray-400"
                  title={theme === 'light' ? '切换至深色模式' : '切换至浅色模式'}
                >
                  {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </button>

                {/* Sort Menu */}
                <div className="relative">
                   <button 
                     onClick={() => setShowSortMenu(!showSortMenu)}
                     className={`p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 mr-1 transition-colors ${showSortMenu ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}
                     title="排序"
                   >
                     <SortIcon className="w-5 h-5" />
                   </button>
                   
                   {showSortMenu && (
                     <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                        <div className="py-1">
                          <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">排序方式</div>
                          <button 
                            onClick={() => handleSortChange('updatedAt', 'desc')}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortConfig.key === 'updatedAt' && sortConfig.direction === 'desc' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            修改时间 (最新)
                          </button>
                          <button 
                            onClick={() => handleSortChange('createdAt', 'desc')}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortConfig.key === 'createdAt' && sortConfig.direction === 'desc' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            创建时间 (最新)
                          </button>
                          <button 
                            onClick={() => handleSortChange('title', 'asc')}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortConfig.key === 'title' && sortConfig.direction === 'asc' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            标题 (A-Z)
                          </button>
                        </div>
                     </div>
                   )}
                </div>

                {/* Global Menu for Export All */}
                <div className="relative">
                   <button 
                     onClick={() => setShowGlobalMenu(!showGlobalMenu)}
                     className={`p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 mr-2 transition-colors ${showGlobalMenu ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}
                   >
                     <MoreVerticalIcon className="w-5 h-5" />
                   </button>
                   
                   {showGlobalMenu && (
                     <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                        <div className="py-1">
                          <button 
                            onClick={handleExportAllTxt}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            导出所有笔记 (ZIP)
                          </button>
                          <button 
                            onClick={handleExportAllPdf}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            导出所有笔记 (PDF)
                          </button>
                        </div>
                     </div>
                   )}
                </div>

                {/* Close sidebar on mobile */}
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
             </div>
           </div>
           
           {/* Search */}
           <div className="relative mb-3">
             <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
             <input
               type="text"
               placeholder="搜索笔记..."
               className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 dark:placeholder-gray-500"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>

           {/* Filter Tabs */}
           <div className="flex space-x-1 bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
             <button 
              onClick={() => setViewFilter('all')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${viewFilter === 'all' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
             >
               全部
             </button>
             <button 
               onClick={() => setViewFilter('favorites')}
               className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${viewFilter === 'favorites' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
             >
               收藏
             </button>
           </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              没有找到笔记。
            </div>
          ) : (
            <ul>
              {filteredNotes.map((note) => (
                <li
                  key={note.id}
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    setIsPreviewMode(false); 
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`group relative p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors ${
                    selectedNoteId === note.id ? 'bg-white dark:bg-gray-800 border-l-4 border-l-blue-500 shadow-sm' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm font-semibold truncate pr-6 ${selectedNoteId === note.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {note.title || '无标题笔记'}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 h-8 mb-2">
                    {note.content || '暂无内容...'}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                     <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                      {formatDate(note.updatedAt)}
                    </span>
                    <button
                      onClick={(e) => handleToggleFavorite(note.id, e)}
                      className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${note.isFavorite ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100'}`}
                    >
                      <StarIcon className="w-4 h-4" fill={note.isFavorite} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-950 relative transition-colors duration-200">
        {selectedNote ? (
          <>
            {/* Toolbar */}
            <div className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-gray-950 shrink-0">
               <div className="flex items-center text-gray-400 text-xs">
                 <span className="hidden md:inline">最后编辑：{formatDate(selectedNote.updatedAt)}</span>
               </div>
               
               <div className="flex items-center space-x-2">
                 {/* AI Loading Indicator */}
                 {aiState.isLoading && (
                   <div className="flex items-center text-indigo-600 dark:text-indigo-400 text-xs font-medium mr-4 animate-pulse">
                     <WandIcon className="w-3 h-3 mr-1" />
                     思考中...
                   </div>
                 )}
                 {aiState.error && (
                   <div className="text-red-500 text-xs font-medium mr-4">
                     {aiState.error}
                   </div>
                 )}

                 {/* Undo / Redo */}
                 <div className="flex items-center border-r border-gray-200 dark:border-gray-800 pr-2 mr-1 space-x-1">
                   <button
                     onClick={handleUndo}
                     disabled={!canUndo}
                     className={`p-2 rounded-md transition-colors ${canUndo ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-gray-300 dark:text-gray-700 cursor-not-allowed'}`}
                     title="撤销 (Ctrl+Z)"
                   >
                     <UndoIcon className="w-4 h-4" />
                   </button>
                   <button
                     onClick={handleRedo}
                     disabled={!canRedo}
                     className={`p-2 rounded-md transition-colors ${canRedo ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-gray-300 dark:text-gray-700 cursor-not-allowed'}`}
                     title="重做 (Ctrl+Y)"
                   >
                     <RedoIcon className="w-4 h-4" />
                   </button>
                 </div>
                 
                 {/* Toggle Preview/Edit */}
                 <button
                   onClick={() => setIsPreviewMode(!isPreviewMode)}
                   className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isPreviewMode ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400'}`}
                   title={isPreviewMode ? "切换至编辑模式" : "预览 Markdown"}
                 >
                    {isPreviewMode ? <PenIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                 </button>

                 {/* Export Menu */}
                 <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${showExportMenu ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}
                      title="导出笔记"
                    >
                      <DownloadIcon className="w-5 h-5" />
                    </button>
                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                        <div className="py-1">
                          <button 
                            onClick={handleExportSingleTxt}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            导出为 TXT
                          </button>
                          <button 
                            onClick={handleExportSinglePdf}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            导出为 PDF
                          </button>
                        </div>
                      </div>
                    )}
                 </div>

                 {/* AI Menu */}
                 <div className="relative">
                    <button 
                      onClick={() => setShowAiMenu(!showAiMenu)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
                      disabled={aiState.isLoading}
                    >
                      <WandIcon className="w-3.5 h-3.5" />
                      AI 助手
                    </button>
                    
                    {showAiMenu && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                        <div className="py-1 max-h-96 overflow-y-auto">
                          <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">基础功能</div>
                          <button 
                            onClick={() => handleAiAction(AIActionType.GENERATE_TITLE)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            生成标题
                          </button>
                          <button 
                            onClick={() => handleAiAction(AIActionType.FIX_GRAMMAR)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            修正语法
                          </button>
                          <button 
                            onClick={() => handleAiAction(AIActionType.SUMMARIZE)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            生成摘要
                          </button>
                          <button 
                            onClick={() => handleAiAction(AIActionType.CONTINUE_WRITING)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            智能续写
                          </button>

                          <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                          
                          <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase flex justify-between items-center">
                            <span>自定义指令</span>
                            <button 
                                onClick={() => {
                                    setShowAiMenu(false);
                                    setIsSettingsOpen(true);
                                }}
                                className="text-indigo-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                                title="管理指令"
                            >
                                <SettingsIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {customPrompts.length > 0 ? (
                            customPrompts.map(prompt => (
                                <button 
                                    key={prompt.id}
                                    onClick={() => handleAiAction(AIActionType.CUSTOM, prompt)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                                >
                                    {prompt.name}
                                </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-xs text-gray-500 italic">暂无自定义指令</div>
                          )}
                        </div>
                      </div>
                    )}
                 </div>

                 {/* Favorite Button (Desktop) */}
                 <button
                   onClick={(e) => handleToggleFavorite(selectedNote.id, e)}
                   className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${selectedNote.isFavorite ? 'text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}
                   title={selectedNote.isFavorite ? "取消收藏" : "收藏笔记"}
                 >
                   <StarIcon className="w-5 h-5" fill={selectedNote.isFavorite} />
                 </button>

                 {/* Delete Button */}
                 <button 
                   onClick={() => handleDeleteNote(selectedNote.id)}
                   className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                   title="删除笔记"
                 >
                   <TrashIcon className="w-5 h-5" />
                 </button>
               </div>
            </div>

            {/* Editor / Preview Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-12 py-8">
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleTextChange('title', e.target.value)}
                placeholder="笔记标题"
                className="w-full text-3xl font-bold text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 border-none outline-none bg-transparent mb-6"
              />
              
              {isPreviewMode ? (
                <div 
                  className="w-full prose prose-slate dark:prose-invert prose-lg max-w-none text-gray-700 dark:text-gray-300 pb-20"
                  dangerouslySetInnerHTML={{ __html: marked.parse(selectedNote.content) as string }}
                />
              ) : (
                <textarea
                  value={selectedNote.content}
                  onChange={(e) => handleTextChange('content', e.target.value)}
                  placeholder="开始输入..."
                  className="w-full h-[calc(100%-80px)] resize-none text-lg leading-relaxed text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 border-none outline-none bg-transparent"
                  spellCheck={false}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
             <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-full mb-4">
               <PlusIcon className="w-12 h-12 text-gray-200 dark:text-gray-700" />
             </div>
             <p className="text-lg font-medium text-gray-400 dark:text-gray-500">选择一个笔记或创建一个新笔记</p>
          </div>
        )}

        {/* Floating Action Button for New Note */}
        <button
          onClick={handleCreateNote}
          className="absolute bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-10"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">自定义 AI 指令</h2>
                    <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Add New Form */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg mb-6 border border-gray-100 dark:border-gray-800">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">添加新指令</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">指令名称</label>
                                <input 
                                    type="text" 
                                    value={newPromptName}
                                    onChange={(e) => setNewPromptName(e.target.value)}
                                    placeholder="例如：翻译成日文"
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    指令模板 <span className="text-indigo-500">(使用 {"{{text}}"} 代表选中内容)</span>
                                </label>
                                <textarea 
                                    value={newPromptTemplate}
                                    onChange={(e) => setNewPromptTemplate(e.target.value)}
                                    placeholder="例如：请将以下内容翻译成日文：\n\n{{text}}"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">执行方式</label>
                                <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="actionType" 
                                            value="append" 
                                            checked={newPromptAction === 'append'}
                                            onChange={() => setNewPromptAction('append')}
                                            className="text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">追加到末尾</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="actionType" 
                                            value="replace" 
                                            checked={newPromptAction === 'replace'}
                                            onChange={() => setNewPromptAction('replace')}
                                            className="text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">替换原文</span>
                                    </label>
                                </div>
                            </div>
                            <button 
                                onClick={handleAddCustomPrompt}
                                disabled={!newPromptName.trim() || !newPromptTemplate.trim()}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                            >
                                添加指令
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">已保存指令</h3>
                        {customPrompts.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">暂无自定义指令</p>
                        ) : (
                            <ul className="space-y-2">
                                {customPrompts.map(prompt => (
                                    <li key={prompt.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg group">
                                        <div>
                                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{prompt.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {prompt.actionType === 'replace' ? '替换原文' : '追加内容'}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteCustomPrompt(prompt.id)}
                                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="删除"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* Click outside listeners */}
      {(showAiMenu || showExportMenu || showGlobalMenu || showSortMenu) && (
        <div 
          className="absolute inset-0 z-40 bg-transparent" 
          onClick={() => {
            setShowAiMenu(false);
            setShowExportMenu(false);
            setShowGlobalMenu(false);
            setShowSortMenu(false);
          }} 
        />
      )}
    </div>
  );
}