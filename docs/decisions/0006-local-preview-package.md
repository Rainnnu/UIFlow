# ADR-0006：本地 VSIX 预览与安装边界

- 状态：接受，非 Marketplace 发布。
- 日期：2026-11-19
- 构建：固定 @vscode/vsce 4.1.1（Node >=22），每次创建独立 .test-output/package-* 暂存目录。仅收集 extension.cjs、Webview、README、固定示例、TypeScript 运行时及许可证；不复制整个仓库或用户项目。
- 依赖：将真实 TypeScript 包复制为普通 node_modules/typescript，使用 npm 生产依赖检测打包；不把 pnpm 符号链接或集成测试入口带入 VSIX。包内编译器和标准库由安装测试验证。
- 来源与演示：包内提供 samples/demo-react；开发模式仍使用原 demo。示例未属于当前工作区时，只给 partial 演示图，不生成定位引用，避免为演示绕过工作区边界。
- 信任：根据静态只读、不执行工作区模块/脚本的实际行为，声明支持 Restricted Mode；不更改用户的信任设置。virtualWorkspaces=false，当前仅支持本地文件。
- 许可：收集所用运行依赖的上游许可证到 THIRD_PARTY_NOTICES.md，保留 TypeScript 自带许可/第三方声明。自身本地包用 UNLICENSED，未自行替用户选择开源许可。公开发布仍需名称与许可决策。
- 审计：新增 vsce 后 minimatch 10 带来一条拒绝服务公告，以作用于 vsce 的精确 override 升至 11.0.1；打包再次成功，完整 audit 为 0 条公告。
- 验证：VSIX 实际安装到隔离扩展目录；包内运行时/资源/命令激活通过。最初用独立测试驱动作为待测扩展时 API 中未包含 UIFlow，未算通过；改为以安装目录为待测目录后通过。另在完全不带开发宿主参数的普通窗口中确认安装版命令、真实分析图和折叠，避免把开发宿主测试冒充普通安装。
- UI：对安装产物实机观察搜索、keyword 选中、仅追踪路径、源码按钮跳转、暗色/浅色/暗色高对比主题。未将一次拖动端点截图当作连续无抖动证明，沿用此前用户确认与拖动回归。
- 交付：artifacts/uiflow-0.0.1.vsix 及 sha256。没有上传 Marketplace，没有生成签名或声称最低 VS Code 1.96 已实测。
