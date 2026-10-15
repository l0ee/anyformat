import { useId } from 'react';
import { DEFAULT_QUEUE_FILTERS, hasQueueFilters, UniversalFilterOptions } from '../../engine/universal/universalFilter';

interface QueueFiltersProps {
  value: UniversalFilterOptions;
  onChange: (value: UniversalFilterOptions) => void;
  visibleCount: number;
  totalCount: number;
}

const selectClass = 'min-h-11 min-w-0 rounded-xl border border-stone-300/80 bg-stone-50/90 px-2.5 py-2 text-xs font-semibold text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

export function QueueFilters({ value, onChange, visibleCount, totalCount }: QueueFiltersProps) {
  const searchId = useId();
  const active = hasQueueFilters(value);
  return (
    <div className="mb-3 rounded-2xl border border-stone-200/90 bg-stone-100/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={searchId} className="sr-only">Search queue</label>
        <input
          id={searchId}
          name="queue-search"
          type="search"
          autoComplete="off"
          placeholder="Search files…"
          value={value.searchQuery}
          onChange={(event) => onChange({ ...value, searchQuery: event.target.value })}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-300/80 bg-stone-50/90 px-3 py-2 text-xs text-stone-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {active && <button type="button" onClick={() => onChange(DEFAULT_QUEUE_FILTERS)} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-slate-700">Reset filters</button>}
        <span className="text-xs tabular-nums text-stone-600 dark:text-slate-400">{visibleCount} of {totalCount} files</span>
      </div>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer content-center text-xs font-semibold text-stone-700 dark:text-slate-200">Filter and sort</summary>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-stone-600 dark:text-slate-300">
            Status
            <select aria-label="Filter by status" value={value.statusFilter} onChange={(event) => onChange({ ...value, statusFilter: event.target.value as UniversalFilterOptions['statusFilter'] })} className={selectClass}>
              <option value="all">All status</option><option value="idle">Ready</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="error">Failed</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-600 dark:text-slate-300">
            Category
            <select aria-label="Filter by category" value={value.categoryFilter} onChange={(event) => onChange({ ...value, categoryFilter: event.target.value as UniversalFilterOptions['categoryFilter'] })} className={selectClass}>
              <option value="all">All categories</option><option value="image">Images</option><option value="vector">Vectors</option><option value="document">Documents</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-600 dark:text-slate-300">
            Sort
            <select aria-label="Sort queue" value={value.sortBy || 'default'} onChange={(event) => onChange({ ...value, sortBy: event.target.value as UniversalFilterOptions['sortBy'] })} className={selectClass}>
              <option value="default">Default order</option><option value="name">Name (A–Z)</option><option value="size">File size</option><option value="status">Status</option>
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}
