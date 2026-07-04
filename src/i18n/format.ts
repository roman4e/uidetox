import { getLocale } from './locale.js';
import { bestUnit, convert, getUnit } from './units.js';

export interface NumberOptions {
  decimals?: number;
}
export interface QtyOptions {
  to?: string;
  auto?: boolean;
  decimals?: number;
}

const NBSP = ' ';

function numberFmt(value: number, opts: { decimals?: number; min?: number; style?: 'decimal' | 'percent'; sign?: boolean } = {}): string {
  const max = opts.decimals ?? 2;
  const min = opts.min ?? 0;
  return new Intl.NumberFormat(getLocale(), {
    style: opts.style ?? 'decimal',
    minimumFractionDigits: Math.min(min, max),
    maximumFractionDigits: max,
    signDisplay: opts.sign ? 'exceptZero' : 'auto',
  }).format(value);
}

export const fmt = {
  number(value: number, opts: NumberOptions = {}): string {
    return numberFmt(value, { decimals: opts.decimals ?? 2 });
  },

  percent(value: number, opts: NumberOptions = {}): string {
    // Format the scaled number ourselves so the "N %" spacing is locale-stable.
    return `${numberFmt(value * 100, { decimals: opts.decimals ?? 0 })}${NBSP}%`;
  },

  delta(value: number, opts: NumberOptions = {}): string {
    return numberFmt(value, { decimals: opts.decimals ?? 2, sign: true });
  },

  qty(value: number, unit: string, opts: QtyOptions = {}): string {
    let target = unit;
    let v = value;
    if (opts.auto) target = bestUnit(value, unit);
    else if (opts.to) target = opts.to;
    if (target !== unit) v = convert(value, unit, target);
    const def = getUnit(target);
    const num = numberFmt(v, { decimals: opts.decimals ?? 1 });
    return `${num}${NBSP}${def?.symbol ?? target}`;
  },

  date(iso: string | number | Date): string {
    return new Intl.DateTimeFormat(getLocale(), {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(iso));
  },

  dateTime(iso: string | number | Date): string {
    return new Intl.DateTimeFormat(getLocale(), {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  },

  relative(iso: string | number | Date, now: number = Date.now()): string {
    const diffMs = new Date(iso).getTime() - now;
    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });
    const abs = Math.abs(diffMs);
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 31_536_000_000],
      ['month', 2_592_000_000],
      ['day', 86_400_000],
      ['hour', 3_600_000],
      ['minute', 60_000],
      ['second', 1000],
    ];
    for (const [unit, ms] of units) {
      if (abs >= ms || unit === 'second') {
        return rtf.format(Math.round(diffMs / ms), unit);
      }
    }
    return rtf.format(0, 'second');
  },
};
