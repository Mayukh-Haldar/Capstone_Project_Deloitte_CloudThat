import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
const VISIBILITY_THRESHOLD = 320;
export function ScrollToTopButton() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const updateVisibility = () => {
            setVisible(window.scrollY > VISIBILITY_THRESHOLD);
        };
        updateVisibility();
        window.addEventListener("scroll", updateVisibility, { passive: true });
        return () => {
            window.removeEventListener("scroll", updateVisibility);
        };
    }, []);
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    return (<button type="button" onClick={scrollToTop} aria-label="Back to top" className={`fixed bottom-6 right-6 z-[70] inline-flex size-12 items-center justify-center rounded-full border border-[#1132d4]/20 bg-[#1132d4] text-white shadow-lg shadow-blue-900/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0f2dc0] hover:shadow-xl hover:shadow-blue-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1132d4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-[#7aa3ff]/20 dark:bg-[#1132d4] dark:focus-visible:ring-offset-[#070d1f] ${visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
      <ArrowUp className="size-5"/>
    </button>);
}
