import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, clampZoom, stepZoom, useViewerStore } from "./viewer";

describe("stepZoom", () => {
  it("steps through presets", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(1.1, 1)).toBe(1.25);
    expect(stepZoom(1.1, -1)).toBe(1);
  });

  it("stays within the range past the last preset", () => {
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(0.5, -1)).toBe(0.5);
    expect(stepZoom(5, 1)).toBe(5);
  });
});

describe("clampZoom", () => {
  it("keeps zoom in range", () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe("useViewerStore", () => {
  beforeEach(() => {
    useViewerStore.setState({ views: {}, zoomAnchor: null, scrollRequest: null });
  });

  it("keeps a separate view per document", () => {
    const s = useViewerStore.getState();
    s.init(1);
    s.init(2, { layout: "twoPage" });
    s.setZoom(1, 2);
    const { views } = useViewerStore.getState();
    expect(views[1]?.zoom).toBe(2);
    expect(views[1]?.zoomMode).toBe("custom");
    expect(views[2]?.zoom).toBe(1);
    expect(views[2]?.layout).toBe("twoPage");
  });

  it("rotates in quarter turns both ways", () => {
    const s = useViewerStore.getState();
    s.init(1);
    s.rotate(1, -1);
    expect(useViewerStore.getState().views[1]?.rotation).toBe(270);
    s.rotate(1, 1);
    s.rotate(1, 1);
    expect(useViewerStore.getState().views[1]?.rotation).toBe(90);
  });

  it("hands out a zoom anchor once", () => {
    const s = useViewerStore.getState();
    s.init(1);
    s.setZoom(1, 2, { clientX: 10, clientY: 20 });
    expect(s.consumeZoomAnchor(1)).toEqual({ clientX: 10, clientY: 20 });
    expect(s.consumeZoomAnchor(1)).toBeNull();
  });

  it("records scroll requests with the target page as current", () => {
    const s = useViewerStore.getState();
    s.init(1);
    s.goToPage(1, 7, { y: 30 });
    const state = useViewerStore.getState();
    expect(state.scrollRequest).toMatchObject({ docId: 1, page: 7, y: 30 });
    expect(state.views[1]?.currentPage).toBe(7);
  });
});
