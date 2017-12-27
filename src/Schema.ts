import { Data } from './Data'
import { Query } from './Query'

import { AvailableQuery } from './queries/AvailableQuery'
import { IdListQuery } from './queries/IdListQuery'
import { IdQuery } from './queries/IdQuery'
import { IndexQuery } from './queries/IndexQuery'


export type Schema = {
    [entityName: string]: Entity<any>
}


// TODO.
// This should facilitate normalization of an entity's data using normalizr,
// augmented with the ability to run wire format conversions and to
// produces indexes and store actions
export type Relationships = any


type MergeStrategy = (entityA, entityB) => any
type ProcessStrategy = (input, parent, key) => any


const defaultMergeStrategy = (entityA, entityB) => {
    return { ...entityA, ...entityB }
}

const getDefaultProcessStrategy = (attributes: { [name: string]: Attribute }): ProcessStrategy => {
    let attributesWithConverters =
        Object.values(attributes).filter(attribute => !!attribute.convertFromWireFormat )
    
    if (attributesWithConverters.length === 0) {
        return (input) => input
    }

    return (input) => {
        let processedInput = { ...input }
        attributesWithConverters.forEach(attribute => {
            processedInput[attribute.name] = (<any>attribute.convertFromWireFormat)(attribute[name])
        })
        return processedInput
    }
}


export class Entity<Attributes extends { [name: string]: Attribute }=any> {
    name: string;
    attributes: Attributes;
    relationships: Relationships;

    private mergeStrategy: MergeStrategy
    private processStrategy: ProcessStrategy

    constructor(name: string, attributes: Attributes, options: { mergeStrategy?: MergeStrategy, processStrategy?: ProcessStrategy } = {}) {
        this.name = name
        this.attributes = attributes
        this.relationships = {}

        this.mergeStrategy = options.mergeStrategy || defaultMergeStrategy
        this.processStrategy = options.processStrategy || getDefaultProcessStrategy(attributes)
    }

    //
    // Normalizr support
    //

    define(relationships: Relationships): void {
        this.relationships = Object.keys(relationships).reduce((entityRelationship, key) => {
            const relationship = relationships[key]
            return { ...entityRelationship, [key]: relationship }
        }, this.relationships || {})
    }
    get key(): string {
        return this.name
    }
    getId(input, parent, key) {
        // TODO:
        // I want to support other id attributes, but this would require
        // changes to the store
        return input.id
    }
    merge(entityA, entityB) {
        return this.mergeStrategy(entityA, entityB)
    }
    normalize(input, parent, key, visit, addEntity) {
        const processedEntity = this.processStrategy(input, parent, key)
        Object.keys(this.relationships).forEach((key) => {
            if (processedEntity.hasOwnProperty(key) && typeof processedEntity[key] === 'object') {
                const relationship = this.relationships[key]
                processedEntity[key] = visit(processedEntity[key], processedEntity, key, relationship, addEntity)
            }
        })
        addEntity(this, processedEntity, input, parent, key)
        return this.getId(input, parent, key)
    }
    denormalize(entity, unvisit) {
        Object.keys(this.relationships).forEach((key) => {
            if (entity.hasOwnProperty(key)) {
                const schema = this.relationships[key]
                entity[key] = unvisit(entity[key], schema)
            }
        });
        return entity
    }

    //
    // Query helpers
    //

    available<E extends Entity<any>>(): AvailableQuery<this, Data.Record<E>, {}>;
    available<E extends Entity<any>, Children extends Query.Children<this>>(children: Children): AvailableQuery<this, Data.Record<E>, Children>;
    available<E extends Entity<any>, Children extends Query.Children<this>={}>(children?: Children): AvailableQuery<this, Data.Record<E>, Children> {
        return new AvailableQuery({ entity: this, children })
    }

    id<E extends Entity<any>>(id: string | ((record: Data.Record<E>) => string)): IdQuery<this, Data.Record<E>, {}>;
    id<E extends Entity<any>, Children extends Query.Children<this>>(id: string | ((record: Data.Record<E>) => string), children: Children): IdQuery<this, Data.Record<E>, Children>;
    id<E extends Entity<any>, Children extends Query.Children<this>={}>(id: string | ((record: Data.Record<E>) => string), children?: Children): IdQuery<this, Data.Record<E>, Children> {
        return new IdQuery({ entity: this, children, id })
    }

    ids<E extends Entity<any>>(ids: string[] | ((record: Data.Record<E>) => string[])): IdListQuery<this, Data.Record<E>, {}>;
    ids<E extends Entity<any>, Children extends Query.Children<this>>(ids: string[] | ((record: Data.Record<E>) => string[]), children: Children): IdListQuery<this, Data.Record<E>, Children>;
    ids<E extends Entity<any>, Children extends Query.Children<this>={}>(ids: string[] | ((record: Data.Record<E>) => string[]), children?: Children): IdListQuery<this, Data.Record<E>, Children> {
        return new IdListQuery({ entity: this, children, ids })
    }

    index<E extends Entity<any>>(key: string | ((record: Data.Record<E>) => string)): IndexQuery<this, Data.Record<E>, {}>;
    index<E extends Entity<any>, Children extends Query.Children<this>>(key: string | ((record: Data.Record<E>) => string), children: Children): IndexQuery<this, Data.Record<E>, Children>;
    index<E extends Entity<any>, Children extends Query.Children<this>={}>(key: string | ((record: Data.Record<E>) => string), children?: Children): IndexQuery<this, Data.Record<E>, Children> {
        return new IndexQuery({ entity: this, children, key })
    }
}


export function createEntity<
    AO extends { [name: string]: AttributeOptions }=any,
    Statics={}
>(
    name: string,
    options: { attributes: AO, relationships?: Relationships, statics?: Statics },
): Entity<{ [K in keyof AO]: Attribute<AO["primitive"], AO["model"]> }> & Statics {
    let attributes = {} as { [K in keyof AO]: Attribute<AO["primitive"], AO["model"]> }
    let attributeNames = Object.keys(options.attributes)
    for (let i = 0; i < attributeNames.length; i++) {
        let name = attributeNames[i]
        let attributeOptions = options.attributes[name]

        if (attributeOptions['name']) {
            throw new Error(`The "name" property on an Attribute object is reserved.`)
        }

        attributes[name] = {
            ...options.attributes[name],
            name: name,
        }
    }

    let entity = new Entity(name, attributes)
    entity.define(options.relationships || {})
    Object.assign(entity, options.statics)
    return <any>entity
}


export interface AttributeOptions<Primitive=any, Model=any> {
    primitive: Primitive;
    model?: Model,

    convertToWireFormat?(value: Primitive | undefined): any;
    convertFromWireFormat?(value: any): Primitive | undefined;
}
export interface Attribute<Primitive=any, Model=any> extends AttributeOptions<Primitive, Model> {
    name: string;  
}


export namespace Attributes {
    export function arrayOf<AO extends AttributeOptions<any, any>, M>(children: AO, model?: M): AttributeOptions<AO["primitive"][], M> {
        return {
            primitive: <any>undefined,
            model: model,
        }
    }
    export function objectOf<AO extends AttributeOptions<any, any>, M>(children: AO, model?: M): AttributeOptions<{ [key: string]: AO["primitive"] }, M> {
        return {
            primitive: <any>undefined,
            model,
        }
    }
    export function shape<AO extends { [key: string]: AttributeOptions<any, any> }, M>(children: AO, model?: M): AttributeOptions<{ [K in keyof AO]: AO[K]["primitive"] }, M> {
        return {
            primitive: <any>undefined,
            model,
        }
    }
    export function utcDate<M>(model?: M): AttributeOptions<Date, M> {
        return {
            primitive: <any>undefined,
            model,

            convertFromWireFormat: getDateFromISOString,
            convertToWireFormat: getISOStringFromDate,
        }
    }
    export function number<M>(model?: M): AttributeOptions<number, M> {
        return {
            primitive: <any>undefined,
            model,
        }
    }
    export function string<M>(model?: M): AttributeOptions<string, M> {
        return {
            primitive: <any>undefined,
            model,
        }
    }
    export function bool<M>(model?: M): AttributeOptions<boolean, M> {
        return {
            primitive: <any>undefined,
            model,
        }
    }
}

function getDateFromISOString(str?: string) {
    return str ? new Date(str) : undefined
}

function getISOStringFromDate(date?: Date) {
    return date ? date.toISOString() : undefined
}