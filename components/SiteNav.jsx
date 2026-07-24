'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/', label: 'Inference Lab' },
    { href: '/paper', label: 'Research Paper' },
];

function tabClassName(isActive) {
    return [
        'rounded-full px-4 py-2 text-sm font-bold transition-colors',
        isActive
            ? 'bg-emerald-400 text-slate-950 shadow-sm'
            : 'text-slate-300 hover:bg-white/10 hover:text-white',
    ].join(' ');
}

export default function SiteNav() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-[1000] border-b border-white/10 bg-slate-950/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <Link
                    href="/"
                    className="flex min-w-0 items-center gap-2.5 font-black tracking-tight text-white"
                    aria-label="AgroVision AI home"
                >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400 text-slate-950 shadow-sm">
                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-5 w-5 fill-none stroke-current"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 20c8 0 14-5 16-16-7 1-13 5-15 11" />
                            <path d="M4 20c1-5 5-9 10-12" />
                        </svg>
                    </span>
                    <span className="hidden sm:inline">AgroVision AI</span>
                </Link>

                <nav
                    aria-label="Primary navigation"
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1"
                >
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={tabClassName(isActive)}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
