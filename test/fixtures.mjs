import { sha256 } from '../src/asar.mjs';

export function fixtureArchive(main = 'console.log("original");') {
  const packageData = Buffer.from(JSON.stringify({ name: 'gemini', version: '1.16.0', main: 'src/main.js' }));
  const mainData = Buffer.from(main);
  const binary = Buffer.from([0, 255, 19, 0, 13, 10, 128]);
  const header = { files: {
    'package.json': { size: packageData.length, offset: '0' },
    src: { files: { 'main.js': { size: mainData.length, offset: String(packageData.length), integrity: { algorithm: 'SHA256', hash: sha256(mainData), blockSize: 4194304, blocks: [sha256(mainData)] } } } },
    'asset.bin': { size: binary.length, offset: String(packageData.length + mainData.length) },
    'external.node': { size: 5, unpacked: true }
  } };
  const json = Buffer.from(JSON.stringify(header));
  const payloadSize = Math.ceil((json.length + 4) / 4) * 4;
  const h = Buffer.alloc(payloadSize + 4);
  h.writeUInt32LE(payloadSize, 0); h.writeUInt32LE(json.length, 4); json.copy(h, 8);
  const prefix = Buffer.alloc(8); prefix.writeUInt32LE(4, 0); prefix.writeUInt32LE(h.length, 4);
  return Buffer.concat([prefix, h, packageData, mainData, binary]);
}

export function fixtureExecutable({ integrity = false } = {}) {
  const prefix = Buffer.alloc(128);
  prefix.writeUInt16LE(0x5a4d, 0); prefix.writeUInt32LE(64, 0x3c);
  prefix.writeUInt32LE(0x00004550, 64); prefix.writeUInt16LE(0x8664, 68);
  return Buffer.concat([prefix, Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from([1, 9]), Buffer.from(integrity ? '010011001' : '010001001')]);
}
