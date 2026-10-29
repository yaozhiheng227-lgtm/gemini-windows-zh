import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHook, inspectApp, install, restore, localizationSource, readState, readBackupStatus, readRuntimeStatus, SUPPORTED_BUILD, TOOLKIT_VERSION } from '../src/patcher.mjs';
import { readArchive, replaceArchiveFile, sha256 } from '../src/asar.mjs';
import { fixtureArchive, fixtureExecutable } from './fixtures.mjs';

function fixture(t, executable = fixtureExecutable()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-zh-test-'));
  t.after(() => {
    if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('gemini-zh-test-')) throw new Error('Unsafe test cleanup path');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(dir, 'resources'));
  fs.writeFileSync(path.join(dir, 'resources/app.asar'), fixtureArchive());
  fs.writeFileSync(path.join(dir, 'Gemini.exe'), executable);
  return dir;
}

test('rejects untrusted signatures before creating a backup', t => {
  const dir = fixture(t);
  assert.throws(() => install(dir, { verifySignature: () => false }), /签名/);
  assert.equal(fs.existsSync(path.join(dir, 'resources/.gemini-windows-zh')), false);
});

test('rejects ASAR validation builds instead of modifying EXE', t => {
  const dir = fixture(t, fixtureExecutable({ integrity: true }));
  assert.throws(() => inspectApp(dir, () => true), /嵌入式 ASAR/);
});

test('rejects an unknown main hash even for the same version', t => {
  const dir = fixture(t);
  const before = fs.readFileSync(path.join(dir, 'resources/app.asar'));
  assert.throws(() => install(dir, { verifySignature: () => true }), /哈希/);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'resources/app.asar')), before);
  assert.equal(fs.existsSync(path.join(dir, 'resources/.gemini-windows-zh')), false);
});

test('hook is syntactically valid, host-scoped and idempotent', async () => {
  const hook = createHook();
  new vm.Script(hook);
  new vm.Script(localizationSource());
  const listeners = new Map();
  const injections = [];
  const contents = url => ({ isDestroyed: () => false, getURL: () => url, on() {}, executeJavaScript: code => { injections.push(code); return Promise.resolve(); } });
  const electron = {
    app: { on: (name, fn) => listeners.set(name, fn), whenReady: () => Promise.resolve() },
    webContents: { getAllWebContents: () => [contents('https://accounts.google.com/'), contents('https://gemini.google.com/app')] }
  };
  const context = vm.createContext({ require: id => { assert.equal(id, 'electron'); return electron; }, URL, Symbol, WeakSet, setTimeout: () => 0 });
  vm.runInContext(hook, context);
  vm.runInContext(hook, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(injections.length, 1);
  listeners.get('web-contents-created')(null, contents('https://gemini.google.com.evil.example/app'));
  assert.equal(injections.length, 1);
});

test('restore without registered backup never fabricates original resources', t => {
  const dir = fixture(t);
  assert.throws(() => restore(dir, { verifySignature: () => true }), /哈希/);
});

test('runtime diagnostics export only predefined counts and booleans', t => {
  const dir = fixture(t);
  const backup = path.join(dir, 'resources/.gemini-windows-zh');
  fs.mkdirSync(backup);
  fs.writeFileSync(path.join(backup, 'runtime-status.json'), JSON.stringify({ schema: 1, enabled: true, homeRoute: false, changes: 'not-a-number', retainedNodes: 5, welcomeChinese: 1, account: 'must-not-export', url: 'must-not-export', observedAt: 'not-a-date' }));
  const report = readRuntimeStatus({ appDir: dir });
  assert.equal(report.enabled, true);
  assert.equal(report.changes, 0);
  assert.equal(report.retainedNodes, 5);
  assert.equal(report.welcomeChinese, 1);
  assert.equal(JSON.stringify(report).includes('must-not-export'), false);
  assert.equal('observedAt' in report, false);
});

test('a marker alone cannot make unknown main code a supported build', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'resources/app.asar'), fixtureArchive('/* gemini-windows-zh:begin */\nconsole.log("unknown");'));
  assert.throws(() => inspectApp(dir, () => true), /主程序|补丁/);
});

// Optional local integration tests: read only Google application resources,
// never a profile. Vendor bytes are kept in temporary fixtures, not this repo.
function knownBuildFixture(t) {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) { t.skip('Requires a locally installed supported Windows build'); return null; }
  const app = path.join(process.env.LOCALAPPDATA, 'Google/Gemini/app-1.16.0');
  const resources = path.join(app, 'resources');
  const backup = path.join(resources, '.gemini-windows-zh/app.asar.original');
  const source = fs.existsSync(backup) ? backup : path.join(resources, 'app.asar');
  if (!fs.existsSync(source)) { t.skip('Supported application resources are not installed'); return null; }
  let bytes, archive, packageBytes;
  try {
    bytes = fs.readFileSync(source);
    archive = readArchive(bytes);
    packageBytes = fs.readFileSync(path.join(resources, 'app.asar.unpacked/package.json'));
  } catch {
    t.skip('Local fixture unavailable: original archive or unpacked package cannot be read/validated'); return null;
  }
  if (sha256(archive.files.get(SUPPORTED_BUILD.main)?.data || '') !== SUPPORTED_BUILD.mainSha256) { t.skip('Local resources are not the supported original build'); return null; }
  if (sha256(packageBytes) !== SUPPORTED_BUILD.unpackedPackageSha256) { t.skip('Local unpacked package is not the supported build'); return null; }
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'resources/app.asar'), bytes);
  fs.mkdirSync(path.join(dir, 'resources/app.asar.unpacked'));
  fs.writeFileSync(path.join(dir, 'resources/app.asar.unpacked/package.json'), packageBytes);
  return { dir, bytes };
}
const isolatedOptions = { verifySignature: () => true, assertNotRunning: () => {} };

test('local resource fixture: install, repeat install, restore preserve every original byte', t => {
  const item = knownBuildFixture(t); if (!item) return;
  const { dir, bytes } = item;
  const executable = fs.readFileSync(path.join(dir, 'Gemini.exe'));
  assert.equal(install(dir, isolatedOptions).action, 'installed');
  assert.equal(install(dir, isolatedOptions).action, 'already-installed');
  assert.equal(restore(dir, isolatedOptions).action, 'restored');
  assert.deepEqual(fs.readFileSync(path.join(dir, 'resources/app.asar')), bytes);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'Gemini.exe')), executable);
  assert.equal(restore(dir, isolatedOptions).action, 'already-original');
});

test('local resource fixture: corrupt backup is rejected without changing current resources', t => {
  const item = knownBuildFixture(t); if (!item) return;
  install(item.dir, isolatedOptions);
  const asar = path.join(item.dir, 'resources/app.asar');
  const before = fs.readFileSync(asar);
  fs.appendFileSync(path.join(item.dir, 'resources/.gemini-windows-zh/app.asar.original'), 'damaged');
  assert.throws(() => install(item.dir, isolatedOptions), /备份缺失或不可用/);
  assert.throws(() => restore(item.dir, isolatedOptions), /备份哈希/);
  assert.deepEqual(fs.readFileSync(asar), before);
});

test('local resource fixture: restore refuses a change made after inspection', t => {
  const item = knownBuildFixture(t); if (!item) return;
  install(item.dir, isolatedOptions);
  const asar = path.join(item.dir, 'resources/app.asar');
  const current = fs.readFileSync(asar);
  const other = [...readArchive(current).files].find(([name, file]) => file.data && name !== SUPPORTED_BUILD.main);
  const concurrent = replaceArchiveFile(current, other[0], Buffer.concat([other[1].data, Buffer.from('\n') ]));
  assert.throws(() => restore(item.dir, { ...isolatedOptions, assertNotRunning: () => fs.writeFileSync(asar, concurrent) }), /文件已变化|其他改动/);
  assert.deepEqual(fs.readFileSync(asar), concurrent);
});

test('local resource fixture: incomplete backup directory is preserved with an actionable error', t => {
  const item = knownBuildFixture(t); if (!item) return;
  const root = path.join(item.dir, 'resources/.gemini-windows-zh');
  fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'app.asar.original'), 'partial');
  assert.throws(() => install(item.dir, isolatedOptions), /未完成|备份目录/);
  assert.equal(fs.readFileSync(path.join(root, 'app.asar.original'), 'utf8'), 'partial');
  assert.deepEqual(fs.readFileSync(path.join(item.dir, 'resources/app.asar')), item.bytes);
  assert.equal(restore(item.dir, isolatedOptions).backupDirectoryRetained, true);
});

test('backup status distinguishes a manifest, missing file, corruption and valid bytes', t => {
  const dir = fixture(t), info = { appDir: dir, version: SUPPORTED_BUILD.version };
  const root = path.join(dir, 'resources/.gemini-windows-zh'); fs.mkdirSync(root);
  const original = fs.readFileSync(path.join(dir, 'resources/app.asar'));
  const state = { schema: 1, version: info.version, main: SUPPORTED_BUILD.main, originalHash: sha256(original), patchedHash: sha256(original) };
  fs.writeFileSync(path.join(root, 'state.json'), JSON.stringify(state));
  assert.equal(readState(info).originalHash, state.originalHash);
  assert.deepEqual(readBackupStatus(info), { statePresent: true, backupDirectoryPresent: true, backupPresent: false, backupValid: false, backupIssue: 'missing' });
  fs.writeFileSync(path.join(root, 'app.asar.original'), 'damaged');
  assert.equal(readBackupStatus(info).backupIssue, 'hash-mismatch');
  fs.writeFileSync(path.join(root, 'app.asar.original'), original);
  assert.equal(readBackupStatus(info).backupValid, true);
  fs.unlinkSync(path.join(root, 'state.json'));
  assert.equal(readBackupStatus(info).backupIssue, 'unregistered');
  assert.equal(readBackupStatus(info).backupValid, false);
});

test('malformed runtime diagnostics degrade without claiming translation is disabled', t => {
  const dir = fixture(t), info = { appDir: dir };
  const root = path.join(dir, 'resources/.gemini-windows-zh'); fs.mkdirSync(root);
  assert.equal(readRuntimeStatus(info), null);
  for (const content of ['{"schema":', 'null', '{"schema":2}']) {
    fs.writeFileSync(path.join(root, 'runtime-status.json'), content);
    const result = readRuntimeStatus(info);
    assert.equal(result.available, false);
    assert.equal('enabled' in result, false);
    assert.equal(JSON.stringify(result).includes(dir), false);
  }
});

test('dictionary dollar patterns survive source generation and compile', async t => {
  const dir = fixture(t), source = path.join(dir, 'src'); fs.mkdirSync(source);
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const name of ['patcher.mjs', 'asar.mjs', 'localizer.js']) fs.copyFileSync(path.join(root, 'src', name), path.join(source, name));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(dir, 'package.json'));
  const dictionary = { Save: "金额 $$ $& $' $` $200", 'Version probe': "/* GEMINI_ZH_VERSION */ 'development'" };
  fs.writeFileSync(path.join(source, 'dictionary.json'), JSON.stringify(dictionary));
  const copy = await import(pathToFileURL(path.join(source, 'patcher.mjs')).href);
  const generated = copy.localizationSource();
  assert.ok(generated.includes('const dictionary = ' + JSON.stringify(dictionary) + ';'));
  assert.ok(generated.includes('const version = ' + JSON.stringify(TOOLKIT_VERSION) + ';'));
  new vm.Script(generated); new vm.Script(copy.createHook());
});

test('runtime hook atomically replaces diagnostics and preserves old data on rename failure', async t => {
  const dir = fixture(t), root = path.join(dir, 'resources/.gemini-windows-zh'); fs.mkdirSync(root);
  const filename = path.join(root, 'runtime-status.json');
  const previous = JSON.stringify({ schema: 1, enabled: false, changes: 7 });
  for (const failRename of [false, true]) {
    fs.writeFileSync(filename, previous);
    const events = new Map(), timers = [], seen = [];
    const contents = { isDestroyed: () => false, getURL: () => 'https://gemini.google.com/app', on: (name, fn) => events.set(name, [...(events.get(name) || []), fn]), executeJavaScript: async code => code.startsWith('globalThis.') ? { enabled: true, changes: 12, account: 'must-not-export' } : undefined };
    const fakeFs = { ...fs,
      writeFileSync(file, bytes, options) { assert.notEqual(file, filename); assert.equal(options.flag, 'wx'); fs.writeFileSync(file, bytes, options); seen.push(JSON.parse(fs.readFileSync(filename, 'utf8'))); },
      renameSync(from, to) { if (failRename) throw new Error('simulated rename failure'); fs.renameSync(from, to); }
    };
    const electron = { app: { on() {}, getAppPath: () => path.join(dir, 'resources/app.asar'), whenReady: async () => {} }, webContents: { getAllWebContents: () => [contents] } };
    const dependencies = { electron, 'node:fs': fakeFs, 'node:path': path, 'node:crypto': { randomUUID: () => 'synthetic-test' } };
    vm.runInNewContext(createHook(), { require: name => { assert.ok(name in dependencies); return dependencies[name]; }, URL, Symbol, WeakSet, setTimeout: fn => timers.push(fn) });
    await new Promise(resolve => setImmediate(resolve));
    for (const listener of events.get('did-finish-load')) listener();
    await timers[0]();
    assert.equal(seen[0].changes, 7);
    const final = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(final.changes, failRename ? 7 : 12);
    if (!failRename) assert.equal(final.toolkitVersion, TOOLKIT_VERSION);
    assert.equal('account' in final, false);
    assert.deepEqual(fs.readdirSync(root), ['runtime-status.json']);
  }
});
