# UIFlow：React 组件结构与数据流可视化 VS Code 插件

> **V1 产品与工程实施规范（供人类开发者及 AI 编码代理使用）**  
> 文档版本：1.0｜制定日期：2026-11-19｜状态：V1 基准方案  
> 项目暂定名称：**UIFlow**（工作名，尚未进行商标和同名项目核查）  
> **本文件是开发约束，不是营销文案。** 未经明确讨论，不得让 AI 将 V2/V3 功能提前混入 V1。

---

## 0. 一页结论：先做什么，不做什么

**产品定位**：一个嵌入 VS Code 的 React 代码探索插件。开发者可以从 TSX 源码打开一张**同屏融合的嵌套组件图与有向数据流图**，查看组件的包含关系、变量的来源与去向，点击图上元素跳转到具体源码。

**图形语法的核心**：

- **包含关系 = 空间嵌套**。`ProductPage` 的大框包住 `SearchInput`、`ProductList`；`ProductList` 包住 `ProductCard` 模板。
- **数据关系 = 带方向的连线**。`keyword → filtered → ProductList.products`，连线可以跨越组件边界。
- **事件/更新 = 不同样式的连线**。`SearchInput.onChange ⇢ setKeyword ⇢ keyword` 是回调绑定及潜在更新关系，不等同于普通数据值传递或已实际发生的事件。
- **源码映射 = 每一个可靠节点、端口、边都有可追踪的来源**。图不是单纯的图片，而是有代码语义的交互界面。

**V1 验收闭环**：打开 React TSX → 右键“在 UIFlow 中查看” → 出现同一画布上的嵌套图和数据箭头 → 点击组件/变量/连线显示代码依据 → 点击“定位源码”在 VS Code 打开正确位置 → 保存代码后刷新图。

**V1 不做**：自动修改源码；准确推断真实像素布局；实际 React 渲染次数/性能监控；任意 JavaScript 的完整数据流；所有框架兼容；AI 生成代码或云端分析。

---

## 1. 用户、核心问题与成功标准

### 1.1 目标用户

- 第一次接手陌生 React 代码的前端开发者；
- 正在维护复杂组件与 Props 链路的开发者；
- 想理解 React 状态和组件关系的学习者；
- 后续可能扩展到代码审查、重构前影响分析。

### 1.2 核心问题

现有编辑器以**文件和文本**为主要入口。开发者往往需要在多个文件间跳转，才能回答：

1. 页面上的这一块 UI 对应哪个组件？它被哪个组件包含？
2. `keyword` 从哪里产生，经过哪些计算，最后进入哪个 Props？
3. 我修改这个变量时，**从静态依赖来看**，哪些组件可能受影响？
4. 这些关系究竟由哪行 TSX/TS 代码建立？

### 1.3 产品成功标准（不是下载量）

用随仓库提供的演示项目，能重复完成以下任务：

- 从 `ProductPage.tsx` 打开图，在**一张画布**内同时看到父子容器及数据箭头；
- 选中 `keyword`，高亮 `keyword → filtered → ProductList.products` 的**确定静态依赖路径**；
- 点 `ProductList` 打开组件定义，点它的 `products` 端口定位 JSX Props 绑定；
- 点 `filtered → ProductList.products` 这条边，定位到 `<ProductList products={filtered} />` 中对应的绑定表达式；
- `ProductCard` 在 `products.map(...)` 下以**模板 / 重复实例（×N，N 未知）**形式出现，不伪造具体运行时实例数；
- 对暂不支持的动态写法显示“暂无法解析”，不画猜测的确定连线；
- 保存相关 TSX 文件后可以刷新图，已失效的定位不会指向错误行。

---

## 2. 范围划分：V1 / V2 / V3

| 能力 | V1：静态探索 | V2：运行时验证 | V3：图改代码 |
|---|---|---|---|
| VS Code 右键/命令打开 | **做** | 保留 | 保留 |
| 简化 UI 的组件空间嵌套 | **做（语法结构示意）** | 可结合 DOM 几何 | 支持改变结构 |
| 图中数据节点、端口和箭头 | **做（限定静态模式）** | 合并真实事件 | 可编辑连接 |
| State/Props 简单依赖追踪 | **做** | 结合实际值与更新 | 支持修改 |
| 组件/变量/连线跳转源码 | **做** | 保留 | 保留 |
| 预测**可能**影响的组件 | **做（有证据才显示）** | 与真实更新对照 | 修改前预览 |
| 实际 rerender 次数与耗时 | **不做** | **做** | 保留 |
| 拖连线、改参数并自动改 TSX | **不做** | 不做 | **做，先 Diff 审核** |
| Vue/Angular、多种状态库全覆盖 | 不做 | 视验证再扩展 | 视验证再扩展 |

> **重要区分**：`A` 引用了 `B`，只能证明静态数据依赖；不能由此断言某次交互导致 `A` 重新渲染，更不能证明 DOM 实际发生改变。V1 所有相关文案使用“潜在影响 / 静态依赖”。

---

## 3. 图形语言：V1 必须先遵守的规则

### 3.1 一张图，而不是两张互不关联的图

默认页面是**一个可缩放、可平移的主画布**：父组件是容器节点，子组件位于内部；State、派生值、事件端口是容器中的语义元素，连线跨容器连接。**右侧可以有详情面板，但不能把数据流与 UI 结构强制分成两个独立画布。**

示意（仅表达关系，不表示最终排版）：

```text
┌──────────────────────────── ProductPage ─────────────────────────────────┐
│                                                                         │
│  ┌──── SearchSection ──────────┐        [products: Product[]] ──┐       │
│  │ ┌──── SearchInput ────────┐  │                                │       │
│  │ │ value ◀─ keyword       │  │                                ▼       │
│  │ │ onChange ──┐           │  │  [keyword: State] ────────► [filter()]  │
│  │ └────────────┼───────────┘  │        ▲                         │      │
│  └──────────────┼──────────────┘        │                         ▼      │
│                 └ ⇢ setKeyword ⇢ ──────┘             [filtered: Product[]]│
│                                                             │           │
│  ┌──────────────── ProductSection ──────────────────────────┼─────────┐ │
│  │  ┌──────── ProductList ──────────────────────────────────▼───────┐ │ │
│  │  │ props.products ◀────────────────────────── filtered          │ │ │
│  │  │ ┌── ProductCard（模板 ×N）──┐                               │ │ │
│  │  │ └───────────────────────────┘                               │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

实际画布需要处理跨层连线的路由、端口位置和边遮挡；不要求模仿 ASCII 的具体坐标。组件的视觉排序只代表**结构近似**，不是浏览器的最终 CSS 布局。

### 3.2 四类主要视觉实体

| 实体 | 标识 | 表示什么 | 默认行为 |
|---|---|---|---|
| `Component` | 带标题的矩形容器，可嵌套 | React 组件的**某个 JSX 使用位置/模板** | 单击选中；双击展开内部；可跳转使用位置/定义 |
| `Value` | 小型数据胶囊/节点 | State、Prop、变量、常量、可确定的派生值 | 高亮来源和下游路径 |
| `Transform` | 函数/表达式节点 | 过滤、映射、格式化等计算 | 显示表达式与输入/输出；可跳转表达式 |
| `Port` | 节点边缘的小圆点 + 名称 | Props 输入、回调绑定、数据输出等接口 | 可选中，定位绑定代码；V1 禁止编辑连接 |

**可选结构容器**：`<main>`、`<section>` 等普通 JSX 标签不应伪装成 React 组件。可用轻量 `JSX Region` 表示明确存在的结构区域，标注是 HTML/JSX 包裹层。V1 不需要为每个 `div` 都建立大型容器；优先保留帮助理解页面的结构节点。

### 3.3 包含关系不是数据边

`ProductPage` 包含 `ProductList` 的关系，编码为 `parentId / containment`；**不要**额外用一条箭头表示父子关系。只有真实可归因的语义依赖才使用箭头。

- 多层组件嵌套可折叠；折叠时隐藏内部节点，跨界连接在边缘显示汇总端口和数量。
- 相同组件**定义**可在多个位置被**调用**。每个 JSX 使用位置是独立的 `ComponentUse`；所有实例可以指向同一个 `ComponentDefinition`。
- `map` 中的 JSX 是**代码模板**，不是已创建的具体运行时实例。应显示 `ProductCard ×N（动态）`，不要擅自生成 N 个实例。
- 条件渲染节点标注 `条件分支`，不能宣称当前运行时一定可见。

### 3.4 边语义：必须明确类型与箭头方向

| 边类型 | 示例 | 含义 | 样式建议 |
|---|---|---|---|
| `data-read` | `keyword → filter()` | 表达式读取数据 | 蓝色实线 |
| `derive` | `filter() → filtered` | 计算产出派生值 | 蓝色实线 |
| `prop-pass` | `filtered → ProductList.products` | JSX 属性表达式向子组件传值 | 蓝色实线 |
| `callback-bind` | `SearchInput.onChange ⇢ setKeyword` | JSX 将回调绑定到属性；**不是已发生事件** | 橙色虚线，标签“绑定” |
| `state-write` | `setKeyword ⇢ keyword` | 已识别 setter 的**潜在状态更新作用**；**不是调用事实** | 橙色虚线，标签“可更新” |

**禁止**：为了连出完整好看的路径，推断 `SearchInput` 一定调用了 `onChange`、某次事件一定执行了 `setKeyword`。如果没有分析子组件函数体，就只显示“回调已绑定”，不显示“事件已经触发”。

### 3.5 箭头与潜在影响高亮

- 选中 `keyword` 时，高亮从它出发沿 `data-read → derive → prop-pass` 可达的**确定路径**；相关组件容器描边高亮，其他节点淡化。
- **不要**仅因为某个组件包含一个子组件，就认为子组件直接依赖 `keyword`。只有显式 Props/变量依赖路径才能继续下钻；否则标注“可能间接受影响，未追踪”。
- 选择事件/回调边时，单独显示“回调绑定链”，不混入普通向前的数据读路径。
- 悬停显示 `类型 + 依据代码 + 文件位置 + 解析状态`；点击边打开对应源码引用。
- 证据级别：`confirmed`（AST/符号解析明确支持）、`partial`（只识别部分路径）、`unresolved`（不画确定连线，展示原因）。**不得把启发式猜测标为 confirmed。**

### 3.6 交互行为约束

- 画布支持缩放、平移、折叠、局部展开、搜索组件名/变量名。
- **图形节点拖动仅影响画布坐标**，不影响 JSX 层级；可选择是否本地保存视图布局。
- V1 禁止从端口拖出新边、重接边、删除语义节点、修改 Props 值。相关手柄可显示但必须为只读。
- 默认先展开当前组件及一层子组件；大图按需展开，避免线条泛滥。
- 详情面板显示：名称、类型、归属组件、对应源码位置、依赖入边/出边、支持状态和说明。
- **定位入口**：节点菜单区分“跳转组件定义”和“跳转 JSX 使用位置”；数据节点“跳转声明”；边“跳转绑定/表达式”。

---

## 4. V1 静态分析的正式能力边界

### 4.1 必须正确支持（P0）

1. React + TypeScript `.tsx`、函数组件；`function` 声明、`const Name = (...) => <...>` 的常见形式。
2. JSX 中大写组件引用、嵌套/同级关系；跨文件**直接 import / export** 的常见写法。解析时使用 TypeScript 符号，而不是只比较组件名称。
3. 每个组件的定义位置与每次 JSX 使用位置（URI、起止行列）。
4. 简单 `useState` 解构：`const [keyword, setKeyword] = useState('')`。
5. 简单 `const filtered = products.filter(p => p.name.includes(keyword))`：提取 `filtered` 对 `keyword`、`products` 的**直接静态读取依赖**。V1 不要求理解 `filter` 的业务效果，复杂表达式可折叠为单个 `Transform`。
6. JSX `value={keyword}`、`products={filtered}` 等表达式对简单标识符的 Props 绑定。
7. JSX `onChange={setKeyword}` 形式的回调绑定；只有能够确认 setter 身份时才生成对应 `state-write` 关系。
8. 组件、变量、表达式、绑定的源码定位，编辑器与画布之间的选择联动。

### 4.2 可识别部分结构，但必须明确标注（P1 可选）

- `useMemo` 和简单表达式中的引用，允许只分析引用不解释执行时机。
- `condition ? <A/> : <B/>`、`&&` 条件渲染：显示分支标识。
- `items.map(item => <Card .../>)`：显示模板节点 `Card ×N（动态）`；不要声称真实 N。
- `React.Fragment`、多个根元素：作为不占真实 DOM 的逻辑容器。
- 简单 Props 解构，例如 `function List({ products }: Props)`。

### 4.3 V1 不保证（明确列为 unsupported）

- 跨函数、跨 Hook 的通用别名分析、对象属性别名、闭包、副作用链、异步调用顺序；
- Context、Zustand、Redux 等全局状态源的完整追踪；
- 动态 import、HOC、render prop、复杂泛型推断、运行时组件工厂；
- CSS/Flex/Grid 像素级布局推导、Portal 的真实 DOM 空间位置；
- 当前浏览器中的组件实例数量、实际更新次数和渲染耗时；
- 对任意变量赋值都能得到完整全局影响链。

**原则：宁可漏画并报告限制，也不要画一条来源不明的假连线。**

---

## 5. 统一中间模型（UIFlow IR）

**不要直接把 React Flow 的 `Node[]` / `Edge[]` 当作领域模型。** 必须建立与渲染库无关的 IR（Intermediate Representation，中间表示），以便 V2 接入运行时数据、V3 做受控代码变换。

```ts
export type Confidence = 'confirmed' | 'partial' | 'unresolved';

// VS Code 的位置采用 0-based 行列；显示给用户时可以转为 1-based。
export interface Position { line: number; character: number; }
export interface SourceRef {
  uri: string;                         // 完整文件 URI，不直接信任 Webview 回传内容
  start: Position;
  end: Position;
  role: 'definition' | 'usage' | 'declaration' | 'expression' | 'binding';
}

export type NodeKind =
  | 'component-use' | 'jsx-region'
  | 'state' | 'value' | 'transform' | 'handler' | 'unknown';

export interface GraphPort {
  id: string;
  name: string;                       // 例如 props.products、onChange、output
  kind: 'value-in' | 'value-out' | 'callback' | 'state-setter';
  sourceRefs: SourceRef[];
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  parentId?: string;                  // 包含关系；不能用数据流 Edge 代替
  definitionId?: string;              // 多个 use 可共享一个 definition
  ports: GraphPort[];
  sourceRefs: SourceRef[];
  confidence: Confidence;
  notes?: string[];
}

export type EdgeKind =
  | 'data-read' | 'derive' | 'prop-pass'
  | 'callback-bind' | 'state-write';

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  source: { nodeId: string; portId?: string };
  target: { nodeId: string; portId?: string };
  sourceRefs: SourceRef[];
  confidence: Confidence;
  notes?: string[];
}

export interface ComponentDefinition {
  id: string;
  name: string;
  source: SourceRef;
}

export interface ProjectGraph {
  schemaVersion: 1;
  documentVersion?: number;           // 与 VS Code 文档版本关联，避免陈旧定位
  rootNodeIds: string[];
  definitions: ComponentDefinition[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  diagnostics: Array<{
    code: string;
    message: string;
    source?: SourceRef;
  }>;
}
```

### 5.1 模型额外约束

- **定义与使用分离**：组件函数定义 `ComponentDefinition`；`<ProductCard />` 的每个源码使用位置对应 `component-use`。
- **节点 ID 不可以只用名称**：不同作用域可有同名变量；同一组件也可以被引用多次。
- P0 可采用 `文件 URI + AST SyntaxKind + start/end + 父作用域路径` 构建**当前分析快照内**的节点 ID；代码改动会改变 offset，不能承诺跨编辑绝对稳定。后续可实现符号身份映射与重新关联。
- 尽量记录每条边的 `SourceRef`：例如 `filtered → ProductList.products` 对应 JSX 属性 `products={filtered}`；没有可追踪依据时不生成 confirmed 边。
- 每个节点/边必须有 `confidence`。`unresolved` 的关系可作为诊断展示，不应以正常箭头伪装。
- 不把 TypeScript AST 对象或 VS Code API 对象传进 Webview。跨进程只发可序列化数据。
- V3 只能基于**重新解析后的源码、符号和具体编辑范围**生成修改；不能拿旧行号直接字符串替换。

---

## 6. 技术架构与工程目录

### 6.1 架构

```text
VS Code Editor (TSX / 光标 / 右键)
    │ Commands + onDidSaveTextDocument
    ▼
Extension Host (TypeScript)
    ├─ ProjectResolver：识别工作区 / tsconfig / TSX
    ├─ Analyzer：TypeScript AST + TypeChecker
    ├─ GraphBuilder：构建 UIFlow IR；去重、分组、证据等级
    ├─ NavigationService：按 SourceRef 跳转 VS Code 编辑器
    └─ WebviewBridge：消息校验、数据发送、版本校验
                │ postMessage / onDidReceiveMessage
                ▼
Webview (React + @xyflow/react)
    ├─ NestedCanvas：可折叠的容器节点 + 跨容器有向边
    ├─ TraceController：单变量路径选择/高亮
    ├─ Inspector：节点、端口、边与源码依据
    └─ LayoutStore：只保存视觉位置，不改语义图
```

VS Code Webview 与 Extension Host 通过消息通信；Webview 不是直接运行 Node/VS Code API 的环境。React Flow 支持使用 `parentId` 构建嵌套节点、使用 `extent: 'parent'` 约束子节点区域，但实际跨层连线的路径、折叠和遮挡需要自行设计与测试。

### 6.2 仓库建议

```text
uiflow/
├─ AGENTS.md                         # AI 代理开发约束（随附示例）
├─ docs/
│  ├─ UIFlow_V1_开发指导规范.md        # 当前文档
│  ├─ decisions/                     # ADR：重要技术决策
│  └─ progress.md                    # 每次任务的结论、问题与后续
├─ apps/
│  ├─ vscode-extension/              # Extension Host + Commands + Webview bridge
│  └─ demo-react/                    # 固定 TSX 验收样例，不依赖网络
├─ packages/
│  ├─ core/                          # IR 类型、图遍历、证据校验
│  ├─ analyzer/                      # Compiler API / TypeChecker
│  └─ graph-ui/                      # React + React Flow Webview 页面
└─ tests/
   ├─ fixtures/                      # 语法模式与期望图快照
   └─ integration/                   # VS Code 导航与消息联动
```

建议：`pnpm workspace + TypeScript + React + @xyflow/react + Vitest`，在 VS Code 插件中用官方 Extension Host 测试方案进行必要的集成测试。**依赖版本必须由代理在创建项目时核对相互兼容性并锁定，不能臆造 API。** 特别是 TypeScript Compiler API 的大版本升级，要单独验证兼容性。

### 6.3 VS Code 命令与入口

- `uiflow.openGraph`：在 TSX 编辑器右键或命令面板调用，读取当前文件/光标上下文，打开 Webview Panel（编辑器区域，便于左右分栏）。
- `uiflow.traceSymbol`：在标识符处右键追踪；如果无法解析到符号，提示不支持。
- `uiflow.refreshGraph`：重新分析当前目标，保留可重新关联的选择。
- Webview 内点击组件、端口、边，通过消息请求 `revealSource`；**Extension Host 再校验并执行** `openTextDocument`、`showTextDocument`、`revealRange`。

`package.json` 中通过 `contributes.commands` 与 `contributes.menus['editor/context']` 注册菜单。注意右键菜单提供的文档上下文与编辑器当前 selection 可能需要在命令执行时组合读取；**不要假定菜单会自动传回完整 AST 节点**。

### 6.4 Webview 消息契约（示意）

```ts
type HostToView =
  | { type: 'graphLoaded'; graph: ProjectGraph; requestId: string }
  | { type: 'analysisFailed'; message: string; requestId: string }
  | { type: 'sourceRevealed'; requestId: string };

type ViewToHost =
  | { type: 'requestGraph'; targetNodeId?: string; requestId: string }
  | { type: 'revealSource'; sourceRefId: string; requestId: string }
  | { type: 'traceNode'; nodeId: string; requestId: string };
```

**不要让 Webview 直接发送任意本地文件 URI 并要求打开。** Extension Host 通过自己持有的 `SourceRef` 注册表解析 `sourceRefId`，校验工作区边界和文档版本，然后执行导航。Webview 设置 CSP、资源访问范围和必要的消息 schema 校验；不要远程加载用户源码或将其交给模型服务。

### 6.5 刷新策略

- P0：点击“刷新”手动重新分析。
- P1：保存目标文件后触发重新分析；跨文件变更由依赖追踪决定是否刷新。
- Webview 请求带 `requestId`，分析结果带快照版本；后到的旧结果不可覆盖新图。
- 文件已改动导致 SourceRef 无效时，不允许跳转陈旧行号，提示重新分析。
- V1 **不要求**每敲一个字符都实时重建项目图；后续再考虑语言服务与增量分析。

---

## 7. 分阶段实施：不要一次性让 AI 写完整项目

> 每个阶段必须在独立可运行的提交中完成。**没通过本阶段验收，不进入下一阶段。**

### M0：嵌套画布技术验证（假数据）

**目标**：证明“组件大框套小框 + 同画布数据箭头跨边界 + 节点选中”在 Webview 中可用。

**实现**：硬编码 `ProductPage / SearchInput / ProductList / keyword / filtered / filter()`；渲染父子 `parentId`；建立数据与虚线事件边；支持缩放、折叠、节点/边详情。

**验收**：打开 VS Code Extension Development Host 后，主画布可见；不需要切换视图即可同时辨认嵌套和箭头；不出现错误遮挡；点击 `keyword` 能高亮静态依赖。

**此阶段不做**：AST 分析、自动定位、性能监控、AI 服务。

### M1：源码跳转闭环（先对固定数据）

**目标**：图形 → Extension Host → 编辑器定位，真实可工作。

**实现**：为假数据配置真实 demo 文件的 SourceRef；实现 `revealSource` 消息、源位置校验、打开文件/选择范围、显示定义与使用位置选择。

**验收**：点击 `ProductList`、`keyword`、`filtered → ProductList.products`，分别跳到 demo 中正确代码；无法定位时有明确错误提示。

### M2：静态组件结构分析

**目标**：替换假组件图为 AST 输出的真实组件包含结构。

**实现**：定位组件定义、跨文件 import / export、JSX `component-use`、简单 JSX Region、`map` 模板/条件分支标注；将结果转换为 IR 再渲染。

**验收**：演示项目中父子关系与源码一致；两个位置使用同一组件时形成两个 use 节点，但共用 definition；组件跳转准确。

### M3：V1 数据依赖分析

**目标**：从 `keyword` 静态追踪到 `filtered` 和 `ProductList.products`，显示箭头并支持追踪选择。

**实现**：处理最小 `useState` 模式、`const` 派生表达式的标识符读取、JSX Props 传递、回调绑定；生成 `GraphEdge` 和 SourceRef；图上高亮路径。

**验收**：对 fixtures 的确定关系不漏、不误报；每条 confirmed 边都能定位对应依据；不支持模式明确标注。

### M4：刷新、复杂度控制与发布前检查

**目标**：让原型可以在日常编码中稳定使用。

**实现**：保存刷新、旧请求作废、容器折叠、局部展开、重复模板聚合、节点过滤、空图/失败态、深浅主题、安全检查、测试和文档。

**验收**：修改 `ProductPage.tsx` 中 Props 绑定并保存，图同步改变；删除变量后旧定位失效；异常输入不导致 Webview 崩溃；确认无业务代码写操作。

---

## 8. 用于 AI 开发与测试的固定 React 样例

至少准备以下四个文件（可补充必要 import 与类型定义）：

```tsx
// ProductPage.tsx
export function ProductPage() {
  const [keyword, setKeyword] = useState('');
  const products = initialProducts;
  const filtered = products.filter(p => p.name.includes(keyword));
  return (
    <main>
      <SearchInput value={keyword} onChange={setKeyword} />
      <ProductList products={filtered} />
    </main>
  );
}

// SearchInput.tsx
export function SearchInput({ value, onChange }: SearchProps) {
  return <input value={value} onChange={e => onChange(e.target.value)} />;
}

// ProductList.tsx
export function ProductList({ products }: ListProps) {
  return <section>{products.map(p => <ProductCard key={p.id} product={p} />)}</section>;
}

// ProductCard.tsx
export function ProductCard({ product }: CardProps) {
  return <article>{product.name}</article>;
}
```

### 8.1 预期确定关系

1. `ProductPage` **包含** `SearchInput` 与 `ProductList` 两个 JSX 使用位置；`ProductList` **包含** `ProductCard ×N` 代码模板。包含关系不可画成数据箭头。
2. `keyword → SearchInput.value` 是 Props 绑定。
3. `keyword → filter表达式` 与 `products → filter表达式` 是数据读取；`filter表达式 → filtered` 是派生赋值。
4. `filtered → ProductList.products` 是 Props 绑定。
5. `SearchInput.onChange ⇢ setKeyword` 是回调绑定；`setKeyword ⇢ keyword` 是已知 setter 可以更新状态的关系，**不说明它在当前运行中被调用过**。
6. `ProductList` 的 `products` Prop 与其内部 `products.map` 的引用关系，在 P0 支持简单 Props 解构时应可继续追踪；如果尚未支持，应明确标注而非虚构。

### 8.2 最低限度的反例测试

| 反例 | 必须表现 |
|---|---|
| 两个组件里都叫 `keyword` 的变量 | 不得混为同一数据节点 |
| `import { List as ProductList }` | 支持符号别名的定义定位，或明确失败 |
| `<ProductCard />` 在 `map` 下 | 不得显示“当前 5 个真实实例” |
| 条件渲染 `<A />` | 标注条件分支，不推断实际可见 |
| 对象动态访问 `store[key]` | 不得生成确定依赖链 |
| 删除 / 改名文件后点击旧节点 | 不能跳到无关行，必须请求刷新或提示失效 |
| 修改图中节点的显示位置 | 源码字节完全不变 |
| `onChange={someHandler}`，函数体未解析 | 仅能声明绑定，不能凭空创建 `state-write` |

**测试方法**：分析器单元测试使用固定 TSX fixture + IR 期望快照；图形交互测试检查选中状态/节点行为；VS Code 集成测试检查消息与真实编辑器定位。对 supported 的确定模式，优先要求**零虚假确定边**，再提升覆盖率。

---

## 9. 开发时的决策边界与风险控制

### 9.1 必须记录的技术决策（ADR）

1. IR 与渲染库解耦的理由及字段变更；
2. 组件定义、JSX 使用位置、运行时实例的区分；
3. Props/事件/更新箭头的方向及证据要求；
4. 跨文件符号解析的范围和 TypeScript 版本锁定策略；
5. 容器自动排版、折叠节点和跨边界连线方式；
6. 何时从静态分析转向 V2 运行时插桩。

### 9.2 不允许 AI 擅自作出的改动

- 不得为了快速完成而改成“左边 UI 树、右边独立数据流图”；**同画布是核心需求**。
- 不得把所有组件层级关系画成箭头；**空间嵌套才是包含关系**。
- 不得把用户期望的未来功能（自动改代码、运行时追踪）作为 V1 必做项。
- 不得引入远端大模型 API、把代码上传云端或执行工作区里的任意脚本来换取分析结果。
- 不得通过字符串匹配组件名代替必要的符号/作用域解析，并把结果标为确定。
- 不得忽略构建失败、类型错误、测试失败或编造“已验证通过”。
- 不得在 V1 中修改受分析项目的业务源码。

### 9.3 建议的优先原则

`语义正确 > 可定位证据 > 可理解的图形 > 覆盖更多语法 > 炫酷动画`。

如果一种高级场景会显著拖慢 MVP：将其变为 `unsupported diagnostic`，而不是破坏已有正确能力。

---

## 10. AI 编码协作协议（请复制到开发代理的系统任务/项目规则）

### 10.1 每一张任务卡开始前

AI 必须先阅读本文件和 `AGENTS.md`，然后只做当前里程碑。输出：

1. **目标与范围**：本轮完成哪些验收项，哪些明确不做。
2. **拟改动的文件清单**：每个文件承担的责任。
3. **技术方案**：关键数据结构、API 依据、重要不确定性。
4. **测试计划**：可执行命令、fixture 和人工验证步骤。

开始写代码后，如发现设计与文档冲突，**先报告冲突并提出最小调整方案**，而不是悄悄修改目标。

### 10.2 每一张任务卡结束后

AI 必须给出：

- 完成内容和未完成内容；
- 实际改动文件；
- 运行过的构建、类型检查、测试命令及真实结果；
- 至少一个完整人工演示步骤；
- 仍不支持的语法或已知问题；
- 是否满足当前里程碑验收；
- 更新 `docs/progress.md`，必要时更新 ADR。

### 10.3 可直接复制的启动提示词

```text
你是 UIFlow 项目的开发代理。请先完整阅读：
1. docs/UIFlow_V1_开发指导规范.md
2. AGENTS.md

本轮只实现 M0（嵌套画布技术验证）。

硬性要求：
- 在 VS Code Webview 中，用同一张 React Flow 画布展示嵌套组件容器和跨容器数据箭头。
- 包含关系必须用 parentId/空间嵌套表达；数据/回调依赖必须使用不同的有向边。
- 使用硬编码 fixture 演示 ProductPage、SearchInput、ProductList、keyword、filtered、filter()。
- 支持节点选中、高亮数据路径、折叠、缩放和平移；所有语义连线只读。
- 不要开发 AST 分析、源码修改、运行时性能分析、AI 接口和独立网页产品。
- 不要将领域模型与 React Flow 的渲染模型耦合。

请先给出你计划修改的文件、最小数据契约、分步实现方法和验收步骤，再实施代码。
完成后必须实际运行适用的检查，并报告结果与尚存限制。
```

### 10.4 M1–M4 的提示词模板

```text
请阅读 docs/UIFlow_V1_开发指导规范.md 与 AGENTS.md。
当前里程碑：[M1/M2/M3/M4]。
已完成事实：[复制上一阶段 progress.md 的真实结果]。
本轮验收项：[从规范对应阶段复制，不要擅自扩展]。

要求：先审查现有实现，不要重写已通过测试的模块；
仅按本轮任务变更；保留 UIFlow IR 和源码证据；
不支持的场景必须报告，不要伪造确定依赖；
完成后运行相关测试并更新 docs/progress.md。
```

---

## 11. 定义完成（Definition of Done）

只有同时满足以下全部条件，才可以将 V1 标为完成：

- [ ] 以标准 VS Code Extension 形式运行，可从 TSX 编辑器菜单打开。
- [ ] **单画布**同时展示嵌套包含关系和有方向的数据箭头。
- [ ] 简化 UI 只是结构示意，不被宣传为真实 CSS 布局。
- [ ] 点击组件定义、使用位置、State 声明、Props 绑定和依赖边，能定位正确源码。
- [ ] 对固定 demo 中 `keyword → filter → filtered → ProductList.products` 提供可追踪的静态路径。
- [ ] 回调绑定与状态更新、普通数据读取分别标注；不声称实际运行时事件或 rerender。
- [ ] 同名变量不同作用域、跨文件别名、列表重复模板至少有相应测试或明确 unsupported 提示。
- [ ] 通过人工刷新、保存刷新处理源码变化，旧定位不误导用户。
- [ ] 遇到 unsupported 语法可以安全降级，图上不会伪造确定关系。
- [ ] 图形操作不修改被分析项目的业务代码。
- [ ] 有完整 README、安装/调试说明、测试结果、已知限制与 1 个可复现 demo。

---

## 12. V1 之后的发展方向（只记录，不提前实现）

**V2：运行时关系验证**。把静态图与 React 实际运行时组件实例、状态更新、渲染记录和 DOM 几何关联；提供“静态可能影响 vs 本次实际更新”的区别。需独立研究运行时采集、React 版本兼容和浏览器开发环境，避免依赖不稳定内部接口。

**V3：图形编辑反向修改源码**。先做**有限的安全动作**：例如将 `<ProductList products={filtered} />` 的 Props 绑定改为同一可见作用域内类型兼容的另一个变量。流程必须是“图上操作 → 变更意图 → 重新解析代码 → 验证约束 → 生成 Diff → 用户确认 → 应用编辑 → TypeScript 检查/测试 → 重新分析图”。不直接对源码做未经验证的字符串替换。

**长期理想**：从“理解既有代码”扩展到“在图形上设计组件与数据流”，但具体编辑范围应由真实用户验证决定，而不是一次性承诺所有 React 写法都可视化编辑。

---

## 13. 官方技术参考与重要提醒

1. VS Code Webview API（Webview、Extension Host 消息通信与安全）：https://code.visualstudio.com/api/extension-guides/webview
2. VS Code Contribution Points（命令、右键菜单注册）：https://code.visualstudio.com/api/references/contribution-points
3. VS Code Extension Commands：https://code.visualstudio.com/api/extension-guides/command
4. React Flow Sub Flows（`parentId`、嵌套节点）：https://reactflow.dev/learn/layouting/sub-flows
5. React Flow Node API：https://reactflow.dev/api-reference/types/node
6. TypeScript Compiler API：https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
7. VS Code Workspace Trust：https://code.visualstudio.com/api/extension-guides/workspace-trust

> **版本提醒**：TypeScript Compiler API 官方 Wiki 在 2026 年已注明其指南适用于 6.0 及更早的 Compiler API，且提到后续版本存在 API 变化风险。开发 AI 应以项目实际锁定的 TypeScript 版本为准验证相关接口；不要照搬旧教程就宣称兼容最新版。

---

## 14. 推荐的第一步

**先做 M0，不要从 AST 入手。** 因为这个项目独特且不可妥协的产品要求，是**同一张图上既有嵌套 UI，又有跨层数据箭头，并且可理解、可操作**。应先验证 React Flow 的父子节点、端口位置、跨层连线与折叠策略确实能实现这个效果。

M0 做通后，再进行 M1 源码定位，最后接上真正的 AST 分析。这样即使分析器尚不完善，也已经证明产品最核心的交互形式，而不是提前写出大量解析代码，最后发现画布体验不成立。
