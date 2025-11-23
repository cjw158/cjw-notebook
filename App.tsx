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
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // For mobile responsive
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
    const savedTodos = localStorage.getItem(TODOS_KEY);

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

    if (savedTodos) {
      try {
        setTodos(JSON.parse(savedTodos));
      } catch (e) {
        console.error("Failed to load todos", e);
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
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  }, [todos]);

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

  const filteredTodos = useMemo(() => {
    let result = [...todos];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.text.toLowerCase().includes(q));
    }

    // Sort by updatedAt descending, but show incomplete todos first
    result.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return b.updatedAt - a.updatedAt;
    });

    return result;
  }, [todos, searchQuery]);


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
    setViewFilter('all');
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

  // --- Export Functions ---

  // --- Todo Handlers ---

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const now = Date.now();
    const newTodo: Todo = {
      id: generateId(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: now,
      updatedAt: now
    };
    setTodos(prev => [newTodo, ...prev]);
    setNewTodoText('');
  };

  const handleToggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t
    ));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const handleClearCompletedTodos = () => {
    if (window.confirm('确定要删除所有已完成的待办事项吗？')) {
      setTodos(prev => prev.filter(t => !t.completed));
    }
  };


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

                {/* Sort Menu (only for notes view) */}
                {viewFilter !== 'todos' && (
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
                {viewFilter !== 'todos' && (
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
               placeholder={viewFilter === 'todos' ? "搜索待办..." : "搜索笔记..."}
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
             <button 
               onClick={() => { setViewFilter('todos'); setSelectedNoteId(null); }}
               className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${viewFilter === 'todos' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
             >
               待办
             </button>
           </div>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto">
          {viewFilter === 'todos' ? (
            // Todos View
            <>
              {filteredTodos.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  {searchQuery ? '没有找到待办事项。' : '还没有待办事项。'}
                </div>
              ) : (
                <ul>
                  {filteredTodos.map((todo) => (
                    <li
                      key={todo.id}
                      className="group p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTodo(todo.id)}
                          className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            todo.completed 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
                          }`}
                        >
                          {todo.completed && <CheckIcon className="w-3 h-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm break-words ${
                            todo.completed 
                              ? 'text-gray-400 dark:text-gray-500 line-through' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {todo.text}
                          </p>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                            {formatDate(todo.updatedAt)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteTodo(todo.id)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {/* Clear completed button */}
              {todos.some(t => t.completed) && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={handleClearCompletedTodos}
                    className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    清除已完成
                  </button>
                </div>
              )}
            </>
          ) : (
            // Notes View
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-950 relative transition-colors duration-200">
        {viewFilter === 'todos' ? (
          // Todo Input Area
          <div className="flex-1 flex flex-col p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">待办事项</h2>
            
            {/* Add Todo Input */}
            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                  placeholder="添加新的待办事项..."
                  className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={handleAddTodo}
                  disabled={!newTodoText.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  添加
                </button>
              </div>
            </div>

            {/* Todo Stats */}
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
              <span>总计: {todos.length}</span>
              <span>待完成: {todos.filter(t => !t.completed).length}</span>
              <span>已完成: {todos.filter(t => t.completed).length}</span>
            </div>

            {/* Todo List (in main area for better mobile view) */}
            <div className="flex-1 overflow-y-auto">
              {filteredTodos.length === 0 && searchQuery === '' ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <CheckIcon className="w-16 h-16 mb-4" />
                  <p className="text-lg">开始添加你的第一个待办事项！</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : 
        {selectedNote ? (
          <>
            {/* Toolbar */}
            <div className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-gray-950 shrink-0">
               <div className="flex items-center text-gray-400 text-xs">
                 <span className="hidden md:inline">最后编辑：{formatDate(selectedNote.updatedAt)}</span>
               </div>
               
               <div className="flex items-center space-x-2">

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
        {/* Floating Action Button for New Note (only in note views) */}
        {viewFilter !== 'todos' && (
          <button
          onClick={handleCreateNote}
          className="absolute bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-10"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
        )}
      </div>


      {/* Click outside listeners */}
      {(showExportMenu || showGlobalMenu || showSortMenu) && (
        <div 
          className="absolute inset-0 z-40 bg-transparent" 
          onClick={() => {
            setShowExportMenu(false);
            setShowGlobalMenu(false);
            setShowSortMenu(false);
          }} 
        />
      )}
    </div>
  );
}