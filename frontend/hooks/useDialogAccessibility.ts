import { useEffect, useRef } from 'react';

const dialogs: HTMLElement[] = [];
let previousOverflow = '';
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useDialogAccessibility<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
    const ref = useRef<T>(null);
    const close = useRef(onClose);
    close.current = onClose;

    useEffect(() => {
        const dialog = ref.current as HTMLElement | null;
        if (!open || !dialog) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        if (dialogs.length === 0) {
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        dialogs.push(dialog);
        const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusable))
            .filter(el => el.getClientRects().length > 0 && !el.closest('[inert]'));
        const frame = requestAnimationFrame(() => {
            (dialog.querySelector<HTMLElement>('[data-autofocus]') || controls()[0] || dialog).focus();
        });
        const onKeyDown = (event: KeyboardEvent) => {
            if (dialogs.at(-1) !== dialog) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
            if (event.key === 'Tab') {
                const items = controls();
                const first = items[0], last = items.at(-1);
                if (!first) { event.preventDefault(); dialog.focus(); return; }
                if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                    event.preventDefault(); last?.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                    event.preventDefault(); first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            const index = dialogs.indexOf(dialog);
            if (index >= 0) dialogs.splice(index, 1);
            if (dialogs.length === 0) document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [open]);
    return ref;
}
