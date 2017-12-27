import { Data } from '../Data'
import { Entity } from '../Schema'
import { EntityData } from '../redux/EntityData'
import { Query, ListQuery } from '../Query'
import { StoreStateWrapper } from '../StoreStateWrapper'


export class IdListQuery<E extends Entity=any, Variables={}, Children extends Query.Children=any> extends ListQuery<E, Variables, Children> {
    ids: string[] | ((variables: Variables) => string[]);
    
    constructor(options: { entity: E, children?: Children, ids: IdListQuery["ids"] }) {
        super(options.entity, options.children)
        this.ids = options.ids
    }
  
    select(state: StoreStateWrapper, variables: Variables): ListQuery.Result<E, Children> {
        let ids = this.getIds(variables)
        let entityState: EntityData.State<E> = state[this.entity.name]
        
        return {
            results: ids.map(id => {
                let record = entityState.records[id]
                return this.createRecordResult(state, record || { id } as Data.Record<E>)
            }),
            status: 'fresh',
        }
    }
  
    canChangeAffectResult(state: StoreStateWrapper, variables?: Variables): boolean {
        let entityChanges = state[this.entity.name].changes

        if (entityChanges) {
            return false
        }

        let ids = this.getIds(variables)
        if (!ids || ids.some(id => (<any>entityChanges).recordIds.includes(id))) {
            return true
        }
        
        if (this.canChildrenChangeAffectResult(state)) {
            return true
        }

        return false
    }

    private getIds(variables: Variables): string[];
    private getIds(variables: Variables | undefined): string[] | undefined;
    private getIds(variables?: Variables): string[] | undefined {
        if (Array.isArray(this.ids)) {
            return this.ids
        }
        else if (variables) {
            return this.ids(variables)
        }
    }
  }