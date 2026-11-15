// Comprime il file .glb della camicia per il web (meshopt): stessi punti, molti meno byte.
//   node camicia/comprimi.mjs <entrata.glb> <uscita.glb>
// Il visualizzatore lo decomprime con il decodificatore che è già dentro three.js.
import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [entrata, uscita] = process.argv.slice(2);
if (!entrata || !uscita) { console.error('uso: node camicia/comprimi.mjs <entrata.glb> <uscita.glb>'); process.exit(2); }

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(entrata);
await doc.transform(
  // i tre materiali (tessuto, bottone, filo) nel file sono uguali e si distinguono solo per nome: non vanno fusi.
  // La mappa del tessuto non è ancora usata da nessuna immagine ma serve al visualizzatore: non va tolta.
  prune({ keepAttributes: true }),
  // posizioni a 14 bit su una camicia larga 1,15 m: passi di 0,07 mm, molto sotto ciò che si vede
  // un solo volume per tutto il file: camicia e taschino restano nello stesso sistema di misure e combaciano
  meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14, quantizeColor: 8, quantizationVolume: 'scene' }),
);
await io.write(uscita, doc);

let triangoli = 0, vertici = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const p of mesh.listPrimitives()) {
    vertici += p.getAttribute('POSITION').getCount();
    triangoli += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  }
}
const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${vertici} vertici, ${triangoli} triangoli · da ${kb(entrata)} KB a ${kb(uscita)} KB`);
