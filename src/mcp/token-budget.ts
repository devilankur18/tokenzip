export class TokenBudgetManager {
  private maxTokens: number;

  private static RATES = {
    code: 0.25,
    markdown: 0.3,
    json: 0.22,
    text: 0.33,
  };

  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }

  estimate(content: string, type: keyof typeof TokenBudgetManager.RATES = 'json'): number {
    return Math.ceil(content.length * TokenBudgetManager.RATES[type]);
  }

  truncate<T>(data: T, requestedMax?: number): T & { _truncated: boolean; _token_count: number } {
    const max = requestedMax ?? this.maxTokens;
    const json = JSON.stringify(data);
    const tokens = this.estimate(json);

    if (tokens <= max) {
      return {
        ...data,
        _truncated: false,
        _token_count: tokens,
      } as T & { _truncated: boolean; _token_count: number };
    }

    const truncated = this.smartTruncate(data, max);
    const truncatedTokens = this.estimate(JSON.stringify(truncated));

    return {
      ...truncated,
      _truncated: true,
      _token_count: truncatedTokens,
    } as T & { _truncated: boolean; _token_count: number };
  }

  private smartTruncate<T>(data: T, budget: number): T {
    const obj = data as any;
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key]) && obj[key].length > 1) {
        obj[key] = obj[key].slice(0, 1);
        obj._truncation_note = `${key} truncated`;
        return obj as T;
      }
    }
    return obj as T;
  }
}
