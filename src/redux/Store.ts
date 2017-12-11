import { Schema } from '../Schema'
import { SchemaData } from './SchemaData'
import { SchemaPredictions } from './SchemaPredictions'

export namespace Store {
    export type State<S extends Schema=any> = {
        data: SchemaData.State<S>,
        predictions: SchemaPredictions.State<S>,
    }

    export type Action<S extends Schema=any> = 
        SchemaData.Action |
        SchemaPredictions.Action

    export type Reducer<S extends Schema=any> = (state: State<S>, action: Action<S>) => State<S>;

    export function createEmptyState<S extends Schema>(schema: S): State<S> {
        return {
            data: SchemaData.createEmptyState(schema),
            predictions: [],
        }
    }

    export function createReducer<S extends Schema>(schema: S): Reducer<S> {
        let dataReducer = SchemaData.createReducer(schema)
        let predictionsReducer = SchemaPredictions.createReducer(schema)

        return function reducer(state: State<S>, action: any): State<S> {
            let nextData = dataReducer(state.data, action)
            let nextPredictions = predictionsReducer(state.predictions, action)

            if (nextData !== state.data || nextPredictions !== state.predictions) {
                return {
                    data: nextData,
                    predictions: nextPredictions,
                }
            }
            else {
                return state
            }
        }
    }
}