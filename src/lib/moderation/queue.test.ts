import { describe, expect, it } from "vitest";
import { groupReports, type ReportRow } from "./queue";

const row = (id: string, target: string, at: string, type: ReportRow["target_type"] = "response"): ReportRow => ({
  id,
  target_type: type,
  target_id: target,
  reason: `reason ${id}`,
  created_at: at,
});

describe("groupReports", () => {
  it("collapses reports per target and counts them", () => {
    const groups = groupReports([
      row("1", "t1", "2026-01-01T00:00:00Z"),
      row("2", "t1", "2026-01-02T00:00:00Z"),
      row("3", "t2", "2026-01-01T12:00:00Z"),
    ]);
    expect(groups.map((g) => [g.targetId, g.reportCount])).toEqual([
      ["t1", 2],
      ["t2", 1],
    ]);
    expect(groups[0].reasons).toEqual(["reason 1", "reason 2"]);
  });

  it("keeps perspective and response targets with the same id apart", () => {
    const groups = groupReports([
      row("1", "same", "2026-01-01T00:00:00Z", "perspective"),
      row("2", "same", "2026-01-01T00:00:00Z", "response"),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("orders by report count, then by longest-waiting", () => {
    const groups = groupReports([
      row("1", "newer", "2026-01-05T00:00:00Z"),
      row("2", "older", "2026-01-01T00:00:00Z"),
      row("3", "busy", "2026-01-09T00:00:00Z"),
      row("4", "busy", "2026-01-09T01:00:00Z"),
    ]);
    expect(groups.map((g) => g.targetId)).toEqual(["busy", "older", "newer"]);
    expect(groups[0].firstReportedAt).toBe("2026-01-09T00:00:00Z");
  });

  it("caps the reasons shown per target", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(String(i), "t", `2026-01-0${i + 1}T00:00:00Z`));
    const [g] = groupReports(rows);
    expect(g.reportCount).toBe(9);
    expect(g.reasons).toHaveLength(5);
  });
});
