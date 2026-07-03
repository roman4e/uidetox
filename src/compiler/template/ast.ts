export type TplNode =
  | TplElement
  | TplText
  | TplInterpolation
  | TplIf
  | TplFor
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

export interface TplCase {
  type: 'case';
  on: string;
  arms: Array<{ match: string | null; body: TplNode[] }>;
}
