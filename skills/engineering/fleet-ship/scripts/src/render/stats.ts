import type { Stats } from "../run/stats.ts";

const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export const renderStats = (stats: Stats): string => {
  const out: Array<string> = [];
  out.push("time in stage (minutes) by lane", "lane | stage | count | mean | max");
  for (const stat of stats.byLaneStage) out.push(`${stat.lane} | ${stat.stage} | ${stat.count} | ${fmt(stat.meanMin)} | ${stat.maxMin}`);
  if (stats.byLaneStage.length === 0) out.push("(no completed stages yet)");
  out.push("", "retries");
  for (const attempt of stats.attempts) out.push(`${attempt.id}: ${attempt.attempts} attempts (${attempt.causes.join(", ")})`);
  if (stats.attempts.length === 0) out.push("(none)");
  out.push("", "causes: " + ([...stats.causes.entries()].map(([key, value]) => `${key}=${value}`).join("  ") || "none"));
  out.push("", "slowest");
  for (const stat of stats.slowest) out.push(`${stat.id} ${stat.stage} ${stat.minutes}m`);
  if (stats.slowest.length === 0) out.push("(none)");
  out.push("", "evidence on merged: " + ([...stats.evidence.entries()].map(([key, value]) => `${key}=${value}`).join("  ") || "none"));
  return out.join("\n") + "\n";
};
