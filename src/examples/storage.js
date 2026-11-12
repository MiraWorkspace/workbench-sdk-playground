export default [
  {
    id: 'storage.migrate', group: '存储', title: '1. 建表迁移', permissions: ['storage:app'],
    description: '在此小程序独立 namespace 中创建 sdk_examples 表，返回当前迁移版本。可重复执行；不是任意 SQL 接口。',
    check: '先执行本项，再进行增删改查。关闭重开后再次执行，迁移版本仍为 1。namespace 由 Workbench 固定，无需小程序传入。',
    params: { migrations: [{ version: 1, tables: [{ name: 'sdk_examples', columns: [
      { name: 'id', type: 'TEXT', primaryKey: true }, { name: 'title', type: 'TEXT', notNull: true },
    ] }] }] },
    run: async (sdk, params) => sdk.storage.migrate(params.migrations),
  },
  {
    id: 'storage.insert', group: '存储', title: '2. 新增记录', permissions: ['storage:app'],
    description: '使用声明式 transaction 插入记录。重复 id 会返回唯一约束错误，方便观察真实错误。',
    check: '先建表。插入 demo-1 后去查询；再次插入相同 ID 应失败，可修改 id 或先删除该记录。',
    params: { operations: [{ type: 'insert', table: 'sdk_examples', values: { id: 'demo-1', title: '来自 SDK 的第一条记录' } }] },
    run: async (sdk, params) => sdk.storage.transaction(params.operations),
  },
  {
    id: 'storage.select', group: '存储', title: '3. 查询与持久化', permissions: ['storage:app'],
    description: '查询演示表。返回数组中的每一项对应一个 operation 的结果；select 的结果是行数组。',
    check: '插入后查询，再关闭并重新打开小程序查询，记录应仍存在。空数组不代表调用失败。',
    params: { operations: [{ type: 'select', table: 'sdk_examples', orderBy: [{ column: 'id', direction: 'asc' }], limit: 50 }] },
    run: async (sdk, params) => sdk.storage.transaction(params.operations),
  },
  {
    id: 'storage.update', group: '存储', title: '4. 修改记录', permissions: ['storage:app'],
    description: '通过 where 修改指定记录。不会自动插入不存在的记录。',
    check: '先插入 demo-1，执行更新后重新查询，title 应改变。没有匹配行时核对受影响行数。',
    params: { operations: [{ type: 'update', table: 'sdk_examples', where: { id: 'demo-1' }, values: { title: '已通过 SDK 修改' } }] },
    run: async (sdk, params) => sdk.storage.transaction(params.operations),
  },
  {
    id: 'storage.delete', group: '存储', title: '5. 删除记录', permissions: ['storage:app'],
    description: '只删除 where 匹配的演示记录。可以修改 id 来清理本演示台自己创建的记录。',
    check: '删除后查询确认该 ID 不存在；再执行新增示例可重建。',
    params: { operations: [{ type: 'delete', table: 'sdk_examples', where: { id: 'demo-1' } }] },
    run: async (sdk, params) => sdk.storage.transaction(params.operations),
  },
  {
    id: 'storage.rollback', group: '存储', title: '6. 事务失败与回滚', permissions: ['storage:app'],
    description: '先插入一行，再故意插入相同主键。第二步应失败，整个批次回滚，第一行也不应保留。',
    check: '先建表，确认 rollback-probe 不存在，执行应报错；随后查询，rollback-probe 仍不应存在。',
    params: { operations: [
      { type: 'insert', table: 'sdk_examples', values: { id: 'rollback-probe', title: '这一行应回滚' } },
      { type: 'insert', table: 'sdk_examples', values: { id: 'rollback-probe', title: '故意触发主键冲突' } },
    ] },
    run: async (sdk, params) => sdk.storage.transaction(params.operations),
  },
]
