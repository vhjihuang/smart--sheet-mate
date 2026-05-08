export interface SharedTransformRule {
  min: number;
  grade: string;
}

export type SharedTransformType =
  | "TRIM"
  | "UPPER"
  | "LOWER"
  | "CROP"
  | "REPLACE"
  | "PREFIX"
  | "SUFFIX"
  | "DATE_FORMAT"
  | "SCORE_GRADE"
  | "ID_MASK";

export interface EmptyTransformStep {
  type: "TRIM" | "UPPER" | "LOWER";
  params: Record<string, never>;
}

export interface CropTransformStep {
  type: "CROP";
  params: {
    start: number;
    length?: number;
  };
}

export interface ReplaceTransformStep {
  type: "REPLACE";
  params: {
    from: string;
    to?: string;
  };
}

export interface TextTransformStep {
  type: "PREFIX" | "SUFFIX";
  params: {
    text: string;
  };
}

export interface DateFormatTransformStep {
  type: "DATE_FORMAT";
  params: {
    toFormat?: string;
  };
}

export interface ScoreGradeTransformStep {
  type: "SCORE_GRADE";
  params: {
    rules: SharedTransformRule[];
  };
}

export interface IdMaskTransformStep {
  type: "ID_MASK";
  params: {
    keepStart?: number;
    keepEnd?: number;
  };
}

export type SharedTransformStep =
  | EmptyTransformStep
  | CropTransformStep
  | ReplaceTransformStep
  | TextTransformStep
  | DateFormatTransformStep
  | ScoreGradeTransformStep
  | IdMaskTransformStep;

export interface SharedSlotConfig {
  type: 'JOIN' | 'SUM' | 'CUSTOM';
  separator?: string;
}

export interface SharedMappingNode {
  id: string;
  sourceId: string;
  sourceLabel: string;
  steps: SharedTransformStep[];
  forceText?: boolean;
  children?: SharedMappingNode[];
}

export interface SharedExcelRow {
  DataList: string[];
  Index: number;
}

export interface PreviewTransformPayload {
  SourceSamples: SharedExcelRow[];
  Mappings: Record<string, SharedMappingNode[]>;
  SlotConfigs: Record<string, SharedSlotConfig>;
}

export function applyStep(value: string | number | null | undefined, step: SharedTransformStep): string {
  // 1. 基础空值防御与类型转换
  const strValue = value === null || value === undefined ? "" : String(value);
  const originalValue = strValue;

  try {
    switch (step.type) {
      case "TRIM":
        return strValue.trim();

      case "UPPER":
        return strValue.toUpperCase();

      case "LOWER":
        return strValue.toLowerCase();

      case "CROP": {
        const start = step.params.start;
        const length = step.params.length ?? strValue.length;
        if (start < 0) return strValue;
        if (start >= strValue.length) return "";
        return strValue.substring(start, Math.min(strValue.length, start + length));
      }

      case "REPLACE": {
        const from = step.params.from;
        const to = step.params.to ?? "";
        if (!from) return strValue;
        return strValue.replaceAll(from, to);
      }

      case "PREFIX":
        return (step.params.text || "") + strValue;

      case "SUFFIX":
        return strValue + (step.params.text || "");

      case "ID_MASK": {
        const keepStart = step.params.keepStart ?? 6;
        const keepEnd = step.params.keepEnd ?? 4;
        if (strValue.length <= keepStart + keepEnd) return strValue;
        const masked = "*".repeat(Math.max(0, strValue.length - keepStart - keepEnd));
        return strValue.slice(0, keepStart) + masked + strValue.slice(-keepEnd);
      }

      case "SCORE_GRADE": {
        const score = parseFloat(strValue);
        if (Number.isNaN(score)) return strValue;
        const rules = step.params.rules || [];
        const sorted = [...rules].sort((a, b) => b.min - a.min);
        for (const rule of sorted) {
          if (score >= rule.min) return rule.grade;
        }
        return strValue;
      }

      case "DATE_FORMAT": {
        const toFormat = step.params.toFormat || "YYYY-MM-DD";
        if (!strValue.trim()) return strValue;
        return applyDateFormat(strValue.trim(), toFormat);
      }

      default:
        return strValue;
    }
  } catch (error) {
    return originalValue;
  }
}

function applyDateFormat(value: string, toFormat: string): string {
  let date: Date | null = null;
  if (/^\d+$/.test(value) && value.length <= 5) {
    date = new Date((parseInt(value, 10) - 25569) * 86400 * 1000);
  }
  if (!date || Number.isNaN(date.getTime())) {
    const cnMatch = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
    if (cnMatch) date = new Date(parseInt(cnMatch[1], 10), parseInt(cnMatch[2], 10) - 1, parseInt(cnMatch[3], 10));
  }
  if (!date || Number.isNaN(date.getTime())) {
    date = new Date(value.replace(/\./g, "-").replace(/\//g, "-"));
  }
  if (!date || Number.isNaN(date.getTime())) return value;

  const pad = (n: number) => String(n).padStart(2, "0");
  return toFormat
    .replaceAll("YYYY", String(date.getFullYear()))
    .replaceAll("YY", String(date.getFullYear()).slice(-2))
    .replaceAll("MM", pad(date.getMonth() + 1))
    .replaceAll("DD", pad(date.getDate()))
    .replaceAll("HH", pad(date.getHours()))
    .replaceAll("mm", pad(date.getMinutes()))
    .replaceAll("ss", pad(date.getSeconds()));
}

export function applyPipeline(value: string, steps: SharedTransformStep[]): string {
  let result = value ?? "";
  for (const step of steps) {
    result = applyStep(result, step);
  }
  return result;
}

export function aggregateValues(values: string[], config: SharedSlotConfig): string {
  if (config.type === "SUM") {
    const sum = values.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    return String(Number.isInteger(sum) ? sum : sum.toFixed(2));
  }
  return values.join(config.separator ?? "");
}

export function previewTransform(payload: PreviewTransformPayload): { Results: Record<string, string[]> } {
  const results: Record<string, string[]> = {};

  try {
    for (const [targetId, nodes] of Object.entries(payload.Mappings)) {
      if (!nodes || nodes.length === 0) {
        continue;
      }

      const config = payload.SlotConfigs?.[targetId] || { type: "JOIN" as const, separator: "" };

      results[targetId] = (payload.SourceSamples || []).map((row) => {
        try {
          const values = nodes.map((node) => {
            const colIndex = parseInt(node.sourceId.replace("src-", ""), 10);
            const rawValue = row.DataList?.[colIndex] ?? "";
            return applyPipeline(rawValue, node.steps || []);
          });
          return aggregateValues(values, config);
        } catch {
          return "";
        }
      });
    }
  } catch {
    return { Results: {} };
  }

  return { Results: results };
}
