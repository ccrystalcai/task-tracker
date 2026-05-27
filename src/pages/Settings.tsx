import { useEffect, useState, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';
import { useTaskStore } from '@/stores/taskStore';
import { themes } from '@/styles/themes';
import { exportAllData, downloadJSON, importAllData } from '@/utils/export';
import {
  getClientId, setClientId, isConnected, disconnect,
  requestAccessToken, fetchCalendars, createCalendarEvent,
} from '@/utils/calendar';
import type { ThemeName } from '@/styles/themes';
import { Plus, Trash2, Edit3, Check, X, Download, Upload, Calendar, Link, Unlink, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const TAG_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

interface TagTreeItemProps {
  node: import('@/stores/tagStore').TagNode;
  depth: number;
  collapsedTags: Set<string>;
  editingTagId: string | null;
  editName: string;
  editColor: string;
  onToggleCollapse: (id: string) => void;
  onEdit: (tag: { id: string; name: string; color: string }) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onEditNameChange: (name: string) => void;
  onEditColorChange: (color: string) => void;
  onCreateChild: (parentId: string) => void;
}

function TagTreeItem({
  node, depth, collapsedTags, editingTagId, editName, editColor,
  onToggleCollapse, onEdit, onCancelEdit, onSaveEdit, onDelete,
  onEditNameChange, onEditColorChange, onCreateChild,
}: TagTreeItemProps) {
  const isEditing = editingTagId === node.id;
  const isCollapsed = collapsedTags.has(node.id);
  const hasChildren = node.children.length > 0;
  const canHaveChildren = depth < 3;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-btn hover:bg-surface-hover ${isEditing ? 'bg-surface-hover' : ''}`}
        style={{ marginLeft: `${(depth - 1) * 20}px` }}
      >
        {hasChildren ? (
          <button onClick={() => onToggleCollapse(node.id)} className="p-0.5 text-text-secondary">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        {isEditing ? (
          <>
            <input className="input flex-1 text-caption" value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveEdit(node.id)} autoFocus />
            <div className="flex gap-1">
              {TAG_COLORS.slice(0, 5).map((c) => (
                <button key={c} onClick={() => onEditColorChange(c)}
                  className={`w-5 h-5 rounded-full ${editColor === c ? 'ring-1 ring-offset-1 ring-primary' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <button className="p-1 text-success" onClick={() => onSaveEdit(node.id)}><Check size={16} /></button>
            <button className="p-1 text-text-secondary" onClick={onCancelEdit}><X size={16} /></button>
          </>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
            <span className="text-body flex-1">{node.name}</span>
            {canHaveChildren && (
              <button className="p-1 text-text-secondary hover:text-primary"
                onClick={() => onCreateChild(node.id)} title="添加子标签">
                <Plus size={14} />
              </button>
            )}
            <button className="p-1 text-text-secondary hover:text-primary"
              onClick={() => onEdit({ id: node.id, name: node.name, color: node.color })}>
              <Edit3 size={14} />
            </button>
            <button className="p-1 text-text-secondary hover:text-danger" onClick={() => onDelete(node.id)}>
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      {hasChildren && !isCollapsed && node.children.map((child) => (
        <TagTreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          collapsedTags={collapsedTags}
          editingTagId={editingTagId}
          editName={editName}
          editColor={editColor}
          onToggleCollapse={onToggleCollapse}
          onEdit={onEdit}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onDelete={onDelete}
          onEditNameChange={onEditNameChange}
          onEditColorChange={onEditColorChange}
          onCreateChild={onCreateChild}
        />
      ))}
    </div>
  );
}

export default function Settings() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const primaryColor = useUIStore((s) => s.primaryColor);
  const setPrimaryColor = useUIStore((s) => s.setPrimaryColor);
  const { tags, fetchTags, createTag, updateTag, deleteTag, getTagTree, getTagDepth } = useTagStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const { tasks, fetchTasks } = useTaskStore();

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagParentId, setNewTagParentId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

  // Google Calendar
  const [googleClientId, setGoogleClientId] = useState(getClientId());
  const [calendarConnected, setCalendarConnected] = useState(isConnected());
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState(localStorage.getItem('google_calendar_id') || 'primary');
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchTags(); fetchTasks(); }, []);

  useEffect(() => {
    if (calendarConnected) {
      fetchCalendars().then((list) => {
        setCalendars(list);
        if (list.length === 1 && !localStorage.getItem('google_calendar_id')) {
          setSelectedCalendar(list[0].id);
        }
      }).catch(() => {});
    }
  }, [calendarConnected]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const parentId = newTagParentId || null;
    // Only allow creating level-3 tags if they won't exceed depth 3
    if (parentId) {
      const parentDepth = getTagDepth(parentId);
      if (parentDepth >= 3) return; // Can't create child under level-3
    }
    await createTag(newTagName.trim(), newTagColor, parentId);
    setNewTagName('');
    setNewTagParentId(null);
  };

  const toggleCollapse = (tagId: string) => {
    setCollapsedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const handleSaveClientId = () => {
    setClientId(googleClientId.trim());
    setCalendarMsg({ type: 'success', text: 'Client ID 已保存，请点击「连接」授权' });
  };

  const handleConnect = async () => {
    if (!googleClientId.trim()) {
      setCalendarMsg({ type: 'error', text: '请先输入 Google Client ID' });
      return;
    }
    setClientId(googleClientId.trim());
    setCalendarLoading(true);
    setCalendarMsg(null);
    try {
      await requestAccessToken();
      setCalendarConnected(true);
      setCalendarMsg({ type: 'success', text: 'Google Calendar 已连接' });
      const list = await fetchCalendars();
      setCalendars(list);
      if (list.length === 1) setSelectedCalendar(list[0].id);
    } catch (e) {
      setCalendarMsg({ type: 'error', text: `连接失败: ${(e as Error).message}` });
    }
    setCalendarLoading(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setCalendarConnected(false);
    setCalendars([]);
    setCalendarMsg(null);
  };

  const handleSyncToCalendar = async () => {
    setCalendarLoading(true);
    setCalendarMsg(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayTasks = tasks.filter((t) => t.dueDate >= today && t.status !== 'completed');
      let count = 0;
      for (const task of todayTasks.slice(0, 20)) {
        try {
          await createCalendarEvent(selectedCalendar, {
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            estimatedMinutes: task.estimatedMinutes,
          });
          count++;
        } catch { /* skip individual failures */ }
      }
      localStorage.setItem('google_calendar_id', selectedCalendar);
      setCalendarMsg({ type: 'success', text: `已同步 ${count} 个任务到 Google Calendar` });
    } catch (e) {
      setCalendarMsg({ type: 'error', text: `同步失败: ${(e as Error).message}` });
    }
    setCalendarLoading(false);
  };

  const handleUpdateTag = async (id: string) => {
    if (!editName.trim()) return;
    await updateTag(id, { name: editName.trim(), color: editColor });
    setEditingTagId(null);
  };

  const handleExport = async () => {
    const data = await exportAllData();
    downloadJSON(data, `tasktracker-backup-${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importAllData(text);
    await fetchTags();
    alert('数据导入成功！请刷新页面查看。');
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-h3">设置</h3>
        <p className="text-caption text-text-secondary mt-1">个性化配置你的 TaskTracker</p>
      </div>

      {/* Theme */}
      <div className="card relative">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-h3">主题风格</h3>
          {/* Color picker - top right */}
          <div className="flex items-center gap-2 bg-surface-hover rounded-btn px-3 py-1.5">
            <span className="text-small text-text-secondary">主色</span>
            <input
              type="color"
              value={primaryColor || '#6366F1'}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-6 h-6 rounded-full cursor-pointer border-0 p-0"
              title="自定义主色调"
            />
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: primaryColor || '#6366F1' }}
            />
            {primaryColor && (
              <button
                className="text-small text-text-secondary hover:text-primary ml-1"
                onClick={() => setPrimaryColor(null)}
                title="重置默认"
              >
                ↺
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name as ThemeName)}
              className={`flex flex-col items-center gap-2 p-4 rounded-card border-2 transition-all duration-150 ${
                theme === t.name
                  ? 'border-primary bg-primary-light/10 shadow-card'
                  : 'border-border hover:border-primary-light hover:bg-surface-hover'
              }`}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-small text-text-primary">{t.label}</span>
              {theme === t.name && <span className="text-small text-primary font-medium">当前</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-h3 mb-3">标签管理</h3>
        <p className="text-caption text-text-secondary mb-4">支持三级标签，用于分类和筛选任务</p>

        {/* Add new tag */}
        <div className="flex items-center gap-2 mb-1">
          <input className="input flex-1" placeholder="新标签名" value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()} />
          <select className="input w-32 text-caption" value={newTagParentId || ''}
            onChange={(e) => setNewTagParentId(e.target.value || null)}>
            <option value="">一级标签</option>
            {tags.filter((t) => {
              const depth = getTagDepth(t.id);
              return depth <= 2;
            }).map((t) => (
              <option key={t.id} value={t.id}>
                {'—'.repeat(getTagDepth(t.id))} {t.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {TAG_COLORS.slice(0, 5).map((c) => (
              <button key={c} type="button" onClick={() => setNewTagColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${newTagColor === c ? 'scale-110 ring-1 ring-offset-1 ring-primary' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <button className="btn-primary" onClick={handleCreateTag}><Plus size={16} /></button>
        </div>
        <p className="text-small text-text-secondary mb-3">
          选择父标签可创建子标签（最多三级）
        </p>

        {/* Tag tree */}
        <div className="space-y-0.5">
          {tags.length === 0 && <p className="text-caption text-text-secondary">暂无自定义标签</p>}
          {getTagTree().map((node) => (
            <TagTreeItem
              key={node.id}
              node={node}
              depth={1}
              collapsedTags={collapsedTags}
              editingTagId={editingTagId}
              editName={editName}
              editColor={editColor}
              onToggleCollapse={toggleCollapse}
              onEdit={(tag) => { setEditingTagId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
              onCancelEdit={() => setEditingTagId(null)}
              onSaveEdit={handleUpdateTag}
              onDelete={deleteTag}
              onEditNameChange={setEditName}
              onEditColorChange={setEditColor}
              onCreateChild={(parentId) => { setNewTagParentId(parentId); }}
            />
          ))}
        </div>
      </div>

      {/* Reminder */}
      <div className="card">
        <h3 className="text-h3 mb-3">提醒设置</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body text-text-primary">每日小结提醒</p>
              <p className="text-caption text-text-secondary">每天到时间自动弹出完成一天小结窗口</p>
            </div>
            <input type="time" className="input" defaultValue="21:00"
              onChange={(e) => localStorage.setItem('tasktracker-daily-reminder', e.target.value)} />
          </div>
          <p className="text-small text-text-secondary">
            浏览器需要保持页面打开才能触发提醒；单任务提醒请在创建/编辑任务时单独设置
          </p>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="card">
        <h3 className="text-h3 mb-3 flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          Google Calendar 同步
        </h3>
        <p className="text-caption text-text-secondary mb-4">
          将任务同步到 Google Calendar，需要先创建 Google Cloud 项目并获取 OAuth Client ID
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-small font-medium mb-1 block">Google OAuth Client ID</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="输入你的 Google Client ID..."
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
              />
              <button className="btn-secondary" onClick={handleSaveClientId}>保存</button>
            </div>
            <p className="text-small text-text-secondary mt-1">
              在 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a> 创建 OAuth 2.0 Client ID，并添加 http://localhost:5173 到授权的 JavaScript 来源
            </p>
          </div>

          <div className="flex items-center gap-3">
            {calendarConnected ? (
              <button className="btn-secondary flex items-center gap-2" onClick={handleDisconnect}>
                <Unlink size={16} />断开连接
              </button>
            ) : (
              <button className="btn-primary flex items-center gap-2" onClick={handleConnect} disabled={calendarLoading}>
                <Link size={16} />{calendarLoading ? '连接中...' : '连接 Google Calendar'}
              </button>
            )}
            {calendarConnected && (
              <span className="text-small text-success flex items-center gap-1">
                <Check size={14} />已连接
              </span>
            )}
          </div>

          {calendarConnected && calendars.length > 0 && (
            <>
              <div>
                <label className="text-small font-medium mb-1 block">同步到日历</label>
                <select
                  className="input w-full"
                  value={selectedCalendar}
                  onChange={(e) => setSelectedCalendar(e.target.value)}
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleSyncToCalendar}
                disabled={calendarLoading}
              >
                <RefreshCw size={16} className={calendarLoading ? 'animate-spin' : ''} />
                同步未来任务到日历
              </button>
              <p className="text-small text-text-secondary">
                仅同步今天及未来的未完成任务（最多 20 个）
              </p>
            </>
          )}

          {calendarMsg && (
            <p className={`text-caption ${calendarMsg.type === 'success' ? 'text-success' : 'text-danger'}`}>
              {calendarMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Data */}
      <div className="card">
        <h3 className="text-h3 mb-3">数据管理</h3>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={handleExport}>
            <Download size={16} />导出数据 (JSON)
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => fileRef.current?.click()}>
            <Upload size={16} />导入数据
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
        <p className="text-small text-text-secondary mt-2">
          数据存储在浏览器本地，建议定期导出备份
        </p>
      </div>

      <div className="card">
        <h3 className="text-h3 mb-2">关于</h3>
        <p className="text-caption text-text-secondary">
          TaskTracker v0.1.0 — 让每一天都离目标更近一步
        </p>
      </div>
    </div>
  );
}
