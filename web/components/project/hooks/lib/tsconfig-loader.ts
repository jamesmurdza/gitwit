import {
  defaultCompilerOptions,
} from "@/lib/monaco/config"
import { parseTSConfigToMonacoOptions } from "@/lib/monaco/parse-tsconfig"
import { TFile, TFolder } from "@/lib/types"
import { deepMerge } from "@/lib/utils"
import * as monaco from "monaco-editor"

/**
 * Loads and merges all tsconfig.json files, including references,
 * then applies the merged compiler options to Monaco's TypeScript defaults.
 */
export async function loadAndApplyTSConfig(
  files: (TFolder | TFile)[],
  monacoInstance: typeof monaco,
  fetchFileContent: (fileId: string) => Promise<string>,
): Promise<void> {
  const tsconfigFiles = files.filter((file) =>
    file.name.endsWith("tsconfig.json"),
  )
  let mergedConfig: any = { compilerOptions: {} }

  for (const file of tsconfigFiles) {
    const content = await fetchFileContent(file.id)

    try {
      let tsConfig = JSON.parse(content)

      // Handle references
      if (tsConfig.references) {
        for (const ref of tsConfig.references) {
          const path = ref.path.replace("./", "")
          const refContent = await fetchFileContent(path)
          const referenceTsConfig = JSON.parse(refContent)
          mergedConfig = deepMerge(mergedConfig, referenceTsConfig)
        }
      }

      mergedConfig = deepMerge(mergedConfig, tsConfig)
    } catch (error) {
      console.error("Error parsing TSConfig:", error)
    }
  }

  if (mergedConfig.compilerOptions) {
    const updatedOptions = parseTSConfigToMonacoOptions({
      ...defaultCompilerOptions,
      ...mergedConfig.compilerOptions,
    })
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions(
      updatedOptions,
    )
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions(
      updatedOptions,
    )
  }
}
