import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Search, Star, Archive, BookOpen, Music, FileText, Shuffle, X, Check, Moon, Sun, RotateCcw, Eye, Loader, RefreshCw, Upload } from 'lucide-react';

// ============================================================
// CONFIG - For Vite: change these settings
// ============================================================
const CONFIG = {
  STORAGE_KEY: 'vn-kids-content',
  VERSION: 1,
  // For Vite: set to '/data/seed.json' and fetch instead
  USE_EXTERNAL_SEED: false,
  SEED_URL: null,
};

// ============================================================
// SEED DATA
// For Claude Artifact: Use Import button to load JSON
// For Vite: Move to public/data/seed.json and fetch
// Format: [[id, title, type, content], ...]
// type: 0=song, 1=poem, 2=story
// ============================================================

// ============================================================
// STORAGE LAYER - Uses window.storage (Claude) or localStorage (Vite)
// ============================================================
const Storage = {
  async get(key) {
    try {
      if (window.storage) {
        const r = await window.storage.get(key);
        return r?.value ? JSON.parse(r.value) : null;
      }
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  async set(key, value) {
    try {
      const json = JSON.stringify(value);
      if (window.storage) await window.storage.set(key, json);
      else localStorage.setItem(key, json);
      return true;
    } catch { return false; }
  }
};

// ============================================================
// DATA LAYER
// ============================================================
const TYPES = ['song', 'poem', 'story'];
const expandItem = ([id, title, type, content]) => ({
  id, title, type: TYPES[type], content, readCount: 0, archived: false, favorite: false
});

async function loadData() {
  // Try loading user data from storage
  const stored = await Storage.get(CONFIG.STORAGE_KEY);
  if (stored?.version === CONFIG.VERSION && stored?.items?.length) {
    return stored.items;
  }
  
  // For Vite: fetch seed from JSON file
  if (CONFIG.USE_EXTERNAL_SEED && CONFIG.SEED_URL) {
    try {
      const res = await fetch(CONFIG.SEED_URL);
      const seed = await res.json();
      if (seed?.length) {
        const items = seed.map(expandItem);
        await Storage.set(CONFIG.STORAGE_KEY, { version: CONFIG.VERSION, items });
        return items;
      }
    } catch (e) { console.error('Failed to fetch seed:', e); }
  }
  
  // For Claude Artifact: return empty, user will import via UI
  return [];
}

async function saveData(items) {
  await Storage.set(CONFIG.STORAGE_KEY, { version: CONFIG.VERSION, items });
}

// ============================================================
// UI COMPONENTS
// ============================================================
const typeConfig = {
  song: { icon: Music, label: "Bài hát", color: "text-pink-500", bg: "bg-pink-100 dark:bg-pink-900/30" },
  poem: { icon: FileText, label: "Đồng dao", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
  story: { icon: BookOpen, label: "Truyện", color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" }
};

export default function App() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", content: "", type: "song" });
  const [theme, setTheme] = useState("light");

  const isDark = theme === "dark";

  // Load data on mount
  useEffect(() => {
    loadData().then(items => {
      setContent(items);
      setLoading(false);
    });
  }, []);

  // Save on changes (debounced)
  useEffect(() => {
    if (!loading && content.length) {
      const t = setTimeout(() => saveData(content), 500);
      return () => clearTimeout(t);
    }
  }, [content, loading]);

  const updateContent = useCallback((fn) => {
    setContent(c => { const n = fn(c); return n; });
  }, []);

  const filteredContent = useMemo(() => {
    let items = content.filter(item => item.archived === showArchived);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(s) || i.content.toLowerCase().includes(s));
    }
    if (filter !== "all") items = items.filter(i => i.type === filter);
    return items.sort((a, b) => {
      if (a.favorite !== b.favorite) return b.favorite ? 1 : -1;
      if (a.readCount !== b.readCount) return a.readCount - b.readCount;
      return a.title.localeCompare(b.title, 'vi');
    });
  }, [content, search, filter, showArchived]);

  const markRead = (id) => updateContent(c => c.map(i => i.id === id ? { ...i, readCount: i.readCount + 1 } : i));
  const toggleFavorite = (id) => updateContent(c => c.map(i => i.id === id ? { ...i, favorite: !i.favorite } : i));
  const toggleArchive = (id) => updateContent(c => c.map(i => i.id === id ? { ...i, archived: !i.archived } : i));
  
  const addItem = () => {
    if (!newItem.title.trim() || !newItem.content.trim()) return;
    updateContent(c => [...c, { ...newItem, id: Date.now(), readCount: 0, archived: false, favorite: false }]);
    setNewItem({ title: "", content: "", type: "song" });
    setShowAdd(false);
  };

  const importSeed = async (jsonText) => {
    try {
      let data;
      try {
        // Try standard JSON first
        data = JSON.parse(jsonText);
      } catch {
        // Handle JS object syntax (unquoted keys) using Function constructor
        // Safe here since user controls the input
        data = (new Function('return ' + jsonText))();
      }
      const items = data.map(item => ({
        id: item.id || Date.now() + Math.random(),
        title: item.title || "",
        type: item.type || "poem",
        content: item.content || "",
        readCount: item.readCount || 0,
        archived: item.archived || false,
        favorite: item.favorite || false,
      }));
      setContent(items);
      setShowImport(false);
    } catch (e) { 
      console.error('Import error:', e);
      alert('Import failed: ' + e.message); 
    }
  };

  const randomPick = () => {
    const available = filteredContent.filter(i => !i.archived);
    if (available.length) setViewItem(available[Math.floor(Math.random() * available.length)]);
  };

  const getPreview = (text) => {
    const lines = text.split('\n').filter(l => l.trim()).slice(0, 2).join(' • ');
    return lines.length > 70 ? lines.slice(0, 70) + '...' : lines;
  };

  const bgMain = isDark ? "bg-zinc-950" : "bg-zinc-50";
  const bgCard = isDark ? "bg-zinc-900" : "bg-white";
  const textPrimary = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-zinc-800" : "border-zinc-200";

  const stats = useMemo(() => ({
    total: content.filter(i => !i.archived).length,
    songs: content.filter(i => i.type === 'song' && !i.archived).length,
    poems: content.filter(i => i.type === 'poem' && !i.archived).length,
    stories: content.filter(i => i.type === 'story' && !i.archived).length,
    archived: content.filter(i => i.archived).length,
  }), [content]);

  if (loading) {
    return (
      <div className={`min-h-screen ${bgMain} flex items-center justify-center`}>
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // No data - show import prompt
  if (!content.length) {
    return (
      <div className={`min-h-screen ${bgMain} ${textPrimary} p-6 flex flex-col items-center justify-center`}>
        <h1 className="text-xl font-bold mb-4">Kho nội dung bé yêu</h1>
        <p className={`${textSecondary} mb-6 text-center`}>Chưa có dữ liệu. Nhập file JSON để bắt đầu.</p>
        <button onClick={() => setShowImport(true)} className="px-6 py-3 bg-blue-500 text-white rounded-xl flex items-center gap-2">
          <Upload size={18} /> Nhập dữ liệu
        </button>
        {showImport && <ImportModal onImport={importSeed} onClose={() => setShowImport(false)} isDark={isDark} />}
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgMain} ${textPrimary} pb-24 transition-colors`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 ${bgCard} border-b ${border} px-4 pt-4 pb-3`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold">Kho nội dung bé yêu</h1>
            <p className={`text-xs ${textSecondary}`}>{stats.total} mục • {stats.songs} hát • {stats.poems} thơ • {stats.stories} truyện</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} title="Import"><Upload size={16} /></button>
            <button onClick={() => setTheme(isDark ? "light" : "dark")} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"} mb-3`}>
          <Search size={18} className={textSecondary} />
          <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} className={`flex-1 bg-transparent outline-none text-sm ${textPrimary}`} />
          {search && <button onClick={() => setSearch("")}><X size={16} className={textSecondary} /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { v: "all", l: "Tất cả", c: stats.total },
            { v: "song", l: "🎵 Bài hát", c: stats.songs },
            { v: "poem", l: "📜 Đồng dao", c: stats.poems },
            { v: "story", l: "📖 Truyện", c: stats.stories }
          ].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${filter === f.v ? "bg-blue-500 text-white" : isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"}`}>{f.l} ({f.c})</button>
          ))}
          <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1 ${showArchived ? "bg-amber-500 text-white" : isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"}`}>
            <Archive size={14} /> Lưu trữ ({stats.archived})
          </button>
        </div>
      </div>

      {!showArchived && filteredContent.length > 0 && (
        <div className="px-4 pt-3">
          <button onClick={randomPick} className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 ${isDark ? "bg-zinc-800" : "bg-zinc-200"} text-sm font-medium`}>
            <Shuffle size={16} /> Chọn ngẫu nhiên
          </button>
        </div>
      )}

      <div className="px-4 pt-3 space-y-2">
        {filteredContent.length === 0 ? (
          <div className={`text-center py-12 ${textSecondary}`}>{showArchived ? "Không có nội dung lưu trữ" : "Không tìm thấy"}</div>
        ) : filteredContent.map(item => {
          const TypeIcon = typeConfig[item.type]?.icon || FileText;
          const cfg = typeConfig[item.type] || typeConfig.poem;
          return (
            <div key={item.id} className={`${bgCard} rounded-xl p-3 border ${border}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg}`}><TypeIcon size={18} className={cfg.color} /></div>
                <div className="flex-1 min-w-0" onClick={() => setViewItem(item)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{item.title}</h3>
                    {item.favorite && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                  </div>
                  <p className={`text-xs ${textSecondary} mt-0.5 line-clamp-1`}>{getPreview(item.content)}</p>
                  <div className={`flex items-center gap-2 mt-1 text-xs ${textSecondary}`}>
                    <span className={`px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="flex items-center gap-1"><Eye size={10} /> {item.readCount}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => markRead(item.id)} className={`p-2 rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Check size={14} className="text-green-500" /></button>
                  <button onClick={() => toggleFavorite(item.id)} className={`p-2 rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Star size={14} className={item.favorite ? "text-yellow-500 fill-yellow-500" : textSecondary} /></button>
                  <button onClick={() => toggleArchive(item.id)} className={`p-2 rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>{item.archived ? <RotateCcw size={14} className="text-amber-500" /> : <Archive size={14} className={textSecondary} />}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => setShowAdd(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white z-50"><Plus size={24} /></button>

      {viewItem && <ViewModal item={viewItem} onClose={() => setViewItem(null)} onMarkRead={markRead} onToggleFavorite={toggleFavorite} isDark={isDark} />}
      {showAdd && <AddModal onAdd={addItem} onClose={() => setShowAdd(false)} newItem={newItem} setNewItem={setNewItem} isDark={isDark} />}
      {showImport && <ImportModal onImport={importSeed} onClose={() => setShowImport(false)} isDark={isDark} />}
    </div>
  );
}

// ============================================================
// MODAL COMPONENTS
// ============================================================
function ViewModal({ item, onClose, onMarkRead, onToggleFavorite, isDark }) {
  const cfg = typeConfig[item.type] || typeConfig.poem;
  const bgCard = isDark ? "bg-zinc-900" : "bg-white";
  const textPrimary = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-zinc-800" : "border-zinc-200";
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-lg max-h-[85vh] ${bgCard} rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col`}>
        <div className={`p-4 border-b ${border} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            <h2 className={`font-semibold text-sm ${textPrimary}`}>{item.title}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><X size={18} className={textPrimary} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className={`whitespace-pre-wrap font-sans text-base leading-relaxed ${textPrimary}`}>{item.content}</pre>
        </div>
        <div className={`p-4 border-t ${border} flex gap-2`}>
          <button onClick={() => { onMarkRead(item.id); onClose(); }} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2"><Check size={18} /> Đã đọc/hát</button>
          <button onClick={() => onToggleFavorite(item.id)} className={`p-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Star size={20} className={item.favorite ? "text-yellow-500 fill-yellow-500" : textSecondary} /></button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ onAdd, onClose, newItem, setNewItem, isDark }) {
  const bgCard = isDark ? "bg-zinc-900" : "bg-white";
  const textPrimary = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-zinc-800" : "border-zinc-200";
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-lg max-h-[90vh] ${bgCard} rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col`}>
        <div className={`p-4 border-b ${border} flex items-center justify-between`}>
          <h2 className={`font-semibold ${textPrimary}`}>Thêm nội dung mới</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><X size={18} className={textPrimary} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className={`text-sm ${textSecondary} mb-1 block`}>Loại</label>
            <div className="flex gap-2">
              {Object.entries(typeConfig).map(([key, cfg]) => (
                <button key={key} onClick={() => setNewItem(n => ({ ...n, type: key }))} className={`flex-1 py-2 rounded-xl text-sm font-medium ${newItem.type === key ? "bg-blue-500 text-white" : isDark ? "bg-zinc-800" : "bg-zinc-100"} ${textPrimary}`}>{cfg.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={`text-sm ${textSecondary} mb-1 block`}>Tiêu đề</label>
            <input type="text" value={newItem.title} onChange={e => setNewItem(n => ({ ...n, title: e.target.value }))} placeholder="Nhập tiêu đề..." className={`w-full px-4 py-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"} outline-none ${textPrimary}`} />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} mb-1 block`}>Nội dung</label>
            <textarea value={newItem.content} onChange={e => setNewItem(n => ({ ...n, content: e.target.value }))} placeholder="Nhập nội dung..." rows={8} className={`w-full px-4 py-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"} outline-none resize-none ${textPrimary}`} />
          </div>
        </div>
        <div className={`p-4 border-t ${border}`}>
          <button onClick={onAdd} disabled={!newItem.title.trim() || !newItem.content.trim()} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50">Thêm</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose, isDark }) {
  const [text, setText] = useState("");
  const bgCard = isDark ? "bg-zinc-900" : "bg-white";
  const textPrimary = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-zinc-800" : "border-zinc-200";
  
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setText(ev.target?.result || "");
      reader.readAsText(file);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-lg max-h-[90vh] ${bgCard} rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col`}>
        <div className={`p-4 border-b ${border} flex items-center justify-between`}>
          <h2 className={`font-semibold ${textPrimary}`}>Nhập dữ liệu</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><X size={18} className={textPrimary} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className={`text-sm ${textSecondary}`}>
            Định dạng JSON từ version 2:<br/>
            <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded text-xs">[{`{id, title, type, content, ...}`}, ...]</code>
          </p>
          <input type="file" accept=".json" onChange={handleFile} className={`w-full text-sm ${textSecondary}`} />
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Hoặc dán JSON tại đây..." rows={10} className={`w-full px-4 py-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"} outline-none resize-none text-sm font-mono ${textPrimary}`} />
        </div>
        <div className={`p-4 border-t ${border}`}>
          <button onClick={() => onImport(text)} disabled={!text.trim()} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50">Nhập</button>
        </div>
      </div>
    </div>
  );
}
