import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ExcelRow } from '@/types';

vi.mock('@/utils/bridge', () => ({
  safeCallParse: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({
  showToast: vi.fn(),
}));

import { safeCallParse } from '@/utils/bridge';
import { showToast } from '@/utils/toast';
import { useWorkbookState } from '@/hooks/useWorkbookState';

const mockSafeCallParse = vi.mocked(safeCallParse);
const mockShowToast = vi.mocked(showToast);

const createCallbacks = () => ({
  onMappingsReset: vi.fn(),
  onSlotConfigsReset: vi.fn(),
  onPreviewReset: vi.fn(),
  onErrorReset: vi.fn(),
  hasMappings: vi.fn(() => false),
});

describe('useWorkbookState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('skipHeader', () => {
    it('应设置 isHeaderConfirmed 为 true', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.skipHeader();
      });

      expect(result.current.isHeaderConfirmed).toBe(true);
    });

    it('应将 headerRowStart 和 headerRowEnd 重置为 0', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.setHeaderRowStart(3);
        result.current.setHeaderRowEnd(5);
      });

      await act(async () => {
        result.current.skipHeader();
      });

      expect(result.current.headerRowStart).toBe(0);
      expect(result.current.headerRowEnd).toBe(0);
    });

    it('应使用第 1 行解析 sourceColumns', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      const testRows: ExcelRow[] = [
        { DataList: ['姓名', '年龄', '成绩'], Index: 0 },
        { DataList: ['张三', '20', '90'], Index: 1 },
      ];

      mockSafeCallParse
        .mockResolvedValueOnce({ LoadStatus: 1, Message: '加载成功', Data: { Sheets: [{ SheetName: 'Sheet1' }], Rows: testRows, Last: 2 } })
        .mockResolvedValueOnce({ LoadStatus: 1, Message: '加载成功', Data: { Rows: testRows, Last: 2 } });
      await act(async () => {
        result.current.setFilePath('/test/file.xlsx');
      });
      await act(async () => {
        await result.current.handleLoadFile();
      });

      await act(async () => {
        result.current.skipHeader();
      });

      expect(result.current.sourceColumns).toEqual([
        { id: 'src-0', label: '姓名' },
        { id: 'src-1', label: '年龄' },
        { id: 'src-2', label: '成绩' },
      ]);
    });

    it('应触发 onMappingsReset', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.skipHeader();
      });

      expect(callbacks.onMappingsReset).toHaveBeenCalled();
    });

    it('应显示成功提示', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.skipHeader();
      });

      expect(mockShowToast).toHaveBeenCalledWith('success', '已跳过');
    });
  });

  describe('confirmHeader', () => {
    it('成功时应设置 isHeaderConfirmed 为 true', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.setFilePath('/test/file.xlsx');
      });

      mockSafeCallParse.mockResolvedValueOnce({ Status: 1 });

      await act(async () => {
        await result.current.confirmHeader();
      });

      expect(result.current.isHeaderConfirmed).toBe(true);
      expect(mockShowToast).toHaveBeenCalledWith('success', '表头已确认');
    });

    it('filePath 为空时应提示错误', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        await result.current.confirmHeader();
      });

      expect(result.current.isHeaderConfirmed).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('error', '请先选择源文件');
    });

    it('失败时应显示错误提示且 isHeaderConfirmed 保持 false', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.setFilePath('/test/file.xlsx');
      });

      mockSafeCallParse.mockResolvedValueOnce({ Status: 0, Message: '设置失败' });

      await act(async () => {
        await result.current.confirmHeader();
      });

      expect(result.current.isHeaderConfirmed).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('error', '设置失败');
    });

    it('IPC 异常时应显示错误提示且 isHeaderConfirmed 保持 false', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.setFilePath('/test/file.xlsx');
      });

      mockSafeCallParse.mockRejectedValueOnce(new Error('IPC 通信失败'));

      await act(async () => {
        await result.current.confirmHeader();
      });

      expect(result.current.isHeaderConfirmed).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('error', 'IPC 通信失败');
    });

    it('dataRowStart 小于 headerRowEnd+1 时应自动修正', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.setFilePath('/test/file.xlsx');
      });

      mockSafeCallParse.mockResolvedValueOnce({ Status: 1 });

      await act(async () => {
        result.current.setHeaderRowEnd(2);
        result.current.setDataRowStart(1);
      });

      await act(async () => {
        await result.current.confirmHeader();
      });

      expect(result.current.dataRowStart).toBe(3);
    });

    it('dataRowStart 已合理时确认表头不应覆盖', async () => {
      const callbacks = createCallbacks();
      const { result } = renderHook(() => useWorkbookState(callbacks));

      await act(async () => {
        result.current.setFilePath('/test/file.xlsx');
      });

      mockSafeCallParse.mockResolvedValueOnce({ Status: 1 });

      await act(async () => {
        result.current.setHeaderRowEnd(2);
        result.current.setDataRowStart(5);
      });

      await act(async () => {
        await result.current.confirmHeader();
      });

      expect(result.current.dataRowStart).toBe(5);
    });
  });
});
