#!/usr/bin/env node
import { discoverApp, inspectApp, install, restore, readState, readBackupStatus, readRuntimeStatus, TOOLKIT_VERSION } from '../src/patcher.mjs';

const args = process.argv.slice(2);
const command = args.shift() || 'help';
let appDir;
let json = false;
try {
  while (args.length) {
    const flag = args.shift();
    if (flag === '--app-dir') { appDir = args.shift(); if (!appDir) throw new Error('--app-dir 缺少目录'); }
    else if (flag === '--json') json = true;
    else throw new Error('未知参数：' + flag);
  }
  if (['help', '--help', '-h'].includes(command)) {
    console.log(`Gemini Windows ZH ${TOOLKIT_VERSION}\n\n仅支持已验证的官方 Windows 1.16.0 构建。需要 Node.js 20+。\n\nnode bin/gemini-zh.mjs diagnose  检查兼容性与状态\nnode bin/gemini-zh.mjs install   备份并安装中文 UI 补丁\nnode bin/gemini-zh.mjs restore   校验备份后恢复官方资源包\nnode bin/gemini-zh.mjs status    查看补丁状态\n\n可选：--app-dir "...\\Google\\Gemini\\app-1.16.0"  --json\n\n安装/恢复前请在 Gemini 中选择“文件 → 退出”。不需要管理员权限。`);
  } else {
    if (!['diagnose', 'install', 'restore', 'status'].includes(command)) throw new Error('未知命令：' + command);
    appDir ||= discoverApp();
    let result;
    if (command === 'install') result = install(appDir);
    else if (command === 'restore') result = restore(appDir);
    else {
      const info = inspectApp(appDir);
      const state = readState(info);
      result = { toolkitVersion: TOOLKIT_VERSION, version: info.version, compatible: true, googleSignature: 'valid', patched: info.patched, ...readBackupStatus(info, state), stateMatches: state ? info.archiveHash === state.patchedHash : !info.patched, asarSha256: info.archiveHash, runtime: info.patched ? readRuntimeStatus(info) : null, ...info.fuses };
    }
    console.log(JSON.stringify(result, null, json ? 0 : 2));
  }
} catch (error) {
  const message = error.message || String(error);
  // Do not include native stack traces or child-process output in a public diagnostic.
  console.error(json ? JSON.stringify({ ok: false, error: message }) : '失败：' + message);
  process.exitCode = 1;
}
