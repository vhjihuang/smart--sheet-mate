# Smart Sheet Mate (智能表格助手)

一款面向基层教师和办公人员的本地化 Excel 数据映射与转换工具。
通过直观的可视化连线与拖拽操作，帮助用户快速将杂乱的源 Excel 数据，清洗、转换并填入标准模板中。

## 架构说明

本项目基于 **Electron + React (Vite) + TypeScript** 构建，完全抛弃了后端的依赖，实现轻量化、跨平台的桌面端部署：

- **渲染层 (前端)**: React 19 + Tailwind CSS + dnd-kit (拖拽库)
- **主进程 (后端)**: Electron + Node.js
- **Excel 处理**: SheetJS (`xlsx`) 用于源文件高兼容读取，`exceljs` 用于带格式写入模板文件。
- **打包分发**: Electron-builder (支持 Windows NSIS)

## 核心特性

- **数据隐私安全**: 所有操作均在本地离线完成，无任何云端上传，保护学生与教职工隐私数据。
- **智能源头解析**: 支持自动解析复杂表头、合并单元格。
- **内置转换流水线**:
  - `TRIM` 去空格
  - `UPPER` / `LOWER` 大小写转换
  - `CROP` 智能截取
  - `REPLACE` 文本替换
  - `PREFIX` / `SUFFIX` 前后缀拼接
  - `SCORE_GRADE` 成绩分级
  - `ID_MASK` 证件号脱敏
- **多对一聚合**: 支持将源数据的多个字段（如：省、市、区）按指定符号拼接后填入同一个模板字段。
- **格式锁定**: 强制文本格式导出(`forceText`)，彻底解决长数字（如身份证、学号）被 Excel 科学计数法吞噬的问题。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式联调

启动 Vite 本地服务，并随后拉起 Electron 窗口进行联调开发：

```bash
npm run dev:electron
```

### 3. 打包构建

构建 React 前端并使用 `electron-builder` 打包出 Windows 安装程序 (.exe)：

```bash
npm run build:electron
```

构建结果将输出在 `release/` 目录中。

## 目录结构

- `/src`: React 前端代码 (UI组件、Hooks、类型定义)
- `/electron`: Electron 主进程代码 (IPC 接口、窗口管理、Excel处理服务)
- `/dist`: Vite 构建的前端产物
- `/dist-electron`: `tsc` 编译后的主进程产物
- `/release`: 打包出的最终可执行文件

