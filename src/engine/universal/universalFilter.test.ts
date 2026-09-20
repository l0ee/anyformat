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

  it('sorts queue items by name and size correctly', () => {
    const sortItems: UniversalTaskItem[] = [
      {
        id: '1',
        file: { name: 'zebra.png', size: 3000 } as File,
        name: 'zebra.png',
        sourceExt: 'png',
        targetExt: 'webp',
        status: 'completed',
        progress: 100,
      },
      {
        id: '2',
        file: { name: 'apple.png', size: 1000 } as File,
        name: 'apple.png',
        sourceExt: 'png',
        targetExt: 'webp',
        status: 'idle',
        progress: 0,
      },
      {
        id: '3',
        file: { name: 'monkey.png', size: 2000 } as File,
        name: 'monkey.png',
        sourceExt: 'png',
        targetExt: 'webp',
        status: 'error',
        progress: 0,
      },
    ];

    const byName = filterUniversalTasks(sortItems, {
      statusFilter: 'all',
      categoryFilter: 'all',
      searchQuery: '',
      sortBy: 'name',
    });
    expect(byName.map((i) => i.name)).toEqual(['apple.png', 'monkey.png', 'zebra.png']);

    const bySizeDesc = filterUniversalTasks(sortItems, {
      statusFilter: 'all',
      categoryFilter: 'all',
      searchQuery: '',
      sortBy: 'size',
      sortOrder: 'desc',
    });
    expect(bySizeDesc.map((i) => i.name)).toEqual(['zebra.png', 'monkey.png', 'apple.png']);
  });
});
