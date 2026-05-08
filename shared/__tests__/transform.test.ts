import { describe, it, expect } from 'vitest';
import { applyStep } from '../../shared/transform';
import type { SharedTransformStep } from '../../shared/transform';

describe('DATE_FORMAT 转换', () => {
  it('应替换所有 MM 占位符', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'MM/DD' },
    };
    const result = applyStep('2024-01-15', step);
    expect(result).toBe('01/15');
  });

  it('应正确处理 YYYY-MM-DD 格式', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'YYYY年MM月DD日' },
    };
    const result = applyStep('2024-03-05', step);
    expect(result).toBe('2024年03月05日');
  });

  it('应正确处理 YY 短年份', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'YY/MM/DD' },
    };
    const result = applyStep('2024-01-15', step);
    expect(result).toBe('24/01/15');
  });

  it('应正确处理时间格式', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'HH:mm:ss' },
    };
    const result = applyStep('2024-01-15 14:30:45', step);
    expect(result).toBe('14:30:45');
  });

  it('应正确处理 Excel 序列号日期', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'YYYY-MM-DD' },
    };
    const result = applyStep('44927', step);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('应正确处理 YYYYMMDD 格式', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'YYYY-MM-DD' },
    };
    const result = applyStep('20240305', step);
    expect(result).toBe('2024-03-05');
  });

  it('无效的 YYYYMMDD 应返回原值', () => {
    const step: SharedTransformStep = {
      type: 'DATE_FORMAT',
      params: { toFormat: 'YYYY-MM-DD' },
    };
    const result = applyStep('20241345', step);
    expect(result).toBe('20241345');
  });
});
