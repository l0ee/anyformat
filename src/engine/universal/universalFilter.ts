import { UniversalTaskItem } from './types';

export interface UniversalFilterOptions {
  statusFilter: 'all' | 'completed' | 'processing' | 'error' | 'idle';
  categoryFilter: 'all' | 'image' | 'document' | 'vector';
  searchQuery: string;
}

export function filterUniversalTasks(
  items: UniversalTaskItem[],
  options: UniversalFilterOptions
): UniversalTaskItem[] {
  const query = options.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
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
}
