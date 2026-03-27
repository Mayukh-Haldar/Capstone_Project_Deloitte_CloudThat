import { ChevronLeft, ChevronRight } from "lucide-react";

const buildPaginationItems = (currentPage, totalPages) => {
    if (totalPages <= 1) {
        return [1];
    }
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (currentPage >= totalPages - 3) {
        return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
};

export function PageNavigation({
    currentPage,
    totalPages,
    onPageChange,
    className = "",
    compact = false
}) {
    if (totalPages <= 1) {
        return null;
    }
    const items = buildPaginationItems(currentPage, totalPages);
    return (<nav className={`flex items-center justify-center ${className}`.trim()} aria-label="Pagination">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-[28px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#101a33]">
        <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-[#2341d7] hover:text-[#2341d7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200">
          <ChevronLeft className="size-5"/>
        </button>

        <div className="flex items-center gap-1">
          {items.map((item, index) => item === "..." ? (<span key={`ellipsis-${index}`} className="px-3 text-slate-400">
                ...
              </span>) : (<button key={item} type="button" aria-current={item === currentPage ? "page" : undefined} onClick={() => onPageChange(item)} className={`inline-flex ${compact ? "size-10 text-sm" : "size-11 text-base"} items-center justify-center rounded-xl font-semibold transition ${item === currentPage
                    ? "bg-[#2341d7] text-white shadow-sm"
                    : "text-slate-700 hover:bg-[#eef2ff] hover:text-[#2341d7] dark:text-slate-200 dark:hover:bg-white/10"}`}>
                {item}
              </button>))}
        </div>

        <button type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-[#2341d7] hover:text-[#2341d7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200">
          <ChevronRight className="size-5"/>
        </button>
      </div>
    </nav>);
}
