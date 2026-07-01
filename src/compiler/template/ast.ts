export type TplNode = TplElement | TplText | TplInterpolation;

export interface TplElement {
  type: 'element';
  tag: string;
  attrs: TplAttr[];
  children: TplNode[];
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
