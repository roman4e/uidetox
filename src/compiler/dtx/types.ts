export type Verb = 'trait' | 'filter' | 'token' | 'provide';

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
  kind: 'on' | 'transform' | 'default' | 'prop' | 'off';
  event?: string;
  name: string | null;
  body?: string;
  propValue?: string;
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
