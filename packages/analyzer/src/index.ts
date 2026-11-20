import ts from 'typescript';
import { relative, isAbsolute, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectGraph, SourceRef, GraphNode } from '../../core/src/index';
import { DataFlow } from './data-flow';

export const inside = (root: string, file: string) => { const rel = relative(root, file); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\'); };
type Definition = ts.FunctionDeclaration | ts.VariableDeclaration;
function functionOf(node: ts.Node): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
  if (ts.isFunctionDeclaration(node) && node.body) return node;
  if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) return node.initializer;
}
function returnsOf(node: Definition): ts.Expression[] {
  const body = functionOf(node)?.body;
  if (!body) return [];
  if (!ts.isBlock(body)) return [body];
  return body.statements.filter(ts.isReturnStatement).flatMap(s => s.expression ? [s.expression] : []);
}
function containsJsx(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  if (ts.isFunctionLike(node)) return false;
  return ts.forEachChild(node, child => containsJsx(child) || undefined) === true;
}
export function analyzeProgram(program: ts.Program, entryFile: string, workspaceRoot: string, offset?: number, rootName?: string): ProjectGraph {
  const checker = program.getTypeChecker();
  const graph: ProjectGraph = { schemaVersion: 1, rootNodeIds: [], definitions: [], nodes: [], edges: [], diagnostics: [] };
  const source = program.getSourceFile(entryFile);
  if (!source) throw new Error('无法读取目标 TSX 文件。');
  const ref = (node: ts.Node, role: SourceRef['role']): SourceRef => {
    const sf = node.getSourceFile();
    return { uri: pathToFileURL(sf.fileName).toString(), start: sf.getLineAndCharacterOfPosition(node.getStart(sf)), end: sf.getLineAndCharacterOfPosition(node.getEnd()), role };
  };
  const diagnostic = (code: string, message: string, node?: ts.Node) => graph.diagnostics.push({ code, message, source: node ? ref(node, 'expression') : undefined });
  const candidates: Definition[] = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && returnsOf(statement).some(containsJsx)) candidates.push(statement);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (functionOf(declaration) && returnsOf(declaration).some(containsJsx)) candidates.push(declaration);
  }
  const exported = candidates.filter(n => ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export);
  const chosen = rootName !== undefined ? candidates.find(n => (n.name?.getText() ?? 'default') === rootName) : candidates.find(n => offset !== undefined && n.getStart() <= offset && offset <= n.getEnd()) ?? (exported.length === 1 ? exported[0] : candidates.length === 1 ? candidates[0] : undefined);
  if (!chosen) {
    diagnostic('ROOT_UNRESOLVED', rootName !== undefined ? '目标组件已删除或改名，请重新打开组件结构。' : candidates.length ? '当前文件含多个组件，请将光标放入目标函数组件后重试。' : '未找到受支持的函数组件返回值。', source);
    return graph;
  }
  const definitionId = (node: Definition) => `${pathToFileURL(node.getSourceFile().fileName)}#definition:${node.getStart()}:${node.getEnd()}`;
  const define = (node: Definition) => {
    const id = definitionId(node);
    if (!graph.definitions.some(d => d.id === id)) graph.definitions.push({ id, name: node.name?.getText() ?? 'default', source: ref(node, 'definition') });
    return id;
  };
  const safeDefinition = (tag: ts.JsxTagNameExpression): Definition | undefined => {
    let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(tag) ? tag.name : tag);
    const seen = new Set<ts.Symbol>();
    while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      if (symbol.declarations?.some(d => (ts.isImportSpecifier(d) && d.isTypeOnly) || (ts.isImportSpecifier(d) && ts.isImportClause(d.parent.parent) && d.parent.parent.isTypeOnly) || (ts.isImportClause(d) && d.isTypeOnly))) return;
      if (seen.has(symbol)) return; seen.add(symbol); symbol = checker.getAliasedSymbol(symbol);
    }
    if (!symbol || !(symbol.flags & ts.SymbolFlags.Value)) return;
    const declarations = symbol.declarations ?? [];
    if (declarations.length !== 1) return;
    const node = declarations[0]; const file = node.getSourceFile();
    if (!inside(workspaceRoot, file.fileName) || file.isDeclarationFile || /[/\\]node_modules[/\\]/.test(file.fileName)) return;
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && functionOf(node) && returnsOf(node).some(containsJsx)) return node;
  };
  const syntacticallyInvalid = new Set(program.getSyntacticDiagnostics().filter(d => d.file).map(d => d.file!.fileName));
  for (const issue of program.getSyntacticDiagnostics()) if (issue.file && inside(workspaceRoot, issue.file.fileName)) diagnostic('SYNTAX_ERROR', ts.flattenDiagnosticMessageText(issue.messageText, '\n'), issue.file);
  const rootId = `root:${definitionId(chosen)}`;
  const data = new DataFlow(graph, checker, ref, node => inside(workspaceRoot, node.getSourceFile().fileName) && !node.getSourceFile().isDeclarationFile && !/[/\\]node_modules[/\\]/.test(node.getSourceFile().fileName));
  graph.rootNodeIds.push(rootId);
  graph.nodes.push({ id: rootId, kind: 'component-use', label: chosen.name?.getText() ?? 'default', definitionId: define(chosen), ports: [], sourceRefs: [ref(chosen, 'definition')], confidence: 'confirmed' });
  const expand = (definition: Definition, parent: string, stack: Set<string>, depth: number) => {
    if (syntacticallyInvalid.has(definition.getSourceFile().fileName)) { diagnostic('SYNTAX_UNRESOLVED', '语法错误文件的组件内部未展开。', definition); return; }
    data.enter(functionOf(definition)!, parent);
    for (const expression of returnsOf(definition)) visit(expression, parent, stack, depth, []);
    const body = functionOf(definition)?.body;
    if (body && ts.isBlock(body) && body.statements.some(ts.isIfStatement)) diagnostic('RETURN_PARTIAL', '未追踪语句级条件返回；当前仅展示直接 return 中的 JSX。', definition);
  };
  const visit = (node: ts.Node, parent: string, stack: Set<string>, depth: number, notes: string[]): void => {
    if (graph.nodes.length >= 300 || depth > 16) { diagnostic('LIMIT_PARTIAL', '组件展开达到限制，剩余结构未展开。', node); return; }
    if (ts.isParenthesizedExpression(node)) return visit(node.expression, parent, stack, depth, notes);
    if (ts.isJsxExpression(node)) { if (node.expression) visit(node.expression, parent, stack, depth, notes); return; }
    if (ts.isJsxFragment(node)) { node.children.forEach(child => visit(child, parent, stack, depth, notes)); return; }
    if (ts.isConditionalExpression(node)) {
      visit(node.whenTrue, parent, stack, depth, [...notes, '条件分支']); visit(node.whenFalse, parent, stack, depth, [...notes, '条件分支']); return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return visit(node.right, parent, stack, depth, [...notes, '条件分支']);
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map' && node.arguments.length === 1 && (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]))) {
        const callback = node.arguments[0];
        // Recognize syntax template only; never infer actual array length or invocation.
        if (ts.isBlock(callback.body)) callback.body.statements.filter(ts.isReturnStatement).forEach(s => { if (s.expression) visit(s.expression, parent, stack, depth, [...notes, '模板 ×N（动态）']); });
        else visit(callback.body, parent, stack, depth, [...notes, '模板 ×N（动态）']);
      } else if (containsJsx(node) || node.arguments.some(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a))) diagnostic('CALL_UNRESOLVED', '调用表达式中的组件结构未追踪。', node);
      return;
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const name = opening.tagName.getText();
      const intrinsic = ts.isIdentifier(opening.tagName) && /^[a-z]/.test(name);
      const region = intrinsic && ['main', 'section', 'article'].includes(name);
      let owner = parent;
      if (!intrinsic || region) {
        const id = `${parent}/use:${pathToFileURL(node.getSourceFile().fileName)}:${node.getStart()}:${node.getEnd()}`;
        const definition = intrinsic ? undefined : safeDefinition(opening.tagName);
        const model: GraphNode = { id, parentId: parent, kind: region ? 'jsx-region' : 'component-use', label: `${name}${notes.includes('模板 ×N（动态）') ? ' ×N（动态）' : ''}${notes.includes('条件分支') ? ' · 条件分支' : ''}`, ports: [], sourceRefs: [ref(node, 'usage')], confidence: intrinsic || definition ? 'confirmed' : 'unresolved', notes: [...notes] };
        for (const attribute of opening.attributes.properties) if (ts.isJsxAttribute(attribute)) model.ports.push({ id: attribute.name.getText(), name: attribute.name.getText(), kind: 'value-in', sourceRefs: [ref(attribute, 'binding')] });
        graph.nodes.push(model); owner = id;
        if (definition && syntacticallyInvalid.has(definition.getSourceFile().fileName)) model.confidence = 'partial';
        data.bind(opening, model, parent);
        if (definition) {
          if (syntacticallyInvalid.has(definition.getSourceFile().fileName)) model.confidence = 'partial';
          model.definitionId = define(definition); model.sourceRefs.push(ref(definition, 'definition'));
          const key = definitionId(definition);
          if (stack.has(key)) { model.confidence = 'partial'; model.notes!.push('递归组件，内部未展开'); diagnostic('RECURSION_PARTIAL', '递归组件仅显示当前使用位置。', node); }
          else { const next = new Set(stack); next.add(key); expand(definition, id, next, depth + 1); }
        } else if (!intrinsic) diagnostic('COMPONENT_UNRESOLVED', `暂无法解析组件：${name}`, node);
      }
      if (ts.isJsxElement(node)) node.children.forEach(child => visit(child, owner, stack, depth + 1, notes));
      return;
    }
    // Do not descend arbitrary functions or variables and accidentally report JSX as rendered.
    if (ts.isJsxText(node) || ts.isIdentifier(node) || ts.isLiteralExpression(node) || node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return;
    if (containsJsx(node)) diagnostic('EXPRESSION_UNRESOLVED', '当前返回表达式中的 JSX 结构暂不支持。', node);
  };
  expand(chosen, rootId, new Set([definitionId(chosen)]), 0);
  if (syntacticallyInvalid.has(source.fileName)) graph.nodes[0].confidence = 'partial';
  return graph;
}

export function analyzeFile(entry: string, root: string, overlays = new Map<string, string>(), offset?: number, rootName?: string) {
  entry = resolve(entry); root = resolve(root);
  if (!inside(root, entry) || !entry.endsWith('.tsx')) throw new Error('请选择当前工作区内的 TSX 文件。');
  const captured = new Map<string, string>();
  const read = (file: string) => { const text = overlays.get(resolve(file)) ?? ts.sys.readFile(file); if (text !== undefined && inside(root, file) && !/[/\\]node_modules[/\\]/.test(file)) captured.set(resolve(file), text); return text; };
  let options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true, skipLibCheck: true };
  const config = ts.findConfigFile(dirname(entry), ts.sys.fileExists);
  if (config && inside(root, config)) {
    const result = ts.readConfigFile(config, read); if (result.error) throw new Error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(result.config, { ...ts.sys, readFile: read }, dirname(config));
    const errors = parsed.errors.filter(d => d.code !== 18003);
    if (errors.length) throw new Error(ts.flattenDiagnosticMessageText(errors[0].messageText, '\n'));
    options = { ...options, ...parsed.options, noEmit: true };
  }
  const host = ts.createCompilerHost(options); host.readFile = read;
  host.writeFile = () => { throw new Error('静态分析禁止写入源码。'); };
  const program = ts.createProgram([entry], options, host);
  return { graph: analyzeProgram(program, entry, root, offset, rootName), captured };
}
