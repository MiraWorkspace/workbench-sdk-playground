export default [
  {
    id: 'appearance.get', group: '主题', title: '读取当前主题', permissions: ['appearance:read'],
    description: '读取宿主的 light/dark 主题。执行后演示台使用该返回值切换主题。',
    check: '在 Mira 切换主题后重新读取，返回值和演示台颜色应一致。',
    params: {}, run: async (sdk) => sdk.appearance.get(),
  },
  {
    id: 'appearance.subscribe', group: '主题', title: '订阅与取消订阅', permissions: ['appearance:read'],
    description: 'subscribe 在客户端注册回调，并返回取消函数，不会读取初始主题。事件值写入下方事件记录；取消后不再收到事件。',
    check: '先读取主题，再订阅，然后在 Mira 中切换主题。点击“取消主题订阅”，再次切换，不应新增事件。',
    params: {},
    run: async (sdk, params, emit) => sdk.appearance.subscribe(theme => emit({ event: 'appearance.changed', value: theme })),
  },
]
