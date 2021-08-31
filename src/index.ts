import { program } from "commander";
import { compile } from "./compiler";

program
    .option("-j, --js", "Emit javascript")
    .option("-w, --watch", "Watch mode")
    .option(
        "-p, --project [tsconfig.json]",
        "tsproject.json path",
        "./tsconfig.json"
    )
    .option("-i, --install", "Install lua dependencies")
    .parse(process.argv);

const options = program.opts();
compile(options.project, options.watch, options.js, options.install);
