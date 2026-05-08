interface ElectronAPI {
  [key: string]: ((...args: unknown[]) => Promise<unknown>) | undefined;
  Shell_OpenPath?: (path: string) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Electron 桥接层
 * 通过 preload.ts 暴露的 window.electronAPI 调用主进程
 * 保留原 API 名称（Excel_Original_Select 等）以最小化前端改动
 */
export async function safeCall(_moduleName: string, funcName: string, ...args: unknown[]) {
  const api = window.electronAPI;

  if (!api) {
    console.error('electronAPI 未就绪，可能在纯浏览器环境中运行');
    return null;
  }

  // Electron IPC 直接传对象，不需要 JSON 序列化
  // 但 bridge.ts 可能传入了 JSON.stringify 的结果，这里兼容处理
  const parsedArgs = args.map((arg) => {
    if (typeof arg === 'string') {
      try {
        return JSON.parse(arg);
      } catch {
        return arg;
      }
    }
    return arg;
  });

  const target = api[funcName];
  if (typeof target !== 'function') {
    console.error(`API 方法 ${funcName} 不存在`);
    return null;
  }

  const result = await target(...parsedArgs);

  if (result === null || result === undefined) {
    return null;
  }

  return JSON.stringify(result);
}

export async function openFolder(path: string) {
  const api = window.electronAPI;
  if (api?.Shell_OpenPath) {
    await api.Shell_OpenPath(path);
  }
}
