import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Search, Star, Archive, BookOpen, Music, FileText, Shuffle, X, Check, Moon, Sun, RotateCcw, Eye, Loader, RefreshCw, Upload, Download, Pencil, ExternalLink, ClipboardPaste } from 'lucide-react';

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  STORAGE_KEY: 'vn-kids-content',
  DEVICE_ID_KEY: 'vn-kids-device-id',
  VERSION: 1,
  API_BASE: '/api',
};

// ============================================================
// DEVICE ID - Anonymous user tracking
// ============================================================
function getDeviceId() {
  let id = localStorage.getItem(CONFIG.DEVICE_ID_KEY);
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem(CONFIG.DEVICE_ID_KEY, id);
  }
  return id;
}

// ============================================================
// STORAGE LAYER - localStorage for offline/fallback
// ============================================================
const Storage = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }
};

// ============================================================
// API LAYER - Neon database via Vercel serverless
// ============================================================
const API = {
  async fetchContent(deviceId) {
    const res = await fetch(`${CONFIG.API_BASE}/content?deviceId=${deviceId}`);
    if (!res.ok) throw new Error('Failed to fetch content');
    return res.json();
  },

  async updateProgress(deviceId, contentId, action, value) {
    const res = await fetch(`${CONFIG.API_BASE}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, contentId, action, value })
    });
    if (!res.ok) throw new Error('Failed to update progress');
    return res.json();
  },

  async addContent(title, type, content) {
    const res = await fetch(`${CONFIG.API_BASE}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, content })
    });
    if (!res.ok) throw new Error('Failed to add content');
    return res.json();
  },

  async updateContent(id, title, content) {
    const res = await fetch(`${CONFIG.API_BASE}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, content })
    });
    if (!res.ok) throw new Error('Failed to update content');
    return res.json();
  },

  async seedContent(items, deviceId) {
    const res = await fetch(`${CONFIG.API_BASE}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, deviceId })
    });
    if (!res.ok) throw new Error('Failed to seed content');
    return res.json();
  }
};

// ============================================================
// DATA LAYER
// ============================================================

// Deduplicate items by ID first, then by title+type for items without proper IDs
function deduplicateItems(items) {
  const seenIds = new Set();
  const seenTitleType = new Set();
  const result = [];

  for (const item of items) {
    // Skip if we've seen this ID (unless it's a temporary ID)
    const isTemporaryId = typeof item.id === 'number' && item.id > 1000000000000; // Date.now() style IDs

    if (!isTemporaryId && seenIds.has(item.id)) {
      continue;
    }

    // Check for title+type duplicates
    const titleTypeKey = `${item.title?.toLowerCase().trim()}|${item.type}`;
    if (seenTitleType.has(titleTypeKey)) {
      continue;
    }

    seenIds.add(item.id);
    seenTitleType.add(titleTypeKey);
    result.push(item);
  }

  return result;
}

async function loadData(deviceId) {
  try {
    // Try API first
    const items = await API.fetchContent(deviceId);
    if (items?.length) {
      // Transform API response to app format
      const transformed = items.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content,
        readCount: item.read_count || 0,
        favorite: item.favorite || false,
        archived: item.archived || false
      }));
      // Deduplicate to prevent showing duplicate entries
      const deduplicated = deduplicateItems(transformed);
      // Cache locally for offline
      Storage.set(CONFIG.STORAGE_KEY, { version: CONFIG.VERSION, items: deduplicated });
      return deduplicated;
    }
  } catch (e) {
    console.warn('API fetch failed, using local storage:', e);
  }

  // Fallback to localStorage
  const stored = Storage.get(CONFIG.STORAGE_KEY);
  if (stored?.version === CONFIG.VERSION && stored?.items?.length) {
    // Also deduplicate localStorage data
    return deduplicateItems(stored.items);
  }

  return [];
}

function saveDataLocal(items) {
  Storage.set(CONFIG.STORAGE_KEY, { version: CONFIG.VERSION, items });
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
  const [deviceId] = useState(() => getDeviceId());

  const isDark = theme === "dark";

  // Load data on mount
  useEffect(() => {
    loadData(deviceId).then(items => {
      setContent(items);
      setLoading(false);
    });
  }, [deviceId]);

  // Save locally on changes (debounced) - API syncs on actions
  useEffect(() => {
    if (!loading && content.length) {
      const t = setTimeout(() => saveDataLocal(content), 500);
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

  const markRead = (id) => {
    updateContent(c => c.map(i => i.id === id ? { ...i, readCount: i.readCount + 1 } : i));
    API.updateProgress(deviceId, id, 'markRead').catch(console.error);
  };

  const toggleFavorite = (id) => {
    updateContent(c => c.map(i => i.id === id ? { ...i, favorite: !i.favorite } : i));
    API.updateProgress(deviceId, id, 'toggleFavorite').catch(console.error);
  };

  const toggleArchive = (id) => {
    updateContent(c => c.map(i => i.id === id ? { ...i, archived: !i.archived } : i));
    API.updateProgress(deviceId, id, 'toggleArchive').catch(console.error);
  };

  const updateItem = (id, updates) => {
    updateContent(c => c.map(i => i.id === id ? { ...i, ...updates } : i));
    // Sync content changes to cloud
    if (updates.title !== undefined || updates.content !== undefined) {
      API.updateContent(id, updates.title, updates.content).catch(console.error);
    }
  };

  const addItem = async () => {
    if (!newItem.title.trim() || !newItem.content.trim()) return;

    // Check for duplicate before adding
    const titleLower = newItem.title.trim().toLowerCase();
    const exists = content.some(
      item => item.title.toLowerCase().trim() === titleLower && item.type === newItem.type
    );
    if (exists) {
      alert('Nội dung với tiêu đề và loại này đã tồn tại!');
      return;
    }

    try {
      const created = await API.addContent(newItem.title.trim(), newItem.type, newItem.content.trim());
      updateContent(c => [...c, {
        id: created.id,
        title: created.title,
        type: created.type,
        content: created.content,
        readCount: 0,
        archived: false,
        favorite: false
      }]);
    } catch (e) {
      console.error('Failed to add via API, adding locally:', e);
      updateContent(c => [...c, { ...newItem, id: Date.now(), readCount: 0, archived: false, favorite: false }]);
    }
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

      // Handle versioned export format
      if (data.version && data.items) {
        data = data.items;
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

      // Deduplicate imported items before processing
      const deduplicatedItems = deduplicateItems(items);

      // Try to sync to API
      try {
        await API.seedContent(deduplicatedItems, deviceId);
        // Reload from API to get proper IDs (loadData already deduplicates)
        const refreshed = await loadData(deviceId);
        setContent(refreshed);
      } catch (e) {
        console.warn('API seed failed, using local only:', e);
        // Merge with existing content instead of replacing to avoid data loss
        setContent(prev => {
          const combined = [...prev, ...deduplicatedItems];
          return deduplicateItems(combined);
        });
      }

      setShowImport(false);
    } catch (e) {
      console.error('Import error:', e);
      alert('Import failed: ' + e.message);
    }
  };

  const handleExport = useCallback(() => {
    try {
      // Create export data in versioned format (matches storage structure)
      const exportData = {
        version: CONFIG.VERSION,
        items: content
      };

      // Convert to pretty-printed JSON
      const jsonString = JSON.stringify(exportData, null, 2);

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `vn-kids-content-${timestamp}.json`;

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Xuất dữ liệu thất bại: ' + error.message);
    }
  }, [content]);

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
            <h1 className="text-lg font-semibold flex items-center gap-2">Kho nội dung bé yêu <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${isDark ? "bg-zinc-700 text-zinc-400" : "bg-zinc-200 text-zinc-500"}`}>v{__APP_VERSION__.split('.')[0]}</span></h1>
            <p className={`text-xs ${textSecondary}`}>{stats.total} mục • {stats.songs} hát • {stats.poems} thơ • {stats.stories} truyện</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} title="Import"><Upload size={16} /></button>
            <button onClick={handleExport} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} title="Export"><Download size={16} /></button>
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

      {viewItem && <ViewModal item={viewItem} onClose={() => setViewItem(null)} onMarkRead={markRead} onToggleFavorite={toggleFavorite} onUpdateItem={updateItem} setViewItem={setViewItem} isDark={isDark} />}
      {showAdd && <AddModal onAdd={addItem} onClose={() => setShowAdd(false)} newItem={newItem} setNewItem={setNewItem} isDark={isDark} />}
      {showImport && <ImportModal onImport={importSeed} onClose={() => setShowImport(false)} isDark={isDark} />}
    </div>
  );
}

// ============================================================
// MODAL COMPONENTS
// ============================================================
function ViewModal({ item, onClose, onMarkRead, onToggleFavorite, onUpdateItem, setViewItem, isDark }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content);

  const cfg = typeConfig[item.type] || typeConfig.poem;
  const bgCard = isDark ? "bg-zinc-900" : "bg-white";
  const textPrimary = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSecondary = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-zinc-800" : "border-zinc-200";

  const handleSave = () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    onUpdateItem(item.id, { title: editTitle.trim(), content: editContent.trim() });
    setViewItem({ ...item, title: editTitle.trim(), content: editContent.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditContent(item.content);
    setIsEditing(false);
  };

  const handlePaste = async () => {
    try {
      // Check clipboard permission (not supported in Safari, so wrap in try-catch)
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'clipboard-read' });
          if (permission.state === 'denied') {
            alert('Quyền đọc clipboard bị từ chối. Vui lòng cho phép trong cài đặt trình duyệt.');
            return;
          }
        } catch {
          // Safari doesn't support clipboard-read permission query, proceed to read directly
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        setEditContent(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('Không thể đọc clipboard. Vui lòng cho phép quyền truy cập clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={isEditing ? undefined : onClose} />
      <div className={`relative w-full max-w-lg max-h-[85vh] ${bgCard} rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col`}>
        <div className={`p-4 border-b ${border} flex items-center justify-between`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`px-2 py-1 rounded-full text-xs ${cfg.bg} ${cfg.color} shrink-0`}>{cfg.label}</span>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className={`flex-1 px-2 py-1 rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-100"} outline-none text-sm font-semibold ${textPrimary}`}
                placeholder="Tiêu đề..."
                autoFocus
              />
            ) : (
              <h2 className={`font-semibold text-sm ${textPrimary} truncate`}>{item.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>
                <Pencil size={16} className={textSecondary} />
              </button>
            )}
            <button onClick={isEditing ? handleCancel : onClose} className={`p-2 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>
              <X size={18} className={textPrimary} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isEditing ? (
            <div className="h-full flex flex-col">
              <div className="flex justify-end mb-2">
                <button
                  onClick={handlePaste}
                  className={`px-3 py-1.5 rounded-lg bg-blue-500 text-white flex items-center gap-1.5 text-sm hover:bg-blue-600 active:bg-blue-700`}
                  title="Dán từ clipboard"
                >
                  <ClipboardPaste size={14} /> Dán
                </button>
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className={`w-full flex-1 min-h-[200px] px-3 py-2 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"} outline-none resize-none text-base leading-relaxed ${textPrimary}`}
                placeholder="Nội dung..."
              />
            </div>
          ) : (
            <pre className={`whitespace-pre-wrap font-sans text-base leading-relaxed ${textPrimary}`}>{item.content}</pre>
          )}
        </div>
        <div className={`p-4 border-t ${border} flex gap-2`}>
          {isEditing ? (
            <>
              <button onClick={handleCancel} className={`flex-1 py-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-200"} font-medium flex items-center justify-center gap-2 ${textPrimary}`}>
                <X size={18} /> Hủy
              </button>
              <button onClick={handleSave} disabled={!editTitle.trim() || !editContent.trim()} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                <Check size={18} /> Lưu
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { onMarkRead(item.id); onClose(); }} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2"><Check size={18} /> Đã đọc/hát</button>
              <button onClick={() => onToggleFavorite(item.id)} className={`p-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}><Star size={20} className={item.favorite ? "text-yellow-500 fill-yellow-500" : textSecondary} /></button>
              <button onClick={() => { const firstLine = item.content.split('\n').find(l => l.trim())?.trim() || ''; const keyword = item.type === 'story' ? 'truyện' : 'lời'; window.open(`https://www.google.com/search?q=${encodeURIComponent(item.title + ' ' + firstLine + ' ' + keyword)}`, '_blank'); }} className={`p-3 rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} title="Tìm trên Google"><ExternalLink size={20} className="text-blue-500" /></button>
            </>
          )}
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
