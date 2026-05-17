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
      
      // Also look for long strings
      const getStrings = (o: any, path: string = ''): { path: string, length: number }[] => {
        let res: { path: string, length: number }[] = [];
        if (typeof o === 'string' && o.length > 100) {
          res.push({ path, length: o.length });
        } else if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
          for (const key of Object.keys(o)) {
            const subPath = path ? `${path}.${key}` : key;
            res.push(...getStrings(o[key], subPath));
          }
        }
        return res;
      };
      
      const strings = getStrings(obj);
      
      if (arrays.length === 0 && strings.length === 0) break;
      
      // Target the largest entity (array or string)
      const all = [
        ...arrays.map(a => ({ ...a, type: 'array' })),
        ...strings.map(s => ({ ...s, type: 'string' }))
      ].sort((a, b) => b.length - a.length);
      
      const target = all[0];
      const newLen = Math.max(20, Math.floor(target.length * 0.6));
      
      const parts = target.path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      
      if (target.type === 'array') {
        current[lastKey] = current[lastKey].slice(0, newLen);
      } else {
        current[lastKey] = current[lastKey].slice(0, newLen) + '\n... [TRUNCATED]';
      }
      
      obj._truncation_note = `Pruned large entities to fit token budget (depth: ${iterations + 1})`;
      iterations++;
    }

    return obj as T;
  }
}
