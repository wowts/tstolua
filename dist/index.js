"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var fs = require("fs");
var luavisitor_1 = require("./luavisitor");
var path = require("path");
function reportDiagnostics(diagnostics) {
    diagnostics.forEach(function (diagnostic) {
        var message = "Error";
        if (diagnostic.file && diagnostic.start) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            message += " " + diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + ")";
        }
        message += ": " + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.error(message);
    });
}
var configFileName = path.resolve(process.argv[2] || "d:/Applications/World of Warcraft/Interface/AddOns/Ovale/tsconfig.json"); // "C:\\Program Files (x86)\\World of Warcraft\\Interface\\AddOns\\Ovale\\tsconfig.json");
var configJson = fs.readFileSync(configFileName).toString();
var config = ts.parseConfigFileTextToJson(configFileName, configJson);
if (config.error) {
    reportDiagnostics([config.error]);
    process.exit(1);
}
var rootPath = path.dirname(configFileName);
var parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, rootPath);
if (parsedConfig.errors.length) {
    reportDiagnostics(parsedConfig.errors);
    process.exit(1);
}
var program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
program.emit();
var outDir = parsedConfig.options.outDir;
if (!outDir) {
    console.error("outDir option must be set");
    process.exit(1);
}
else {
    var fileList = "<Ui xmlns=\"http://www.blizzard.com/wow/ui/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.blizzard.com/wow/ui/ ..\\FrameXML\\UI.xsd\">\n";
    var checker = program.getTypeChecker();
    for (var _i = 0, _a = program.getSourceFiles(); _i < _a.length; _i++) {
        var sourceFile = _a[_i];
        if (sourceFile.isDeclarationFile || sourceFile.fileName.match(/wow\.ts$/))
            continue; // TODO until it's in a package
        var moduleName = path.normalize(sourceFile.fileName).replace(rootPath, "").replace(/^[\\/]/, "").replace(/\.ts$/, "");
        sourceFile.moduleName = "./" + moduleName.replace("\\", "/");
        var luaVisitor = new luavisitor_1.LuaVisitor(sourceFile, checker);
        luaVisitor.traverse(sourceFile, 0, undefined);
        var relativePath = moduleName + ".lua";
        var outputPath = path.join(outDir, relativePath);
        if (!fs.existsSync(path.dirname(outputPath)))
            fs.mkdirSync(path.dirname(outputPath));
        fs.writeFileSync(outputPath, luaVisitor.getResult());
        for (var _b = 0, _c = luaVisitor.errors; _b < _c.length; _b++) {
            var error = _c[_b];
            console.error(error);
        }
        fileList += "   <Script file=\"" + relativePath + "\"/>\n";
    }
    fileList += "</Ui>";
    fs.writeFileSync(path.join(outDir, "files.xml"), fileList);
}
//# sourceMappingURL=index.js.map