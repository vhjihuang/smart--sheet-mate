export async function safeCall(moduleName: string, funcName: string, ...args: any[]) {
  const win = window as any;
  // 检查 Wails 环境是否存在
  if (win.go && win.go[moduleName] && win.go[moduleName].App[funcName]) {
    return win.go[moduleName].App[funcName](...args);
  } else {
    console.error(`Go方法 ${funcName} 未找到，可能是在浏览器环境运行或后端未定义`);
    return null;
  }
}