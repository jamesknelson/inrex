import { Entity } from './Schema'

export type Record<E extends Entity=any> = {
    id: string,

    meta?: any,

    // On two records with the same id, the record with the higher serial
    // number is considered more current.
    //
    // Ideally, you'd manage this on the server side. But you can get by with
    // using a data-received timestamp too.
    serialNumber?: number,
} & {
    [K in keyof E["attributes"]]: E["attributes"][K]["primitive"];
}

export interface Index<E extends Entity=any> {
    key: string,
    ids: string[],
    meta?: any;
    serialNumber?: any;
}
