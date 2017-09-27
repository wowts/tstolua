import * as ts from "typescript";
import * as fs from "fs";
import { LuaVisitor } from "./luavisitor";
import * as path from "path";

function reportDiagnostics(diagnostics: ts.Diagnostic[]): void { 
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

const configFileName = path.join(process.cwd(), process.argv[2] || "..\\ovale-ts\\tsconfig.json");

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
program.emit();
const outDir = parsedConfig.options.outDir;
if (!outDir) {
    console.error("outDir option must be set");
    process.exit(1);
}
else { 
    let fileList = `<Ui xmlns="http://www.blizzard.com/wow/ui/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.blizzard.com/wow/ui/ ..\\FrameXML\\UI.xsd">\n`;
    
    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile || sourceFile.fileName.match(/wow\.ts$/)) continue; // TODO until it's in a package
        const luaVisitor = new LuaVisitor(sourceFile);
        luaVisitor.traverse(sourceFile, 0, undefined);
        const relativePath = path.normalize(sourceFile.fileName).replace(rootPath, "").replace(/\.ts$/, ".lua");
        const outputPath = path.join(outDir, relativePath);
        if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath));
        fs.writeFileSync(outputPath, luaVisitor.getResult());
        for (const error of luaVisitor.errors) {
            console.error(error);
        }
        fileList += `   <Script file="${relativePath}"/>\n`;
    }
    fileList += `</Ui>`;

    fs.writeFileSync(path.join(rootPath, "files.xml"), fileList);
}
