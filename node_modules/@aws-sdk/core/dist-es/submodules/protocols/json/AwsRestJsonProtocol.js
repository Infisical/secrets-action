import { HttpBindingProtocol, HttpInterceptingShapeDeserializer, HttpInterceptingShapeSerializer, } from "@smithy/core/protocols";
import { NormalizedSchema, SCHEMA, TypeRegistry } from "@smithy/core/schema";
import { calculateBodyLength } from "@smithy/util-body-length-browser";
import { JsonCodec } from "./JsonCodec";
import { loadRestJsonErrorCode } from "./parseJsonBody";
export class AwsRestJsonProtocol extends HttpBindingProtocol {
    serializer;
    deserializer;
    codec;
    constructor({ defaultNamespace }) {
        super({
            defaultNamespace,
        });
        const settings = {
            timestampFormat: {
                useTrait: true,
                default: SCHEMA.TIMESTAMP_EPOCH_SECONDS,
            },
            httpBindings: true,
            jsonName: true,
        };
        this.codec = new JsonCodec(settings);
        this.serializer = new HttpInterceptingShapeSerializer(this.codec.createSerializer(), settings);
        this.deserializer = new HttpInterceptingShapeDeserializer(this.codec.createDeserializer(), settings);
    }
    getShapeId() {
        return "aws.protocols#restJson1";
    }
    getPayloadCodec() {
        return this.codec;
    }
    setSerdeContext(serdeContext) {
        this.codec.setSerdeContext(serdeContext);
        super.setSerdeContext(serdeContext);
    }
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        const inputSchema = NormalizedSchema.of(operationSchema.input);
        const members = inputSchema.getMemberSchemas();
        if (!request.headers["content-type"]) {
            const httpPayloadMember = Object.values(members).find((m) => {
                return !!m.getMergedTraits().httpPayload;
            });
            if (httpPayloadMember) {
                const mediaType = httpPayloadMember.getMergedTraits().mediaType;
                if (mediaType) {
                    request.headers["content-type"] = mediaType;
                }
                else if (httpPayloadMember.isStringSchema()) {
                    request.headers["content-type"] = "text/plain";
                }
                else if (httpPayloadMember.isBlobSchema()) {
                    request.headers["content-type"] = "application/octet-stream";
                }
                else {
                    request.headers["content-type"] = "application/json";
                }
            }
            else if (!inputSchema.isUnitSchema()) {
                const hasBody = Object.values(members).find((m) => {
                    const { httpQuery, httpQueryParams, httpHeader, httpLabel, httpPrefixHeaders } = m.getMergedTraits();
                    return !httpQuery && !httpQueryParams && !httpHeader && !httpLabel && httpPrefixHeaders === void 0;
                });
                if (hasBody) {
                    request.headers["content-type"] = "application/json";
                }
            }
        }
        if (request.headers["content-type"] && !request.body) {
            request.body = "{}";
        }
        if (request.body) {
            try {
                request.headers["content-length"] = String(calculateBodyLength(request.body));
            }
            catch (e) { }
        }
        return request;
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
