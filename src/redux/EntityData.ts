import { Index, Record } from '../DataTypes'
import { Entity } from '../Schema'


export namespace EntityData {
    export interface State<E extends Entity=any> {
        records: { [id: string]: Record<E> };
        indexes: { [key: string]: Index<E> };

        changes: null | {
            recordIds: string[],
            indexKeys: string[],
        }
    }


    export type Action<E extends Entity=any> = {
        type: 'EntityData.Update',
        payload: Update<E>[]
    }

    export type Update<E extends Entity=any> =
        {
            type: 'replaceRecords',
            records: { [id: string]: Record<E> },
        } |
        {
            type: 'replaceIndexes',
            indexes: { [key: string]: Index<E> },
        } |
        {
            type: 'addRecordIdToIndexes',
            id: string,
            keyPattern: string | RegExp,
        } |
        {
            type: 'removeRecordIdFromIndexes',
            id: string,
            keyPattern: string | RegExp,
        } |
        {
            type: 'removeRecords',
            ids: string[],
        } |
        {
            type: 'removeIndexes',
            keys: string[],
        } |
        {
            type: 'reset'
        }
    

    export function reducer<E extends Entity>(state: State<E>, action: Action<E>): State<E> {
        if (action.type !== 'EntityData.Update' || action.payload.length === 0) {
            return state
        }

        let changedIds = new Set<string>()
        let changedKeys = new Set<string>()

        let records = { ...state.records }
        let indexes = { ...state.indexes }

        for (let i = 0; i < action.payload.length; i++) {
            let subaction = action.payload[i]
            let indexKeys

            switch (subaction.type) {
                case 'replaceRecords':
                    Object.keys(subaction.records).forEach(id => changedIds.add(id))
                    Object.assign(records, subaction.records)
                    break
                
                case 'replaceIndexes':
                    Object.keys(subaction.indexes).forEach(key => changedKeys.add(key))
                    Object.assign(indexes, subaction.indexes)
                    break

                case 'addRecordIdToIndexes':
                case 'removeRecordIdFromIndexes':
                    indexKeys = Object.keys(indexes)
                    for (let j = 0; j < indexKeys.length; j++) {
                        let key = indexKeys[i]
                        if (typeof subaction.keyPattern === 'string' ? key === subaction.keyPattern : subaction.keyPattern.test(key)) {
                            let index = indexes[indexKeys[j]]
                            let idIndex = index.ids.indexOf(subaction.id)
                            if (subaction.type === 'addRecordIdToIndexes' && idIndex === -1) {
                                index.ids.push(subaction.id)
                                changedKeys.add(key)
                            }
                            else if (subaction.type === 'removeRecordIdFromIndexes' && idIndex !== -1) {
                                index.ids = index.ids.slice(0)
                                index.ids.splice(idIndex, 1)
                                changedKeys.add(key)
                            }
                        }
                    }
                    break

                case 'removeRecords':
                    for (let j = 0; j < subaction.ids.length; j++) {
                        let id = subaction.ids[j]
                        delete records[id]
                        changedIds.add(id)
                    }
                    break

                case 'removeIndexes':
                    for (let j = 0; j < subaction.keys.length; j++) {
                        let key = subaction.keys[j]
                        delete indexes[key]
                        changedKeys.add(key)
                    }
                    break
                
                case 'reset':
                    changedIds = new Set(Object.keys(state.records))
                    changedKeys = new Set(Object.keys(state.indexes))
                    records = {}
                    indexes = {}
                    break
            }
        }

        if (changedIds.size === 0 && changedKeys.size === 0) {
            return state
        }

        return {
            records,
            indexes,
            changes: {
                recordIds: [...changedIds],
                indexKeys: [...changedKeys],
            },
        }
    }
}
