import { AwsJsonRpcProtocol } from "./AwsJsonRpcProtocol";
export declare class AwsJson1_0Protocol extends AwsJsonRpcProtocol {
  constructor({ defaultNamespace }: { defaultNamespace: string });
  getShapeId(): string;
  protected getJsonRpcVersion(): "1.0";
}
