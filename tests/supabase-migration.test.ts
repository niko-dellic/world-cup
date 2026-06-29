import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supabase match graph migration", () => {
  it("adds explicit graph fields to matches", () => {
    const migration = readFileSync("supabase/migrations/002_match_graph.sql", "utf8");

    expect(migration).toContain("match_number");
    expect(migration).toContain("visual_slot");
    expect(migration).toContain("home_source_match_id");
    expect(migration).toContain("away_source_match_id");
    expect(migration).toContain("home_source_label");
    expect(migration).toContain("away_source_label");
  });
});
