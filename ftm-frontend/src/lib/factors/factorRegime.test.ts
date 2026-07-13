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
   * Documents existing behaviour, not intended behaviour: the "Late Cycle / Quality" regime can
   * never be reached. It needs QUAL first and MTUM in the top two — which forces MTUM to 2nd, hence
   * USMV to 3rd or lower, which the Risk-On branch above already claims. Preserved as-is by the
   * refactor; whether to reorder the branches is a behaviour decision.
   */
  it("never reports Late Cycle — the Risk-On branch always claims that case first", () => {
    expect(deriveFactorRegime(factors("QUAL", "MTUM", "USMV", "VLUE"))!.label).toBe("Risk-On");
  });

  it("admits it does not know when the factors are mixed", () => {
    expect(deriveFactorRegime(factors("VLUE", "QUAL", "MTUM", "USMV"))!.label).toBe("Transitional");
  });
});
