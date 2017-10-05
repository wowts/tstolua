"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var path = require("path");
var LuaVisitor = /** @class */ (function () {
    function LuaVisitor(sourceFile, typeChecker) {
        this.sourceFile = sourceFile;
        this.typeChecker = typeChecker;
        this.result = "";
        this.imports = [];
        this.importedVariables = {};
        this.exportedVariables = {};
        this.classDeclarations = [];
        this.currentClassDeclaration = undefined;
        this.exports = [];
        this.errors = [];
        if (typeChecker) {
            var currentModule = typeChecker.getSymbolAtLocation(sourceFile);
            if (currentModule) {
                this.exports = typeChecker.getExportsOfModule(currentModule);
            }
        }
    }
    LuaVisitor.prototype.getResult = function () {
        var hasExportedVariables = this.imports.length > 0;
        for (var key in this.exportedVariables) {
            hasExportedVariables = true;
            break;
        }
        if (hasExportedVariables) {
            if (!this.addonNameVariable)
                this.addonNameVariable = "__addonName";
            if (!this.addonVariable)
                this.addonVariable = "__addon";
            // const moduleName = path.basename(this.sourceFile.fileName, ".ts");
            var moduleName_1 = this.sourceFile.moduleName;
            var modules = this.imports.map(function (x) { return (x.module.indexOf(".") == 0 ? "./" : "") + path.join(path.dirname(moduleName_1), x.module).replace("\\", "/"); });
            if (this.imports.length > 0) {
                this.result = this.addonVariable + ".require(" + this.addonNameVariable + ", " + this.addonVariable + ", \"" + moduleName_1 + "\", { \"" + modules.join("\", \"") + "\" }, function(__exports, " + this.imports.map(function (x) { return x.variable; }).join(", ") + ")\n" + this.result + "end)\n";
            }
            else {
                this.result = this.addonVariable + ".require(" + this.addonNameVariable + ", " + this.addonVariable + ", \"" + moduleName_1 + "\", {}, function(__exports)\n" + this.result + "end)\n";
            }
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
    LuaVisitor.prototype.writeArray = function (array, tabs, parent, separator, options) {
        if (separator === void 0) { separator = ", "; }
        for (var i = 0; i < array.length; i++) {
            if (i > 0)
                this.result += separator;
            this.traverse(array[i], tabs, parent, options);
        }
    };
    LuaVisitor.prototype.traverse = function (node, tabs, parent, options) {
        var _this = this;
        node.parent = parent;
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
                var arrayBindingPattern = node;
                this.writeArray(arrayBindingPattern.elements, tabs, node);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                var arrayLiteralExpression = node;
                this.writeArray(arrayLiteralExpression.elements, tabs, node);
                break;
            case ts.SyntaxKind.ArrowFunction:
                var arrowFunction = node;
                this.result += "function(";
                this.writeArray(arrowFunction.parameters, tabs, node);
                this.result += ")\n";
                if (arrowFunction.body.kind === ts.SyntaxKind.Block) {
                    this.traverse(arrowFunction.body, tabs + 1, node);
                }
                else {
                    this.writeTabs(tabs + 1);
                    this.result += "return ";
                    this.traverse(arrowFunction.body, tabs, node);
                    this.result += "\n";
                }
                this.writeTabs(tabs);
                this.result += "end";
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
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                    case ts.SyntaxKind.EqualsEqualsToken:
                        this.result += " == ";
                        break;
                    case ts.SyntaxKind.ExclamationEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
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
                    if (callExpression.expression.kind === ts.SyntaxKind.SuperKeyword) {
                        this.result += "self";
                        if (callExpression.arguments.length)
                            this.result += ", ";
                    }
                    this.writeArray(callExpression.arguments, tabs, node);
                    this.result += ")";
                }
                break;
            case ts.SyntaxKind.ClassDeclaration:
                {
                    var classExpression = node;
                    if (this.currentClassDeclaration) {
                        this.classDeclarations.push(this.currentClassDeclaration);
                    }
                    this.currentClassDeclaration = classExpression;
                    var className = undefined;
                    var isExport_1 = false;
                    if (classExpression.name) {
                        isExport_1 = this.writeLocalOrExport(classExpression);
                        this.traverse(classExpression.name, tabs, node);
                        className = classExpression.name.text;
                        if (isExport_1) {
                            this.exportedVariables[className] = true;
                        }
                        this.result += " = ";
                    }
                    this.result += "__class(";
                    if (!this.writeHeritage(classExpression, tabs, node)) {
                        this.result += "nil";
                    }
                    this.result += ", {\n";
                    var constructorFound = false;
                    var propertyFound = false;
                    for (var _i = 0, _a = classExpression.members; _i < _a.length; _i++) {
                        var member = _a[_i];
                        if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                            if (member.initializer != undefined)
                                propertyFound = true;
                            continue;
                        }
                        if (member.kind === ts.SyntaxKind.Constructor) {
                            constructorFound = true;
                        }
                        this.traverse(member, tabs + 1, node);
                    }
                    if (propertyFound && !constructorFound) {
                        this.writeTabs(tabs + 1);
                        this.result += "constructor = function(self)\n";
                        for (var _b = 0, _c = classExpression.members; _b < _c.length; _b++) {
                            var member = _c[_b];
                            if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
                                if (member.initializer === undefined)
                                    continue;
                            }
                            this.traverse(member, tabs + 2, node);
                        }
                        this.writeTabs(tabs + 1);
                        this.result += "end\n";
                    }
                    if (this.classDeclarations.length > 0) {
                        this.currentClassDeclaration = this.classDeclarations.pop();
                    }
                    else {
                        this.currentClassDeclaration = undefined;
                    }
                    this.writeTabs(tabs);
                    this.result += "})\n";
                    break;
                }
            case ts.SyntaxKind.ClassExpression:
                {
                    var classExpression = node;
                    if (this.currentClassDeclaration) {
                        this.classDeclarations.push(this.currentClassDeclaration);
                    }
                    this.currentClassDeclaration = classExpression;
                    this.result += "__class(";
                    if (classExpression.heritageClauses) {
                        this.writeHeritage(classExpression, tabs, node);
                    }
                    else {
                        this.result += "nil";
                    }
                    this.result += ", {\n";
                    for (var _d = 0, _e = classExpression.members; _d < _e.length; _d++) {
                        var member = _e[_d];
                        if (member.kind === ts.SyntaxKind.PropertyDeclaration)
                            continue;
                        this.traverse(member, tabs + 1, node);
                    }
                    this.writeTabs(tabs);
                    this.result += "})";
                    if (this.classDeclarations.length > 0) {
                        this.currentClassDeclaration = this.classDeclarations.pop();
                    }
                    else {
                        this.currentClassDeclaration = undefined;
                    }
                    break;
                }
            case ts.SyntaxKind.ComputedPropertyName:
                var computedPropertyName = node;
                this.result += "[";
                this.traverse(computedPropertyName.expression, tabs, node);
                this.result += "]";
                break;
            case ts.SyntaxKind.Constructor:
                {
                    var constr = node;
                    this.writeTabs(tabs);
                    this.result += "constructor = function(self";
                    if (constr.parameters.length > 0) {
                        this.result += ", ";
                        this.writeArray(constr.parameters, tabs, node);
                    }
                    this.result += ")\n";
                    if (constr.parent) {
                        for (var _f = 0, _g = constr.parent.members; _f < _g.length; _f++) {
                            var member = _g[_f];
                            if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                                this.traverse(member, tabs + 1, constr.parent);
                            }
                        }
                    }
                    if (constr.body)
                        this.traverse(constr.body, tabs + 1, node);
                    this.writeTabs(tabs);
                    this.result += "end,\n";
                    break;
                }
            case ts.SyntaxKind.DeleteExpression:
                {
                    var deleteExpression = node;
                    this.traverse(deleteExpression.expression, tabs, node);
                    this.result += " = nil";
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
                {
                    var functionDeclaration = node;
                    var isExport_2 = this.writeLocalOrExport(functionDeclaration);
                    if (functionDeclaration.name) {
                        this.traverse(functionDeclaration.name, tabs, node, { export: isExport_2 });
                    }
                    this.result += " = function(";
                    this.writeArray(functionDeclaration.parameters, tabs, node);
                    this.result += ")\n";
                    if (functionDeclaration.body) {
                        this.traverse(functionDeclaration.body, tabs + 1, node);
                    }
                    this.writeTabs(tabs);
                    this.result += "end\n";
                    break;
                }
            case ts.SyntaxKind.FunctionExpression:
                var functionExpression = node;
                this.result += "function(";
                this.writeArray(functionExpression.parameters, tabs, node);
                this.result += ")\n";
                this.traverse(functionExpression.body, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.Identifier:
                var identifier = node;
                if (identifier.text === "rest") {
                    this.result += "...";
                }
                else if (identifier.text === "undefined") {
                    this.result += "nil";
                }
                else if (identifier.text === "__args") {
                    this.result += "...";
                }
                else if (identifier.text === this.addonModule) {
                    this.result += "...";
                }
                else {
                    if (this.typeChecker) {
                        var symbol = this.typeChecker.getSymbolAtLocation(node);
                        if (symbol) {
                            if (this.exports.indexOf(symbol) >= 0) {
                                this.result += "__exports.";
                            }
                            this.typeChecker.getRootSymbols(symbol);
                            if ((symbol.flags & ts.SymbolFlags.AliasExcludes) && this.importedVariables[identifier.text]) {
                                this.result += this.importedVariables[identifier.text] + ".";
                            }
                        }
                    }
                    if (options && options.export)
                        this.exportedVariables[identifier.text] = true;
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
                        for (var _h = 0, _j = namedImports.elements; _h < _j.length; _h++) {
                            var variable = _j[_h];
                            this.importedVariables[variable.name.text] = moduleName;
                        }
                    }
                }
                break;
            case ts.SyntaxKind.IndexSignature:
                // Not needed, it's an index signature in a class declaration
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                // Interfaces are skipped
                break;
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
                this.traverse(methodDeclaration.name, tabs, node);
                this.result += " = function(self";
                if (methodDeclaration.parameters.length > 0) {
                    this.result += ", ";
                    this.writeArray(methodDeclaration.parameters, tabs, node);
                }
                this.result += ")\n";
                if (methodDeclaration.body)
                    this.traverse(methodDeclaration.body, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end,\n";
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
                {
                    var access = node;
                    this.traverse(access.expression, tabs, node);
                    var isMethodCall = false;
                    if (options && options.callee) {
                        // const symbol = this.typeChecker.getSymbolAtLocation(access.expression);
                        // if (symbol) {
                        //     const typeOfSymbol = this.typeChecker.getTypeOfSymbolAtLocation(symbol, access.expression);
                        //     const property = typeOfSymbol.getProperty(access.name.text);
                        //     if (property && (property.flags & ts.SymbolFlags.Method)) {
                        //         isMethodCall = true;
                        //     }
                        // }
                        var symbol = this.typeChecker.getSymbolAtLocation(access);
                        if (symbol !== undefined)
                            isMethodCall = (symbol.getFlags() & ts.SymbolFlags.Method) > 0;
                    }
                    this.result += isMethodCall ? ":" : ".";
                    this.result += access.name.text;
                    break;
                }
            case ts.SyntaxKind.PropertyAssignment:
                var propertyAssignment = node;
                this.writeTabs(tabs);
                if (propertyAssignment.name.getText().match(/^\d/)) {
                    this.result += "[";
                    this.traverse(propertyAssignment.name, tabs, node);
                    this.result += "]";
                }
                else {
                    this.traverse(propertyAssignment.name, tabs, node);
                }
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
                        this.traverse(propertyDeclaration.initializer, tabs, node);
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
                this.writeQuotedString(stringLiteral.text);
                break;
            case ts.SyntaxKind.SuperKeyword:
                {
                    if (!this.currentClassDeclaration) {
                        this.addTextError(node, "Unexpected super keyword outside of a class declaration");
                        break;
                    }
                    this.writeHeritage(this.currentClassDeclaration, tabs, node);
                    this.result += ".constructor";
                    break;
                }
            case ts.SyntaxKind.TemplateExpression:
                {
                    var templateExpression = node;
                    // for (const templateSpan of templateExpression.templateSpans) {
                    if (templateExpression.head && templateExpression.head.text.length > 0) {
                        this.traverse(templateExpression.head, tabs, node);
                        if (templateExpression.templateSpans.length > 0)
                            this.result += " .. ";
                    }
                    this.writeArray(templateExpression.templateSpans, tabs, node, " .. ");
                    break;
                }
            case ts.SyntaxKind.TemplateHead:
                {
                    var templateHead = node;
                    this.writeQuotedString(templateHead.text);
                    break;
                }
            case ts.SyntaxKind.TemplateSpan:
                {
                    var templateSpan = node;
                    this.traverse(templateSpan.expression, tabs, node);
                    if (templateSpan.literal && templateSpan.literal.text.length > 0) {
                        this.result += " .. ";
                        this.writeQuotedString(templateSpan.literal.text);
                    }
                    break;
                }
            case ts.SyntaxKind.ThisKeyword:
                this.result += "self";
                break;
            case ts.SyntaxKind.TrueKeyword:
                this.result += "true";
                break;
            case ts.SyntaxKind.TypeAliasDeclaration:
                // Type alias declaration is not needed
                break;
            case ts.SyntaxKind.TypeAssertionExpression:
                {
                    var typeAssertionExpression = node;
                    this.traverse(typeAssertionExpression.expression, tabs, node);
                    break;
                }
            case ts.SyntaxKind.VariableDeclaration:
                var variableDeclaration = node;
                this.traverse(variableDeclaration.name, tabs, node, options);
                if (variableDeclaration.initializer) {
                    this.result += " = ";
                    this.traverse(variableDeclaration.initializer, tabs, node);
                }
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                var variableDeclarationList = node;
                this.writeArray(variableDeclarationList.declarations, tabs, node, ", ", options);
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
                if (this.hasExportModifier(variableStatement) && variableStatement.declarationList.declarations.every(function (x) { return x.initializer == undefined; })) {
                    for (var _k = 0, _l = variableStatement.declarationList.declarations; _k < _l.length; _k++) {
                        var declaration = _l[_k];
                        this.exportedVariables[declaration.name.getText()] = true;
                    }
                    break;
                }
                var isExport = this.writeLocalOrExport(variableStatement);
                this.traverse(variableStatement.declarationList, tabs, node, { export: isExport });
                this.result += "\n";
                break;
            case ts.SyntaxKind.WhileStatement:
                var whileStatement = node;
                this.writeTabs(tabs);
                this.result += "while ";
                this.traverse(whileStatement.expression, tabs, node);
                this.result += " do\n";
                this.traverse(whileStatement.statement, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.YieldExpression:
                var yieldExpression = node;
                this.result += "coroutine.yield(";
                if (yieldExpression.expression)
                    this.traverse(yieldExpression.expression, tabs, node);
                this.result += ")";
                break;
            default:
                this.writeTabs(tabs);
                this.addError(node);
                this.result += "{" + ts.SyntaxKind[node.kind] + "}\n";
                node.forEachChild(function (x) { return _this.traverse(x, tabs + 1, node); });
                break;
        }
    };
    LuaVisitor.prototype.writeHeritage = function (classExpression, tabs, node) {
        if (!classExpression.heritageClauses)
            return false;
        var found = false;
        for (var _i = 0, _a = classExpression.heritageClauses; _i < _a.length; _i++) {
            var heritage = _a[_i];
            if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                this.writeArray(heritage.types, tabs, node);
                found = true;
            }
        }
        return found;
    };
    LuaVisitor.prototype.writeLocalOrExport = function (node) {
        if (this.hasExportModifier(node)) {
            return true;
        }
        else {
            this.result += "local ";
            return false;
        }
    };
    LuaVisitor.prototype.hasExportModifier = function (node) {
        return node.modifiers && node.modifiers.some(function (x) { return x.kind === ts.SyntaxKind.ExportKeyword; });
    };
    LuaVisitor.prototype.writeQuotedString = function (text) {
        this.result += '"' + text.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    };
    return LuaVisitor;
}());
exports.LuaVisitor = LuaVisitor;
//# sourceMappingURL=luavisitor.js.map