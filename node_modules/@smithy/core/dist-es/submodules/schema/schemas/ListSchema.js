import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";
export class ListSchema extends Schema {
    constructor(name, traits, valueSchema) {
        super(name, traits);
        this.name = name;
        this.traits = traits;
        this.valueSchema = valueSchema;
    }
}
export function list(namespace, name, traits = {}, valueSchema) {
    const schema = new ListSchema(namespace + "#" + name, traits, typeof valueSchema === "function" ? valueSchema() : valueSchema);
    TypeRegistry.for(namespace).register(name, schema);
    return schema;
}
