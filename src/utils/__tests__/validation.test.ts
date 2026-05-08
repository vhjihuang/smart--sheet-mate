import { describe, it, expect } from 'vitest';
import { validateMappings } from '@/utils/validation';
import type { MappingNode, SourceColumn, ExcelRow, TargetColumn } from '@/types';

describe('validateMappings', () => {
  it('错误消息应使用列名而非内部 ID', () => {
    const mappings: Record<string, MappingNode[]> = {
      'col-3': [{ id: 'm1', sourceId: 'src-99', sourceLabel: '不存在', steps: [], forceText: false }],
    };
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
    ];
    const rows: ExcelRow[] = [];
    const slotConfigs = {};
    const targetColumns: TargetColumn[] = [
      { id: 'col-3', label: '姓名' },
    ];

    const result = validateMappings(mappings, sourceColumns, rows, slotConfigs, targetColumns);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('姓名');
    expect(result.errors[0]).not.toContain('col-3');
  });

  it('未提供 targetColumns 且 sourceColumns 为空时应提示源字段列表为空', () => {
    const mappings: Record<string, MappingNode[]> = {
      'col-3': [{ id: 'm1', sourceId: 'src-99', sourceLabel: '不存在', steps: [], forceText: false }],
    };
    const sourceColumns: SourceColumn[] = [];
    const rows: ExcelRow[] = [];
    const slotConfigs = {};

    const result = validateMappings(mappings, sourceColumns, rows, slotConfigs);

    expect(result.errors[0]).toContain('源字段列表为空');
  });

  it('有效映射应通过验证', () => {
    const mappings: Record<string, MappingNode[]> = {
      'col-0': [{ id: 'm1', sourceId: 'src-0', sourceLabel: '姓名', steps: [], forceText: false }],
    };
    const sourceColumns: SourceColumn[] = [
      { id: 'src-0', label: '姓名' },
    ];
    const rows: ExcelRow[] = [];
    const slotConfigs = {};

    const result = validateMappings(mappings, sourceColumns, rows, slotConfigs);
    expect(result.valid).toBe(true);
  });
});
