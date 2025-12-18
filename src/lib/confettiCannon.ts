import confetti from "canvas-confetti";

export function fireConfettiCannon(origin?: { x: number; y: number }) {
  // Default to center if no origin provided
  const confettiOrigin = origin || { x: 0.5, y: 0.5 };

  const base = {
    origin: confettiOrigin,
    gravity: 1.1,
    decay: 0.88,       // slows down after launch
    ticks: 260,
    scalar: 1.2,       // bigger particles
  };

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
}

