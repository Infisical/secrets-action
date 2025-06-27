import { HttpBindingProtocol, HttpInterceptingShapeDeserializer, HttpInterceptingShapeSerializer, } from "@smithy/core/protocols";
import { NormalizedSchema, SCHEMA, TypeRegistry } from "@smithy/core/schema";
import { calculateBodyLength } from "@smithy/util-body-length-browser";
import { loadRestXmlErrorCode } from "./parseXmlBody";
import { XmlCodec } from "./XmlCodec";
export class AwsRestXmlProtocol extends HttpBindingProtocol {
    codec;
    serializer;
    deserializer;
    constructor(options) {
        super(options);
        const settings = {
            timestampFormat: {
                useTrait: true,
                default: SCHEMA.TIMESTAMP_DATE_TIME,
            },
            httpBindings: true,
            xmlNamespace: options.xmlNamespace,
            serviceNamespace: options.defaultNamespace,
        };
        this.codec = new XmlCodec(settings);
        this.serializer = new HttpInterceptingShapeSerializer(this.codec.createSerializer(), settings);
        this.deserializer = new HttpInterceptingShapeDeserializer(this.codec.createDeserializer(), settings);
    }
    getPayloadCodec() {
        return this.codec;
    }
    getShapeId() {
        return "aws.protocols#restXml";
    }
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        const ns = NormalizedSchema.of(operationSchema.input);
        const members = ns.getMemberSchemas();
        request.path =
            String(request.path)
                .split("/")
                .filter((segment) => {
                return segment !== "{Bucket}";
            })
                .join("/") || "/";
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
                    request.headers["content-type"] = "application/xml";
                }
            }
            else if (!ns.isUnitSchema()) {
                const hasBody = Object.values(members).find((m) => {
                    const { httpQuery, httpQueryParams, httpHeader, httpLabel, httpPrefixHeaders } = m.getMergedTraits();
                    return !httpQuery && !httpQueryParams && !httpHeader && !httpLabel && httpPrefixHeaders === void 0;
                });
                if (hasBody) {
                    request.headers["content-type"] = "application/xml";
                }
            }
        }
        if (request.headers["content-type"] === "application/xml") {
            if (typeof request.body === "string") {
                request.body = '<?xml version="1.0" encoding="UTF-8"?>' + request.body;
            }
        }
        if (request.body) {
            try {
                request.headers["content-length"] = String(calculateBodyLength(request.body));
            }
            catch (e) { }
        }
        return request;
    }
    async deserializeResponse(operationSchema, context, response) {
        return super.deserializeResponse(operationSchema, context, response);
    }
    async handleError(operationSchema, context, response, dataObject, metadata) {
        const errorIdentifier = loadRestXmlErrorCode(response, dataObject) ?? "Unknown";
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
        const message = dataObject.Error?.message ?? dataObject.Error?.Message ?? dataObject.message ?? dataObject.Message ?? "Unknown";
        const exception = new errorSchema.ctor(message);
        await this.deserializeHttpMessage(errorSchema, context, response, dataObject);
        const output = {};
        for (const [name, member] of ns.structIterator()) {
            const target = member.getMergedTraits().xmlName ?? name;
            const value = dataObject.Error?.[target] ?? dataObject[target];
            output[name] = this.codec.createDeserializer().readSchema(member, value);
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
