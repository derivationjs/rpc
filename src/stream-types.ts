export interface Source<ReturnType> {
  get Snapshot(): object;
  get LastChange(): object;
  get Stream(): ReturnType;
}

export interface Sink<SinkType, InputType> {
  apply(change: object, input: InputType): void;
  build(): { stream: SinkType; input: InputType };
}

export type StreamDefinition<
  ReturnType extends object,
  SinkType extends ReturnType,
  InputType extends object,
> = {
  args: Record<string, unknown>;
  returnType: ReturnType;
  sinkType: SinkType;
  inputType: InputType;
};

export type StreamDefinitions = Record<
  string,
  StreamDefinition<object, object, object>
>;

export type StreamEndpoints<Definitions extends StreamDefinitions> = {
  [K in keyof Definitions]: (
    args: Definitions[K]["args"],
  ) => Source<Definitions[K]["returnType"]>;
};

export type StreamSinks<Definitions extends StreamDefinitions> = {
  [K in keyof Definitions]: (
    snapshot: object,
  ) => Sink<Definitions[K]["sinkType"], Definitions[K]["inputType"]>;
};

// Mutation types
export type MutationResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export type MutationDefinition<Args, Result> = {
  args: Args;
  result: Result;
};

export type MutationDefinitions = Record<
  string,
  MutationDefinition<unknown, unknown>
>;

export type MutationEndpoints<Definitions extends MutationDefinitions> = {
  [K in keyof Definitions]: (
    args: Definitions[K]["args"],
  ) => Promise<MutationResult<Definitions[K]["result"]>>;
};

// Combined RPC definition
export type RPCDefinition = {
  streams: StreamDefinitions;
  mutations: MutationDefinitions;
};
