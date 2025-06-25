import { AwsJsonRpcProtocol } from "./AwsJsonRpcProtocol";
/**
 * @alpha
 * @see https://smithy.io/2.0/aws/protocols/aws-json-1_1-protocol.html#differences-between-awsjson1-0-and-awsjson1-1
 */
export declare class AwsJson1_0Protocol extends AwsJsonRpcProtocol {
    constructor({ defaultNamespace }: {
        defaultNamespace: string;
    });
    getShapeId(): string;
    protected getJsonRpcVersion(): "1.0";
}
