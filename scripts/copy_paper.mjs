import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(projectRoot, 'AI4Sci___AgroVision (2).pdf');
const outputDirectory = path.join(projectRoot, 'public', 'paper');
const outputPath = path.join(outputDirectory, 'agrovision-paper.pdf');

const signature = await readFile(sourcePath, { encoding: 'ascii' });
if (!signature.startsWith('%PDF-')) {
    throw new Error(`${path.basename(sourcePath)} is not a valid PDF file`);
}

await mkdir(outputDirectory, { recursive: true });
await copyFile(sourcePath, outputPath);

const { size } = await stat(outputPath);
console.log(`Copied ${size} bytes to ${path.relative(projectRoot, outputPath)}`);
