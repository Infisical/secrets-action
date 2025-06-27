import { RpcProtocol } from "@smithy/core/protocols";
import { deref, NormalizedSchema, SCHEMA, TypeRegistry } from "@smithy/core/schema";
import { calculateBodyLength } from "@smithy/util-body-length-browser";
import { JsonCodec } from "./JsonCodec";
import { loadRestJsonErrorCode } from "./parseJsonBody";
export class AwsJsonRpcProtocol extends RpcProtocol {
    serializer;
    deserializer;
    codec;
    constructor({ defaultNamespace }) {
        super({
            defaultNamespace,
        });
        this.codec = new JsonCodec({
            timestampFormat: {
                useTrait: true,
                default: SCHEMA.TIMESTAMP_EPOCH_SECONDS,
            },
            jsonName: false,
        });
        this.serializer = this.codec.createSerializer();
        this.deserializer = this.codec.createDeserializer();
    }
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        if (!request.path.endsWith("/")) {
            request.path += "/";
        }
        Object.assign(request.headers, {
            "content-type": `application/x-amz-json-${this.getJsonRpcVersion()}`,
            "x-amz-target": (this.getJsonRpcVersion() === "1.0" ? `JsonRpc10.` : `JsonProtocol.`) +
                NormalizedSchema.of(operationSchema).getName(),
        });
        if (deref(operationSchema.input) === "unit" || !request.body) {
            request.body = "{}";
        }
        try {
            request.headers["content-length"] = String(calculateBodyLength(request.body));
        }
        catch (e) { }
        return request;
    }
    getPayloadCodec() {
        return this.codec;
    }
    async handleError(operationSchema, context, response, dataObject, metadata) {
        const errorIdentifier = loadRestJsonErrorCode(response, dataObject) ?? "Unknown";
        let namespace = this.options.defaultNamespace;
        let errorName = errorIdentifier;
        if (errorIdentifier.includes("#")) {
            [namespace, errorName] = errorIdentifier.split("#");
        }
        const registry = TypeRegistry.for(namespace);
        let errorSchema;
        try {
            errorSchema = registry.getSchema(errorIdentifier);
        }
        catch (e) {
            const baseExceptionSchema = TypeRegistry.for("smithy.ts.sdk.synthetic." + namespace).getBaseException();
            if (baseExceptionSchema) {
                const ErrorCtor = baseExceptionSchema.ctor;
                throw Object.assign(new ErrorCtor(errorName), dataObject);
            }
            throw new Error(errorName);
        }
        const ns = NormalizedSchema.of(errorSchema);
        const message = dataObject.message ?? dataObject.Message ?? "Unknown";
        const exception = new errorSchema.ctor(message);
        await this.deserializeHttpMessage(errorSchema, context, response, dataObject);
        const output = {};
        for (const [name, member] of ns.structIterator()) {
            const target = member.getMergedTraits().jsonName ?? name;
            output[name] = this.codec.createDeserializer().readObject(member, dataObject[target]);
        }
        Object.assign(exception, {
            $metadata: metadata,
            $response: response,
            $fault: ns.getMergedTraits().error,
            message,
            ...output,
        });
        throw exception;
    }
}
