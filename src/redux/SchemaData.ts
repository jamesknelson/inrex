import { Data } from '../Data'
import { EntityData } from './EntityData'
import { Schema } from '../Schema'


export namespace SchemaData {
    export type State<S extends Schema=any> = {
        [EntityName in keyof S]: EntityData.State<S[EntityName]>;
    }

    export type Action<S extends Schema=any> = {
        type: 'SchemaData.Update',
        payload: {
            [EntityName in keyof S]?: EntityData.Action<S[EntityName]>["payload"]
        }
    }

    export type Reducer<S extends Schema=any> = (state: State<S>, action: Action<S>) => State<S>;

    export function createEmptyState<S extends Schema>(schema: S): State<S> {
        let emptyState = {} as State<S>
        for (let entityName of Object.keys(schema)) {
            emptyState[entityName] = {
                records: {},
                indexes: {},
                changes: null,
            }
        }
        return emptyState
    }

    export function createReducer<S extends Schema>(schema: S): Reducer<S> {
        return function schemaDataReducer(state, action: Action<S>) {
            if (action.type !== 'SchemaData.Update') {
                return state
            }

            let nextState = Object.assign({}, state)
            for (let entityName of Object.keys(action.payload)) {
                if (entityName in schema) {
                    let actions = action.payload[entityName] || []
                    if (actions.length > 0) {
                        let entityAction = {
                            type: 'EntityData.Update' as 'EntityData.Update',
                            payload: actions,
                        }
                        nextState[entityName] = EntityData.reducer(state[entityName], entityAction)
                    }
                }
                else {
                    console.warn(`You tried to update an entity named "${entityName}", but it is not in your schema.`)
                }
            }
            return nextState
        }
    }

    export class ActionBuilder<S extends Schema=any> {
        action: Action<Schema> = {
            type: 'SchemaData.Update',
            payload: {},
        }

        replaceRecords<EntityName extends keyof S>(
            entityName: EntityName,
            records: { [id: string]: Data.Record<S[EntityName]> }
        ) {
            this.addAction(entityName, {
                type: 'replaceRecords',
                records,
            })
        }

        replaceIndexes<EntityName extends keyof S>(
            entityName: EntityName,
            indexes: { [key: string]: Data.Index<S[EntityName]> }
        ) {
            this.addAction(entityName, {
                type: 'replaceIndexes',
                indexes,
            })
        }

        addRecordIdToIndexes(entityName: keyof S, id: string, keyPattern: string | RegExp) {
            this.addAction(entityName, {
                type: 'addRecordIdToIndexes',
                id,
                keyPattern,
            })
        }

        removeRecordIdFromIndexes(entityName: keyof S, id: string, keyPattern: string | RegExp) {
            this.addAction(entityName, {
                type: 'removeRecordIdFromIndexes',
                id,
                keyPattern,
            })
        }

        removeRecords(entityName: keyof S, ids: string[]) {
            this.addAction(entityName, {
                type: 'removeRecords',
                ids,
            })
        }

        removeIndexes(entityName: keyof S, keys: string[]) {
            this.addAction(entityName, {
                type: 'removeIndexes',
                keys,
            })
        }

        reset(entityName: keyof S) {
            this.addAction(entityName, {
                type: 'reset',
            })
        }

        private addAction<EntityName extends keyof S>(entityName: EntityName, action: EntityData.Update<S[EntityName]>) {
            let actions = this.action.payload[entityName]
            if (!actions) {
                actions = []
                this.action.payload[entityName] = actions
            }
            actions.push(action)
        }
    }
}