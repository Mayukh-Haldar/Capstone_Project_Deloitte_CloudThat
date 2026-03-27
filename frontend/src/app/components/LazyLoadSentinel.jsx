import { useEffect, useRef } from "react";

export function LazyLoadSentinel({ enabled, loading, onVisible, rootMargin = "240px" }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!enabled || loading || !ref.current) {
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (entry?.isIntersecting) {
                onVisible();
            }
        }, { rootMargin });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [enabled, loading, onVisible, rootMargin]);

    if (!enabled) {
        return null;
    }

    return <div ref={ref} aria-hidden="true" className="h-1 w-full"/>;
}
