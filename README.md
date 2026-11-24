# dsh-width-handle-toggle
本插件的代码与文档主要由 AI 编码智能体在维护者指导下编写，维护者负责需求、测试与发布。代码未经正式安全审计，使用前请自行评估。
给 DSH（DeepSeek Harness）对话区加「上/下分开」的宽度手柄：**默认隐藏**，在设置里打开后才出现两条可拖动的竖线 —— 一条调消息区宽度，一条调输入框宽度，互不影响。

原版对话区只有一组宽度手柄，拖动时会同时改变消息列和输入框；本插件把它们拆成两条独立轴，并提供了一个总开关，避免鼠标误触改变布局。

## 功能

- 设置 → **对话宽度** 里一个开关：关闭时完全隐藏，不占位、不拦截点击；
- 打开后：消息区左侧一条竖线，输入框左侧一条竖线，各自独立拖动；
- 拖动其中一条时，另一条的宽度会被就地锁定，不会跟着联动；
- 宽度与开关状态都存在浏览器 localStorage，刷新/重开应用都保留；
- 兼容桌面壳（Electron）与 `dsh web` 两种形态。

## 安装

```bash
# 从 GitHub 安装（当前方式）
dsh plugin --profile desktop add github:jia-lucky/dsh-width-handle-toggle#v1.0.0
```

`desktop` 换成你实际使用的 profile 名（`dsh web` 形态常用 `web`）。安装后**重启一次应用**：开关的客户端模块与启动脚本是在宿主启动时挂载的。

本地开发安装（软链，改代码即时生效）：

```bash
dsh plugin --profile desktop add link:/absolute/path/to/dsh-width-handle-toggle
```

## 使用

1. 打开 设置 → **对话宽度**，打开「对话宽度手柄」；
2. 回到对话，把鼠标移到消息区或输入框左侧边缘，出现竖线后按住拖动；
3. 想恢复默认宽度：关闭开关，或在开发者工具里删掉 localStorage 的 `dsh.conversation.contentWidth` / `dsh.conversation.composerWidth`。

## 可选设置（localStorage）

| 键 | 值 | 说明 |
| --- | --- | --- |
| `dsh.conversation.widthHandles` | `on` / `off` | 总开关，默认 `off` |
| `dsh.conversation.contentWidth` | 数字（px） | 消息区宽度 |
| `dsh.conversation.composerWidth` | 数字（px） | 输入框宽度 |

## 开发

```bash
npm test        # 结构 + 语法自检
npm pack        # 打包，检查 files 白名单
```

调试模式（宿主侧）：设置环境变量 `DSH_WIDTH_HANDLE_DEBUG=1` 后会额外提供 `/dsh-width-handle-toggle/meta`（热重载版本号）与 `/dsh-width-handle-toggle/diag`（诊断写入插件目录）两条路由，仅用于开发。

改 `lib/widget.js` 后，把插件目录里的 `rev.txt` 数字加一，页面会在约 2 秒内自动刷新（需调试模式）；改 `lib/index.js`（宿主侧）则必须重启应用。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-width-handle-toggle
```

卸载后如果还想清掉已保存的宽度，删掉 localStorage 里的 `dsh.conversation.contentWidth`、`dsh.conversation.composerWidth`、`dsh.conversation.widthHandles` 三个键。

## 兼容性

- 宿主版本：DSH 0.1.x 及以上（依赖 `webserver/index-inject`、`dsh.client` 与 `settings.section` 插槽）；
- 客户端要求宿主提供 `@deepseek-ai/dsh-client-ui-settings`（官方 Web 形态默认提供）。

## License

MIT

