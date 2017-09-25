import * as ts from "typescript";

export class LuaVisitor {
    public result = "";
    public errors:string[] = [];

    writeTabs(tabs: number) {
        for (let i = 0; i < tabs; i++) this.result += "    ";
    }

    addError(node: ts.Node){
        const position = node.getSourceFile().getLineAndCharacterOfPosition(node.pos);
        this.errors.push(`Unsupported node ${ts.SyntaxKind[node.kind]} "${node.getText()}" in ${node.getSourceFile().fileName}:${position.line}:${position.character}`);
    }

    writeArray<T extends ts.Node>(array: ts.NodeArray<T>, tabs: number, separator: string = ", ") {
        for(let i = 0; i<array.length; i++) {
            if(i> 0) this.result += separator;
            this.traverse(array[i], tabs);
        }
    }

    public traverse(node: ts.Node, tabs: number, options?: { elseIf?: boolean, callee?: boolean }) {
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
                const arrayBindingPattern = <ts.ArrayBindingPattern>node;
                this.writeArray(arrayBindingPattern.elements, tabs);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                const arrayLiteralExpression = <ts.ArrayLiteralExpression>node;
                this.writeArray(arrayLiteralExpression.elements, tabs);
                break;
            case ts.SyntaxKind.BinaryExpression:
                const binary = <ts.BinaryExpression>node;
                this.traverse(binary.left, tabs);
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
                this.traverse(binary.right, tabs);
                break;
            case ts.SyntaxKind.BindingElement:
                const bindingElement = <ts.BindingElement>node;
                this.traverse(bindingElement.name, tabs);
                break;
            case ts.SyntaxKind.Block:
                const block = <ts.Block>node;
                if (node.parent && (node.parent.kind == ts.SyntaxKind.Block || node.parent.kind == ts.SyntaxKind.SourceFile)) {
                    this.writeTabs(tabs);
                    this.result += "do\n";
                    node.forEachChild(x => this.traverse(x, tabs + 1));
                    this.writeTabs(tabs);
                    this.result += "end\n";
                }
                else {
                    node.forEachChild(x => this.traverse(x, tabs));
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
                    this.writeArray(callExpression.arguments, tabs);
                }
                else {
                    this.traverse(callExpression.expression, tabs, { callee: true });
                    this.result += "(";
                    this.writeArray(callExpression.arguments, tabs);
                    this.result += ")";
                }
                break;
            case ts.SyntaxKind.ClassDeclaration:
                const classDeclaration = <ts.ClassDeclaration>node;
                for (const member of  classDeclaration.members) {
                    this.traverse(member, tabs);
                }
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                const elementAccessExpression = <ts.ElementAccessExpression>node;
                this.traverse(elementAccessExpression.expression, tabs);
                this.result += '[';
                if (elementAccessExpression.argumentExpression) {
                    this.traverse(elementAccessExpression.argumentExpression, tabs);
                }
                this.result += ']';
                break;
            case ts.SyntaxKind.EndOfFileToken:
                break;
            case ts.SyntaxKind.ExpressionStatement:
                this.writeTabs(tabs);
                this.traverse((<ts.ExpressionStatement>node).expression, tabs);
                this.result += "\n";
                break;
            case ts.SyntaxKind.FalseKeyword:
                this.result += "false";
                break;
            case ts.SyntaxKind.FirstLiteralToken:
                const firstLiteralToken = <ts.Identifier>node;
                this.result += firstLiteralToken.text;
                break;
            case ts.SyntaxKind.ForOfStatement:
                this.writeTabs(tabs);
                this.result += "for ";
                const forOfStatement = <ts.ForOfStatement>node;
                this.traverse(forOfStatement.initializer, tabs);
                this.result += " in ";
                this.traverse(forOfStatement.expression, tabs);
                this.result += " do\n";
                this.traverse(forOfStatement.statement, tabs + 1);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.FunctionExpression:
                const functionExpression = <ts.FunctionExpression>node;
                this.result += "function(";
                this.writeArray(functionExpression.parameters, tabs);
                this.result += ")\n";
                this.traverse(functionExpression.body, tabs + 1);
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
                this.traverse(ifStatement.expression, tabs);
                this.result += " then\n"
                this.traverse(ifStatement.thenStatement, tabs + 1);
                if (ifStatement.elseStatement) {
                    this.writeTabs(tabs);
                    const innerStatement = ifStatement.elseStatement;
                    if (innerStatement.kind === ts.SyntaxKind.IfStatement) {
                        this.result += "elseif ";
                        this.traverse(ifStatement.elseStatement, tabs, { elseIf: true });
                    }
                    else {
                        this.result += "else\n";
                        this.traverse(ifStatement.elseStatement, tabs + 1);
                    }
                }
                if (!options || !options.elseIf) {
                    this.writeTabs(tabs);
                    this.result += "end\n";
                }
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                const objectLiteralExpression = <ts.ObjectLiteralExpression>node;
                if (objectLiteralExpression.properties.length > 0) {
                    this.result += "{\n";
                    this.writeArray(objectLiteralExpression.properties, tabs + 1, ",\n");
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
                const parent = <ts.ClassDeclaration>methodDeclaration.parent;
                if (parent.name) this.traverse(parent.name, tabs);
                this.result += ":";
                this.traverse(methodDeclaration.name, tabs);
                this.result += "(";
                this.writeArray(methodDeclaration.parameters, tabs);
                this.result += ")\n";
                if (methodDeclaration.body) this.traverse(methodDeclaration.body, tabs + 1);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;

            case ts.SyntaxKind.Parameter:
                const parameter = <ts.ParameterDeclaration>node;
                this.traverse(parameter.name, tabs);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                const parenthesizedExpression = <ts.ParenthesizedExpression>node;
                this.result += '(';
                this.traverse(parenthesizedExpression.expression, tabs);
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
                this.traverse(prefixUnaryExpression.operand, tabs);
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                const access = <ts.PropertyAccessExpression>node;
                this.traverse(access.expression, tabs);
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
                this.traverse(propertyAssignment.name, tabs);
                this.result += " = ";
                this.traverse(propertyAssignment.initializer, tabs);
                break;
            case ts.SyntaxKind.ReturnStatement:
                this.writeTabs(tabs);
                this.result += "return ";
                const returnStatement = <ts.ReturnStatement>node;
                if (returnStatement.expression) {
                    this.traverse(returnStatement.expression, tabs);
                }
                this.result += "\n";
                break;
            case ts.SyntaxKind.SourceFile:
                node.forEachChild(x => this.traverse(x, tabs));
                break;
            case ts.SyntaxKind.SpreadElement:
                const spreadElement = <ts.SpreadElement>node;
                this.traverse(spreadElement.expression, tabs);
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
                this.traverse(variableDeclaration.name, tabs);
                if (variableDeclaration.initializer) {
                    this.result += " = ";
                    this.traverse(variableDeclaration.initializer, tabs);                
                }
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                const variableDeclarationList = <ts.VariableDeclarationList>node;
                this.writeArray(variableDeclarationList.declarations, tabs);
                break;
            case ts.SyntaxKind.VariableStatement:
                const variableStatement = <ts.VariableStatement>node;
                this.writeTabs(tabs);
                this.result += "local ";
                this.traverse(variableStatement.declarationList, tabs);
                this.result += "\n";
                break;
            case ts.SyntaxKind.WhileStatement:
                const whileStatement = <ts.WhileStatement>node;
                this.writeTabs(tabs);
                this.result += "while ";
                this.traverse(whileStatement.expression, tabs);
                this.result += "do\n";
                this.traverse(whileStatement.statement, tabs + 1);
                this.result += "end\n";
                break;
            default:
                this.writeTabs(tabs);
                this.addError(node);
                this.result += "{" + ts.SyntaxKind[node.kind] + "}\n";
                node.forEachChild(x => this.traverse(x, tabs + 1));
                break;
        }
    }
}
