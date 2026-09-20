import { describe, expect, it } from 'vitest';
import { UniversalTaskItem } from './types';
import { filterUniversalTasks } from './universalFilter';

describe('filterUniversalTasks', () => {
  const sampleItems: UniversalTaskItem[] = [
    {
      id: '1',
      file: new File([], 'photo.png'),
      name: 'photo.png',
      sourceExt: 'png',
      targetExt: 'webp',
      status: 'completed',
      progress: 100,
    },
    {
      id: '2',
      file: new File([], 'doc.pdf'),
      name: 'doc.pdf',
      sourceExt: 'pdf',
      targetExt: 'png',
      status: 'error',
      progress: 0,
    },
    {
      id: '3',
      file: new File([], 'logo.svg'),
      name: 'logo.svg',
      sourceExt: 'svg',
      targetExt: 'png',
      status: 'idle',
      progress: 0,
    },
  ];

  it('filters by status correctly', () => {
    const res = filterUniversalTasks(sampleItems, {
      statusFilter: 'completed',
      categoryFilter: 'all',
      searchQuery: '',
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('1');
  });

  it('filters by category correctly', () => {
    const res = filterUniversalTasks(sampleItems, {
      statusFilter: 'all',
      categoryFilter: 'document',
      searchQuery: '',
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('2');
  });

  it('filters by search query correctly', () => {
    const res = filterUniversalTasks(sampleItems, {
      statusFilter: 'all',
      categoryFilter: 'all',
      searchQuery: 'logo',
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('3');
  });
});
