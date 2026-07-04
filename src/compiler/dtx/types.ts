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
  kind:
    | 'on'
    | 'transform'
    | 'default'
    | 'prop'
    | 'off'
    | 'template'
    | 'style'
    | 'actions'
    | 'effects'
    | 'script'
    | 'props'
    | 'task';
  event?: string;
  name: string | null;
  body?: string;
  propValue?: string;
  scoped?: boolean;
  idle?: boolean;
}

export interface Declaration {
  verb: Verb;
  name: string;
  clauses: Clause[];
  members: Member[];
  isDeclare?: boolean;
  declareKind?: string;
  sourceOffset: number;
  sourceEndOffset: number;
}

export interface ImportStatement {
  /** Explicit module path, or null for auto-resolve by name. */
  from: string | null;
  items: Array<{ source: string; alias?: string }>;
  sourceOffset: number;
  sourceEndOffset: number;
}

export interface DeclareDecl {
  kind: string;
  name: string;
  body: string;
  scoped?: boolean;
}

export interface DtxAst {
  imports: ImportStatement[];
  declarations: Declaration[];
  declares: DeclareDecl[];
}
