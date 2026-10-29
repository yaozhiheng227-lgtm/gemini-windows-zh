# Gemini Windows ZH

Gemini Windows 客户端的非官方社区简体中文界面补丁，与 Google 无从属或背书关系。**早期实验版本，仅适配已登记的 Gemini 1.16.0 构建；不承诺全界面、全版本汉化。**

针对“桌面菜单已有中文，内嵌 Gemini 网页仍显示英文”的情况，在本机资源包中追加独立翻译逻辑。支持已收录的导航、悬浮提示、设置菜单、二级设置页、模型说明、欢迎页和部分输入提示。仅改变显示文案，不改变 Google 账号语言、订阅、地区或服务端功能支持范围。

当前版本 **0.1.3**。修复内容误译边界、备份诊断和特殊字符替换，详见 [审查修复记录](docs/REVIEW_FIXES.md)。此前逐项覆盖和剩余英文见 [使用流程检查](docs/USER_FLOW_AUDIT.md)。Gems 旧版管理页、推荐模板和部分动态提示仍未完整覆盖；缺少可靠结构的落地页标签也可能保留英文。安装异常或更新补丁时参考 [恢复说明](docs/RECOVERY.md)。

## 演示

![使用合成数据的翻译保护测试](docs/demo.png)

上图是项目自建的模拟页面，不是真实账号截图。导航文字转为中文，保护区中的相同英文消息和代码保留原样。真实客户端验证结果见 [验证记录](docs/VALIDATION.md)。

0.1.1 的真实客户端顶部悬浮提示（仅截取工具区，不含账号或聊天列表）：

![收起侧边栏的悬浮提示](docs/tooltip-sidebar.png)

![搜索对话的悬浮提示](docs/tooltip-search.png)

## 兼容范围

| 项目 | 当前状态 |
| --- | --- |
| 系统 | Windows；实测 Windows 11 x64 |
| 客户端 | 官方 Gemini Windows 1.16.0，且主程序/解包配置哈希匹配兼容清单 |
| 运行环境 | 已有 Node.js 20+；实测 Node.js 24.18.0 |
| 安装权限 | 当前用户安装目录，一般不需要管理员权限 |
| 其他版本 / ARM64 / macOS / Linux | 未验证，安装器会拒绝未知构建 |
| 启用嵌入式 ASAR 校验的构建 | 不支持；不会修改 EXE 或关闭校验 |

版本号相同不等于文件构建相同。Google 更新之后，请先运行诊断；不要将旧版资源包复制到新版客户端。

## 快速开始

下载并解压项目源码后，在项目目录打开 PowerShell。无需 `npm install`，安装器和测试没有第三方 npm 依赖。若电脑没有 Node.js，请自行从其官方渠道安装；本工具不会代为安装或升级。

先检查兼容性：

```powershell
node bin/gemini-zh.mjs diagnose
```

已安装后的状态可用 `node bin/gemini-zh.mjs status` 查看。`statePresent` 表示清单存在，`backupPresent` 表示备份文件存在，只有 `backupValid: true` 才说明备份摘要与清单相符。`runtime.available: false` 表示运行时诊断不可用，不等于翻译已关闭；`runtime: null` 表示尚无运行时记录。

在 Gemini 的顶部主菜单选择 **文件 → 退出**，再运行：

```powershell
node bin/gemini-zh.mjs install
```

然后正常打开 Gemini。也可双击 `检查状态.cmd`、`安装中文.cmd`。工具会拒绝修改正在运行的客户端，不会强制结束进程。

非默认安装位置可显式指定版本目录：

```powershell
node bin/gemini-zh.mjs diagnose --app-dir "D:\Apps\Gemini\app-1.16.0"
```

### 恢复官方资源包

先完全退出 Gemini，再双击 `恢复原版.cmd`，或运行：

```powershell
node bin/gemini-zh.mjs restore
```

恢复前会校验备份和当前包。如果文件被其他工具修改，恢复会停止，避免覆盖其他改动。恢复成功后原始包哈希必须与备份记录一致。

恢复仍要求当前构建和签名通过检查。程序已更新、资源不可解析、签名无法验证或备份损坏时，工具可能拒绝恢复；保留现场并参阅恢复说明，不提供无条件恢复保证。

### 更新本工具的词典或规则

完全退出 Gemini，先用当前工具恢复原版，再使用新源码安装：

```powershell
node bin/gemini-zh.mjs restore
node bin/gemini-zh.mjs install
```

不覆盖已有备份。重复安装相同补丁会返回 `already-installed`；检测到翻译代码变化时，会要求先恢复。

## 实现方式与边界

1. 检查 `Gemini.exe` 的有效 Google 数字签名、Electron Fuse 状态和已登记的文件哈希。
2. 在本机保存 `resources/.gemini-windows-zh/app.asar.original` 和哈希清单，再原子替换 `app.asar`。
3. 仅向 `https://gemini.google.com` 页面加载独立的词典和 DOM 翻译引擎。
4. 使用精确词条和少量受限的无障碍标签模板，处理动态菜单和拆分动画文本，保留原 DOM 节点。

补丁会修改本地 `app.asar`。`Gemini.exe` 保持原样，但修改后的资源包属于社区补丁状态，不能称作未修改的官方客户端。

引擎对聊天消息、代码块、可编辑内容、已识别的历史标题和部分不明确的会话区域采取跳过策略。为了保护内容，一些聊天页操作按钮可能保留英文。Google 随时可能改变网页 DOM，现有保护规则和翻译覆盖均需要持续验证。

### 不收集什么

- 没有翻译 API、遥测、外部下载或账号切换功能。
- 不读取 Cookie、登录令牌、Google 账号配置或聊天数据库。
- 不发送消息，不自动点击订阅或其他业务按钮。
- 不修改 EXE、系统语言、系统代理或系统启动配置。

运行后可能在本机备份目录原子写入 `runtime-status.json`：只含格式版本、工具版本、时间、布尔状态和界面节点计数，不包含 URL、账号、聊天文字或文件路径。诊断文件用于检查注入和已知欢迎页规则，不等于全部界面已验收。

原版 `app.asar` 是 Google 的软件资产，仅在使用者本机备份。**不要将原始包、修改包、EXE、用户配置或真实账号截图提交到公开仓库。** 本仓库仅发布原创翻译引擎、词典、安装/恢复工具和合成测试。

## 已知限制

- 不保证 100% 汉化。服务端新增文案、推荐提问、实验功能、复杂子页面和未知 DOM 区域可能保留英文。
- 头像、任务设置、个人智能、技能和导入记忆页面已增加规则；不代表其中每个说明、子弹窗都已完整验收。跳转到其他 Google 域名的账户、付款和订阅页面不在本工具的注入范围内。
- `Gemini`、`Gems`、`Flash`、`Pro`、`Argon` 等产品或模型名称可保留原文。
- 显示成中文不等于该功能正式支持中文，也不会绕过套餐、地区或语言资格限制。
- 官方更新可能替换补丁，或产生新的不兼容构建；本工具没有后台守护或自动重新注入。
- 未验证长时间聊天、高负载、所有功能弹窗及所有无障碍软件。不应将模拟测试当成这些行为的保证。

## 开发与测试

```powershell
npm run check
npm test
npm run test:browser
```

`test:browser` 默认使用本机已有 Edge，以独立测试配置运行无网络依赖的合成页面，不使用日常浏览器配置。也可用 `EDGE_PATH` 指定已有 Edge 或 Chrome 的可执行文件路径；生成物写入已忽略的 `artifacts/`。自动化结果和真实客户端验证应分别记录。

本机 Edge 未能返回测试页面时，以下命令可改用已安装在此位置的 Chrome；变量只影响当前 PowerShell 会话，不会安装浏览器或修改系统配置：

```powershell
$env:EDGE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:browser
```

- `src/dictionary.json`：精确翻译词条。
- `src/localizer.js`：DOM 范围、内容保护及动态更新规则。
- `src/asar.mjs`：ASAR 读取、重写与哈希检查。
- `src/patcher.mjs`：构建识别、安装和恢复。
- `bin/gemini-zh.mjs`：命令行入口。

欢迎贡献漏翻词条和兼容性报告。提交前请阅读 [贡献指南](CONTRIBUTING.md) 与 [隐私/安全说明](SECURITY.md)。

## 许可与来源

本项目原创代码采用 [MIT License](LICENSE)。Google、Gemini 及其相关名称属于各自权利人；本项目与 Google 没有从属、授权或背书关系。没有复制第三方汉化项目的代码或词典，也不重新分发 Google 客户端代码。

实现格式参考 Electron 的公开文档：[ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives)、[Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)。
