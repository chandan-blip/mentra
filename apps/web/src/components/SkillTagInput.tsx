import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSkillSearch } from '../lib/profile.js';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
};

export function SkillTagInput({ value, onChange, max = 30 }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const labelCache = useRef(new Map<string, string>());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [] } = useSkillSearch(debounced);
  for (const entry of results) labelCache.current.set(entry.id, entry.label);

  const suggestions = useMemo(
    () => results.filter((entry) => !value.includes(entry.id)).slice(0, 8),
    [results, value],
  );

  function add(id: string) {
    if (value.includes(id) || value.length >= max) return;
    onChange([...value, id]);
    setQuery('');
    setOpen(false);
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 rounded-md bg-surface-sunken p-2 ring-1 ring-border-subtle focus-within:ring-border-strong">
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-sm bg-surface-raised px-2 py-1 text-xs text-ink ring-1 ring-border-subtle"
          >
            {labelCache.current.get(id) ?? id}
            <button type="button" onClick={() => remove(id)} aria-label={`Remove ${id}`}>
              <X className="size-3 text-ink-faint hover:text-ink" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length === 0 ? 'Search skills…' : 'Add more…'}
          className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      {open && suggestions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md bg-surface p-1 shadow-card ring-1 ring-border">
          {suggestions.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(entry.id)}
                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
              >
                {entry.label}
                <span className="text-xs text-ink-faint">{entry.category}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-1 text-xs text-ink-faint">
        {value.length}/{max} selected
      </div>
    </div>
  );
}
