export type Verb = 'trait' | 'filter' | 'token' | 'provide' | 'component';

export interface ParamSpec {
  type: string;
  optional: boolean;
  name: string;
  defaultValue?: string;
}

export interface Clause {
  key: string;
  kind: 'flag' | 'value' | 'list' | 'list-of-refs' | 'params';
  value?: string;
  items?: string[];
  params?: ParamSpec[];
}

export interface Member {
  kind: 'on' | 'transform' | 'default' | 'prop' | 'off' | 'template' | 'style' | 'actions' | 'effects';
  event?: string;
  name: string | null;
  body?: string;
  propValue?: string;
  scoped?: boolean;
}

export interface Declaration {
  verb: Verb;
  name: string;
  clauses: Clause[];
  members: Member[];
  sourceOffset: number;
  sourceEndOffset: number;
}

export interface ImportStatement {
  path: string;
  items: Array<{ source: string; alias?: string }>;
  sourceOffset: number;
  sourceEndOffset: number;
}

export interface DtxAst {
  imports: ImportStatement[];
  declarations: Declaration[];
}
