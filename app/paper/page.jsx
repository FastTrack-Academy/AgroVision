const PAPER_URL = '/paper/agrovision-paper.pdf';
const PAPER_COVER_URL = '/paper/agrovision-paper-cover.png';

export const metadata = {
    title: 'Research Paper | AgroVision AI',
    description: 'Read the AgroVision research paper on spatiotemporal crop mapping.',
};

export default function PaperPage() {
    return (
        <main className="min-h-screen bg-[#F0F4F8] px-4 py-10 text-slate-800 sm:px-6 lg:py-14">
            <div className="mx-auto max-w-6xl">
                <section className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 p-7 text-white shadow-xl sm:p-10">
                    <div className="max-w-4xl">
                        <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                            Research Paper
                        </span>
                        <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                            AgroVision: Spatiotemporal Deep Learning for Large-Scale Crop Mapping and Food Security Assessment
                        </h1>
                        <p className="mt-5 text-base leading-relaxed text-emerald-50/80 sm:text-lg">
                            Bill Gu · Dr. Haoyan Jiang · Natural &amp; Applied Science — Climate &amp; Environment
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <a
                                href={PAPER_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
                            >
                                Open Full Screen
                            </a>
                            <a
                                href={PAPER_URL}
                                download="AgroVision-Research-Paper.pdf"
                                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                            >
                                Download PDF
                            </a>
                            <span className="self-center px-2 text-sm font-semibold text-emerald-100/70">
                                9 pages · June 26, 2026
                            </span>
                        </div>
                    </div>
                </section>

                <section
                    aria-labelledby="paper-viewer-heading"
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40"
                >
                    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                        <div>
                            <h2 id="paper-viewer-heading" className="font-black text-slate-800">
                                Paper Reader
                            </h2>
                            <p className="text-xs text-slate-500">
                                Use the browser toolbar to search, zoom, print, or navigate pages.
                            </p>
                        </div>
                        <a
                            href={PAPER_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-bold text-emerald-700 hover:text-emerald-600"
                        >
                            Open reader in a new tab ↗
                        </a>
                    </div>

                    <iframe
                        src={`${PAPER_URL}#view=FitH&toolbar=1&navpanes=0`}
                        title="AgroVision research paper PDF reader"
                        loading="lazy"
                        className="hidden h-[76vh] min-h-[620px] w-full bg-slate-200 md:block"
                    />

                    <div className="bg-slate-200 p-4 md:hidden">
                        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                            {/* The static cover bypasses image optimization so it also works in PDF fallback mode on Netlify. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={PAPER_COVER_URL}
                                alt="First page of the AgroVision research paper"
                                width={1020}
                                height={1320}
                                loading="lazy"
                                className="h-auto w-full"
                            />
                        </div>
                        <div className="px-3 py-6 text-center">
                            <p className="text-sm leading-relaxed text-slate-600">
                                Previewing page 1 of 9. Open the full PDF reader to navigate every page.
                            </p>
                            <a
                                href={PAPER_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15"
                            >
                                Open Full Paper Reader
                            </a>
                        </div>
                    </div>

                    <noscript>
                        <div className="p-8 text-center">
                            JavaScript is disabled.{' '}
                            <a href={PAPER_URL} className="font-bold text-emerald-700">
                                Open the PDF directly.
                            </a>
                        </div>
                    </noscript>
                </section>
            </div>
        </main>
    );
}
