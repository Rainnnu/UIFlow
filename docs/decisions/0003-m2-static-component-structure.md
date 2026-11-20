# ADR-0003：M2 静态组件结构与来源快照

- 状态：接受；VS Code 更新后实机集成测试已通过，画布人工复核待确认。
- 日期：2026-11-19
- 阶段依据：用户确认 M1 注释代码前的正常定位流程已成功体验；进入 M2，不实现 M3 数据分析。
- 分析器：独立 packages/analyzer，锁定 TypeScript 5.8.3 Compiler API。通过 createProgram/getTypeChecker/getSymbolAtLocation/getAliasedSymbol 解析直接跨文件引用，禁止依靠同名字符串关联定义。TypeScript 作为插件运行依赖外置，保留标准库查找位置；不加载用户项目的 TypeScript 插件，不执行脚本，不 emit。
- 项目入口：当前工作区 TSX 与光标位置；读取工作区内最近的 tsconfig 编译选项，只以入口文件创建 Program 并跟随模块依赖。优先选择光标所在组件；无匹配时仅在唯一导出组件或唯一候选时自动选择，否则报告歧义。
- 支持：function 声明、const 箭头/函数表达式的直接 return JSX、直接具名和默认 import/export、import 别名、局部作用域符号。main/section/article 表示 jsx-region，其他原生标签不建立大容器。短 Fragment 透明处理；map 直接回调返回 JSX 标记代码模板；&& 和三元表达式标记条件分支，不推断实际可见。
- 定义与使用：Definition ID 使用源码 URI 和 AST 范围；Use ID 同时带父使用路径与当前 JSX 范围，因此展开同一定义的多个使用位置也不会混淆内部节点。该 ID 仅在当前快照内有效。
- 证据：合法 AST 与符号明确关联的组件结构可 confirmed；递归、语法错误文件内部、深度/数量限制使用 partial 或诊断；未知、外部包、HOC、可重新赋值组件变量、type-only 引用等不伪装成已解析。仅对简单函数组件做语法结构展开，不进行一般控制流推断。
- IR：schemaVersion 1 不变；map/条件使用现有 label/notes 字段。真实结构不合并硬编码数据边，edges 为空；M1 固定演示仍为单独入口，使用同一画布实现，不是结构与数据分成两个画布。
- 视图：增加最小确定性嵌套纵向布局，以子容器尺寸反推父容器尺寸；不推断 CSS。证据状态、notes、诊断和定位按钮来自实际结果。布局状态继续与 IR 分离。
- 导航：复用随机 ID 注册表，新增工作区图注册。记录分析读取到的工作区源码/config/package 文本；注册时比对内存快照，导航前后校验相关文件、文档版本、磁盘摘要与 realpath 边界。依赖变动后不能按旧图跳转。
- 回归样例：M1 测试不再依赖用户可编辑 demo，使用 tests/fixtures/m1 固定样例；保留用户对 apps/demo-react 的全部修改。
- 限制：不是通用 JSX 解释器；语句级分支返回、通过变量间接返回 JSX、HOC、动态组件、render prop、复杂闭包和调用、React.Fragment 命名容器、运行时状态不保证。递归限制 16 层、300 节点。没有保存自动刷新、持久布局或通用自动排版。

- 验证补充（2026-11-19）：VS Code 1.147.0 真实宿主集成退出码 0；7 个结构节点、4 个定义；组件定义/使用与 Props 端口选区通过；源码字节未变。该测试不替代完整画布点击与视觉验收。
