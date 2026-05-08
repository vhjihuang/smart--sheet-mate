import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SourceColumn, TargetColumn, MappingNode } from '@/types';

vi.mock('@/utils/bridge', () => ({
  safeCallParse: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/utils/goBridge', () => ({
  openFolder: vi.fn(),
}));

import { showToast } from '@/utils/toast';
import { getLeafColumns } from '@/utils/excel';
import { generateId } from '@/utils/excel';

vi.mocked(showToast);

function runAutoMapLogic(
  sourceColumns: SourceColumn[],
  targetColumns: TargetColumn[],
  existingMappings: Record<string, MappingNode[]>,
): { nextMappings: Record<string, MappingNode[]>; matchCount: number } {
  const nextMappings = { ...existingMappings };
  let matchCount = 0;
  const leafColumns = getLeafColumns(targetColumns);
  const usedSourceIds = new Set<string>();

  for (const nodes of Object.values(existingMappings)) {
    for (const node of nodes) {
      usedSourceIds.add(node.sourceId);
    }
  }

  leafColumns.forEach((target) => {
    if ((nextMappings[target.id] || []).length > 0) {
      return;
    }

    const targetName = target.label.trim().toLowerCase();
    const match = sourceColumns.find((source) => {
      if (usedSourceIds.has(source.id)) return false;
      const sourceName = source.label.trim().toLowerCase();
      if (sourceName === targetName) return true;
      const shorter = sourceName.length < targetName.length ? sourceName : targetName;
      if (shorter.length < 2) return false;
      return sourceName.includes(targetName) || targetName.includes(sourceName);
    });

    if (match) {
      nextMappings[target.id] = [
        {
          id: generateId(),
          sourceId: match.id,
          sourceLabel: match.label,
          steps: [],
          forceText: false,
        },
      ];
      usedSourceIds.add(match.id);
      matchCount += 1;
    }
  });

  return { nextMappings, matchCount };
}

describe('autoMap 逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('每个源字段最多映射到一个目标列', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
      { id: 'src-1', label: '年龄' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '姓名' },
      { id: 'col-1', label: '姓名' },
    ];

    const { nextMappings, matchCount } = runAutoMapLogic(sourceColumns, targetColumns, {});

    expect(matchCount).toBe(1);
    const mappedSourceIds: string[] = [];
    for (const nodes of Object.values(nextMappings)) {
      for (const node of nodes) {
        mappedSourceIds.push(node.sourceId);
      }
    }
    const uniqueSourceIds = new Set(mappedSourceIds);
    expect(uniqueSourceIds.size).toBe(mappedSourceIds.length);
  });

  it('已手动映射的字段不应被自动匹配覆盖', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
      { id: 'src-1', label: '年龄' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '姓名' },
      { id: 'col-1', label: '年龄' },
    ];
    const existingMappings: Record<string, MappingNode[]> = {
      'col-0': [{ id: 'existing-1', sourceId: 'src-0', sourceLabel: '姓名', steps: [], forceText: false }],
    };

    const { nextMappings, matchCount } = runAutoMapLogic(sourceColumns, targetColumns, existingMappings);

    expect(matchCount).toBe(1);
    expect(nextMappings['col-1'][0].sourceId).toBe('src-1');
    expect(nextMappings['col-0'][0].sourceId).toBe('src-0');
  });

  it('无匹配时应返回 matchCount=0', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '成绩' },
    ];

    const { matchCount } = runAutoMapLogic(sourceColumns, targetColumns, {});
    expect(matchCount).toBe(0);
  });

  it('部分匹配时只映射匹配的字段', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
      { id: 'src-1', label: '年龄' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '姓名' },
      { id: 'col-1', label: '成绩' },
    ];

    const { nextMappings, matchCount } = runAutoMapLogic(sourceColumns, targetColumns, {});

    expect(matchCount).toBe(1);
    expect(nextMappings['col-0'][0].sourceLabel).toBe('姓名');
    expect(nextMappings['col-1']).toBeUndefined();
  });

  it('包含关系匹配应正常工作', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '学生姓名' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '姓名' },
    ];

    const { nextMappings, matchCount } = runAutoMapLogic(sourceColumns, targetColumns, {});

    expect(matchCount).toBe(1);
    expect(nextMappings['col-0'][0].sourceId).toBe('src-0');
  });

  it('过短的字段名不应通过 includes 匹配', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '名' },
    ];

    const { matchCount } = runAutoMapLogic(sourceColumns, targetColumns, {});
    expect(matchCount).toBe(0);
  });

  it('2个字符以上的 includes 匹配应正常工作', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '学生姓名' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '姓名' },
    ];

    const { matchCount } = runAutoMapLogic(sourceColumns, targetColumns, {});
    expect(matchCount).toBe(1);
  });

  it('已有映射的目标列应被跳过', () => {
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
    ];
    const targetColumns: TargetColumn[] = [
      { id: 'col-0', label: '姓名' },
    ];
    const existingMappings: Record<string, MappingNode[]> = {
      'col-0': [{ id: 'existing-1', sourceId: 'src-0', sourceLabel: '姓名', steps: [], forceText: false }],
    };

    const { matchCount } = runAutoMapLogic(sourceColumns, targetColumns, existingMappings);
    expect(matchCount).toBe(0);
  });
});
