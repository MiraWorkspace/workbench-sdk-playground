import { MiraAppSdk } from '../vendor/mira-app-sdk.js'

export default [
  {
    id: 'context.get', group: '连接', title: '读取身份与权限', permissions: [],
    description: '建立连接后读取真实上下文。小程序对端应是 Workbench，capabilities 是本次实际授权的能力。',
    check: '核对 host、appId、apiVersion 和 capabilities。撤销权限后重新打开此小程序，再次执行对比。',
    params: {},
    run: async (sdk) => sdk.context.get(),
  },
  {
    id: 'connection.disconnected', group: '连接', title: '客户端断连错误', permissions: [],
    description: '使用单独的 MessageChannel 创建客户端，立即释放后请求上下文，验证 SDK 本身的 DISCONNECTED 检查。此例不连接宿主，不伪造宿主响应，也不影响演示台的真实连接。',
    check: '执行应得到 DISCONNECTED；随后真实 context.get 仍应成功。真实连接的释放行为见下一示例。',
    params: {},
    run: async () => {
      const channel = new MessageChannel()
      const client = new MiraAppSdk(channel.port1)
      client.dispose()
      channel.port2.close()
      return client.context.get()
    },
  },
  {
    id: 'connection.dispose', group: '连接', title: '释放真实连接（关闭视图）', permissions: [],
    description: '调用当前真实 SDK 的 dispose()。Workbench 收到断连后会关闭此小程序视图，本页无法继续显示返回值；再次使用请从 Workbench 重新打开。',
    check: '最后执行。视图应关闭，重新打开后存储与文件仍保留。正常页面卸载也会释放连接，见 src/app.js 的 pagehide 清理。',
    confirm: '我知道此操作会关闭当前小程序视图', params: {},
    run: async (sdk) => sdk.dispose(),
  },
]
