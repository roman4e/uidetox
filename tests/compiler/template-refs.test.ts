import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('template ref extraction', () => {
  it('auto-binds static name attribute', () => {
    const [el] = parseTemplate('<input name="email"/>') as Array<{ refKey?: string }>;
    expect(el.refKey).toBe('email');
  });

  it('auto-binds static id, camel-cased', () => {
    const [el] = parseTemplate('<div id="main-panel"></div>') as Array<{ refKey?: string }>;
    expect(el.refKey).toBe('mainPanel');
  });

  it('explicit #marker wins and camel-cases', () => {
    const [el] = parseTemplate('<button #submit-btn name="x"></button>') as Array<{ refKey?: string }>;
    expect(el.refKey).toBe('submitBtn');
  });

  it('computed #${expr} sets refExpr', () => {
    const [el] = parseTemplate("<li #${'row-' + i}></li>") as Array<{ refExpr?: string }>;
    expect(el.refExpr).toBe("'row-' + i");
  });

  it('no marker leaves refKey undefined', () => {
    const [el] = parseTemplate('<span></span>') as Array<{ refKey?: string; refExpr?: string }>;
    expect(el.refKey).toBeUndefined();
    expect(el.refExpr).toBeUndefined();
  });
});
