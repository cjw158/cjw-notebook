import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Note, AIActionType, AIState } from './types';
import { performAIAction } from './services/geminiService';
import { 
  PlusIcon, 
  TrashIcon, 
  SearchIcon, 
  StarIcon, 
  WandIcon, 
  MenuIcon,
  ChevronLeftIcon,
  MoreVerticalIcon
} from './components/Icons';

// --- Constants & Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);
const STORAGE_KEY = 'mindspace_notes_v1';

const formatDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).format(new Date(timestamp));
};

// --- Main Component ---

export default function App() {
  // --- State ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // For mobile responsive
  const [aiState, setAiState] = useState<AIState>({ isLoading: false, error: null });
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'favorites'>('all');

  // --- Effects ---

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotes(parsed);
      } catch (e) {
        console.error("Failed to load notes", e);
      }
    } else {
      // Create initial welcome note
      const initialNote: Note = {
        id: generateId(),
        title: '欢迎使用 MindSpace',
        content: '这是一个全新的极简工作区。\n\n尝试点击上方的“魔术棒”图标来体验 AI 功能，例如自动生成摘要、修正语法或续写内容。\n\n享受写作的乐趣吧！',
        excerpt: '这是一个全新的极简工作区。',
        updatedAt: Date.now(),
        isFavorite: false,
      };
      setNotes([initialNote]);
      setSelectedNoteId(initialNote.id);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);

  // --- Computed ---

  const filteredNotes = useMemo(() => {
    let result = notes.sort((a, b) => b.updatedAt - a.updatedAt);
    
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
    return result;
  }, [notes, searchQuery, viewFilter]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  // --- Handlers ---

  const handleCreateNote = useCallback(() => {
    const newNote: Note = {
      id: generateId(),
      title: '新笔记',
      content: '',
      excerpt: '无额外内容',
      updatedAt: Date.now(),
      isFavorite: false,
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
    // On mobile, close sidebar after creating/selecting
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  const handleUpdateNote = (id: string, updates: Partial<Note>) => {
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
    }
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const note = notes.find(n => n.id === id);
    if (note) {
      handleUpdateNote(id, { isFavorite: !note.isFavorite });
    }
  };

  const handleAiAction = async (action: AIActionType) => {
    if (!selectedNote) return;
    setShowAiMenu(false);
    setAiState({ isLoading: true, error: null });

    try {
      let newContent = selectedNote.content;
      
      // If continuing writing, we append. Others replace or modify nicely.
      const result = await performAIAction(action, selectedNote.content);

      if (action === AIActionType.GENERATE_TITLE) {
        handleUpdateNote(selectedNote.id, { title: result });
      } else if (action === AIActionType.SUMMARIZE) {
        // Append summary at the top or bottom? Let's append at bottom for now.
        const summaryBlock = `\n\n--- 摘要 ---\n${result}`;
        handleUpdateNote(selectedNote.id, { content: selectedNote.content + summaryBlock });
      } else if (action === AIActionType.CONTINUE_WRITING) {
         handleUpdateNote(selectedNote.id, { content: selectedNote.content + ' ' + result });
      } else if (action === AIActionType.FIX_GRAMMAR) {
        handleUpdateNote(selectedNote.id, { content: result });
      }

    } catch (err: any) {
      setAiState({ isLoading: false, error: 'AI 请求失败，请检查 API Key。' });
      setTimeout(() => setAiState(prev => ({ ...prev, error: null })), 3000);
    } finally {
      setAiState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // --- Render ---

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      
      {/* Mobile Backdrop for Sidebar */}
      {!isSidebarOpen && (
        <div 
          className="md:hidden absolute top-4 left-4 z-20 p-2 bg-white rounded-md shadow-md cursor-pointer border border-gray-100"
          onClick={() => setIsSidebarOpen(true)}
        >
          <MenuIcon className="w-6 h-6 text-gray-600" />
        </div>
      )}

      {/* Sidebar */}
      <div 
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transform transition-transform duration-300 absolute md:relative z-10 w-80 h-full bg-gray-50 border-r border-gray-200 flex flex-col md:translate-x-0 shadow-xl md:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
           <div className="flex justify-between items-center mb-4">
             <h1 className="text-xl font-bold text-gray-800 tracking-tight">MindSpace 笔记</h1>
             {/* Close sidebar on mobile */}
             <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 rounded-md hover:bg-gray-200 text-gray-500"
             >
               <ChevronLeftIcon className="w-5 h-5" />
             </button>
           </div>
           
           {/* Search */}
           <div className="relative mb-3">
             <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
             <input
               type="text"
               placeholder="搜索笔记..."
               className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>

           {/* Filter Tabs */}
           <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
             <button 
              onClick={() => setViewFilter('all')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${viewFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               全部
             </button>
             <button 
               onClick={() => setViewFilter('favorites')}
               className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${viewFilter === 'favorites' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`group relative p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors ${
                    selectedNoteId === note.id ? 'bg-white border-l-4 border-l-blue-500 shadow-sm' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm font-semibold truncate pr-6 ${selectedNoteId === note.id ? 'text-gray-900' : 'text-gray-700'}`}>
                      {note.title || '无标题笔记'}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 h-8 mb-2">
                    {note.content || '暂无内容...'}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                     <span className="text-[10px] text-gray-400 font-medium">
                      {formatDate(note.updatedAt)}
                    </span>
                    <button
                      onClick={(e) => handleToggleFavorite(note.id, e)}
                      className={`p-1 rounded-full hover:bg-gray-200 transition-colors ${note.isFavorite ? 'text-yellow-400' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
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
      <div className="flex-1 flex flex-col h-full bg-white relative">
        {selectedNote ? (
          <>
            {/* Toolbar */}
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-8 bg-white shrink-0">
               <div className="flex items-center text-gray-400 text-xs">
                 <span className="hidden md:inline">最后编辑：{formatDate(selectedNote.updatedAt)}</span>
               </div>
               
               <div className="flex items-center space-x-2">
                 {/* AI Loading Indicator */}
                 {aiState.isLoading && (
                   <div className="flex items-center text-indigo-600 text-xs font-medium mr-4 animate-pulse">
                     <WandIcon className="w-3 h-3 mr-1" />
                     思考中...
                   </div>
                 )}
                 {aiState.error && (
                   <div className="text-red-500 text-xs font-medium mr-4">
                     {aiState.error}
                   </div>
                 )}

                 {/* AI Menu */}
                 <div className="relative">
                    <button 
                      onClick={() => setShowAiMenu(!showAiMenu)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                      disabled={aiState.isLoading}
                    >
                      <WandIcon className="w-3.5 h-3.5" />
                      AI 助手
                    </button>
                    
                    {showAiMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                        <div className="py-1">
                          <button 
                            onClick={() => handleAiAction(AIActionType.GENERATE_TITLE)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                          >
                            生成标题
                          </button>
                          <button 
                            onClick={() => handleAiAction(AIActionType.FIX_GRAMMAR)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                          >
                            修正语法
                          </button>
                          <button 
                            onClick={() => handleAiAction(AIActionType.SUMMARIZE)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                          >
                            生成摘要
                          </button>
                          <button 
                            onClick={() => handleAiAction(AIActionType.CONTINUE_WRITING)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                          >
                            智能续写
                          </button>
                        </div>
                      </div>
                    )}
                 </div>

                 {/* Favorite Button (Desktop) */}
                 <button
                   onClick={(e) => handleToggleFavorite(selectedNote.id, e)}
                   className={`p-2 rounded-md hover:bg-gray-100 transition-colors ${selectedNote.isFavorite ? 'text-yellow-400' : 'text-gray-400'}`}
                   title={selectedNote.isFavorite ? "取消收藏" : "收藏笔记"}
                 >
                   <StarIcon className="w-5 h-5" fill={selectedNote.isFavorite} />
                 </button>

                 {/* Delete Button */}
                 <button 
                   onClick={() => handleDeleteNote(selectedNote.id)}
                   className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                   title="删除笔记"
                 >
                   <TrashIcon className="w-5 h-5" />
                 </button>
               </div>
            </div>

            {/* Editor Input Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-12 py-8">
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleUpdateNote(selectedNote.id, { title: e.target.value })}
                placeholder="笔记标题"
                className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent mb-6"
              />
              <textarea
                value={selectedNote.content}
                onChange={(e) => handleUpdateNote(selectedNote.id, { content: e.target.value, excerpt: e.target.value.substring(0, 100) })}
                placeholder="开始输入..."
                className="w-full h-[calc(100%-80px)] resize-none text-lg leading-relaxed text-gray-700 placeholder-gray-300 border-none outline-none bg-transparent"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
             <div className="bg-gray-50 p-6 rounded-full mb-4">
               <PlusIcon className="w-12 h-12 text-gray-200" />
             </div>
             <p className="text-lg font-medium text-gray-400">选择一个笔记或创建一个新笔记</p>
          </div>
        )}

        {/* Floating Action Button for New Note (visible if note selected or on mobile) */}
        <button
          onClick={handleCreateNote}
          className="absolute bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-10"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      </div>
      
      {/* Click outside AI menu to close it */}
      {showAiMenu && (
        <div 
          className="absolute inset-0 z-40 bg-transparent" 
          onClick={() => setShowAiMenu(false)} 
        />
      )}
    </div>
  );
}