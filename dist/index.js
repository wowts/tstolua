"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
const luavisitor_1 = require("./luavisitor");
const path = require("path");
function reportDiagnostics(diagnostics) {
    diagnostics.forEach(diagnostic => {
        let message = "Error";
        if (diagnostic.file && diagnostic.start) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            message += ` ${diagnostic.file.fileName} (${line + 1},${character + 1})`;
        }
        message += ": " + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.error(message);
    });
}
const configFileName = path.resolve(process.argv[2] || "C:\\Program Files (x86)\\World of Warcraft Public Test\\Interface\\AddOns\\Ovale\\tsconfig.json");
// "d:/Applications/World of Warcraft/Interface/AddOns/Ovale/tsconfig.json"); 
const packageFileName = configFileName.replace(/tsconfig\.json$/, "package.json");
const packageFile = JSON.parse(fs.readFileSync(packageFileName).toString());
const version = packageFile.version;
const match = version.match(/(\d+)(?:\.(\d+))(?:\.(\d+))/);
let major, minor, patch;
let moduleVersion = 0;
if (match) {
    [major, minor, patch] = match;
    moduleVersion = (parseInt(major) * 100 + parseInt(minor)) * 100 + parseInt(patch);
}
else {
    console.error(`Can't parse package.json version number ${version}`);
    process.exit(1);
}
const configJson = fs.readFileSync(configFileName).toString();
const config = ts.parseConfigFileTextToJson(configFileName, configJson);
if (config.error) {
    reportDiagnostics([config.error]);
    process.exit(1);
}
const rootPath = path.dirname(configFileName);
const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, rootPath);
if (parsedConfig.errors.length) {
    reportDiagnostics(parsedConfig.errors);
    process.exit(1);
}
const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
// program.emit();
reportDiagnostics(program.getSyntacticDiagnostics());
reportDiagnostics(program.getSemanticDiagnostics());
// reportDiagnostics(program.getDeclarationDiagnostics());
const outDir = parsedConfig.options.outDir;
if (!outDir) {
    console.error("outDir option must be set");
    process.exit(1);
}
else {
    const sortedSources = [];
    const sources = [];
    const allSources = new Map();
    const checker = program.getTypeChecker();
    const rootDir = path.normalize(parsedConfig.options.rootDir || rootPath);
    function getModuleName(fullPath) {
        return path.normalize(fullPath).replace(rootDir, "").replace(/^[\\/]/, "").replace(/\.ts$/, "");
    }
    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile || sourceFile.fileName.match(/wow\.ts$/))
            continue; // TODO until it's in a package
        const moduleName = getModuleName(sourceFile.fileName);
        sourceFile.moduleName = "./" + moduleName.replace("\\", "/");
        const luaVisitor = new luavisitor_1.LuaVisitor(sourceFile, checker, moduleVersion);
        luaVisitor.traverse(sourceFile, 0, undefined);
        const relativePath = moduleName + ".lua";
        const outputPath = path.join(outDir, relativePath);
        if (!fs.existsSync(path.dirname(outputPath)))
            fs.mkdirSync(path.dirname(outputPath));
        fs.writeFileSync(outputPath, luaVisitor.getResult());
        for (const error of luaVisitor.errors) {
            console.error(error);
        }
        let source = allSources.get(moduleName);
        if (source == undefined) {
            source = { referencedBy: [], references: [], name: moduleName };
            allSources.set(moduleName, source);
        }
        const modules = sourceFile.resolvedModules;
        if (modules) {
            for (const [key, value] of modules.entries()) {
                if (value && !value.isExternalLibraryImport) {
                    const fileName = getModuleName(value.resolvedFileName);
                    let otherSource = allSources.get(fileName);
                    if (otherSource == undefined) {
                        otherSource = { referencedBy: [], references: [], name: fileName };
                        allSources.set(fileName, otherSource);
                    }
                    otherSource.referencedBy.push(source);
                    source.references.push(otherSource);
                }
            }
        }
        else {
            sources.push(source);
        }
    }
    // https://en.wikipedia.org/wiki/Topological_sorting
    while (sources.length > 0) {
        const source = sources.pop();
        if (!source)
            break;
        sortedSources.push(source);
        for (const reference of source.referencedBy) {
            reference.references.splice(reference.references.indexOf(source), 1);
            if (reference.references.length == 0) {
                sources.push(reference);
            }
        }
    }
    for (const source of allSources.values()) {
        if (source.references.length > 0) {
            console.error(`${source.name} has circular dependencies with ${source.references.map(x => x.name).join(",")}`);
        }
    }
    let fileList = `<Ui xmlns="http://www.blizzard.com/wow/ui/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.blizzard.com/wow/ui/ ..\\FrameXML\\UI.xsd">\n`;
    for (const source of sortedSources) {
        fileList += `   <Script file="${source.name}.lua"/>\n`;
    }
    fileList += `</Ui>`;
    fs.writeFileSync(path.join(outDir, "files.xml"), fileList);
}
//# sourceMappingURL=index.js.map