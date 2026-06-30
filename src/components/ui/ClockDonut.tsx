import type { Task } from '@/db/schema';

const COLORS = ['#0D9488', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#14B8A6'];

export default function ClockDonut({ tasks }: { tasks: Task[] }) {
  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => {
      const getMinutes = (t: Task) => {
        if (t.completedAt) {
          const d = new Date(t.completedAt);
          return d.getHours() * 60 + d.getMinutes();
        }
        if (t.dueTime) {
          const [h, m] = t.dueTime.split(':').map(Number);
          return h * 60 + m;
        }
        return 0;
      };
      return getMinutes(a) - getMinutes(b);
    });

  const MINUTE_SCALE = (24 * 60) / 360;

  if (completedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <svg viewBox="0 0 140 140" className="w-36 h-36">
          <circle cx="70" cy="70" r="62" fill="none" stroke="currentColor" strokeWidth="1" className="text-border" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15 - 90) * (Math.PI / 180);
            const isHour = i % 2 === 0;
            const inner = isHour ? 56 : 59;
            return (
              <line key={i} x1={70 + inner * Math.cos(angle)} y1={70 + inner * Math.sin(angle)}
                x2={70 + 62 * Math.cos(angle)} y2={70 + 62 * Math.sin(angle)}
                stroke="currentColor" strokeWidth={isHour ? 2 : 0.5} className="text-border" />
            );
          })}
          <circle cx="70" cy="70" r="44" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" opacity={0.3} />
          <text x="70" y="64" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '11px' }}>暂无</text>
          <text x="70" y="78" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '11px' }}>完成</text>
        </svg>
        <p className="text-small text-text-secondary">完成任务后显示时间分布</p>
      </div>
    );
  }

  const slices = completedTasks.map((t, i) => {
    let completionAngle = 0;
    if (t.completedAt) {
      const d = new Date(t.completedAt);
      const minutes = d.getHours() * 60 + d.getMinutes();
      completionAngle = (minutes / (24 * 60)) * 360 - 90;
    } else if (t.dueTime) {
      const [h, m] = t.dueTime.split(':').map(Number);
      completionAngle = ((h * 60 + m) / (24 * 60)) * 360 - 90;
    }

    const duration = t.actualMinutes || t.estimatedMinutes;
    const arcAngle = Math.max(duration / MINUTE_SCALE, 4);

    return {
      ...t,
      color: COLORS[i % COLORS.length],
      startAngle: completionAngle - arcAngle,
      endAngle: completionAngle,
      arcAngle,
      duration,
    };
  });

  return (
    <div className="flex flex-col items-center gap-2 w-full py-2">
      <svg viewBox="0 0 140 140" className="w-36 h-36">
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 - 90) * (Math.PI / 180);
          const isHour = i % 2 === 0;
          const inner = isHour ? 54 : 57;
          const labelR = 48;
          return (
            <g key={i}>
              <line x1={70 + inner * Math.cos(angle)} y1={70 + inner * Math.sin(angle)}
                x2={70 + 62 * Math.cos(angle)} y2={70 + 62 * Math.sin(angle)}
                stroke="currentColor" strokeWidth={isHour ? 1.5 : 0.5} className="text-border" />
              {isHour && (
                <text x={70 + labelR * Math.cos(angle)} y={70 + labelR * Math.sin(angle)}
                  textAnchor="middle" dominantBaseline="central"
                  className="fill-text-secondary" style={{ fontSize: '7px' }}>
                  {i}
                </text>
              )}
            </g>
          );
        })}

        {slices.map((s) => {
          const r = 36;
          const startRad = (s.startAngle * Math.PI) / 180;
          const endRad = (s.endAngle * Math.PI) / 180;
          const x1 = 70 + r * Math.cos(startRad);
          const y1 = 70 + r * Math.sin(startRad);
          const x2 = 70 + r * Math.cos(endRad);
          const y2 = 70 + r * Math.sin(endRad);
          const largeArc = s.arcAngle > 180 ? 1 : 0;

          return (
            <g key={s.id}>
              <path
                d={`M 70 70 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={s.color}
                opacity={0.75}
                stroke="white"
                strokeWidth="0.5"
              />
              <title>
                {s.title} · {s.duration}分钟
                {s.completedAt ? ` · 完成于 ${new Date(s.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </title>
            </g>
          );
        })}

        <circle cx="70" cy="70" r="18" fill="white" stroke="currentColor" strokeWidth="1" className="text-border" />
        <text x="70" y="66" textAnchor="middle" style={{ fontSize: '12px', fontWeight: 700, fill: '#6366F1' }}>
          {completedTasks.length}项
        </text>
        <text x="70" y="79" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '9px' }}>已完成</text>
      </svg>

      <div className="space-y-0.5 w-full max-h-[120px] overflow-y-auto">
        {slices.map((s) => {
          const timeLabel = s.completedAt
            ? new Date(s.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : s.dueTime || '—';
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[11px] text-text-secondary truncate flex-1">{s.title}</span>
              <span className="text-[11px] text-text-secondary font-mono">{timeLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
