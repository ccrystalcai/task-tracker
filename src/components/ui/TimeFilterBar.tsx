interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly { key: T; label: string }[];
  showLabel?: boolean;
}

export default function TimeFilterBar<T extends string>({ value, onChange, options, showLabel }: Props<T>) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {showLabel && <span className="text-small text-text-secondary mr-1 flex-shrink-0">时间：</span>}
      {options.map(({ key, label: lbl }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-2.5 py-1 rounded-full text-small whitespace-nowrap flex-shrink-0 transition ${
            value === key ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover text-text-secondary hover:bg-border'
          }`}>
          {lbl}
        </button>
      ))}
    </div>
  );
}
