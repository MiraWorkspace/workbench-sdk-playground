export default [
  {
    id: 'models.listProviders', group: '模型', title: '1. 获取供应商', permissions: ['models:generate'], minor: 1,
    description: '返回 Mira 已配置、可用且启用的聊天供应商，只含 id 和 name，不暴露密钥或接口地址。',
    check: '先在 Mira 配置供应商。执行后在上方选择供应商，继续“2. 获取模型”。空数组代表没有可用供应商。',
    params: {}, run: async (sdk) => sdk.models.listProviders(),
  },
  {
    id: 'models.listModels', group: '模型', title: '2. 获取模型', permissions: ['models:generate'], minor: 1,
    description: '根据供应商 ID 获取可用的聊天模型。上方的选择框会填入真实返回的列表。',
    check: '选择供应商后执行，再选择模型。也可以编辑 providerId，观察无效 ID 的实际错误。',
    params: { providerId: '' }, run: async (sdk, params) => sdk.models.listModels(params.providerId),
  },
  {
    id: 'models.generate', group: '模型', title: '3. 单次生成', permissions: ['models:generate'],
    description: '发送一次文本生成。指定模型时同时传 providerId 和 modelId；省略两者才使用 Mira 的默认模型。点击执行会调用真实模型，可能产生费用。',
    check: '先选择供应商和模型，执行并查看 text；删除两个 ID 可以验证默认模型配置。',
    params: { prompt: '用一句话解释 SDK 的作用。' },
    run: async (sdk, params) => sdk.models.generate(params),
  },
  {
    id: 'models.chat', group: '模型', title: '4. 多轮文本对话', permissions: ['models:generate'], minor: 1,
    description: '显式选择模型，每次提交完整 user/assistant 历史。回答成功后可填入追问，生成下一轮参数，再点击执行。失败不会修改历史。',
    check: '发送“我叫小明”，再追问“我叫什么？”。检查参数中包含上一轮 user 和 assistant，返回值为完整 text。',
    chat: true, params: { providerId: '', modelId: '', messages: [{ role: 'user', content: '我叫小明，请记住我的名字。' }] },
    run: async (sdk, params) => sdk.models.chat(params),
  },
]
