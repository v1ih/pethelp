export type RowDataPacket = Record<string, unknown>;

export type ResultSetHeader = RowDataPacket & {
  affectedRows: number;
};

export type PoolConnection = {
  query<T = RowDataPacket[]>(sql: string, values?: unknown[]): Promise<[T]>;
  execute<T = ResultSetHeader>(sql: string, values?: unknown[]): Promise<[T]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
};
