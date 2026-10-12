import { QueryValidationError } from "../errors.js";
import type { FieldName } from "../schema/types.js";
import { Operator, type Operator as OperatorType } from "./operator.js";

type ConditionFieldName<T extends object> = FieldName<T>;

export interface Condition<T extends object, TField extends ConditionFieldName<T> = ConditionFieldName<T>> {
  readonly field: TField;
  readonly operator: OperatorType;
  readonly values?: readonly unknown[];
  readonly lowerValue?: unknown;
  readonly upperValue?: unknown;
}

export interface BetweenConditionInput<T extends object, TField extends ConditionFieldName<T>> {
  readonly field: TField;
  readonly operator: typeof Operator.BETWEEN;
  readonly lowerValue: unknown;
  readonly upperValue: unknown;
}

export interface ValueConditionInput<T extends object, TField extends ConditionFieldName<T>> {
  readonly field: TField;
  readonly operator?: Exclude<OperatorType, typeof Operator.BETWEEN>;
  readonly values: readonly unknown[];
}

export function createCondition<T extends object, TField extends ConditionFieldName<T>>(
  input: BetweenConditionInput<T, TField> | ValueConditionInput<T, TField>,
): Condition<T, TField> {
  if (input.operator === Operator.BETWEEN) {
    if (input.lowerValue === undefined || input.upperValue === undefined) {
      throw new QueryValidationError(
        `BETWEEN condition on "${input.field}" must include both lowerValue and upperValue.`,
        "QUERY_INVALID_CONDITION",
        { field: input.field, operator: input.operator },
      );
    }
    return {
      field: input.field,
      operator: Operator.BETWEEN,
      lowerValue: input.lowerValue,
      upperValue: input.upperValue,
    };
  }

  const operator = input.operator ?? Operator.EQUAL;
  if (input.values.length === 0) {
    throw new QueryValidationError(
      `Condition on "${input.field}" must include at least one value.`,
      "QUERY_INVALID_CONDITION",
      { field: input.field, operator },
    );
  }

  return {
    field: input.field,
    operator,
    values: [...input.values],
  };
}

export function validateConditions<T extends object>(conditions: readonly Condition<T>[]): void {
  if (conditions.length === 0) {
    throw new QueryValidationError(
      "Structured search requires at least one condition.",
      "QUERY_EMPTY_CONDITIONS",
    );
  }

  for (const condition of conditions) {
    if (condition.field === "") {
      throw new QueryValidationError(
        "Condition field name must be non-empty.",
        "QUERY_INVALID_CONDITION",
        { condition },
      );
    }

    if (condition.operator === Operator.BETWEEN) {
      if (condition.lowerValue === undefined || condition.upperValue === undefined) {
        throw new QueryValidationError(
          `BETWEEN condition on "${condition.field}" must include lowerValue and upperValue.`,
          "QUERY_INVALID_CONDITION",
          { condition },
        );
      }
      continue;
    }

    if (condition.values === undefined || condition.values.length === 0) {
      throw new QueryValidationError(
        `Condition on "${condition.field}" must include values.`,
        "QUERY_INVALID_CONDITION",
        { condition },
      );
    }
  }
}
