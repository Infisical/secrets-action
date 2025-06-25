import { collectBody, RpcProtocol } from "@smithy/core/protocols";
import { deref, NormalizedSchema, SCHEMA, TypeRegistry } from "@smithy/core/schema";
import { calculateBodyLength } from "@smithy/util-body-length-browser";
import { XmlShapeDeserializer } from "../xml/XmlShapeDeserializer";
import { QueryShapeSerializer } from "./QueryShapeSerializer";
export class AwsQueryProtocol extends RpcProtocol {
    options;
    serializer;
    deserializer;
    constructor(options) {
        super({
            defaultNamespace: options.defaultNamespace,
        });
        this.options = options;
        const settings = {
            timestampFormat: {
                useTrait: true,
                default: SCHEMA.TIMESTAMP_DATE_TIME,
            },
            httpBindings: false,
            xmlNamespace: options.xmlNamespace,
            serviceNamespace: options.defaultNamespace,
            serializeEmptyLists: true,
        };
        this.serializer = new QueryShapeSerializer(settings);
        this.deserializer = new XmlShapeDeserializer(settings);
    }
    getShapeId() {
        return "aws.protocols#awsQuery";
    }
    setSerdeContext(serdeContext) {
        this.serializer.setSerdeContext(serdeContext);
        this.deserializer.setSerdeContext(serdeContext);
    }
    getPayloadCodec() {
        throw new Error("AWSQuery protocol has no payload codec.");
    }
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        if (!request.path.endsWith("/")) {
            request.path += "/";
        }
        Object.assign(request.headers, {
            "content-type": `application/x-www-form-urlencoded`,
        });
        if (deref(operationSchema.input) === "unit" || !request.body) {
            request.body = "";
        }
        request.body = `Action=${operationSchema.name.split("#")[1]}&Version=${this.options.version}` + request.body;
        if (request.body.endsWith("&")) {
            request.body = request.body.slice(-1);
        }
        try {
            request.headers["content-length"] = String(calculateBodyLength(request.body));
        }
        catch (e) { }
        return request;
    }
    async deserializeResponse(operationSchema, context, response) {
        const deserializer = this.deserializer;
        const ns = NormalizedSchema.of(operationSchema.output);
        const dataObject = {};
        if (response.statusCode >= 300) {
            const bytes = await collectBody(response.body, context);
            if (bytes.byteLength > 0) {
                Object.assign(dataObject, await deserializer.read(SCHEMA.DOCUMENT, bytes));
            }
            await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
        }
        for (const header in response.headers) {
            const value = response.headers[header];
            delete response.headers[header];
            response.headers[header.toLowerCase()] = value;
        }
        const awsQueryResultKey = ns.isStructSchema() && this.useNestedResult() ? operationSchema.name.split("#")[1] + "Result" : undefined;
        const bytes = await collectBody(response.body, context);
        if (bytes.byteLength > 0) {
            Object.assign(dataObject, await deserializer.read(ns, bytes, awsQueryResultKey));
        }
        const output = {
            $metadata: this.deserializeMetadata(response),
            ...dataObject,
        };
        return output;
    }
    useNestedResult() {
        return true;
    }
    async handleError(operationSchema, context, response, dataObject, metadata) {
        const errorIdentifier = this.loadQueryErrorCode(response, dataObject) ?? "Unknown";
        let namespace = this.options.defaultNamespace;
        let errorName = errorIdentifier;
        if (errorIdentifier.includes("#")) {
            [namespace, errorName] = errorIdentifier.split("#");
        }
        const errorDataSource = this.loadQueryError(dataObject);
        const registry = TypeRegistry.for(namespace);
        let errorSchema;
        try {
            errorSchema = registry.find((schema) => NormalizedSchema.of(schema).getMergedTraits().awsQueryError?.[0] === errorName);
            if (!errorSchema) {
                errorSchema = registry.getSchema(errorIdentifier);
            }
        }
        catch (e) {
            const baseExceptionSchema = TypeRegistry.for("smithy.ts.sdk.synthetic." + namespace).getBaseException();
            if (baseExceptionSchema) {
                const ErrorCtor = baseExceptionSchema.ctor;
                throw Object.assign(new ErrorCtor(errorName), errorDataSource);
            }
            throw new Error(errorName);
        }
        const ns = NormalizedSchema.of(errorSchema);
        const message = this.loadQueryErrorMessage(dataObject);
        const exception = new errorSchema.ctor(message);
        const output = {};
        for (const [name, member] of ns.structIterator()) {
            const target = member.getMergedTraits().xmlName ?? name;
            const value = errorDataSource[target] ?? dataObject[target];
            output[name] = this.deserializer.readSchema(member, value);
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
    loadQueryErrorCode(output, data) {
        const code = (data.Errors?.[0]?.Error ?? data.Errors?.Error ?? data.Error)?.Code;
        if (code !== undefined) {
            return code;
        }
        if (output.statusCode == 404) {
            return "NotFound";
        }
    }
    loadQueryError(data) {
        return data.Errors?.[0]?.Error ?? data.Errors?.Error ?? data.Error;
    }
    loadQueryErrorMessage(data) {
        const errorData = this.loadQueryError(data);
        return errorData?.message ?? errorData?.Message ?? data.message ?? data.Message ?? "Unknown";
    }
}
