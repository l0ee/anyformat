import { describe, expect, it } from 'vitest';
import { UniversalTaskItem } from '../../engine/universal/types';
import { filterUniversalTasks } from '../../engine/universal/universalFilter';

describe('UniversalQueue Filter Integration', () => {
  const dummyItems: UniversalTaskItem[] = [
    {
      id: '1',
      file: new File([], 'alpha.png'),
      name: 'alpha.png',
      sourceExt: 'png',
      targetExt: 'webp',
      status: 'completed',
      progress: 100,
    },
    {
      id: '2',
      file: new File([], 'beta.pdf'),
      name: 'beta.pdf',
      sourceExt: 'pdf',
      targetExt: 'png',
      status: 'error',
      progress: 0,
    },
  ];

  it('filters queue items by search term correctly', () => {
    const filtered = filterUniversalTasks(dummyItems, {
      statusFilter: 'all',
      categoryFilter: 'all',
      searchQuery: 'alpha',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('alpha.png');
  });
});
