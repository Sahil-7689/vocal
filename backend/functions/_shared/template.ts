/**
 * Template Variable Interpolator
 * Replaces {{input.text}}, {{previous.output.field}}, etc. with context values.
 */
export function resolveTemplate(templateStr: string, context: Record<string, any>): string {
  if (!templateStr || typeof templateStr !== "string") return templateStr || "";
  return templateStr.replace(/\{\{\s*([\w\.\-]+)\s*\}\}/g, (_, keyPath) => {
    const parts = keyPath.split(".");
    let val: any = context;
    for (const part of parts) {
      if (val && typeof val === "object" && part in val) {
        val = val[part];
      } else {
        return "";
      }
    }
    return typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
  });
}
