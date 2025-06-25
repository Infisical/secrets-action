import { AwsJsonRpcProtocol } from "./AwsJsonRpcProtocol";
export class AwsJson1_0Protocol extends AwsJsonRpcProtocol {
    constructor({ defaultNamespace }) {
        super({
            defaultNamespace,
        });
    }
    getShapeId() {
        return "aws.protocols#awsJson1_0";
    }
    getJsonRpcVersion() {
        return "1.0";
    }
}
