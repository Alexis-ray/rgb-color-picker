# RGB Color Picker

一个专注于高效取色与颜色信息查看的单页 Web 应用，使用原生 `HTML`、`CSS` 和 `JavaScript` 构建，无需框架即可直接运行。

它适合在前端开发、视觉调试、样式编写和日常配色场景中快速完成取色、微调、复制与导出。

## 功能概览

- 支持 `Hex` 与 `RGB` 输入，并保持实时同步
- 提供 `HSV` 色相滑条和二维颜色面板，便于快速定位颜色
- 提供 `RG`、`RB`、`GB` 三种局部颜色平面，用于精细微调
- 展示 `Hex`、`RGB`、`HSL`、`HSV` 四种颜色格式，并支持一键复制
- 支持收藏颜色、最近使用记录和联动调色板生成
- 支持导出为 `JSON`、`TXT`、`CSS` 变量格式
- 内置对比度与文字可读性提示，便于判断深浅文本选择
- 支持吸管取色、主题切换、基础离线能力和本地持久化

## 快速开始

安装依赖：

```bash
npm install
```

启动本地服务：

```bash
npm start
```

打开 `http://127.0.0.1:4173/index.html` 即可使用。

## 测试

项目使用 Playwright 进行端到端测试：

```bash
npm test
```

当前测试覆盖了以下核心交互：

- `Hex` 与 `RGB` 输入校验和同步
- 色相滑条、`HSV` 面板与局部色块选择
- 键盘可访问性操作
- 收藏、最近使用记录与主题切换
- 移动端布局和基础兼容性行为

## 项目结构

- `index.html`：应用页面结构
- `style.css`：界面样式与响应式布局
- `script.js`：颜色计算、状态管理与交互逻辑
- `tests/color-picker.spec.js`：Playwright 测试用例
- `manifest.webmanifest`：PWA 清单文件
- `service-worker.js`：离线缓存支持

## 实现说明

- 项目是纯前端静态应用，不依赖后端服务。
- 收藏颜色、最近使用记录、主题偏好会保存在浏览器 `localStorage` 中。
- 当浏览器不支持 `EyeDropper` API 时，吸管功能会自动降级。
- 应用包含基础 `manifest` 和 `service worker` 配置，可作为轻量级 PWA 使用。
