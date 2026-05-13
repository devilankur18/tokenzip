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
    // Deep clone to avoid mutating the original data
    const obj = JSON.parse(JSON.stringify(data));
    
    const getArrays = (o: any, path: string = ''): { path: string, length: number }[] => {
      let res: { path: string, length: number }[] = [];
      if (Array.isArray(o)) {
        res.push({ path, length: o.length });
      } else if (typeof o === 'object' && o !== null) {
        for (const key of Object.keys(o)) {
          const subPath = path ? `${path}.${key}` : key;
          res.push(...getArrays(o[key], subPath));
        }
      }
      return res;
    };

    let iterations = 0;
    // We limit iterations to avoid infinite loops or excessive processing
    while (this.estimate(JSON.stringify(obj)) > budget && iterations < 10) {
      const arrays = getArrays(obj).filter(a => a.length > 1);
      if (arrays.length === 0) break;
      
      // Sort by length descending to target the largest arrays first
      arrays.sort((a, b) => b.length - a.length);
      
      const target = arrays[0];
      // Reduce the largest array by 40% each iteration
      const newLen = Math.max(1, Math.floor(target.length * 0.6));
      
      // Navigate to the target array and slice it
      const parts = target.path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      current[lastKey] = current[lastKey].slice(0, newLen);
      
      obj._truncation_note = `Pruned large arrays to fit token budget (depth: ${iterations + 1})`;
      iterations++;
    }

    return obj as T;
  }
}
