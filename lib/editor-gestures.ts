/** Document zoom changes the viewport only; PDF coordinates and edits stay untouched. */
export const clampEditorZoom = (zoom: number) => Math.max(50, Math.min(400, zoom));
type Point = { x: number; y: number };
type Gesture = {
  zoom: number;
  next: number;
  distance: number;
  ids: number[];
  anchor: Point;
  center: Point;
  bounds: DOMRect;
};

export function installEditorGestures({
  viewport,
  content,
  page,
  getZoom,
  onZoom,
  onStart,
}: {
  viewport: HTMLElement;
  content: HTMLElement;
  page: HTMLElement;
  getZoom: () => number;
  /** Must synchronously update the page layout before returning. */
  onZoom: (zoom: number) => void;
  onStart: () => void;
}) {
  let gesture: Gesture | undefined,
    frame = 0,
    wheelTimer: ReturnType<typeof setTimeout> | undefined,
    blocked = false,
    suppressClickUntil = 0,
    firstTouch: Point | undefined;
  const clearTransform = () => {
    content.style.removeProperty('transform');
    content.style.removeProperty('transform-origin');
    content.style.removeProperty('will-change');
  };
  const paint = () => {
    frame = 0;
    if (!gesture) return;
    const { bounds, anchor, center } = gesture,
      scale = gesture.next / gesture.zoom;
    content.style.transformOrigin = '0 0';
    content.style.willChange = 'transform';
    content.style.transform = `translate(${center.x - bounds.left - anchor.x * bounds.width * scale}px, ${center.y - bounds.top - anchor.y * bounds.height * scale}px) scale(${scale})`;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const finish = (commit: boolean) => {
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(wheelTimer);
    wheelTimer = undefined;
    const current = gesture;
    gesture = undefined;
    clearTransform();
    if (current && commit) {
      // One full render after the gesture, rather than re-running PDF/font
      // preparation on every touchmove. Re-measure the centered page at its
      // actual new size, including the desktop maximum width.
      onZoom(Math.round(current.next));
      // Restore the normal scroll container before assigning offsets. Gecko
      // can rebuild it when overflow changes and otherwise discard the anchor.
      delete viewport.dataset.editorGesturing;
      const bounds = page.getBoundingClientRect();
      viewport.scrollLeft += bounds.left + current.anchor.x * bounds.width - current.center.x;
      viewport.scrollTop += bounds.top + current.anchor.y * bounds.height - current.center.y;
    }
    delete viewport.dataset.editorGesturing;
    if (current) suppressClickUntil = Date.now() + 500;
  };
  const start = (center: Point, distance: number, ids: number[]) => {
    const bounds = page.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const zoom = getZoom();
    gesture = {
      zoom,
      next: zoom,
      distance: Math.max(1, distance),
      ids,
      bounds,
      center,
      anchor: {
        x: (center.x - bounds.left) / bounds.width,
        y: (center.y - bounds.top) / bounds.height,
      },
    };
    viewport.dataset.editorGesturing = 'true';
    viewport.dispatchEvent(new Event('moinpdf:editor-gesture'));
    onStart();
  };
  const pair = (touches: TouchList, ids?: number[]) => {
    const values = Array.from(touches);
    const a = ids ? values.find((t) => t.identifier === ids[0]) : values[0],
      b = ids ? values.find((t) => t.identifier === ids[1]) : values[1];
    if (!a || !b) return;
    return {
      center: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      ids: [a.identifier, b.identifier],
    };
  };
  const touchStart = (event: TouchEvent) => {
    if (event.touches.length === 1 && !blocked) {
      firstTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      // A fresh deliberate tap is not a compatibility click from the last pinch.
      suppressClickUntil = 0;
    }
    if (event.touches.length < 2) return;
    if (event.cancelable) event.preventDefault();
    if (gesture || blocked) return;
    const points = pair(event.touches);
    if (points) start(points.center, points.distance, points.ids);
  };
  const touchMove = (event: TouchEvent) => {
    if (gesture || blocked) {
      if (event.cancelable) event.preventDefault();
      if (!gesture) return;
      const points = pair(event.touches, gesture.ids);
      if (!points) return;
      gesture.next = clampEditorZoom((gesture.zoom * points.distance) / gesture.distance);
      gesture.center = points.center;
      schedule();
    } else if (firstTouch && event.touches.length === 1) {
      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - firstTouch.x, touch.clientY - firstTouch.y) > 8)
        suppressClickUntil = Date.now() + 500;
    }
  };
  const touchEnd = (event: TouchEvent) => {
    // Lifting either original finger ends the pinch. A third finger must never
    // replace it and produce a sudden change of scale or commit an edit.
    if (gesture && !pair(event.touches, gesture.ids)) {
      if (event.cancelable) event.preventDefault();
      finish(true);
      blocked = event.touches.length > 0;
    } else if (blocked && event.cancelable) event.preventDefault();
    if (!event.touches.length) {
      blocked = false;
      firstTouch = undefined;
    }
  };
  const cancel = () => {
    finish(false);
    blocked = false;
    firstTouch = undefined;
  };
  const click = (event: MouseEvent) => {
    if (gesture || blocked || (event.detail !== 0 && Date.now() < suppressClickUntil)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey || blocked || (gesture && gesture.ids.length)) return;
    event.preventDefault();
    if (!gesture) start({ x: event.clientX, y: event.clientY }, 1, []);
    if (!gesture) return;
    const delta =
      event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    gesture.next = clampEditorZoom(
      gesture.next * Math.exp(-Math.max(-250, Math.min(250, delta)) * 0.003),
    );
    schedule();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => finish(true), 130);
  };
  const options = { capture: true, passive: false };
  viewport.addEventListener('touchstart', touchStart, options);
  viewport.addEventListener('touchmove', touchMove, options);
  viewport.addEventListener('touchend', touchEnd, options);
  viewport.addEventListener('touchcancel', cancel, options);
  viewport.addEventListener('click', click, true);
  viewport.addEventListener('wheel', wheel, options);
  return () => {
    cancel();
    viewport.removeEventListener('touchstart', touchStart, true);
    viewport.removeEventListener('touchmove', touchMove, true);
    viewport.removeEventListener('touchend', touchEnd, true);
    viewport.removeEventListener('touchcancel', cancel, true);
    viewport.removeEventListener('click', click, true);
    viewport.removeEventListener('wheel', wheel, true);
  };
}
