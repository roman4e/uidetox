import { defineFilter } from '../runtime/filters/define.js';
import { fmt } from './format.js';

interface FilterCtx {
  params: Record<string, unknown>;
}

/**
 * Registers formatting filters so templates can pipe values:
 * `${value | qty:'g'}`, `${x | percent}`, `${d | dateTime}`.
 * Each filter reads positional/keyword args from `this.params`.
 */
export function registerI18nFilters(): void {
  const simple = (name: string, run: (v: number, params: Record<string, unknown>) => string): void => {
    defineFilter(name, {
      input: 'number',
      output: 'string',
      paramsSchema: {},
      transformers: [{
        name,
        run(this: FilterCtx, v: unknown): unknown {
          return run(Number(v), this.params);
        },
      }],
    });
  };

  simple('number', (v, p) => fmt.number(v, { decimals: p.decimals as number | undefined }));
  simple('percent', (v, p) => fmt.percent(v, { decimals: p.decimals as number | undefined }));
  simple('delta', (v, p) => fmt.delta(v, { decimals: p.decimals as number | undefined }));
  simple('qty', (v, p) => fmt.qty(v, (p.unit ?? p['0']) as string, {
    to: p.to as string | undefined,
    auto: p.auto as boolean | undefined,
    decimals: p.decimals as number | undefined,
  }));

  const dateLike = (name: string, run: (v: string | number) => string): void => {
    defineFilter(name, {
      input: 'string',
      output: 'string',
      paramsSchema: {},
      transformers: [{ name, run(_v: unknown): unknown { return run(_v as string | number); } }],
    });
  };
  dateLike('date', (v) => fmt.date(v));
  dateLike('dateTime', (v) => fmt.dateTime(v));
  dateLike('relative', (v) => fmt.relative(v));
}
