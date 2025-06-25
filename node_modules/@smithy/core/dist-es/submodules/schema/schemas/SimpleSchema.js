import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";
export class SimpleSchema extends Schema {
    constructor(name, schemaRef, traits) {
        super(name, traits);
        this.name = name;
        this.schemaRef = schemaRef;
        this.traits = traits;
    }
}
export function sim(namespace, name, schemaRef, traits) {
    const schema = new SimpleSchema(namespace + "#" + name, schemaRef, traits);
    TypeRegistry.for(namespace).register(name, schema);
    return schema;
}
