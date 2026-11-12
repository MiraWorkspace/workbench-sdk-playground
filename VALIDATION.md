# Workbench SDK 能力演示台验证记录

本文记录 workbench-miniapp 官方示例小程序的本地验证结果与验收边界。

日期：2026-11-12。

安装包：`release/workbench-sdk-playground-0.1.1.miniapp`，20,949 字节。

SHA-256：`49049c3ae1016b60974b30e9f97d152a82fc05134fa5acb1acd0749d4efe0273`。

## 已通过

- `npm run build` 与标准 `npm test` 通过，包含本轮截图生成。Electron 截图显式使用 `stayHidden/stayAwake` 选项；真实网络运行时截图仍偶发不可用，该轮临时跳过截图后完整通过。
- 本地文件选择进入真实权限确认流程后取消；网址安装使用真实 SDK 下载分发链路、夹具 HTTPS 响应，验证摘要错误拒绝、来源展示、取消后恢复焦点、重试安装并打开，随后运行全部 28 个示例。
- 真实 SDK 连接、SQLite 迁移与增删改查、事务回滚、关闭重开后的数据持久化。
- 私有文件与授权目录的读写、列表，以及临时磁盘文件内容。
- 供应商与模型选择、完整多轮历史、失败后重试、切换模型清空草稿。
- 联网对话请求标志及来源展示、搜索解析、参数错误拒绝。
- 主题事件与取消订阅、无效 JSON、独立客户端断连、释放真实连接关闭视图与重新打开。
- 在 Workbench 撤销模型权限后重新打开，验证实际权限拒绝。
- 普通浏览器未连接时禁止执行。0.1.1 的浅色/深色截图已生成；安装错误及来源/权限确认截图已人工查看，见 `verification/install-url-error.png` 与 `verification/install-url-review.png`。
- 安装包为 15 个运行文件，示例数为 28；连续两次构建摘要一致，在线清单大小和摘要来自最终包。
- SDK 依赖为 GitHub `v0.3.0`，锁定提交 `a6b32bdfe79d201d1142747549c58dbb2f657c06`。

## 线上发布与安装

- 已启用 GitHub Pages 的 Actions 发布，工作流 [第 1 次运行 / 第 2 次尝试](https://github.com/MiraWorkspace/workbench-sdk-playground/actions/runs/43150793110) 成功。
- 安装地址：`https://miraworkspace.github.io/workbench-sdk-playground/manifest.json`。仓库 Website 已设为此地址，Topic 包含 `workbench-miniapp`。
- 远端清单与版本包直接返回 HTTP 200，没有重定向；包大小、SHA-256 与本地 0.1.1 构建字节一致。
- `MINIAPP_LIVE=1` 在隔离 Electron profile 中通过 Mira 的真实 `electronWebRequest` 下载 GitHub Pages 清单和包，完成来源确认、取消、重试、安装及打开，随后运行全部 28 个示例。使用本机 HTTP 代理连通 GitHub；本次真实网络检查临时跳过截图，截图由上面的标准夹具运行提供。

## 验证边界

默认集成的分发下载响应使用测试夹具，另有上述真实 HTTPS 安装验证。所有运行中的模型回答、搜索 HTTP、通知发送与原生目录选择仍使用测试夹具。未调用付费模型、未验证真实联网搜索结果、未验收操作系统通知横幅。真实模型、联网效果及正式安装版通知请在用户环境手动验收。

测试使用临时 profile 和数据目录，结束后清理。

## 简介与安装确认面板：本地开发验证

以上为已发布 0.1.1 的历史记录。当前源码已补充 `description` 简介；本次准备发布 0.1.2，不覆盖线上 0.1.1，SDK 升级为已发布的 0.4.0。

- Workbench 构建及 32 项单元测试通过，覆盖可选简介、旧清单兼容、无效文本拒绝、取消不写入、注册表重读和在线/包内简介一致性。
- 当前 `npm test` 通过真实 Electron / SDK 安装与授权流程及全部 28 个示例；新增校验本地来源、简介、ID、图标、权限条目、底层添加窗口隐藏、取消后焦点恢复和 Tab 焦点循环。
- 检查浅色、深色及 1024 × 680 视图下的长名称、500 字符简介和图标失败回退；确认仅权限列表滚动，应用信息和底部按钮保持原位；简介两行省略，鼠标悬停或键盘聚焦时浮层展示全文，移出或失焦后关闭，且不撑开面板。
- 当前 macOS 原生视图截图不可用，截图改为把真实视图的 DOM 与样式交给 Electron 离屏渲染。截图用于布局检查，SDK 与焦点断言仍执行于真实隔离视图。见 `verification/install-url-review.png`、`verification/install-review-dark.png`、`verification/install-review-compact.png`、`verification/install-description-hover.png` 与 `verification/install-permissions-scrolled.png`。
- 分发响应、模型、搜索、通知与目录选择使用测试夹具；本次未重新验证线上部署、真实模型或操作系统通知。

## 0.1.2 发布修复

- 0.1.1 已公开发布。新增简介后继续使用相同版本改变了包字节，工作流在 `Preserve published version packages` 拒绝覆盖，未部署变更。
- 本次同步清单、项目、锁文件、页面及下载文档版本为 0.1.2；保留不可变包保护，错误信息明确提示升级版本。
- 本地包：`release/workbench-sdk-playground-0.1.2.miniapp`，21,194 字节，SHA-256：`f05d699ec19d8fb12bcfc53e23f60c4c8ca9e66e8e54143132469477907526c7`。
- SDK 更新为 GitHub `v0.4.0`，锁定提交 `aca119cd38556ba9385ade54bab2e36d3ec85289`，构建校验、页面和开发文档同步更新。
