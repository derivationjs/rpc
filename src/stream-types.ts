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
