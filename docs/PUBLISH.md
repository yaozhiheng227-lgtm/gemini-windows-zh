# 发布到自己的 GitHub

项目建议名称：`gemini-windows-zh`。

建议简介：

> Gemini Windows 指定构建的非官方简体中文界面补丁，提供兼容性检查、备份与恢复。当前为实验版，仍有部分界面未覆盖。

建议标签：`gemini`、`windows`、`localization`、`chinese`、`electron`。

## 发布前检查

阅读 README 的兼容范围与已知限制，确认你接受当前 MIT 许可证。项目中的版权署名采用通用的 `Gemini Windows ZH contributors`，你可以按自己的实际署名维护。

源码包不应包含 Google EXE、ASAR、备份文件、真实账号截图、浏览器配置、密钥或日志。GitHub Actions 配置已提供，但远程 CI 需要推送后才能实际验证，不能在发布说明中预先声称已通过 GitHub CI。

上传的是本项目目录内的源码，README.md、package.json 和 .github 应位于仓库根目录；不要上传整个 Codex 工作区。ZIP 作为 Release 附件，不代替仓库中的源码。保留隐藏的 .github 和 .gitignore 文件。

从源码包解压到新目录后，按 README 运行 `npm run check`、`npm test`、`npm run test:browser` 和只读 `diagnose`。测试没有 npm 依赖，无需 `npm install`。没有本机受支持客户端资源时，4 项相关测试会明确跳过，应记录为跳过。浏览器测试默认用 Edge，也可按 README 指定已有 Chrome。

安装和恢复会修改客户端资源，应完全退出客户端后进行；自动化临时夹具测试不能代替真实安装和恢复验收。不要为了发布检查，反复改动已正常工作的客户端。

## 使用 Git 发布

在 GitHub 创建空的公开仓库，仓库名使用 `gemini-windows-zh`。不要添加第二份自动生成的 README 或 LICENSE。

本地项目尚未初始化 Git 时先运行：

```powershell
git init -b main
git add .
```

检查暂存内容，再提交并推送：

```powershell
git status --short
git diff --cached --stat
git commit -m "Initial experimental Chinese UI localizer"
git remote add origin https://github.com/YOUR_USERNAME/gemini-windows-zh.git
git push -u origin main
```

`YOUR_USERNAME` 必须替换成你自己的 GitHub 用户名。如果已经存在 `origin`，先检查它是否是你要发布的仓库，不要盲目覆盖。Git 登录和验证直接通过 GitHub/Git 完成，不把令牌写进源码或 URL。

当前 Release 可使用标签 `v0.1.3`，并明确标记为实验版。Release 仅附源码工具，不附官方客户端资源。发布说明应引用 [验证记录](VALIDATION.md)、[审查修复记录](REVIEW_FIXES.md) 和 [使用流程检查](USER_FLOW_AUDIT.md)，保留未验证项和漏翻限制。

## 推送后到发布下载版

1. 查看 Actions 中 `Checks` 的全部矩阵任务和跳过项；失败时先修复，不能仅凭某一个任务成功就宣称 CI 通过。
2. 当前工作流的两个外部 Action 已固定到完整提交 SHA，并保留版本注释；更新时重新核实来源和提交。浏览器任务仍需远程实际运行。
3. 创建 Release 草稿，使用已验证提交对应的 `v0.1.3` 标签，勾选 **This is a pre-release**。
4. 复制 [v0.1.3 发布说明](RELEASE-v0.1.3.md)，根据真实远程结果更新 CI 状态，并附源码 ZIP 与对应 SHA-256 校验文件。
5. 检查下载包与发布标签内容一致，再发布。以后修复使用新版本和新标签，不悄悄替换已发布版本的代码或附件。

GitHub 操作参考：[管理仓库中的发布](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)。
