import confetti from "canvas-confetti";

export function fireConfettiCannon(origin?: { x: number; y: number }) {
  // Default to center if no origin provided
  const confettiOrigin = origin || { x: 0.5, y: 0.5 };

  // Set z-index for confetti canvas to appear above backdrop but behind modal
  // canvas-confetti creates a canvas element, we need to ensure it has correct z-index
  const setConfettiZIndex = () => {
    // Find all canvas elements and set z-index on fixed-position ones (confetti canvases)
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas) => {
      const htmlCanvas = canvas as HTMLElement;
      const style = window.getComputedStyle(canvas);
      // Confetti canvases are typically fixed position and cover the full viewport
      if (style.position === 'fixed' || htmlCanvas.style.position === 'fixed') {
        // Behind modal (1000001) but above backdrop (999999)
        htmlCanvas.style.zIndex = '1000000';
        htmlCanvas.style.pointerEvents = 'none'; // Don't block clicks
      }
    });
  };

  const base = {
    origin: confettiOrigin,
    gravity: 1.1,
    decay: 0.88,       // slows down after launch
    ticks: 260,
    scalar: 1.2,       // bigger particles
  };

  // Set z-index for confetti canvas before firing
  // Use setTimeout to ensure canvas is created first
  setTimeout(setConfettiZIndex, 0);

  // Multiple blasts in different directions to fill the screen
  // Top-right
  confetti({
    ...base,
    particleCount: 80,
    angle: 45,
    spread: 35,
    startVelocity: 65,
  });

  // Top-left
  confetti({
    ...base,
    particleCount: 80,
    angle: 135,
    spread: 35,
    startVelocity: 65,
  });

  // Bottom-right
  confetti({
    ...base,
    particleCount: 80,
    angle: 315,
    spread: 35,
    startVelocity: 65,
  });

  // Bottom-left
  confetti({
    ...base,
    particleCount: 80,
    angle: 225,
    spread: 35,
    startVelocity: 65,
  });

  // Upward burst
  confetti({
    ...base,
    particleCount: 100,
    angle: 90,
    spread: 60,
    startVelocity: 55,
  });

  // Wide horizontal spray
  confetti({
    ...base,
    particleCount: 100,
    angle: 0,
    spread: 70,
    startVelocity: 50,
  });

  confetti({
    ...base,
    particleCount: 100,
    angle: 180,
    spread: 70,
    startVelocity: 50,
  });

  // Set z-index again after all confetti calls to catch any late-created canvases
  setTimeout(setConfettiZIndex, 50);
  setTimeout(setConfettiZIndex, 100);
}

