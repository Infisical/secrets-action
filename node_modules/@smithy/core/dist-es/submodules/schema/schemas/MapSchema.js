import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";
export class MapSchema extends Schema {
    constructor(name, traits, keySchema, valueSchema) {
        super(name, traits);
        this.name = name;
        this.traits = traits;
        this.keySchema = keySchema;
        this.valueSchema = valueSchema;
    }
}
export function map(namespace, name, traits = {}, keySchema, valueSchema) {
    const schema = new MapSchema(namespace + "#" + name, traits, keySchema, typeof valueSchema === "function" ? valueSchema() : valueSchema);
    TypeRegistry.for(namespace).register(name, schema);
    return schema;
}
