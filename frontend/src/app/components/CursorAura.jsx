import { useEffect, useState } from "react";
const initialState = {
    x: 0,
    y: 0,
    visible: false,
    pressed: false
};
export function CursorAura() {
    const [cursor, setCursor] = useState(initialState);
    useEffect(() => {
        const media = window.matchMedia("(pointer: fine)");
        if (!media.matches) {
            return;
        }
        const handleMove = (event) => {
            setCursor((current) => ({
                ...current,
                x: event.clientX,
                y: event.clientY,
                visible: true
            }));
        };
        const handleLeave = (event) => {
            // Only hide if the mouse genuinely leaves the browser viewport
            // (prevents it from hiding when hovering over scrollbars or edges)
            if (
                event.clientY <= 0 ||
                event.clientX <= 0 ||
                event.clientX >= window.innerWidth ||
                event.clientY >= window.innerHeight
            ) {
                setCursor((current) => ({ ...current, visible: false, pressed: false }));
            }
        };
        const handleDown = () => {
            setCursor((current) => ({ ...current, pressed: true, visible: true }));
        };
        const handleUp = () => {
            setCursor((current) => ({ ...current, pressed: false }));
        };
        window.addEventListener("mousemove", handleMove, { passive: true });
        window.addEventListener("mouseleave", handleLeave);
        window.addEventListener("mousedown", handleDown);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseleave", handleLeave);
            window.removeEventListener("mousedown", handleDown);
            window.removeEventListener("mouseup", handleUp);
        };
    }, []);
    return (<div aria-hidden="true" className={`pointer-events-none fixed left-0 top-0 z-[80] size-7 rounded-full border border-[var(--cursor-aura-border)] bg-[var(--cursor-aura-fill)] shadow-[0_0_0_1px_var(--cursor-aura-stroke),0_0_18px_var(--cursor-aura-glow)] transition-[opacity,transform] duration-150 ${cursor.visible ? "opacity-100" : "opacity-0"} ${cursor.pressed ? "scale-90" : "scale-100"}`} style={{
            transform: `translate(${cursor.x - 5}px, ${cursor.y - 5}px) ${cursor.pressed ? "scale(0.9)" : "scale(1)"}`
        }}/>);
}
