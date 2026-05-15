export function observeStageSize(stageElement, onResize) {
  let frameId = 0;

  const scheduleResize = () => {
    if (frameId) return;

    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      onResize();
    });
  };

  const resizeObserver =
    stageElement && typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          scheduleResize();
        })
      : null;

  resizeObserver?.observe(stageElement);
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('orientationchange', scheduleResize, { passive: true });

  onResize();

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    resizeObserver?.disconnect();
    window.removeEventListener('resize', scheduleResize);
    window.removeEventListener('orientationchange', scheduleResize);
  };
}
