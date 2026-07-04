export type TplNode =
  | TplElement
  | TplText
  | TplInterpolation
  | TplIf
  | TplFor
  | TplVirtualFor
  | TplCase;

export interface TplElement {
  type: 'element';
  tag: string;
  attrs: TplAttr[];
  children: TplNode[];
  /** Static ref key (from #name, else static name/id), camel-cased. */
  refKey?: string;
  /** Computed ref key expression (from #${expr}). */
  refExpr?: string;
}

export type TplAttrKind = 'static' | 'expression' | 'event' | 'property' | 'boolean';

export interface TplAttr {
  name: string;
  kind: TplAttrKind;
  value: string;
}

export interface TplText {
  type: 'text';
  value: string;
}

export interface TplInterpolation {
  type: 'interpolation';
  expression: string;
}

export interface TplIf {
  type: 'if';
  condition: string;
  then: TplNode[];
  else: TplNode[] | null;
}

export interface TplFor {
  type: 'for';
  each: string;
  itemVar: string;
  keyExpr: string | null;
  body: TplNode[];
}

export interface TplVirtualFor {
  type: 'virtual-for';
  each: string;
  itemVar: string;
  keyExpr: string | null;
  /** Code expression for the row height in px. */
  rowHeight: string;
  /** Code expression for overscan, or null for the default. */
  overscan: string | null;
  /** Code expression for the scroll-parent selector, or null. */
  scrollParent: string | null;
  debug: boolean;
  body: TplNode[];
}

export interface TplCase {
  type: 'case';
  on: string;
  arms: Array<{ match: string | null; body: TplNode[] }>;
}
