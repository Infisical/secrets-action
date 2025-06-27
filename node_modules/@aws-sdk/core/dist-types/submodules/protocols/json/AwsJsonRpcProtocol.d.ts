import { RpcProtocol } from "@smithy/core/protocols";
import { EndpointBearer, HandlerExecutionContext, HttpRequest, HttpResponse, OperationSchema, ResponseMetadata, SerdeFunctions, ShapeDeserializer, ShapeSerializer } from "@smithy/types";
import { JsonCodec } from "./JsonCodec";
/**
 * @alpha
 */
export declare abstract class AwsJsonRpcProtocol extends RpcProtocol {
    protected serializer: ShapeSerializer<string | Uint8Array>;
    protected deserializer: ShapeDeserializer<string | Uint8Array>;
    private codec;
    protected constructor({ defaultNamespace }: {
        defaultNamespace: string;
    });
    serializeRequest<Input extends object>(operationSchema: OperationSchema, input: Input, context: HandlerExecutionContext & SerdeFunctions & EndpointBearer): Promise<HttpRequest>;
    getPayloadCodec(): JsonCodec;
    protected abstract getJsonRpcVersion(): "1.1" | "1.0";
    protected handleError(operationSchema: OperationSchema, context: HandlerExecutionContext & SerdeFunctions, response: HttpResponse, dataObject: any, metadata: ResponseMetadata): Promise<never>;
}
