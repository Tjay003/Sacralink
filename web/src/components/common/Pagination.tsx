import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    itemName?: string;
    className?: string;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
        return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50],
    itemName = 'items',
    className = '',
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    const pageNumbers = getPageNumbers(currentPage, totalPages);

    return (
        <div className={`card p-4 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
            {/* Left side: Item count indicator & optional page size dropdown */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                <div className="text-xs sm:text-sm text-muted">
                    Showing <span className="font-semibold text-foreground">{startItem}</span> to{' '}
                    <span className="font-semibold text-foreground">{endItem}</span> of{' '}
                    <span className="font-semibold text-foreground">{totalItems}</span> {itemName}
                </div>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted">
                        <span>Show</span>
                        <div className="relative inline-block">
                            <select
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                aria-label="Items per page"
                                className="appearance-none bg-white border border-border rounded-lg pl-2.5 pr-7 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs cursor-pointer hover:bg-secondary-50 transition-colors"
                            >
                                {pageSizeOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                        </div>
                        <span>per page</span>
                    </div>
                )}
            </div>

            {/* Right side: Prev, Numeric buttons with ellipsis, Next */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border border-border bg-white text-foreground hover:bg-secondary-50 shadow-xs hover:shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                </button>

                {/* Numeric Page Buttons */}
                <div className="flex items-center gap-1">
                    {pageNumbers.map((p, idx) => {
                        if (p === '...') {
                            return (
                                <span
                                    key={`ellipsis-${idx}`}
                                    className="inline-flex items-center justify-center min-w-[2rem] h-8 text-xs font-medium text-muted select-none"
                                >
                                    ...
                                </span>
                            );
                        }

                        const isActive = p === currentPage;
                        return (
                            <button
                                key={`page-${p}`}
                                type="button"
                                onClick={() => onPageChange(p)}
                                className={`min-w-[2rem] h-8 px-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                                    isActive
                                        ? 'bg-primary text-white border-primary shadow-xs'
                                        : 'bg-white text-foreground border-border hover:bg-secondary-50 shadow-xs hover:shadow-sm active:scale-95'
                                }`}
                                aria-label={`Page ${p}`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || totalItems === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border border-border bg-white text-foreground hover:bg-secondary-50 shadow-xs hover:shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none"
                    aria-label="Next page"
                >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
