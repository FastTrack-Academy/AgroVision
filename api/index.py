import os
import io
import math
import numpy as np
import tensorflow as tf
from flask import Flask, request, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# =============================
# Config (from app.py)
# =============================
TIME_SERIES_LENGTH = 61
NUM_CLASSES = 20
EXPECTED_HW = (128, 128)

B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12 = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
RGB_BANDS = (B4, B3, B2)

# Vercel deploys standard root path
TFLITE_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "model.tflite")

_interpreter = None
_in_detail = None
_out_detail = None

def load_tflite():
    global _interpreter, _in_detail, _out_detail
    if _interpreter is not None:
        return _interpreter, _in_detail, _out_detail

    if not os.path.exists(TFLITE_PATH):
        raise RuntimeError(f"Missing {TFLITE_PATH}.")

    _interpreter = tf.lite.Interpreter(model_path=TFLITE_PATH)
    _interpreter.allocate_tensors()
    in_details = _interpreter.get_input_details()
    out_details = _interpreter.get_output_details()

    _in_detail, _out_detail = in_details[0], out_details[0]
    return _interpreter, _in_detail, _out_detail

def to_thwc(arr, expected_hw=EXPECTED_HW):
    H_exp, W_exp = expected_hw
    s = arr.shape
    def is_hw(x, y): return (x == H_exp and y == W_exp)
    def is_c(c): return (c in (10, 16))

    if is_hw(s[1], s[2]) and is_c(s[3]): return arr
    if is_c(s[1]) and is_hw(s[2], s[3]): return arr.swapaxes(1, 3).swapaxes(1, 2)
    if is_hw(s[0], s[1]) and is_c(s[2]): return np.transpose(arr, (3, 0, 1, 2))
    if is_c(s[0]) and is_hw(s[1], s[2]): return np.transpose(arr, (3, 1, 2, 0))
    raise ValueError("Unrecognized layout")

def pad_time_series_repeat(ts_thwc, size):
    input_size = ts_thwc.shape[0]
    diff = size - input_size
    if diff == 0: return ts_thwc
    duplicate_times = math.ceil(size / input_size)
    repeat_times = (
        [duplicate_times] * (size - input_size * (duplicate_times - 1))
        + [duplicate_times - 1] * (input_size * duplicate_times - size)
    )
    s = sum(repeat_times)
    if s < size: repeat_times[: (size - s)] = [v + 1 for v in repeat_times[: (size - s)]]
    return np.repeat(ts_thwc, repeat_times, axis=0)

def align_to_T(ts_thwc, T_target=TIME_SERIES_LENGTH):
    T = ts_thwc.shape[0]
    if T > T_target: return ts_thwc[-T_target:]
    if T < T_target: return pad_time_series_repeat(ts_thwc, T_target)
    return ts_thwc

def add_agri_indices_10_to_16(ts_10, eps=1e-6):
    b2 = ts_10[..., B2]
    b4 = ts_10[..., B4]
    b5 = ts_10[..., B5]
    b8 = ts_10[..., B8]
    b11 = ts_10[..., B11]
    b12 = ts_10[..., B12]

    ndvi = np.clip((b8 - b4) / (b8 + b4 + eps), -1.0, 1.0)
    ndre5 = np.clip((b8 - b5) / (b8 + b5 + eps), -1.0, 1.0)
    ndwi = np.clip((b8 - b11) / (b8 + b11 + eps), -1.0, 1.0)
    bsi = np.clip(((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + eps), -1.0, 1.0)
    L = 0.5
    savi = np.clip(((b8 - b4) * (1.0 + L)) / (b8 + b4 + L + eps), -1.2, 1.2)
    nbr = np.clip((b8 - b12) / (b8 + b12 + eps), -1.0, 1.0)

    idx = np.stack([ndvi, ndre5, ndwi, bsi, savi, nbr], axis=-1).astype(ts_10.dtype)
    return np.concatenate([ts_10, idx], axis=-1)

def ensure_16_channels(ts):
    C = ts.shape[-1]
    if C == 16: return ts
    if C == 10: return add_agri_indices_10_to_16(ts.astype(np.float32))
    raise ValueError("Expected 10 or 16 channels")

def to_rgb_at_t(ts_aligned, t_idx):
    img = ts_aligned[t_idx][:, :, list(RGB_BANDS)].astype(np.float32)
    # Ensure HWC
    if img.shape[0] == 3 and img.shape[-1] != 3:
        img = np.transpose(img, (1, 2, 0))
    
    lo = np.percentile(img, 2, axis=(0, 1), keepdims=True)
    hi = np.percentile(img, 98, axis=(0, 1), keepdims=True)
    img = (img - lo) / (hi - lo + 1e-6)
    img = np.clip(img, 0, 1)
    rgb = (img * 255).astype(np.uint8)
    return rgb

def predict_probs_tflite(arr_any_layout):
    interpreter, in_det, out_det = load_tflite()
    x = to_thwc(arr_any_layout.astype(np.float32), expected_hw=EXPECTED_HW)
    x = align_to_T(x, TIME_SERIES_LENGTH)
    x = ensure_16_channels(x).astype(np.float32)
    x_b = np.expand_dims(x, axis=0)

    expected = tuple(in_det["shape"])
    got = tuple(x_b.shape)
    if expected != got:
        interpreter.resize_tensor_input(in_det["index"], got, strict=False)
        interpreter.allocate_tensors()
        in_det = interpreter.get_input_details()[0]
        out_det = interpreter.get_output_details()[0]

    interpreter.set_tensor(in_det["index"], x_b)
    interpreter.invoke()
    y = interpreter.get_tensor(out_det["index"])

    if y.ndim == 4: return y[:, None, ...]
    if y.ndim == 5: return y
    raise RuntimeError("Unexpected output shape")

def mask_at_t_from_probs(probs, t_idx):
    probs_t = probs[0, 0] if probs.shape[1] == 1 else probs[0, t_idx]
    return np.argmax(probs_t, axis=-1).astype(np.uint8)

@app.route('/api/predict', methods=['POST'])
def predict():
    sample_name = request.form.get('sample')
    
    try:
        if sample_name:
            path = os.path.join(os.path.dirname(__file__), "..", "public", "samples", sample_name)
            if not os.path.exists(path):
                return jsonify({'error': 'Sample not found'}), 404
            with open(path, 'rb') as f:
                arr = np.load(io.BytesIO(f.read()))
        else:
            if 'file' not in request.files:
                return jsonify({'error': 'No file part or sample missing'}), 400
            file = request.files['file']
            arr = np.load(io.BytesIO(file.read()))
            
        probs = predict_probs_tflite(arr)
        
        thwc = to_thwc(arr, expected_hw=EXPECTED_HW)
        aligned = align_to_T(thwc, TIME_SERIES_LENGTH)
        
        rgb_seq = np.zeros((TIME_SERIES_LENGTH, 128, 128, 3), dtype=np.uint8)
        mask_seq = np.zeros((TIME_SERIES_LENGTH, 128, 128), dtype=np.uint8)
        
        for t in range(TIME_SERIES_LENGTH):
            rgb_seq[t] = to_rgb_at_t(aligned, t)
            mask_seq[t] = mask_at_t_from_probs(probs, t)
            
        return Response(mask_seq.tobytes() + rgb_seq.tobytes(), mimetype='application/octet-stream')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, port=5328)
