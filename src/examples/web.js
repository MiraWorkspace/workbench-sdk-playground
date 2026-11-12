export default [
  {
    id: 'web.search', group: '联网', title: '独立网页搜索', permissions: ['web:search'], minor: 2,
    description: '不调用模型，宿主自动选择搜索源，返回结构化搜索结果与尝试记录。搜索摘要不等于已经读取网页正文。',
    check: '修改 query 或 limit，核对 query、engine、results 和 attempts。正常使用不需要选择搜索引擎。',
    params: { query: 'TypeScript 官方文档', limit: 3 },
    run: async (sdk, params) => sdk.web.search(params),
  },
  {
    id: 'models.webChat', group: '联网', title: 'AI 自主联网对话', permissions: ['models:generate', 'web:search'], minor: 2,
    description: 'webSearch: true 允许 AI 自主搜索、读取网页并回答。模型需支持工具调用；一次请求可能多次调用模型并产生费用。不会强制每个问题都联网。',
    check: '选择模型，执行后核对 text 和 sources。来源 index 对应文本中的 [[source:N]]，来源记录绑定在本次结果中。',
    chat: true,
    params: { providerId: '', modelId: '', webSearch: true, messages: [{ role: 'user', content: '搜索并读取 TypeScript 官方文档，说明 TypeScript 是什么，并给出来源。' }] },
    run: async (sdk, params) => sdk.models.chat(params),
  },
]
