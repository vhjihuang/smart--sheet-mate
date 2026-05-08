import { describe, it, expect } from 'vitest';
import { parseSourceColumns, getColumnLabel, getLeafColumns } from '@/utils/excel';
import type { ExcelRow, TargetColumn } from '@/types';

describe('excel 工具函数', () => {
  describe('parseSourceColumns', () => {
    it('空行数据应返回空数组', () => {
      expect(parseSourceColumns([], 0, 0)).toEqual([]);
    });

    it('start > end 时应返回空数组', () => {
      const rows: ExcelRow[] = [
        { DataList: ['姓名', '年龄'], Index: 0 },
      ];
      expect(parseSourceColumns(rows, 5, 2)).toEqual([]);
    });

    it('单行表头应正确解析', () => {
      const rows: ExcelRow[] = [
        { DataList: ['姓名', '年龄', '成绩'], Index: 0 },
        { DataList: ['张三', '20', '90'], Index: 1 },
      ];
      const result = parseSourceColumns(rows, 0, 0);
      expect(result).toEqual([
        { id: 'src-0', label: '姓名' },
        { id: 'src-1', label: '年龄' },
        { id: 'src-2', label: '成绩' },
      ]);
    });

    it('多行表头应使用最后一行作为标签', () => {
      const rows: ExcelRow[] = [
        { DataList: ['基本信息', '基本信息', '成绩'], Index: 0 },
        { DataList: ['姓名', '年龄', '分数'], Index: 1 },
      ];
      const result = parseSourceColumns(rows, 0, 1);
      expect(result[0].label).toBe('姓名');
      expect(result[1].label).toBe('年龄');
      expect(result[2].label).toBe('分数');
    });

    it('空单元格应使用列号作为默认标签', () => {
      const rows: ExcelRow[] = [
        { DataList: ['姓名', '', '成绩'], Index: 0 },
      ];
      const result = parseSourceColumns(rows, 0, 0);
      expect(result[1].label).toBe('列2');
    });
  });

  describe('getColumnLabel', () => {
    it('0 应返回 A', () => {
      expect(getColumnLabel(0)).toBe('A');
    });

    it('25 应返回 Z', () => {
      expect(getColumnLabel(25)).toBe('Z');
    });

    it('26 应返回 AA', () => {
      expect(getColumnLabel(26)).toBe('AA');
    });

    it('51 应返回 AZ', () => {
      expect(getColumnLabel(51)).toBe('AZ');
    });

    it('52 应返回 BA', () => {
      expect(getColumnLabel(52)).toBe('BA');
    });

    it('701 应返回 ZZ', () => {
      expect(getColumnLabel(701)).toBe('ZZ');
    });

    it('702 应返回 AAA', () => {
      expect(getColumnLabel(702)).toBe('AAA');
    });
  });

  describe('getLeafColumns', () => {
    it('扁平列应全部返回', () => {
      const columns: TargetColumn[] = [
        { id: 'col-0', label: '姓名' },
        { id: 'col-1', label: '年龄' },
      ];
      expect(getLeafColumns(columns)).toEqual(columns);
    });

    it('嵌套列应只返回叶子节点', () => {
      const columns: TargetColumn[] = [
        {
          id: 'group-0',
          label: '基本信息',
          children: [
            { id: 'col-0', label: '姓名' },
            { id: 'col-1', label: '年龄' },
          ],
        },
        { id: 'col-2', label: '成绩' },
      ];
      const leaves = getLeafColumns(columns);
      expect(leaves.map((l) => l.id)).toEqual(['col-0', 'col-1', 'col-2']);
    });
  });
});
