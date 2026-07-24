const fs = require('fs');
const path = require('path');
const https = require('https');

const files = [
    'tf-tflite.min.js',
    'tflite_web_api_cc.js',
    'tflite_web_api_cc.wasm',
    'tflite_web_api_cc_simd.js',
    'tflite_web_api_cc_simd.wasm',
    'tflite_web_api_cc_threaded.js',
    'tflite_web_api_cc_threaded.wasm',
    'tflite_web_api_cc_threaded.worker.js',
    'tflite_web_api_cc_simd_threaded.js',
    'tflite_web_api_cc_simd_threaded.wasm',
    'tflite_web_api_cc_simd_threaded.worker.js',
    'tflite_web_api_client.js'
];

const targetDir = path.join(__dirname, '..', 'public', 'tflite');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const baseUrl = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.8/dist/';

function downloadFile(fileName) {
    return new Promise((resolve, reject) => {
        const fileUrl = baseUrl + fileName;
        const filePath = path.join(targetDir, fileName);
        const fileStream = fs.createWriteStream(filePath);

        https.get(fileUrl, (response) => {
            if (response.statusCode !== 200) {
                console.warn(`[SKIP] ${fileName} returned HTTP ${response.statusCode}`);
                fileStream.close();
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                resolve();
                return;
            }
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close(() => {
                    console.log(`[OK] Downloaded ${fileName}`);
                    resolve();
                });
            });
        }).on('error', (err) => {
            console.error(`[ERROR] ${fileName}:`, err.message);
            resolve();
        });
    });
}

async function downloadAll() {
    console.log("Downloading WASM files to public/tflite/...");
    for (const f of files) {
        await downloadFile(f);
    }
    console.log("Download complete!");
}

downloadAll();
