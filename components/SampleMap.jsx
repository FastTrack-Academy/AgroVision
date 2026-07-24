'use client';

import { useEffect, useRef, useState } from 'react';

const SAMPLE_METADATA_URL = '/samples/metadata.json';
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

let sampleMetadataPromise;

function loadSampleMetadata() {
    if (!sampleMetadataPromise) {
        sampleMetadataPromise = fetch(SAMPLE_METADATA_URL).then((response) => {
            if (!response.ok) {
                throw new Error(`Location metadata request failed (${response.status})`);
            }
            return response.json();
        }).catch((error) => {
            sampleMetadataPromise = null;
            throw error;
        });
    }

    return sampleMetadataPromise;
}

export default function SampleMap({ sampleFilename }) {
    const containerRef = useRef(null);
    const [status, setStatus] = useState(sampleFilename ? 'loading' : 'unavailable');
    const [details, setDetails] = useState(null);

    useEffect(() => {
        if (!sampleFilename) {
            setStatus('unavailable');
            setDetails(null);
            return undefined;
        }

        let cancelled = false;
        let map;
        let resizeObserver;

        setStatus('loading');
        setDetails(null);

        async function initializeMap() {
            try {
                const [leafletModule, metadata] = await Promise.all([
                    import('leaflet'),
                    loadSampleMetadata(),
                ]);
                if (cancelled || !containerRef.current) return;

                const feature = metadata.features.find(
                    (candidate) => candidate.properties.sampleFilename === sampleFilename
                );
                if (!feature) {
                    throw new Error(`No PASTIS location found for ${sampleFilename}`);
                }

                const L = leafletModule.default ?? leafletModule;
                map = L.map(containerRef.current, {
                    attributionControl: true,
                    scrollWheelZoom: false,
                    zoomControl: true,
                });

                L.tileLayer(OSM_TILE_URL, {
                    attribution: '&copy; OpenStreetMap contributors',
                    maxZoom: 19,
                }).addTo(map);

                const patchLayer = L.geoJSON(feature, {
                    style: {
                        color: '#059669',
                        fillColor: '#10b981',
                        fillOpacity: 0.22,
                        opacity: 1,
                        weight: 3,
                    },
                }).addTo(map);

                patchLayer.bindTooltip(`PASTIS patch ${feature.properties.patchId}`, {
                    direction: 'top',
                    sticky: true,
                });
                map.fitBounds(patchLayer.getBounds(), {
                    maxZoom: 14,
                    padding: [24, 24],
                });
                L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

                resizeObserver = new ResizeObserver(() => map?.invalidateSize(false));
                resizeObserver.observe(containerRef.current);
                requestAnimationFrame(() => map?.invalidateSize(false));

                setDetails(feature.properties);
                setStatus('ready');
            } catch (error) {
                if (cancelled) return;
                console.error('Unable to initialize the sample location map:', error);
                setStatus('error');
            }
        }

        initializeMap();

        return () => {
            cancelled = true;
            resizeObserver?.disconnect();
            map?.remove();
        };
    }, [sampleFilename]);

    const [longitude, latitude] = details?.centroid ?? [];

    return (
        <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-1">Dataset Location</h3>
            <p className="h-5 text-xs text-slate-400 mb-2">
                {details ? `PASTIS patch ${details.patchId}` : 'Geographic context'}
            </p>
            <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-xl border-4 border-slate-100 bg-slate-100 shadow-sm">
                <div
                    ref={containerRef}
                    data-testid="sample-map"
                    aria-label={details
                        ? `Interactive map for PASTIS patch ${details.patchId}`
                        : 'Interactive sample location map'}
                    className="absolute inset-0 z-0"
                />

                {status === 'loading' && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100/90 text-center text-xs font-semibold text-slate-500">
                        Loading geographic context…
                    </div>
                )}

                {status === 'unavailable' && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100 px-6 text-center">
                        <div>
                            <p className="text-sm font-bold text-slate-600">No linked location</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                Uploaded tensors need a matching PASTIS patch ID.
                            </p>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-amber-50 px-6 text-center">
                        <div>
                            <p className="text-sm font-bold text-amber-800">Map unavailable</p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-700">
                                The prediction is still available above.
                            </p>
                        </div>
                    </div>
                )}

                {details && (
                    <div
                        data-testid="selected-map-patch"
                        className="pointer-events-none absolute left-2 top-2 z-[500] rounded-lg border border-white/80 bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur"
                    >
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                            Patch {details.patchId}
                        </p>
                        <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">
                            {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
