import { createEntity, Attributes, Store, Data } from '../src/index'

//---
//EXAMPLE

export const Account = createEntity('Account', {
    attributes: {
        name: Attributes.string(),
        createdAt: Attributes.utcDate(),
    }
})

export const User = createEntity('User', {
    attributes: {
        accountId: Attributes.string(),
        name: Attributes.string(),
        email: Attributes.string(),
        createdAt: Attributes.utcDate(),
        permissions: Attributes.arrayOf(Attributes.string())
    },
})

export const Schema = {
    Account,
    User,
}

const manager = new Store(Schema)

let result = manager.execute(User.id('currentUserId', {
    account: Account.id(user => user.accountId)
}))

let record: Data.Record<typeof User> = {
    id: 'test',
}