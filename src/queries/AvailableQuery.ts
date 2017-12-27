import { EntityData } from '../redux/EntityData'
import { Query, ListQuery } from '../Query'
import { Entity } from '../Schema'
import { StoreStateWrapper } from '../StoreStateWrapper'


export class AvailableQuery<E extends Entity=any, Variables={}, Children extends Query.Children=any> extends ListQuery<E, Variables, Children> {
    constructor(options: { entity: E, children?: Children }) {
        super(options.entity, options.children)
    }
  
    select(state: StoreStateWrapper, variables: Variables): ListQuery.Result<E, Children> {
        let predictedDataState = state.getPredictedDataState()
        let entityState: EntityData.State<E> = predictedDataState[this.entity.name]
        let ids = Object.keys(entityState.records)

        return {
            results: Object.values(entityState.records).map(record =>
                this.createRecordResult(state, record)
            ),
            status: 'fresh',
        }
    }
  
    canChangeAffectResult(state: StoreStateWrapper, variables?: Variables): boolean {
        let entityChanges = state[this.entity.name].changes
        
        if (!entityChanges) {
            return false
        }

        if (Object.keys(entityChanges.recordIds).length > 0) {
            return true
        }
        
        if (this.canChildrenChangeAffectResult(state)) {
            return true
        }

        return false
    }
  }