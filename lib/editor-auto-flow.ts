/** Bounded paragraph planning with explicit original-content ownership. */
import type { Mark, Rect } from './studio-engine';
import type { Source } from './pdf-engine';

export type FlowParagraph = {
  /** Current editable content; sourceRect(s) must still reference the original page. */
  mark: Mark;
  /** Original paragraph's bounding geometry, not its expanded editing frame. */
  original: Rect;
  /** Explicitly fixed paragraphs (for example a footer) never enter the flow. */
  fixed?: boolean;
  unsupportedReason?: string;
};
export type FlowMeasurement = {
  layout(
    mark: Mark,
    width: number,
    height: number,
    source: Source,
  ): Promise<{
    requiredHeight: number;
    overflow: boolean;
  }>;
  distribute(
    frames: { mark: Mark; pageId: string; width: number; height: number; source: Source }[],
    signal: AbortSignal,
  ): Promise<{ pageId: string; mark: Mark }[]>;
};
export type AutoFlowInput = {
  source: Source;
  originalPageId: string;
  width: number;
  height: number;
  selectedId: string;
  paragraphs: readonly FlowParagraph[];
  /** All non-paragraph original content AND other proposed marks. Normalized geometry. */
  obstacles: readonly Rect[];
  /** Caller-approved body column. Footers/headers must remain outside or fixed. */
  region: Rect;
  /** Blank-page frame; defaults to region. Same page dimensions as the original. */
  continuationRegion?: Rect;
  /** Stable group prefix chosen once per preview; all generated IDs derive from it. */
  groupId: string;
  maximumContinuationPages?: number;
  documentPageCount: number;
  signal: AbortSignal;
};
export type AutoFlowChunk = {
  paragraphId: string;
  /** UTF-16 range in the corresponding input paragraph; no invented separators. */
  from: number;
  to: number;
  mark: Mark;
  /** Sole source-removal owner; always on page slot zero. */
  ownsOriginal: boolean;
  deletionOnly: boolean;
};
export type AutoFlowPagePlan = {
  /** Zero is the original page; positive slots become inserted blank pages. */
  slot: number;
  pageId: string;
  blank: boolean;
  width: number;
  height: number;
  chunks: AutoFlowChunk[];
};
export type AutoFlowPlan = {
  sourceId: string;
  originalPageId: string;
  groupId: string;
  affectedParagraphIds: string[];
  untouchedParagraphIds: string[];
  pages: AutoFlowPagePlan[];
  /** Root must rebind continuation marks AND run styles after creating its font-reference source. */
  continuationFontReference: 'original-source';
  region?: Rect;
  continuationRegion?: Rect;
};

/** A conservative automatic body boundary. The complete flow plan still checks
 * every obstacle; this suggestion never relaxes the export safety conditions. */
export function suggestEditorFlowBottom(
  selected: Rect,
  paragraphs: readonly Rect[],
  obstacles: readonly Rect[],
  height: number,
) {
  if (!Number.isFinite(height) || height <= 0) throw new Error('Ungültige Seitenhöhe.');
  const gap = 6 / height,
    end = selected.y + selected.h;
  const inColumn = (r: Rect) => r.x < selected.x + selected.w && r.x + r.w > selected.x;
  let bottom = Math.min(0.95, 1 - 36 / height);
  for (const r of [...obstacles, ...paragraphs.filter((p) => p.y >= 0.85)]) {
    if (inColumn(r) && r.y >= end - gap) bottom = Math.min(bottom, r.y - gap);
  }
  if (bottom <= end + 2 / height)
    throw new Error(
      'Unter diesem Absatz ist kein sicherer Textbereich frei. Bitte die Textgrenze manuell prüfen.',
    );
  return bottom;
}

const PAD_PT = 2;
const FIT_TOLERANCE_PT = 0.5;
const ALIGN_PT = 3;
function fail(message: string): never {
  throw new Error(message);
}
function validRect(r: Rect) {
  return (
    [r.x, r.y, r.w, r.h].every(Number.isFinite) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w > 0 &&
    r.h > 0 &&
    r.x + r.w <= 1.0000001 &&
    r.y + r.h <= 1.0000001
  );
}
function overlaps(a: Rect, b: Rect, marginX = 0, marginY = 0) {
  return (
    Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) - marginX &&
    Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) - marginY
  );
}
function contains(outer: Rect, inner: Rect, tolerance = 0) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}
function removals(mark: Mark) {
  return mark.sourceRects?.length ? mark.sourceRects : mark.sourceRect ? [mark.sourceRect] : [];
}
function eligible(p: FlowParagraph) {
  return (
    p.mark.kind === 'text' &&
    !!p.mark.text?.trim() &&
    !p.mark.sourceIsScan &&
    (p.mark.textRotation === undefined || p.mark.textRotation === 0) &&
    !p.mark.nativeImage &&
    !p.mark.nativeTextSlice &&
    !p.mark.flow &&
    !p.unsupportedReason &&
    !p.fixed
  );
}
function clearOwnership(mark: Mark): Mark {
  const next = { ...mark };
  delete next.originalState;
  delete next.originalText;
  delete next.sourceRect;
  delete next.sourceRects;
  delete next.sourceIsScan;
  delete next.nativeTextSlice;
  return next;
}
function validateRuns(mark: Mark) {
  const text = mark.text || '';
  let end = 0;
  for (const run of mark.runs || []) {
    if (
      !Number.isSafeInteger(run.start) ||
      !Number.isSafeInteger(run.end) ||
      run.start < end ||
      run.end <= run.start ||
      run.end > text.length ||
      (run.style.fontScale !== undefined &&
        (!Number.isFinite(run.style.fontScale) || run.style.fontScale <= 0))
    )
      fail('Invalid rich text ranges or font size.');
    for (const at of [run.start, run.end])
      if (
        at > 0 &&
        at < text.length &&
        /[\uD800-\uDBFF]/u.test(text[at - 1]) &&
        /[\uDC00-\uDFFF]/u.test(text[at])
      )
        fail('A rich text boundary splits a Unicode character.');
    end = run.end;
  }
}

export async function prepareEditorAutoFlow(
  input: AutoFlowInput,
  measure: FlowMeasurement,
): Promise<AutoFlowPlan> {
  const { source, width, height, region, signal } = input;
  signal.throwIfAborted();
  const continuation = input.continuationRegion || region;
  const maximum = input.maximumContinuationPages ?? 20;
  if (
    !source.id ||
    !input.originalPageId ||
    !input.groupId ||
    input.groupId.length > 120 ||
    ![width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    !validRect(region) ||
    !validRect(continuation) ||
    !Number.isInteger(maximum) ||
    maximum < 0 ||
    maximum > 20 ||
    !Number.isInteger(input.documentPageCount) ||
    input.documentPageCount < 1 ||
    input.documentPageCount > 200 ||
    input.paragraphs.length > 500 ||
    input.obstacles.length > 10000 ||
    input.obstacles.some((r) => !validRect(r))
  )
    fail('Invalid or excessive automatic-flow request.');
  const ids = new Set<string>();
  for (const p of input.paragraphs) {
    if (!p.mark.id || ids.has(p.mark.id) || !validRect(p.original))
      fail('Invalid or duplicate original paragraph geometry.');
    ids.add(p.mark.id);
  }
  const selected = input.paragraphs.find((p) => p.mark.id === input.selectedId);
  if (
    !selected ||
    !eligible(selected) ||
    !contains(region, selected.original, 0.000001) ||
    Math.abs(selected.original.x - region.x) * width > ALIGN_PT
  )
    fail(
      'The selected paragraph is not a safe horizontal native paragraph in the approved column.',
    );

  const active: FlowParagraph[] = [],
    fixed: FlowParagraph[] = [];
  for (const p of input.paragraphs) {
    const horizontal =
      Math.min(region.x + region.w, p.original.x + p.original.w) > Math.max(region.x, p.original.x);
    const follows = p.original.y >= selected.original.y - 0.000001;
    const inRegion = contains(region, p.original, 0.000001);
    if (
      p.mark.id === selected.mark.id ||
      (!p.fixed &&
        follows &&
        horizontal &&
        inRegion &&
        Math.abs(p.original.x - region.x) * width <= ALIGN_PT)
    )
      active.push(p);
    else {
      // A body paragraph partly inside this column cannot be silently left behind.
      if (!p.fixed && follows && horizontal && overlaps(region, p.original))
        fail('Ambiguous following paragraph or overlapping column boundary.');
      fixed.push(p);
    }
  }
  active.sort((a, b) => a.original.y - b.original.y);
  if (!active.length || active[0] !== selected || active.length > 100)
    fail('The column has an ambiguous starting paragraph or too many paragraphs.');
  let total = 0;
  for (const [i, p] of active.entries()) {
    const boxes = removals(p.mark);
    if (
      !eligible(p) ||
      !boxes.length ||
      boxes.some((r) => !validRect(r) || !contains(p.original, r, 0.00001)) ||
      !Number.isFinite(p.mark.fontScale ?? 0.028) ||
      (p.mark.fontScale ?? 0.028) <= 0 ||
      (p.mark.text || '').length > 100000
    )
      fail('A flowing paragraph has unsupported content, geometry or original ownership.');
    validateRuns(p.mark);
    total += p.mark.text!.length;
    if (i && active[i - 1].original.y + active[i - 1].original.h > p.original.y + 0.000001)
      fail('Original paragraph boxes overlap.');
    for (const other of input.paragraphs)
      if (other !== p && boxes.some((r) => overlaps(r, other.original)))
        fail('Original source-removal geometry intersects another paragraph.');
  }
  if (total > 100000) fail('Automatic-flow content is longer than 100,000 characters.');
  const obstacles = [...input.obstacles, ...fixed.map((p) => p.original)];
  for (const p of active)
    if (obstacles.some((o) => overlaps(p.original, o)))
      fail('An original flowing paragraph overlaps a fixed object.');

  const pageId = (slot: number) =>
    slot === 0 ? input.originalPageId : `${input.groupId}:page:${slot}`;
  const pages = new Map<number, AutoFlowPagePlan>();
  const pagePlan = (slot: number) => {
    let page = pages.get(slot);
    if (!page) {
      page = { slot, pageId: pageId(slot), blank: slot > 0, width, height, chunks: [] };
      pages.set(slot, page);
    }
    return page;
  };
  pagePlan(0);
  let slot = 0,
    cursor = selected.original.y;
  const frame = () => (slot === 0 ? region : continuation);
  const nextPage = () => {
    if (++slot > maximum || input.documentPageCount + slot > 200)
      fail('Automatic flow exceeds the permitted continuation-page limit.');
    cursor = continuation.y;
  };
  const layout = async (mark: Mark) => {
    signal.throwIfAborted();
    const result = await measure.layout(mark, width, height, source);
    signal.throwIfAborted();
    if (!Number.isFinite(result.requiredHeight) || result.requiredHeight < 0)
      fail('Text measurement did not produce a safe height.');
    return result;
  };
  for (const [paragraphIndex, paragraph] of active.entries()) {
    signal.throwIfAborted();
    const original = paragraph.mark;
    if (paragraphIndex) {
      const previous = active[paragraphIndex - 1].original;
      cursor += Math.max(0, paragraph.original.y - previous.y - previous.h);
    }
    if (cursor >= frame().y + frame().h - (PAD_PT + FIT_TOLERANCE_PT) / height) nextPage();
    const build = (forSlot: number, y: number, text: string, chunk: number): Mark => {
      const r = forSlot === 0 ? region : continuation;
      return {
        ...original,
        id: `${input.groupId}:p:${paragraphIndex}:chunk:${chunk}`,
        x: r.x,
        y,
        w: r.w,
        h: r.y + r.h - y,
        text,
        runs: text ? original.runs?.map((run) => ({ ...run, style: { ...run.style } })) : [],
        originalState: undefined,
        changeGroup: input.groupId,
        // The temporary common flow ID prevents distributeEditorFlow from
        // inserting synthetic newlines between blank continuation frames.
        flow: { id: `${input.groupId}:paragraph:${paragraphIndex}`, order: chunk },
      };
    };
    let probe = build(slot, cursor, original.text!, 0);
    const full = await layout(probe);
    const currentAvailable = probe.h * height;
    if (full.overflow && full.requiredHeight <= currentAvailable + FIT_TOLERANCE_PT)
      fail('A paragraph is wider than its approved flow frame.');
    // Keep a following paragraph together when it fits a whole continuation
    // frame. The selected paragraph starts at its original location if possible.
    if (
      paragraphIndex > 0 &&
      full.requiredHeight + PAD_PT > currentAvailable &&
      full.requiredHeight + PAD_PT <= continuation.h * height &&
      Math.abs(region.w - continuation.w) < 0.0000001
    ) {
      nextPage();
      probe = build(slot, cursor, original.text!, 0);
    }
    let distributed: { pageId: string; mark: Mark }[];
    const complete = await layout(probe);
    if (!complete.overflow && complete.requiredHeight + PAD_PT <= probe.h * height) {
      distributed = [{ pageId: pageId(slot), mark: probe }];
    } else {
      const availablePages = Math.min(maximum, 200 - input.documentPageCount);
      const frames: Parameters<FlowMeasurement['distribute']>[0] = [];
      for (let s = slot; s <= availablePages; s++) {
        const r = s === 0 ? region : continuation;
        const y = s === slot ? cursor : r.y;
        const mark = build(s, y, s === slot ? original.text! : '', s - slot);
        // Existing layout accepts half a point of rounding. Reserve that
        // tolerance plus padding so the final mark stays inside the real frame.
        mark.h = Math.max(0.0000001, mark.h - (PAD_PT + FIT_TOLERANCE_PT) / height);
        frames.push({ mark, pageId: pageId(s), width, height, source });
      }
      if (frames.length < 2) fail('No continuation frame remains for the overflowing paragraph.');
      distributed = await measure.distribute(frames, signal);
      signal.throwIfAborted();
      if (
        distributed.length !== frames.length ||
        distributed.some((item, i) => item.pageId !== frames[i].pageId)
      )
        fail('Text distribution returned unexpected frame identities.');
    }
    if (distributed.map((d) => d.mark.text || '').join('') !== original.text)
      fail('Text distribution changed or lost paragraph content.');
    const boundaries = new Set([
      0,
      original.text!.length,
      ...Array.from(
        new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(original.text!),
        (part) => part.index,
      ),
    ]);
    let offset = 0,
      ownsOriginal = false,
      chunkNumber = 0;
    for (const item of distributed) {
      if (!item.mark.text) continue;
      const actualSlot =
        item.pageId === input.originalPageId ? 0 : Number(item.pageId.split(':').at(-1));
      if (!Number.isInteger(actualSlot) || actualSlot < slot || actualSlot > maximum)
        fail('Text distribution returned an invalid page slot.');
      if (actualSlot > slot + 1 && slot > 0)
        fail('Text distribution would create an unexplained blank continuation page.');
      const measured = await layout(item.mark);
      const r = actualSlot === 0 ? region : continuation;
      const y = item.mark.y;
      const h = Math.max(0.01, (measured.requiredHeight + PAD_PT) / height);
      if (measured.overflow || y + h > r.y + r.h + 0.000001)
        fail('A measured paragraph chunk exceeds its continuation frame.');
      const owner = actualSlot === 0;
      if (owner && ownsOriginal) fail('Duplicate original source-removal owner.');
      let mark: Mark = {
        ...item.mark,
        id: owner ? original.id : `${input.groupId}:p:${paragraphIndex}:chunk:${chunkNumber}`,
        h,
        changeGroup: input.groupId,
        flow: { id: `${input.groupId}:paragraph:${paragraphIndex}`, order: chunkNumber },
        originalState: undefined,
      };
      if (!owner) mark = clearOwnership(mark);
      const to = offset + mark.text!.length;
      if (!boundaries.has(offset) || !boundaries.has(to))
        fail('A continuation boundary would split a grapheme cluster.');
      const plan = {
        paragraphId: original.id,
        from: offset,
        to,
        mark,
        ownsOriginal: owner,
        deletionOnly: false,
      };
      pagePlan(actualSlot).chunks.push(plan);
      ownsOriginal ||= owner;
      offset = to;
      chunkNumber++;
      slot = actualSlot;
      cursor = y + h;
    }
    if (offset !== original.text!.length)
      fail('The paragraph did not make progress through its frames.');
    if (!ownsOriginal) {
      const owner: Mark = {
        ...original,
        text: '',
        runs: [],
        originalState: undefined,
        changeGroup: input.groupId,
        flow: undefined,
      };
      pagePlan(0).chunks.push({
        paragraphId: original.id,
        from: 0,
        to: 0,
        mark: owner,
        ownsOriginal: true,
        deletionOnly: true,
      });
    }
  }

  const result = [...pages.values()].sort((a, b) => a.slot - b.slot);
  const generatedIds = new Set<string>();
  for (const page of result) {
    for (const chunk of page.chunks) {
      if (generatedIds.has(chunk.mark.id) || (!chunk.ownsOriginal && ids.has(chunk.mark.id)))
        fail('A generated flow mark would overwrite an existing mark identity.');
      generatedIds.add(chunk.mark.id);
    }
    const visible = page.chunks.filter((c) => !c.deletionOnly);
    for (const [i, chunk] of visible.entries()) {
      if (!validRect(chunk.mark) || !contains(page.slot === 0 ? region : continuation, chunk.mark))
        fail('A planned chunk has invalid page geometry.');
      if (visible.slice(0, i).some((c) => overlaps(c.mark, chunk.mark)))
        fail('Planned flowing paragraphs overlap each other.');
      if (
        page.slot === 0 &&
        obstacles.some((r) => overlaps(chunk.mark, r, 0.5 / width, 0.5 / height))
      )
        fail('The proposed flow overlaps a footer, another column or other fixed content.');
    }
  }
  for (const [i, page] of result.entries())
    if (page.slot !== i) fail('The plan contains an unexplained blank page.');
  return {
    region: { ...region },
    continuationRegion: { ...continuation },
    sourceId: source.id,
    originalPageId: input.originalPageId,
    groupId: input.groupId,
    affectedParagraphIds: active.map((p) => p.mark.id),
    untouchedParagraphIds: fixed.map((p) => p.mark.id),
    pages: result,
    continuationFontReference: 'original-source',
  };
}
