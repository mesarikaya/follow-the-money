import { SubSectorSummary } from "@/lib/api";
import { deriveFactorRegime } from "./factorRegime";

const factor = (id: string, rs60: number | null): SubSectorSummary =>
  ({ id, rs60 }) as SubSectorSummary;

/** Ranked by relative strength, strongest first. */
const factors = (...ranking: string[]) =>
  ranking.map((id, index) => factor(id, 1 - index * 0.01));

describe("deriveFactorRegime", () => {
  it("needs at least two ranked factors to say anything", () => {
    expect(deriveFactorRegime([])).toBeNull();
    expect(deriveFactorRegime([factor("MTUM", 0.05)])).toBeNull();
    expect(deriveFactorRegime([factor("MTUM", null), factor("USMV", null)])).toBeNull();
  });

  it("calls momentum-on-top with low-vol-at-the-bottom a strong risk-on regime", () => {
    expect(deriveFactorRegime(factors("MTUM", "QUAL", "VLUE", "USMV"))!.label).toBe("Strong Risk-On");
  });

  it("calls the mirror image a strong risk-off regime", () => {
    expect(deriveFactorRegime(factors("USMV", "QUAL", "VLUE", "MTUM"))!.label).toBe("Strong Risk-Off");
  });

  it("reads a softer version of each when only the top half agrees", () => {
    expect(deriveFactorRegime(factors("MTUM", "QUAL", "USMV", "VLUE"))!.label).toBe("Risk-On");
    expect(deriveFactorRegime(factors("VLUE", "USMV", "QUAL", "MTUM"))!.label).toBe("Risk-Off");
  });

  /**
   * Quality leading with momentum right behind is the late-cycle read. This case used to be
   * shadowed by the broad Risk-On branch — quality first forces momentum to 2nd and low-vol to 3rd
   * or lower, which Risk-On also matched — so the quality check now runs first.
   */
  it("reads quality-on-top with momentum behind it as Late Cycle / Quality", () => {
    expect(deriveFactorRegime(factors("QUAL", "MTUM", "USMV", "VLUE"))!.label).toBe(
      "Late Cycle / Quality",
    );
  });

  it("admits it does not know when the factors are mixed", () => {
    expect(deriveFactorRegime(factors("VLUE", "QUAL", "MTUM", "USMV"))!.label).toBe("Transitional");
  });
});
