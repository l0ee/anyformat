import { SUPPORTED_FORMATS, UniversalTaskItem } from './types';

export interface UniversalFilterOptions {
  statusFilter: 'all' | 'completed' | 'processing' | 'error' | 'idle';
  categoryFilter: 'all' | 'image' | 'document' | 'vector';
  searchQuery: string;
  sortBy?: 'default' | 'name' | 'size' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const DEFAULT_QUEUE_FILTERS: UniversalFilterOptions = {
  statusFilter: 'all',
  categoryFilter: 'all',
  searchQuery: '',
};

export function hasQueueFilters(options: UniversalFilterOptions): boolean {
  return Boolean(options.searchQuery || options.statusFilter !== 'all' || options.categoryFilter !== 'all' || (options.sortBy && options.sortBy !== 'default'));
}

export function filterUniversalTasks(
  items: UniversalTaskItem[],
  options: UniversalFilterOptions
): UniversalTaskItem[] {
  const query = options.searchQuery.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (options.statusFilter !== 'all' && item.status !== options.statusFilter) {
      return false;
    }

    if (options.categoryFilter !== 'all') {
      if (SUPPORTED_FORMATS[item.sourceExt]?.category !== options.categoryFilter) return false;
    }

    if (query && !item.name.toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });

  if (!options.sortBy || options.sortBy === 'default') {
    return filtered;
  }

  const orderMult = options.sortOrder === 'desc' ? -1 : 1;

  return filtered.sort((a, b) => {
    if (options.sortBy === 'name') {
      return orderMult * a.name.localeCompare(b.name);
    }
    if (options.sortBy === 'size') {
      return orderMult * ((a.file?.size ?? 0) - (b.file?.size ?? 0));
    }
    if (options.sortBy === 'status') {
      return orderMult * a.status.localeCompare(b.status);
    }
    return 0;
  });
}
