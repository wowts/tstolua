# tstolua

This node module aims to transform a Typescript program to a Lua program. Its targets are World of Warcraft addons, that use Lua 5.1. In the current form, it only intend to support a subset of Typescript.

## Usage

`tstolua path/to/tsconfig.json`

The `outDir` property must be set. It will convert all the files to Lua in the `outDir` directory.
