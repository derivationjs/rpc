export interface Source<ReturnType> {
  get Snapshot(): object;
  get LastChange(): object;
  get Stream(): ReturnType;
}

export interface Sink<SinkType> {
  apply(change: object, stream: SinkType): void;
  build(): SinkType;
}

export type StreamDefinition<ReturnType extends object, SinkType extends ReturnType> = {
  args: Record<string, unknown>;
  returnType: ReturnType;
  sinkType: SinkType;
};

export type StreamDefinitions = Record<string, StreamDefinition<object, object>>;

export type StreamEndpoints<Definitions extends StreamDefinitions> = {
  [K in keyof Definitions]: (args: Definitions[K]["args"]) => Source<Definitions[K]["returnType"]>;
};

export type StreamSinks<Definitions extends StreamDefinitions> = {
  [K in keyof Definitions]: ((snapshot: object) => Sink<Definitions[K]["sinkType"]>);
};
