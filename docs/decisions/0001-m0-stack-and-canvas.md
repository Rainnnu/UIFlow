# ADR-0001：M0 工程、演示证据与嵌套画布

- 状态：接受（画布交互仍须完成实机验收）
- 日期：2026-11-19
- 背景：仓库只有规范，需要先验证同画布嵌套和跨层箭头。
- 方案：pnpm workspace、TypeScript strict；Extension Host 使用 esbuild；React Webview 使用 Vite、@xyflow/react；Vitest 验证领域语义与折叠投影。
- 版本：使用已安装且经本工程类型检查、构建验证的固定版本，详见 package.json 和 pnpm-lock.yaml；未声称这些版本为最新版。React Flow 12.8.1 的 peerDependencies 允许 React >=17，本工程使用 React 19.1.0。当前 TypeScript 5.8.3 只用于工程编译，M2 分析器路线仍需单独验证。
- IR：原样保留规范 schemaVersion 1，领域包不依赖 React Flow；布局和折叠状态只存在于画布层。定义与使用继续分离；M0 没有真实来源，因此 definitions 和 sourceRefs 为空，不生成虚构定义。
- 证据：硬编码关系一律 partial，界面显式标记“演示数据”；核心追踪默认只接受 confirmed，M0 页面显式开启演示遍历。unresolved 不进入演示追踪。不提供源码定位按钮。
- 包含与边：parentId 表示包含；蓝色实线表示数据读取、派生和 Props；橙色虚线表示回调绑定与潜在状态更新，不能解释为实际调用或 rerender。
- 布局：固定坐标先验证路由，不引入自动布局引擎；父节点先于子节点提供给 React Flow。跨层边提高 zIndex，保持端口与箭头可见。
- 折叠：隐藏后代；跨界边映射到最外层已折叠祖先的临时汇总端口，隐藏容器内部边。每个汇总端口当前代表一条边；展开恢复原始端点，IR 不变。不实现多边合并，避免混淆不同语义。
- 安全：仅加载插件目录内构建资源；CSP nonce；宿主只接收有限的 requestGraph 消息，不提供任意 URI 打开或源码写入入口。
- 风险：固定布局只适用于当前演示规模；自由拖动可能造成新的视觉交叉。自动布局、大图和导航分别留待后续阶段。
