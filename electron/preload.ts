import { contextBridge, ipcRenderer } from 'electron';

type IpcPayload = Record<string, unknown>;

/**
 * Preload 安全桥接层
 * 通过 contextBridge 将 IPC 方法安全暴露给渲染进程
 * 渲染进程通过 window.electronAPI.xxx() 调用
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── 源文件流水线 ──
  Excel_Original_Select: () =>
    ipcRenderer.invoke('excel:selectSource'),

  Excel_Original_Load: (params: { FilePath: string; Page: number; Last: number }) =>
    ipcRenderer.invoke('excel:loadSource', params),

  Excel_SetHeaderRows: (params: { FilePath: string; HeaderRowStart: number; HeaderRowEnd: number }) =>
    ipcRenderer.invoke('excel:setHeaderRows', params),

  // ── 模板流水线（独立于源文件）──
  Excel_Template_Load: () =>
    ipcRenderer.invoke('excel:loadTemplate'),

  Excel_SetTemplateHeaderRows: (params: { FilePath: string; HeaderRowStart: number; HeaderRowEnd: number }) =>
    ipcRenderer.invoke('excel:setTemplateHeaderRows', params),

  // ── 转换 & 预览 ──
  Preview_Transform: (params: IpcPayload) =>
    ipcRenderer.invoke('transform:preview', params),

  // ── 导出 ──
  Excel_Export: (params: IpcPayload) =>
    ipcRenderer.invoke('export:run', params),

  Shell_OpenPath: (path: string) =>
    ipcRenderer.invoke('shell:openPath', path),
});
