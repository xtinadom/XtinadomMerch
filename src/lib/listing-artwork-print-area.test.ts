import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cropRegionMeetsPrintMinimum,
  effectiveArtworkDpiFromCropAndPrint,
  exportedImageMeetsPrintDimensions,
  minSourceCropPixelsForPrintDpi,
  parsePrintAreaDimensionPair,
  PRINT_AREA_REFERENCE_DPI,
} from "@/lib/listing-artwork-print-area";

describe("parsePrintAreaDimensionPair", () => {
  it("returns nulls when both blank", () => {
    const r = parsePrintAreaDimensionPair("", "  ");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.width, null);
      assert.equal(r.height, null);
    }
  });

  it("rejects one-sided input", () => {
    const r = parsePrintAreaDimensionPair("100", "");
    assert.equal(r.ok, false);
  });

  it("parses valid pair", () => {
    const r = parsePrintAreaDimensionPair("4500", "5400");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.width, 4500);
      assert.equal(r.height, 5400);
    }
  });
});

describe("cropRegionMeetsPrintMinimum", () => {
  it("passes when region meets template", () => {
    assert.equal(cropRegionMeetsPrintMinimum(4500, 5400, 4500, 5400), true);
    assert.equal(cropRegionMeetsPrintMinimum(5000, 6000, 4500, 5400), true);
  });

  it("fails when region is too small", () => {
    assert.equal(cropRegionMeetsPrintMinimum(1000, 1200, 4500, 5400), false);
  });
});

describe("effectiveArtworkDpiFromCropAndPrint", () => {
  it("returns 300 when crop matches template pixels at 300 DPI ref", () => {
    const d = effectiveArtworkDpiFromCropAndPrint(3000, 2400, 3000, 2400);
    assert.equal(d, 300);
  });

  it("doubles when crop is 2× template on both axes", () => {
    const d = effectiveArtworkDpiFromCropAndPrint(6000, 4800, 3000, 2400);
    assert.equal(d, 600);
  });

  it("uses limiting axis when crop is tighter on one dimension", () => {
    const d = effectiveArtworkDpiFromCropAndPrint(4500, 4800, 3000, 2400);
    assert.equal(d, 450);
  });
});

describe("minSourceCropPixelsForPrintDpi", () => {
  it("uses reference DPI when minDpi is null", () => {
    const r = minSourceCropPixelsForPrintDpi(3000, 4000, null);
    assert.equal(r.minW, 3000);
    assert.equal(r.minH, 4000);
  });

  it("scales up when minDpi exceeds reference", () => {
    const r = minSourceCropPixelsForPrintDpi(3000, 4000, 600, PRINT_AREA_REFERENCE_DPI);
    assert.equal(r.minW, 6000);
    assert.equal(r.minH, 8000);
  });

  it("uses custom referenceDpi when provided", () => {
    const r = minSourceCropPixelsForPrintDpi(100, 100, 150, 150);
    assert.equal(r.minW, 100);
    assert.equal(r.minH, 100);
  });
});

describe("exportedImageMeetsPrintDimensions", () => {
  it("accepts exact match", () => {
    assert.equal(exportedImageMeetsPrintDimensions(4500, 5400, 4500, 5400), true);
  });

  it("accepts within tolerance", () => {
    assert.equal(exportedImageMeetsPrintDimensions(4501, 5399, 4500, 5400), true);
  });

  it("rejects wrong size", () => {
    assert.equal(exportedImageMeetsPrintDimensions(2000, 2000, 4500, 5400), false);
  });
});
