"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
const luavisitor_1 = require("./luavisitor");
const path = require("path");
const commander_1 = require("commander");
const package_extra_1 = require("./package-extra");
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
const options = commander_1.option("-j, --js", "Emit javascript")
    .option("-w, --watch", "Watch mode")
    .option("-p, --project [tsconfig.json]", "tsproject.json path", "./tsconfig.json")
    .parse(process.argv);
const configFileName = path.resolve(options.project);
const { appName, appVersion } = parsePackage(configFileName);
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
const outDir = parsedConfig.options.outDir;
if (!outDir) {
    throw "outDir option must be set";
}
if (options.watch) {
    const createProgram = ts.createSemanticDiagnosticsBuilderProgram;
    let error = false;
    const host = ts.createWatchCompilerHost(configFileName, {}, ts.sys, undefined, undefined, undefined);
    const originalCreateProgram = host.createProgram;
    host.createProgram = (rootNames, options, host, oldProgram) => {
        return originalCreateProgram(rootNames, options, host, oldProgram);
    };
    const origAfterProgramCreate = host.afterProgramCreate;
    host.afterProgramCreate = program => {
        origAfterProgramCreate && origAfterProgramCreate(program);
        if (program.getSemanticDiagnostics().length === 0 && program.getSyntacticDiagnostics().length === 0) {
            emitProgram(program.getSourceFiles(), outDir, program.getProgram().getTypeChecker());
        }
    };
    ts.createWatchProgram(host);
}
else {
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    // program.emit();
    reportDiagnostics(program.getSyntacticDiagnostics());
    reportDiagnostics(program.getSemanticDiagnostics());
    // reportDiagnostics(program.getDeclarationDiagnostics());
    if (options.js) {
        program.emit();
    }
    emitProgram(program.getSourceFiles(), outDir, program.getTypeChecker());
}
function emitProgram(sourceFiles, outDir, typeChecker) {
    const sortedSources = [];
    const sources = [];
    const allSources = new Map();
    const rootDir = path.normalize(parsedConfig.options.rootDir || rootPath);
    function getModuleName(fullPath) {
        return path.normalize(fullPath).replace(rootDir, "").replace(/^[\\/]/, "").replace(/\.ts$/, "");
    }
    const packageExtras = new package_extra_1.PackageExtras();
    for (const sourceFile of sourceFiles) {
        if (sourceFile.isDeclarationFile)
            continue;
        if (!parsedConfig.fileNames.some(x => x === sourceFile.fileName))
            continue;
        const moduleName = getModuleName(sourceFile.fileName);
        sourceFile.moduleName = "./" + moduleName.replace("\\", "/");
        const luaVisitor = new luavisitor_1.LuaVisitor(sourceFile, typeChecker, appVersion, appName, rootDir, packageExtras);
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
        const modules = luaVisitor.imports;
        //const modules:Map<string, any> = (<any>sourceFile).resolvedModules;
        let hasDependencies = false;
        if (modules) {
            for (const value of modules) {
                if (value && !value.isExternalLibraryImport) {
                    const fileName = getModuleName(value.module); //.resolvedFileName);
                    let otherSource = allSources.get(fileName);
                    if (otherSource == undefined) {
                        otherSource = { referencedBy: [], references: [], name: fileName };
                        allSources.set(fileName, otherSource);
                    }
                    otherSource.referencedBy.push(source);
                    source.references.push(otherSource);
                    hasDependencies = true;
                }
            }
        }
        if (!hasDependencies) {
            sources.push(source);
        }
    }
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
function parsePackage(configFileName) {
    const packageFileName = path.join(path.dirname(configFileName), "package.json");
    const packageFile = JSON.parse(fs.readFileSync(packageFileName).toString());
    const version = packageFile.version;
    const match = version.match(/(\d+)(?:\.(\d+))(?:\.(\d+))/);
    let major, minor, patch;
    let appVersion = 0;
    if (match) {
        [, major, minor, patch] = match;
        appVersion = (parseInt(major) * 100 + parseInt(minor)) * 100 + parseInt(patch);
    }
    else {
        console.error(`Can't parse package.json version number ${version}`);
        process.exit(1);
    }
    const appName = package_extra_1.getAppName(packageFile.name);
    return { appName, appVersion };
}
//# sourceMappingURL=index.js.map