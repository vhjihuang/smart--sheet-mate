import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { selectSourceFile, loadSourceData, loadTemplateFile } from './services/excelReader';
import { previewTransform } from './services/transformEngine';
import { exportToTemplate } from './services/exportEngine';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: '智能表格助手',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // 无菜单栏，教师用户不需要
    autoHideMenuBar: true,
  });

  // 移除默认菜单
  mainWindow.setMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // 开发模式下自动打开 DevTools
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ══════════════════════════════════════════
// IPC Handlers — 源文件流水线
// ══════════════════════════════════════════

ipcMain.handle('excel:selectSource', async () => {
  if (!mainWindow) return { SelectStatus: 0, Message: '窗口未就绪' };
  return selectSourceFile(mainWindow);
});

ipcMain.handle('excel:loadSource', async (event, params: {
  FilePath: string;
  Page: number;
  Last: number;
}) => {
  void event;
  return loadSourceData(params);
});

ipcMain.handle('excel:setHeaderRows', async (event, params: {
  FilePath: string;
  HeaderRowStart: number;
  HeaderRowEnd: number;
}) => {
  void event;
  void params;
  // 表头确认是前端逻辑（parseSourceColumns），后端只需应答
  return { Status: 1 };
});

// ══════════════════════════════════════════
// IPC Handlers — 模板流水线（独立于源文件）
// ══════════════════════════════════════════

ipcMain.handle('excel:loadTemplate', async () => {
  if (!mainWindow) return { LoadStatus: 0, Message: '窗口未就绪' };
  return loadTemplateFile(mainWindow);
});

ipcMain.handle('excel:setTemplateHeaderRows', async (event, params: {
  FilePath: string;
  HeaderRowStart: number;
  HeaderRowEnd: number;
}) => {
  void event;
  void params;
  // 模板表头确认是前端逻辑（parseTargetColumnsFromRows），后端只需应答
  return { Status: 1 };
});

// ══════════════════════════════════════════
// IPC Handlers — 转换 & 预览
// ══════════════════════════════════════════

ipcMain.handle('transform:preview', async (event, params: Parameters<typeof previewTransform>[0]) => {
  void event;
  return previewTransform(params);
});

// ══════════════════════════════════════════
// IPC Handlers — 导出
// ══════════════════════════════════════════

ipcMain.handle('export:run', async (event, params: Parameters<typeof exportToTemplate>[0]) => {
  void event;
  if (!mainWindow) return { Status: 0, Message: '窗口未就绪' };
  return exportToTemplate(params, mainWindow);
});

ipcMain.handle('shell:openPath', async (event, filePath: string) => {
  void event;
  if (!filePath) return;
  // 打开文件所在的文件夹并选中该文件
  shell.showItemInFolder(path.resolve(filePath));
});

// ══════════════════════════════════════════
// App 生命周期
// ══════════════════════════════════════════

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
