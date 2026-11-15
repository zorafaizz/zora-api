import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rivePkg = require('../node_modules/@rive-app/canvas/rive.js');

function varuint(n) {
  const out = [];
  let v = n >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v > 0) b |= 0x80;
    out.push(b);
  } while (v > 0);
  return Buffer.from(out);
}

function f32(v) {
  const b = Buffer.alloc(4);
  b.writeFloatLE(v, 0);
  return b;
}

function str(s) {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([varuint(b.length), b]);
}

function colorARGB(a, r, g, b) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE((((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)) >>> 0, 0);
  return buf;
}

const wasmBuf = fs.readFileSync('/home/zorafaiz/api-service/public/assets/media/rive.wasm');
rivePkg.RuntimeLoader.setWasmUrl('data:application/wasm;base64,' + wasmBuf.toString('base64'));

async function validate(chunks) {
  const b = Buffer.concat(chunks);
  const abuf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  try {
    const rf = new rivePkg.RiveFile({ buffer: abuf });
    await rf.init();
    return { buf: b, file: rf.getInstance() };
  } catch {
    return null;
  }
}

const base = [
  Buffer.from('RIVE', 'ascii'), varuint(7), varuint(0), varuint(1), varuint(0),
  varuint(23), varuint(0),
  // 0: Artboard (1)
  varuint(1), varuint(4), str('CelestialOperator'), varuint(7), f32(360), varuint(8), f32(360), varuint(0),
  // 1: OuterAstrolabe Shape (3)
  varuint(3), varuint(4), str('OuterAstrolabe'), varuint(5), varuint(0), varuint(13), f32(180), varuint(14), f32(180), varuint(0),
  // 2: Outer Ellipse (7)
  varuint(7), varuint(5), varuint(1), varuint(20), f32(328), varuint(21), f32(328), varuint(0),
  // 3: Stroke (24)
  varuint(24), varuint(5), varuint(1), varuint(47), f32(1.6), varuint(0),
  // 4: SolidColor (18) Sky Blue #83B9FF
  varuint(18), varuint(5), varuint(3), varuint(37), colorARGB(0x88, 0x83, 0xb9, 0xff), varuint(0),
  // 5: InnerLilacOrbit Shape (3)
  varuint(3), varuint(4), str('InnerLilacOrbit'), varuint(5), varuint(0), varuint(13), f32(180), varuint(14), f32(180), varuint(0),
  // 6: Tilted Ellipse (7)
  varuint(7), varuint(5), varuint(5), varuint(20), f32(288), varuint(21), f32(104), varuint(0),
  // 7: Stroke (24)
  varuint(24), varuint(5), varuint(5), varuint(47), f32(1.4), varuint(0),
  // 8: SolidColor (18) Lilac #B9A7FF
  varuint(18), varuint(5), varuint(7), varuint(37), colorARGB(0x99, 0xb9, 0xa7, 0xff), varuint(0),
  // 9: StarlightNode Shape (3)
  varuint(3), varuint(4), str('StarlightNode'), varuint(5), varuint(5), varuint(13), f32(144), varuint(14), f32(0), varuint(0),
  // 10: Dot Ellipse (7)
  varuint(7), varuint(5), varuint(9), varuint(20), f32(10), varuint(21), f32(10), varuint(0),
  // 11: Fill (20)
  varuint(20), varuint(5), varuint(9), varuint(0),
  // 12: SolidColor (18) Starlight #EAF4FF
  varuint(18), varuint(5), varuint(11), varuint(37), colorARGB(0xf4, 0xea, 0xf4, 0xff), varuint(0),
];

// LinearAnimation (31): name=4, fps=56, duration=57, loop=59 (1=loop)
// KeyedObject (25): objectId=51 -> 5 (InnerLilacOrbit), KeyedProperty (26): propertyKey=53 -> 15 (rotation)
// KeyFrameDouble (30): frame=67, value=70
const animChunks = [
  varuint(31), varuint(4), str('OrbitIdle'), varuint(56), varuint(60), varuint(57), varuint(360), varuint(59), varuint(1), varuint(0),
  varuint(25), varuint(51), varuint(5), varuint(0),
  varuint(26), varuint(53), varuint(15), varuint(0),
  varuint(30), varuint(67), varuint(0), varuint(70), f32(0), varuint(0),
  varuint(30), varuint(67), varuint(360), varuint(70), f32(Math.PI * 2), varuint(0),

  varuint(31), varuint(4), str('OrbitSurge'), varuint(56), varuint(60), varuint(57), varuint(90), varuint(59), varuint(1), varuint(0),
  varuint(25), varuint(51), varuint(5), varuint(0),
  varuint(26), varuint(53), varuint(15), varuint(0),
  varuint(30), varuint(67), varuint(0), varuint(70), f32(0), varuint(0),
  varuint(30), varuint(67), varuint(90), varuint(70), f32(Math.PI * 2), varuint(0),
];

// StateMachine (53) + Inputs (56=StateMachineNumber, 4=name, 140=value) + Layer (57) + States
const smChunks = [
  varuint(53), varuint(4), str('OperatorStateMachine'), varuint(0),
  varuint(56), varuint(4), str('apiState'), varuint(140), f32(0), varuint(0),
  varuint(56), varuint(4), str('pointerX'), varuint(140), f32(0), varuint(0),
  varuint(56), varuint(4), str('pointerY'), varuint(140), f32(0), varuint(0),
  varuint(57), varuint(4), str('OrbitLayer'), varuint(0),
  varuint(61), varuint(0),
  varuint(62), varuint(0),
  varuint(60), varuint(149), varuint(0), varuint(0),
  varuint(63), varuint(0),
  varuint(65), varuint(151), varuint(2), varuint(0),
];

let best = await validate([...base, ...animChunks, ...smChunks]);
if (!best) best = await validate([...base, ...animChunks]);
if (!best) best = await validate(base);

const ab = best.file.defaultArtboard();
fs.writeFileSync('/home/zorafaiz/api-service/public/assets/media/celestial-operator.riv', best.buf);
console.log('FINAL VERIFIED .riv -> bytes:', best.buf.length, 'artboard:', ab.name, 'anims:', ab.animationCount(), 'stateMachines:', ab.stateMachineCount());
