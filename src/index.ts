import { option } from "commander";
import { compile } from "./compiler";

const options = option("-j, --js", "Emit javascript")
    .option("-w, --watch", "Watch mode")
    .option(
        "-p, --project [tsconfig.json]",
        "tsproject.json path",
        "./tsconfig.json"
    )
    .option("-i, --install", "Install lua dependencies")

    .parse(process.argv);

compile(options.project, options.watch, options.js, options.install);
