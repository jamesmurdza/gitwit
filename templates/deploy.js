const { execSync } = require("child_process")
const path = require("path")
const fs = require("fs")

// Get template name from command line args
const templateName = process.argv[2]

function deployTemplate(dir) {
  try {
    // Change to template directory
    process.chdir(dir)
    console.log(`Deploying template in ${dir}...`)

    // Run e2b template build
    execSync("e2b template build", { stdio: "inherit" })

    console.log(`Successfully deployed template in ${dir}`)
  } catch (error) {
    console.error(`Error deploying template in ${dir}:`, error.message)
    process.exit(1)
  }
}

// If template name is provided, deploy only that template
if (templateName) {
  const templateDir = path.join(__dirname, templateName)
  if (!fs.existsSync(templateDir)) {
    console.error(`Template directory ${templateName} not found`)
    process.exit(1)
  }
  if (!fs.existsSync(path.join(templateDir, "e2b.toml"))) {
    console.error(`No e2b.toml found in ${templateName}`)
    process.exit(1)
  }
  deployTemplate(templateDir)
} else {
  // Deploy all templates that have e2b.toml
  const entries = fs.readdirSync(__dirname, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const templateDir = path.join(__dirname, entry.name)
      if (fs.existsSync(path.join(templateDir, "e2b.toml"))) {
        deployTemplate(templateDir)
      }
    }
  }
}
