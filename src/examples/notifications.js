export default [
  {
    id: 'notifications.send', group: '通知', title: '发送系统通知', permissions: ['notifications:send'],
    description: '请求宿主发送系统通知。方法无返回值；调用成功不代表系统一定显示横幅，取决于正式安装版、系统授权及专注模式。',
    check: '修改 title 和 body 后执行，在系统通知中心核对。macOS 通知请使用正式安装版验收。',
    params: { title: 'Workbench SDK 演示', body: '这条通知由小程序通过 SDK 请求宿主发送。' },
    run: async (sdk, params) => sdk.notifications.send(params),
  },
]
