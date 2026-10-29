import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readArchive, replaceArchiveFile, readFuses, sha256 } from './asar.mjs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
export const TOOLKIT_VERSION = JSON.parse(fs.readFileSync(path.join(sourceDir, '../package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(TOOLKIT_VERSION)) throw new Error('工具版本号无效');
export const SUPPORTED_BUILD = Object.freeze({
  version: '1.16.0', main: 'src/main.js',
  mainSha256: '733145c1220bbee12b763ddfa39a0aef49627a84ec3136efac14e5d295243ccc',
  unpackedPackageSha256: '297ef9811636e73fb1a24d77144914da731151d29ecdfa88858d8b9e07d41e28'
});
const startMarker = '/* gemini-windows-zh:begin */';
const endMarker = '/* gemini-windows-zh:end */';

export function localizationSource() {
  const template = fs.readFileSync(path.join(sourceDir, 'localizer.js'), 'utf8');
  const dictionary = JSON.parse(fs.readFileSync(path.join(sourceDir, 'dictionary.json'), 'utf8'));
  const placeholder = '/* GEMINI_ZH_DICTIONARY */ {}';
  if (template.split(placeholder).length !== 2) throw new Error('翻译模板占位符无效');
  for (const [key, value] of Object.entries(dictionary)) if (!key || typeof value !== 'string' || !value.trim()) throw new Error('词典存在无效词条');
  const versionPlaceholder = "/* GEMINI_ZH_VERSION */ 'development'";
  if (template.split(versionPlaceholder).length !== 2) throw new Error('版本模板占位符无效');
  return template.replace(versionPlaceholder, () => JSON.stringify(TOOLKIT_VERSION))
    .replace(placeholder, () => JSON.stringify(dictionary));
}

export function createHook() {
  const payload = JSON.stringify(localizationSource());
  return `
;${startMarker}
(() => {
 const { app, webContents } = require('electron');
 const symbol = Symbol.for('gemini-windows-zh.installed');
 if (globalThis[symbol]) return;
 globalThis[symbol] = true;
 const payload = ${payload};
 const bound = new WeakSet();
 function bind(contents) {
  if (bound.has(contents)) return;
  bound.add(contents);
  const inject = () => {
   if (contents.isDestroyed()) return;
   try {
    const url = new URL(contents.getURL());
    if (url.protocol !== 'https:' || url.hostname !== 'gemini.google.com') return;
    contents.executeJavaScript(payload).catch(() => {});
   } catch {}
  };
  const report = () => setTimeout(async () => { try {
   if (contents.isDestroyed()) return;
   const url = new URL(contents.getURL());
   if (url.protocol !== 'https:' || url.hostname !== 'gemini.google.com') return;
   const stats = await contents.executeJavaScript('globalThis.__geminiWindowsZh?.stats || null');
   if (!stats || typeof stats !== 'object') return;
   const summary = { schema: 1, toolkitVersion: ${JSON.stringify(TOOLKIT_VERSION)}, observedAt: new Date().toISOString() };
   for (const key of ['enabled', 'homeRoute']) summary[key] = stats[key] === true;
   for (const key of ['changes', 'retainedNodes', 'zeroStateContainers', 'welcomeCandidates', 'welcomeEnglish', 'welcomeChinese']) summary[key] = Number.isSafeInteger(stats[key]) && stats[key] >= 0 && stats[key] <= 1000000 ? stats[key] : 0;
   const fs = require('node:fs'), path = require('node:path');
   const directory = path.join(path.dirname(app.getAppPath()), '.gemini-windows-zh');
   const stat = fs.lstatSync(directory);
   if (!stat.isDirectory() || stat.isSymbolicLink()) return;
   const filename = path.join(directory, 'runtime-status.json');
   const temporary = filename + '.' + require('node:crypto').randomUUID() + '.tmp';
   try {
    fs.writeFileSync(temporary, JSON.stringify(summary), { flag: 'wx' });
    fs.renameSync(temporary, filename);
   } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
   }
  } catch {} }, 8000);
  contents.on('did-finish-load', report);
  contents.on('dom-ready', inject);
  contents.on('did-finish-load', inject);
  inject();
 }
 app.on('web-contents-created', (_event, contents) => bind(contents));
 app.whenReady().then(() => webContents.getAllWebContents().forEach(bind)).catch(() => {});
})();
${endMarker}
`;
}


function ensurePlainFile(filename, maximum) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) throw new Error('文件类型或大小不符合预期');
}

function runPowerShell(script, appDir) {
  if (process.platform !== 'win32') throw new Error('安装与恢复仅支持 Windows');
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  // A parent PowerShell 7 session can export an incompatible module path to PS 5.1.
  // Limit this child process to its built-in modules; do not edit the user's environment.
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath'));
  childEnv.PSModulePath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  return execFileSync(shell, ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop';" + script], {
    env: { ...childEnv, GEMINI_ZH_APP_DIR: appDir }, encoding: 'utf8', windowsHide: true, timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

export function verifyGoogleSignature(appDir) {
  const result = runPowerShell("$s=Get-AuthenticodeSignature -LiteralPath (Join-Path $env:GEMINI_ZH_APP_DIR 'Gemini.exe'); if($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -match '(^|, )O=Google LLC(,|$)'){ 'VALID_GOOGLE' } else { 'INVALID' }", appDir);
  return result === 'VALID_GOOGLE';
}

export function assertNotRunning(appDir) {
  const result = runPowerShell("$prefix=[IO.Path]::GetFullPath($env:GEMINI_ZH_APP_DIR).TrimEnd('\\')+'\\';$count=@(Get-Process -Name Gemini -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)}).Count;[string]$count", appDir);
  if (result !== '0') throw new Error('Gemini 正在运行。请使用客户端“文件 → 退出”后重试；工具不会强制结束进程。');
}

export function discoverApp() {
  if (!process.env.LOCALAPPDATA) throw new Error('请通过 --app-dir 指定 app-版本号目录');
  const base = path.join(process.env.LOCALAPPDATA, 'Google', 'Gemini');
  if (!fs.existsSync(base)) throw new Error('没有找到官方 Gemini Windows 安装目录；可通过 --app-dir 指定已安装的版本目录');
  const candidates = fs.readdirSync(base, { withFileTypes: true })
    .filter(item => item.isDirectory() && /^app-\d+\.\d+\.\d+$/.test(item.name))
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  if (!candidates.length) throw new Error('没有找到官方 Gemini Windows 安装目录');
  return path.join(base, candidates[0].name);
}

export function inspectApp(appDir, verifySignature = verifyGoogleSignature) {
  appDir = fs.realpathSync(appDir);
  const resources = path.join(appDir, 'resources');
  if (fs.lstatSync(resources).isSymbolicLink()) throw new Error('不支持重定向的 resources 目录');
  const asarPath = path.join(resources, 'app.asar');
  const executable = path.join(appDir, 'Gemini.exe');
  ensurePlainFile(asarPath, 256 * 1024 * 1024);
  ensurePlainFile(executable, 1024 * 1024 * 1024);
  if (!verifySignature(appDir)) throw new Error('Gemini.exe 的 Google 数字签名无效，拒绝修改');
  const fuses = readFuses(fs.readFileSync(executable));
  if (fuses.embeddedAsarIntegrityValidation) throw new Error('此客户端启用了嵌入式 ASAR 校验，不受支持；工具不会修改 EXE 或关闭校验。');
  const archiveBuffer = fs.readFileSync(asarPath);
  const archive = readArchive(archiveBuffer);
  const pkgEntry = archive.files.get('package.json');
  if (!pkgEntry) throw new Error('缺少 package.json');
  let packageBytes = pkgEntry.data;
  if (pkgEntry.entry.unpacked) {
    const filename = path.join(resources, 'app.asar.unpacked', 'package.json');
    ensurePlainFile(filename, 1024 * 1024);
    packageBytes = fs.readFileSync(filename);
  }
  // This installer build ships an unpacked package.json whose bytes differ from
  // the ASAR index's digest. Pin the observed external file instead of disabling
  // verification or accepting arbitrary package changes.
  if (pkgEntry.entry.unpacked && sha256(packageBytes) !== SUPPORTED_BUILD.unpackedPackageSha256) throw new Error('解包的 package.json 不在兼容清单中');
  const pkg = JSON.parse(packageBytes.toString('utf8'));
  if (pkg.name !== 'gemini' || pkg.version !== SUPPORTED_BUILD.version || pkg.main !== SUPPORTED_BUILD.main) throw new Error('未验证的 Gemini 构建；当前仅支持已登记的 1.16.0 构建');
  const mainEntry = archive.files.get(pkg.main);
  if (!mainEntry?.data) throw new Error('缺少已打包的主程序');
  const mainSource = mainEntry.data.toString('utf8');
  const patched = mainSource.includes(startMarker);
  if (patched) {
    const seam = mainSource.indexOf('\n;' + startMarker);
    if (seam < 0 || sha256(mainSource.slice(0, seam)) !== SUPPORTED_BUILD.mainSha256 || !mainSource.trimEnd().endsWith(endMarker)) throw new Error('补丁的原主程序来源或结构不匹配，拒绝修改');
  }
  if (!patched && sha256(mainEntry.data) !== SUPPORTED_BUILD.mainSha256) throw new Error('主程序哈希不在兼容清单中，拒绝修改未知构建');
  return { appDir, asarPath, archiveBuffer, archiveHash: sha256(archiveBuffer), mainSource, version: pkg.version, patched, fuses };
}

function statePaths(info) {
  const root = path.join(info.appDir, 'resources', '.gemini-windows-zh');
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw new Error('备份目录不能是链接');
  return { root, original: path.join(root, 'app.asar.original'), manifest: path.join(root, 'state.json') };
}

function atomicWrite(filename, bytes) {
  const temporary = filename + '.gemini-zh-' + randomUUID() + '.tmp';
  try { fs.writeFileSync(temporary, bytes, { flag: 'wx' }); fs.renameSync(temporary, filename); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function readState(info) {
  const paths = statePaths(info);
  if (!fs.existsSync(paths.manifest)) return null;
  ensurePlainFile(paths.manifest, 32 * 1024);
  const state = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
  if (!state || state.schema !== 1 || state.version !== info.version || state.main !== SUPPORTED_BUILD.main || !/^[a-f0-9]{64}$/.test(state.originalHash) || !/^[a-f0-9]{64}$/.test(state.patchedHash)) throw new Error('备份状态记录无效');
  return state;
}

export function readBackupStatus(info, state = readState(info)) {
  const paths = statePaths(info);
  const result = { statePresent: Boolean(state), backupDirectoryPresent: fs.existsSync(paths.root), backupPresent: false, backupValid: false, backupIssue: null };
  try {
    const stat = fs.lstatSync(paths.original);
    result.backupPresent = true;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024 * 1024) result.backupIssue = 'invalid-file';
    else if (!state) result.backupIssue = 'unregistered';
    else if (sha256(fs.readFileSync(paths.original)) !== state.originalHash) result.backupIssue = 'hash-mismatch';
    else result.backupValid = true;
  } catch (error) {
    result.backupIssue = error.code === 'ENOENT' ? (state ? 'missing' : (result.backupDirectoryPresent ? 'incomplete-directory' : null)) : 'unreadable';
  }
  return result;
}

export function readRuntimeStatus(info) {
  const filename = path.join(statePaths(info).root, 'runtime-status.json');
  let raw;
  try {
    ensurePlainFile(filename, 8192);
    raw = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    return error.code === 'ENOENT' ? null : { available: false, reason: 'unreadable-or-invalid' };
  }
  if (!raw || raw.schema !== 1) return { available: false, reason: 'unsupported-schema' };
  const result = { available: true, schema: 1 };
  if (typeof raw.toolkitVersion === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(raw.toolkitVersion)) result.toolkitVersion = raw.toolkitVersion;
  for (const key of ['enabled', 'homeRoute']) result[key] = raw[key] === true;
  for (const key of ['changes', 'retainedNodes', 'zeroStateContainers', 'welcomeCandidates', 'welcomeEnglish', 'welcomeChinese']) result[key] = Number.isSafeInteger(raw[key]) && raw[key] >= 0 && raw[key] <= 1000000 ? raw[key] : 0;
  if (typeof raw.observedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.observedAt)) result.observedAt = raw.observedAt;
  return result;
}

export function install(appDir, options = {}) {
  const info = inspectApp(appDir, options.verifySignature);
  const paths = statePaths(info);
  const state = readState(info);
  if (state && info.patched && state.patchedHash === info.archiveHash) {
    if (!readBackupStatus(info, state).backupValid) throw new Error('补丁存在，但原始备份缺失或不可用；请保留现有文件并参阅 docs/RECOVERY.md');
    if (!info.mainSource.endsWith(createHook())) throw new Error('本地工具代码已有更新，请先 restore，再 install；原始备份不会被覆盖。');
    return { action: 'already-installed', version: info.version, sha256: info.archiveHash };
  }
  if (state || info.patched) throw new Error('存在旧备份或其他补丁状态，请先核对并恢复；不会覆盖现有备份。');
  if (fs.existsSync(paths.root)) throw new Error('检测到未完成或已有内容的备份目录，已停止安装。请保留该目录并按照 docs/RECOVERY.md 核对，不会自动覆盖或删除。');
  (options.assertNotRunning || assertNotRunning)(info.appDir);
  const next = replaceArchiveFile(info.archiveBuffer, SUPPORTED_BUILD.main, info.mainSource + createHook());
  fs.mkdirSync(paths.root, { recursive: false });
  fs.writeFileSync(paths.original, info.archiveBuffer, { flag: 'wx' });
  if (sha256(fs.readFileSync(paths.original)) !== info.archiveHash) throw new Error('原始备份写入校验失败；客户端未修改，备份现场保留');
  const manifest = { schema: 1, toolkitVersion: TOOLKIT_VERSION, version: info.version, main: SUPPORTED_BUILD.main, originalHash: info.archiveHash, patchedHash: sha256(next), createdAt: new Date().toISOString() };
  fs.writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  const stored = readState(info);
  if (stored.originalHash !== manifest.originalHash || stored.patchedHash !== manifest.patchedHash) throw new Error('备份状态写入校验失败；客户端未修改');
  // Check again immediately before replacing the original resource package.
  if (sha256(fs.readFileSync(info.asarPath)) !== info.archiveHash) throw new Error('客户端文件已变化，安装已停止，原始备份保留');
  atomicWrite(info.asarPath, next);
  if (sha256(fs.readFileSync(info.asarPath)) !== manifest.patchedHash) throw new Error('写入后的校验失败，请执行 restore');
  return { action: 'installed', version: info.version, originalSha256: manifest.originalHash, patchedSha256: manifest.patchedHash };
}

export function restore(appDir, options = {}) {
  const info = inspectApp(appDir, options.verifySignature);
  const paths = statePaths(info);
  const state = readState(info);
  if (!state) {
    if (info.patched) throw new Error('补丁存在但缺少本工具备份，拒绝猜测恢复内容');
    return { action: 'already-original', version: info.version, backupDirectoryRetained: fs.existsSync(paths.root) };
  }
  if (info.archiveHash !== state.patchedHash && info.archiveHash !== state.originalHash) throw new Error('当前资源包有其他改动，拒绝覆盖');
  (options.assertNotRunning || assertNotRunning)(info.appDir);
  ensurePlainFile(paths.original, 256 * 1024 * 1024);
  const original = fs.readFileSync(paths.original);
  if (sha256(original) !== state.originalHash) throw new Error('原始备份哈希不匹配，拒绝恢复');
  readArchive(original);
  if (sha256(fs.readFileSync(info.asarPath)) !== info.archiveHash) throw new Error('客户端文件已变化，恢复已停止，现有改动和备份均保留');
  atomicWrite(info.asarPath, original);
  if (sha256(fs.readFileSync(info.asarPath)) !== state.originalHash) throw new Error('恢复后的哈希校验失败');
  const runtime = path.join(paths.root, 'runtime-status.json');
  if (fs.existsSync(runtime)) { ensurePlainFile(runtime, 8192); fs.unlinkSync(runtime); }
  fs.unlinkSync(paths.manifest);
  fs.unlinkSync(paths.original);
  const retained = fs.readdirSync(paths.root).length !== 0;
  if (!retained) fs.rmdirSync(paths.root);
  return { action: 'restored', version: info.version, sha256: state.originalHash, backupDirectoryRetained: retained };
}
