import ts from 'typescript';
import type { GraphNode, GraphEdge, ProjectGraph, SourceRef } from '../../core/src/index';

type Fn = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
interface Scope { owner: string; fn: Fn; values: Map<ts.Symbol, GraphNode> }
export class DataFlow {
  private scopes = new Map<string, Scope>();
  constructor(private graph: ProjectGraph, private checker: ts.TypeChecker, private ref: (node: ts.Node, role: SourceRef['role']) => SourceRef, private local: (node: ts.Node) => boolean) {}
  private report(node: ts.Node, message: string) { this.graph.diagnostics.push({ code: 'DATA_UNRESOLVED', message, source: this.ref(node, 'expression') }); }
  private add(scope: Scope, name: ts.Identifier, kind: GraphNode['kind'], source: ts.Node): GraphNode {
    const symbol = this.checker.getSymbolAtLocation(name)!;
    const previous = scope.values.get(symbol); if (previous) return previous;
    const node: GraphNode = { id: `${scope.owner}/data:${source.getSourceFile().fileName}:${source.getStart()}:${name.getStart()}:${kind}`, label: name.text, kind, parentId: scope.owner, ports: [{ id: 'in', name: 'in', kind: 'value-in', sourceRefs: [this.ref(source, 'declaration')] }, { id: 'out', name: 'out', kind: 'value-out', sourceRefs: [this.ref(source, 'declaration')] }], sourceRefs: [this.ref(source, 'declaration')], confidence: 'confirmed' };
    this.graph.nodes.push(node); if (symbol) scope.values.set(symbol, node); return node;
  }
  private edge(kind: GraphEdge['kind'], source: GraphEdge['source'], target: GraphEdge['target'], evidence: ts.Node) {
    this.graph.edges.push({ id: `edge:${kind}:${source.nodeId}:${source.portId}:${target.nodeId}:${target.portId}:${evidence.getStart()}`, kind, source, target, confidence: 'confirmed', sourceRefs: [this.ref(evidence, kind === 'prop-pass' || kind === 'callback-bind' ? 'binding' : 'expression')], notes: kind === 'state-write' ? ['已知 setter 的潜在更新关系，不代表实际调用'] : kind === 'callback-bind' ? ['回调绑定，不代表事件已发生'] : undefined });
  }
  private reactState(call: ts.CallExpression): boolean {
    const callee = call.expression;
    let hook = this.checker.getSymbolAtLocation(ts.isPropertyAccessExpression(callee) ? callee.name : callee);
    if (hook && hook.flags & ts.SymbolFlags.Alias) hook = this.checker.getAliasedSymbol(hook);
    if (!hook?.declarations?.some(d => d.getSourceFile().isDeclarationFile && /[/\\]node_modules[/\\](?:@types[/\\])?react[/\\]/.test(d.getSourceFile().fileName))) return false;
    const fromReact = (node: ts.Node | undefined) => !!node && ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react';
    if (ts.isIdentifier(callee)) {
      const declarations = this.checker.getSymbolAtLocation(callee)?.declarations;
      return !!declarations?.some(d => ts.isImportSpecifier(d) && !d.isTypeOnly && (d.propertyName ?? d.name).text === 'useState' && ts.isImportClause(d.parent.parent) && !d.parent.parent.isTypeOnly && fromReact(d.parent.parent.parent));
    }
    if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'useState' && ts.isIdentifier(callee.expression)) {
      return !!this.checker.getSymbolAtLocation(callee.expression)?.declarations?.some(d => (ts.isNamespaceImport(d) && !d.parent.isTypeOnly && fromReact(d.parent.parent)) || (ts.isImportClause(d) && !d.isTypeOnly && fromReact(d.parent)));
    }
    return false;
  }
  private scopeFor(node: ts.Node, parent: string): Scope | undefined {
    let id: string | undefined = parent;
    while (id) {
      const scope = this.scopes.get(id);
      if (scope && scope.fn.getSourceFile() === node.getSourceFile() && node.pos >= scope.fn.pos && node.end <= scope.fn.end) return scope;
      id = this.graph.nodes.find(n => n.id === id)?.parentId;
    }
  }
  private resolve(scope: Scope, name: ts.Identifier): GraphNode | undefined {
    let symbol = this.checker.getSymbolAtLocation(name); if (!symbol) return;
    if (scope.values.has(symbol)) return scope.values.get(symbol);
    // Only simple module constants and direct local functions; no closure/alias inference.
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol);
    const declaration = symbol.valueDeclaration;
    if (!declaration || !this.local(declaration)) return;
    if (ts.isFunctionDeclaration(declaration) && declaration.parent === scope.fn.body && declaration.name) return this.add(scope, declaration.name, 'handler', declaration);
    if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.initializer && ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
      const statement = declaration.parent.parent;
      if (ts.isVariableStatement(statement) && statement.parent === scope.fn.body && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) return this.add(scope, declaration.name, 'handler', declaration);
      if (ts.isVariableStatement(statement) && ts.isSourceFile(statement.parent) && (ts.isArrayLiteralExpression(declaration.initializer) || ts.isObjectLiteralExpression(declaration.initializer) || ts.isLiteralExpression(declaration.initializer))) {
        const value = this.add(scope, declaration.name, 'value', declaration);
        scope.values.set(this.checker.getSymbolAtLocation(name)!, value); return value;
      }
    }
  }
  private safe(expression: ts.Node): boolean {
    if (ts.isElementAccessExpression(expression) || ts.isAwaitExpression(expression) || ts.isNewExpression(expression) || ts.isComputedPropertyName(expression) || ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return false;
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && expression.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return false;
    if ((ts.isPrefixUnaryExpression(expression) || ts.isPostfixUnaryExpression(expression)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(expression.operator)) return false;
    if (ts.isFunctionLike(expression)) {
      const parent = expression.parent;
      if (!(ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) || !ts.isCallExpression(parent) || !ts.isPropertyAccessExpression(parent.expression) || !['filter', 'map'].includes(parent.expression.name.text)) return false;
    }
    let safe = true; ts.forEachChild(expression, child => { if (!this.safe(child)) safe = false; }); return safe;
  }
  private reads(scope: Scope, expression: ts.Node): GraphNode[] {
    const values = new Map<string, GraphNode>();
    const walk = (node: ts.Node) => {
      if (ts.isIdentifier(node)) {
        const parent = node.parent;
        if ((ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isParameter(parent)) || ts.isTypeNode(parent)) return;
        const value = this.resolve(scope, node); if (value && value.kind !== 'handler') values.set(value.id, value);
      }
      ts.forEachChild(node, walk);
    };
    walk(expression); return [...values.values()];
  }
  enter(fn: Fn, owner: string) {
    const scope: Scope = { owner, fn, values: new Map() }; this.scopes.set(owner, scope);
    const model = this.graph.nodes.find(n => n.id === owner)!;
    for (const parameter of fn.parameters) {
      if (!ts.isObjectBindingPattern(parameter.name)) { if (ts.isIdentifier(parameter.name)) this.report(parameter, '暂未追踪对象参数属性；支持简单 Props 解构。'); continue; }
      for (const element of parameter.name.elements) {
        if (!ts.isIdentifier(element.name) || element.dotDotDotToken || element.initializer || (element.propertyName && !ts.isIdentifier(element.propertyName))) { this.report(element, '复杂 Props 解构未追踪。'); continue; }
        const portId = element.propertyName?.getText() ?? element.name.text;
        if (!model.ports.some(p => p.id === portId)) model.ports.push({ id: portId, name: portId, kind: 'value-in', sourceRefs: [this.ref(element, 'declaration')] });
        const value = this.add(scope, element.name, 'value', element);
        this.edge('data-read', { nodeId: owner, portId }, { nodeId: value.id, portId: 'in' }, element);
      }
    }
    const body = fn.body;
    if (!body || !ts.isBlock(body)) return;
    const declarations = body.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.flags & ts.NodeFlags.Const ? [...s.declarationList.declarations] : []);
    const derived: Array<{ declaration: ts.VariableDeclaration; node: GraphNode }> = [];
    for (const declaration of declarations) {
      const initializer = declaration.initializer; if (!initializer) continue;
      if (ts.isArrayBindingPattern(declaration.name)) {
        const [state, setter] = declaration.name.elements;
        if (declaration.name.elements.length === 2 && state && setter && ts.isBindingElement(state) && ts.isIdentifier(state.name) && !state.initializer && !state.dotDotDotToken && ts.isBindingElement(setter) && ts.isIdentifier(setter.name) && !setter.initializer && !setter.dotDotDotToken && ts.isCallExpression(initializer) && this.reactState(initializer)) {
          const value = this.add(scope, state.name, 'state', declaration); const handler = this.add(scope, setter.name, 'handler', declaration);
          handler.notes = ['React useState setter；只表达潜在更新'];
          handler.ports.find(port => port.id === 'out')!.kind = 'state-setter';
          this.edge('state-write', { nodeId: handler.id, portId: 'out' }, { nodeId: value.id, portId: 'in' }, declaration);
        } else this.report(declaration, '未确认的解构或非 React useState，未生成状态更新关系。');
        continue;
      }
      if (!ts.isIdentifier(declaration.name)) { this.report(declaration, '复杂变量解构未追踪。'); continue; }
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) continue;
      const value = this.add(scope, declaration.name, 'value', declaration);
      if (!this.safe(initializer) || (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression) && /^use[A-Z]/.test(initializer.expression.text))) {
        value.confidence = 'partial'; this.report(initializer, `暂无法追踪 ${value.label} 的完整依赖。`); continue;
      }
      derived.push({ declaration, node: value });
    }
    for (const { declaration, node } of derived) {
      if (ts.isIdentifier(declaration.initializer!) && this.resolve(scope, declaration.initializer as ts.Identifier)?.kind === 'handler') {
        node.confidence = 'partial'; this.report(declaration, '回调别名未追踪。'); continue;
      }
      const initializer = declaration.initializer!; const reads = this.reads(scope, initializer).filter(n => n.id !== node.id && n.confidence === 'confirmed');
      if (!reads.length) continue;
      const transform: GraphNode = { id: `${node.id}/expression`, label: ts.isCallExpression(initializer) && ts.isPropertyAccessExpression(initializer.expression) ? `${initializer.expression.name.text}()` : '表达式', kind: 'transform', parentId: owner, ports: [{ id: 'in', name: 'in', kind: 'value-in', sourceRefs: [this.ref(initializer, 'expression')] }, { id: 'out', name: 'out', kind: 'value-out', sourceRefs: [this.ref(initializer, 'expression')] }], sourceRefs: [this.ref(initializer, 'expression')], confidence: 'confirmed' };
      this.graph.nodes.push(transform);
      for (const read of reads) this.edge('data-read', { nodeId: read.id, portId: 'out' }, { nodeId: transform.id, portId: 'in' }, initializer);
      this.edge('derive', { nodeId: transform.id, portId: 'out' }, { nodeId: node.id, portId: 'in' }, initializer);
    }
  }
  bind(opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement, model: GraphNode, lexicalParent: string) {
    const scope = this.scopeFor(opening, lexicalParent); if (!scope) return;
    if (model.confidence !== 'confirmed') { this.report(opening, '组件未解析，未生成确定的 Props 连接。'); return; }
    const hasSpread = opening.attributes.properties.some(ts.isJsxSpreadAttribute);
    if (hasSpread) { this.report(opening, '展开属性可能覆盖 Props；本节点绑定未确认为数据边。'); return; }
    for (const attribute of opening.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) continue;
      const expression = attribute.initializer.expression;
      if (!ts.isIdentifier(expression)) { this.report(attribute, '当前仅追踪简单标识符 Props 绑定。'); continue; }
      const source = this.resolve(scope, expression); if (!source || source.confidence !== 'confirmed') { this.report(attribute, 'Props 来源暂无法解析。'); continue; }
      const portId = attribute.name.getText();
      if (opening.attributes.properties.filter(a => ts.isJsxAttribute(a) && a.name.getText() === portId).length > 1) { this.report(attribute, '重复 Props 绑定未追踪。'); continue; }
      if (source.kind === 'handler') {
        const port = model.ports.find(p => p.id === portId)!; port.kind = 'callback';
        this.edge('callback-bind', { nodeId: model.id, portId }, { nodeId: source.id, portId: 'in' }, attribute);
      } else if (this.checker.getTypeAtLocation(expression).getCallSignatures().length) this.report(attribute, '间接回调绑定未追踪。');
      else this.edge('prop-pass', { nodeId: source.id, portId: 'out' }, { nodeId: model.id, portId }, attribute);
    }
  }
}
