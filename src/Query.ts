import { Data } from './Data'
import { Entity } from './Schema'
import { StoreStateWrapper } from './StoreStateWrapper'


export type Query<E extends Entity=any, Variables={}, Children extends Query.Children<E>=any> =
    RecordQuery<E, Variables, Children> |
    ListQuery<E, Variables, Children>

export namespace Query {
    export type Result<Q extends Query<any, any, any>=any> = {
        'RecordQuery': RecordQuery.Result<Q["entity"], Q["children"]>,
        'ListQuery': ListQuery.Result<Q["entity"], Q["children"]>,
    }[Q['type']]    

    export type Children<E extends Entity=any> = {
        [childName: string]: Query<any, Data.Record<E>, any>
    }
}


/**
 * BaseQuery
 */     
    
export abstract class BaseQuery<E extends Entity, Variables, Children extends Query.Children<E>> {
    entity: E;
    children: Children;

    private childNames: string[]

    constructor(entity: E, children?: Children) {
        this.entity = entity
        this.children = children || ({} as Children)
        this.childNames = Object.keys(this.children)
    }
    
    abstract canChangeAffectResult(storeState: StoreStateWrapper, variables?: Variables): boolean;

    abstract select(
        storeState: StoreStateWrapper,
        variables: Variables
    ): any

    protected createRecordResult(
        storeState: StoreStateWrapper,
        record: Data.Record<E>
    ): RecordQuery.Result<E, Children> {
        let children = {} as { [ChildName in keyof Children]: Query.Result<Children[ChildName]> }
        for (let i = 0; i < this.childNames.length; i++) {
            let childName = this.childNames[i]
            children[childName] = this.children[childName].select(storeState, record)
        }

        return {
            data: record,
            children,
            ...storeState.getRecordStatus(this.entity.name, record.id),
        }
    }

    protected canChildrenChangeAffectResult(storeState: StoreStateWrapper): boolean {
        for (let i = 0; i < this.childNames.length; i++) {
            if (this.children[this.childNames[i]].canChangeAffectResult(storeState)) {
                return true
            }
        }

        return false
    }
}


/**
 * RecordQuery
 */

export abstract class RecordQuery<E extends Entity, Variables, Children extends Query.Children<E>> extends BaseQuery<E, Variables, Children> {
    type: 'RecordQuery'

    constructor(entity: E, children?: Children) {
        super(entity, children)
        this.type = 'RecordQuery'
    }

    abstract select(
        storeState: StoreStateWrapper,
        variables: Variables
    ): RecordQuery.Result<E, Children>;
}

export namespace RecordQuery {
    export interface Result<E extends Entity=any, Children extends Query.Children<E>={}> {
        data: Data.Record<E>,
        children: {
            [ChildName in keyof Children]: Query.Result<Children[ChildName]>;
        },
        status: StoreStateWrapper.RecordStatus,
        error?: any,
    }    
}


/**
 * ListQuery
 */

export abstract class ListQuery<E extends Entity, Variables, Children extends Query.Children<E>> extends BaseQuery<E, Variables, Children> {
    type: 'ListQuery'

    constructor(entity: E, children?: Children) {
        super(entity, children)
        this.type = 'ListQuery'
    }

    abstract select(
        storeState: StoreStateWrapper,
        variables: Variables
    ): ListQuery.Result<E, Children>;
}

export namespace ListQuery {
    export interface Result<E extends Entity=any, Children extends Query.Children<E>={}> {
        results: RecordQuery.Result<E, Children>[],
        status: StoreStateWrapper.IndexStatus,
        error?: any
    }
}