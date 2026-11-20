# UIFlow V1 · 静态分析预览

V1 源码基线：单画布组件嵌套、静态数据依赖追踪、源码定位和保存刷新。当前扩展版本为 `0.0.1`，发布边界与未验证项见 `docs/release-checklist.md`；不将预览基线标为正式稳定版。

VS Code Webview 中的组件结构与静态数据依赖探索原型。M3 从当前 TSX 解析组件包含、简单 State/派生值/Props/回调关系，支持追踪与源码定位。M1 硬编码图保留为“打开演示画布”命令，真实图不混入演示数据。

## 本地安装预览版

安装包：`artifacts/uiflow-0.0.1.vsix`，同目录提供 SHA-256 校验文件。

在 VS Code 扩展面板右上角 `…` 中选择 **Install from VSIX… / 从 VSIX 安装…**，选中该文件。也可在本地终端执行：

```powershell
code --install-extension .\artifacts\uiflow-0.0.1.vsix
```

安装后直接打开本地 React 工作区的 TSX，运行 **UIFlow: 查看当前组件结构**，不需要 F5。需要项目已安装 React 类型依赖，才能确认 React useState 符号。插件不自动安装依赖或运行项目脚本。

VSIX 带有 TypeScript 运行时与标准库、Webview 资源和 `samples/demo-react` 示例；不依赖本仓库的 node_modules。示例可手动复制到本地工作区并自行安装依赖。演示源码不在工作区时，只显示演示图并停用源码定位。包内 `THIRD_PARTY_NOTICES.md` 提供第三方许可文本。

当前为本地预览包，包内标记为 UNLICENSED，未授予开源许可、未上传 Marketplace。正式名称/许可和最低 VS Code 版本测试仍待完成。

重新打包需 Node 22 及以上：

```powershell
pnpm package
```

打包使用固定版官方 @vscode/vsce 和全新暂存目录，检查并包含生产依赖；不收集业务源码、测试输出或项目配置凭据。

## 开发

已验证环境：Node 22.12.0、pnpm 10.33.4。VS Code 最低版本声明为 1.96（该最低版本本身尚未实机验证）。

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm build
```

用 VS Code 打开仓库根目录，按 Ctrl+Shift+D，在顶部下拉框选择 `UIFlow M4`，再按 F5。调试配置先构建，并打开仓库作为宿主工作区；Webview 使用本地资源。旧调试会话需要先停止。

## M4 刷新与视图验收

1. 打开 ProductPage.tsx 并运行 `UIFlow: 查看当前组件结构`。编辑相关源码后旧定位立即失效；保存后自动重建，不必点击刷新。
2. 将 `<ProductList products={filtered}/>` 的绑定改为 `products={products}` 并保存，确认箭头来源改变。删除不再使用的变量并保存，节点应消失，旧入口不能跳到其他行。建议在源码副本中试验。
3. 多个组件的文件刷新保持原目标；目标改名/删除会显示诊断，重新运行打开命令选定新组件。
4. 搜索组件/变量名，筛选保留匹配节点及祖先；选中变量后可开启“仅追踪路径”。清除筛选恢复全图。“全部展开”和各节点折叠按钮控制复杂度。
5. 深层组件默认折叠，map 仍是 ×N 模板；展开后回归拖动和重置。搜索时匹配祖先临时展开，清除搜索恢复原折叠。
6. 切换 VS Code 深浅/高对比主题，检查工具栏、端口、边与详情的对比度。失败或空文件应显示简洁状态；刷新可重试。

也可从命令面板运行 `UIFlow: 刷新当前图`。自动刷新只针对已读取依赖；新增未被读取的依赖文件可手动刷新。未逐字符分析，不上传源码，不执行被分析项目脚本。

M4 真实宿主测试入口：构建后的 `apps/vscode-extension/dist/refresh-integration.cjs`，结果 `.test-output/m4-integration.json`。只修改新建的临时测试副本；原始 fixture 和 demo 保持不变。安装包运行检查入口为 `installed-integration.cjs`，结果 `.test-output/installed-integration.json`；该驱动必须以已安装扩展目录作为待测目录。普通安装的命令与画布另有实机复核。发布检查见 `docs/release-checklist.md`；未发布 Marketplace。

## M3 数据依赖验收

1. 新宿主打开 `apps/demo-react/src/ProductPage.tsx`，光标置于函数内，运行 `UIFlow: 查看当前组件结构`。若编辑后的 demo 使用了未支持写法，可用固定 `tests/fixtures/m1/ProductPage.tsx`。
2. 同一画布中确认组件嵌套仍在，新增 keyword、setKeyword、products、filtered、filter() 等数据节点；蓝色实线与橙色虚线语义区分。
3. 单击 keyword，检查 keyword → filter() → filtered → ProductList.products 以及 keyword → SearchInput.value 的高亮；Props 解构可继续到内部值。不可仅因包含关系就高亮 ProductCard。
4. 单击 SearchInput 的回调绑定虚线，查看单独的回调绑定/潜在更新路径；不能解释为事件已执行或实际 React rerender。
5. 点击状态和派生值的声明、Transform 表达式、蓝色边及虚线边的定位按钮，应选中各自源码。修改源码后旧引用仍须失效，保存或手动刷新重建。
6. 回归拖动父子节点、折叠展开和重置，确认坐标不抖动，数据和结构均只读。

M3 支持简单 React useState 解构、const 派生表达式、简单 Props 解构与标识符绑定。动态属性、spread 覆盖、setter 别名、复杂闭包、map item 属性别名和复杂 Hook 安全降级。每条 confirmed 边有 SourceRef，静态依赖不等于实际 rerender。

真实宿主测试入口：构建后的 `apps/vscode-extension/dist/data-integration.cjs`；结果写入 `.test-output/m3-integration.json`，验证全部 confirmed 边定位及源码不变。它不模拟实际画布点击。

## M2 结构分析验收

1. 在新扩展开发宿主打开 `apps/demo-react/src/ProductPage.tsx`，光标放入 ProductPage 函数；右键选择 `UIFlow: 查看当前组件结构`，或从命令面板运行同名命令。
2. 确认 ProductPage → main（jsx-region）内有 SearchInput 和 ProductList，ProductList → section 内有 ProductCard ×N 模板；包含关系不画箭头。M3 新增的箭头只表示有证据的语义关系。
3. 点击 ProductList，分别跳转组件定义与 JSX 使用位置；点击 products 端口定位 Props 绑定。
4. 若要使用不受 demo 编辑影响的固定样例，打开 `tests/fixtures/m1/ProductPage.tsx`。
5. 自行注释一个 JSX 使用位置并保存，对应节点应自动消失；旧图定位应拒绝过期引用，也可手动刷新。
6. 同组件在两个 JSX 位置使用时形成两个节点、共享同一定义；未知组件显示 unresolved 和诊断；条件与 map 不推断运行时实例数或可见性。

支持直接函数组件、const 箭头函数、直接跨文件 import/export 和别名。多个组件的文件优先使用光标上下文；无法唯一选择时给出提示。复杂动态写法安全降级，详见 ADR-0003。组件数量/展开深度有限制；布局仅表示结构。

M2 实机集成入口为构建后的 `apps/vscode-extension/dist/structure-integration.cjs`，用 `--extensionTestsPath` 在独立 Extension Development Host 运行，结果写入 `.test-output/m2-integration.json`。该测试会检查真实 AST 输出、定义/使用/端口的编辑器选区及源码字节不变，不覆盖实际 UI 点击。

## M1 源码定位验收

1. 单击 ProductList，详情中分别点击“跳转组件定义”“跳转 JSX 使用位置”，应在相邻编辑器选中 ProductList.tsx 的函数声明头、ProductPage.tsx 的 JSX。
2. 单击 keyword，再点击“跳转声明”，应选中 useState 解构声明。
3. 单击 filtered → ProductList 的蓝色边，再点击“跳转绑定”，应选中 `products={filtered}`。ProductList.products 端口也应定位同一绑定。
4. 修改 demo 后再点击旧定位，必须提示旧引用失效；点击“重新加载演示”后重新建立固定映射。若删除了固定锚点，会报无法定位；恢复源码后可重新加载。本轮不自动追踪修改后的语义。
5. demo 必须位于当前工作区中；工作区为空或移除 demo 所在文件夹时应显示限制。插件不提供源码写操作。

已提供 `tests/integration/run.ts`，构建为插件 dist/integration.cjs。可使用本机 VS Code 的 `--extensionTestsPath`、独立 `--user-data-dir` 和 `--extensionDevelopmentPath` 参数运行；结果写入 `.test-output/m1-integration.json`。运行前创建 `.test-output` 目录，并以仓库根目录作为测试工作区。

## M0 手动验收

1. 打开演示画布，确认 ProductPage 包含 SearchInput 与 ProductList，ProductList 包含 ProductCard ×N 模板；同时能看见跨组件边界的蓝色箭头和橙色虚线。
2. 单击 keyword 节点主体，检查 keyword → filter() → filtered → ProductList.products 与 keyword → SearchInput.value 高亮；setter、products 和 ProductCard 不应被当成 keyword 的直接数据下游。
3. 单击虚线和蓝色边，详情应显示各自的语义类型、端点与 partial 演示状态；不得出现“事件已发生”或实际 rerender 的结论。
4. 点击 ProductList 标题的减号折叠，ProductCard 隐藏，products 输入边保留；再次展开恢复。折叠 ProductPage 后仅保留根容器，展开恢复全图。
5. 使用左下角缩放和适配按钮、拖动空白处平移，拖动节点调整视觉位置。点击“重置视图”恢复布局与展开状态。
6. 单击端口查看详情；确认不能拖出新连接、重接边或用 Delete 删除语义节点。图形操作不会写入源码。

## 工程结构与限制

- `apps/vscode-extension`：命令、Webview 生命周期和受限消息桥。
- `packages/core`：独立 IR、演示 fixture、静态路径遍历。
- `packages/analyzer`：TypeScript Program、符号解析、结构与数据依赖 IR 输出。
- `packages/graph-ui`：React Flow 渲染、折叠投影和详情。
- `docs/progress.md`：真实检查结果和验收状态。

M1 命令仍依赖固定源码锚点，修改格式后可能失效；此时使用 M2 的真实结构命令。硬编码图继续标记 partial，不作为 confirmed 分析结论。未关联来源的端口没有定位按钮。×N 表示代码模板，数量未知。小窗口可收起 VS Code 两侧栏。

构建会报告 React Flow 的 `use client` 指令被忽略；本项目为客户端 Webview，构建成功。当前目录未初始化 Git，因此没有创建阶段提交。
