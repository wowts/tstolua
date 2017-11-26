"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const path = require("path");
const typescript_1 = require("typescript");
/** Remove the team's name, and transform to PascalCase if there is a _ in the name */
function getAppName(input) {
    let moduleName = input.replace(/^@\w+\//, "");
    if (moduleName.indexOf("_") >= 0) {
        moduleName = moduleName.replace(/_db/g, "DB");
        moduleName = moduleName.replace(/_gui/g, "GUI");
        moduleName = moduleName.replace(/_(\w)/g, (_, x) => x.toUpperCase());
        moduleName = moduleName.replace(/^\w/, x => x.toUpperCase());
    }
    return moduleName;
}
exports.getAppName = getAppName;
var ModuleType;
(function (ModuleType) {
    ModuleType[ModuleType["WithoutObject"] = 0] = "WithoutObject";
    ModuleType[ModuleType["WithObject"] = 1] = "WithObject";
})(ModuleType || (ModuleType = {}));
const globalModules = {
    ["@wowts/table"]: ModuleType.WithObject,
    ["@wowts/string"]: ModuleType.WithObject,
    ["@wowts/coroutine"]: ModuleType.WithObject,
    ["@wowts/math"]: ModuleType.WithObject,
    ["@wowts/bit"]: ModuleType.WithObject,
    ["@wowts/wow-mock"]: ModuleType.WithoutObject,
    ["@wowts/lua"]: ModuleType.WithoutObject,
};
class LuaVisitor {
    constructor(sourceFile, typeChecker, moduleVersion, appName, rootDir) {
        this.sourceFile = sourceFile;
        this.typeChecker = typeChecker;
        this.moduleVersion = moduleVersion;
        this.appName = appName;
        this.rootDir = rootDir;
        this.result = "";
        this.imports = [];
        // private importedVariables: {[name:string]: string} = {};
        this.exportedVariables = {};
        this.hasExportDefault = false;
        this.classDeclarations = [];
        this.currentClassDeclaration = undefined;
        this.exports = [];
        this.errors = [];
        this.needClass = false;
        this.importedVariables = {};
        if (typeChecker) {
            const currentModule = typeChecker.getSymbolAtLocation(sourceFile);
            if (currentModule) {
                this.exports = typeChecker.getExportsOfModule(currentModule);
            }
        }
    }
    getResult() {
        let hasExportedVariables = this.hasExportDefault;
        for (const key in this.exportedVariables) {
            hasExportedVariables = true;
            break;
        }
        if (this.imports.length > 0 || hasExportedVariables || this.needClass) {
            //             const moduleName = this.sourceFile.moduleName;
            //             const modules = this.imports.map(x => (x.module.indexOf(".") == 0 ? "./" : "") + path.join(path.dirname(moduleName), x.module).replace("\\", "/"));
            //             if (this.imports.length > 0) {
            //                 this.result = `__addon.require("${moduleName}", { "${modules.join("\", \"")}" }, function(__exports, ${this.imports.map(x => x.variable).join(", ")})
            // ${this.result}end)
            // `;
            //             }
            //             else {
            //                 this.result = `__addon.require("${moduleName}", {}, function(__exports)
            // ${this.result}end)
            // `;
            //             }
            //             this.result = `local __addonName, __addon = ...
            //             ${this.result}`;
            let prehambule = "";
            if (hasExportedVariables) {
                let fullModuleName;
                if (this.sourceFile.moduleName === "./index") {
                    fullModuleName = this.appName;
                }
                else {
                    fullModuleName = `${this.appName}/${this.sourceFile.moduleName.replace(/^\.\//, "")}`;
                }
                prehambule += `local __exports = LibStub:NewLibrary("${fullModuleName}", ${this.moduleVersion})
if not __exports then return end
`;
            }
            if (this.needClass) {
                prehambule += "local __class = LibStub:GetLibrary(\"tslib\").newClass\n";
            }
            for (const imp of this.imports) {
                let moduleVariableName;
                if (imp.variables && imp.variables.every(x => x.usages == 0))
                    continue;
                if (globalModules[imp.module] === undefined) {
                    moduleVariableName = imp.variable || "__" + imp.module.replace(/^@\w+\//, "").replace(/[^\w]/g, "");
                    let fullModuleName;
                    if (imp.module.indexOf(".") == 0) {
                        fullModuleName = path.join(path.dirname(this.sourceFile.fileName), imp.module).replace(this.rootDir, "").replace(/\\/g, "/").replace(/^\//, "");
                        if (fullModuleName === "index") {
                            fullModuleName = this.appName;
                        }
                        else {
                            fullModuleName = `${this.appName}/${fullModuleName}`;
                        }
                        prehambule += `local ${moduleVariableName} = LibStub:GetLibrary("${fullModuleName}")\n`;
                    }
                    else {
                        let moduleName = getAppName(imp.module);
                        fullModuleName = `"${moduleName}"`;
                        if (globalModules[imp.module] === ModuleType.WithObject) {
                            prehambule += `local ${moduleVariableName} = LibStub:GetLibrary(${fullModuleName})\n`;
                        }
                        else {
                            prehambule += `local ${moduleVariableName} = LibStub:GetLibrary(${fullModuleName}, true)\n`;
                        }
                    }
                }
                else {
                    moduleVariableName = imp.module.replace(/^@\w+\//, "");
                }
                if (imp.variables) {
                    // Count usages because couldn't find how to filter out Interfaces or this kind of symbols
                    for (const variable of imp.variables.filter(x => x.usages > 0)) {
                        if (globalModules[imp.module] === ModuleType.WithoutObject) {
                            prehambule += `local ${variable.alias} = ${variable.name}\n`;
                        }
                        else {
                            prehambule += `local ${variable.alias} = ${moduleVariableName}.${variable.name}\n`;
                        }
                    }
                }
            }
            this.result = prehambule + this.result;
        }
        return this.result;
    }
    writeTabs(tabs) {
        for (let i = 0; i < tabs; i++)
            this.result += "    ";
    }
    addError(node) {
        this.addTextError(node, `Unsupported node ${ts.SyntaxKind[node.kind]}`);
    }
    addTextError(node, text) {
        const position = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
        this.errors.push(`${text} in ${this.sourceFile.fileName}:${position.line + 1}:${position.character + 1}`);
    }
    writeArray(array, tabs, parent, separator = ", ", options) {
        for (let i = 0; i < array.length; i++) {
            if (i > 0)
                this.result += separator;
            this.traverse(array[i], tabs, parent, options);
        }
    }
    writeClassMembers(members, tabs, node) {
        if (!this.currentClassDeclaration)
            throw Error("this.currentClassDeclaration must be defined");
        let constructorFound = false;
        let propertyFound = false;
        for (const member of members) {
            if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                const propertyDeclaration = member;
                if (propertyDeclaration.modifiers && propertyDeclaration.modifiers.some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                    if (propertyDeclaration.initializer !== undefined)
                        this.traverse(member, tabs, node);
                    continue;
                }
                if (propertyDeclaration.initializer != undefined)
                    propertyFound = true;
                continue;
            }
            if (member.kind === ts.SyntaxKind.Constructor) {
                constructorFound = true;
            }
            this.traverse(member, tabs, node);
        }
        if (propertyFound && !constructorFound) {
            this.writeTabs(tabs);
            if (this.currentClassDeclaration.heritageClauses && this.currentClassDeclaration.heritageClauses.find(x => x.token === ts.SyntaxKind.ExtendsKeyword)) {
                this.result += "constructor = function(self, ...)\n";
                this.writeTabs(tabs + 1);
                this.writeHeritage(this.currentClassDeclaration, tabs, node);
                this.result += ".constructor(self, ...)\n";
            }
            else {
                this.result += "constructor = function(self)\n";
            }
            for (const member of members) {
                if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                    const propertyDeclaration = member;
                    if (propertyDeclaration.modifiers && propertyDeclaration.modifiers.some(x => x.kind === ts.SyntaxKind.StaticKeyword))
                        continue;
                    if (propertyDeclaration.initializer === undefined)
                        continue;
                    this.traverse(member, tabs + 1, node);
                }
            }
            this.writeTabs(tabs);
            this.result += "end\n";
        }
    }
    traverse(node, tabs, parent, options) {
        node.parent = parent;
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
                const arrayBindingPattern = node;
                this.writeArray(arrayBindingPattern.elements, tabs, node);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                const arrayLiteralExpression = node;
                this.writeArray(arrayLiteralExpression.elements, tabs, node);
                break;
            case ts.SyntaxKind.ArrowFunction:
                const arrowFunction = node;
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
                const binary = node;
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
                        {
                            const leftType = this.typeChecker.getTypeAtLocation(binary.left);
                            const rightType = this.typeChecker.getTypeAtLocation(binary.right);
                            if ((leftType.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) || (rightType.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral))) {
                                this.result += " .. ";
                            }
                            else {
                                this.result += " + ";
                            }
                            break;
                        }
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
                const bindingElement = node;
                this.traverse(bindingElement.name, tabs, node);
                break;
            case ts.SyntaxKind.Block:
                const block = node;
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
                {
                    const callExpression = node;
                    const text = callExpression.expression.getText();
                    if (text === "lualength") {
                        this.result += "#";
                        this.writeArray(callExpression.arguments, tabs, node);
                    }
                    else if (text === "truthy") {
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
                }
            case ts.SyntaxKind.ClassDeclaration:
                {
                    const classExpression = node;
                    if (this.currentClassDeclaration) {
                        this.classDeclarations.push(this.currentClassDeclaration);
                    }
                    this.currentClassDeclaration = classExpression;
                    let className = undefined;
                    let isExport = false;
                    if (classExpression.name) {
                        isExport = this.writeLocalOrExport(classExpression);
                        this.traverse(classExpression.name, tabs, node);
                        className = classExpression.name.text;
                        if (isExport) {
                            this.exportedVariables[className] = true;
                        }
                        this.result += " = ";
                    }
                    this.needClass = true;
                    this.result += "__class(";
                    if (!this.writeHeritage(classExpression, tabs, node)) {
                        this.result += "nil";
                    }
                    this.result += ", {\n";
                    this.writeClassMembers(classExpression.members, tabs + 1, node);
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
                    const classExpression = node;
                    if (this.currentClassDeclaration) {
                        this.classDeclarations.push(this.currentClassDeclaration);
                    }
                    this.currentClassDeclaration = classExpression;
                    this.needClass = true;
                    this.result += "__class(";
                    if (classExpression.heritageClauses) {
                        this.writeHeritage(classExpression, tabs, node);
                    }
                    else {
                        this.result += "nil";
                    }
                    this.result += ", {\n";
                    this.writeClassMembers(classExpression.members, tabs + 1, node);
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
                const computedPropertyName = node;
                this.result += "[";
                this.traverse(computedPropertyName.expression, tabs, node);
                this.result += "]";
                break;
            case ts.SyntaxKind.Constructor:
                {
                    const constr = node;
                    this.writeTabs(tabs);
                    this.result += "constructor = function(self";
                    if (constr.parameters.length > 0) {
                        this.result += ", ";
                        this.writeArray(constr.parameters, tabs, node);
                    }
                    this.result += ")\n";
                    for (const parameter of constr.parameters) {
                        if (parameter.modifiers && parameter.modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword || x.kind === ts.SyntaxKind.PublicKeyword)) {
                            this.writeTabs(tabs + 1);
                            this.result += `self.${parameter.name.getText()} = ${parameter.name.getText()}\n`;
                        }
                    }
                    if (constr.parent) {
                        for (const member of constr.parent.members) {
                            if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                                const propertyDeclaration = member;
                                if (propertyDeclaration.initializer === undefined)
                                    continue;
                                if (propertyDeclaration.modifiers !== undefined && propertyDeclaration.modifiers.some(x => x.kind === ts.SyntaxKind.StaticKeyword))
                                    continue;
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
                    const deleteExpression = node;
                    this.traverse(deleteExpression.expression, tabs, node);
                    this.result += " = nil";
                    break;
                }
            case ts.SyntaxKind.DoStatement:
                {
                    const doStatement = node;
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
                const elementAccessExpression = node;
                this.traverse(elementAccessExpression.expression, tabs, node);
                this.result += '[';
                if (elementAccessExpression.argumentExpression) {
                    this.traverse(elementAccessExpression.argumentExpression, tabs, node);
                }
                this.result += ']';
                break;
            case ts.SyntaxKind.EndOfFileToken:
                break;
            case ts.SyntaxKind.ExportAssignment:
                {
                    const exportAssignment = node;
                    this.writeTabs(tabs);
                    this.result += "for k,v in pairs(";
                    this.traverse(exportAssignment.expression, tabs, node);
                    this.result += ") do __exports[k] = v end\n";
                    this.hasExportDefault = true;
                    break;
                }
            case ts.SyntaxKind.ExpressionStatement:
                this.writeTabs(tabs);
                this.traverse(node.expression, tabs, node);
                this.result += "\n";
                break;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                {
                    const expressionWithTypeArguments = node;
                    this.traverse(expressionWithTypeArguments.expression, tabs, node);
                    break;
                }
            case ts.SyntaxKind.FalseKeyword:
                this.result += "false";
                break;
            case ts.SyntaxKind.FirstLiteralToken:
                const firstLiteralToken = node;
                this.result += firstLiteralToken.text;
                break;
            case ts.SyntaxKind.FirstTemplateToken:
                const firstTemplateToken = node;
                this.result += `[[${firstTemplateToken.text}]]`;
                break;
            case ts.SyntaxKind.ForStatement:
                const forStatement = node;
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
                const binaryCondition = forStatement.condition;
                if (!forStatement.incrementor) {
                    this.addTextError(node, "for statement needs an incrementor");
                    break;
                }
                if (forStatement.incrementor.kind !== ts.SyntaxKind.BinaryExpression) {
                    this.addTextError(node, "for statement incrementor must be a binary expression");
                    break;
                }
                const binaryIncrementor = forStatement.incrementor;
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
                const forOfStatement = node;
                if (forOfStatement.initializer.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                    const initializer = forOfStatement.initializer;
                    if (initializer.elements.length === 0) {
                        this.result += "_";
                    }
                }
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
                    const functionDeclaration = node;
                    if (!functionDeclaration.body)
                        break;
                    const isExport = this.writeLocalOrExport(functionDeclaration);
                    if (functionDeclaration.name) {
                        if (!isExport)
                            this.result += "function ";
                        this.traverse(functionDeclaration.name, tabs, node, { export: isExport });
                    }
                    if (isExport) {
                        this.result += " = function(";
                    }
                    else {
                        this.result += "(";
                    }
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
                const functionExpression = node;
                this.result += "function(";
                this.writeArray(functionExpression.parameters, tabs, node);
                this.result += ")\n";
                this.traverse(functionExpression.body, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.Identifier:
                const identifier = node;
                if (identifier.text === "rest") {
                    this.result += "...";
                }
                else if (identifier.text === "undefined") {
                    this.result += "nil";
                }
                else if (identifier.text === "__args") {
                    this.result += "...";
                }
                else {
                    if (this.typeChecker) {
                        const symbol = this.typeChecker.getSymbolAtLocation(node);
                        if (symbol) {
                            if (this.exports.indexOf(symbol) >= 0) {
                                this.result += "__exports.";
                            }
                            this.typeChecker.getRootSymbols(symbol);
                            if ((symbol.flags & ts.SymbolFlags.AliasExcludes) && this.importedVariables[identifier.text]) {
                                this.importedVariables[identifier.text].usages++;
                            }
                        }
                    }
                    if (options && options.export)
                        this.exportedVariables[identifier.text] = true;
                    this.result += identifier.text;
                }
                break;
            case ts.SyntaxKind.IfStatement:
                const ifStatement = node;
                if (!options || !options.elseIf) {
                    this.writeTabs(tabs);
                    this.result += "if ";
                }
                this.traverse(ifStatement.expression, tabs, node);
                this.result += " then\n";
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
                const importClause = node;
                break;
            case ts.SyntaxKind.ImportDeclaration:
                const importDeclaration = node;
                if (!importDeclaration.importClause)
                    break;
                const module = importDeclaration.moduleSpecifier;
                // if (module.text == "addon" && importDeclaration.importClause.name) {
                //     this.addonModule = importDeclaration.importClause.name.text;
                // }
                // else 
                {
                    if (importDeclaration.importClause.name) {
                        this.imports.push({ module: module.text, variable: importDeclaration.importClause.name.text });
                    }
                    else if (importDeclaration.importClause.namedBindings) {
                        // const moduleName =  "__" + module.text.replace(/[^\w]/g, "");
                        const variables = [];
                        this.imports.push({ module: module.text, variables: variables });
                        const importClauseNamedBindings = importDeclaration.importClause.namedBindings;
                        if (typescript_1.isNamedImports(importClauseNamedBindings)) {
                            const namedImports = importClauseNamedBindings;
                            for (const variable of namedImports.elements) {
                                const propertyName = variable.propertyName;
                                const description = { name: propertyName ? propertyName.text : variable.name.text, usages: 0, alias: variable.name.text };
                                variables.push(description);
                                this.importedVariables[description.alias] = description;
                            }
                        }
                        else {
                            this.addError(importClauseNamedBindings);
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
                const objectLiteralExpression = node;
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
            case ts.SyntaxKind.OmittedExpression:
                this.result += "_";
                break;
            case ts.SyntaxKind.MethodDeclaration:
                const methodDeclaration = node;
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
                const newExpression = node;
                this.traverse(newExpression.expression, tabs, node);
                this.result += "(";
                if (newExpression.arguments)
                    this.writeArray(newExpression.arguments, tabs, node);
                this.result += ")";
                break;
            case ts.SyntaxKind.Parameter:
                const parameter = node;
                this.traverse(parameter.name, tabs, node);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                const parenthesizedExpression = node;
                this.result += '(';
                this.traverse(parenthesizedExpression.expression, tabs, node);
                this.result += ')';
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
                const prefixUnaryExpression = node;
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
                {
                    const access = node;
                    this.traverse(access.expression, tabs, node);
                    let isMethodCall = false;
                    if (options && options.callee) {
                        // const symbol = this.typeChecker.getSymbolAtLocation(access.expression);
                        // if (symbol) {
                        //     const typeOfSymbol = this.typeChecker.getTypeOfSymbolAtLocation(symbol, access.expression);
                        //     const property = typeOfSymbol.getProperty(access.name.text);
                        //     if (property && (property.flags & ts.SymbolFlags.Method)) {
                        //         isMethodCall = true;
                        //     }
                        // }
                        const symbol = this.typeChecker.getSymbolAtLocation(access);
                        if (symbol !== undefined) {
                            isMethodCall = (symbol.getFlags() & ts.SymbolFlags.Method) > 0;
                        }
                        else {
                            this.addTextError(node, "Unable to know the type of this expression");
                        }
                    }
                    this.result += isMethodCall ? ":" : ".";
                    this.result += access.name.text;
                    break;
                }
            case ts.SyntaxKind.PropertyAssignment:
                const propertyAssignment = node;
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
                    const propertyDeclaration = node;
                    if (propertyDeclaration.initializer) {
                        this.writeTabs(tabs);
                        const staticProperty = propertyDeclaration.modifiers && propertyDeclaration.modifiers.some(x => x.kind === ts.SyntaxKind.StaticKeyword);
                        if (!staticProperty)
                            this.result += "self.";
                        this.traverse(propertyDeclaration.name, tabs, node);
                        this.result += " = ";
                        this.traverse(propertyDeclaration.initializer, tabs, node);
                        if (staticProperty)
                            this.result += ",";
                        this.result += "\n";
                    }
                    break;
                }
            case ts.SyntaxKind.RegularExpressionLiteral:
                {
                    const regularExpressionLiteral = node;
                    this.result += "Regex(";
                    this.writeQuotedString(regularExpressionLiteral.text);
                    this.result += ")";
                    break;
                }
            case ts.SyntaxKind.ReturnStatement:
                this.writeTabs(tabs);
                this.result += "return ";
                const returnStatement = node;
                if (returnStatement.expression) {
                    this.traverse(returnStatement.expression, tabs, node);
                }
                this.result += "\n";
                break;
            case ts.SyntaxKind.SourceFile:
                node.forEachChild(x => this.traverse(x, tabs, node));
                break;
            case ts.SyntaxKind.SpreadElement:
                const spreadElement = node;
                this.traverse(spreadElement.expression, tabs, node);
                break;
            case ts.SyntaxKind.StringLiteral:
                const stringLiteral = node;
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
                    const templateExpression = node;
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
                    const templateHead = node;
                    this.writeQuotedString(templateHead.text);
                    break;
                }
            case ts.SyntaxKind.TemplateSpan:
                {
                    const templateSpan = node;
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
                    const typeAssertionExpression = node;
                    this.traverse(typeAssertionExpression.expression, tabs, node);
                    break;
                }
            case ts.SyntaxKind.VariableDeclaration:
                const variableDeclaration = node;
                if (variableDeclaration.name.kind === ts.SyntaxKind.ArrayBindingPattern) {
                    const arrayBindingPattern = variableDeclaration.name;
                    if (arrayBindingPattern.elements.length == 0)
                        this.result += "_";
                }
                this.traverse(variableDeclaration.name, tabs, node, options);
                if (variableDeclaration.initializer) {
                    this.result += " = ";
                    this.traverse(variableDeclaration.initializer, tabs, node);
                }
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                const variableDeclarationList = node;
                this.writeArray(variableDeclarationList.declarations, tabs, node, ", ", options);
                break;
            case ts.SyntaxKind.VariableStatement:
                const variableStatement = node;
                this.writeTabs(tabs);
                // if (variableStatement.declarationList.declarations.length === 1) {
                //     const variableDeclaration = variableStatement.declarationList.declarations[0];
                //     if (variableDeclaration.initializer && variableDeclaration.initializer.kind === ts.SyntaxKind.Identifier) {
                //         const identifier = <ts.Identifier>variableDeclaration.initializer;
                //         if (identifier.text === this.addonModule) {
                //             const left = <ts.ArrayBindingPattern>variableDeclaration.name
                //             this.addonNameVariable = (<ts.BindingElement>left.elements[0]).name.getText();
                //             this.addonVariable = (<ts.BindingElement>left.elements[1]).name.getText();
                //             break;
                //         }
                //     }                    
                // }
                if (this.hasExportModifier(variableStatement) && variableStatement.declarationList.declarations.every(x => x.initializer == undefined)) {
                    for (const declaration of variableStatement.declarationList.declarations) {
                        this.exportedVariables[declaration.name.getText()] = true;
                    }
                    break;
                }
                const isExport = this.writeLocalOrExport(variableStatement);
                this.traverse(variableStatement.declarationList, tabs, node, { export: isExport });
                this.result += "\n";
                break;
            case ts.SyntaxKind.WhileStatement:
                const whileStatement = node;
                this.writeTabs(tabs);
                this.result += "while ";
                this.traverse(whileStatement.expression, tabs, node);
                this.result += " do\n";
                this.traverse(whileStatement.statement, tabs + 1, node);
                this.writeTabs(tabs);
                this.result += "end\n";
                break;
            case ts.SyntaxKind.YieldExpression:
                const yieldExpression = node;
                this.result += "coroutine.yield(";
                if (yieldExpression.expression)
                    this.traverse(yieldExpression.expression, tabs, node);
                this.result += ")";
                break;
            default:
                this.writeTabs(tabs);
                this.addError(node);
                this.result += "{" + ts.SyntaxKind[node.kind] + "}\n";
                node.forEachChild(x => this.traverse(x, tabs + 1, node));
                break;
        }
    }
    writeHeritage(classExpression, tabs, node) {
        if (!classExpression.heritageClauses)
            return false;
        let found = false;
        for (const heritage of classExpression.heritageClauses) {
            if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                this.writeArray(heritage.types, tabs, node);
                found = true;
            }
        }
        return found;
    }
    writeLocalOrExport(node) {
        if (this.hasExportModifier(node)) {
            return true;
        }
        else {
            this.result += "local ";
            return false;
        }
    }
    hasExportModifier(node) {
        return node.modifiers && node.modifiers.some(x => x.kind === ts.SyntaxKind.ExportKeyword);
    }
    writeQuotedString(text) {
        this.result += '"' + text.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/"/g, '\\"') + '"';
    }
}
exports.LuaVisitor = LuaVisitor;
//# sourceMappingURL=luavisitor.js.map