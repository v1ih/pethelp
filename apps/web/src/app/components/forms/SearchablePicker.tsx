import React, { useMemo, useState } from 'react';

export type SearchablePickerItem = {
  id: string;
  label: string;
  description?: string;
};

type SearchablePickerProps = {
  label: string;
  placeholder: string;
  items: SearchablePickerItem[];
  selectedId: string;
  onSelect: (item: SearchablePickerItem | null) => void;
  emptyText: string;
};

export default function SearchablePicker({ label, placeholder, items, selectedId, onSelect, emptyText }: SearchablePickerProps) {
  const [query, setQuery] = useState('');

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => {
      const haystack = `${item.label} ${item.description ?? ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, query]);

  return (
    <div className="space-y-2">
      <label className="block text-foreground">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setQuery((current) => current)}
        placeholder={placeholder}
        className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
      />
      <div className="max-h-56 overflow-auto rounded-[22px] border border-border/70 bg-card shadow-sm">
        {filteredItems.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item);
                  setQuery(item.label);
                }}
                className={`w-full border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
              >
                <p className="text-foreground">{item.label}</p>
                {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
              </button>
            );
          })
        )}
      </div>
      {selectedItem ? <p className="text-xs text-muted-foreground">Selecionado: {selectedItem.label}</p> : null}
    </div>
  );
}
