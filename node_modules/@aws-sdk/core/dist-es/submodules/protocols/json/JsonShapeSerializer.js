import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import { dateToUtcString } from "@smithy/core/serde";
import { LazyJsonString } from "@smithy/core/serde";
import { SerdeContextConfig } from "../ConfigurableSerdeContext";
import { JsonReplacer } from "./jsonReplacer";
export class JsonShapeSerializer extends SerdeContextConfig {
    settings;
    buffer;
    rootSchema;
    constructor(settings) {
        super();
        this.settings = settings;
    }
    write(schema, value) {
        this.rootSchema = NormalizedSchema.of(schema);
        this.buffer = this._write(this.rootSchema, value);
    }
    flush() {
        if (this.rootSchema?.isStructSchema() || this.rootSchema?.isDocumentSchema()) {
            const replacer = new JsonReplacer();
            return replacer.replaceInJson(JSON.stringify(this.buffer, replacer.createReplacer(), 0));
        }
        return this.buffer;
    }
    _write(schema, value, container) {
        const isObject = value !== null && typeof value === "object";
        const ns = NormalizedSchema.of(schema);
        if (ns.isListSchema() && Array.isArray(value)) {
            const listMember = ns.getValueSchema();
            const out = [];
            const sparse = !!ns.getMergedTraits().sparse;
            for (const item of value) {
                if (sparse || item != null) {
                    out.push(this._write(listMember, item));
                }
            }
            return out;
        }
        else if (ns.isMapSchema() && isObject) {
            const mapMember = ns.getValueSchema();
            const out = {};
            const sparse = !!ns.getMergedTraits().sparse;
            for (const [_k, _v] of Object.entries(value)) {
                if (sparse || _v != null) {
                    out[_k] = this._write(mapMember, _v);
                }
            }
            return out;
        }
        else if (ns.isStructSchema() && isObject) {
            const out = {};
            for (const [memberName, memberSchema] of ns.structIterator()) {
                const targetKey = this.settings.jsonName ? memberSchema.getMergedTraits().jsonName ?? memberName : memberName;
                const serializableValue = this._write(memberSchema, value[memberName], ns);
                if (serializableValue !== undefined) {
                    out[targetKey] = serializableValue;
                }
            }
            return out;
        }
        if (value === null && container?.isStructSchema()) {
            return void 0;
        }
        if (ns.isBlobSchema() && (value instanceof Uint8Array || typeof value === "string")) {
            if (ns === this.rootSchema) {
                return value;
            }
            if (!this.serdeContext?.base64Encoder) {
                throw new Error("Missing base64Encoder in serdeContext");
            }
            return this.serdeContext?.base64Encoder(value);
        }
        if (ns.isTimestampSchema() && value instanceof Date) {
            const options = this.settings.timestampFormat;
            const format = options.useTrait
                ? ns.getSchema() === SCHEMA.TIMESTAMP_DEFAULT
                    ? options.default
                    : ns.getSchema() ?? options.default
                : options.default;
            switch (format) {
                case SCHEMA.TIMESTAMP_DATE_TIME:
                    return value.toISOString().replace(".000Z", "Z");
                case SCHEMA.TIMESTAMP_HTTP_DATE:
                    return dateToUtcString(value);
                case SCHEMA.TIMESTAMP_EPOCH_SECONDS:
                    return value.getTime() / 1000;
                default:
                    console.warn("Missing timestamp format, using epoch seconds", value);
                    return value.getTime() / 1000;
            }
        }
        if (ns.isNumericSchema() && typeof value === "number") {
            if (Math.abs(value) === Infinity || isNaN(value)) {
                return String(value);
            }
        }
        const mediaType = ns.getMergedTraits().mediaType;
        if (ns.isStringSchema() && typeof value === "string" && mediaType) {
            const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
            if (isJson) {
                return LazyJsonString.from(value);
            }
        }
        return value;
    }
}
