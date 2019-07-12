"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const luavisitor_1 = require("../../luavisitor");
const package_extra_1 = require("../../package-extra");
class TestCompilerHost {
    constructor(fileName, sourceFile) {
        this.files = new Map();
        this.writeFile = () => { };
        this.files.set(fileName, sourceFile);
    }
    getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
        return this.files.get(fileName);
    }
    getDefaultLibFileName(options) {
        return "test";
    }
    getCurrentDirectory() {
        return ".";
    }
    getDirectories(path) {
        throw new Error("Method not implemented.");
    }
    getCanonicalFileName(fileName) {
        return fileName;
    }
    useCaseSensitiveFileNames() {
        return true;
    }
    getNewLine() {
        throw new Error("Method not implemented.");
    }
    fileExists(fileName) {
        return this.files.has(fileName);
    }
    readFile(fileName) {
        throw new Error("Method not implemented.");
    }
}
exports.TestCompilerHost = TestCompilerHost;
function testTransform(t, source) {
    const fileName = "source.ts";
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2015, true);
    sourceFile.moduleName = "./source";
    const host = new TestCompilerHost(fileName, sourceFile);
    const program = ts.createProgram([fileName], { module: ts.ModuleKind.CommonJS, emitDecoratorMetadata: false }, host);
    t.deepEqual(program.getSyntacticDiagnostics(sourceFile).map(x => {
        return x.messageText + " at " + (x.file && x.start && x.file.getLineAndCharacterOfPosition(x.start).line);
    }), []);
    const visitor = new luavisitor_1.LuaVisitor(sourceFile, program.getTypeChecker(), 1, "test", "", new package_extra_1.PackageExtras());
    visitor.traverse(sourceFile, 0, undefined);
    return visitor.getResult();
}
exports.testTransform = testTransform;
//# sourceMappingURL=compiler.js.map