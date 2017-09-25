"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var LuaVisitor = /** @class */ (function () {
    function LuaVisitor() {
        this.result = "";
        this.errors = [];
    }
    LuaVisitor.prototype.writeTabs = function (tabs) {
        for (var i = 0; i < tabs; i++)
            this.result += "    ";
    };
    LuaVisitor.prototype.addError = function (node) {
        var position = node.getSourceFile().getLineAndCharacterOfPosition(node.pos);
        this.errors.push("Unsupported node " + ts.SyntaxKind[node.kind] + " \"" + node.getText() + "\" in " + node.getSourceFile().fileName + ":" + position.line + ":" + position.character);
    };
    LuaVisitor.prototype.writeArray = function (array, tabs, separator) {
        if (separator === void 0) { separator = ", "; }
        for (var i = 0; i < array.length; i++) {
            if (i > 0)
                this.result += separator;
            this.traverse(array[i], tabs);
        }
    };
    LuaVisitor.prototype.traverse = function (node, tabs, options) {
        var _this = this;
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
                var arrayBindingPattern = node;
                this.writeArray(arrayBindingPattern.elements, tabs);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                var arrayLiteralExpression = node;
                this.writeArray(arrayLiteralExpression.elements, tabs);
                break;
            case ts.SyntaxKind.BinaryExpression:
                var binary = node;
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
                        this.result += "{Binary " + ts.SyntaxKind[binary.operatorToken.kind] + "}";
                        break;
                }
                this.traverse(binary.right, tabs);
                break;
            case ts.SyntaxKind.BindingElement:
                var bindingElement = node;
                this.traverse(bindingElement.name, tabs);
                break;
            case ts.SyntaxKind.Block:
                var block = node;
                if (node.parent && (node.parent.kind == ts.SyntaxKind.Block || node.parent.kind == ts.SyntaxKind.SourceFile)) {
                    this.writeTabs(tabs);
                    this.result += "do\n";
                    node.forEachChild(function (x) { return _this.traverse(x, tabs + 1); });
                    this.writeTabs(tabs);
                    this.result += "end\n";
                }
                else {
                    node.forEachChild(function (x) { return _this.traverse(x, tabs); });
                }
                break;
            case ts.SyntaxKind.BreakStatement:
                this.writeTabs(tabs);
                this.result += "break\n";
                break;
            case ts.SyntaxKind.CallExpression:
                var callExpression = node;
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
                var classDeclaration = node;
                for (var _i = 0, _a = classDeclaration.members; _i < _a.length; _i++) {
                    var member = _a[_i];
                    this.traverse(member, tabs);
                }
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                var elementAccessExpression = node;
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
                this.traverse(node.expression, tabs);
                this.result += "\n";
                break;
            case ts.SyntaxKind.FalseKeyword:
                this.result += "false";
                break;
            case ts.SyntaxKind.FirstLiteralToken:
                var firstLiteralToken = node;
                this.result += firstLiteralToken.text;
                break;
            case ts.SyntaxKind.ForOfStatement:
                this.writeTabs(tabs);
                this.result += "for ";
                var forOfStatement = node;
                this.traverse(forOfStatement.initializer, tabs);
                this.result += " in ";
                this.traverse(forOfStatement.expression, tabs);
                this.result += " do\n";
                this.traverse(forOfStatement.statement, tabs + 1);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.FunctionExpression:
                var functionExpression = node;
                this.result += "function(";
                this.writeArray(functionExpression.parameters, tabs);
                this.result += ")\n";
                this.traverse(functionExpression.body, tabs + 1);
                this.writeTabs(tabs);
                this.result += "end";
                break;
            case ts.SyntaxKind.Identifier:
                var identifier = node;
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
                var ifStatement = node;
                if (!options || !options.elseIf) {
                    this.writeTabs(tabs);
                    this.result += "if ";
                }
                this.traverse(ifStatement.expression, tabs);
                this.result += " then\n";
                this.traverse(ifStatement.thenStatement, tabs + 1);
                if (ifStatement.elseStatement) {
                    this.writeTabs(tabs);
                    var innerStatement = ifStatement.elseStatement;
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
                var objectLiteralExpression = node;
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
                var methodDeclaration = node;
                this.writeTabs(tabs);
                this.result += "function ";
                var parent_1 = methodDeclaration.parent;
                if (parent_1.name)
                    this.traverse(parent_1.name, tabs);
                this.result += ":";
                this.traverse(methodDeclaration.name, tabs);
                this.result += "(";
                this.writeArray(methodDeclaration.parameters, tabs);
                this.result += ")\n";
                if (methodDeclaration.body)
                    this.traverse(methodDeclaration.body, tabs + 1);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.Parameter:
                var parameter = node;
                this.traverse(parameter.name, tabs);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                var parenthesizedExpression = node;
                this.result += '(';
                this.traverse(parenthesizedExpression.expression, tabs);
                this.result += ')';
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
                var prefixUnaryExpression = node;
                switch (prefixUnaryExpression.operator) {
                    case ts.SyntaxKind.MinusToken:
                        this.result += "-";
                        break;
                    case ts.SyntaxKind.ExclamationToken:
                        this.result += ' not ';
                        break;
                    default:
                        this.errors.push("Unsupported binary operator token " + ts.SyntaxKind[prefixUnaryExpression.operator]);
                        this.result += "{" + ts.SyntaxKind[prefixUnaryExpression.operator] + "}";
                        break;
                }
                this.traverse(prefixUnaryExpression.operand, tabs);
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                var access = node;
                this.traverse(access.expression, tabs);
                if (options && options.callee) {
                    this.result += ":";
                }
                else {
                    this.result += ".";
                }
                this.result += access.name.text;
                break;
            case ts.SyntaxKind.PropertyAssignment:
                var propertyAssignment = node;
                this.writeTabs(tabs);
                this.traverse(propertyAssignment.name, tabs);
                this.result += " = ";
                this.traverse(propertyAssignment.initializer, tabs);
                break;
            case ts.SyntaxKind.ReturnStatement:
                this.writeTabs(tabs);
                this.result += "return ";
                var returnStatement = node;
                if (returnStatement.expression) {
                    this.traverse(returnStatement.expression, tabs);
                }
                this.result += "\n";
                break;
            case ts.SyntaxKind.SourceFile:
                node.forEachChild(function (x) { return _this.traverse(x, tabs); });
                break;
            case ts.SyntaxKind.SpreadElement:
                var spreadElement = node;
                this.traverse(spreadElement.expression, tabs);
                break;
            case ts.SyntaxKind.StringLiteral:
                var stringLiteral = node;
                this.result += '"' + stringLiteral.text.replace("\n", "\\n") + '"';
                break;
            case ts.SyntaxKind.ThisKeyword:
                this.result += "self";
                break;
            case ts.SyntaxKind.TrueKeyword:
                this.result += "true";
                break;
            case ts.SyntaxKind.VariableDeclaration:
                var variableDeclaration = node;
                this.traverse(variableDeclaration.name, tabs);
                if (variableDeclaration.initializer) {
                    this.result += " = ";
                    this.traverse(variableDeclaration.initializer, tabs);
                }
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                var variableDeclarationList = node;
                this.writeArray(variableDeclarationList.declarations, tabs);
                break;
            case ts.SyntaxKind.VariableStatement:
                var variableStatement = node;
                this.writeTabs(tabs);
                this.result += "local ";
                this.traverse(variableStatement.declarationList, tabs);
                this.result += "\n";
                break;
            case ts.SyntaxKind.WhileStatement:
                var whileStatement = node;
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
                node.forEachChild(function (x) { return _this.traverse(x, tabs + 1); });
                break;
        }
    };
    return LuaVisitor;
}());
exports.LuaVisitor = LuaVisitor;
//# sourceMappingURL=luavisitor.js.map