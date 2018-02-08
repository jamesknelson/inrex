import { createStore } from 'redux'
import { OutletSubject, Outlet } from 'outlets'
import { Query } from './Query'
import { Entity, Schema } from './Schema'
import { SchemaData } from './redux/SchemaData'
import { SchemaPredictions } from './redux/SchemaPredictions'
import { State, Action, createReducer, createEmptyState } from './redux'
import { StoreStateWrapper } from './StoreStateWrapper'


export class Store<S extends Schema=any> {
    private schema: S
    private reduxStore: any
    private selector: (storeState: any) => State<S>
    private subjects = new Map<Query, OutletSubject<Query.Result<Query>>>()

    private latestWrapper: StoreStateWrapper<S>

    private nextPredictionId = 1

    private batchLevel = 0
    private batchQueries = new Set<Query>()

    constructor(schema: S, reduxStore?: any, selector?: (storeState: any) => State<S>) {
        this.schema = schema

        this.reduxStore = reduxStore
        if (!reduxStore) {
            let reducer = createReducer(schema)
            let emptyState = createEmptyState(schema)
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

    reset() {
        this.startBatch()
        this.reduxStore.dispatch({
            type: 'SchemaPredictions.Reset',
        })
        this.update(a => {
            Object.keys(this.schema).forEach(entityName => a.reset(entityName))
        })
        this.flushBatch()
    }

    subscribe<Q extends Query<any, {}, any>>(query: Q): Outlet<Query.Result<Q>> {
        let subject = this.subjects.get(query) as OutletSubject<Query.Result<Q>>
        if (!subject) {
            subject = new OutletSubject(this.execute(query))
            this.subjects.set(query, subject)
        }
        return new Outlet(subject)
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

    getDataState(): State<S>["data"] {
        return this.latestWrapper.getPredictedDataState()
    }

    getKnownDataState(): State<S>["data"] {
        return this.selector(this.reduxStore.getState()).data
    }

    startBatch(): void {
        this.batchLevel++
    }

    flushBatch(): void {
        // NOTE: Could implement this as a BatchedOutletSubject instead...
        //       But that doesn't exist yet.
        if (this.batchLevel === 0) {
            return
        }
        if (--this.batchLevel === 0) {
            let queries = Array.from(this.batchQueries.values())
            for (let i = 0; i < queries.length; i++) {
                let query = queries[i]
                let subject = this.subjects.get(query)
                if (subject) {
                    subject.next(query.select(this.latestWrapper, {}))
                }
            }
            this.batchQueries.clear()
        }
    }

    private handleStateChange = () => {
        this.setLatestWrapper()
        let subjects = Array.from(this.subjects.entries())
        for (let i = 0; i < subjects.length; i++) {
            let [query, subject] = subjects[i]
            if (query.canChangeAffectResult(this.latestWrapper)) {
                if (this.batchLevel === 0) {
                    subject.next(query.select(this.latestWrapper, {}))
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