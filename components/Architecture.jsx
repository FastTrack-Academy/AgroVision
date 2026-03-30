import React from 'react';

const CONV_LSTM_SVG = `
        <svg class="conv-svg" viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="arrow-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#5c6bc0" />
            </marker>
            <marker id="arrow-down" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#8d6e63" />
            </marker>
        </defs>

        <text x="250" y="80" class="label" text-anchor="middle">T x C x H x W</text>
        <text x="650" y="80" class="label" text-anchor="middle">C x H x W</text>

        <g transform="translate(50, 50)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="30" height="120" class="orange-fill" />
            <path d="M40,10 L50,0 L50,110 L40,130 Z" class="orange-side" />
            
            <path d="M0,20 L30,20 L40,10 L10,10 Z" class="orange-side" />
            <rect x="0" y="20" width="30" height="120" class="orange-fill" />
            <path d="M30,20 L40,10 L40,120 L30,140 Z" class="orange-side" />
            
            <text x="15" y="160" class="sub-label">I</text>
        </g>

        <path d="M80,195 L80,240" class="arrow-down" marker-end="url(#arrow-down)" />

        <g transform="translate(80, 250)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" opacity="0.8"/>
            <rect x="10" y="10" width="30" height="90" class="orange-fill" style="fill:#ef9a9a; stroke:#c62828"/> <path d="M40,10 L50,0 L50,80 L40,100 Z" class="orange-side" />

            <path d="M20,20 L50,20 L60,10 L30,10 Z" class="orange-side" />
            <rect x="20" y="20" width="30" height="90" class="orange-fill" />
            <path d="M50,20 L60,10 L60,90 L50,110 Z" class="orange-side" />
             <text x="25" y="125" class="sub-label">1/2</text>
        </g>

        <path d="M120,365 L120,410" class="arrow-down" marker-end="url(#arrow-down)" />

        <g transform="translate(120, 420)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" opacity="0.8"/>
            <rect x="10" y="10" width="30" height="70" class="orange-fill" style="fill:#ef9a9a; stroke:#c62828"/>
            <path d="M40,10 L50,0 L50,60 L40,80 Z" class="orange-side" />

            <path d="M20,20 L50,20 L60,10 L30,10 Z" class="orange-side" />
            <rect x="20" y="20" width="30" height="70" class="orange-fill" />
            <path d="M50,20 L60,10 L60,70 L50,90 Z" class="orange-side" />
            <text x="25" y="105" class="sub-label">1/4</text>
        </g>

         <path d="M160,515 L160,560" class="arrow-down" marker-end="url(#arrow-down)" />

        <g transform="translate(160, 570)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" opacity="0.8"/>
            <rect x="10" y="10" width="30" height="50" class="orange-fill" style="fill:#ef9a9a; stroke:#c62828"/>
            <path d="M40,10 L50,0 L50,40 L40,60 Z" class="orange-side" />

            <path d="M20,20 L50,20 L60,10 L30,10 Z" class="orange-side" />
            <rect x="20" y="20" width="30" height="50" class="orange-fill" />
            <path d="M50,20 L60,10 L60,50 L50,70 Z" class="orange-side" />
            <text x="25" y="85" class="sub-label">1/8</text>
        </g>

         <path d="M210,645 L210,690" class="arrow-down" marker-end="url(#arrow-down)" />

        <g transform="translate(210, 700)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="30" height="40" class="orange-fill" style="fill:#ef9a9a; stroke:#c62828"/>
             <path d="M40,10 L50,0 L50,30 L40,50 Z" class="orange-side" />
            
             <path d="M20,20 L50,20 L60,10 L30,10 Z" class="orange-side" />
            <rect x="20" y="20" width="30" height="40" class="orange-fill" />
             <path d="M50,20 L60,10 L60,40 L50,60 Z" class="orange-side" />
             <text x="25" y="70" class="sub-label">1/16</text>
        </g>

        <line x1="280" y1="730" x2="310" y2="730" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="320" cy="730" r="12" class="op-circle" />
        <text x="320" y="730" class="op-text">X</text>
        <line x1="332" y1="730" x2="360" y2="730" class="arrow-line" marker-end="url(#arrow-blue)" />

        <g transform="translate(370, 710)">
            <path d="M0,0 L60,0 L80,-20 L20,-20 Z" class="green-side" />
            <rect x="0" y="0" width="60" height="40" class="green-fill" />
            <path d="M60,0 L80,-20 L80,20 L60,40 Z" class="green-side" />
            <text x="5" y="60" class="sub-label" style="font-weight:bold; font-size:11px;">ConvLSTM</text>
        </g>

        <line x1="450" y1="730" x2="480" y2="730" class="arrow-line" marker-end="url(#arrow-blue)" />
        <g transform="translate(480, 680)">
             <path d="M10,20 L40,20 L50,10 L20,10 Z" class="blue-side" />
            <rect x="10" y="20" width="30" height="60" class="blue-fill" opacity="0.9"/>
            <path d="M40,20 L50,10 L50,70 L40,80 Z" class="blue-side" />
        </g>
        
        <path d="M505,690 L505,630" class="arrow-line" marker-end="url(#arrow-blue)" />


        <line x1="100" y1="120" x2="330" y2="120" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="342" cy="120" r="10" class="op-circle" />
        <text x="342" y="120" class="op-text">||</text>
        <g transform="translate(360, 50)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="30" height="120" class="orange-fill" />
            <path d="M40,10 L50,0 L50,110 L40,130 Z" class="orange-side" />
             <text x="15" y="150" class="sub-label">I</text>
        </g>
        <line x1="410" y1="120" x2="720" y2="120" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="732" cy="120" r="10" class="op-circle" />
        <text x="732" y="120" class="op-text">||</text>

        <line x1="140" y1="300" x2="330" y2="300" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="342" cy="300" r="10" class="op-circle" />
        <text x="342" y="300" class="op-text">||</text>
        <g transform="translate(360, 250)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="30" height="90" class="orange-fill" />
            <path d="M40,10 L50,0 L50,80 L40,100 Z" class="orange-side" />
            <text x="15" y="115" class="sub-label">1/2</text>
        </g>
        <line x1="410" y1="300" x2="630" y2="300" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="642" cy="300" r="10" class="op-circle" />
        <text x="642" y="300" class="op-text">||</text>


        <line x1="180" y1="460" x2="330" y2="460" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="342" cy="460" r="10" class="op-circle" />
        <text x="342" y="460" class="op-text">||</text>
        <g transform="translate(360, 420)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="30" height="70" class="orange-fill" />
            <path d="M40,10 L50,0 L50,60 L40,80 Z" class="orange-side" />
            <text x="15" y="95" class="sub-label">1/4</text>
        </g>
        <line x1="410" y1="460" x2="530" y2="460" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="542" cy="460" r="10" class="op-circle" />
        <text x="542" y="460" class="op-text">||</text>
        <circle cx="572" cy="460" r="10" class="op-circle" />
        <text x="572" y="460" class="op-text">X</text>


        <line x1="240" y1="590" x2="330" y2="590" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="342" cy="590" r="10" class="op-circle" />
        <text x="342" y="590" class="op-text">||</text>
        <g transform="translate(360, 560)">
            <path d="M10,10 L40,10 L50,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="30" height="50" class="orange-fill" />
            <path d="M40,10 L50,0 L50,40 L40,60 Z" class="orange-side" />
            <text x="15" y="75" class="sub-label">1/8</text>
        </g>
        <line x1="410" y1="590" x2="450" y2="590" class="arrow-line" marker-end="url(#arrow-blue)" />
        <circle cx="462" cy="590" r="10" class="op-circle" />
        <text x="462" y="590" class="op-text">||</text>
         <circle cx="492" cy="590" r="10" class="op-circle" />
         <text x="492" y="590" class="op-text">X</text>
         <line x1="502" y1="590" x2="520" y2="590" class="arrow-line" marker-end="url(#arrow-blue)" />

        <g transform="translate(520, 540)">
             <path d="M10,10 L30,10 L40,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="20" height="80" class="orange-fill" />
            
             <path d="M30,10 L60,10 L70,0 L40,0 Z" class="blue-side" />
            <rect x="30" y="10" width="30" height="80" class="blue-fill" style="fill-opacity:0.8"/>
            <path d="M60,10 L70,0 L70,70 L60,90 Z" class="blue-side" />
            <text x="35" y="110" class="sub-label">32</text>
        </g>
        <path d="M570,540 L570,500" class="arrow-line" marker-end="url(#arrow-blue)" />
        <path d="M570,500 L590,480" class="arrow-line" /> <path d="M590,480 L590,460" class="arrow-line" marker-end="url(#arrow-blue)" />

        <g transform="translate(600, 390)">
             <path d="M10,10 L30,10 L40,0 L20,0 Z" class="orange-side" />
             <rect x="10" y="10" width="20" height="100" class="orange-fill" />
             
              <path d="M30,10 L70,10 L80,0 L40,0 Z" class="blue-side" />
             <rect x="30" y="10" width="40" height="100" class="blue-fill" style="fill-opacity:0.8"/>
             <path d="M70,10 L80,0 L80,90 L70,110 Z" class="blue-side" />
             <text x="35" y="130" class="sub-label">1/4</text>
        </g>
        <path d="M660,390 L660,330" class="arrow-line" marker-end="url(#arrow-blue)" />
        <path d="M660,330 L670,320" class="arrow-line" /> 
        <path d="M670,320 L670,300" class="arrow-line" marker-end="url(#arrow-blue)" />

        <g transform="translate(680, 220)">
             <path d="M10,10 L30,10 L40,0 L20,0 Z" class="orange-side" />
             <rect x="10" y="10" width="20" height="120" class="orange-fill" />
             
              <path d="M30,10 L80,10 L90,0 L40,0 Z" class="blue-side" />
             <rect x="30" y="10" width="50" height="120" class="blue-fill" style="fill-opacity:0.8"/>
             <path d="M80,10 L90,0 L90,110 L80,130 Z" class="blue-side" />
             <text x="45" y="150" class="sub-label">1/2</text>
        </g>
        <path d="M750,220 L750,170" class="arrow-line" marker-end="url(#arrow-blue)" />
        <path d="M750,170 L770,150" class="arrow-line" /> 
        <path d="M770,150 L770,120" class="arrow-line" marker-end="url(#arrow-blue)" />

        <g transform="translate(770, 20)">
            <path d="M10,10 L30,10 L40,0 L20,0 Z" class="orange-side" />
            <rect x="10" y="10" width="20" height="140" class="orange-fill" />
            
             <path d="M30,10 L70,10 L80,0 L40,0 Z" class="orange-side" style="fill:#ffe0b2"/>
            <rect x="30" y="10" width="40" height="140" class="orange-fill" />
            
            <path d="M80,10 L90,10 L100,0 L90,0 Z" class="purple-side" />
            <rect x="80" y="10" width="10" height="140" class="purple-fill" style="fill-opacity:0.6"/>
            <path d="M90,10 L100,0 L100,130 L90,150 Z" class="purple-side" />

            <text x="40" y="170" class="sub-label">I</text>
            <text x="85" y="170" class="sub-label">Softmax</text>
       </g>

       <line x1="880" y1="90" x2="920" y2="90" class="arrow-line" marker-end="url(#arrow-blue)" />

    </svg>
`;

const SEMANTIC_MAP_SVG = `
<div class="sem-wrapper">
    <svg width="0" height="0" style="position:absolute;">
        <defs>
            <path id="road" d="M110,0 L125,0 L120,50 L125,100 L115,180 L105,250 L90,320 L70,380 L30,450 L0,480 L0,500 L40,500 L80,440 L100,380 L115,320 L125,250 L135,180 L140,100 L135,50 L130,0 Z" />
            <path id="L1" d="M0,0 L110,0 L120,50 L125,100 L115,180 L105,250 L90,280 L0,280 Z" />
            <path id="L2" d="M0,280 L90,280 L90,320 L70,360 L0,360 Z" />
            <path id="L3" d="M0,360 L70,360 L70,380 L30,450 L0,480 Z" />
            <path id="L4" d="M0,480 L30,450 L40,500 L0,500 Z" />
            <path id="R1" d="M130,0 L200,0 L200,60 L135,50 Z" />
            <path id="R2" d="M200,0 L250,0 L250,70 L200,60 Z" />
            <path id="R3" d="M135,50 L200,60 L250,70 L250,220 L200,230 L180,310 L150,300 L125,250 L135,180 L140,100 Z" />
            <path id="R4" d="M200,230 L250,220 L250,260 L210,270 Z" />
            <path id="R5" d="M210,270 L250,260 L250,300 L220,310 Z" />
            <path id="R6" d="M150,300 L180,310 L220,310 L220,340 L160,340 Z" />
            <path id="R7" d="M160,340 L220,340 L230,370 L170,380 Z" />
            <path id="R8" d="M170,380 L230,370 L240,410 L180,430 Z" />
            <path id="R9" d="M180,430 L240,410 L250,460 L190,480 L130,430 Z" />
            <path id="R10" d="M115,320 L150,300 L160,340 L130,430 L100,380 Z" /> <path id="R11" d="M190,480 L250,460 L250,500 L200,500 Z" /> <path id="R12" d="M80,440 L130,430 L190,480 L200,500 L40,500 Z" /> 
        </defs>
    </svg>

    <div class="panel-group">
        <svg class="map-svg" viewBox="0 0 250 500">
            <rect width="250" height="500" fill="none" />
            <use href="#road" fill="rgba(255,255,255,0.4)" stroke="none" />
            <g stroke="white" stroke-width="1" fill="none" opacity="0.4">
                <use href="#L1"/> <use href="#L2"/> <use href="#L3"/>
                <use href="#R3"/> <use href="#R8"/> <use href="#R9"/>
            </g>
            <text x="125" y="250" text-anchor="middle" fill="#666" font-size="12" opacity="0.5">[Input Space]</text>
        </svg>
        <div class="panel-title">Satellite<br><span class="panel-subtitle">Observation</span></div>
    </div>

    <div class="panel-group hidden-mobile">
        <svg class="map-svg" viewBox="0 0 250 500">
            <rect width="250" height="500" fill="#000000" /> <use href="#L1" fill="#33a02c" /> <use href="#L2" fill="#33a02c" /> <use href="#L3" fill="#a6cee3" /> <use href="#road" fill="#000000" /> <use href="#R1" fill="#a6cee3" /> <use href="#R2" fill="#ffff33" /> <use href="#R3" fill="#ff7f00" /> <use href="#R4" fill="#984ea3" /> <use href="#R5" fill="#c2a5cf" /> <use href="#R6" fill="#8c564b" /> <use href="#R7" fill="#d8b365" /> <use href="#R8" fill="#e7298a" /> <use href="#R9" fill="#f781bf" /> <use href="#R10" fill="#999999" /> <use href="#R11" fill="#bdbdbd" /> <use href="#R12" fill="#859900" /> 
        </svg>
        <div class="panel-title">Semantic Map<br><span class="panel-subtitle">(What Crop?)</span></div>
    </div>

    <div class="panel-group hidden-mobile">
        <svg class="map-svg" viewBox="0 0 250 500">
            <rect width="250" height="500" fill="#000000" />
            <use href="#L1" fill="#2980b9" /> <use href="#L2" fill="#3498db" /> <use href="#L3" fill="#8e44ad" /> <use href="#road" fill="#000000" />
            <use href="#R1" fill="#9b59b6" /> <use href="#R2" fill="#f1c40f" /> <use href="#R3" fill="#e67e22" /> <use href="#R4" fill="#d35400" /> 
            <use href="#R5" fill="#c0392b" /> <use href="#R6" fill="#16a085" /> <use href="#R7" fill="#27ae60" /> <use href="#R8" fill="#2ecc71" /> 
            <use href="#R9" fill="#1abc9c" /> <use href="#R10" fill="#7f8c8d" /> <use href="#R11" fill="#bdc3c7" /> <use href="#R12" fill="#95a5a6" /> 
        </svg>
        <div class="panel-title">Instance Map<br><span class="panel-subtitle">(Which Parcel?)</span></div>
    </div>

    <div class="panel-group">
        <svg class="map-svg" viewBox="0 0 250 500">
            <rect width="250" height="500" fill="#000000" />
            <g stroke="#ffffff" stroke-width="2" stroke-linejoin="round">
                <use href="#L1" fill="#33a02c" />
                <use href="#L2" fill="#33a02c" />
                <use href="#L3" fill="#a6cee3" />
                <use href="#road" fill="#000000" stroke="none" /> <use href="#R1" fill="#a6cee3" />
                <use href="#R2" fill="#ffff33" />
                <use href="#R3" fill="#ff7f00" />
                <use href="#R4" fill="#984ea3" />
                <use href="#R5" fill="#c2a5cf" />
                <use href="#R6" fill="#8c564b" />
                <use href="#R7" fill="#d8b365" />
                <use href="#R8" fill="#e7298a" />
                <use href="#R9" fill="#f781bf" />
                <use href="#R10" fill="#999999" />
                <use href="#R11" fill="#bdbdbd" />
                <use href="#R12" fill="#859900" />
            </g>
        </svg>
        <div class="panel-title">Panoptic Output<br><span class="panel-subtitle">(What & Which?)</span></div>
    </div>
</div>
`;

export default function Architecture() {
    return (
        <section className="max-w-6xl mx-auto px-6 py-16 text-slate-800">
            <style>{`
                .conv-svg { display: block; margin: auto; max-width: 100%; height: auto; }
                .conv-svg text { font-family: Arial, sans-serif; }
                .conv-svg .label { font-size: 14px; font-weight: bold; fill: #333; }
                .conv-svg .sub-label { font-size: 10px; fill: #666; }
                .conv-svg .block-face { stroke: #333; stroke-width: 0.5; }
                .conv-svg .orange-fill { fill: #ffe0b2; stroke: #fb8c00; }
                .conv-svg .orange-side { fill: #ffb74d; stroke: #ef6c00; }
                .conv-svg .blue-fill { fill: #bbdefb; stroke: #1e88e5; }
                .conv-svg .blue-side { fill: #64b5f6; stroke: #1565c0; }
                .conv-svg .green-fill { fill: #c8e6c9; stroke: #43a047; }
                .conv-svg .green-side { fill: #81c784; stroke: #2e7d32; }
                .conv-svg .purple-fill { fill: #e1bee7; stroke: #8e24aa; }
                .conv-svg .purple-side { fill: #ba68c8; stroke: #6a1b9a; }
                .conv-svg .arrow-line { stroke: #5c6bc0; stroke-width: 1.5; fill: none; }
                .conv-svg .arrow-down { stroke: #8d6e63; stroke-width: 1.5; fill: none; stroke-dasharray: 4; }
                .conv-svg .op-circle { fill: #e8eaf6; stroke: #3f51b5; stroke-width: 1.5; }
                .conv-svg .op-text { font-size: 12px; font-weight: bold; fill: #3f51b5; text-anchor: middle; dominant-baseline: central; }

                .sem-wrapper { display: flex; gap: 1rem; width: 100%; justify-content: center; align-items: stretch; flex-wrap: wrap; }
                .panel-group { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; flex: 1; min-width: 120px; }
                .map-svg { width: 100%; max-width: 200px; height: auto; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                .panel-title { margin-top: 12px; font-weight: 700; font-size: 14px; text-align: center; color: #1e293b; }
                .panel-subtitle { font-weight: 400; font-size: 12px; color: #64748b; }
                @media (max-width: 768px) {
                    .hidden-mobile { display: none; }
                    .sem-wrapper { gap: 0.5rem; }
                }
            `}</style>
            
            <div className="mb-16">
                <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold tracking-widest uppercase mb-4">Problem Scope</div>
                <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight text-slate-800">The Challenge of Food Security at Global Scale</h2>
                <div className="text-lg text-slate-600 leading-relaxed max-w-4xl space-y-6">
                    <p>
                        Ensuring food security requires accurate, real-time knowledge of what crops are planted where, at scale. However, relying on manual agricultural surveys is slow, expensive, and scales poorly across vast continents. 
                    </p>
                    <p>
                        <strong>AgroVision</strong> leverages the powerful combination of Spatiotemporal Deep Learning and Earth Observation Data. By feeding full growing-season time-series data from <em>Sentinel-2 satellites</em> (such as the <strong>PASTIS</strong> benchmark dataset) into our deep networks, we can teach AI to understand the phenological signatures (the "growth fingerprint") of over 20 different crop types.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
                <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xl overflow-hidden shadow-emerald-900/5">
                    <img 
                        src="/banner.png" 
                        alt="Semantic and Panoptic Understanding" 
                        className="w-full h-auto rounded-2xl object-contain"
                    />
                </div>
                <div>
                    <h3 className="text-2xl font-bold mb-4">Semantic & Panoptic Understanding</h3>
                    <p className="text-slate-600 leading-relaxed mb-4">
                        We don't just classify a whole image. The network generates a <strong>Semantic Map</strong> telling us <em>what crop</em> exists at every single pixel (e.g., Winter wheat vs. Sunflowers), and attempts instance-level spatial separation bounding individual fields.
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                        The ultimate outcome is <strong>Panoptic Replication</strong>: a hybrid map predicting both the continuous crop class and distinct agricultural parcel boundaries simultaneously.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl overflow-hidden relative border border-slate-200">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="mb-8 relative z-10 text-center text-slate-800">
                    <h3 className="text-3xl font-black tracking-tight mb-3">Model Architecture Pipeline</h3>
                    <p className="text-slate-600 max-w-3xl mx-auto">
                        A fully-convolutional 2D U-Net acts as the spatial feature extractor, which feeds sequentially into a Convolutional LSTM (ConvLSTM) cell to preserve and interpret the temporal crop growth dynamics.
                    </p>
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-6 md:p-10 border border-slate-100 overflow-x-auto shadow-inner">
                    <div style={{minWidth: '800px'}} dangerouslySetInnerHTML={{ __html: CONV_LSTM_SVG }} />
                </div>
            </div>
            
        </section>
    );
}
