import test from 'node:test';
import assert from 'node:assert/strict';
import { readArchive, replaceArchiveFile, readFuses, sha256 } from '../src/asar.mjs';
import { fixtureArchive, fixtureExecutable } from './fixtures.mjs';

test('rewriting main preserves binary payloads and unpacked metadata', () => {
  const original = fixtureArchive();
  const before = readArchive(original);
  const replacement = Buffer.from('/* 简体中文 */\nconsole.log("changed");');
  const result = replaceArchiveFile(original, 'src/main.js', replacement);
  const after = readArchive(result);
  assert.deepEqual(after.files.get('src/main.js').data, replacement);
  assert.deepEqual(after.files.get('asset.bin').data, before.files.get('asset.bin').data);
  assert.deepEqual(after.files.get('package.json').data, before.files.get('package.json').data);
  assert.deepEqual(after.files.get('external.node').entry, before.files.get('external.node').entry);
  assert.equal(after.files.get('src/main.js').entry.integrity.hash, sha256(replacement));
  assert.notDeepEqual(result, original);
});

test('rejects truncated archives and corrupt main contents', () => {
  const original = fixtureArchive();
  assert.throws(() => readArchive(original.subarray(0, 15)));
  const damaged = Buffer.from(original);
  damaged[damaged.length - 10] ^= 1;
  assert.throws(() => readArchive(damaged), /哈希/);
  assert.throws(() => replaceArchiveFile(original, 'external.node', 'no'), /ASAR 内/);
});

test('reads integrity fuse without changing the executable', () => {
  const executable = fixtureExecutable();
  const hash = sha256(executable);
  assert.equal(readFuses(executable).embeddedAsarIntegrityValidation, false);
  assert.equal(readFuses(fixtureExecutable({ integrity: true })).embeddedAsarIntegrityValidation, true);
  assert.equal(sha256(executable), hash);
  assert.throws(() => readFuses(Buffer.from('unknown')), /可执行文件/);
  const arm = Buffer.from(executable); arm.writeUInt16LE(0xaa64, 68);
  assert.throws(() => readFuses(arm), /x64/);
});
