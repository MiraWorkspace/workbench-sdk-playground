# Workbench SDK 能力演示台

**workbench-miniapp 官方示例小程序**，面向开发者展示如何通过 Mira-App-SDK 使用 Workbench 开放的小程序能力。项目名称为 `workbench-sdk-playground`。

项目包含 28 个可执行示例，覆盖连接、模型对话、联网搜索、应用存储、文件、主题、通知和权限错误处理。每个示例都提供用途、所需权限、可编辑 JSON 参数、实际执行的 SDK 代码、返回值或错误，以及验证步骤和源码位置。开发者可以在演示台中执行调用，再将对应代码用于自己的小程序。

## 运行要求

| 项目 | 要求 |
| --- | --- |
| 示例版本 | 0.1.0 |
| SDK | Mira-App-SDK 0.3.0 |
| Mira 宿主 | 支持 Mira API 1.3 |
| Workbench | 支持小程序 API 1.2 |
| AI 示例 | 在 Mira 中配置并启用聊天供应商与模型；自主联网对话需要支持工具调用的模型 |

小程序需要安装到 Mira 中的 Workbench 运行。普通浏览器仅用于阅读界面和代码，无法调用宿主能力。

## 本地安装

本地构建产物位于：

```text
release/workbench-sdk-playground-0.1.0.miniapp
```

1. 打开 Mira 中的 Workbench，点击“添加 → 小程序 → 选择文件”。
2. 选择上面的 `.miniapp`，检查申请的能力并确认安装。
3. 打开“Workbench SDK 能力演示台”，确认顶部“已连接 Workbench”。
4. 按左侧能力选择示例、修改 JSON 参数，检查代码后点击“执行此示例”。

初次连接只调用 `context.get()`。模型、搜索、文件写入、通知均需手动触发，不自动执行。没有可用供应商时，请先在 Mira 配置并启用聊天供应商与模型。

## 接入机制与权限

调用链：**小程序中的 SDK 客户端 → Workbench 校验小程序权限并转发 → Mira 宿主执行能力 → 返回结果**。

小程序和 Workbench 各自使用 Mira-App-SDK：小程序连接 Workbench 提供的消息通道，Workbench 通过 SDK 调用 Mira 宿主。构建时随小程序分发的是 SDK 消息客户端；模型服务、供应商配置和密钥由 Mira 管理，小程序无需配置密钥。

小程序在 [miniapp-manifest.json](miniapp-manifest.json) 中声明所需能力，用户在 Workbench 中授权。SDK 中存在某个方法，不代表该方法已向小程序开放；实际调用还需满足 Workbench 接口范围与用户授权。

| 能力声明 | 示例用途 |
| --- | --- |
| `storage:app` | 小程序独立 SQLite 存储、迁移与事务 |
| `models:generate` | 供应商和模型列表、生成、多轮对话 |
| `web:search` | 独立搜索；与模型权限一起用于自主联网对话 |
| `files:read` | 私有文件和授权目录的读取、列表 |
| `files:write` | 私有文件和授权目录的写入 |
| `appearance:read` | 读取主题及订阅主题变化 |
| `notifications:send` | 请求宿主发送系统通知 |

官方示例为展示能力而申请上述七项权限。开发自己的小程序时，只声明实际使用的权限。访问外部目录还需用户在 Workbench“设置 → 小程序权限”中单独授权目录。

## 28 个示例

| 模块 | 示例 | 源码 |
| --- | --- | --- |
| 连接 | 上下文、独立客户端断连错误、释放真实连接关闭视图 | [context.js](src/examples/context.js) |
| 模型 | 供应商列表、模型列表、单次生成、多轮对话 | [models.js](src/examples/models.js) |
| 联网 | 独立搜索、AI 自主联网对话与来源 | [web.js](src/examples/web.js) |
| 存储 | 建表迁移、新增、查询、修改、删除、失败回滚 | [storage.js](src/examples/storage.js) |
| 文件 | 私有写入、读取、列表；目录授权列表、目录列表、目录写入与读取 | [files.js](src/examples/files.js) |
| 主题 | 读取主题、订阅与取消订阅 | [appearance.js](src/examples/appearance.js) |
| 通知 | 发送系统通知 | [notifications.js](src/examples/notifications.js) |
| 权限与错误 | 未开放方法、宿主参数校验、未授权请求 | [errors.js](src/examples/errors.js) |

示例的 `run` 函数直接调用 SDK。页面显示这个函数自身的源码和本次参数，不通过 `eval` 执行字符串。编辑器只编辑参数；改动函数请修改对应源码并重新打包。复制的代码按 `@mira/app-sdk` 导入，可移植到自己的小程序项目。

文件读取示例会把返回的 `Uint8Array` 解码为文本，代码中明确展示此转换。`write/send` 等方法无返回值时，页面显示 `undefined`，不会伪造成功对象。主题订阅返回本地取消函数，事件记录与请求结果分开显示。

## 在自己的小程序中使用

1. 声明需要的能力，在入口调用 `connectMiraApp()`，再通过 `sdk.context.get()` 核对连接与已授权能力。
2. 从对应示例文件提取 SDK 调用，按业务输入传递参数，并处理实际返回值与错误。
3. 页面卸载前取消事件订阅并调用 `sdk.dispose()` 释放连接。

AI 调用按“获取供应商 → 获取模型 → 选择模型 → 生成或对话”进行。多轮对话由小程序保存并提交完整消息历史；启用自主联网时，在 `sdk.models.chat()` 参数中设置 `webSearch: true`，由 AI 决定是否搜索与读取网页。独立的 `sdk.web.search()` 可直接返回搜索结果，无需调用模型。两种方式均不要求用户选择搜索引擎。

完整的能力契约与参数说明见 [Mira-App-SDK 文档](https://github.com/MiraWorkspace/Mira-App-SDK/tree/v0.3.0)；小程序调用范围以 Workbench 实际开放的接口为准。

## 推荐验收顺序

1. **连接与授权**：上下文中核对 `host: workbench`、小程序 ID、API 版本和实际 capabilities。
2. **存储**：按 1–6 顺序运行。主键冲突的事务应报错，查询不应有 `rollback-probe`。同一记录重复新增也会真实报错，可删除或修改 ID。
3. **持久化**：插入记录并写入私有文件，关闭重开，再查询及读取；数据应保留。
4. **文件目录**：在 Workbench“设置 → 小程序权限”授予一个空测试目录，重新打开演示台，执行目录授权列表，将返回的 `id` 填入 `grant`。只读授权应拒绝写入；目录授权撤销后旧句柄应被拒绝。写入会覆盖参数指定的文件，请使用测试目录。
5. **模型选择**：获取供应商 → 选择供应商 → 获取模型 → 选择模型 → 执行生成或对话。支持默认模型的 `generate` 示例可删去两个 ID 验证默认配置。
6. **多轮对话**：首次发送名字，填入追问，点击“将回答与追问填入参数”，检查完整历史后再执行。失败不修改参数，直接重试；切换模型会清空对话草稿。对话和调用日志只在当前页面内存保存。
7. **联网**：独立搜索不用模型；自主联网需要支持工具调用的模型。核对回答和本次 `sources`，不需要选择搜索引擎。联网允许 AI 自行决定是否搜索，可能产生多次模型费用。
8. **主题**：读取 → 订阅 → 在 Mira 切换主题 → 核对事件 → 取消订阅 → 再次切换。取消后事件数量应不再增加。取消函数不释放 SDK 连接。
9. **权限**：在 Workbench 中关闭模型或联网权限，运行中的小程序会关闭。重新打开，查看未授权标记，仍可执行示例验证实际拒绝；恢复权限后重开。错误信息按真实返回展示，Workbench 通道通常将拒绝转为 `APPLICATION_DENIED`。
10. **断连**：先执行独立客户端断连示例，预期得到 `DISCONNECTED`，当前真实连接不受影响。这不是模拟宿主成功；它验证 SDK 的本地断连检查。最后执行真实连接释放示例，Workbench 会关闭视图，需从 Workbench 重新打开。页面卸载时自动取消订阅并释放连接。顶部按钮只重新读取上下文，不重新创建连接。

## 能力边界

目录选择和撤销在 Workbench 完成。小程序目前支持 `files.read/write/list/directories`，不支持直接 `selectDirectory/remove/revoke`；`views`、`workbench`、旧数据迁移接口也不作为小程序示例开放。“未开放方法”示例故意调用 `files.selectDirectory`，只用于验证拒绝。

通知调用成功仅表示宿主接受请求，不能证明系统横幅已出现。macOS 通知需要正式安装版及系统授权，Windows/macOS 的实际效果分别验收。联网搜索和付费模型不由本地自动化检查替代验收。

## 构建

需要 Node.js 22+、npm、Git，并能访问 GitHub 与依赖仓库。

```sh
git clone https://github.com/MiraWorkspace/workbench-sdk-playground.git
cd workbench-sdk-playground
npm ci
npm run build
```

依赖固定到 GitHub `v0.3.0` 标签，锁文件固定对应提交。构建从已安装的 SDK 复制 JavaScript 与 MIT 许可证到 `dist/vendor/`；无需手工维护 SDK 副本。`dist/` 是可运行静态文件，`release/` 是安装包和 SHA-256 校验文件；源码、验证脚本和测试截图不进入安装包。

包内 ID 为 `workbench-sdk-playground`。当前 Workbench 不接受同版本覆盖，重复验证同一版本时可卸载后重新安装；按宿主规则卸载会保留小程序业务数据。发布更新时需同步修改 `package.json` 与 `miniapp-manifest.json` 中的版本号，并重新构建安装包。

## 验证

```sh
npm test
```

集成检查需要额外准备 Mira-Harness 与 Mira-Workbench 源码及其开发依赖。当前脚本约定三个项目按以下目录布局放置；单独克隆本仓库即可构建与安装，运行 `npm test` 还需满足此布局。

```text
Mira/
├── Mira-Harness/
├── Mira-Workbench/
└── test/
    └── workbench-sdk-playground/
```

检查在临时 Electron profile 中启动测试宿主，从 Workbench 实际安装入口加载 `.miniapp`。检查真实连接、权限、SQLite、文件、目录句柄、主题事件、客户端断连、真实连接释放与重新打开；模型回答、搜索 HTTP、通知发送和原生目录选择使用夹具，不访问外网模型或修改用户数据。测试完成后删除临时 profile。截图写到 `verification/`，不进入安装包。

只阅读界面与源码可运行 `npm run preview`，访问 `http://127.0.0.1:4178`。普通浏览器会明确显示未连接，执行按钮不可用，不注入模拟宿主。

本地验证结果与验收边界见 [VALIDATION.md](VALIDATION.md)。

## 目录

```text
miniapp-manifest.json    安装身份与能力声明
src/app.js              通用参数、代码、结果、日志及模型选择界面
src/examples/           按能力拆分的实际 SDK 调用
scripts/build.mjs       静态文件与安装包构建
scripts/verify.mjs      隔离 Electron 集成检查
scripts/preview.mjs     普通浏览器阅读预览
dist/                   构建产物
release/                .miniapp 与 SHA-256
```
