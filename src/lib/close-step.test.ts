import { describe, expect, it } from "vitest";
import type { CloseStep } from "@/shared/types";
import { describeCloseStep } from "./close-step";
const step: CloseStep = { name: "Rent/AR reconciliation", dueBD: 4, completedBD: null, status: "Late", conflict: false, source: { sheet: "B4 Close Tracker", row: 6 } };
describe("close-step explanations", () => {
  it("describes an overdue deadline without claiming a reconciliation discrepancy", () => {
    const result = describeCloseStep(step, 6);
    expect(result.state).toBe("late");
    expect(result.daysOverdue).toBe(2);
    expect(result.description).toContain("completion is not reported");
  });
  it("keeps today and future milestones separate from overdue work", () => {
    expect(describeCloseStep({ ...step, status: "Due Today", dueBD: 6 }, 6).state).toBe("due");
    expect(describeCloseStep({ ...step, status: "Not Due", dueBD: 8 }, 6).state).toBe("upcoming");
  });
  it("does not call a reported completed step currently overdue", () => {
    expect(describeCloseStep({ ...step, status: "Complete", completedBD: 4 }, 6).state).toBe("complete");
  });
  it("flags a future completion date before showing reported completion", () => {
    expect(describeCloseStep({ ...step, status: "Complete", completedBD: 7 }, 6).state).toBe("conflict");
  });
  it("does not invent elapsed lateness when a Late source status conflicts with the clock", () => {
    const result = describeCloseStep({ ...step, dueBD: 8 }, 6);
    expect(result.daysOverdue).toBe(0);
    expect(result.description).toContain("due day has not passed");
  });
});
