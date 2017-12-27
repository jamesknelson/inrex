import { Data } from '../Data'
import { Entity } from '../Schema'
import { EntityData } from '../redux/EntityData'
import { Query, RecordQuery } from '../Query'
import { StoreStateWrapper } from '../StoreStateWrapper'


export class IdQuery<E extends Entity=any, Variables={}, Children extends Query.Children=any> extends RecordQuery<E, Variables, Children> {
    id: string | ((variables: Variables) => string);
    
    constructor(options: { entity: E, children?: Children, id: IdQuery["id"] }) {
        super(options.entity, options.children)
        this.id = options.id
    }
  
    select(state: StoreStateWrapper, variables: Variables): RecordQuery.Result<E, Children> {
        let id = this.getId(variables)
        let entityState: EntityData.State<E> = state[this.entity.name]
        let record = entityState.records[id]
        return this.createRecordResult(state, record || { id } as Data.Record<E>)
    }
  
    canChangeAffectResult(state: StoreStateWrapper, variables?: Variables): boolean {
        let entityChanges = state[this.entity.name].changes

        if (!entityChanges) {
            return false
        }

        let id = this.getId(variables)
        if (!id || entityChanges.recordIds.includes(id)) {
            return true
        }
        
        if (this.canChildrenChangeAffectResult(state)) {
            return true
        }

        return false
    }

    private getId(variables: Variables): string;
    private getId(variables: Variables | undefined): string | undefined;
    private getId(variables?: Variables): string | undefined {
        if (typeof this.id === 'string') {
            return this.id
        }
        else if (variables) {
            return this.id(variables)
        }
    }
  }