import { createStore } from 'redux'
import { Index, Record } from './DataTypes'
import { Query } from './Query'
import { Entity, Schema } from './Schema'
import { SchemaData } from './redux/SchemaData'
import { SchemaPredictions } from './redux/SchemaPredictions'
import { Store } from './redux/Store'
import { StoreStateWrapper } from './StoreStateWrapper'


export class SubscriptionManager<S extends Schema=any> {
    private schema: S
    private reduxStore: any
    private selector: (storeState: any) => Store.State<S>
    private queries = new Map<Query, Function[]>()

    private latestWrapper: StoreStateWrapper<S>

    private nextPredictionId = 1

    private batchLevel = 0
    private batchQueries = new Set<Query>()

    constructor(schema: S, reduxStore?: any, selector?: (storeState: any) => Store.State<S>) {
        this.schema = schema

        this.reduxStore = reduxStore
        if (!reduxStore) {
            let reducer = Store.createReducer(schema)
            let emptyState = Store.createEmptyState(schema)
            let enhancer =
                typeof window !== 'undefined' &&
                (<any>window).__REDUX_DEVTOOLS_EXTENSION__ &&
                (<any>window).__REDUX_DEVTOOLS_EXTENSION__()
            this.reduxStore = createStore(reducer, emptyState, enhancer || undefined)
        }

        this.selector = selector || ((x) => x)
        this.setLatestWrapper()
        
        this.reduxStore.subscribe(this.handleStateChange)
    }

    subscribe<Q extends Query<any, {}, any>>(query: Q, callback: (result: Query.Result<Q>) => void): Unsubscriber {
        let callbacks = this.queries.get(query) as Function[]
        if (!callbacks) {
            callbacks = []
            this.queries.set(query, [])
        }
        callbacks.push(callback)

        return () => {
            let callbackIndex = callbacks.indexOf(callback)
            if (callbackIndex !== -1) {
                callbacks.splice(callbackIndex, 1)
            }
        }
    }

    execute<Q extends Query>(query: Q): Query.Result<Q> {
        return query.select(this.latestWrapper, {})
    }
    
    predict(builder: (predictionBuilder: SchemaPredictions.PredictionBuilder<S>) => void): {
        resolve: () => void,
        reject: (error: any) => void,
    } {
        let id = this.nextPredictionId++
        let predictionBuilder = new SchemaPredictions.PredictionBuilder<S>(id)
        builder(predictionBuilder)
        let prediction = predictionBuilder.prediction

        this.reduxStore.dispatch({
            type: 'SchemaPrediction.Add',
            payload: {
                prediction: predictionBuilder.prediction
            },
        } as SchemaPredictions.Action)

        return {
            resolve: () =>  {
                this.reduxStore.dispatch({
                    type: 'SchemaPrediction.Resolve',
                    payload: {
                        id,
                    },
                } as SchemaPredictions.Action)
            },
            reject: (error: any) => {
                this.reduxStore.dispatch({
                    type: 'SchemaPrediction.Reject',
                    payload: {
                        id,
                        error,
                    },
                } as SchemaPredictions.Action)
            }
        }
    }

    update(builder: (updateBuilder: SchemaData.ActionBuilder<S>) => void): void {
        let updateBuilder = new SchemaData.ActionBuilder<S>()
        builder(updateBuilder)
        let reduxAction = updateBuilder.action
        this.reduxStore.dispatch(reduxAction)
    }

    getDataState(): Store.State<S>["data"] {
        return this.latestWrapper.getPredictedDataState()
    }

    getKnownDataState(): Store.State<S>["data"] {
        return this.selector(this.reduxStore.getState()).data
    }

    startBatch(): void {
        this.batchLevel++
    }

    flushBatch(): void {
        if (--this.batchLevel === 0) {
            for (let query of this.batchQueries.values()) {
                let callbacks = this.queries.get(query)

                if (callbacks) {
                    let result = query.select(this.latestWrapper, {})
                    callbacks.forEach(callback => callback(result))
                }
            }
            this.batchQueries.clear()
        }
    }

    private handleStateChange = () => {
        this.setLatestWrapper()
        for (let [query, callbacks] of this.queries.entries()) {
            if (query.canChangeAffectResult(this.latestWrapper)) {
                if (this.batchLevel === 0) {
                    let result = query.select(this.latestWrapper, {})
                    callbacks.forEach(callback => callback(result))
                }
                else {
                    this.batchQueries.add(query)
                }
            }
        }
    }

    private setLatestWrapper() {
        this.latestWrapper = new StoreStateWrapper(this.selector(this.reduxStore.getState()))
    }
}

type Unsubscriber = () => void