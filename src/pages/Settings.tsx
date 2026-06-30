import { useEffect, useState, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';
import { themes } from '@/styles/themes';
import { exportAllData, downloadJSON, importAllData } from '@/utils/export';
import type { ThemeName } from '@/styles/themes';
import { Plus, Trash, PencilSimple, Check, X, Download, Upload, CaretDown, CaretRight } from '@phosphor-icons/react';

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

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagParentId, setNewTagParentId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

  useEffect(() => { fetchTags(); }, []);

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
    <div className="space-y-3">
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
          数据安全存储在云端，支持导出备份
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
