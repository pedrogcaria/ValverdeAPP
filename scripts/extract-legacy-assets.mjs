import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourcePath = process.argv[2] || '/Users/diogo/Downloads/valverde_algarve_2.html';
const outputRoot = path.resolve(process.cwd());
const legacyDirectory = path.join(outputRoot, 'legacy');
const imagesDirectory = path.join(outputRoot, 'apps/web/public/images');
const source = await readFile(sourcePath, 'utf8');

await mkdir(legacyDirectory, { recursive: true });
await mkdir(imagesDirectory, { recursive: true });
await writeFile(path.join(legacyDirectory, 'valverde_algarve_2.html'), source);

const imageExpression = /^\s{2}([A-Za-z0-9_]+):\s*"data:image\/(jpeg|png);base64,([^"]+)"/gm;
const images = [...source.matchAll(imageExpression)];

if (images.length === 0) {
  throw new Error('Não foram encontradas imagens incorporadas no HTML legado.');
}

await Promise.all(images.map(async ([, name, format, payload]) => {
  const extension = format === 'jpeg' ? 'jpg' : format;
  await writeFile(path.join(imagesDirectory, `${name}.${extension}`), Buffer.from(payload, 'base64'));
}));

process.stdout.write(`Extraídas ${images.length} imagens e preservado o HTML legado.\n`);
