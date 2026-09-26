import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
    width: number;
    height: number;
}

/**
 * Tracks an element's content box via ResizeObserver.
 *
 * Both dimensions are needed and both are better observed than polled. Reading
 * clientHeight during render, as the virtual list used to, returns whatever the
 * height happened to be at that moment: it is stale after a sidebar toggle or a
 * window resize, and because it is read in render it never triggers a re-render
 * when the real size changes.
 *
 * The observer also catches scrollbars, which is the reason this is not a
 * window.innerWidth read: a vertical scrollbar appearing takes ~15px off the
 * content box, which is enough to cross a column breakpoint and reflow the grid.
 *
 * Starts at 0x0, so callers must tolerate it. The observer fires synchronously
 * on observe() in every current browser, so this is not visible in practice.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
    const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Reading a size inside the observer callback and writing it back into
        // layout can re-trigger the observer, which Chrome reports as
        // "ResizeObserver loop completed with undelivered notifications".
        // Deferring to the next frame breaks that cycle.
        let frame = 0;
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                // contentRect excludes padding and border, which is what a
                // column calculation wants: the grid pads itself.
                const { width, height } = entry.contentRect;
                setSize(prev =>
                    Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
                        ? prev
                        : { width, height },
                );
            });
        });

        observer.observe(element);
        // Seed synchronously so the first paint already has the right size.
        setSize({ width: element.clientWidth, height: element.clientHeight });

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [ref]);

    return size;
}
