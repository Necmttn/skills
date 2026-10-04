/**
 * The calendar date of an instant, for date-only stamps (evidence `date`, `revised_at`).
 *
 * Default: the UTC date, so the core needs no runtime. The thin entries provide the machine's zone
 * (`runtime.ts`): an edit made on 2026-09-19 local time must not be stamped 2026-09-18.
 * `updated_at` is a timestamp and stays UTC.
 */
import { Clock, Context, DateTime, Effect } from "effect";

export type DateOf = (epochMillis: number) => string;

export const utcDate: DateOf = (ms) => DateTime.formatIsoDateUtc(DateTime.makeUnsafe(ms));

/** YYYY-MM-DD as a wall clock in `zone` shows it. */
export const dateInZone = (zone: DateTime.TimeZone): DateOf => (ms) => DateTime.formatIsoDate(DateTime.setZone(DateTime.makeUnsafe(ms), zone));

export const Today = Context.Reference<DateOf>("kb/Today", { defaultValue: () => utcDate });

/** Today's date (through `Clock` and `Today`). */
export const today: Effect.Effect<string> = Effect.gen(function* () {
  const dateOf = yield* Today;
  return dateOf(yield* Clock.currentTimeMillis);
});
