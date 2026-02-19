import * as monaco from "monaco-editor"

export function parseTSConfigToMonacoOptions(
  tsconfig: Record<string, unknown>
): monaco.languages.typescript.CompilerOptions {
  const compilerOptions: monaco.languages.typescript.CompilerOptions = {}

  const bool = (v: unknown): boolean | undefined =>
    typeof v === "boolean" ? v : undefined
  const str = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined
  const strArr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined

  // Map tsconfig options to Monaco CompilerOptions
  if (tsconfig.strict) compilerOptions.strict = bool(tsconfig.strict)
  if (tsconfig.target) compilerOptions.target = mapScriptTarget(str(tsconfig.target) ?? "")
  if (tsconfig.module) compilerOptions.module = mapModule(str(tsconfig.module) ?? "")
  if (tsconfig.lib) compilerOptions.lib = strArr(tsconfig.lib)
  if (tsconfig.allowJs) compilerOptions.allowJs = bool(tsconfig.allowJs)
  if (tsconfig.checkJs) compilerOptions.checkJs = bool(tsconfig.checkJs)
  if (tsconfig.jsx) compilerOptions.jsx = mapJSX(str(tsconfig.jsx))
  if (tsconfig.declaration) compilerOptions.declaration = bool(tsconfig.declaration)
  if (tsconfig.declarationMap)
    compilerOptions.declarationMap = bool(tsconfig.declarationMap)
  if (tsconfig.sourceMap) compilerOptions.sourceMap = bool(tsconfig.sourceMap)
  if (tsconfig.outFile) compilerOptions.outFile = str(tsconfig.outFile)
  if (tsconfig.outDir) compilerOptions.outDir = str(tsconfig.outDir)
  if (tsconfig.removeComments)
    compilerOptions.removeComments = bool(tsconfig.removeComments)
  if (tsconfig.noEmit) compilerOptions.noEmit = bool(tsconfig.noEmit)
  if (tsconfig.noEmitOnError)
    compilerOptions.noEmitOnError = bool(tsconfig.noEmitOnError)

  return compilerOptions
}

function mapScriptTarget(
  target: string
): monaco.languages.typescript.ScriptTarget {
  const targetMap: { [key: string]: monaco.languages.typescript.ScriptTarget } =
    {
      es3: monaco.languages.typescript.ScriptTarget.ES3,
      es5: monaco.languages.typescript.ScriptTarget.ES5,
      es6: monaco.languages.typescript.ScriptTarget.ES2015,
      es2015: monaco.languages.typescript.ScriptTarget.ES2015,
      es2016: monaco.languages.typescript.ScriptTarget.ES2016,
      es2017: monaco.languages.typescript.ScriptTarget.ES2017,
      es2018: monaco.languages.typescript.ScriptTarget.ES2018,
      es2019: monaco.languages.typescript.ScriptTarget.ES2019,
      es2020: monaco.languages.typescript.ScriptTarget.ES2020,
      esnext: monaco.languages.typescript.ScriptTarget.ESNext,
    }
  if (typeof target !== "string") {
    return monaco.languages.typescript.ScriptTarget.Latest
  }
  return (
    targetMap[target?.toLowerCase()] ||
    monaco.languages.typescript.ScriptTarget.Latest
  )
}

function mapModule(module: string): monaco.languages.typescript.ModuleKind {
  const moduleMap: { [key: string]: monaco.languages.typescript.ModuleKind } = {
    none: monaco.languages.typescript.ModuleKind.None,
    commonjs: monaco.languages.typescript.ModuleKind.CommonJS,
    amd: monaco.languages.typescript.ModuleKind.AMD,
    umd: monaco.languages.typescript.ModuleKind.UMD,
    system: monaco.languages.typescript.ModuleKind.System,
    es6: monaco.languages.typescript.ModuleKind.ES2015,
    es2015: monaco.languages.typescript.ModuleKind.ES2015,
    esnext: monaco.languages.typescript.ModuleKind.ESNext,
  }
  if (typeof module !== "string") {
    return monaco.languages.typescript.ModuleKind.ESNext
  }
  return (
    moduleMap[module.toLowerCase()] ||
    monaco.languages.typescript.ModuleKind.ESNext
  )
}

function mapJSX(jsx: string | undefined): monaco.languages.typescript.JsxEmit {
  if (!jsx || typeof jsx !== "string") {
    return monaco.languages.typescript.JsxEmit.React // Default value
  }

  const jsxMap: { [key: string]: monaco.languages.typescript.JsxEmit } = {
    preserve: monaco.languages.typescript.JsxEmit.Preserve,
    react: monaco.languages.typescript.JsxEmit.React,
    "react-native": monaco.languages.typescript.JsxEmit.ReactNative,
  }
  return jsxMap[jsx.toLowerCase()] || monaco.languages.typescript.JsxEmit.React
}

