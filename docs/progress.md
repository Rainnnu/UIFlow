# UIFlow 开发进度

## 用户人工验收补充（2026-11-20）

- 用户确认已验证保存源码后图示自动刷新正常；连续拖动图示组件不会频闪。将保存刷新与连续拖动两项人工验收更新为通过。
- 本次只更新验收文档，未修改产品代码；未重新运行类型检查、测试或构建，沿用已通过的源码提交及远程 CI 记录。
- 发布剩余项为最低声明 VS Code 1.96 实测，以及正式元数据、名称和许可核查；不把本次反馈扩展成这些项目已经完成。

## V1 源码交付检查与界面优化（2026-11-20）

- 完成依赖分层排列、回调后置、正交避障与线路分流；统一卡片、工具栏、主题色、端口文字及选中状态。折叠收紧布局，同级容器并排，搜索结果单独布局并适配视口。
- 修改 graph-ui 的 layout.ts、main.tsx、style.css、canvas-state.ts；新增 routing.ts、routing.test.ts，扩充 canvas-state.test.ts；新增 ADR-0007、GitHub Actions 检查流程与敏感配置忽略规则。
- 实际 VS Code 独立开发宿主观察：真实结构全图、新层级布局、搜索 key 后两个节点及绕行状态更新虚线正常显示；未将一次拖动截图当作连续拖动稳定性的证明。业务源码与 IR 未变。
- GitHub 目标尚待用户提供；未将源码上传到任何推测的仓库。CI 配置已准备，远程 CI 尚未运行。正式公开许可未选定，不能将源码可见等同于开源授权。
- 用户随后指定 https://github.com/Rainnnu/UIFlow.git；ls-remote 成功且没有现有 refs，可推送新的 main 而不覆盖已有提交。初始化 Git；暂存 75 个源码/配置/文档文件，排除 node_modules、dist、artifacts、.test-output 和本地密钥配置；常见私钥/GitHub Token/AWS Key 模式扫描未发现匹配（非完整安全审计）。
- 最终 pnpm typecheck 通过、pnpm test 8 文件 49 项通过、pnpm package 构建及 VSIX 打包成功。联网 pnpm audit 为 0 条公告；沙箱内首次因 DNS 限制失败，放行网络后重查通过。React Flow use client 提示仍存在。
- 交付定位为 V1 源码预览基线，保留扩展版本 0.0.1，不提前声明正式稳定版完成。最低 VS Code、连续拖动完整人工复核、大图性能和正式许可仍见发布检查表。
- 已推送 main 至用户指定 GitHub 仓库，源码提交 dbcd5debe6e504f55f41da8b7b8d0ad0e1acffbe；远程 refs 核对一致。首次 Windows GitHub Actions 已完成且 success：https://github.com/Rainnnu/UIFlow/actions/runs/44674929207 。该结果对应此源码提交，后续本项记录为纯文档提交。

## 当前里程碑：M4（本地预览包可交付，正式发布条件未全部完成）

### 本地安装包收尾（2026-11-19）

- 新增 scripts/package-extension.mjs、tests/integration/installed-run.ts、ADR-0006；修改根 package.json、pnpm-lock.yaml、scripts/build-extension.mjs、插件 extension.ts/package.json、README、.gitignore 和发布检查表。
- 官方 @vscode/vsce 4.1.1 通过独立暂存目录打包，包含实际 TypeScript 5.8.3 运行时/标准库、Webview、固定示例和第三方许可，排除开发测试入口。产物 artifacts/uiflow-0.0.1.vsix 及 SHA-256 文件；可用 pnpm package 重建，需 Node >=22。
- 包内演示源码在工作区之外时显示 partial 演示图且没有定位动作；保持工作区边界校验。根据静态只读实现声明支持 Restricted Mode，不改变用户信任设置；虚拟工作区暂不支持。
- 最终 ZIP 内容与 SHA-256 校验通过（.test-output/package-content-check.json）：139 项、4,513,480 字节；必需编译器/标准库/样式/示例/许可存在，未包含集成测试或 .env；最终包内宿主及 Webview JS 与已安装测试的构建输出一致。最终重打包只更新 README 许可措辞。
- pnpm typecheck、pnpm test（7 文件 43 项）、pnpm package 的构建均通过。构建仍有 React Flow use client 忽略提示。引入打包工具后 minimatch 公告用 vsce 范围 override 11.0.1 修复；完整 audit 最终为 0 条公告（260 项依赖统计）。
- VSIX 已实际安装到 .test-output/isolated-extensions。installed-integration.json 于 22:22:41 记录 passed=true，TypeScript 解析位置属于安装目录，三个命令、标准库及资源检查通过。最初独立驱动目录测试未发现扩展，不记为通过；改为安装目录作为待测目录后通过。
- 另用隔离用户配置启动不带 extensionDevelopmentPath/extensionTestsPath 的普通 VS Code 1.147.0 窗口，实机打开真实分析图、确认命令并折叠 ProductList。日常扩展目录未被安装测试改动。
- 对安装产物实机检查 keyword 搜索/选中、仅追踪路径、跳转声明及深色/浅色/暗色高对比主题。连续拖动本轮未充分观察，沿用此前用户确认与回归测试；保存刷新沿用上一轮真实宿主集成结果，没有冒充完整手工复核。
- 验收：M4 本地预览可交付。最低声明 VS Code 1.96、完整保存/连续拖动手工复核和正式名称/许可仍待完成；未上传 Marketplace。包内自身许可仅标记 UNLICENSED，未替用户选择开源许可。业务源码未改写。

以下为 M4 实现时记录，历史“未验证”项以以上收尾记录和发布检查表为准。

日期：2026-11-19

### 完成事实

- 用户已确认 M3 人工验收通过后进入 M4。
- 新增 GraphSession + watchSession：依赖编辑立即撤销导航，保存/磁盘变化/删除/改名合并刷新，revision 丢弃旧结果与旧错误，面板关闭取消计时和导航。
- NavigationService 新增 epoch，异步打开过程中失效的定位不会应用旧选区。
- 固定首次根组件名，防止旧光标 offset 在刷新后误选别的组件；改名/删除后需重新打开。
- Webview 接收 revision、即时移除旧定位动作；增加 loading/失效/失败/空图状态、图结构校验、错误边界。
- 搜索、仅追踪路径、默认深层折叠、全部展开与现有局部展开同画布工作。过滤保留祖先，不生成虚构边；原拖动状态修复保留。
- CSS 增加 VS Code 深浅/高对比适配和自适应工具栏；视觉效果未在本轮实机截图验收。
- 新增刷新命令，调试配置改为 UIFlow M4；更新 README、ADR-0005 和发布检查表。

### 真实检查

- 最终 pnpm typecheck：通过。
- 最终 pnpm test：7 个文件、43 项通过。覆盖乱序成功/失败、保存合并、取消导航、销毁、恢复、筛选、畸形图、根选择与原回归。
- 最终 pnpm build：通过，Vite 6.4.5；保留 React Flow use client 指令忽略提示。
- 最终 pnpm audit --json：0 条已知公告（127 项依赖统计）。首次完整检查有 18 条公告，集中在旧 Vite、Vitest 和传递依赖；精确升级 Vitest 4.1.12、Vite 6.4.5 并统一 override 后清零。TypeScript 5.8.3 未升级。
- .test-output/m4-integration.json 最终更新时间 21:55:47，passed=true。真实 VS Code 编辑临时副本并保存，确认 Props 边更新、删除变量、旧定位拒绝、空图、分析失败恢复，原始 fixture 未改。临时样例保留在 .test-output/refresh-0MMsua。
- 产品源码搜索检查未发现网络上传、脚本启动、WorkspaceEdit 或写入业务源码操作；CompilerHost.writeFile 为显式拒绝。集成测试的写操作仅在新建临时目录。
- 本轮未重复 M3 的全部边定位宿主测试；原导航与数据回归单元测试继续通过，M4 新增保存集成通过。

### 本轮文件

- 新增 apps/vscode-extension/src/graph-session.ts、graph-session.test.ts、watch-session.ts；修改 extension.ts、structure.ts、navigation.ts、navigation.test.ts、插件 package.json。
- 新增 packages/core/src/validate.ts。
- 新增 packages/graph-ui/src/view-filter.ts、view-filter.test.ts、CanvasErrorBoundary.tsx；修改 main.tsx、style.css、package.json。
- 修改 packages/analyzer/src/index.ts、analyzer.test.ts（根组件锚定）。
- 新增 tests/integration/refresh-run.ts；修改 scripts/build-extension.mjs。
- 修改根 package.json、pnpm-lock.yaml、.vscode/launch.json、README.md、本文件；新增 ADR-0005 和 docs/release-checklist.md。
- IR schemaVersion 1 不变；未改 apps/demo-react 或用户业务源码。

### 人工步骤与验收状态

1. 停止旧调试，选择 UIFlow M4 按 F5，打开 ProductPage.tsx 的图。
2. 修改 Props 绑定并保存，确认箭头自动变化；编辑未保存时定位入口不可用；删除变量后不再有旧节点。
3. 体验搜索、仅追踪路径、折叠展开、拖动和重置；切换深浅/高对比主题检查端口和连线。
4. 目标函数改名后确认诊断，重新运行打开命令选定新目标；空图和失败后可刷新恢复。

- M4 代码和自动化通过，新增 UI 人工复核、最低声明 VS Code 版本、VSIX 打包与干净安装仍未验证。没有上传 Marketplace，不宣称 V1 已正式发布或全部完成。
- 当前仍不支持复杂闭包/Hook/全局状态库的完整追踪；新增未读取文件可能需手动刷新；重新布局不保存跨编辑坐标。
- 当前目录不是 Git 仓库，未创建阶段提交。

---

## M3 历史记录（验收通过）

日期：2026-11-19

### 阶段门禁

- 用户确认 M2 拖动修复“可以了”，结合此前包含关系确认与真实宿主测试，M2 验收通过。
- 本轮仅 M3；未实现 M4 保存自动刷新或运行时采集。

### 完成内容

- 新增 DataFlow 模块：每个组件使用有独立符号环境；React useState 身份验证、状态/Setter、const 值与派生 Transform、简单 Props 解构、标识符传值和回调绑定。
- 保留数据读取、派生、Props、回调绑定、潜在更新五类边，所有生成的 confirmed 边都有 SourceRef；普通 handler 不标 setter，不从函数体补造实际调用链。
- 追踪按组件端口继续，避免 a 入参影响 b 的无关路径；回调链与普通数据链分开。
- 动态 element access、复杂 Hook、spread/重复属性覆盖、未知组件、setter 别名和 map item 别名等降级为 partial/unresolved 诊断，不画猜测的确定连接。
- 单画布在现有结构布局中增加数据行与端口延续显示；保留已验证的完整拖动状态同步，定位详情使用业务名称而不是内部长 ID。
- 调试配置更新为 UIFlow M3；增加 ADR-0004 和 README 的验收步骤。IR schemaVersion 1 未更改；apps/demo-react 源码未改写。

### 真实检查与结果

- pnpm typecheck：通过。
- pnpm test：5 个文件、35 项全部通过；新增 8 项 M3 静态依赖反例与确定路径测试、1 项回调链隔离回归，原拖动和结构/导航测试继续通过。
- 一次真实 Compiler Program 导航回归因超过默认 5 秒超时；该项涉及本机磁盘读取，设置独立 15 秒时限后通过，未放宽断言。最终该项约 2 秒内完成。
- pnpm build：通过；仍有 React Flow use client 指令忽略提示。
- VS Code Extension Development Host 中执行 data-integration.cjs：通过。固定 fixture 生成 18 个节点、13 条确定边，keyword 追踪 6 条数据边。
- 最终 .test-output/m3-integration.json：passed=true、everyConfirmedEdgeRevealed=true、sourceUnchanged=true。已实际选中 keyword 声明及全部 13 条 confirmed 边的源码，含 Props、React setter、表达式与 Props 解构依据。
- 集成测试直接调用宿主服务，未模拟所有画布按钮或验证跨层线条的视觉遮挡，不将这些人工项记为通过。

### 改动文件

- 新增 packages/analyzer/src/data-flow.ts、data-flow.test.ts；修改 src/index.ts。
- 修改 packages/core/src/index.ts、graph.test.ts（端口追踪与回调链）。
- 修改 packages/graph-ui/src/layout.ts、main.tsx（同画布数据行、端口延续、回调高亮、名称展示）。
- 修改 apps/vscode-extension/src/navigation.test.ts（仅真实 Program 测试时限）。
- 新增 tests/integration/data-run.ts；修改 structure-run.ts（保留 M2 结构断言，允许 M3 新边）、scripts/build-extension.mjs。
- 修改 .vscode/launch.json、README.md、本文件；新增 docs/decisions/0004-m3-static-data-dependencies.md。

### 人工步骤及剩余项

1. 停止旧调试，选择 UIFlow M3 并按 F5。
2. 新宿主打开 ProductPage.tsx（或固定 tests/fixtures/m1/ProductPage.tsx），运行 UIFlow: 查看当前组件结构。
3. 确认同画布内嵌套与箭头；单击 keyword，检查 filter() → filtered → ProductList.products 及 SearchInput.value 的数据路径。
4. 单击回调虚线，确认绑定/潜在更新链与数据路径分开；点击源码入口检查定位。
5. 拖动、折叠与重置回归，检查跨层线条遮挡。

- 当前不保证 setter 别名、复杂闭包/Hook、map item 属性别名、动态对象访问、全局状态库或一般控制流。复杂数据路径不伪造 confirmed。
- 手动刷新可用，保存自动刷新仍留 M4；静态关系不代表实际事件或 React rerender。
- 用户在收到 M3 人工验收步骤后回复“可以”，记录为本轮人工验收通过；结合 35 项测试和真实宿主全部确定边定位结果，M3 验收通过。
- 下一阶段为 M4；尚未开始实现保存自动刷新、旧请求作废和发布前检查。
- 当前目录不是 Git 仓库，未创建阶段提交。

---

## M2 历史记录（后续用户已确认拖动修复可用）

日期：2026-11-19


### 拖动抖动修复（2026-11-19）

- 用户确认真实模块包含关系可成功解析和展示，并报告拖动节点抖动；M2 暂不进入 M3。
- 发现旧实现从闭包中的完整节点数组计算位置，然后只写回坐标；下一次渲染会丢失 React Flow 的 dragging/measured 等运行状态。旧的整图位置写回也可能覆盖已更新的其他节点。
- 修改 packages/graph-ui/src/main.tsx；新增 canvas-state.ts、canvas-state.test.ts。拖动/尺寸/选择变化通过 applyNodeChanges 更新最新完整节点状态；领域模型不参与拖动写入。投影和边以外的业务源码未修改。
- 投影仅在结构、折叠、选中或基础布局变化时同步，保留当前拖动坐标、dragging 和 measured。隐藏节点保存视觉位置，展开恢复；刷新或显式重置清空拖动坐标。
- 真实执行 pnpm typecheck、pnpm test、pnpm build：全部通过；4 个测试文件共 26 项通过，新增 3 项拖动状态回归。构建仍有原 React Flow use client 提示。
- 本轮未重复执行宿主导航集成测试（导航实现未修改），未实机验证连续拖动的视觉平稳性；不能仅凭状态测试宣告抖动已消失。
- 手动复核：停止旧调试，选择 UIFlow M2 按 F5；打开 TSX 并显示组件结构。分别连续拖动父容器和子节点，再沿父容器边界拖动；确认不反复回跳。移动子节点后折叠/展开应保留坐标，点击重置视图应恢复初始布局。仍不支持改变包含层级或写回源码。

### 阶段门禁

- 用户已确认在注释代码前成功体验 M1 定位功能；结合上一轮真实宿主选区测试，记录 M1 正常流程通过。用户未另行确认注释后的行为，不将其记为人工验证事实。
- 本轮仅 M2；没有开始 M3 数据依赖分析。

### 已实现

- 独立 packages/analyzer，TypeScript 5.8.3 AST + TypeChecker 解析直接函数组件、const 函数、直接 import/export、别名和局部作用域。
- 每个 JSX 使用独立 ID、共享组件定义；main/section/article 结构区域，短 Fragment，map 模板、条件分支标记，循环/语法错误/未知引用安全降级。
- uiflow.openGraph 改为当前 TSX 组件结构；uiflow.openDemo 保留 M1 演示入口。调试配置更新为 UIFlow M2。
- 真实结构使用独立布局投影，显示实际证据状态、notes 与诊断，数据 edges 为空。
- AST 来源注册到宿主导航服务；依赖文件的版本/内存/磁盘变化使旧图定位失效；工作区与 realpath 校验保留。
- 用户修改过的 apps/demo-react 文件未改写；M1 回归测试改用独立 tests/fixtures/m1。

### 实际验证

- pnpm install --offline --ignore-scripts：成功，为分析包和插件链接固定 TypeScript 运行依赖并更新锁文件。
- 首轮 pnpm test 曾有 6 项失败：5 项受用户 demo 格式变化影响，1 项暴露测试文件含多个候选根组件。迁移固定测试样例、增加唯一导出组件选择后修复；没有还原用户源码。
- 最近 pnpm test：3 个测试文件，23 项通过。新增覆盖别名、重复使用、同名模块和局部作用域、map/条件、注释、未调用辅助函数、HOC、递归、多组件光标、默认导出、Props 来源、语法错误、type-only 和可变组件；另验证 AST 来源注册与依赖变化拒绝。
- 最终 pnpm typecheck、pnpm test（23 项）、pnpm build 均通过。构建仍有 React Flow use client 指令忽略警告。
- 新增 tests/integration/structure-run.ts，已构建并尝试通过 code --extensionTestsPath 运行。
- 首次实机集成测试因 VS Code 更新互斥锁未启动；用户确认更新完成后已重新执行成功。
- 2026-11-19 在更新后的 VS Code 1.147.0 中运行 structure-integration.cjs，宿主退出码 0；.test-output/m2-integration.json 显示 passed=true。解析 7 个结构节点、4 个定义（ProductPage/SearchInput/ProductList/ProductCard）；ProductList 定义与 JSX 使用位置的真实选区通过，products 端口选区精确为 products={filtered}；edges 为空且源码字节不变。
- 此轮仅重跑真实宿主集成并修改文档，未修改产品代码；未重复执行类型检查、构建和单元测试，沿用上一轮全部通过的结果。

### 改动范围

- 新增 packages/analyzer/package.json、src/index.ts、src/analyzer.test.ts。
- 新增 apps/vscode-extension/src/structure.ts；修改 extension.ts、navigation.ts、navigation.test.ts、插件 package.json。
- 新增 packages/graph-ui/src/layout.ts；修改 main.tsx。
- 新增 tests/fixtures/m1 四个 TSX 文件、tests/integration/structure-run.ts；修改 M1 integration/run.ts。
- 修改 scripts/build-extension.mjs、pnpm-lock.yaml、.vscode/launch.json、README.md、本文件；新增 ADR-0003。
- IR schemaVersion 1 未修改。

### 验收状态与剩余项

- 自动化单元检查与真实宿主集成均通过；集成测试直接调用导航服务，未模拟画布按钮点击，仍需按 README 人工复核 M2 画布与交互；不进入 M3。
- 待按 README 的 M2 步骤检查真实画布布局、点击导航及手动刷新后的结果。
- 不保证复杂调用、间接 JSX 返回、HOC、命名 React.Fragment、动态组件和一般控制流；会尽量给诊断，未构建通用解释器。
- 手动刷新会重新选择入口组件；多组件文件应把光标放入目标函数后重新调用命令。未做保存自动刷新。
- 当前目录不是 Git 仓库，未创建阶段提交。

---

## M1 历史记录（当时状态；后续已获用户正常流程验收确认）

日期：2026-11-19

### 阶段门禁

- 用户已确认 M0 的 keyword 高亮、ProductList 折叠/展开、节点和连线详情均正常；结合此前实机单画布显示，M0 核心验收通过。
- 本轮进入 M1；未开展 M2 源码分析。

### M1 完成内容

- 新增四个真实 TSX demo 文件和 demo workspace 包。
- 固定唯一锚点生成 SourceRef，组件定义与使用分开，图与端口/边关联实际文件范围；所有手工关系继续 partial。
- 宿主 SourceRef 注册表、随机引用 ID、严格消息校验。
- 定位时检查真实路径位于 demo 和工作区内；校验磁盘摘要、内存摘要和同文档对象版本，拒绝过期引用。
- 详情增加定义、使用、声明、表达式、绑定定位入口；仅有效引用显示按钮；相邻编辑器选区定位与错误反馈。
- 手动重新加载演示重建引用，旧请求不能覆盖新图；保存刷新尚未实现。
- 调试入口更新为 UIFlow M1，并将仓库根目录作为宿主工作区。

### 实际检查

- pnpm install --offline --ignore-scripts：成功更新 workspace 链接和锁文件。首次沙箱内因 pnpm store symlink EPERM 失败，提升权限后成功。
- pnpm typecheck：通过。
- pnpm test：2 个文件，12 项全部通过（原 5 项和新增 7 项导航测试）。
- pnpm build：通过；仍有 React Flow use client 指令忽略警告。
- 通过本机 code --extensionTestsPath 在隔离的 Extension Development Host 运行 tests/integration/run.ts：通过。
- 实际选区检查：ProductList 定义、ProductList JSX 使用、keyword 声明、filtered-list 边绑定、list::products 端口绑定，五项均匹配精确源码，文档均非 dirty；未知 ID 和重载前 ID 拒绝。
- 集成结果：.test-output/m1-integration.json。此测试实际调用宿主导航服务和打开画布命令，未模拟 Webview 点击事件，不能替代完整 UI 按钮验收。

### M1 改动文件

- 新增 apps/demo-react/package.json、src/ProductPage.tsx、SearchInput.tsx、ProductList.tsx、ProductCard.tsx。
- 新增 apps/vscode-extension/src/source-map.ts、navigation.ts、navigation.test.ts；修改 src/extension.ts。
- 新增 packages/core/src/messages.ts；修改 packages/graph-ui/src/main.tsx。
- 新增 vitest.config.ts、tests/vscode-mock.ts、tests/integration/run.ts。
- 修改 tsconfig.json、pnpm-lock.yaml、scripts/build-extension.mjs、.vscode/launch.json、README.md、本文件。
- 新增 docs/decisions/0002-m1-source-navigation.md。

### 人工验证和剩余问题

1. 停止旧调试会话，在运行和调试中选择 UIFlow M1，按 F5。
2. 新宿主命令面板运行 UIFlow: 打开演示画布。
3. 点击 ProductList 的定义/使用定位、keyword 的声明定位、filtered 到 ProductList 边的绑定定位，检查相邻编辑器选区。
4. 修改 demo 后点击旧定位，应显示失效；重新加载演示后恢复，锚点被删或重复时明确报错。

- 验收状态：源码导航服务及安全测试通过；完整 UI → 消息桥 → 编辑器的按钮点击仍待人工复核，暂不进入 M2。
- 仅固定 demo 映射；不支持任意源码分析、保存刷新、自动布局、运行时数据或业务源码写入。
- 当前目录没有 Git 仓库，未创建阶段提交。

---
## M0 首轮历史记录（以下为当时状态）

日期：2026-11-19

### 已完成的实现

- pnpm workspace、精确版本依赖与锁文件；TypeScript strict。
- VS Code 命令 uiflow.openGraph、TSX 右键菜单、Webview 生命周期、本地资源 CSP 和 requestGraph 消息校验。
- 独立 IR、硬编码 fixture；示例证据统一 partial，无虚构 SourceRef、组件定义或定位入口。
- 同画布 parentId 嵌套、只读数据实线与回调/潜在更新虚线。
- 实现节点/边/端口详情、数据路径选择、折叠投影、缩放、平移、视觉位置拖动、重置。
- 修复尺寸变化导致布局反复重建的问题；仅位置变化更新布局，端口结构变化才重新测量。
- ADR-0001 与根 README 启动、验收说明。

### 已执行的检查与结果

- 环境：Node 22.12.0、pnpm 10.33.4。
- pnpm view @xyflow/react@12.8.1 peerDependencies --json：React 和 React DOM 要求 >=17，与所选 19.1.0 相容。
- pnpm install --ignore-scripts：成功，生成 pnpm-lock.yaml。
- 最终 pnpm typecheck：成功。
- 最终 pnpm test：1 个测试文件、5 项测试全部通过。覆盖数据/事件隔离、演示证据不作为 confirmed、折叠端点映射和恢复、最外层折叠、ID 隔离及循环终止。
- 最终 pnpm build：成功，生成插件和 Webview 资源。存在 React Flow 的 use client 指令被忽略警告。
- 已通过 VS Code Extension Development Host 命令打开 Webview；修复后实机截图与无障碍树确认可见 ProductPage、SearchInput、ProductList、ProductCard ×N、数据节点、蓝色数据边和橙色虚线。
- 已尝试点击 keyword，但窗口自动化多次出现 user input was detected in this window，一次 coordinate input geometry is unavailable；无法可靠确认点击结果，未将实机路径高亮和折叠验收记为通过。
- 未运行自动化 Extension Host 集成测试。

### 实机验收状态

- [x] 插件命令打开 Webview，图形实际显示。
- [x] 同屏可见嵌套容器与跨层箭头。
- [ ] 点击 keyword 后确认路径高亮及详情。
- [ ] 点击节点、端口与边，确认详情切换。
- [ ] 折叠/展开、缩放/平移、拖动与重置实机验证。
- [ ] 最终布局在常用窗口尺寸下确认无遮挡。

### 改动范围

- 根 package.json、pnpm-workspace.yaml、pnpm-lock.yaml、tsconfig.json、.npmrc、.gitignore。
- .vscode/launch.json、tasks.json；scripts/build-extension.mjs。
- apps/vscode-extension/package.json、src/extension.ts。
- packages/core/package.json、src/index.ts、fixture.ts、graph.test.ts。
- packages/graph-ui/package.json、index.html、vite.config.ts、src/main.tsx、projection.ts、style.css。
- README.md、docs/decisions/0001-m0-stack-and-canvas.md、本进度文件。

### 限制与下一步

- 当前为固定坐标演示；自由拖动可能产生新的交叉。未实现自动布局和多条汇总边合并，每个临时汇总端口计一条。
- 未开发 AST、源码定位、保存刷新、运行时采集或源码修改。
- 最低 VS Code 1.96 尚未实机验证；只验证本机安装版本。
- 当前目录不是 Git 仓库，未创建阶段提交。
- 按 README 的六步完成剩余 M0 手动验收；通过后才进入 M1。
