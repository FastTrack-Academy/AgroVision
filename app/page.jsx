'use client';
import { useState, useRef } from 'react';
import Visualizer, { Histogram } from '../components/Visualizer';
import Architecture from '../components/Architecture';

const SAMPLES = [
    "S2_10001.npy", "S2_10002.npy", "S2_10003.npy",
    "S2_10004.npy", "S2_10005.npy", "S2_10006.npy",
    "S2_10007.npy", "S2_10008.npy", "S2_10009.npy",
    "S2_10010.npy", "S2_10011.npy"
];

export default function Home() {
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tStep, setTStep] = useState(60);
    const [maskSeq, setMaskSeq] = useState(null);
    const [rgbSeq, setRgbSeq] = useState(null);

    const processResponseBuffer = async (response) => {
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Unknown API Error");
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 3997696) {
            throw new Error("Invalid output received from the server. Model missing or misconfigured!");
        }
        // 61 * 128 * 128 = 999,424 bytes for Mask
        const maskBuf = new Uint8Array(buffer, 0, 999424);
        // 61 * 128 * 128 * 3 = 2,998,272 bytes for RGB
        const rgbBuf = new Uint8Array(buffer, 999424, 2998272);

        setMaskSeq(maskBuf);
        setRgbSeq(rgbBuf);
        setTStep(60);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Bypass Next.js rewrites body size limit in dev
            const apiUrl = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5328/api/predict' : '/api/predict';
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            await processResponseBuffer(response);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSampleLoad = async (filename) => {
        setLoading(true);
        setError('');
        try {
            // Highly optimized: Tell backend to read the sample directly from disk.
            // Bypasses Next 10MB rewrite limits and Vercel 4.5MB Serverless payload limits.
            const formData = new FormData();
            formData.append('sample', filename);

            const apiUrl = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5328/api/predict' : '/api/predict';
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            await processResponseBuffer(response);
        } catch (err) {
            console.error(err);
            setError("Error loading sample: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#F0F4F8] font-sans text-slate-800">
            {/* Header / Hero */}
            <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white py-20 px-6 shadow-md relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="max-w-5xl mx-auto flex flex-col items-center text-center relative z-10">
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-white drop-shadow-sm">
                        AgroVision AI
                    </h1>
                    <p className="text-xl md:text-2xl font-light text-emerald-50/90 max-w-3xl leading-relaxed">
                        Spatiotemporal Deep Learning for <span className="font-semibold text-emerald-300">Large-Scale Crop Mapping</span> and Food Security Assessment
                    </p>
                </div>
            </div>

            <Architecture />

            <div className="max-w-5xl mx-auto px-6 py-12 -mt-10 relative z-20">
                <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-white p-8 md:p-10 mb-10">
                    <h2 className="text-2xl font-bold mb-3 text-slate-800">How to Use the System</h2>
                    <p className="text-slate-600 text-lg leading-relaxed mb-8 border-l-4 border-emerald-400 pl-4 bg-emerald-50/50 py-2 rounded-r-lg">
                        AgroVision analyzes full-season satellite time series (4D tensors) via ConvLSTM-UNet architecture
                        to produce fine-grained semantic 16-channel crop maps. Upload your `.npy` tensor below.
                    </p>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Upload */}
                        <div className="flex-1 bg-slate-50 border border-slate-100 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-2xl"></div>
                            <h3 className="font-bold text-xl text-slate-800 mb-2 pl-2">Upload Data</h3>
                            <p className="text-base text-slate-500 mb-6 pl-2">Provide a .npy Tensor (Time, H, W, Channels). We support both C-first and C-last formats up to 61 sequence slices.</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".npy" className="hidden" />
                            <button
                                onClick={() => fileInputRef.current.click()}
                                disabled={loading}
                                className="w-full bg-slate-800 hover:bg-black text-white transition-all transform hover:-translate-y-[1px] duration-200 py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/10 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
                            >
                                {loading ? "Computing Network Inference..." : "Upload .npy Architecture"}
                            </button>
                        </div>

                        {/* Samples */}
                        <div className="flex-1 bg-slate-50 border border-slate-100 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-teal-500 rounded-l-2xl"></div>
                            <h3 className="font-bold text-xl text-slate-800 mb-2 pl-2">Run Samples</h3>
                            <p className="text-base text-slate-500 mb-6 pl-2">Don't have a dataset? Explore inference visually using benchmark subsets from the PASTIS validation set.</p>
                            <div className="relative">
                                <select
                                    onChange={(e) => handleSampleLoad(e.target.value)}
                                    disabled={loading}
                                    className="w-full bg-white shadow-inner border-2 border-slate-200 text-slate-700 py-4 px-4 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50 font-medium cursor-pointer appearance-none"
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select Validation Sequence...</option>
                                    {SAMPLES.map(s => <option key={s} value={s} className="my-2">{s}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-800 border-l-4 border-red-500 p-6 rounded-r-2xl mb-10 shadow-sm animate-pulse">
                        <span className="font-bold uppercase text-xs tracking-wider opacity-60 block mb-1">Inference Engine Error</span>
                        {error}
                    </div>
                )}

                {maskSeq && rgbSeq && (
                    <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-6 md:p-12 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="mb-14 text-center relative max-w-2xl mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                            <div className="flex justify-between items-center mb-6">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Temporal Evolution Range</label>
                                <span className="bg-emerald-500 text-white shadow-md py-1.5 px-4 rounded-full text-sm font-bold tabular-nums relative overflow-hidden">
                                    <span className="relative z-10">t = {tStep + 1} / 61</span>
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0" max="60"
                                value={tStep}
                                onChange={(e) => setTStep(parseInt(e.target.value))}
                                className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all hover:h-4 active:bg-slate-300"
                            />
                            <div className="flex justify-between text-xs font-bold text-slate-400 mt-3 px-1">
                                <span>Day 1</span>
                                <span>Day 30</span>
                                <span>Day 61</span>
                            </div>
                        </div>

                        <Visualizer rgbSeq={rgbSeq} maskSeq={maskSeq} tStep={tStep} />
                        <Histogram maskSeq={maskSeq} tStep={tStep} />
                    </div>
                )}
            </div>
        </main>
    );
}
