import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";
export class StructureSchema extends Schema {
    constructor(name, traits, memberNames, memberList) {
        super(name, traits);
        this.name = name;
        this.traits = traits;
        this.memberNames = memberNames;
        this.memberList = memberList;
        this.members = {};
        for (let i = 0; i < memberNames.length; ++i) {
            this.members[memberNames[i]] = Array.isArray(memberList[i])
                ? memberList[i]
                : [memberList[i], 0];
        }
    }
}
export function struct(namespace, name, traits, memberNames, memberList) {
    const schema = new StructureSchema(namespace + "#" + name, traits, memberNames, memberList);
    TypeRegistry.for(namespace).register(name, schema);
    return schema;
}
