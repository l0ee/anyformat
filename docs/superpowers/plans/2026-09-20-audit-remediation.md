# AnyFormat Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all P0 (Critical) and P1 (High) architectural, algorithmic, concurrency, and security defects identified and approved in `audit_report.md` to achieve a 100% green verification suite (`npm run typecheck && npm run lint && npm test`).

**Architecture:** 
- Fix `start-server.js` request validation and crash prevention for null bytes (`%00`).
- Fix `zipExporter.ts` to implement collision-free filename deduplication.
- Fix `monochromeTracer.ts` Bézier curve fitting to eliminate inverted tangents and cusps.
- Integrate `canvasLimits.ts` into `svgRasterizer.ts` with CSS physical unit resolution and aspect-ratio clamping.
- Re-architect `traceWorkerClient.ts` to implement worker pooling, FIFO queue dispatch, buffer isolation, per-task timers, and decode cancellation.
- Fix PDF preview rendering in `UniversalQueue.tsx`.
- Enforce single source of truth in `types.ts` and `universalFilter.ts`.

**Tech Stack:** React 18, Vite 6, TypeScript 5.7, Vitest 5, Node.js HTTP/fs, JSZip, PDF.js, Potrace.

**Spec:** [`audit_report.md`](file:///home/l0ee/.gemini/antigravity-cli/brain/f4e938a8-d9d5-4f5b-835c-8fd97f964865/audit_report.md)

## Global Constraints
- Maintain 100% client-side execution for image processing and conversions with zero remote telemetry.
- Single source of truth at `src/engine/universal/types.ts`.
- All tests in `npm run typecheck && npm run lint && npm test` must pass.
- No detached buffer errors when workers transfer `ImageData`.

---

### Task 1: Server Hardening & Crash Prevention (`start-server.js`)

**Files:**
- Modify: `start-server.js:73-86, 155-180`
- Test: `test/start-server.test.js`

**Interfaces:**
- `resolveRequestPath(distDir: string, requestUrl: string): { pathname: string, filePath: string } | null`
- Returns `null` if URL contains decoded null bytes (`\0`).

- [ ] **Step 1: Write test asserting null-byte rejection in `test/start-server.test.js`**

Add a test case in `test/start-server.test.js` checking that requests with `%00` return HTTP 400 Bad Request instead of crashing the server:

```javascript
it('rejects requests with URL-encoded null bytes with 400 Bad Request', async () => {
  const res = await fetch(`http://localhost:${serverPort}/%00`);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails or crashes**

Run: `npx vitest run test/start-server.test.js`
Expected: Server crash or test failure.

- [ ] **Step 3: Implement null-byte check and defensive `try/catch` in `start-server.js`**

In `start-server.js`:
1. In `resolveRequestPath`:
```javascript
if (!pathname || pathname.includes('\0')) {
  return null;
}
```
2. In request handler around `fs.readFile(resolved.filePath)`:
```javascript
try {
  fs.readFile(resolved.filePath, (error, content) => {
    if (!error) {
      sendBuffer(req, res, resolved.filePath, content);
      return;
    }
    // existing 404 / SPA fallback logic
  });
} catch (err) {
  res.writeHead(500, securityHeaders());
  res.end('Server Error');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/start-server.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add start-server.js test/start-server.test.js
git commit -m "fix(security): prevent server crash on url-encoded null bytes"
```

---

### Task 2: Batch ZIP Filename Deduplication (`zipExporter.ts`)

**Files:**
- Modify: `src/engine/zipExporter.ts:8-17`
- Test: `src/engine/zipExporter.test.ts`

**Interfaces:**
- Consumes: `ZipExportItem { filename: string, content: string | Blob | ArrayBuffer }`
- Produces: `exportBatchZip(items: ZipExportItem[]): Promise<Blob>` with deduplicated filenames (`drawing (2).svg`, `drawing (3).svg`).

- [ ] **Step 1: Run existing test to verify failure**

Run: `npx vitest run src/engine/zipExporter.test.ts`
Expected: FAIL (2 failures asserting collision suffixes)

- [ ] **Step 2: Implement collision deduplication in `src/engine/zipExporter.ts`**

Update `exportBatchZip` in `src/engine/zipExporter.ts`:
```typescript
export async function exportBatchZip(items: ZipExportItem[]): Promise<Blob> {
  const zip = new JSZip();
  const reserved = new Set(items.map((i) => i.filename));
  const usedNames = new Set<string>();

  for (const item of items) {
    let finalName = item.filename;

    if (usedNames.has(finalName)) {
      const lastDot = finalName.lastIndexOf('.');
      const hasExt = lastDot > 0;
      const base = hasExt ? finalName.slice(0, lastDot) : finalName;
      const ext = hasExt ? finalName.slice(lastDot) : '';

      let counter = 2;
      while (
        usedNames.has(`${base} (${counter})${ext}`) ||
        reserved.has(`${base} (${counter})${ext}`)
      ) {
        counter++;
      }
      finalName = `${base} (${counter})${ext}`;
    }

    usedNames.add(finalName);
    zip.file(finalName, item.content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/engine/zipExporter.test.ts`
Expected: PASS (All 3 tests pass)

- [ ] **Step 4: Commit**

```bash
git add src/engine/zipExporter.ts
git commit -m "fix(engine): add collision-free filename deduplication to batch zip exporter"
```

---

### Task 3: Mathematically Correct Bézier Curve Fitting (`monochromeTracer.ts`)

**Files:**
- Modify: `src/engine/monochromeTracer.ts:350-370`
- Test: `src/engine/monochromeTracer.test.ts` (create unit test)

**Interfaces:**
- Produces: `fitCurves(points: Point[]): CurveSegment[]` with smooth cubic Bézier continuity without inverted tangents.

- [ ] **Step 1: Write test asserting tangent continuity in `src/engine/monochromeTracer.test.ts`**

Create `src/engine/monochromeTracer.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { fitCurves } from './monochromeTracer';

describe('fitCurves Bézier control points', () => {
  it('generates forward-pointing tangent vectors without cusps', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
      { x: 10, y: -10 }
    ];
    const curves = fitCurves(points);
    expect(curves.length).toBeGreaterThan(0);
    for (const seg of curves) {
      if (seg.type === 'bezier') {
        expect(Number.isFinite(seg.c0.x)).toBe(true);
        expect(Number.isFinite(seg.c1.x)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Fix tangent calculation in `src/engine/monochromeTracer.ts`**

Export `fitCurves` for testing, and replace lines 351-366 with standard Catmull-Rom to cubic Bézier control points:
```typescript
const prev = p0;
const curr = p1;
const next = p2;
const prevPrev = points[(i - 2 + n) % n];

// Catmull-Rom tangents converted to cubic Bézier control points
const ctrl1 = {
  x: prev.x + (curr.x - prevPrev.x) / 6,
  y: prev.y + (curr.y - prevPrev.y) / 6
};
const ctrl2 = {
  x: curr.x - (next.x - prev.x) / 6,
  y: curr.y - (next.y - prev.y) / 6
};

curves.push({
  type: 'bezier',
  c0: ctrl1,
  c1: ctrl2,
  c2: curr
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/engine/monochromeTracer.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/monochromeTracer.ts src/engine/monochromeTracer.test.ts
git commit -m "fix(engine): correct cubic bezier tangent calculation in monochrome tracer"
```

---

### Task 4: SVG Physical Unit Resolution & Canvas Limits (`svgRasterizer.ts`)

**Files:**
- Modify: `src/engine/svgRasterizer.ts`
- Reference: `src/engine/canvasLimits.ts`
- Test: `src/engine/svgRasterizer.test.ts`

**Interfaces:**
- Consumes: `MAX_CANVAS_EDGE`, `MAX_CANVAS_PIXELS`, `assertCanvasDimensionsWithinBudget` from `canvasLimits.ts`
- Produces: `svgToCanvas(svgString: string, options?: SvgRasterOptions): Promise<HTMLCanvasElement>` adhering to physical unit conversion (`in`, `cm`, `mm`, `pt`, `pc`, `q`), aspect-ratio viewBox resolution, and clamping to `MAX_CANVAS_EDGE` (8,192) and `MAX_CANVAS_PIXELS` (16,777,216).

- [ ] **Step 1: Run existing test to verify failures**

Run: `npx vitest run src/engine/svgRasterizer.test.ts`
Expected: FAIL (16 failures)

- [ ] **Step 2: Implement physical units and canvas limit clamping in `src/engine/svgRasterizer.ts`**

Update `svgRasterizer.ts`:
1. Parse CSS lengths:
   - `in`: 96
   - `cm`: 96 / 2.54 (~37.795)
   - `mm`: 96 / 25.4 (~3.7795)
   - `pt`: 96 / 72 (~1.3333)
   - `pc`: 16
   - `px`: 1
   - `q`: 96 / 101.6 (~0.94488)
2. Use `DOMParser` to inspect `documentElement` (verify `localName === 'svg'`).
3. Resolve `width`, `height`, and `viewBox` (including comma-separated viewBoxes `25 -5, 640 480`).
4. Validate positive finite numbers; reject invalid scale (e.g. `Infinity`) or width `0` before allocating canvas.
5. Apply aspect-ratio clamping so `width <= 8192`, `height <= 8192`, `width * height <= 16777216`, while preserving aspect ratio (and width/height >= 1).
6. Verify output blob/dataURL MIME matches requested format; if browser returns `image/png` when `image/webp` or `image/jpeg` requested, throw `Browser returned image/png instead of ${requestedMime}.`.

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/engine/svgRasterizer.test.ts`
Expected: PASS (All 16 tests pass)

- [ ] **Step 4: Commit**

```bash
git add src/engine/svgRasterizer.ts
git commit -m "fix(engine): implement physical unit parsing and canvas limits in svg rasterizer"
```

---

### Task 5: Web Worker Pooling, FIFO Queue & Decode Cancellation (`traceWorkerClient.ts`)

**Files:**
- Modify: `src/workers/traceWorkerClient.ts`
- Reference: `src/workers/traceWorkerUtils.ts`
- Test: `src/workers/traceWorkerClient.test.ts`

**Interfaces:**
- Produces: `TraceWorkerClient` implementing:
  - `workers: WorkerItem[]` pool
  - `pendingQueue: string[]` FIFO queue
  - `decodingRequests: Set<AbortController>`
  - `handleWorkerMessage(item: WorkerItem, event: MessageEvent<TraceWorkerResult>): void`
  - `handleWorkerError(item: WorkerItem, event: ErrorEvent): void`
  - `handleWorkerMessageError(item: WorkerItem): void`
  - Cloned `ImageData` buffer transfer (never detach caller's buffer)
  - 10,000ms timeout per task starting at dispatch, terminating and replacing worker on timeout
  - Caller abort signal canceling queue items or retiring active worker with replacement
  - Proper `terminate()` rejecting all requests with `'terminated'` and aborting decoding requests

- [ ] **Step 1: Run existing test to verify failures**

Run: `npx vitest run src/workers/traceWorkerClient.test.ts`
Expected: FAIL (11 failures + 1 unhandled rejection)

- [ ] **Step 2: Implement worker pool and lifecycle management in `src/workers/traceWorkerClient.ts`**

Implement complete contract in `src/workers/traceWorkerClient.ts`:
- Define `WorkerItemStub`: `{ worker: Worker, busy: boolean, activeRequestId: string | null }`.
- Maintain `workers: WorkerItemStub[]`, `pendingQueue: string[]`, `decodingRequests: Set<AbortController>`.
- In `traceMonochrome` and `traceColor`:
  - If `fileOrData instanceof File`: wrap `loadImageData` with cancellable `AbortController` in `this.decodingRequests`.
  - Clone `ImageData` data buffer before `postMessage` transfer list.
  - Enqueue task into `this.pendingQueue` and call `this.dispatchNext()`.
- In `dispatchNext()`:
  - Find first non-busy worker in `this.workers`.
  - Shift task from `pendingQueue`.
  - Start 10s timer. On timeout, terminate worker, reject task with `/timed out.*retry.*lower resolution.*smaller image/i`, replace worker in pool, and dispatch next.
  - If `signal` aborted while in-flight, terminate worker, replace worker, reject task with `AbortError`, and dispatch next.
  - If `signal` aborted while in queue, remove from queue, remove listener, and reject with `AbortError`.
- In `terminate()`:
  - Abort all controllers in `this.decodingRequests`.
  - Reject all active and queued tasks with `Error('Trace worker client was terminated.')`.
  - Terminate all workers in `this.workers`.

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/workers/traceWorkerClient.test.ts`
Expected: PASS (All 12 tests pass)

- [ ] **Step 4: Commit**

```bash
git add src/workers/traceWorkerClient.ts
git commit -m "fix(workers): implement worker pooling, queuing, buffer cloning, and cancellation"
```

---

### Task 6: PDF Converted Result Preview Bug & Single Source of Truth Alignment

**Files:**
- Modify: `src/components/universal/UniversalQueue.tsx:134`
- Modify: `src/engine/universal/types.ts:17-59`
- Modify: `src/engine/universal/universalFilter.ts:20-28`
- Test: `src/components/universal/UniversalQueue.test.tsx`
- Test: `src/engine/universal/types.test.ts`
- Test: `src/engine/universal/universalFilter.test.ts`

**Interfaces:**
- `UniversalQueue.tsx`: Renders accessible `<iframe>` with download fallback for converted PDFs when `item.targetExt === 'pdf'`.
- `types.ts`: Adds `'jpeg'` to `canExportTo` for all raster formats.
- `universalFilter.ts`: References `SUPPORTED_FORMATS[item.sourceExt]?.category` instead of hardcoded strings.

- [ ] **Step 1: Write test in `UniversalQueue.test.tsx` for PDF preview**

Add test checking that PDF preview renders an `iframe` or accessible container rather than an `img`:
```tsx
it('renders an iframe for converted PDF preview instead of an img tag', () => {
  // render queue with item targetExt: 'pdf' and resultUrl
  // expect iframe to be in document, img not to be in document
});
```

- [ ] **Step 2: Update `UniversalQueue.tsx` line 134**

```tsx
{item.resultUrl && (
  <figure>
    <figcaption className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
      Converted result
    </figcaption>
    {item.targetExt === 'pdf' ? (
      <iframe
        src={item.resultUrl}
        title={`Converted PDF preview for ${item.name}`}
        className="h-40 w-full rounded-lg border bg-white dark:bg-slate-950"
      />
    ) : (
      <img
        src={item.resultUrl}
        alt={`Converted preview for ${item.name}`}
        className="max-h-40 rounded-lg border bg-white object-contain dark:bg-slate-950"
      />
    )}
  </figure>
)}
```

- [ ] **Step 3: Update `types.ts` and `universalFilter.ts`**

1. In `types.ts`: add `'jpeg'` to `canExportTo` wherever `'jpg'` is supported.
2. In `universalFilter.ts`: read `SUPPORTED_FORMATS[item.sourceExt]?.category` to check category matching.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npx vitest run src/components/universal/UniversalQueue.test.tsx src/engine/universal/universalFilter.test.ts src/engine/universal/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/universal/UniversalQueue.tsx src/engine/universal/types.ts src/engine/universal/universalFilter.ts src/components/universal/UniversalQueue.test.tsx
git commit -m "fix(ui): render pdf previews in iframe and align universal format categories"
```

---

### Task 7: Full Verification Suite Validation

**Files:**
- Run all validation commands from AGENTS.md

- [ ] **Step 1: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors)

- [ ] **Step 2: Run ESLint**

Run: `npm run lint`
Expected: PASS (0 errors)

- [ ] **Step 3: Run Vitest test suite**

Run: `npm test`
Expected: PASS (All suites pass, 0 errors, 0 failures)

- [ ] **Step 4: Run Chromium E2E tests**

Run: `npx playwright test --project=chromium`
Expected: Verify baseline Playwright status.

- [ ] **Step 5: Run production build**

Run: `npm run build`
Expected: Build succeeds and generates `dist/`.
