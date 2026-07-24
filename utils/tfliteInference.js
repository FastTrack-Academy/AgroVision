const TIME_SERIES_LENGTH = 61;
const EXPECTED_HW = [128, 128];
const MODEL_PATH = '/models/model.tflite';
const LITERT_WASM_PATH = '/litert/';
const INPUT_SHAPE = [1, 61, 128, 128, 16];
const OUTPUT_SHAPES = [
    [1, 128, 128, 20],
    [1, 61, 128, 128, 20],
];

let loadedModel = null;
let modelLoadingPromise = null;
let runtimeLoadingPromise = null;

async function assertModelIsBrowserCompatible() {
    const response = await fetch(MODEL_PATH);
    if (!response.ok) {
        throw new Error(`Unable to fetch the TFLite model (HTTP ${response.status})`);
    }

    const modelBytes = await response.arrayBuffer();
    const modelText = new TextDecoder('latin1').decode(modelBytes);
    if (modelText.includes('FlexTensorList') || modelText.includes('FlexWhile')) {
        throw new Error(
            'This TFLite model contains TensorFlow Select/Flex ops, which the browser WASM runtime cannot execute. ' +
            'Use the browser-exported model containing built-in TFLite operators only.'
        );
    }
    return new Uint8Array(modelBytes);
}

function shapesMatch(actualShape, expectedShape) {
    return actualShape.length === expectedShape.length &&
        actualShape.every((dimension, index) => dimension === expectedShape[index]);
}

function validateModelSignature(model) {
    const inputs = model.getInputDetails();
    const outputs = model.getOutputDetails();

    if (
        inputs.length !== 1 ||
        inputs[0].dtype !== 'float32' ||
        !shapesMatch(Array.from(inputs[0].shape), INPUT_SHAPE)
    ) {
        const received = inputs.map((input) =>
            `${input.dtype} [${Array.from(input.shape).join(', ')}]`
        ).join('; ');
        throw new Error(`Unexpected model input signature: ${received || 'none'}`);
    }

    const outputShape = outputs.length === 1 ? Array.from(outputs[0].shape) : [];
    const validOutput = outputs.length === 1 &&
        outputs[0].dtype === 'float32' &&
        OUTPUT_SHAPES.some((expected) => shapesMatch(outputShape, expected));
    if (!validOutput) {
        const received = outputs.map((output) =>
            `${output.dtype} [${Array.from(output.shape).join(', ')}]`
        ).join('; ');
        throw new Error(`Unexpected model output signature: ${received || 'none'}`);
    }
}

async function loadLiteRtRuntime() {
    if (typeof window === 'undefined') {
        throw new Error('LiteRT inference is only available in the browser');
    }

    if (!runtimeLoadingPromise) {
        runtimeLoadingPromise = (async () => {
            const liteRt = await import('@litertjs/core');
            const canUseThreads =
                window.crossOriginIsolated === true &&
                (navigator.hardwareConcurrency || 1) > 1;
            let threaded = false;

            try {
                await liteRt.loadLiteRt(
                    LITERT_WASM_PATH,
                    canUseThreads ? { threads: true } : undefined
                );
                threaded = canUseThreads;
            } catch (threadedError) {
                if (!canUseThreads) throw threadedError;
                console.warn('Threaded LiteRT unavailable; using the single-threaded runtime.');
                await liteRt.loadLiteRt(LITERT_WASM_PATH);
            }
            return { liteRt, threaded };
        })().catch((error) => {
            runtimeLoadingPromise = null;
            throw error;
        });
    }
    return runtimeLoadingPromise;
}

export async function loadTFLiteModel() {
    if (loadedModel) return loadedModel;

    if (!modelLoadingPromise) {
        modelLoadingPromise = (async () => {
            const [modelBytes, runtime] = await Promise.all([
                assertModelIsBrowserCompatible(),
                loadLiteRtRuntime(),
            ]);
            const { liteRt, threaded } = runtime;
            const numThreads = threaded
                ? Math.max(1, Math.min(navigator.hardwareConcurrency || 1, 4))
                : 1;
            const model = await liteRt.loadAndCompile(modelBytes, {
                accelerator: 'wasm',
                cpuOptions: { numThreads },
            });

            try {
                validateModelSignature(model);
            } catch (error) {
                model.delete();
                throw error;
            }

            loadedModel = { model, Tensor: liteRt.Tensor };
            return loadedModel;
        })().catch((error) => {
            modelLoadingPromise = null;
            throw new Error(`Unable to load TFLite model: ${error.message}`);
        });
    }

    return modelLoadingPromise;
}

/**
 * Transpose raw array data to (T, 128, 128, C)
 */
function toTHWC(data, shape) {
    const [s0, s1, s2, s3] = shape;
    const [H_exp, W_exp] = EXPECTED_HW;
    
    const isHW = (x, y) => x === H_exp && y === W_exp;
    const isC = (c) => c === 10 || c === 16;

    if (isHW(s1, s2) && isC(s3)) {
        return { data, T: s0, C: s3 };
    }

    if (isC(s1) && isHW(s2, s3)) {
        const T = s0, C = s1;
        const out = new Float32Array(data.length);
        const HW = H_exp * W_exp;
        for (let t = 0; t < T; t++) {
            for (let c = 0; c < C; c++) {
                for (let h = 0; h < H_exp; h++) {
                    for (let w = 0; w < W_exp; w++) {
                        const inIdx = t * (C * HW) + c * HW + h * W_exp + w;
                        const outIdx = t * (HW * C) + (h * W_exp + w) * C + c;
                        out[outIdx] = data[inIdx];
                    }
                }
            }
        }
        return { data: out, T, C };
    }

    if (isHW(s0, s1) && isC(s2)) {
        const C = s2, T = s3;
        const out = new Float32Array(data.length);
        const HW = H_exp * W_exp;
        for (let h = 0; h < H_exp; h++) {
            for (let w = 0; w < W_exp; w++) {
                for (let c = 0; c < C; c++) {
                    for (let t = 0; t < T; t++) {
                        const inIdx = (h * W_exp + w) * (C * T) + c * T + t;
                        const outIdx = t * (HW * C) + (h * W_exp + w) * C + c;
                        out[outIdx] = data[inIdx];
                    }
                }
            }
        }
        return { data: out, T, C };
    }

    if (isC(s0) && isHW(s1, s2)) {
        const C = s0, T = s3;
        const out = new Float32Array(data.length);
        const HW = H_exp * W_exp;
        for (let c = 0; c < C; c++) {
            for (let h = 0; h < H_exp; h++) {
                for (let w = 0; w < W_exp; w++) {
                    for (let t = 0; t < T; t++) {
                        const inIdx = c * (HW * T) + (h * W_exp + w) * T + t;
                        const outIdx = t * (HW * C) + (h * W_exp + w) * C + c;
                        out[outIdx] = data[inIdx];
                    }
                }
            }
        }
        return { data: out, T, C };
    }

    throw new Error(`Unrecognized tensor layout with shape [${shape.join(', ')}]`);
}

/**
 * Align T dimension to 61 steps
 */
function alignTo61(data, T_in, C) {
    const H_exp = 128, W_exp = 128;
    const sliceSize = H_exp * W_exp * C;
    const targetT = TIME_SERIES_LENGTH;

    if (T_in === targetT) return data;

    const out = new Float32Array(targetT * sliceSize);
    if (T_in > targetT) {
        const start = (T_in - targetT) * sliceSize;
        out.set(data.subarray(start, start + targetT * sliceSize));
        return out;
    }

    if (T_in <= 0) throw new Error("The input tensor has no time steps");

    const duplicateTimes = Math.ceil(targetT / T_in);
    const duplicatedFrameCount = targetT - T_in * (duplicateTimes - 1);
    let outT = 0;
    for (let t = 0; t < T_in; t++) {
        const count = t < duplicatedFrameCount ? duplicateTimes : duplicateTimes - 1;
        const slice = data.subarray(t * sliceSize, (t + 1) * sliceSize);
        for (let k = 0; k < count; k++) {
            out.set(slice, outT * sliceSize);
            outT++;
        }
    }
    return out;
}

/**
 * Ensure 16 channels by adding 6 agricultural vegetation indices if C=10
 */
function ensure16Channels(thwcData, C) {
    if (C === 16) return thwcData;
    if (C !== 10) throw new Error(`Expected 10 or 16 channels, got ${C}`);

    const H_exp = 128, W_exp = 128;
    const T = TIME_SERIES_LENGTH;
    const numPixels = T * H_exp * W_exp;
    const out = new Float32Array(numPixels * 16);
    const eps = 1e-6;

    for (let i = 0; i < numPixels; i++) {
        const inOffset = i * 10;
        const outOffset = i * 16;

        const b2  = thwcData[inOffset + 0];
        const b3  = thwcData[inOffset + 1];
        const b4  = thwcData[inOffset + 2];
        const b5  = thwcData[inOffset + 3];
        const b6  = thwcData[inOffset + 4];
        const b7  = thwcData[inOffset + 5];
        const b8  = thwcData[inOffset + 6];
        const b8a = thwcData[inOffset + 7];
        const b11 = thwcData[inOffset + 8];
        const b12 = thwcData[inOffset + 9];

        for (let c = 0; c < 10; c++) {
            out[outOffset + c] = thwcData[inOffset + c];
        }

        const ndvi  = Math.max(-1.0, Math.min(1.0, (b8 - b4) / (b8 + b4 + eps)));
        const ndre5 = Math.max(-1.0, Math.min(1.0, (b8 - b5) / (b8 + b5 + eps)));
        const ndwi  = Math.max(-1.0, Math.min(1.0, (b8 - b11) / (b8 + b11 + eps)));
        const bsi   = Math.max(-1.0, Math.min(1.0, ((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + eps)));
        const savi  = Math.max(-1.2, Math.min(1.2, ((b8 - b4) * 1.5) / (b8 + b4 + 0.5 + eps)));
        const nbr   = Math.max(-1.0, Math.min(1.0, (b8 - b12) / (b8 + b12 + eps)));

        out[outOffset + 10] = ndvi;
        out[outOffset + 11] = ndre5;
        out[outOffset + 12] = ndwi;
        out[outOffset + 13] = bsi;
        out[outOffset + 14] = savi;
        out[outOffset + 15] = nbr;
    }

    return out;
}

/**
 * Generate 61x128x128x3 RGB buffer from 16-channel sequence with 2-98% percentile stretching
 */
function generateRGBSequence(aligned16Data) {
    const T = TIME_SERIES_LENGTH, H = 128, W = 128;
    const numPixelsPerT = H * W;
    const rgbSeq = new Uint8Array(T * H * W * 3);

    const rgbBands = [2, 1, 0];

    for (let t = 0; t < T; t++) {
        const chBuffers = [[], [], []];

        for (let i = 0; i < numPixelsPerT; i++) {
            const pixelOffset = (t * numPixelsPerT + i) * 16;
            chBuffers[0].push(aligned16Data[pixelOffset + rgbBands[0]]);
            chBuffers[1].push(aligned16Data[pixelOffset + rgbBands[1]]);
            chBuffers[2].push(aligned16Data[pixelOffset + rgbBands[2]]);
        }

        const stats = chBuffers.map(buf => {
            const sorted = new Float32Array(buf).sort();
            const p2 = sorted[Math.floor(0.02 * (sorted.length - 1))];
            const p98 = sorted[Math.floor(0.98 * (sorted.length - 1))];
            return { p2, p98 };
        });

        for (let i = 0; i < numPixelsPerT; i++) {
            const pixelOffset = (t * numPixelsPerT + i) * 16;
            const rgbOffset = (t * numPixelsPerT + i) * 3;

            for (let c = 0; c < 3; c++) {
                const val = aligned16Data[pixelOffset + rgbBands[c]];
                const { p2, p98 } = stats[c];
                const norm = Math.max(0, Math.min(1, (val - p2) / (p98 - p2 + 1e-6)));
                rgbSeq[rgbOffset + c] = Math.round(norm * 255);
            }
        }
    }

    return rgbSeq;
}

/**
 * Execute client-side inference end-to-end
 */
export async function runClientInference(rawData, shape) {
    const { data: thwc, T: T_in, C } = toTHWC(rawData, shape);
    const aligned = alignTo61(thwc, T_in, C);
    const aligned16 = ensure16Channels(aligned, C);
    const rgbSeq = generateRGBSequence(aligned16);

    const { model, Tensor } = await loadTFLiteModel();
    const inputTensor = new Tensor(aligned16, INPUT_SHAPE);
    let outputTensors;
    let probs;
    try {
        outputTensors = await model.run(inputTensor);
        if (!Array.isArray(outputTensors) || outputTensors.length !== 1) {
            throw new Error("The model returned an unsupported output structure");
        }
        probs = new Float32Array(await outputTensors[0].data());
    } finally {
        inputTensor.delete();
        outputTensors?.forEach((tensor) => tensor.delete());
    }

    const maskSeq = new Uint8Array(61 * 128 * 128);
    const numClasses = 20;
    const numPixelsPerT = 128 * 128;
    const singleStepLength = numPixelsPerT * numClasses;
    const timeSeriesLength = TIME_SERIES_LENGTH * singleStepLength;
    if (probs.length !== singleStepLength && probs.length !== timeSeriesLength) {
        throw new Error(`Unexpected model output size: ${probs.length} values`);
    }
    const isSingleStepOutput = probs.length === singleStepLength;

    for (let t = 0; t < 61; t++) {
        const tIdxInProbs = isSingleStepOutput ? 0 : t;
        for (let p = 0; p < numPixelsPerT; p++) {
            const probOffset = (tIdxInProbs * numPixelsPerT + p) * numClasses;
            let maxClass = 0;
            let maxVal = probs[probOffset];
            for (let c = 1; c < numClasses; c++) {
                const val = probs[probOffset + c];
                if (val > maxVal) {
                    maxVal = val;
                    maxClass = c;
                }
            }
            maskSeq[t * numPixelsPerT + p] = maxClass;
        }
    }

    return { maskSeq, rgbSeq };
}
