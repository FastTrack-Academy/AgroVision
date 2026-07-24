import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(projectRoot, 'node_modules', '@litertjs', 'core', 'wasm');
const destinationDir = join(projectRoot, 'public', 'litert');
const runtimeFiles = [
    'litert_wasm_compat_internal.js',
    'litert_wasm_compat_internal.wasm',
    'litert_wasm_internal.js',
    'litert_wasm_internal.wasm',
    'litert_wasm_threaded_internal.js',
    'litert_wasm_threaded_internal.wasm',
];

await mkdir(destinationDir, { recursive: true });
await Promise.all(
    runtimeFiles.map((fileName) =>
        copyFile(join(sourceDir, fileName), join(destinationDir, fileName))
    )
);

console.log(`Copied ${runtimeFiles.length} LiteRT runtime files to public/litert.`);
