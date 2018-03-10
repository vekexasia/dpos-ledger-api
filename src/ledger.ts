export interface ITransport {
  close(): Promise<any>;

  setScrambleKey(key: string): void;

  send(cla: number, ins: number, p1: number, p2: number, data?: Buffer, statusList?: number[]): Promise<Buffer>;
}
