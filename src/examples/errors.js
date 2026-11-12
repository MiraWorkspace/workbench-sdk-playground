export default [
  {
    id: 'errors.unsupported', group: '权限与错误', title: '未开放的 SDK 方法', permissions: [],
    description: 'SDK 的接口集合大于小程序的可用能力。files.selectDirectory 没有在 Workbench 小程序通道开放，预期被拒绝；不会弹目录选择器。',
    check: '执行应看到 APPLICATION_DENIED 和 Workbench 不支持方法的提示。到 Workbench 权限页授权目录才是正确路径。',
    params: { access: 'read' }, run: async (sdk, params) => sdk.files.selectDirectory(params.access),
  },
  {
    id: 'errors.invalidParams', group: '权限与错误', title: '宿主参数校验', permissions: ['web:search'], minor: 2,
    description: '故意发送空搜索词和不合法条数。客户端不替宿主填补参数；宿主应拒绝此请求。Workbench 会把拒绝转为 APPLICATION_DENIED，message 包含原因。',
    check: '先开启联网权限再执行，应得到参数错误；未授权时会先得到权限拒绝。',
    params: { query: '', limit: 0 }, run: async (sdk, params) => sdk.web.search(params),
  },
  {
    id: 'errors.permission', group: '权限与错误', title: '验证未授权请求', permissions: ['models:generate'], minor: 1,
    description: '先回到 Workbench 关闭此小程序的模型权限，再重新打开演示台。这里仍允许点击执行，用真实请求验证 Workbench 拒绝授权外能力。',
    check: 'context.get 中应不含 models:generate。执行应报错；恢复权限后重新打开，同一调用应能返回列表。撤权会关闭运行中的页面。',
    params: {}, run: async (sdk) => sdk.models.listProviders(),
  },
]
