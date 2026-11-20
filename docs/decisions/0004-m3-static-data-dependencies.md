# ADR-0004：M3 静态数据依赖与端口追踪

- 状态：接受，画布人工验收待确认。
- 日期：2026-11-19
- 阶段依据：用户确认 M2 包含关系正常、拖动抖动修复。M3 只读静态依赖，不做 M4 自动刷新或运行时分析。
- 结构：新增独立 DataFlow 模块，在每个组件使用位置建立独立符号环境。相同定义的不同使用共享 Definition，但状态/局部值使用不同 IR ID。未修改 schemaVersion 1 或增加 IR 字段。
- State：只支持 const 二元简单解构，并同时验证调用引用来自 React 导入、符号解析到 React 声明文件。支持具名别名与 namespace/default 的常见写法。未解析 import、自定义同名 useState、复杂解构不生成 state-write。
- 来源与派生：直接 const 和简单 Props 解构生成 value；表达式读取的标识符用 TypeChecker 符号关联，不按名字关联。属性名、对象键、回调形参不与同名外层值混淆。模块常量限工作区内简单 literal/array/object；不跨函数做闭包和通用别名追踪。
- Transform：局部 const 派生表达式生成 data-read → Transform → derive 链。filter/map 回调仅识别静态自由变量引用，不解释业务效果和实际执行。动态 element access、赋值/更新、副作用语法、JSX 产物、未支持 Hook/函数值降级；有 partial 来源时不拼接确定的上下游关系。
- Props：仅简单标识符绑定；来源和组件均需可确认。未知组件、spread 覆盖、重复属性、复杂属性表达式报告诊断。map item 到 Card 的别名尚未追踪，不从 products 的包含关系补造 product 路径。
- 回调：函数声明/直接函数值和已知 setter 可形成 callback-bind，方向为组件回调端口 → handler。只有 React setter 本身形成 state-write → state；普通 handler 内即使出现 setter 调用也不生成调用链。普通 handler 的端口不标 state-setter。setter 别名与间接回调降级。
- 追踪：traceData 在组件边界按端口继续，不能因为一个组件的 a 依赖 keyword，就高亮其 b 下游。回调边使用单独的 traceCallback，不进入普通数据路径。容器描边只是对已追踪子元素的视觉汇总。
- 渲染：沿用单画布、既有拖动状态修复和只读连线。容器内为数据元素安排横向行，结构子容器在其下方。输入端口提供同位置的不可交互 source handle，以显示解构 Props 向内部变量的依赖；这只是渲染适配，不新增 IR 端口或允许用户连线。
- 证据：每条生成的 confirmed 边都有真实 SourceRef；组件/变量/边通过既有宿主注册表定位，版本与依赖快照校验不变。state-write 和 callback-bind 的 notes 明确只说明潜在更新与绑定，不说明事件或 rerender。
- 测试：静态正反例、端口隔离、数据/回调隔离、原拖动回归；真实 Extension Host 检查变量和全部 confirmed 边的源码选区与文件不变性。UI 的实际交叉、遮挡和交互仍需人工复核。
