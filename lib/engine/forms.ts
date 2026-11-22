import type { z } from "zod";

/** Empty text means "not entered", which a schema reports with a friendly message. */
export const numberOrUndefined = (text: string): number | undefined =>
  text.trim() === "" ? undefined : Number(text);

/** The first validation message for each known field, so a form shows one clear error per input. */
export function firstErrorPerField<F extends string>(
  issues: readonly z.core.$ZodIssue[],
  fields: readonly F[],
): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of issues) {
    const field = fields.find((f) => f === issue.path[0]);
    if (field) errors[field] ??= issue.message;
  }
  return errors;
}
