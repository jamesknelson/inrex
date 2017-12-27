import { Entity, Schema } from './Schema'
import { EntityData } from './redux/EntityData'
import { State } from './redux'


export class StoreStateWrapper<S extends Schema=any> {
    private currentStoreState: State<S>

    private predictedDataState: State<S>["data"]

    private specialRecordStatuses: {
        [EntityName in keyof S]: {
            [id: string]: {
                status: StoreStateWrapper.RecordStatus,
                error?: any,
            }
        }
    }
    private specialIndexStatuses: {
        [EntityName in keyof S]: {
            [key: string]: {
                status: StoreStateWrapper.IndexStatus,
                error?: any,
            }
        }
    }

    constructor(currentStoreState: State<S>) {
        this.currentStoreState = currentStoreState


        this.specialRecordStatuses = {} as any
        this.specialIndexStatuses = {} as any

        if (currentStoreState.predictions.length === 0) {
            this.predictedDataState = this.currentStoreState.data
        }
        else {
            this.predictedDataState = Object.assign({}, currentStoreState.data)

            let changedIds = {} as { [schemaName: string]: Set<string> }
            let changedKeys = {} as { [schemaName: string]: Set<string> }

            let entityNames = Object.keys(currentStoreState.data)
            for (let i = 0; i < entityNames.length; i++) {
                let entityName = entityNames[i]
                this.specialRecordStatuses[entityName] = {} 
                this.specialIndexStatuses[entityName] = {}
                changedIds[entityName] = new Set()
                changedKeys[entityName] = new Set()
            }

            for (let i = 0; i < currentStoreState.predictions.length; i++) {
                let prediction = currentStoreState.predictions[i]
                let predictionEntityNames = Object.keys(prediction.entityPredictions)

                let errorStatus = { status: 'error' as 'error', error: prediction.error }

                for (let j = 0; j < predictionEntityNames.length; j++) {
                    let entityName = predictionEntityNames[j]
                    let entityPredictions = prediction.entityPredictions[entityName] || []

                    for (let k = 0; k < entityPredictions.length; k++) {
                        let entityPrediction = entityPredictions[k]

                        if (prediction.error) {
                            switch (entityPrediction.type) {
                                case 'recordWillBeReplaced':
                                case 'recordWillBeReplacedWith':
                                case 'recordWillBeRemoved':
                                    let id = entityPrediction.id
                                    this.specialRecordStatuses[entityName][id] = errorStatus
                                    changedIds[entityName].add(id)
                                    break
                                case 'indexWillBeReplaced':
                                    let key = entityPrediction.key
                                    this.specialIndexStatuses[entityName][key] = errorStatus
                                    changedKeys[entityName].add(key)
                                    break
                            }
                        }
                        else {
                            switch (entityPrediction.type) {
                                case 'recordWillBeReplaced':
                                    this.specialRecordStatuses[entityName][entityPrediction.id] = {
                                        status: this.currentStoreState.data[entityName].records[entityPrediction.id]
                                            ? 'refreshing'
                                            : 'retrieving'
                                    }
                                    changedIds[entityName].add(entityPrediction.id)
                                    break
        
                                case 'recordWillBeReplacedWith':
                                    this.specialRecordStatuses[entityName][entityPrediction.id] = {
                                        status: 'updating'
                                    }
                                    this.predictedDataState[entityName] = EntityData.reducer(this.predictedDataState[entityName], {
                                        type: 'EntityData.Update',
                                        payload: [{
                                            type: 'replaceRecords',
                                            records: {
                                                [entityPrediction.id]: entityPrediction.record,
                                            }
                                        }]
                                    })
                                    changedIds[entityName].add(entityPrediction.id)
                                    break
                                
                                case 'recordWillBeRemoved':
                                    this.specialRecordStatuses[entityName][entityPrediction.id] = {
                                        status: 'deleting'
                                    }
                                    this.predictedDataState[entityName] = EntityData.reducer(this.predictedDataState[entityName], {
                                        type: 'EntityData.Update',
                                        payload: [{
                                            type: 'removeRecords',
                                            ids: [entityPrediction.id],
                                        }]
                                    })
                                    changedIds[entityName].add(entityPrediction.id)
                                    break

                                case 'indexWillBeReplaced':
                                    this.specialIndexStatuses[entityName][entityPrediction.key] = {
                                        status: this.currentStoreState.data[entityName].indexes[entityPrediction.key]
                                            ? 'refreshing'
                                            : 'retrieving'
                                    }
                                    changedKeys[entityName].add(entityPrediction.key)
                                    break

                                case 'recordIdWillBeAddedToIndexes':
                                    this.predictedDataState[entityName] = EntityData.reducer(this.predictedDataState[entityName], {
                                        type: 'EntityData.Update',
                                        payload: [{
                                            type: 'addRecordIdToIndexes',
                                            id: entityPrediction.id,
                                            keyPattern: entityPrediction.keyPattern,
                                        }]
                                    })
                                    // TODO: specify changed keys
                                    break

                                case 'recordIdWillBeRemovedFromIndexes':
                                    this.predictedDataState[entityName] = EntityData.reducer(this.predictedDataState[entityName], {
                                        type: 'EntityData.Update',
                                        payload: [{
                                            type: 'removeRecordIdFromIndexes',
                                            id: entityPrediction.id,
                                            keyPattern: entityPrediction.keyPattern,
                                        }]
                                    })
                                    // TODO: specify changed keys

                            }
                        }
                    }
                }
            }

            for (let i = 0; i < entityNames.length; i++) {
                let entityName = entityNames[i]
                let existingChanges = this.predictedDataState[entityName].changes || { recordIds: [], indexKeys: [] }
                existingChanges.recordIds.forEach(id => changedIds[entityName].add(id))
                existingChanges.indexKeys.forEach(key => changedKeys[entityName].add(key))
                if (changedIds[entityName].size || changedKeys[entityName].size) {
                    this.predictedDataState[entityName].changes = {
                        recordIds: [...changedIds[entityName]],
                        indexKeys: [...changedKeys[entityName]],
                    }
                }
            }
        }
    }

    getRecordStatus(entityName: keyof S, id: string): { status: StoreStateWrapper.RecordStatus, error?: any } {
        let specialStatus = this.specialRecordStatuses[entityName][id]
        if (specialStatus) {
            return specialStatus
        }
        else if (this.currentStoreState.data[entityName].records[id]) {
            return { status: 'fresh' }
        }
        else {
            return { status: 'unknown' }
        }
    }

    getIndexStatus(entityName: keyof S, key: string): { status: StoreStateWrapper.IndexStatus, error?: any } {
        let specialStatus = this.specialIndexStatuses[entityName][key]
        if (specialStatus) {
            return specialStatus
        }
        else if (this.currentStoreState.data[entityName].records[key]) {
            return { status: 'fresh' }
        }
        else {
            return { status: 'unknown' }
        }
    }

    // Adds record projections
    getPredictedDataState(): State<S>["data"] {
        return this.predictedDataState
    }
}


export namespace StoreStateWrapper {
    export type RecordStatus =
        'unknown' |
        'fresh' |
        'retrieving' |
        'refreshing' |
        'deleting' |
        'updating' |
        'error'

    export type IndexStatus =
        'unknown' |
        'fresh' |
        'refreshing' |
        'retrieving' |
        'error'
}