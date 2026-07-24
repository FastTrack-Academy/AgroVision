'use client';
import { useCallback, useEffect, useRef } from 'react';
import { CLASS_COLORS, CLASS_NAMES } from '../utils/constants';
import SampleMap from './SampleMap';

const CANVAS_SIZE = 128;

function InteractiveCropCanvas({
    canvasRef,
    maskSeq,
    maskOffset,
    title,
    tooltipId,
    activeTooltipRef,
}) {
    const tooltipRef = useRef(null);
    const swatchRef = useRef(null);
    const classNameRef = useRef(null);
    const classNumberRef = useRef(null);
    const lastClassRef = useRef(-1);

    const hideTooltip = useCallback(() => {
        if (!tooltipRef.current) return;
        tooltipRef.current.style.opacity = '0';
        tooltipRef.current.setAttribute('aria-hidden', 'true');
        if (activeTooltipRef.current === tooltipRef.current) {
            activeTooltipRef.current = null;
        }
    }, [activeTooltipRef]);

    const showCropAtPointer = useCallback((event) => {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const pixelX = Math.min(
            CANVAS_SIZE - 1,
            Math.max(0, Math.floor((localX / rect.width) * CANVAS_SIZE))
        );
        const pixelY = Math.min(
            CANVAS_SIZE - 1,
            Math.max(0, Math.floor((localY / rect.height) * CANVAS_SIZE))
        );
        const classIndex = maskSeq[maskOffset + pixelY * CANVAS_SIZE + pixelX] ?? 0;
        const color = CLASS_COLORS[classIndex] ?? CLASS_COLORS[0];

        if (lastClassRef.current !== classIndex) {
            lastClassRef.current = classIndex;
            swatchRef.current.style.backgroundColor = `rgb(${color.join(',')})`;
            classNameRef.current.textContent = CLASS_NAMES[classIndex] ?? `Class ${classIndex}`;
            classNumberRef.current.textContent = `Class ${classIndex} · pixel ${pixelX}, ${pixelY}`;
        }

        const tooltip = tooltipRef.current;
        if (activeTooltipRef.current && activeTooltipRef.current !== tooltip) {
            activeTooltipRef.current.style.opacity = '0';
            activeTooltipRef.current.setAttribute('aria-hidden', 'true');
        }
        activeTooltipRef.current = tooltip;
        const tooltipWidth = 190;
        const tooltipHeight = 64;
        const left = Math.min(
            Math.max(localX + 14, 8),
            Math.max(8, rect.width - tooltipWidth)
        );
        const top = Math.min(
            Math.max(localY - tooltipHeight, 8),
            Math.max(8, rect.height - tooltipHeight)
        );
        tooltip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        tooltip.style.opacity = '1';
        tooltip.setAttribute('aria-hidden', 'false');
    }, [activeTooltipRef, maskOffset, maskSeq]);

    return (
        <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
            <p className="h-5 text-xs text-slate-400 mb-2">Hover to inspect crop type</p>
            <div className="relative w-full max-w-sm">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_SIZE}
                    height={CANVAS_SIZE}
                    onPointerMove={showCropAtPointer}
                    onPointerLeave={hideTooltip}
                    aria-label={`${title}. Hover over the image to inspect the predicted crop type.`}
                    className="w-full aspect-square border-4 border-slate-100 rounded-xl object-contain pixelated shadow-sm cursor-crosshair"
                    style={{imageRendering: 'pixelated'}}
                />
                <div
                    ref={tooltipRef}
                    data-testid={tooltipId}
                    aria-hidden="true"
                    className="absolute left-0 top-0 z-20 min-w-44 pointer-events-none opacity-0 rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-white shadow-2xl transition-opacity duration-75"
                >
                    <div className="flex items-center gap-2">
                        <span
                            ref={swatchRef}
                            className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40"
                        />
                        <span ref={classNameRef} className="text-sm font-bold" />
                    </div>
                    <span
                        ref={classNumberRef}
                        className="mt-0.5 block pl-5.5 text-[11px] text-slate-300"
                    />
                </div>
            </div>
        </div>
    );
}

export default function Visualizer({ rgbSeq, maskSeq, tStep, sampleFilename }) {
    const rgbRef = useRef(null);
    const maskRef = useRef(null);
    const overlayRef = useRef(null);
    const activeTooltipRef = useRef(null);

    useEffect(() => {
        if (!rgbSeq || !maskSeq || tStep === undefined) return;
        
        const t = tStep; 
        const W = CANVAS_SIZE;
        const H = CANVAS_SIZE;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col items-center">
                <h3 className="text-sm font-semibold mb-1">RGB Satellite (t={tStep+1})</h3>
                <p className="h-5 text-xs text-slate-400 mb-2">Temporal satellite composite</p>
                <canvas ref={rgbRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="w-full aspect-square border-4 border-slate-100 rounded-xl max-w-sm object-contain pixelated shadow-sm" style={{imageRendering: 'pixelated'}} />
            </div>
            <InteractiveCropCanvas
                canvasRef={maskRef}
                maskSeq={maskSeq}
                maskOffset={tStep * CANVAS_SIZE * CANVAS_SIZE}
                title="Segmentation Prediction"
                tooltipId="segmentation-tooltip"
                activeTooltipRef={activeTooltipRef}
            />
            <InteractiveCropCanvas
                canvasRef={overlayRef}
                maskSeq={maskSeq}
                maskOffset={tStep * CANVAS_SIZE * CANVAS_SIZE}
                title="Alpha Overlay"
                tooltipId="overlay-tooltip"
                activeTooltipRef={activeTooltipRef}
            />
            <SampleMap sampleFilename={sampleFilename} />
        </div>
    );
}

export function Histogram({ maskSeq, tStep }) {
    if (!maskSeq || tStep === undefined) return null;
    const t = tStep; 
    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;
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
