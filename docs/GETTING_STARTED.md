# 新手安装与常见问题

[返回首页](../README.md) · [下载 v0.1.3](https://github.com/yaozhiheng227-lgtm/gemini-windows-zh/releases/tag/v0.1.3) · [反馈问题](https://github.com/yaozhiheng227-lgtm/gemini-windows-zh/issues/new?template=bug_report.md)

本页适用于 v0.1.3 实验版。它是已登记 Gemini Windows 1.16.0 x64 构建的界面补丁，不包含 Gemini 客户端，不是浏览器扩展。版本号相同还需通过文件指纹检查。

## 选哪个下载文件

在 Release 页找到 **Assets**，选择 `gemini-windows-zh-v0.1.3.zip`。旁边的 `.zip.sha256` 是校验文件，不是安装程序。GitHub 自动生成的 `Source code` 包和绿色 Code 按钮主要用于获取源码；首次使用建议选择上面这个明确命名的 ZIP。

右键 ZIP → **全部解压**，打开包含 `安装中文.cmd`、`检查状态.cmd`、`恢复原版.cmd`、`package.json`、`bin` 和 `src` 的目录。不要只下载一个 CMD，也不要在压缩包内直接双击；入口需要同目录下的源码文件。

不需要注册新账号、提供 API Key、安装 npm 依赖或购买本补丁。Gemini 自身的账号和套餐要求仍按 Google 的规则执行。

## 确认 Node.js 已准备好

在 Windows 终端或 PowerShell 运行：

```powershell
node --version
```

应显示 `v20` 或更高版本。新安装可到 [Node.js 官方下载页](https://nodejs.org/zh-cn/download)，选择已验证主版本的 **24 LTS、Windows、x64 安装程序**，按官方步骤安装后重新打开终端。本补丁不会替你安装 Node.js，也无需为使用补丁运行 `npm install`。

若出现 `Node.js 20+ is required. Please read README.md.`，说明 CMD 没找到 Node.js；这一步会停止，尚未修改客户端。已经安装但仍报错时，关闭并重新打开终端，再检查 `node --version`。

## 检查、安装与确认效果

1. 双击 `检查状态.cmd`，先看有没有以“失败：”开头的错误。
2. 检查兼容性通过后，在 Gemini 顶部主菜单选择 **文件 → 退出**。仅关窗口可能仍在后台运行；安装器不会强行结束进程。
3. 双击 `安装中文.cmd`，读取结果后按任意键关闭命令窗口。安装成功返回 `"action": "installed"`；相同补丁已安装则返回 `already-installed`。
4. 从原来的 Gemini 快捷方式启动客户端。查看导航、“搜索对话”和“收起侧边栏”等固定控件；部分未覆盖文案仍可能是英文。
5. 再运行 `检查状态.cmd`，确认补丁和备份状态。显示状态与真实页面效果是两项检查，不能相互代替。

### 状态输出怎么看

输出目前是 JSON，`true` 表示是，`false` 表示否，`null` 表示没有该记录或问题。先看自己处于安装前还是安装后。

| 看到的字段或结果 | 含义与下一步 |
| --- | --- |
| `compatible: true`、`googleSignature: "valid"` | 当前构建和 Google 签名检查通过 |
| 首次安装前：`patched: false`、`statePresent: false`、`backupDirectoryPresent: false`、`backupIssue: null` | 尚未安装本补丁，也没有残留备份目录；此时 `backupPresent: false`、`backupValid: false` 正常 |
| 安装后：`patched: true`、`statePresent: true`、`backupValid: true`、`stateMatches: true` | 补丁与清单匹配且原版备份有效；下一步检查真实界面 |
| `backupPresent: true` 但 `backupValid: false` | 仅表示文件存在，不能认为可安全恢复；看 `backupIssue` 并阅读 [恢复说明](RECOVERY.md) |
| `backupDirectoryPresent: true` 但没有状态清单 | 可能是残留或未完成的备份，先核对，不删除目录强行重装 |
| `runtime: null` 或 `runtime.available: false` | 没有可用运行时记录，不等于补丁已关闭，也不等于备份损坏 |
| 有 `observedAt` 时间 | 是那次诊断记录的时间，不保证是当前界面；旧记录不能证明本次显示正常 |
| `"action": "restored"` | 校验恢复完成，可以重新启动 Gemini |
| `"action": "already-original"` | 当前识别为原版；若同时 `backupDirectoryRetained: true`，还有保留的目录需要核对 |

### 不用双击，改用 PowerShell

在解压目录的资源管理器地址栏输入 `powershell` 并回车，可以在该目录打开终端，然后运行：

```powershell
node bin/gemini-zh.mjs diagnose
```

完全退出 Gemini 后再运行：

```powershell
node bin/gemini-zh.mjs install
```

`status` 也只读取状态，不执行安装。安装和恢复没有“忽略签名”“强制兼容”等参数。

## 非默认安装目录

默认检查当前 Windows 用户的 `%LOCALAPPDATA%\Google\Gemini`。自定义安装位置时，传入**实际版本目录**，不是快捷方式、上一级 Gemini 文件夹或 `resources` 文件夹。

下面只是目录格式示例，必须替换成你电脑上的真实路径；三个命令分阶段运行，不要整段一次执行：

```powershell
# 只读检查
node bin/gemini-zh.mjs diagnose --app-dir "D:\Apps\Gemini\app-1.16.0"
# 检查通过并退出客户端后安装
node bin/gemini-zh.mjs install --app-dir "D:\Apps\Gemini\app-1.16.0"
# 以后需要恢复时，退出客户端再执行
node bin/gemini-zh.mjs restore --app-dir "D:\Apps\Gemini\app-1.16.0"
```

双击 CMD 不会传入这个自定义路径；使用自定义目录时，后续安装、状态检查和恢复都应带相同的 `--app-dir`。

## 恢复和更新

**恢复原版：** 完全退出 Gemini，使用当前补丁工具目录中的 `恢复原版.cmd`，或运行 `node bin/gemini-zh.mjs restore`。成功后再打开 Gemini。仅删除下载目录不会移除已经写入客户端的补丁。

**更新补丁：** 保留旧工具及客户端备份，先退出 Gemini；在旧工具的解压目录运行恢复命令，确认 `restored` 后，再进入新工具目录检查并安装。不同版本使用不同解压目录，便于区分。当前仅文档更新时不需要重装补丁。

备份位于客户端版本目录下的 `resources/.gemini-windows-zh`，不在本工具解压目录。不要清理这个目录来解决安装失败。恢复要求构建、签名和备份有效；客户端已更新或备份损坏时可能拒绝恢复，按 [异常恢复说明](RECOVERY.md) 处理。

## 常见问题

| 现象或报错 | 先做什么 |
| --- | --- |
| 下载后没有 EXE | 正常，这是源码补丁；完整解压后使用 CMD 入口，需要已有 Node.js |
| 找不到安装目录 | 确认安装的是 Windows 客户端，而不是浏览器/PWA；自定义目录按上节指定；本补丁不下载安装 Gemini |
| `ENOENT`、`lstat` 或找不到指定路径 | 检查 `--app-dir` 是否真实存在、是否指向版本目录；路径中有空格时保留引号 |
| `Cannot find module` 或缺少 `bin` / `src` | 重新完整解压；不要只复制 CMD，也不要在错误的工作目录运行相对命令 |
| Gemini 正在运行 | 使用“文件 → 退出”后重试，不通过强制结束进程绕过 |
| 哈希不匹配、版本不支持、签名无效或 ASAR 校验不支持 | 停止安装；不要修改校验规则、下载来源不明的旧客户端或把旧 ASAR 覆盖到新版 |
| 检测到旧补丁或备份目录 | 保留备份，按 [恢复说明](RECOVERY.md) 核对，不删除后重试 |
| `Access denied`、`EPERM` 或 `EACCES` | 确认目录可访问、客户端已退出；查看系统或安全软件的拦截记录。不要关闭安全防护或盲目提升权限 |
| 状态正常但仍有英文 | 确认完全退出并重新启动；品牌、模型名和用户内容会保留原文，动态文案可能尚未覆盖；固定控件漏翻可反馈 |
| 聊天正文、标题、代码或输入被改写显示 | 停止使用，退出客户端后尝试校验恢复；用合成文本描述误译，不上传真实内容 |
| Windows 对下载文件发出提示 | 先确认来源、核对附件哈希和阅读代码说明；不确定时停止，不关闭 SmartScreen 或其他安全防护 |

## 校验下载文件（可选）

从同一个 Release 下载 `.zip.sha256`。在 ZIP 所在目录运行：

```powershell
Get-FileHash -LiteralPath .\gemini-windows-zh-v0.1.3.zip -Algorithm SHA256
Get-Content -LiteralPath .\gemini-windows-zh-v0.1.3.zip.sha256
```

比较两者的 64 位哈希，大小写不影响比较。哈希用于核对下载内容，不是数字签名或 Google 认证。

## 反馈时带什么

使用 [问题模板](https://github.com/yaozhiheng227-lgtm/gemini-windows-zh/issues/new?template=bug_report.md)，写清 Windows / Gemini / 补丁 / Node.js 版本、从哪个页面开始、哪个控件有问题、实际和预期结果。需要登录 GitHub 才能提交 Issue；下载公开 ZIP 无需登录。

只附脱敏的局部截图或错误摘要，遮盖邮箱、用户名、路径、聊天列表和正文。不要上传完整日志、Cookie、令牌、EXE、ASAR 或备份。敏感安全问题按 [安全说明](../SECURITY.md) 处理。
