import * as ts from "typescript";
import * as path from "path";

interface Import {
    module: string;
    variable: string;
}

export class LuaVisitor {
    private result = "";
    private imports: Import[] = [];
    private addonNameVariable: string;
    private addonVariable: string;
    private addonModule: string;
    private importedVariables: {[name:string]: string} = {};
    public errors:string[] = [];
    
    constructor(private sourceFile: ts.SourceFile)  {}

    getResult() {
        if (this.imports.length > 0) {
            if (!this.addonNameVariable) this.addonNameVariable = "__addonName";
            if (!this.addonVariable) this.addonVariable = "__addon";
            this.result = `require(${this.addonNameVariable}, ${this.addonVariable}, "${path.basename(this.sourceFile.fileName, ".ts")}", { "${this.imports.map(x => x.module).join("\", \"")}" }, function(__exports, ${this.imports.map(x => x.variable).join(", ")})
${this.result}end))
`;
        }
        if (this.addonNameVariable != undefined) {
            this.result = `local ${this.addonNameVariable}, ${this.addonVariable} = ...
${this.result}`;
        }
        return this.result;
    }

    writeTabs(tabs: number) {
        for (let i = 0; i < tabs; i++) this.result += "    ";
    }

    addError(node: ts.Node) { 
        this.addTextError(node, `Unsupported node ${ts.SyntaxKind[node.kind]}`);
    }

    addTextError(node: ts.Node, text: string) {
        const position = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
        this.errors.push(`${text} in ${this.sourceFile.fileName}:${position.line + 1}:${position.character + 1}`);
    }

    writeArray<T extends ts.Node>(array: ts.NodeArray<T>, tabs: number, parent: ts.Node, separator: string = ", ") {
        for(let i = 0; i<array.length; i++) {
            if(i> 0) this.result += separator;
            this.traverse(array[i], tabs, parent);
        }
    }

    public traverse(node: ts.Node, tabs: number, parent: ts.Node | undefined, options?: { elseIf?: boolean, callee?: boolean, class?: string }) {
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
                const arrayBindingPattern = <ts.ArrayBindingPattern>node;
                this.writeArray(arrayBindingPattern.elements, tabs, node);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                const arrayLiteralExpression = <ts.ArrayLiteralExpression>node;
                this.writeArray(arrayLiteralExpression.elements, tabs, node);
                break;
            case ts.SyntaxKind.BinaryExpression:
                const binary = <ts.BinaryExpression>node;
                this.traverse(binary.left, tabs, node);
                switch (binary.operatorToken.kind) {
                    case ts.SyntaxKind.AmpersandAmpersandToken:
                        this.result += " and ";
                        break;
                    case ts.SyntaxKind.AsteriskToken:
                        this.result += " * ";
                        break;
                    case ts.SyntaxKind.BarBarToken:
                        this.result += " or ";
                        break;
                    case ts.SyntaxKind.CaretToken:
                        this.result += " ^ ";
                        break;
                    case ts.SyntaxKind.EqualsToken:
                        this.result += " = ";
                        break;
                    case ts.SyntaxKind.EqualsEqualsToken:
                        this.result += " == ";
                        break;
                    case ts.SyntaxKind.ExclamationEqualsToken:
                        this.result += " ~= ";
                        break;
                    case ts.SyntaxKind.GreaterThanToken:
                        this.result += " > ";
                        break;
                    case ts.SyntaxKind.GreaterThanEqualsToken:
                        this.result += " >= ";
                        break;
                    case ts.SyntaxKind.LessThanToken:
                        this.result += " < ";
                        break;
                    case ts.SyntaxKind.LessThanEqualsToken:
                        this.result += " <= ";
                        break;
                    case ts.SyntaxKind.MinusToken:
                        this.result += " - ";
                        break;
                    case ts.SyntaxKind.PercentToken:
                        this.result += " % ";
                        break;
                    case ts.SyntaxKind.PlusToken:
                        this.result += " + ";
                        break;
                    case ts.SyntaxKind.SlashToken:
                        this.result += " / ";
                        break;
                    default:
                        this.addError(binary.operatorToken);
                        this.result += `{Binary ${ts.SyntaxKind[binary.operatorToken.kind]}}`;
                        break;                
                }
                this.traverse(binary.right, tabs, node);
                break;
            case ts.SyntaxKind.BindingElement:
                const bindingElement = <ts.BindingElement>node;
                this.traverse(bindingElement.name, tabs, node);
                break;
            case ts.SyntaxKind.Block:
                const block = <ts.Block>node;
                if (parent && (parent.kind == ts.SyntaxKind.Block || parent.kind == ts.SyntaxKind.SourceFile)) {
                    this.writeTabs(tabs);
                    this.result += "do\n";
                    node.forEachChild(x => this.traverse(x, tabs + 1, node));
                    this.writeTabs(tabs);
                    this.result += "end\n";
                }
                else {
                    node.forEachChild(x => this.traverse(x, tabs, node));
                }
                break;
            case ts.SyntaxKind.BreakStatement:
                this.writeTabs(tabs);
                this.result += "break\n";
                break;
            case ts.SyntaxKind.CallExpression:
                const callExpression = <ts.CallExpression>node;
                if (callExpression.expression.getText() === "lualength") {
                    this.result += "#";
                    this.writeArray(callExpression.arguments, tabs, node);
                }
                else {
                    this.traverse(callExpression.expression, tabs, node, { callee: true });
                    this.result += "(";
                    this.writeArray(callExpression.arguments, tabs, node);
                    this.result += ")";
                }
                break;
            case ts.SyntaxKind.ClassDeclaration:
                const classExpression = <ts.ClassDeclaration>node;
                let className: string|undefined = undefined;
                if (classExpression.name) {
                    this.result += "local ";
                    this.traverse(classExpression.name, tabs, node);
                    className = classExpression.name.text;
                    this.result += " = ";
                }
                this.result += "__class(";
                if (classExpression.heritageClauses) {
                    for (const heritage of classExpression.heritageClauses) {
                        if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                            this.writeArray(heritage.types, tabs, node);
                        }
                    }
                }
                this.result += ")\n";
                for (const member of classExpression.members) {
                    if (member.kind === ts.SyntaxKind.PropertyDeclaration) continue;
                    this.traverse(member, tabs, node, { class: className });
                }
                break;
            case ts.SyntaxKind.ComputedPropertyName:
                const computedPropertyName = <ts.ComputedPropertyName>node;
                this.result += "[";
                this.traverse(computedPropertyName.expression, tabs, node);
                this.result += "]";
                break;
            case ts.SyntaxKind.Constructor:
                {
                    const constr = <ts.ConstructorDeclaration>node;
                    this.result += "function ";
                    const parentClassDeclaration = <ts.ClassDeclaration>parent;
                    if (parentClassDeclaration.name) this.traverse(parentClassDeclaration.name, tabs, node);
                    this.result += ":constructor(";
                    this.writeArray(constr.parameters, tabs, node);
                    this.result += ")\n"
                    for (const member of parentClassDeclaration.members) {
                        if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                            this.traverse(member, tabs + 1, node);
                        }
                    }
                    if (constr.body) this.traverse(constr.body, tabs + 1, node);
                    this.writeTabs(tabs);
                    this.result += "end\n";
                    break;
                }
            case ts.SyntaxKind.DoStatement:
                {
                    const doStatement = <ts.DoStatement>node;
                    this.writeTabs(tabs);
                    this.result += "repeat\n";
                    this.traverse(doStatement.statement, tabs + 1, node);
                    this.writeTabs(tabs);
                    this.result += "until not (";
                    this.traverse(doStatement.expression, tabs, node);
                    this.result += ")\n";
                    break;
                }
            case ts.SyntaxKind.ElementAccessExpression:
                const elementAccessExpression = <ts.ElementAccessExpression>node;
                this.traverse(elementAccessExpression.expression, tabs, node);
                this.result += '[';
                if (elementAccessExpression.argumentExpression) {
                    this.traverse(elementAccessExpression.argumentExpression, tabs, node);
                }
                this.result += ']';
                break;
            case ts.SyntaxKind.EndOfFileToken:
                break;
            case ts.SyntaxKind.ExpressionStatement:
                this.writeTabs(tabs);
                this.traverse((<ts.ExpressionStatement>node).expression, tabs, node);
                this.result += "\n";
                break;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                {
                    const expressionWithTypeArguments = <ts.ExpressionWithTypeArguments>node;
                    this.traverse(expressionWithTypeArguments.expression, tabs, node);
                    break;
                }
            case ts.SyntaxKind.FalseKeyword:
                this.result += "false";
                break;
            case ts.SyntaxKind.FirstLiteralToken:
                const firstLiteralToken = <ts.Identifier>node;
                this.result += firstLiteralToken.text;
                break;
            case ts.SyntaxKind.FirstTemplateToken:
                const firstTemplateToken = <ts.Identifier>node;
                this.result += `[[${firstTemplateToken.text}]]`;
                break;
            case ts.SyntaxKind.ForStatement:
                const forStatement = <ts.ForStatement>node;
                this.writeTabs(tabs);
                this.result += "for ";
                if (!forStatement.initializer) {
                    this.addTextError(node, "for statement needs an initializer");
                    break;
                }
                
                this.traverse(forStatement.initializer, tabs, node);
                this.result += ", ";
                if (!forStatement.condition) {
                    this.addTextError(node, "for statement needs a condition");
                    break;
                }

                if (forStatement.condition.kind !== ts.SyntaxKind.BinaryExpression) {
                    this.addTextError(node, "for statement condition must be a binary expression");
                    break;
                }

                const binaryCondition = <ts.BinaryExpression>forStatement.condition;

                if (!forStatement.incrementor) {
                    this.addTextError(node, "for statement needs an incrementor");
                    break;
                }

                if (forStatement.incrementor.kind !== ts.SyntaxKind.BinaryExpression) {
                    this.addTextError(node, "for statement incrementor must be a binary expression");
                    break;
                }

                const binaryIncrementor = <ts.BinaryExpression>forStatement.incrementor;
                                
                if (binaryIncrementor.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) {
                    this.traverse(binaryCondition.right, tabs, node);
                    this.result += ", ";
                    this.traverse(binaryIncrementor.right, tabs, node);
                }  
                else {
                    this.addTextError(node, "only supported incrementor is +=");
                    break;
                }

                this.result += " do\n";
                this.traverse(forStatement.statement, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.ForOfStatement:
                this.writeTabs(tabs);
                this.result += "for ";
                const forOfStatement = <ts.ForOfStatement>node;
                this.traverse(forOfStatement.initializer, tabs, node);
                this.result += " in ";
                this.traverse(forOfStatement.expression, tabs, node);
                this.result += " do\n";
                this.traverse(forOfStatement.statement, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                const functionDeclaration = <ts.FunctionDeclaration>node;
                this.result += "function ";
                if (functionDeclaration.name) {
                    this.traverse(functionDeclaration.name, tabs, node);
                }
                this.result += "(";
                this.writeArray(functionDeclaration.parameters, tabs, node);
                this.result += ")\n";
                if (functionDeclaration.body) {
                    this.traverse(functionDeclaration.body, tabs + 1, node);
                }
                this.writeTabs(tabs);
                this.result += "end";
                break;
            case ts.SyntaxKind.FunctionExpression:
                const functionExpression = <ts.FunctionExpression>node;
                this.result += "function(";
                this.writeArray(functionExpression.parameters, tabs, node);
                this.result += ")\n";
                this.traverse(functionExpression.body, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end";
                break;
            case ts.SyntaxKind.Identifier:
                const identifier = <ts.Identifier>node;
                if (identifier.text === "undefined") {
                    this.result += "nil";
                }
                else if (identifier.text === "__args") {
                    this.result += "...";
                }
                else if (identifier.text === this.addonModule) {
                    this.result += "...";
                }
                else if (this.importedVariables[identifier.text]) {
                    this.result += this.importedVariables[identifier.text] + "." + identifier.text;
                }
                else {
                    this.result += identifier.text;
                }
                break;
            case ts.SyntaxKind.IfStatement:
                const ifStatement = <ts.IfStatement>node;
                if (!options || !options.elseIf) {
                    this.writeTabs(tabs);
                    this.result += "if ";
                }
                this.traverse(ifStatement.expression, tabs, node);
                this.result += " then\n"
                this.traverse(ifStatement.thenStatement, tabs + 1, node);
                if (ifStatement.elseStatement) {
                    this.writeTabs(tabs);
                    const innerStatement = ifStatement.elseStatement;
                    if (innerStatement.kind === ts.SyntaxKind.IfStatement) {
                        this.result += "elseif ";
                        this.traverse(ifStatement.elseStatement, tabs, node, { elseIf: true });
                    }
                    else {
                        this.result += "else\n";
                        this.traverse(ifStatement.elseStatement, tabs + 1, node);
                    }
                }
                if (!options || !options.elseIf) {
                    this.writeTabs(tabs);
                    this.result += "end\n";
                }
                break;
            case ts.SyntaxKind.ImportClause:
                const importClause = <ts.ImportClause>node;
                break;
            case ts.SyntaxKind.ImportDeclaration:
                const importDeclaration = <ts.ImportDeclaration>node;
                if (!importDeclaration.importClause) break;
                const module = <ts.StringLiteral>importDeclaration.moduleSpecifier;
                if (module.text == "addon" && importDeclaration.importClause.name) {
                    this.addonModule = importDeclaration.importClause.name.text;
                }
                else {
                    if (importDeclaration.importClause.name) {
                        this.imports.push({ module: module.text, variable: importDeclaration.importClause.name.text });
                    }
                    else if (importDeclaration.importClause.namedBindings) {
                        const moduleName =  "__" + module.text.replace(/[^\w]/g, "");
                        this.imports.push({ module: module.text, variable: moduleName});
                        const namedImports = <ts.NamedImports> importDeclaration.importClause.namedBindings;
                        for (const variable of namedImports.elements) {
                            this.importedVariables[variable.name.text] = moduleName;
                        }
                    }
                }
                break;
            // case ts.SyntaxKind.ImportSpecifier:
            //     const importSpecifier = <ts.ImportSpecifier>node;
            //     importSpecifier.
            //     break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                const objectLiteralExpression = <ts.ObjectLiteralExpression>node;
                if (objectLiteralExpression.properties.length > 0) {
                    this.result += "{\n";
                    this.writeArray(objectLiteralExpression.properties, tabs + 1, node, ",\n");
                    this.result += "\n";
                    this.writeTabs(tabs);
                    this.result += "}";
                }
                else {
                    this.result += "{}";
                }
                break;
            case ts.SyntaxKind.MethodDeclaration:
                const methodDeclaration = <ts.MethodDeclaration>node;
                this.writeTabs(tabs);
                this.result += "function ";
                const parentClassDeclaration = <ts.ClassDeclaration>parent;
                if (parentClassDeclaration.name) this.traverse(parentClassDeclaration.name, tabs, node);
                this.result += ":";
                this.traverse(methodDeclaration.name, tabs, node);
                this.result += "(";
                this.writeArray(methodDeclaration.parameters, tabs, node);
                this.result += ")\n";
                if (methodDeclaration.body) this.traverse(methodDeclaration.body, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;

            case ts.SyntaxKind.NewExpression:
                const newExpression = <ts.NewExpression>node;
                this.traverse(newExpression.expression, tabs, node);
                this.result += "(";
                if (newExpression.arguments) this.writeArray(newExpression.arguments, tabs, node);
                this.result += ")";
                break;
            case ts.SyntaxKind.Parameter:
                const parameter = <ts.ParameterDeclaration>node;
                this.traverse(parameter.name, tabs, node);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                const parenthesizedExpression = <ts.ParenthesizedExpression>node;
                this.result += '(';
                this.traverse(parenthesizedExpression.expression, tabs, node);
                this.result += ')';
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
                const prefixUnaryExpression = <ts.PrefixUnaryExpression>node;
                switch (prefixUnaryExpression.operator) {
                    case ts.SyntaxKind.MinusToken:
                        this.result += "-";
                        break;
                    case ts.SyntaxKind.ExclamationToken:
                        this.result += ' not ';
                        break;
                    default:
                        this.errors.push(`Unsupported binary operator token ${ts.SyntaxKind[prefixUnaryExpression.operator]}`);
                        this.result += `{${ts.SyntaxKind[prefixUnaryExpression.operator]}}`;
                        break;
                }
                this.traverse(prefixUnaryExpression.operand, tabs, node);
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                const access = <ts.PropertyAccessExpression>node;
                this.traverse(access.expression, tabs, node);
                if (options && options.callee) {
                    this.result += ":";
                }
                else {
                    this.result += "." ;
                }
                this.result += access.name.text;
                break;
            case ts.SyntaxKind.PropertyAssignment:
                const propertyAssignment = <ts.PropertyAssignment>node;
                this.writeTabs(tabs);
                this.traverse(propertyAssignment.name, tabs, node);
                this.result += " = ";
                this.traverse(propertyAssignment.initializer, tabs, node);
                break;
            case ts.SyntaxKind.PropertyDeclaration:
                {
                    const propertyDeclaration = <ts.PropertyDeclaration>node;
                    if (propertyDeclaration.initializer) {
                        this.writeTabs(tabs);
                        this.result += "self.";
                        this.traverse(propertyDeclaration.name, tabs, node);
                        this.result += " = ";
                        this.traverse(propertyDeclaration.initializer, tabs + 1, node);
                        this.result += "\n";
                    }
                    break;
                }
            case ts.SyntaxKind.ReturnStatement:
                this.writeTabs(tabs);
                this.result += "return ";
                const returnStatement = <ts.ReturnStatement>node;
                if (returnStatement.expression) {
                    this.traverse(returnStatement.expression, tabs, node);
                }
                this.result += "\n";
                break;
            case ts.SyntaxKind.SourceFile:
                node.forEachChild(x => this.traverse(x, tabs, node));
                break;
            case ts.SyntaxKind.SpreadElement:
                const spreadElement = <ts.SpreadElement>node;
                this.traverse(spreadElement.expression, tabs, node);
                break;
            case ts.SyntaxKind.StringLiteral:
                const stringLiteral = <ts.StringLiteral>node;
                this.result += '"' + stringLiteral.text.replace("\n", "\\n") + '"';
                break;
            case ts.SyntaxKind.ThisKeyword:
                this.result += "self";
                break;
            case ts.SyntaxKind.TrueKeyword:
                this.result += "true";
                break;
            case ts.SyntaxKind.VariableDeclaration:
                const variableDeclaration = <ts.VariableDeclaration>node;
                this.traverse(variableDeclaration.name, tabs, node);
                
                if (variableDeclaration.initializer) {
                    this.result += " = ";
                    this.traverse(variableDeclaration.initializer, tabs, node);    
                }
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                const variableDeclarationList = <ts.VariableDeclarationList>node;
                this.writeArray(variableDeclarationList.declarations, tabs, node);
                break;
            case ts.SyntaxKind.VariableStatement:
                const variableStatement = <ts.VariableStatement>node;
                this.writeTabs(tabs);

                if (variableStatement.declarationList.declarations.length === 1) {
                    const variableDeclaration = variableStatement.declarationList.declarations[0];
                    if (variableDeclaration.initializer && variableDeclaration.initializer.kind === ts.SyntaxKind.Identifier) {
                        const identifier = <ts.Identifier>variableDeclaration.initializer;
                        if (identifier.text === this.addonModule) {
                            const left = <ts.ArrayBindingPattern>variableDeclaration.name
                            this.addonNameVariable = (<ts.BindingElement>left.elements[0]).name.getText();
                            this.addonVariable = (<ts.BindingElement>left.elements[1]).name.getText();
                            break;
                        }
                    }                    
                }

                this.result += "local ";
                this.traverse(variableStatement.declarationList, tabs, node);
                this.result += "\n";
                break;
            case ts.SyntaxKind.WhileStatement:
                const whileStatement = <ts.WhileStatement>node;
                this.writeTabs(tabs);
                this.result += "while ";
                this.traverse(whileStatement.expression, tabs, node);
                this.result += "do\n";
                this.traverse(whileStatement.statement, tabs + 1, node);
                this.result += "end\n";
                break;
            default:
                this.writeTabs(tabs);
                this.addError(node);
                this.result += "{" + ts.SyntaxKind[node.kind] + "}\n";
                node.forEachChild(x => this.traverse(x, tabs + 1, node));
                break;
        }
    }
}
