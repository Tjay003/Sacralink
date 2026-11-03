import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Base pulsing skeleton primitive.
 * Styled with Sacralink clean light/dark design tokens.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-xl bg-secondary-100/80 dark:bg-secondary-800/60",
                className
            )}
            {...props}
        />
    );
}

export interface TableSkeletonProps {
    rows?: number;
    columns?: number;
    isTableRow?: boolean;
    className?: string;
}

/**
 * TableSkeleton - Renders stationary skeleton rows with pulsing cells inside <tbody>.
 * Preserves the table headers and pagination without unmounting or jarring layout jumps.
 */
export function TableSkeleton({
    rows = 5,
    columns = 4,
    isTableRow = true,
    className,
}: TableSkeletonProps) {
    const rowList = Array.from({ length: rows });
    const colList = Array.from({ length: columns });

    const content = rowList.map((_, rowIndex) => (
        <tr
            key={rowIndex}
            className={cn("border-b border-border/60 transition-colors", className)}
        >
            {colList.map((_, colIndex) => {
                // Vary width naturally to mimic realistic cell data
                const widthClass =
                    colIndex === 0
                        ? "w-3/4 max-w-[180px]"
                        : colIndex === columns - 1
                        ? "w-1/2 max-w-[100px] ml-auto"
                        : colIndex % 2 === 0
                        ? "w-2/3 max-w-[140px]"
                        : "w-1/2 max-w-[110px]";

                return (
                    <td
                        key={colIndex}
                        className={cn(
                            "py-4 px-4 sm:px-6 align-middle",
                            colIndex === columns - 1 ? "text-right" : "text-left"
                        )}
                    >
                        <Skeleton className={cn("h-4", widthClass)} />
                    </td>
                );
            })}
        </tr>
    ));

    if (isTableRow) {
        return <>{content}</>;
    }

    return <tbody className="divide-y divide-border/60">{content}</tbody>;
}

export interface CardGridSkeletonProps {
    count?: number;
    className?: string;
}

/**
 * CardGridSkeleton - Renders a responsive grid of church card skeletons.
 * Features 16:9 banner box, avatar circle, title lines, location tag, and pill badges.
 */
export function CardGridSkeleton({ count = 6, className }: CardGridSkeletonProps) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
            {Array.from({ length: count }).map((_, idx) => (
                <div
                    key={idx}
                    className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col"
                >
                    {/* 16:9 Aspect Banner Box */}
                    <div className="relative aspect-video w-full bg-secondary-100/80 dark:bg-secondary-800/60 animate-pulse">
                        {/* Pill badge in top right */}
                        <div className="absolute top-4 right-4">
                            <Skeleton className="h-6 w-20 rounded-full bg-white/70 dark:bg-secondary-700/60" />
                        </div>
                        {/* Avatar circle overlapping banner */}
                        <div className="absolute -bottom-5 left-5">
                            <div className="w-12 h-12 rounded-full border-2 border-white dark:border-secondary-900 bg-secondary-200/90 dark:bg-secondary-700/80 animate-pulse shadow-xs" />
                        </div>
                    </div>

                    {/* Content body */}
                    <div className="p-5 pt-7 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                            {/* Title lines */}
                            <Skeleton className="h-5 w-3/4 rounded-lg" />
                            <Skeleton className="h-4 w-1/2 rounded-md" />
                            {/* Location tag */}
                            <div className="pt-2 flex items-center gap-2">
                                <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                                <Skeleton className="h-3.5 w-3/5 rounded-md" />
                            </div>
                        </div>

                        {/* Pill badges / footer row */}
                        <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                            <Skeleton className="h-6 w-24 rounded-full" />
                            <Skeleton className="h-8 w-20 rounded-xl" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * DetailHeaderSkeleton - Renders sanctuary detail header skeleton.
 * Anchors cover placeholder, round avatar, title block, action buttons, metric strip, and tab bar.
 */
export function DetailHeaderSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("space-y-6 pb-16", className)}>
            {/* Top Breadcrumb Navigation Placeholder */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Skeleton className="h-4 w-16 rounded-md" />
                <span className="text-secondary-300">/</span>
                <Skeleton className="h-4 w-36 rounded-md" />
            </div>

            {/* Modern Unified Hero & Metrics Card */}
            <div className="bg-white border border-border/80 shadow-xs rounded-3xl relative overflow-hidden">
                {/* Part A: 16:9 / Top Cover Banner */}
                <div className="h-32 sm:h-44 w-full bg-secondary-100/80 dark:bg-secondary-800/60 animate-pulse relative rounded-t-[23px]">
                    {/* Overlapping Icon/Avatar Badge */}
                    <div className="absolute -bottom-8 left-6 sm:left-8 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center z-10 overflow-hidden p-1">
                        <Skeleton className="w-full h-full rounded-xl" />
                    </div>
                </div>

                {/* Part B: Card Body (Below Banner) */}
                <div className="pt-11 sm:pt-12 px-6 sm:px-8 pb-6 space-y-3 relative z-20">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-6 w-28 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                    </div>

                    {/* Parish Title Block */}
                    <div className="space-y-1.5 mt-1 mb-1">
                        <Skeleton className="h-8 sm:h-9 w-2/3 max-w-md rounded-xl" />
                    </div>

                    {/* Sub-metadata row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm pt-1">
                        <Skeleton className="h-4 w-44 rounded-md" />
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-4 w-36 rounded-md" />
                    </div>

                    {/* Actions row */}
                    <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <Skeleton className="h-9 w-36 rounded-xl" />
                            <Skeleton className="h-9 w-24 rounded-xl" />
                            <Skeleton className="h-9 w-32 rounded-xl" />
                            <Skeleton className="h-9 w-10 rounded-xl" />
                        </div>
                        <Skeleton className="h-9 w-24 rounded-xl" />
                    </div>
                </div>

                {/* Part C: Integrated 3-Column Metric Strip */}
                <div className="border-t border-border/80 divide-x divide-border/80 grid grid-cols-3 bg-white rounded-b-3xl">
                    <div className="px-4 sm:px-6 py-4 space-y-1.5">
                        <Skeleton className="h-6 w-16 rounded-md" />
                        <Skeleton className="h-3.5 w-24 rounded-md" />
                    </div>
                    <div className="px-4 sm:px-6 py-4 space-y-1.5">
                        <Skeleton className="h-6 w-16 rounded-md" />
                        <Skeleton className="h-3.5 w-24 rounded-md" />
                    </div>
                    <div className="px-4 sm:px-6 py-4 space-y-1.5">
                        <Skeleton className="h-6 w-16 rounded-md" />
                        <Skeleton className="h-3.5 w-24 rounded-md" />
                    </div>
                </div>
            </div>

            {/* Segmented Tab Track Placeholder */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary-100/70 dark:bg-secondary-800/60 border border-border/60 gap-1.5">
                    <Skeleton className="h-8 w-24 rounded-xl" />
                    <Skeleton className="h-8 w-20 rounded-xl" />
                    <Skeleton className="h-8 w-28 rounded-xl" />
                    <Skeleton className="h-8 w-24 rounded-xl" />
                </div>
            </div>

            {/* Tab content placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                <div className="lg:col-span-2 bg-white border border-border rounded-2xl p-6 shadow-xs space-y-4">
                    <Skeleton className="h-6 w-1/3 rounded-lg" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-5/6 rounded-md" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                    <div className="pt-4 grid grid-cols-2 gap-4">
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                    </div>
                </div>
                <div className="bg-white border border-border rounded-2xl p-6 shadow-xs space-y-4">
                    <Skeleton className="h-6 w-1/2 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

/**
 * AppointmentHeroSkeleton - Dignified hero card skeleton matching the User Dashboard appointment card.
 */
export function AppointmentHeroSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("bg-white border border-border rounded-2xl p-6 shadow-xs space-y-4", className)}>
            {/* Card Header: Icon + Title + Status Pill */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <Skeleton className="h-5 w-40 rounded-lg" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
            </div>

            {/* Appointment Title */}
            <div className="space-y-1.5 mt-2">
                <Skeleton className="h-7 w-3/5 rounded-lg" />
            </div>

            {/* Date, Time & Church Meta */}
            <div className="flex flex-wrap items-center gap-4 mt-2">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-4 w-44 rounded-md" />
            </div>

            {/* Action buttons */}
            <div className="pt-4 flex items-center gap-3 border-t border-border/40">
                <Skeleton className="h-9 w-28 rounded-xl" />
                <Skeleton className="h-9 w-32 rounded-xl" />
            </div>
        </div>
    );
}

/**
 * ParishCardSkeleton - Dignified skeleton matching the UserHomeParishCard.
 */
export function ParishCardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("bg-white border border-border rounded-2xl p-6 shadow-xs space-y-4", className)}>
            {/* Header badge */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Body */}
            <div className="space-y-2 mt-3">
                <Skeleton className="h-6 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>

            {/* Mass time & schedule block */}
            <div className="p-3.5 rounded-xl bg-secondary-50/70 border border-border/60 space-y-2">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-5 w-48 rounded-md" />
            </div>

            {/* Actions button */}
            <Skeleton className="h-10 w-full rounded-xl" />
        </div>
    );
}
