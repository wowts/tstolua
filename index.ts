import * as ts from "typescript";
import * as fs from "fs";
import { LuaVisitor } from "./luavisitor";
import * as path from "path";
import { option } from "commander";
import { PackageExtras, getAppName } from "./package-extra";

function reportDiagnostics(diagnostics: ReadonlyArray<ts.Diagnostic>): void {
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
const options = option("-j, --js", "Emit javascript")
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
    }

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

function emitProgram(sourceFiles: ReadonlyArray<ts.SourceFile>, outDir: string, typeChecker: ts.TypeChecker) {
    interface Source {
        name: string;
        references: Source[];
        referencedBy: Source[];
    }
    const sortedSources:Source[] = [];
    const sources: Source[] = [];
    const allSources = new Map<string, Source>();
    const rootDir = path.normalize(parsedConfig.options.rootDir || rootPath);

    function getModuleName(fullPath: string) {
        return path.normalize(fullPath).replace(rootDir, "").replace(/^[\\/]/,"").replace(/\.ts$/, "");
    }

    const packageExtras = new PackageExtras();

    for (const sourceFile of sourceFiles) {
        if (sourceFile.isDeclarationFile) continue;
        if (!parsedConfig.fileNames.some(x => x === sourceFile.fileName)) continue;
        const moduleName = getModuleName(sourceFile.fileName);
        sourceFile.moduleName = "./" + moduleName.replace("\\", "/");

        const luaVisitor = new LuaVisitor(sourceFile, typeChecker, appVersion, appName, rootDir, packageExtras);
        luaVisitor.traverse(sourceFile, 0, undefined);
        const relativePath = moduleName + ".lua";
        const outputPath = path.join(outDir, relativePath);
        if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath));
        fs.writeFileSync(outputPath, luaVisitor.getResult());
        for (const error of luaVisitor.errors) {
            console.error(error);
        }
        let source =  allSources.get(moduleName);
        if (source == undefined) {
            source = { referencedBy:[], references:[], name: moduleName };
            allSources.set(moduleName, source);
        }
        
        const modules = luaVisitor.imports;
        //const modules:Map<string, any> = (<any>sourceFile).resolvedModules;
        let hasDependencies = false;
        if (modules) {
           for (const value of modules) {
                if (value && value.hasCode && !value.isExternalLibraryImport && value.path) {
                    const fileName = getModuleName(value.path); //.resolvedFileName);
                    let otherSource = allSources.get(fileName);
                    if (otherSource == undefined) {
                        otherSource = <Source>{ referencedBy:[], references:[], name: fileName};
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
        if (!source) break;
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


function parsePackage(configFileName: string) {
    const packageFileName = path.join(path.dirname(configFileName), "package.json");
    const packageFile = JSON.parse(fs.readFileSync(packageFileName).toString());
    const version: string = packageFile.version;
    const match = version.match(/(\d+)(?:\.(\d+))(?:\.(\d+))/);
    let major: string, minor:string, patch:string;
    let appVersion = 0;
    if (match) {
        [,major, minor, patch] = match;
        appVersion = (parseInt(major) * 100 + parseInt(minor)) * 100 + parseInt(patch);
    }
    else {
        console.error(`Can't parse package.json version number ${version}`);
        process.exit(1);
    }
    const appName: string = getAppName(packageFile.name);
    return { appName, appVersion }
}