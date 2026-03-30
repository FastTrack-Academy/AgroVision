# app.py
# AgroVision HF Space (Gradio) — ConvLSTM-UNet semantic segmentation
# Inference via TFLite (with SELECT_TF_OPS / Flex) to avoid SavedModel CPU kernel issues.
#
# Accepts .npy tensors saved in either:
#   - (T, H, W, C)  (channel-last)
#   - (T, C, H, W)  (training notebook format; we swapaxes like training)
# Aligns/pads T to TIME_SERIES_LENGTH (61) using repeat-padding.
# Ensures model sees 16 channels: if input has 10, it engineers 6 indices -> 16.

import os
import math
import numpy as np
import gradio as gr
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch
import tensorflow as tf

import base64
import requests

DRIVE_FILE_ID = "1jffHUanuC8dSEkSavkQpuPVyZNKdoYOn"

def drive_png_data_uri():
    url = f"https://drive.google.com/uc?export=download&id={DRIVE_FILE_ID}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()

    ctype = (r.headers.get("Content-Type") or "").lower()
    if "text/html" in ctype:
        raise RuntimeError(
            "Google Drive returned HTML (likely hotlink / confirmation page). "
            "If this persists, host the image on HF (dataset repo) or any static CDN."
        )

    b64 = base64.b64encode(r.content).decode("utf-8")
    return f"data:image/png;base64,{b64}"

# =============================
# Config (match your training)
# =============================
TIME_SERIES_LENGTH = 61
NUM_CLASSES = 20
VOID_LABEL = 19
EXPECTED_HW = (128, 128)

EXPECTED_CHANNELS = 16
BASE_CHANNELS = 10
ENGINEERED_CHANNELS = 6

TFLITE_PATH = "models/model.tflite"

# PASTIS baseline channel order assumed:
# [B2,B3,B4,B5,B6,B7,B8,B8A,B11,B12]
B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12 = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
RGB_BANDS = (B4, B3, B2)

CLASS_NAMES = {
    0: "Background",
    1: "Meadow",
    2: "Soft winter wheat",
    3: "Corn",
    4: "Winter barley",
    5: "Winter rapeseed",
    6: "Spring barley",
    7: "Sunflower",
    8: "Grapevine",
    9: "Beet",
    10: "Winter triticale",
    11: "Winter durum wheat",
    12: "Fruits, vegetables, flowers",
    13: "Potatoes",
    14: "Leguminous fodder",
    15: "Soybeans",
    16: "Orchard",
    17: "Mixed cereal",
    18: "Sorghum",
    19: "Void label",
}

# =============================
# Colormap + legend
# =============================
cm = matplotlib.colormaps.get_cmap("tab20")
def_colors = list(cm.colors)  # length 20
# class 0 black, classes 1..19 from tab20
cus_colors = ["k"] + [def_colors[i] for i in range(1, 20)]
SEMANTIC_CMAP = ListedColormap(cus_colors, name="agri", N=NUM_CLASSES)

LEGEND_HANDLES = [
    Patch(
        facecolor=SEMANTIC_CMAP(i),
        edgecolor="black",
        label=f"{i}: {CLASS_NAMES.get(i, str(i))}",
    )
    for i in range(NUM_CLASSES)
]


# =============================
# TFLite interpreter cache
# =============================
_interpreter = None
_in_detail = None
_out_detail = None


def load_tflite():
    global _interpreter, _in_detail, _out_detail

    if _interpreter is not None:
        return _interpreter, _in_detail, _out_detail

    if not os.path.exists(TFLITE_PATH):
        raise RuntimeError(f"Missing {TFLITE_PATH}. Upload a converted TFLite model to this path.")

    _interpreter = tf.lite.Interpreter(model_path=TFLITE_PATH)
    _interpreter.allocate_tensors()

    in_details = _interpreter.get_input_details()
    out_details = _interpreter.get_output_details()

    if len(in_details) != 1:
        raise RuntimeError(f"Expected 1 input tensor, got {len(in_details)}")
    if len(out_details) < 1:
        raise RuntimeError("Expected at least 1 output tensor")

    _in_detail = in_details[0]
    _out_detail = out_details[0]

    print("TFLite loaded.")
    print("Input:", _in_detail["shape"], _in_detail["dtype"], "name:", _in_detail.get("name"))
    print("Output:", _out_detail["shape"], _out_detail["dtype"], "name:", _out_detail.get("name"))

    return _interpreter, _in_detail, _out_detail


# =============================
# Shape / layout utilities
# =============================
def to_thwc(arr: np.ndarray, expected_hw=EXPECTED_HW) -> np.ndarray:
    """
    Convert 4D tensor to (T,H,W,C) robustly.

    Supported inputs:
      - (T,H,W,C)
      - (T,C,H,W)
      - (H,W,C,T)
      - (C,H,W,T)
    """
    if arr.ndim != 4:
        raise ValueError(f"Expected 4D tensor, got {arr.shape}")

    H_exp, W_exp = expected_hw
    s = arr.shape

    def is_hw(x, y): return (x == H_exp and y == W_exp)
    def is_c(c): return (c in (10, 16))

    # (T,H,W,C)
    if is_hw(s[1], s[2]) and is_c(s[3]):
        return arr

    # (T,C,H,W)
    if is_c(s[1]) and is_hw(s[2], s[3]):
        return arr.swapaxes(1, 3).swapaxes(1, 2)

    # (H,W,C,T)
    if is_hw(s[0], s[1]) and is_c(s[2]):
        return np.transpose(arr, (3, 0, 1, 2))

    # (C,H,W,T)
    if is_c(s[0]) and is_hw(s[1], s[2]):
        return np.transpose(arr, (3, 1, 2, 0))

    raise ValueError(
        f"Unrecognized layout {arr.shape}. Expected (T,H,W,C) or (T,C,H,W) with "
        f"H=W=128 and C in {{10,16}}."
    )


def pad_time_series_repeat(ts_thwc: np.ndarray, size: int) -> np.ndarray:
    """Repeat-pad along time without violating temporal order."""
    input_size = ts_thwc.shape[0]
    diff = size - input_size
    if diff < 0:
        raise ValueError(f"T={input_size} exceeds expected {size}")
    if diff == 0:
        return ts_thwc

    duplicate_times = math.ceil(size / input_size)
    repeat_times = (
        [duplicate_times] * (size - input_size * (duplicate_times - 1))
        + [duplicate_times - 1] * (input_size * duplicate_times - size)
    )

    s = sum(repeat_times)
    if s < size:
        repeat_times[: (size - s)] = [v + 1 for v in repeat_times[: (size - s)]]

    return np.repeat(ts_thwc, repeat_times, axis=0)


def align_to_T(ts_thwc: np.ndarray, T_target: int = TIME_SERIES_LENGTH) -> np.ndarray:
    """Align time dimension to T_target by repeat-padding or trimming."""
    T = ts_thwc.shape[0]
    if T > T_target:
        return ts_thwc[-T_target:]
    if T < T_target:
        return pad_time_series_repeat(ts_thwc, T_target)
    return ts_thwc


# =============================
# Channel engineering (10 -> 16)
# =============================
def add_agri_indices_10_to_16(ts_thwc_10: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """
    Appends 6 indices: NDVI, NDRE5, NDWI/NDMI, BSI, SAVI, NBR
    Output: (T,H,W,16)
    """
    if ts_thwc_10.shape[-1] != 10:
        raise ValueError(f"Expected 10 channels, got {ts_thwc_10.shape[-1]}")

    b2 = ts_thwc_10[..., B2]
    b4 = ts_thwc_10[..., B4]
    b5 = ts_thwc_10[..., B5]
    b8 = ts_thwc_10[..., B8]
    b11 = ts_thwc_10[..., B11]
    b12 = ts_thwc_10[..., B12]

    ndvi = (b8 - b4) / (b8 + b4 + eps)
    ndre5 = (b8 - b5) / (b8 + b5 + eps)
    ndwi = (b8 - b11) / (b8 + b11 + eps)
    bsi = ((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + eps)

    L = 0.5
    savi = ((b8 - b4) * (1.0 + L)) / (b8 + b4 + L + eps)
    nbr = (b8 - b12) / (b8 + b12 + eps)

    ndvi = np.clip(ndvi, -1.0, 1.0)
    ndre5 = np.clip(ndre5, -1.0, 1.0)
    ndwi = np.clip(ndwi, -1.0, 1.0)
    bsi = np.clip(bsi, -1.0, 1.0)
    nbr = np.clip(nbr, -1.0, 1.0)
    savi = np.clip(savi, -1.2, 1.2)

    idx = np.stack([ndvi, ndre5, ndwi, bsi, savi, nbr], axis=-1).astype(ts_thwc_10.dtype)
    return np.concatenate([ts_thwc_10, idx], axis=-1)


def ensure_16_channels(ts_thwc: np.ndarray) -> np.ndarray:
    C = ts_thwc.shape[-1]
    if C == 16:
        return ts_thwc
    if C == 10:
        return add_agri_indices_10_to_16(ts_thwc.astype(np.float32))
    raise ValueError(
        f"Input has C={C} channels. Model expects 16. Provide 16-channel tensors or 10-channel tensors (auto->16)."
    )


# =============================
# Visualization helpers
# =============================
def to_rgb_at_t(ts_thwc_aligned: np.ndarray, t_idx: int) -> np.ndarray:
    base10 = ts_thwc_aligned[..., :10]
    img = base10[t_idx, :, :, list(RGB_BANDS)].astype(np.float32)

    # Guard: if something slipped and became (3,H,W), fix it
    if img.ndim == 3 and img.shape[0] == 3 and img.shape[-1] != 3:
        img = np.transpose(img, (1, 2, 0))

    lo = np.percentile(img, 2, axis=(0, 1), keepdims=True)
    hi = np.percentile(img, 98, axis=(0, 1), keepdims=True)
    img = (img - lo) / (hi - lo + 1e-6)
    img = np.clip(img, 0, 1)
    rgb = (img * 255).astype(np.uint8)
    return ensure_hwc_rgb(rgb)

def colorize_mask(mask: np.ndarray) -> np.ndarray:
    palette = (SEMANTIC_CMAP(np.arange(NUM_CLASSES))[:, :3] * 255).astype(np.uint8)
    return palette[mask]


def ensure_hwc_rgb(rgb: np.ndarray) -> np.ndarray:
    """
    Normalize RGB to (H,W,3) uint8 regardless of whether it arrives as
    (H,W,3) or (3,H,W).
    """
    if rgb.ndim != 3:
        raise ValueError(f"RGB must be 3D, got {rgb.shape}")

    # CHW -> HWC
    if rgb.shape[0] == 3 and rgb.shape[-1] != 3:
        rgb = np.transpose(rgb, (1, 2, 0))

    if rgb.shape[-1] != 3:
        raise ValueError(f"RGB last dim must be 3, got {rgb.shape}")

    return rgb

def overlay(rgb: np.ndarray, mask: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    rgb = ensure_hwc_rgb(rgb)
    color = colorize_mask(mask)  # (H,W,3)

    if rgb.shape[:2] != color.shape[:2]:
        raise ValueError(f"RGB spatial {rgb.shape[:2]} != mask spatial {color.shape[:2]}")

    out = rgb.astype(np.float32) * (1 - alpha) + color.astype(np.float32) * alpha
    return out.astype(np.uint8)


def hist_plot(mask: np.ndarray):
    counts = np.bincount(mask.reshape(-1), minlength=NUM_CLASSES)
    labels = [CLASS_NAMES.get(i, str(i)) for i in range(NUM_CLASSES)]

    fig = plt.figure(figsize=(10, 4.5), dpi=120)
    plt.bar(np.arange(NUM_CLASSES), counts)
    plt.xticks(np.arange(NUM_CLASSES), labels, rotation=60, ha="right", fontsize=9)
    plt.xlabel("Class")
    plt.ylabel("Pixel count")
    plt.tight_layout()
    return fig


def legend_figure():
    fig = plt.figure(figsize=(3, 8), dpi=120)
    ax = plt.gca()
    ax.axis("off")
    ax.legend(
        handles=LEGEND_HANDLES,
        loc="center",
        bbox_to_anchor=(0.5, 0.5),
        frameon=True,
        fontsize=10,
        title="Class label",
        title_fontsize=12,
    )
    plt.tight_layout()
    return fig


# =============================
# Inference (TFLite)
# =============================
def predict_probs_tflite(arr_any_layout: np.ndarray) -> np.ndarray:
    """
    Returns probability tensor:
      - if model outputs (1,H,W,K): returns (1,1,H,W,K)
      - if model outputs (1,T,H,W,K): returns as-is
    """
    interpreter, in_det, out_det = load_tflite()

    x = arr_any_layout.astype(np.float32)
    x = to_thwc(x, expected_hw=EXPECTED_HW)
    x = align_to_T(x, TIME_SERIES_LENGTH)
    x = ensure_16_channels(x).astype(np.float32)

    x_b = np.expand_dims(x, axis=0).astype(np.float32)  # (1,61,128,128,16)

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

    if y.ndim == 4 and y.shape[-1] == NUM_CLASSES:
        return y[:, None, ...]  # (1,1,H,W,K)
    if y.ndim == 5 and y.shape[-1] == NUM_CLASSES:
        return y  # (1,T,H,W,K)

    raise RuntimeError(f"Unexpected output shape from TFLite: {y.shape}")


def mask_at_t_from_probs(probs: np.ndarray, t_idx: int) -> np.ndarray:
    # probs is either (1,1,H,W,K) or (1,T,H,W,K)
    if probs.shape[1] == 1:
        probs_t = probs[0, 0]
    else:
        probs_t = probs[0, t_idx]
    return np.argmax(probs_t, axis=-1).astype(np.int32)


# =============================
# Cached state for slider
# =============================
_STATE = {"aligned": None, "probs": None, "trace": ""}


def _infer_and_cache(arr: np.ndarray):
    thwc = to_thwc(arr, expected_hw=EXPECTED_HW)
    aligned = align_to_T(thwc, TIME_SERIES_LENGTH)
    model_in = ensure_16_channels(aligned.astype(np.float32))

    probs = predict_probs_tflite(arr)
    time_dependent = (probs.shape[1] == TIME_SERIES_LENGTH)

    trace = (
        f"orig={arr.shape} -> thwc={thwc.shape} -> aligned={aligned.shape} -> model_in={model_in.shape} | "
        f"tflite_probs={probs.shape} | time_dependent={time_dependent}"
    )
    if probs.shape[1] == 1:
        trace += " | NOTE: output is time-invariant (single mask reused for all timesteps)."

    _STATE["aligned"] = aligned
    _STATE["probs"] = probs
    _STATE["trace"] = trace

def fig_from_rgb(img: np.ndarray, title: str = "", figsize=(7.5, 7.5), dpi=140):
    """
    Render an (H,W,3) uint8 RGB image as a Matplotlib figure with controllable size.
    """
    img = ensure_hwc_rgb(img)
    fig = plt.figure(figsize=figsize, dpi=dpi)
    ax = fig.add_subplot(111)
    ax.imshow(img)
    ax.set_title(title, fontsize=12)
    ax.axis("off")
    fig.tight_layout(pad=0.2)
    return fig


def render_at_time(t_step: int):
    if _STATE["aligned"] is None or _STATE["probs"] is None:
        raise gr.Error("Run inference first (upload or sample).")

    t_idx = int(t_step) - 1
    aligned = _STATE["aligned"]
    probs = _STATE["probs"]

    rgb = to_rgb_at_t(aligned, t_idx)
    mask = mask_at_t_from_probs(probs, t_idx)
    mask_img = colorize_mask(mask)
    over = overlay(rgb, mask)
    hist_fig = hist_plot(mask)

    rgb_fig = fig_from_rgb(rgb, title=f"RGB (t={t_idx+1})")
    mask_fig = fig_from_rgb(mask_img, title=f"Mask (t={t_idx+1})")
    over_fig = fig_from_rgb(over, title=f"Overlay (t={t_idx+1})")

    return rgb_fig, mask_fig, over_fig, hist_fig, _STATE["trace"]



# =============================
# Gradio handlers
# =============================
def run_inference_from_npy(file_obj):
    if file_obj is None:
        raise gr.Error("Upload a .npy file first.")
    arr = np.load(file_obj.name)
    if arr.ndim != 4:
        raise gr.Error(f"Expected a 4D tensor, got {arr.shape}")

    _infer_and_cache(arr)
    t0 = TIME_SERIES_LENGTH
    rgb_fig, mask_fig, over_fig, hist_fig, trace = render_at_time(t0)
    return rgb_fig, mask_fig, over_fig, hist_fig, trace, t0


def run_inference_from_sample(sample_name):
    if not sample_name:
        raise gr.Error("Pick a sample first.")

    path = os.path.join("samples", sample_name)
    if not os.path.exists(path):
        raise gr.Error(f"Sample not found: {path}")

    arr = np.load(path)
    if arr.ndim != 4:
        raise gr.Error(f"Sample must be 4D, got {arr.shape}")

    _infer_and_cache(arr)
    t0 = TIME_SERIES_LENGTH
    rgb_fig, mask_fig, over_fig, hist_fig, trace = render_at_time(t0)
    return rgb_fig, mask_fig, over_fig, hist_fig, trace, t0

# =============================
# UI
# =============================
sample_files = []
if os.path.isdir("samples"):
    sample_files = sorted([f for f in os.listdir("samples") if f.endswith(".npy")])

with gr.Blocks(title="AgroVision | 16-Channel Segmentation (TFLite/Flex)") as demo:
    gr.Markdown(
        """
        # AgroVision: Spatiotemporal Deep Learning for Large-Scale Crop Mapping and Food Security Assessment
        ## Introduction
        **AgroVision** is an AI-driven system designed to analyze satellite image time series and produce fine-grained semantic maps of agricultural land use. By leveraging spatiotemporal deep learning models, AgroVision captures both the spatial structure of croplands and their temporal evolution across growing seasons, enabling robust identification of crop types at scale.

        The project addresses a core challenge in sustainable agriculture: transforming large volumes of Earth observation data into actionable agricultural intelligence. Accurate crop mapping supports food security assessment, yield forecasting, land-use monitoring, and data-informed agricultural policy, particularly in the context of climate variability and resource constraints. AgroVision demonstrates how modern deep learning architectures—combined with big data from satellite platforms—can enhance the transparency, efficiency, and sustainability of agricultural systems.
        
        At its core, AgroVision integrates multichannel satellite imagery, temporal modeling, and semantic segmentation to deliver pixel-level crop classification, offering an interpretable and scalable approach to agricultural monitoring.
        """
    )
    gr.Markdown(
        """
        ## Data Sources
        
        **AgroVision** is developed and evaluated using data from the *PASTIS (Panoptic Agricultural Satellite Time Series) benchmark dataset*, a large-scale, high-quality remote sensing dataset specifically designed for crop classification and agricultural land-use analysis."
        The PASTIS dataset provides:

        * Multispectral Sentinel-2 satellite image time series

        * High spatial resolution (parcel-level annotations)

        * Temporally dense observations covering full growing seasons

        * Expert-labeled crop categories suitable for supervised learning

        For more details on the dataset and its benchmark tasks, please refer to the official repository: https://github.com/VSainteuf/pastis-benchmark
        """)
    
    banner_uri = drive_png_data_uri()

    gr.HTML(
        f"""
        <div style="display:flex; justify-content:center; margin: 12px 0;">
        <img src="{banner_uri}" style="width:60%; max-width:1100px; border-radius:12px;">
        </div>
        """)
    
    file_path = os.path.join(os.path.dirname(__file__), "model.html")
    with open(file_path, "r", encoding='utf-8') as f:
        html_content = f.read()
    with gr.Blocks(title="U-Net Architecture") as demo2:
        gr.Markdown("## Model Architecture: 2D-Unet + ConvLSTM")
        
        # This component renders the raw HTML/SVG
        gr.HTML(html_content)

    gr.Markdown(
        """
        ## How to Use the Demo

        This interactive demo allows users to explore AgroVision’s spatiotemporal crop segmentation capabilities in two ways:

        ### Option 1: Upload Your Own Satellite Time Series

        Users may upload a satellite image time series saved as a NumPy (.npy) file. The input should represent a sequence of multispectral Sentinel-2 images over time, formatted as a 4D tensor (time × height × width × channels, or equivalent layouts). The system will automatically align the temporal length, preprocess spectral channels, and generate crop segmentation results for each timestep.

        ### Option 2: Explore Preloaded Sample Data

        Alternatively, users may select a sample dataset provided with the demo. These samples are drawn from the PASTIS benchmark and allow immediate exploration of the model’s predictions without requiring custom data preparation.

        ### Interactive Exploration

        After inference, users can navigate through time using the slider to observe how crop classifications evolve across the growing season. For each timestep, the interface displays:

        * The corresponding satellite RGB image

        * The predicted crop segmentation mask

        * A semantic overlay combining imagery and predictions

        * A class distribution histogram summarizing crop composition

        This design enables both qualitative inspection and high-level quantitative understanding of spatiotemporal agricultural patterns.
        """
    )

    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("## Upload")
            npy_in = gr.File(label="Upload .npy (4D tensor)", file_types=[".npy"])
            btn_upload = gr.Button("Run inference", variant="primary")

            gr.Markdown("## Samples")
            dd = gr.Dropdown(
                choices=sample_files,
                label="Select sample from /samples",
                value=sample_files[8] if sample_files else None,
            )
            btn_sample = gr.Button("Run sample")

        with gr.Column(scale=2):
                
            with gr.Row():
                t_slider = gr.Slider(
                    minimum=1,
                    maximum=TIME_SERIES_LENGTH,
                    value=TIME_SERIES_LENGTH,
                    step=1,
                    label="Timestep (1..61)"
                )
            with gr.Row():
                rgb_out = gr.Plot(label="RGB (t)")
            # with gr.Row():
                mask_out = gr.Plot(label="Mask (t)")
            # with gr.Row():
                overlay_out = gr.Plot(label="Overlay (t)")            
        
        # with gr.Column(scale = 0.2):
        #     legend_out = gr.Plot(label="Class legend", value=legend_figure())

    
    with gr.Row():
        # IMPORTANT: no height kwarg for gr.Plot in your Gradio version
        hist_out = gr.Plot(label="Class histogram (t)", scale=2)
        trace_out = gr.Textbox(label="Pipeline trace", lines=3)

    btn_upload.click(
        run_inference_from_npy,
        [npy_in],
        [rgb_out, mask_out, overlay_out, hist_out, trace_out, t_slider],
    )
    btn_sample.click(
        run_inference_from_sample,
        [dd],
        [rgb_out, mask_out, overlay_out, hist_out, trace_out, t_slider],
    )

    # older versions may not have .release; fallback to .change
    try:
        t_slider.release(render_at_time, [t_slider], [rgb_out, mask_out, overlay_out, hist_out, trace_out])
    except Exception:
        t_slider.change(render_at_time, [t_slider], [rgb_out, mask_out, overlay_out, hist_out, trace_out])

if __name__ == "__main__":
    demo.launch(ssr_mode=False)
