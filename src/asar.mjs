import { createHash } from 'node:crypto';

export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function readArchive(buffer) {
  if (buffer.length < 16 || buffer.readUInt32LE(0) !== 4) throw new Error('不支持的 ASAR 头格式');
  const headerSize = buffer.readUInt32LE(4);
  const jsonSize = buffer.readUInt32LE(12);
  if (headerSize < 8 || 8 + headerSize > buffer.length || jsonSize > headerSize - 8) throw new Error('ASAR 头长度无效');
  const header = JSON.parse(buffer.subarray(16, 16 + jsonSize).toString('utf8'));
  const files = new Map();
  function visit(node, prefix = '') {
    if (!node.files || typeof node.files !== 'object') throw new Error('ASAR 文件树无效');
    for (const [name, entry] of Object.entries(node.files)) {
      if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) throw new Error('ASAR 含有不安全路径');
      const pathname = prefix + name;
      if (entry.files) { visit(entry, pathname + '/'); continue; }
      if (entry.link) throw new Error('此版本不支持含链接的 ASAR');
      if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error('ASAR 文件大小无效');
      let data = null;
      if (!entry.unpacked) {
        const offset = Number(entry.offset);
        if (!Number.isSafeInteger(offset) || offset < 0 || 8 + headerSize + offset + entry.size > buffer.length) throw new Error('ASAR 文件越界');
        data = buffer.subarray(8 + headerSize + offset, 8 + headerSize + offset + entry.size);
        if (entry.integrity) {
          if (entry.integrity.algorithm !== 'SHA256' || entry.integrity.hash !== sha256(data)) throw new Error('ASAR 文件哈希校验失败');
        }
      }
      files.set(pathname, { entry, data });
    }
  }
  visit(header);
  return { header, files };
}

function integrityFor(data, old) {
  const blockSize = old?.blockSize ?? 4 * 1024 * 1024;
  if (!Number.isSafeInteger(blockSize) || blockSize <= 0) throw new Error('ASAR 分块参数无效');
  const blocks = [];
  for (let i = 0; i < data.length; i += blockSize) blocks.push(sha256(data.subarray(i, i + blockSize)));
  return { algorithm: 'SHA256', hash: sha256(data), blockSize, blocks };
}

export function replaceArchiveFile(buffer, filename, replacement) {
  const archive = readArchive(buffer);
  const target = archive.files.get(filename);
  if (!target || target.entry.unpacked) throw new Error('需要修改的主程序不在 ASAR 内');
  const payloads = [];
  let offset = 0;
  for (const [pathname, file] of archive.files) {
    if (file.entry.unpacked) continue;
    const data = pathname === filename ? Buffer.from(replacement) : file.data;
    file.entry.offset = String(offset);
    file.entry.size = data.length;
    if (pathname === filename) file.entry.integrity = integrityFor(data, file.entry.integrity);
    payloads.push(data); offset += data.length;
  }
  const json = Buffer.from(JSON.stringify(archive.header));
  const stringPayloadSize = Math.ceil((4 + json.length) / 4) * 4;
  const headerPickle = Buffer.alloc(4 + stringPayloadSize);
  headerPickle.writeUInt32LE(stringPayloadSize, 0);
  headerPickle.writeUInt32LE(json.length, 4);
  json.copy(headerPickle, 8);
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(headerPickle.length, 4);
  const result = Buffer.concat([sizePickle, headerPickle, ...payloads]);
  // Reparse every packed entry before anything is written to an installed app.
  readArchive(result);
  return result;
}

export function readFuses(executable) {
  if (executable.length < 64 || executable.readUInt16LE(0) !== 0x5a4d) throw new Error('无法识别 Windows 可执行文件');
  const peOffset = executable.readUInt32LE(0x3c);
  if (peOffset + 6 > executable.length || executable.readUInt32LE(peOffset) !== 0x00004550) throw new Error('Windows PE 头无效');
  if (executable.readUInt16LE(peOffset + 4) !== 0x8664) throw new Error('当前仅支持已验证的 x64 客户端构建');
  const sentinel = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
  const index = executable.indexOf(sentinel);
  if (index < 0) throw new Error('没有识别到 Electron Fuse，拒绝修改未知程序');
  const start = index + sentinel.length;
  if (executable[start] !== 1 || executable[start + 1] < 6 || start + 2 + executable[start + 1] > executable.length) throw new Error('不支持的 Electron Fuse 格式');
  const wire = executable.subarray(start + 2, start + 2 + executable[start + 1]);
  if (![0x30, 0x31].includes(wire[4])) throw new Error('无法确认 ASAR 校验状态');
  return { architecture: 'x64', embeddedAsarIntegrityValidation: wire[4] === 0x31, onlyLoadAppFromAsar: wire[5] === 0x31 };
}
