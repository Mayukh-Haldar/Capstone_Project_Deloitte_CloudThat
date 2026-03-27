import { useRef, useEffect } from 'react';
import { motion, useMotionValue, useMotionTemplate, useAnimationFrame } from 'framer-motion';
/**
 * SVG Grid Pattern Component
 */
const GridPattern = ({ offsetX, offsetY, size }) => {
    return (<svg className="w-full h-full">
      <defs>
        <motion.pattern id="infinite-grid-pattern" width={size} height={size} patternUnits="userSpaceOnUse" x={offsetX} y={offsetY}>
          <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-400 dark:text-blue-300"/>
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#infinite-grid-pattern)"/>
    </svg>);
};
/**
 * Infinite Grid Background Component
 * Provides an animated grid background that reveals on mouse hover
 * Integrates seamlessly with the existing theme
 */
export function InfiniteGridBackground() {
    const containerRef = useRef(null);
    const gridSize = 30;
    // Track mouse position with Motion Values for performance
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (containerRef.current) {
                const { left, top } = containerRef.current.getBoundingClientRect();
                mouseX.set(e.clientX - left);
                mouseY.set(e.clientY - top);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY]);
    // Grid offsets for infinite scroll animation
    const gridOffsetX = useMotionValue(0);
    const gridOffsetY = useMotionValue(0);
    const speedX = 0.3;
    const speedY = 0.3;
    useAnimationFrame(() => {
        const currentX = gridOffsetX.get();
        const currentY = gridOffsetY.get();
        // Reset offset at pattern width to simulate infinity
        gridOffsetX.set((currentX + speedX) % gridSize);
        gridOffsetY.set((currentY + speedY) % gridSize);
    });
    // Create a dynamic radial mask for the "flashlight" effect with larger radius
    const maskImage = useMotionTemplate `radial-gradient(160px circle at ${mouseX}px ${mouseY}px, black, transparent)`;
    return (<div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Layer 1: Very subtle background grid (barely visible at rest) */}
      <div className="absolute inset-0 opacity-0">
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} size={gridSize}/>
      </div>

      {/* Layer 2: Highlighted grid (strongly visible on mouse movement) */}
      <motion.div className="absolute inset-0 opacity-[0.6] dark:opacity-[0.55]" style={{ maskImage, WebkitMaskImage: maskImage }}>
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} size={gridSize}/>
      </motion.div>
    </div>);
}
