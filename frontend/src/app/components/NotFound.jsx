import { ArrowLeft, CalendarSearch, Home } from "lucide-react";
import { Link, useNavigate } from "react-router";

export function NotFound() {
    const navigate = useNavigate();
    return (
        <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#f3f5f9] dark:bg-[#070d1f] flex items-center justify-center px-4">
            {/* Ambient orbs */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
                <div className="absolute -top-[10%] left-[50%] -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-blue-400/[0.13] blur-[120px] dark:bg-[#1132d4]/[0.22]" />
                <div className="absolute bottom-[5%] right-[10%] h-[400px] w-[400px] rounded-full bg-indigo-400/[0.09] blur-[100px] dark:bg-[#4f7cff]/[0.10]" />
            </div>

            <div className="relative z-10 w-full max-w-lg text-center">
                {/* Giant 404 */}
                <div className="relative inline-flex items-center justify-center select-none">
                    {/* Decorative ring — centered on the number */}
                    <div className="absolute h-48 w-48 rounded-full border-2 border-dashed border-[#1132d4]/25 dark:border-[#7aa3ff]/25 animate-[spin_18s_linear_infinite]" />
                    <span className="relative text-[clamp(7rem,20vw,10rem)] font-black tracking-tighter leading-none bg-gradient-to-br from-[#1132d4] via-[#4f7cff] to-[#a5b4fc] bg-clip-text text-transparent dark:from-[#7aa3ff] dark:via-[#4f7cff] dark:to-[#1132d4]">
                        404
                    </span>
                </div>

                <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100 sm:text-3xl">
                    Page not found
                </h1>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    The page you're looking for doesn't exist, was removed, or the link might be broken.
                </p>

                {/* Decorative divider */}
                <div className="my-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">what now?</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent" />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="size-4" />
                        Go back
                    </button>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f2bbf] transition-colors"
                    >
                        <Home className="size-4" />
                        Go home
                    </Link>
                    <Link
                        to="/events"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                    >
                        <CalendarSearch className="size-4" />
                        Browse events
                    </Link>
                </div>

                {/* URL hint */}
                <p className="mt-8 text-xs text-slate-400 dark:text-slate-600 font-mono break-all">
                    {typeof window !== "undefined" ? window.location.pathname : ""}
                </p>
            </div>
        </div>
    );
}
