export interface ConditionalStepConfig {
  path?: string;
  operator?: string;
  value?: any;
}

export interface ConditionalStepOutput {
  condition: string;
  result: boolean;
  actualValue: any;
}

/**
 * Modular Conditional Branch Step Handler
 * Evaluates conditions against previous step output using operators:
 * equals, not_equals, contains, greater_than, less_than, is_not_null, is_null.
 */
export async function handleConditionalBranch(
  config: ConditionalStepConfig,
  prevOutput: any
): Promise<ConditionalStepOutput> {
  const pathStr = config.path || "status";
  const operator = config.operator || "equals";
  const expectedValue = String(config.value ?? "200");

  let actualVal: any = prevOutput;
  if (prevOutput && typeof prevOutput === "object" && pathStr in prevOutput) {
    actualVal = prevOutput[pathStr];
  }

  const strActual = String(actualVal ?? "");
  let isTrue = false;

  switch (operator) {
    case "equals":
      isTrue = strActual === expectedValue;
      break;
    case "not_equals":
      isTrue = strActual !== expectedValue;
      break;
    case "contains":
      isTrue = strActual.includes(expectedValue);
      break;
    case "greater_than":
      isTrue = Number(actualVal) > Number(expectedValue);
      break;
    case "less_than":
      isTrue = Number(actualVal) < Number(expectedValue);
      break;
    case "is_not_null":
      isTrue = Boolean(actualVal !== null && actualVal !== undefined && strActual !== "" && strActual !== "null");
      break;
    case "is_null":
      isTrue = actualVal === null || actualVal === undefined || strActual === "" || strActual === "null";
      break;
    default:
      isTrue = strActual === expectedValue;
  }

  return {
    condition: `${pathStr} ${operator} ${expectedValue}`,
    result: isTrue,
    actualValue: actualVal,
  };
}
