import { UniversalTaskItem } from './types';

export interface UniversalFilterOptions {
  statusFilter: 'all' | 'completed' | 'processing' | 'error' | 'idle';
  categoryFilter: 'all' | 'image' | 'document' | 'vector';
  searchQuery: string;
  sortBy?: 'default' | 'name' | 'size' | 'status';
  sortOrder?: 'asc' | 'desc';
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
      const isDoc = item.sourceExt === 'pdf';
      const isVec = item.sourceExt === 'svg';
      const isImg = !isDoc && !isVec;

      if (options.categoryFilter === 'document' && !isDoc) return false;
      if (options.categoryFilter === 'vector' && !isVec) return false;
      if (options.categoryFilter === 'image' && !isImg) return false;
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

  return [...filtered].sort((a, b) => {
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
