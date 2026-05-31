import { useTimer } from '@/hooks/useTimer';
import { Play, Pause } from '@phosphor-icons/react';

interface TimerCellProps {
  taskId: string;
}

export default function TimerCell({ taskId }: TimerCellProps) {
  const timer = useTimer(taskId);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); timer.isRunning ? timer.pause() : timer.start(); }}
        className={`p-1.5 rounded-full transition ${
          timer.isRunning
            ? 'bg-warning/10 text-warning'
            : 'text-text-secondary hover:bg-surface-hover hover:text-primary'
        }`}
        title={timer.isRunning ? '暂停' : '开始计时'}
      >
        {timer.isRunning ? <Pause weight="bold" size={16} /> : <Play weight="bold" size={16} />}
      </button>
      {(timer.elapsed > 0 || timer.totalSeconds > 0) && (
        <span className={`text-small font-mono tabular-nums ${timer.isRunning ? 'text-warning' : 'text-text-secondary'}`}>
          {timer.elapsedDisplay}
        </span>
      )}
    </div>
  );
}
