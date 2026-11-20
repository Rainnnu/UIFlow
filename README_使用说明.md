# 开始使用这套 UIFlow V1 开发资料

1. 将本文件夹中的 `AGENTS.md` 和 `docs/` 原样复制到新建的 UIFlow 仓库根目录。
2. 用 VS Code 打开该目录，并打开 Cursor、Claude Code 或 Codex。
3. 让 AI 阅读 `docs/UIFlow_V1_开发指导规范.md`、`AGENTS.md`。
4. 将规范第 **10.3 节的 M0 启动提示词**复制到 AI 对话中。
5. 每完成一个里程碑，要求 AI 更新 `docs/progress.md`，运行测试并演示验收。
6. 没有完成 M0 前，不要让 AI 转入 AST 静态分析；没有通过 M1 前，不要扩展复杂变量流追踪。

资料说明：
- `docs/UIFlow_V1_开发指导规范.md`：产品规范、图形语义、架构、里程碑、测试和 AI 提示词。
- `AGENTS.md`：可供 AI 开发代理直接读取的长期规则。
- `docs/progress.md`：开发进度追踪模板。
- `docs/decisions/`：重大设计决策记录。
