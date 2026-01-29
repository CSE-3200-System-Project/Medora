/**
 * Motion System Constants
 * GSAP-ready duration, easing, and offset tokens for consistent animations
 * 
 * Usage with GSAP:
 * gsap.to(element, { 
 *   y: 0, 
 *   opacity: 1, 
 *   duration: motion.duration.base, 
 *   ease: motion.ease.enter 
 * })
 * 
 * Usage with Framer Motion:
 * <motion.div
 *   initial={{ opacity: 0, y: motion.offset.medium }}
 *   animate={{ opacity: 1, y: 0 }}
 *   transition={{ duration: motion.duration.base, ease: motion.easeArray.enter }}
 * />
 */

export const motion = {
  // Duration in seconds (for GSAP)
  duration: {
    fast: 0.25,
    base: 0.4,
    slow: 0.6,
  },
  
  // Duration in milliseconds (for CSS/JS setTimeout)
  durationMs: {
    fast: 250,
    base: 400,
    slow: 600,
  },
  
  // GSAP easing strings
  ease: {
    standard: "power2.out",
    enter: "power3.out",
    exit: "power2.in",
    bounce: "back.out(1.4)",
  },
  
  // CSS easing (cubic-bezier)
  easeCss: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0.0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
  
  // Framer Motion easing arrays [x1, y1, x2, y2]
  easeArray: {
    standard: [0.4, 0, 0.2, 1] as const,
    enter: [0.0, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  
  // Offset values for translateY animations
  offset: {
    small: 8,
    medium: 16,
    large: 24,
  },
  
  // Stagger delays for list animations
  stagger: {
    fast: 0.03,
    base: 0.05,
    slow: 0.08,
  },
} as const;

/**
 * Framer Motion animation variants for common patterns
 */
export const fadeInUp = {
  initial: { opacity: 0, y: motion.offset.medium },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -motion.offset.small },
  transition: { 
    duration: motion.duration.base, 
    ease: motion.easeArray.enter 
  },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: motion.duration.fast },
};

export const slideInFromRight = {
  initial: { opacity: 0, x: motion.offset.large },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -motion.offset.medium },
  transition: { 
    duration: motion.duration.base, 
    ease: motion.easeArray.enter 
  },
};

export const slideInFromBottom = {
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: "100%" },
  transition: { 
    duration: motion.duration.base, 
    ease: motion.easeArray.enter 
  },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: motion.duration.fast },
};

/**
 * Container variants for stagger animations
 */
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: motion.stagger.base,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: motion.offset.small },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: motion.duration.base,
      ease: motion.easeArray.enter,
    },
  },
};
