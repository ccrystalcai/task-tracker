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
import { Plus, Trash, PencilSimple, Check, X, Download, Upload, Calendar, Link, ArrowsClockwise, CaretDown, CaretRight, Cloud, CloudSlash, HardDrive } from '@phosphor-icons/react';
import {
  getStoredClientId, setStoredClientId, getStoredToken,
  authorizeGoogleDrive, uploadToDrive, listBackups, disconnectDrive,
} from '@/utils/googleDrive';
import { getBackupSchedule, setBackupSchedule, markBackupDone, type BackupSchedule } from '@/utils/backupReminder';

const TAG_COLORS = ['#0D9488', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

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
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-btn hover:bg-surface-hover ${isEditing ? 'bg-surface-hover' : ''}`}
        style={{
          marginLeft: `${(depth - 1) * 24}px`,
          borderLeft: depth > 1 ? '1px solid var(--color-border)' : 'none',
          paddingLeft: depth > 1 ? '8px' : undefined,
        }}
      >
        {hasChildren ? (
          <button onClick={() => onToggleCollapse(node.id)} className="p-0.5 text-text-secondary">
            {isCollapsed ? <CaretRight size={14} /> : <CaretDown weight="bold" size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        {isEditing ? (
          <>
            <input autoComplete="off" className="input flex-1 text-small" value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveEdit(node.id)} autoFocus />
            {/* Color picker trigger */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                className="w-5 h-5 rounded-full ring-1 ring-offset-1 ring-primary cursor-pointer"
                style={{ backgroundColor: editColor }}
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="选择颜色"
              />
              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-10" role="presentation" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute top-full left-0 mt-2 z-20 bg-surface rounded-card p-3 shadow-card-lg border border-border w-48">
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {TAG_COLORS.map((c) => (
                        <button key={c}
                          onClick={() => { onEditColorChange(c); setShowColorPicker(false); }}
                          className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${editColor === c ? 'ring-1 ring-offset-1 ring-primary' : ''}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="h-px bg-border mb-2" />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => onEditColorChange(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 flex-shrink-0"
                      />
                      <input
                        className="input flex-1 text-caption px-2 py-1"
                        placeholder="#6366F1"
                        value={editColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.startsWith('#') || v === '') onEditColorChange(v);
                        }}
                        onBlur={(e) => {
                          if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                            onEditColorChange('#6366F1');
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <button className="p-1 text-success flex-shrink-0" onClick={() => onSaveEdit(node.id)}><Check weight="bold" size={16} /></button>
            <button className="p-1 text-text-secondary flex-shrink-0" onClick={onCancelEdit}><X weight="bold" size={16} /></button>
          </>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
            <span className="text-body flex-1">{node.name}</span>
            {canHaveChildren && (
              <button className="p-1 text-text-secondary hover:text-primary"
                onClick={() => onCreateChild(node.id)} title="添加子标签">
                <Plus weight="bold" size={14} />
              </button>
            )}
            <button className="p-1 text-text-secondary hover:text-primary"
              onClick={() => onEdit({ id: node.id, name: node.name, color: node.color })}>
              <PencilSimple weight="bold" size={14} />
            </button>
            <button className="p-1 text-text-secondary hover:text-danger" onClick={() => onDelete(node.id)}>
              <Trash weight="bold" size={14} />
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
    <div className="space-y-5">
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
              value={primaryColor || '#0D9488'}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-8 h-8 rounded-full cursor-pointer border-2 border-border p-0 flex-shrink-0 appearance-none
                [&::-webkit-color-swatch-wrapper]:p-0
                [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0
                [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
              title="自定义主色调"
            />
            {primaryColor && (
              <button
                className="text-small text-text-secondary hover:text-primary"
                onClick={() => setPrimaryColor(null)}
                title="重置默认"
              >
                ↺
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name as ThemeName)}
              className={`flex flex-col items-center gap-2 p-4 rounded-card border-2 transition duration-150 ${
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
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
          {/* Name + parent */}
          <div className="flex gap-2 flex-1">
            <input autoComplete="off" className="input flex-1" placeholder="新标签名" value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()} />
            <select className="input w-32 text-caption flex-shrink-0" value={newTagParentId || ''}
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
          </div>
          {/* Color + create button */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-2 border-border p-0 flex-shrink-0 appearance-none
                  [&::-webkit-color-swatch-wrapper]:p-0
                  [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0
                  [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
              />
            </div>
            {newTagColor !== TAG_COLORS[0] && (
              <button type="button" onClick={() => setNewTagColor(TAG_COLORS[0])}
                className="text-caption text-text-secondary hover:text-primary">
                重置
              </button>
            )}
            <button className="btn-primary flex-shrink-0" onClick={handleCreateTag}><Plus weight="bold" size={16} /></button>
          </div>
        </div>
        <p className="text-small text-text-secondary mb-3">
          选择父标签可创建子标签（最多三级）
        </p>

        {/* Tag tree */}
        <div className="space-y-1">
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
        <div className="flex items-center gap-3 bg-surface-hover rounded-btn px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-body">每日小结提醒</p>
            <p className="text-caption text-text-secondary">每天到时自动弹出小结窗口</p>
          </div>
          <input autoComplete="off" type="time" className="input w-28 flex-shrink-0" defaultValue="21:00"
            onChange={(e) => localStorage.setItem('tasktracker-daily-reminder', e.target.value)} />
        </div>
        <p className="text-caption text-text-secondary mt-2">
          需保持页面打开；单任务提醒请在创建/编辑任务时设置
        </p>
      </div>

      {/* Google API 配置 + Calendar + Drive (合并卡片) */}
      <div className="card">
        <h3 className="text-h3 mb-3">Google 服务</h3>
        <p className="text-caption text-text-secondary mb-4">
          同一个 Client ID 可用于 Drive 备份和 Calendar 同步。在 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a> 创建 OAuth 2.0 Client ID
        </p>
        <div className="flex gap-2 mb-5">
          <input autoComplete="off" className="input flex-1 text-small" placeholder="输入 Google Client ID"
            value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} />
          <button className="btn-secondary text-small" onClick={() => { setClientId(googleClientId.trim()); setStoredClientId(googleClientId.trim()); }}>保存</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border">
          {/* Calendar column */}
          <div>
            <h4 className="text-body font-medium mb-2 flex items-center gap-2">
              <Calendar weight="duotone" size={18} className="text-primary" />
              Google Calendar 同步
            </h4>
            <p className="text-caption text-text-secondary mb-3">
              将任务同步到你的 Google Calendar
            </p>
            <div className="flex items-center gap-3 mb-3">
              <span className={`flex items-center gap-1.5 text-small ${calendarConnected ? 'text-success' : 'text-text-secondary'}`}>
                {calendarConnected ? <><Check weight="bold" size={14} /> 已连接</> : <><Link weight="bold" size={14} /> 未连接</>}
              </span>
              {calendarConnected ? (
                <button className="btn-secondary text-small" onClick={handleDisconnect}>断开</button>
              ) : (
                <button className="btn-primary text-small" onClick={handleConnect} disabled={calendarLoading || !googleClientId.trim()}>
                  {calendarLoading ? '连接中…' : '连接 Google Calendar'}
                </button>
              )}
            </div>

            {calendarConnected && calendars.length > 0 && (
              <div className="space-y-3">
                <select className="input w-full text-small" value={selectedCalendar} onChange={(e) => setSelectedCalendar(e.target.value)}>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button className="btn-primary flex items-center gap-1.5 text-small" onClick={handleSyncToCalendar} disabled={calendarLoading}>
                    <ArrowsClockwise weight="bold" size={14} className={calendarLoading ? 'animate-spin' : ''} />同步未来任务
                  </button>
                </div>
              </div>
            )}

            {calendarMsg && (
              <p className={`text-caption mt-2 ${calendarMsg.type === 'success' ? 'text-success' : 'text-danger'}`}>
                {calendarMsg.text}
              </p>
            )}
          </div>

          {/* Drive column */}
          <DriveContent />
        </div>
      </div>

      {/* Data */}
      <div className="card">
        <h3 className="text-h3 mb-3">数据管理</h3>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={handleExport}>
            <Download weight="bold" size={16} />导出数据 (JSON)
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => fileRef.current?.click()}>
            <Upload weight="bold" size={16} />导入数据
          </button>
          <input autoComplete="off" ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
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

function DriveContent() {
  const [connected, setConnected] = useState(!!getStoredToken());
  const [schedule, setSchedule] = useState<BackupSchedule>(getBackupSchedule());
  const [backups, setBackups] = useState<Array<{ id: string; name: string; createdTime: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleConnect = async () => {
    try {
      setStatusMsg('');
      const cid = getStoredClientId();
      if (!cid) { setStatusMsg('请先在 Google API 配置中保存 Client ID'); return; }
      await authorizeGoogleDrive(cid);
      setConnected(true);
      setStatusMsg('已连接 Google Drive');
    } catch (e) {
      setStatusMsg(`连接失败: ${(e as Error).message}`);
    }
  };

  const handleDisconnect = () => {
    disconnectDrive();
    setConnected(false);
    setBackups([]);
    setStatusMsg('已断开连接');
  };

  const handleBackup = async () => {
    setUploading(true);
    setStatusMsg('');
    try {
      const token = getStoredToken();
      if (!token) throw new Error('未连接');
      const { exportAllData } = await import('@/utils/export');
      const data = await exportAllData();
      const fileName = `tasktracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      await uploadToDrive(fileName, data, token);
      setStatusMsg('备份成功！');
      markBackupDone();
    } catch (e) {
      setStatusMsg(`备份失败: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleListBackups = async () => {
    try {
      const token = getStoredToken();
      if (!token) throw new Error('未连接');
      const list = await listBackups(token);
      setBackups(list);
    } catch (e) {
      setStatusMsg(`查询失败: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h4 className="text-body font-medium mb-2 flex items-center gap-2">
        <Cloud weight="duotone" size={18} className="text-primary" />
        Google Drive 云备份
      </h4>
      <p className="text-caption text-text-secondary mb-3">
        将数据备份到你的 Google Drive
      </p>
      {connected ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-small text-success flex items-center gap-1 flex-shrink-0">
            <Check weight="bold" size={14} />已连接
          </span>
          <select
            className="input text-small w-20"
            value={schedule}
            onChange={(e) => {
              const v = e.target.value as BackupSchedule;
              setSchedule(v);
              setBackupSchedule(v);
            }}
          >
            <option value="manual">手动</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
          </select>
          <button className="btn-secondary flex items-center gap-1.5 text-small" onClick={handleBackup} disabled={uploading}>
            <HardDrive weight="bold" size={14} />{uploading ? '上传中...' : '备份'}
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-small" onClick={handleListBackups}>
            <ArrowsClockwise weight="bold" size={14} />查看
          </button>
          <button className="btn-secondary text-small" onClick={handleDisconnect}>断开</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-small text-text-secondary flex items-center gap-1.5">
            <CloudSlash weight="duotone" size={14} />未连接
          </span>
          <button className="btn-primary text-small" onClick={handleConnect} disabled={!getStoredClientId()}>连接 Google Drive</button>
        </div>
      )}
      {connected && backups.length > 0 && (
        <div className="bg-surface-hover rounded-btn p-2 max-h-[160px] overflow-y-auto space-y-0.5 mt-2">
          {backups.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-small px-2 py-1">
              <span className="truncate">{b.name}</span>
              <span className="text-text-secondary flex-shrink-0 ml-2">{b.createdTime?.substring(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
      {statusMsg && (
        <p className={`text-small mt-2 ${statusMsg.includes('失败') || statusMsg.includes('错') ? 'text-danger' : 'text-success'}`}>
          {statusMsg}
        </p>
      )}
    </div>
  );
}
