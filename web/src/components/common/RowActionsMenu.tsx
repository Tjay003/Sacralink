import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export type RowActionTone = 'default' | 'danger' | 'warning' | 'success';

export interface RowAction {
    key: string;
    label: string;
    icon?: ReactNode;
    onSelect: () => void;
    tone?: RowActionTone;
    /** When set, the item is shown greyed out with this reason instead of running. */
    disabledReason?: string;
}

interface RowActionsMenuProps {
    actions: RowAction[];
    /** Accessible name of the trigger, e.g. "More actions for Maria Santos". */
    label: string;
    className?: string;
}

const TONE_CLASSES: Record<RowActionTone, string> = {
    default: 'text-foreground hover:bg-secondary-100 focus-visible:bg-secondary-100',
    danger: 'text-red-700 hover:bg-red-50 focus-visible:bg-red-50',
    warning: 'text-amber-700 hover:bg-amber-50 focus-visible:bg-amber-50',
    success: 'text-emerald-700 hover:bg-emerald-50 focus-visible:bg-emerald-50',
};

const MENU_WIDTH = 224;
const VIEWPORT_MARGIN = 8;
const ENABLED_ITEM = 'button[role="menuitem"]:not([aria-disabled="true"])';

interface MenuPosition {
    top?: number;
    bottom?: number;
    left: number;
}

/**
 * RowActionsMenu - the "..." overflow menu for a table or card row. The panel renders in a portal with fixed
 * positioning so a scrolling table wrapper never clips it, and it flips upward near the bottom of the screen.
 * Keyboard: Enter/Space/ArrowDown open, arrows/Home/End move, Escape closes and returns focus to the trigger.
 */
export default function RowActionsMenu({ actions, label, className = '' }: RowActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const positioned = position !== null;

    const close = useCallback((returnFocus: boolean) => {
        setOpen(false);
        setPosition(null);
        if (returnFocus) triggerRef.current?.focus();
    }, []);

    const openMenu = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const width = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
        const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.right - width, window.innerWidth - width - VIEWPORT_MARGIN));
        const menuHeight = actions.reduce((sum, action) => sum + (action.disabledReason ? 56 : 40), 8);
        const fitsBelow = rect.bottom + 4 + menuHeight <= window.innerHeight - VIEWPORT_MARGIN;
        setPosition(fitsBelow ? { top: rect.bottom + 4, left } : { bottom: window.innerHeight - rect.top + 4, left });
        setOpen(true);
    };

    useEffect(() => {
        if (open && positioned) menuRef.current?.querySelector<HTMLButtonElement>(ENABLED_ITEM)?.focus();
    }, [open, positioned]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            close(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close(true);
            }
        };
        const anchor = triggerRef.current?.getBoundingClientRect();
        const onResize = () => close(false);
        // Close only when scrolling actually moved the trigger away from the menu
        const onScroll = (e: Event) => {
            if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
            const now = triggerRef.current?.getBoundingClientRect();
            if (!anchor || !now || Math.abs(now.top - anchor.top) > 1 || Math.abs(now.left - anchor.left) > 1) close(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open, close]);

    const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(ENABLED_ITEM) ?? []);
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        let next = -1;
        if (e.key === 'ArrowDown') next = (index + 1) % items.length;
        else if (e.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = items.length - 1;
        else if (e.key === 'Tab') {
            close(false);
            return;
        }
        if (next >= 0) {
            e.preventDefault();
            items[next].focus();
        }
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            openMenu();
        }
    };

    if (actions.length === 0) return null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={label}
                title="More actions"
                onClick={() => (open ? close(false) : openMenu())}
                onKeyDown={handleTriggerKeyDown}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white text-secondary-700 hover:bg-secondary-100 focus-visible:outline-2 focus-visible:outline-primary transition-colors shadow-sm cursor-pointer shrink-0 ${open ? 'bg-secondary-100' : ''} ${className}`}
            >
                <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    onKeyDown={handleMenuKeyDown}
                    style={{
                        position: 'fixed',
                        top: position?.top,
                        bottom: position?.bottom,
                        left: position?.left ?? 0,
                        width: Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
                    }}
                    className="z-[9998] rounded-xl border border-border bg-white p-1 shadow-lg"
                >
                    {actions.map((action) => {
                        const disabled = Boolean(action.disabledReason);
                        return (
                            <button
                                key={action.key}
                                type="button"
                                role="menuitem"
                                aria-disabled={disabled || undefined}
                                tabIndex={-1}
                                title={action.disabledReason}
                                onClick={() => {
                                    if (disabled) return;
                                    close(false);
                                    action.onSelect();
                                }}
                                className={`w-full flex items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition-colors ${
                                    disabled ? 'text-muted cursor-not-allowed' : `cursor-pointer ${TONE_CLASSES[action.tone ?? 'default']}`
                                }`}
                            >
                                {action.icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{action.icon}</span>}
                                <span className="min-w-0">
                                    <span className="block">{action.label}</span>
                                    {action.disabledReason && <span className="block text-xs font-normal">{action.disabledReason}</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </>
    );
}
