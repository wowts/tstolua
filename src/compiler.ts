import * as path from "path";
import { PackageExtras, parsePackage } from "./package-extra";
import ts from "typescript";
import * as fs from "fs";
import { LuaVisitor } from "./luavisitor";
import { Installer } from "./installer";

function reportDiagnostics(diagnostics: ReadonlyArray<ts.Diagnostic>): void {
    diagnostics.forEach((diagnostic) => {
        let message = "Error";
        if (diagnostic.file && diagnostic.start) {
            let {
                line,
                character,
            } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            message += ` ${diagnostic.file.fileName} (${line + 1},${
                character + 1
            })`;
        }
        message +=
            ": " +
            ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        console.error(message);
    });
}

function emitProgram(
    sourceFiles: ReadonlyArray<ts.SourceFile>,
    outDir: string,
    typeChecker: ts.TypeChecker,
    parsedConfig: ts.ParsedCommandLine,
    rootPath: string,
    appName: string,
    appVersion: number,
    packageExtras: PackageExtras
) {
    interface Source {
        name: string;
        references: Source[];
        referencedBy: Source[];
        empty: boolean;
    }
    const sortedSources: Source[] = [];
    const sources: Source[] = [];
    const allSources = new Map<string, Source>();
    const rootDir = path.normalize(parsedConfig.options.rootDir || rootPath);

    function getModuleName(fullPath: string) {
        return path
            .relative(rootDir, path.normalize(fullPath))
            .replace(/^[\\/]/, "")
            .replace(/\\/g, "/")
            .replace(/\.ts$/, "");
    }

    for (const sourceFile of sourceFiles) {
        if (sourceFile.isDeclarationFile) continue;
        if (!parsedConfig.fileNames.some((x) => x === sourceFile.fileName))
            continue;
        const moduleName = getModuleName(sourceFile.fileName);
        if (moduleName.startsWith("..")) continue;
        sourceFile.moduleName = "./" + moduleName;

        const luaVisitor = new LuaVisitor(
            sourceFile,
            typeChecker,
            appVersion,
            appName,
            rootDir,
            packageExtras
        );
        luaVisitor.traverse(sourceFile, 0, undefined);
        const relativePath = moduleName + ".lua";
        const outputPath = path.join(outDir, relativePath);
        const sourceCode = luaVisitor.getResult();
        if (sourceCode) {
            if (!fs.existsSync(path.dirname(outputPath)))
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, sourceCode);
        }
        for (const error of luaVisitor.errors) {
            console.error(error);
        }
        let source = allSources.get(moduleName);
        if (source == undefined) {
            source = {
                referencedBy: [],
                references: [],
                name: moduleName,
                empty: sourceCode.length === 0,
            };
            allSources.set(moduleName, source);
        } else {
            source.empty = sourceCode.length === 0;
        }

        const modules = luaVisitor.imports;
        //const modules:Map<string, any> = (<any>sourceFile).resolvedModules;
        let hasDependencies = false;
        if (modules) {
            for (const value of modules) {
                if (
                    value &&
                    value.hasCode &&
                    !value.isExternalLibraryImport &&
                    value.path
                ) {
                    const fileName = value.path; //.resolvedFileName);
                    let otherSource = allSources.get(fileName);
                    if (otherSource == undefined) {
                        otherSource = <Source>{
                            referencedBy: [],
                            references: [],
                            name: fileName,
                            empty: true,
                        };
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
            reference.references.splice(
                reference.references.indexOf(source),
                1
            );
            if (reference.references.length == 0) {
                sources.push(reference);
            }
        }
    }

    for (const source of allSources.values()) {
        if (source.references.length > 0) {
            console.error(
                `${
                    source.name
                } has circular dependencies with ${source.references
                    .map((x) => x.name)
                    .join(",")}`
            );
        }
    }

    let fileList = `<Ui xmlns="http://www.blizzard.com/wow/ui/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.blizzard.com/wow/ui/ ..\\FrameXML\\UI.xsd">\n`;
    for (const source of sortedSources) {
        if (source.empty) continue;
        fileList += `   <Script file="${source.name}.lua"/>\n`;
    }
    fileList += `</Ui>`;

    fs.writeFileSync(path.join(outDir, "files.xml"), fileList);
}

export async function compile(
    projectPath: string,
    watch?: boolean,
    js?: boolean,
    installDeps?: boolean
) {
    const configFileName = path.resolve(projectPath);

    const packageInfos = parsePackage(configFileName);

    const { appName, appVersion } = packageInfos;

    const configJson = fs.readFileSync(configFileName).toString();
    const config = ts.parseConfigFileTextToJson(configFileName, configJson);
    if (config.error) {
        reportDiagnostics([config.error]);
        process.exit(1);
    }

    const rootPath = path.dirname(configFileName);
    const parsedConfig = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        rootPath
    );
    if (parsedConfig.errors.length) {
        reportDiagnostics(parsedConfig.errors);
        process.exit(1);
    }
    const outDir = parsedConfig.options.outDir;
    if (!outDir) {
        throw "outDir option must be set";
    }

    const packageExtras = new PackageExtras();

    if (watch) {
        const host = ts.createWatchCompilerHost(
            configFileName,
            {},
            ts.sys,
            undefined,
            undefined,
            undefined
        );
        const originalCreateProgram = host.createProgram;
        host.createProgram = (rootNames, options, host, oldProgram) => {
            return originalCreateProgram(rootNames, options, host, oldProgram);
        };
        const origAfterProgramCreate = host.afterProgramCreate;
        host.afterProgramCreate = (program) => {
            origAfterProgramCreate && origAfterProgramCreate(program);
            if (
                program.getSemanticDiagnostics().length === 0 &&
                program.getSyntacticDiagnostics().length === 0
            ) {
                emitProgram(
                    program.getSourceFiles(),
                    outDir,
                    program.getProgram().getTypeChecker(),
                    parsedConfig,
                    rootPath,
                    appName,
                    appVersion,
                    packageExtras
                );
            }
        };

        ts.createWatchProgram(host);
    } else {
        const program = ts.createProgram(
            parsedConfig.fileNames,
            parsedConfig.options
        );

        reportDiagnostics(program.getSyntacticDiagnostics());
        reportDiagnostics(program.getSemanticDiagnostics());

        if (js) {
            program.emit();
        }
        emitProgram(
            program.getSourceFiles(),
            outDir,
            program.getTypeChecker(),
            parsedConfig,
            rootPath,
            appName,
            appVersion,
            packageExtras
        );

        if (installDeps) {
            const installer = new Installer(packageExtras, packageInfos);
            await installer.install(outDir);
        }
    }
}
