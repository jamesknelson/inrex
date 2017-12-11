import { Record } from '../DataTypes'
import { Entity } from '../Schema'
import { EntityData } from '../redux/EntityData'
import { Query, ListQuery } from '../Query'
import { StoreStateWrapper } from '../StoreStateWrapper'


export class IndexQuery<E extends Entity=any, Variables={}, Children extends Query.Children=any> extends ListQuery<E, Variables, Children> {
    key: string | ((variables: Variables) => string);
    
    constructor(options: { entity: E, children?: Children, key: IndexQuery["key"] }) {
        super(options.entity, options.children)
        this.key = options.key
    }
  
    select(state: StoreStateWrapper, variables: Variables): ListQuery.Result<E, Children> {
        let key = this.getKey(variables)
        let entityState: EntityData.State<E> = state[this.entity.name]
        let index = entityState.indexes[key]

        if (!index) {
            return {
                results: [],
                status: 'unknown',
            }
        }

        return {
            results: index.ids.map(id => {
                let record = entityState.records[id]
                return this.createRecordResult(state, record || { id })
            }),
            ...state.getIndexStatus(this.entity.name, key)
        }
    }
  
    canChangeAffectResult(state: StoreStateWrapper, variables?: Variables): boolean {
        let entityChanges = state[this.entity.name].changes

        if (!entityChanges) {
            return false
        }

        // The result records may have changed, so just recompute everything
        if (Object.keys(entityChanges.recordIds).length > 0) {
            return true
        }

        let key = this.getKey(variables)
        if (!key || entityChanges.indexKeys.includes(key)) {
            return true
        }
        
        if (this.canChildrenChangeAffectResult(state)) {
            return true
        }

        return false
    }

    private getKey(variables: Variables): string;
    private getKey(variables: Variables | undefined): string | undefined;
    private getKey(variables?: Variables): string | undefined {
        if (typeof this.key === 'string') {
            return this.key
        }
        else if (variables) {
            return this.key(variables)
        }
    }
  }