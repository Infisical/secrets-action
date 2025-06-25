import { AwsJsonRpcProtocol } from "./AwsJsonRpcProtocol";
export class AwsJson1_1Protocol extends AwsJsonRpcProtocol {
    constructor({ defaultNamespace }) {
        super({
            defaultNamespace,
        });
    }
    getShapeId() {
        return "aws.protocols#awsJson1_1";
    }
    getJsonRpcVersion() {
        return "1.1";
    }
}
