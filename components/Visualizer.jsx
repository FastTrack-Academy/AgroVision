'use client';
import { useEffect, useRef } from 'react';
import { CLASS_COLORS, CLASS_NAMES } from '../utils/constants';

export default function Visualizer({ rgbSeq, maskSeq, tStep }) {
    const rgbRef = useRef(null);
    const maskRef = useRef(null);
    const overlayRef = useRef(null);

    useEffect(() => {
        if (!rgbSeq || !maskSeq || tStep === undefined) return;
        
        const t = tStep; 
        const W = 128;
        const H = 128;
        const rgbOffset = t * W * H * 3;
        const maskOffset = t * W * H;

        // Draw RGB
        const rgbCtx = rgbRef.current.getContext('2d');
        const rgbData = rgbCtx.createImageData(W, H);
        for (let i = 0; i < W * H; i++) {
            rgbData.data[i * 4 + 0] = rgbSeq[rgbOffset + i * 3 + 0];
            rgbData.data[i * 4 + 1] = rgbSeq[rgbOffset + i * 3 + 1];
            rgbData.data[i * 4 + 2] = rgbSeq[rgbOffset + i * 3 + 2];
            rgbData.data[i * 4 + 3] = 255;
        }
        rgbCtx.putImageData(rgbData, 0, 0);

        // Draw Mask and Overlay
        const maskCtx = maskRef.current.getContext('2d');
        const maskData = maskCtx.createImageData(W, H);
        
        const overCtx = overlayRef.current.getContext('2d');
        const overData = overCtx.createImageData(W, H);

        for (let i = 0; i < W * H; i++) {
            const classIdx = maskSeq[maskOffset + i] || 0;
            const color = CLASS_COLORS[classIdx] || [0,0,0];
            
            // Mask
            maskData.data[i * 4 + 0] = color[0];
            maskData.data[i * 4 + 1] = color[1];
            maskData.data[i * 4 + 2] = color[2];
            maskData.data[i * 4 + 3] = 255;

            // Overlay (alpha blend 0.45 threshold)
            const rRgb = rgbSeq[rgbOffset + i * 3 + 0];
            const gRgb = rgbSeq[rgbOffset + i * 3 + 1];
            const bRgb = rgbSeq[rgbOffset + i * 3 + 2];

            overData.data[i * 4 + 0] = Math.round(rRgb * 0.55 + color[0] * 0.45);
            overData.data[i * 4 + 1] = Math.round(gRgb * 0.55 + color[1] * 0.45);
            overData.data[i * 4 + 2] = Math.round(bRgb * 0.55 + color[2] * 0.45);
            overData.data[i * 4 + 3] = 255;
        }
        maskCtx.putImageData(maskData, 0, 0);
        overCtx.putImageData(overData, 0, 0);
    }, [rgbSeq, maskSeq, tStep]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center">
                <h3 className="text-sm font-semibold mb-2">RGB Satellite (t={tStep+1})</h3>
                <canvas ref={rgbRef} width={128} height={128} className="w-full aspect-square border-4 border-slate-100 rounded-xl max-w-sm object-contain pixelated shadow-sm" style={{imageRendering: 'pixelated'}} />
            </div>
            <div className="flex flex-col items-center">
                <h3 className="text-sm font-semibold mb-2">Segmentation Prediction</h3>
                <canvas ref={maskRef} width={128} height={128} className="w-full aspect-square border-4 border-slate-100 rounded-xl max-w-sm object-contain pixelated shadow-sm" style={{imageRendering: 'pixelated'}} />
            </div>
            <div className="flex flex-col items-center">
                <h3 className="text-sm font-semibold mb-2">Alpha Overlay</h3>
                <canvas ref={overlayRef} width={128} height={128} className="w-full aspect-square border-4 border-slate-100 rounded-xl max-w-sm object-contain pixelated shadow-sm" style={{imageRendering: 'pixelated'}} />
            </div>
        </div>
    );
}

export function Histogram({ maskSeq, tStep }) {
    if (!maskSeq || tStep === undefined) return null;
    const t = tStep; 
    const W = 128;
    const H = 128;
    const maskOffset = t * W * H;

    const counts = new Array(CLASS_COLORS.length).fill(0);
    for (let i = 0; i < W * H; i++) {
        counts[maskSeq[maskOffset + i]]++;
    }

    const maxCount = Math.max(...counts, 1);

    return (
        <div className="mt-10 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
            <h3 className="text-sm font-semibold mb-6 text-slate-700 uppercase tracking-widest text-center">Class Distribution Profile</h3>
            <div className="flex items-end h-40 space-x-1 w-full relative">
                {counts.map((count, i) => (
                    <div key={i} className="flex flex-col justify-end items-center group relative flex-1 h-full">
                        <div 
                            className="w-full rounded-t-sm transition-all duration-300 ease-in-out cursor-pointer hover:opacity-100 opacity-80"
                            style={{ 
                                height: `${Math.max((count / maxCount) * 100, 1)}%`,
                                backgroundColor: `rgb(${CLASS_COLORS[i].join(',')})`
                            }}
                        />
                        <div className="hidden group-hover:block absolute bottom-full mb-3 bg-slate-900 border border-slate-700 text-white text-xs font-semibold py-1.5 px-3 rounded whitespace-nowrap z-10 shadow-xl">
                            <span className="opacity-75 font-normal block mb-0.5">Class {i}</span>
                            {CLASS_NAMES[i]}: <span className="text-emerald-300">{count} px</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
