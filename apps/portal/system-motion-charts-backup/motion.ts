export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

export const chartAnim = {
  isAnimationActive: true,
  animationDuration: 900,
  animationBegin: 80,
};
