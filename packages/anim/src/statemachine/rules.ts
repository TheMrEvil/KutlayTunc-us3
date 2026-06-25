// Evaluate a serialized `RuleExpr` against the live parameter bag. This is the
// runtime behind Unreal's "Can Enter Transition" rule graphs.

import type { ParamBag, ParamValue, RuleExpr } from '../asset/types';

/**
 * Equality that doesn't surprise: when either side is numeric, compare as finite numbers with a
 * small epsilon (so `speed == 5` matches whether the rule value was typed as 5 or "5", and exact
 * float compares don't fail on rounding). Otherwise fall back to strict equality (bool/enum/string).
 */
function looseEq(a: ParamValue | undefined, b: ParamValue): boolean {
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-6;
  }
  return a === b;
}

export function evalRule(rule: RuleExpr, params: ParamBag): boolean {
  switch (rule.op) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'and':
      return rule.rules.every((r) => evalRule(r, params));
    case 'or':
      return rule.rules.some((r) => evalRule(r, params));
    case 'not':
      return !evalRule(rule.rule, params);
    case '==':
      return looseEq(params[rule.param], rule.value);
    case '!=':
      return !looseEq(params[rule.param], rule.value);
    case '>':
      return Number(params[rule.param]) > Number(rule.value);
    case '<':
      return Number(params[rule.param]) < Number(rule.value);
    case '>=':
      return Number(params[rule.param]) >= Number(rule.value);
    case '<=':
      return Number(params[rule.param]) <= Number(rule.value);
    default: {
      // Exhaustiveness guard — a new op must be handled above.
      const _never: never = rule;
      void _never;
      return false;
    }
  }
}
