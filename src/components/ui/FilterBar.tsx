import { useRef, useState, useEffect, useCallback } from 'react';
import { Tag as TagIcon, Target, Flag, CheckCircle, CaretDown, X, Check } from '@phosphor-icons/react';
import type { Tag, Goal, Priority } from '@/db/schema';
import { PRIORITY_LABEL, PRIORITY_COLOR } from '@/constants/priorities';

export type DateRange = 'today' | 'next-3-days' | 'next-7-days' | 'this-week' | 'this-month' | 'next-30-days' | 'all';

const DATE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今日' },
  { key: 'this-week', label: '本周' },
  { key: 'this-month', label: '本月' },
  { key: 'next-3-days', label: '近3天' },
  { key: 'next-7-days', label: '近7天' },
  { key: 'next-30-days', label: '近30天' },
];

const STATUS_OPTIONS: { id: string; name: string; color: string }[] = [
  { id: 'pending', name: '待办', color: '#94A3B8' },
  { id: 'in-progress', name: '进行中', color: '#3B82F6' },
  { id: 'completed', name: '已完成', color: '#10B981' },
  { id: 'skipped', name: '已跳过', color: '#F59E0B' },
];

const PRIORITY_OPTIONS: { id: Priority; name: string; color: string }[] = [
  { id: 'urgent-important', name: PRIORITY_LABEL['urgent-important'], color: PRIORITY_COLOR['urgent-important'] },
  { id: 'urgent-not-important', name: PRIORITY_LABEL['urgent-not-important'], color: PRIORITY_COLOR['urgent-not-important'] },
  { id: 'not-urgent-important', name: PRIORITY_LABEL['not-urgent-important'], color: PRIORITY_COLOR['not-urgent-important'] },
  { id: 'not-urgent-not-important', name: PRIORITY_LABEL['not-urgent-not-important'], color: PRIORITY_COLOR['not-urgent-not-important'] },
];

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;
  allTags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (ids: string[]) => void;
  allGoals: Goal[];
  selectedGoalIds: string[];
  onGoalsChange: (ids: string[]) => void;
  selectedPriorities: Priority[];
  onPrioritiesChange: (p: Priority[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (s: string[]) => void;
}

function PopoverFilter({
  icon: Icon,
  label,
  count,
  accentColor,
  open,
  setOpen,
  items,
  selectedIds,
  onToggle,
  onClear,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  accentColor: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  items: { id: string; name: string; color: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  const hasSelection = count > 0;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
          hasSelection
            ? 'bg-primary/10 text-primary font-medium shadow-sm'
            : 'bg-surface-hover text-text-secondary hover:text-text-primary'
        }`}
      >
        <Icon size={15} weight={hasSelection ? 'fill' : 'regular'} />
        <span>{label}</span>
        {hasSelection && (
          <span className="bg-primary text-white text-[11px] rounded-full w-5 h-5 inline-flex items-center justify-center font-semibold leading-none">
            {count}
          </span>
        )}
        <CaretDown size={12} weight="bold" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-30 bg-surface rounded-xl shadow-lg border border-border p-2 min-w-[180px] max-h-[280px] overflow-y-auto">
          {items.map((item) => {
            const sel = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-btn text-sm hover:bg-surface-hover transition-colors text-left"
              >
                <span
                  className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                    sel ? 'text-white' : 'border-2 border-border'
                  }`}
                  style={sel ? { backgroundColor: accentColor } : {}}
                >
                  {sel && <Check size={10} weight="bold" />}
                </span>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
          {selectedIds.length > 0 && (
            <button
              onClick={onClear}
              className="w-full text-center text-small text-text-secondary hover:text-primary pt-1.5 pb-0.5 mt-1 border-t border-border"
            >
              清空
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  dateRange, onDateRangeChange,
  allTags, selectedTagIds, onTagsChange,
  allGoals, selectedGoalIds, onGoalsChange,
  selectedPriorities, onPrioritiesChange,
  selectedStatuses, onStatusesChange,
}: Props) {
  const [tagOpen, setTagOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const toggleTag = useCallback((id: string) => {
    onTagsChange(
      selectedTagIds.includes(id)
        ? selectedTagIds.filter((tid) => tid !== id)
        : [...selectedTagIds, id],
    );
  }, [selectedTagIds, onTagsChange]);

  const toggleGoal = useCallback((id: string) => {
    onGoalsChange(
      selectedGoalIds.includes(id)
        ? selectedGoalIds.filter((gid) => gid !== id)
        : [...selectedGoalIds, id],
    );
  }, [selectedGoalIds, onGoalsChange]);

  const togglePriority = useCallback((id: string) => {
    onPrioritiesChange(
      selectedPriorities.includes(id as Priority)
        ? selectedPriorities.filter((p) => p !== id)
        : [...selectedPriorities, id as Priority],
    );
  }, [selectedPriorities, onPrioritiesChange]);

  const toggleStatus = useCallback((id: string) => {
    onStatusesChange(
      selectedStatuses.includes(id)
        ? selectedStatuses.filter((s) => s !== id)
        : [...selectedStatuses, id],
    );
  }, [selectedStatuses, onStatusesChange]);

  const tagItems = allTags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const goalItems = allGoals.filter((g) => g.status === 'active').map((g) => ({ id: g.id, name: g.name, color: g.color }));

  const hasAnyFilter = selectedTagIds.length > 0 || selectedGoalIds.length > 0 || selectedPriorities.length > 0 || selectedStatuses.length > 0;

  const clearAll = () => {
    onTagsChange([]);
    onGoalsChange([]);
    onPrioritiesChange([]);
    onStatusesChange([]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Date range pills — Notion-style sliding indicator */}
      <div className="flex items-center rounded-lg bg-surface-hover p-0.5 relative">
        {/* Sliding indicator */}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-md bg-surface shadow-sm transition-all duration-200 ease-out"
          style={{
            left: `${DATE_OPTIONS.findIndex(o => o.key === dateRange) * (100 / DATE_OPTIONS.length)}%`,
            width: `${100 / DATE_OPTIONS.length}%`,
          }}
        />
        {DATE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onDateRangeChange(key)}
            className={`relative z-10 flex-1 min-w-[44px] px-2 py-1.5 rounded-md text-small transition-colors duration-200 whitespace-nowrap flex items-center justify-center ${
              dateRange === key
                ? 'text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border flex-shrink-0" />

      {/* Tag */}
      <PopoverFilter
        icon={TagIcon} label="标签" count={selectedTagIds.length}
        accentColor="var(--color-primary)"
        open={tagOpen} setOpen={setTagOpen}
        items={tagItems} selectedIds={selectedTagIds}
        onToggle={toggleTag} onClear={() => onTagsChange([])}
      />

      {/* Goal */}
      <PopoverFilter
        icon={Target} label="目标" count={selectedGoalIds.length}
        accentColor="#6366F1"
        open={goalOpen} setOpen={setGoalOpen}
        items={goalItems} selectedIds={selectedGoalIds}
        onToggle={toggleGoal} onClear={() => onGoalsChange([])}
      />

      <div className="w-px h-6 bg-border flex-shrink-0" />

      {/* Priority */}
      <PopoverFilter
        icon={Flag} label="优先级" count={selectedPriorities.length}
        accentColor="#EF4444"
        open={priorityOpen} setOpen={setPriorityOpen}
        items={PRIORITY_OPTIONS} selectedIds={selectedPriorities}
        onToggle={togglePriority} onClear={() => onPrioritiesChange([])}
      />

      {/* Status */}
      <PopoverFilter
        icon={CheckCircle} label="状态" count={selectedStatuses.length}
        accentColor="#10B981"
        open={statusOpen} setOpen={setStatusOpen}
        items={STATUS_OPTIONS} selectedIds={selectedStatuses}
        onToggle={toggleStatus} onClear={() => onStatusesChange([])}
      />

      {/* Clear all */}
      {hasAnyFilter && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary px-2 py-1 transition-colors flex-shrink-0"
        >
          <X size={13} weight="bold" />
          清空
        </button>
      )}
    </div>
  );
}
