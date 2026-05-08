import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/goBridge', () => ({
  safeCall: vi.fn(),
  openFolder: vi.fn(),
}));

import { safeCall } from '@/utils/goBridge';
import { safeCallParse } from '@/utils/bridge';

const mockSafeCall = vi.mocked(safeCall);

describe('safeCallParse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('后端返回 null 时应抛出错误', async () => {
    mockSafeCall.mockResolvedValueOnce(null);

    await expect(safeCallParse('Test_Method')).rejects.toThrow('返回数据为空');
  });

  it('后端返回 "null" 字符串时应抛出错误', async () => {
    mockSafeCall.mockResolvedValueOnce('null');

    await expect(safeCallParse('Test_Method')).rejects.toThrow('返回数据为空');
  });

  it('后端返回有效 JSON 时应正确解析', async () => {
    mockSafeCall.mockResolvedValueOnce(JSON.stringify({ Status: 1, Message: 'ok' }));

    const result = await safeCallParse<{ Status: number; Message: string }>('Test_Method');
    expect(result.Status).toBe(1);
    expect(result.Message).toBe('ok');
  });

  it('后端返回带参数的请求应正确解析', async () => {
    mockSafeCall.mockResolvedValueOnce(JSON.stringify({ LoadStatus: 1 }));

    const result = await safeCallParse<{ LoadStatus: number }>('Test_Method', { FilePath: '/test.xlsx' });
    expect(result.LoadStatus).toBe(1);
  });

  it('后端返回空字符串时应抛出错误', async () => {
    mockSafeCall.mockResolvedValueOnce('');

    await expect(safeCallParse('Test_Method')).rejects.toThrow('返回数据为空');
  });

  it('后端返回无效 JSON 时应抛出解析错误', async () => {
    mockSafeCall.mockResolvedValueOnce('not-valid-json');

    await expect(safeCallParse('Test_Method')).rejects.toThrow();
  });

  it('safeCall 本身抛出错误时应向上传播', async () => {
    mockSafeCall.mockRejectedValueOnce(new Error('IPC 通信失败'));

    await expect(safeCallParse('Test_Method')).rejects.toThrow('IPC 通信失败');
  });
});
