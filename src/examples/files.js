export default [
  {
    id: 'files.write', group: '文件', title: '写入私有文件', permissions: ['files:write'],
    description: '把文本编码为 Uint8Array 写入小程序自己的文件区，不需要外部目录授权。相同路径会覆盖，请只操作演示文件。',
    check: '执行后进入“读取私有文件”对照文本，再关闭重开验证文件保留。',
    params: { path: 'sdk-playground/hello.txt', text: '你好，Workbench SDK！' },
    run: async (sdk, params) => sdk.files.write({ path: params.path, data: new TextEncoder().encode(params.text) }),
  },
  {
    id: 'files.read', group: '文件', title: '读取私有文件', permissions: ['files:read'],
    description: 'SDK 返回 Uint8Array；示例同时展示原始字节和 TextDecoder 解码后的文本。',
    check: '先执行写入再读取。未写入的路径应返回文件不存在错误，不填充假数据。',
    params: { path: 'sdk-playground/hello.txt' },
    run: async (sdk, params) => {
      const bytes = await sdk.files.read({ path: params.path })
      return { bytes, text: new TextDecoder().decode(bytes) }
    },
  },
  {
    id: 'files.list', group: '文件', title: '列出私有文件', permissions: ['files:read'],
    description: '列出私有文件区的相对目录。path 为空表示此小程序私有根目录。',
    check: '写入 hello.txt 后列出 sdk-playground，结果应含文件名和 directory 标记。',
    params: { path: '' }, run: async (sdk, params) => sdk.files.list(params),
  },
  {
    id: 'files.directories', group: '文件', title: '获取已授权目录', permissions: ['files:read'],
    description: '返回 Workbench 已授予本小程序的目录句柄。目录选择和撤销由 Workbench“设置 → 小程序权限”管理，小程序不能自行授权。',
    check: '先返回 Workbench 授予一个测试目录，再重新打开本小程序执行，复制返回的 id 到下面目录读写示例的 grant。无授权时返回空数组。',
    params: {}, run: async (sdk) => sdk.files.directories(),
  },
  {
    id: 'files.directoryList', group: '文件', title: '列出授权目录文件', permissions: ['files:read'],
    description: 'grant 指定外部目录授权句柄；path 仍为该目录中的相对路径，不能传本机绝对路径。',
    check: '从“获取已授权目录”复制 id 到 grant，再执行。无效或已撤销句柄应被拒绝。',
    params: { path: '', grant: '请替换为已授权目录的 id' }, run: async (sdk, params) => sdk.files.list(params),
  },
  {
    id: 'files.directoryWrite', group: '文件', title: '写入授权目录', permissions: ['files:read', 'files:write'],
    description: '需要目录被授予读写权限，并且本小程序的文件读写能力已开启。只读目录应拒绝写入。',
    check: '使用一个空测试目录，替换 grant；会创建或覆盖 sdk-playground-demo.txt。可在系统文件管理器中核对。',
    confirm: '允许创建或覆盖测试目录中的 sdk-playground-demo.txt',
    params: { path: 'sdk-playground-demo.txt', grant: '请替换为读写目录的 id', text: '从 Workbench 小程序写入授权目录。' },
    run: async (sdk, params) => sdk.files.write({ path: params.path, grant: params.grant, data: new TextEncoder().encode(params.text) }),
  },
  {
    id: 'files.directoryRead', group: '文件', title: '读取授权目录文件', permissions: ['files:read'],
    description: '通过目录句柄读取文本。读写授权和只读授权都允许读取。',
    check: '替换 grant，读取上一步的测试文件；或将 path 改为测试目录中已有的文本文件。',
    params: { path: 'sdk-playground-demo.txt', grant: '请替换为已授权目录的 id' },
    run: async (sdk, params) => {
      const bytes = await sdk.files.read(params)
      return { bytes, text: new TextDecoder().decode(bytes) }
    },
  },
]
