import type { SchemaRef, SchemaTraits, StructureSchema as IStructureSchema } from "@smithy/types";
import { Schema } from "./Schema";
/**
 * A structure schema has a known list of members. This is also used for unions.
 *
 * @alpha
 */
export declare class StructureSchema extends Schema implements IStructureSchema {
    name: string;
    traits: SchemaTraits;
    memberNames: string[];
    memberList: SchemaRef[];
    members: Record<string, [SchemaRef, SchemaTraits]>;
    constructor(name: string, traits: SchemaTraits, memberNames: string[], memberList: SchemaRef[]);
}
/**
 * Factory for StructureSchema.
 *
 * @internal
 */
export declare function struct(namespace: string, name: string, traits: SchemaTraits, memberNames: string[], memberList: SchemaRef[]): StructureSchema;
