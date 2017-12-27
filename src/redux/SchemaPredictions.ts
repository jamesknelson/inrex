import { Data } from '../Data'
import { Entity, Schema } from '../Schema'


export namespace SchemaPredictions {
    export type EntityPrediction<E extends Entity=any> =
        { type: 'recordWillBeReplaced', id: string } | 
        { type: 'recordWillBeReplacedWith', id: string, record: Data.Record<E> } |
        { type: 'indexWillBeReplaced', key: string } | 
        { type: 'recordIdWillBeAddedToIndexes', id: string, keyPattern: string | RegExp } |
        { type: 'recordIdWillBeRemovedFromIndexes', id: string, keyPattern: string | RegExp } |
        { type: 'recordWillBeRemoved', id: string }

    export type Prediction<S extends Schema=any> = {
        id: number,
        entityPredictions: {
            [EntityName in keyof S]?: EntityPrediction<S[EntityName]>[]
        },
        error?: any
    }

    export type State<S extends Schema=any> = Prediction<S>[]

    export type Action<S extends Schema=any> =
        {
            type: 'SchemaPrediction.Add',
            payload: {
                prediction: Prediction<S>,
            }
        } |
        {
            type: 'SchemaPrediction.Resolve',
            payload: {
                id: number,   
            },
        } |
        {
            type: 'SchemaPrediction.Reject',
            payload: {
                id: number,
                error: any,
            },
        } |
        {
            type: 'SchemaPredictions.Reset',
        }
    
    export type Reducer<S extends Schema=any> = (state: State<S>, action: Action<S>) => State<S>;

    export function createReducer<S extends Schema>(schema: S): Reducer<S> {
        return function schemaPredictionsReducer(state, action: Action<S>) {
            switch (action.type) {
                case 'SchemaPrediction.Add':
                    let newPrediction = action.payload.prediction
                    let remainingPredictions = state.filter(x => !isLeftPredictionObselete(x, newPrediction))
                    return remainingPredictions.concat(newPrediction)

                case 'SchemaPrediction.Resolve':
                    let resolvedIndex = state.findIndex(prediction => prediction.id === action.payload.id)
                    if (resolvedIndex !== -1) {
                        let newState = state.slice(0)
                        newState.splice(resolvedIndex, 1)
                        return newState
                    }
                    return state
                
                case 'SchemaPrediction.Reject':
                    let rejectedIndex = state.findIndex(prediction => prediction.id === action.payload.id)
                    if (rejectedIndex !== -1) {
                        let newState = state.slice(0)
                        newState[rejectedIndex] = {
                            ...state[rejectedIndex],
                            error: action.payload.error,
                        }
                        return newState
                    }
                    return state
                
                case 'SchemaPredictions.Reset':
                    return []
                    
                default:
                    return state
            }
        }
    }


    export class PredictionBuilder<S extends Schema=any> {
        prediction: Prediction<S>

        constructor(id: number) {
            this.prediction = {
                id,
                entityPredictions: {},
            }
        }

        recordWillBeReplaced(entityName: keyof S, id: string) {
            this.addPrediction(entityName, {
                type: 'recordWillBeReplaced',
                id,
            })
        }

        recordWillBeReplacedWith<EntityName extends keyof S>(entityName: EntityName, record: Data.Record<S[EntityName]>) {
            this.addPrediction(entityName, {
                type: 'recordWillBeReplacedWith',
                id: record.id,
                record,
            })
        }

        indexWillBeReplaced(entityName: keyof S, key: string) {
            this.addPrediction(entityName, {
                type: 'indexWillBeReplaced',
                key,
            })
        }

        recordWillBeRemoved(entityName: keyof S, id: string) {
            this.addPrediction(entityName, {
                type: 'recordWillBeRemoved',
                id,
            })
        }

        recordIdWillBeAddedToIndexes(entityName: keyof S, id: string, keyPattern: string | RegExp) {
            this.addPrediction(entityName, {
                type: 'recordIdWillBeAddedToIndexes',
                id,
                keyPattern,
            })
        }

        recordIdWillBeRemovedFromIndexes(entityName: keyof S, id: string, keyPattern: string | RegExp) {
            this.addPrediction(entityName, {
                type: 'recordIdWillBeRemovedFromIndexes',
                id,
                keyPattern
            })
        }

        private addPrediction<EntityName extends keyof S>(entityName: EntityName, prediction: EntityPrediction<S[EntityName]>) {
            let predictions = this.prediction.entityPredictions[entityName]
            if (!predictions) {
                predictions = []
                this.prediction.entityPredictions[entityName] = predictions
            }
            predictions.push(prediction)
        }
    }
}


function isLeftPredictionObselete(left: SchemaPredictions.Prediction, right: SchemaPredictions.Prediction): boolean {
    let rightEntityNames = new Set(Object.keys(right))
    let leftEntityNames = Object.keys(left)

    if (leftEntityNames.some(name => !rightEntityNames.has(name))) {
        return false
    }

    for (let entityName of leftEntityNames) {
        let leftEntityPrediction = left[entityName]
        let rightEntityPrediction = right[entityName]

        let rightIds = new Set(Object.keys(rightEntityPrediction.records))
        let leftIds = Object.keys(leftEntityPrediction.records)
        if (leftIds.some(id => !rightIds.has(id))) {
            return false
        }

        let rightKeys = new Set(Object.keys(rightEntityPrediction.indexes))
        let leftKeys = Object.keys(leftEntityPrediction.indexes)
        if (leftKeys.some(key => !rightKeys.has(key))) {
            return false
        }
    }

    return true
}