"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var path = require("path");
var LuaVisitor = /** @class */ (function () {
    function LuaVisitor(sourceFile) {
        this.sourceFile = sourceFile;
        this.result = "";
        this.imports = [];
        this.importedVariables = {};
        this.errors = [];
    }
    LuaVisitor.prototype.getResult = function () {
        if (this.imports.length > 0) {
            if (!this.addonNameVariable)
                this.addonNameVariable = "__addonName";
            if (!this.addonVariable)
                this.addonVariable = "__addon";
            this.result = "require(" + this.addonNameVariable + ", " + this.addonVariable + ", \"" + path.basename(this.sourceFile.fileName, ".ts") + "\", { \"" + this.imports.map(function (x) { return x.module; }).join("\", \"") + "\" }, function(__exports, " + this.imports.map(function (x) { return x.variable; }).join(", ") + ")\n" + this.result + "end))\n";
        }
        if (this.addonNameVariable != undefined) {
            this.result = "local " + this.addonNameVariable + ", " + this.addonVariable + " = ...\n" + this.result;
        }
        return this.result;
    };
    LuaVisitor.prototype.writeTabs = function (tabs) {
        for (var i = 0; i < tabs; i++)
            this.result += "    ";
    };
    LuaVisitor.prototype.addError = function (node) {
        this.addTextError(node, "Unsupported node " + ts.SyntaxKind[node.kind]);
    };
    LuaVisitor.prototype.addTextError = function (node, text) {
        var position = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
        this.errors.push(text + " in " + this.sourceFile.fileName + ":" + (position.line + 1) + ":" + (position.character + 1));
    };
    LuaVisitor.prototype.writeArray = function (array, tabs, parent, separator) {
        if (separator === void 0) { separator = ", "; }
        for (var i = 0; i < array.length; i++) {
            if (i > 0)
                this.result += separator;
            this.traverse(array[i], tabs, parent);
        }
    };
    LuaVisitor.prototype.traverse = function (node, tabs, parent, options) {
        var _this = this;
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
                var arrayBindingPattern = node;
                this.writeArray(arrayBindingPattern.elements, tabs, node);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                var arrayLiteralExpression = node;
                this.writeArray(arrayLiteralExpression.elements, tabs, node);
                break;
            case ts.SyntaxKind.BinaryExpression:
                var binary = node;
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
                        this.result += "{Binary " + ts.SyntaxKind[binary.operatorToken.kind] + "}";
                        break;
                }
                this.traverse(binary.right, tabs, node);
                break;
            case ts.SyntaxKind.BindingElement:
                var bindingElement = node;
                this.traverse(bindingElement.name, tabs, node);
                break;
            case ts.SyntaxKind.Block:
                var block = node;
                if (parent && (parent.kind == ts.SyntaxKind.Block || parent.kind == ts.SyntaxKind.SourceFile)) {
                    this.writeTabs(tabs);
                    this.result += "do\n";
                    node.forEachChild(function (x) { return _this.traverse(x, tabs + 1, node); });
                    this.writeTabs(tabs);
                    this.result += "end\n";
                }
                else {
                    node.forEachChild(function (x) { return _this.traverse(x, tabs, node); });
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
                var classExpression = node;
                var className = undefined;
                if (classExpression.name) {
                    this.result += "local ";
                    this.traverse(classExpression.name, tabs, node);
                    className = classExpression.name.text;
                    this.result += " = ";
                }
                this.result += "__class(";
                if (classExpression.heritageClauses) {
                    for (var _i = 0, _a = classExpression.heritageClauses; _i < _a.length; _i++) {
                        var heritage = _a[_i];
                        if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                            this.writeArray(heritage.types, tabs, node);
                        }
                    }
                }
                this.result += ")\n";
                for (var _b = 0, _c = classExpression.members; _b < _c.length; _b++) {
                    var member = _c[_b];
                    if (member.kind === ts.SyntaxKind.PropertyDeclaration)
                        continue;
                    this.traverse(member, tabs, node, { class: className });
                }
                break;
            case ts.SyntaxKind.ComputedPropertyName:
                var computedPropertyName = node;
                this.result += "[";
                this.traverse(computedPropertyName.expression, tabs, node);
                this.result += "]";
                break;
            case ts.SyntaxKind.Constructor:
                {
                    var constr = node;
                    this.result += "function ";
                    var parentClassDeclaration_1 = parent;
                    if (parentClassDeclaration_1.name)
                        this.traverse(parentClassDeclaration_1.name, tabs, node);
                    this.result += ":constructor(";
                    this.writeArray(constr.parameters, tabs, node);
                    this.result += ")\n";
                    for (var _d = 0, _e = parentClassDeclaration_1.members; _d < _e.length; _d++) {
                        var member = _e[_d];
                        if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                            this.traverse(member, tabs + 1, node);
                        }
                    }
                    if (constr.body)
                        this.traverse(constr.body, tabs + 1, node);
                    this.writeTabs(tabs);
                    this.result += "end\n";
                    break;
                }
            case ts.SyntaxKind.DoStatement:
                {
                    var doStatement = node;
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
                var elementAccessExpression = node;
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
                this.traverse(node.expression, tabs, node);
                this.result += "\n";
                break;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                {
                    var expressionWithTypeArguments = node;
                    this.traverse(expressionWithTypeArguments.expression, tabs, node);
                    break;
                }
            case ts.SyntaxKind.FalseKeyword:
                this.result += "false";
                break;
            case ts.SyntaxKind.FirstLiteralToken:
                var firstLiteralToken = node;
                this.result += firstLiteralToken.text;
                break;
            case ts.SyntaxKind.FirstTemplateToken:
                var firstTemplateToken = node;
                this.result += "[[" + firstTemplateToken.text + "]]";
                break;
            case ts.SyntaxKind.ForStatement:
                var forStatement = node;
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
                var binaryCondition = forStatement.condition;
                if (!forStatement.incrementor) {
                    this.addTextError(node, "for statement needs an incrementor");
                    break;
                }
                if (forStatement.incrementor.kind !== ts.SyntaxKind.BinaryExpression) {
                    this.addTextError(node, "for statement incrementor must be a binary expression");
                    break;
                }
                var binaryIncrementor = forStatement.incrementor;
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
                var forOfStatement = node;
                this.traverse(forOfStatement.initializer, tabs, node);
                this.result += " in ";
                this.traverse(forOfStatement.expression, tabs, node);
                this.result += " do\n";
                this.traverse(forOfStatement.statement, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                var functionDeclaration = node;
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
                var functionExpression = node;
                this.result += "function(";
                this.writeArray(functionExpression.parameters, tabs, node);
                this.result += ")\n";
                this.traverse(functionExpression.body, tabs + 1, node);
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
                var ifStatement = node;
                if (!options || !options.elseIf) {
                    this.writeTabs(tabs);
                    this.result += "if ";
                }
                this.traverse(ifStatement.expression, tabs, node);
                this.result += " then\n";
                this.traverse(ifStatement.thenStatement, tabs + 1, node);
                if (ifStatement.elseStatement) {
                    this.writeTabs(tabs);
                    var innerStatement = ifStatement.elseStatement;
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
                var importClause = node;
                break;
            case ts.SyntaxKind.ImportDeclaration:
                var importDeclaration = node;
                if (!importDeclaration.importClause)
                    break;
                var module_1 = importDeclaration.moduleSpecifier;
                if (module_1.text == "addon" && importDeclaration.importClause.name) {
                    this.addonModule = importDeclaration.importClause.name.text;
                }
                else {
                    if (importDeclaration.importClause.name) {
                        this.imports.push({ module: module_1.text, variable: importDeclaration.importClause.name.text });
                    }
                    else if (importDeclaration.importClause.namedBindings) {
                        var moduleName = "__" + module_1.text.replace(/[^\w]/g, "");
                        this.imports.push({ module: module_1.text, variable: moduleName });
                        var namedImports = importDeclaration.importClause.namedBindings;
                        for (var _f = 0, _g = namedImports.elements; _f < _g.length; _f++) {
                            var variable = _g[_f];
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
                var objectLiteralExpression = node;
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
                var methodDeclaration = node;
                this.writeTabs(tabs);
                this.result += "function ";
                var parentClassDeclaration = parent;
                if (parentClassDeclaration.name)
                    this.traverse(parentClassDeclaration.name, tabs, node);
                this.result += ":";
                this.traverse(methodDeclaration.name, tabs, node);
                this.result += "(";
                this.writeArray(methodDeclaration.parameters, tabs, node);
                this.result += ")\n";
                if (methodDeclaration.body)
                    this.traverse(methodDeclaration.body, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.NewExpression:
                var newExpression = node;
                this.traverse(newExpression.expression, tabs, node);
                this.result += "(";
                if (newExpression.arguments)
                    this.writeArray(newExpression.arguments, tabs, node);
                this.result += ")";
                break;
            case ts.SyntaxKind.Parameter:
                var parameter = node;
                this.traverse(parameter.name, tabs, node);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                var parenthesizedExpression = node;
                this.result += '(';
                this.traverse(parenthesizedExpression.expression, tabs, node);
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
                this.traverse(prefixUnaryExpression.operand, tabs, node);
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                var access = node;
                this.traverse(access.expression, tabs, node);
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
                this.traverse(propertyAssignment.name, tabs, node);
                this.result += " = ";
                this.traverse(propertyAssignment.initializer, tabs, node);
                break;
            case ts.SyntaxKind.PropertyDeclaration:
                {
                    var propertyDeclaration = node;
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
                var returnStatement = node;
                if (returnStatement.expression) {
                    this.traverse(returnStatement.expression, tabs, node);
                }
                this.result += "\n";
                break;
            case ts.SyntaxKind.SourceFile:
                node.forEachChild(function (x) { return _this.traverse(x, tabs, node); });
                break;
            case ts.SyntaxKind.SpreadElement:
                var spreadElement = node;
                this.traverse(spreadElement.expression, tabs, node);
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
                this.traverse(variableDeclaration.name, tabs, node);
                if (variableDeclaration.initializer) {
                    this.result += " = ";
                    this.traverse(variableDeclaration.initializer, tabs, node);
                }
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                var variableDeclarationList = node;
                this.writeArray(variableDeclarationList.declarations, tabs, node);
                break;
            case ts.SyntaxKind.VariableStatement:
                var variableStatement = node;
                this.writeTabs(tabs);
                if (variableStatement.declarationList.declarations.length === 1) {
                    var variableDeclaration_1 = variableStatement.declarationList.declarations[0];
                    if (variableDeclaration_1.initializer && variableDeclaration_1.initializer.kind === ts.SyntaxKind.Identifier) {
                        var identifier_1 = variableDeclaration_1.initializer;
                        if (identifier_1.text === this.addonModule) {
                            var left = variableDeclaration_1.name;
                            this.addonNameVariable = left.elements[0].name.getText();
                            this.addonVariable = left.elements[1].name.getText();
                            break;
                        }
                    }
                }
                this.result += "local ";
                this.traverse(variableStatement.declarationList, tabs, node);
                this.result += "\n";
                break;
            case ts.SyntaxKind.WhileStatement:
                var whileStatement = node;
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
                node.forEachChild(function (x) { return _this.traverse(x, tabs + 1, node); });
                break;
        }
    };
    return LuaVisitor;
}());
exports.LuaVisitor = LuaVisitor;
//# sourceMappingURL=luavisitor.js.map