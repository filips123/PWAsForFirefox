const { execSync } = require('child_process')
const { accessSync, constants: { F_OK, R_OK, W_OK }, readFileSync, writeFileSync } = require('fs')

const packagePath = './package.json'
const manifestPath = './src/manifest.json'
const neededPermissions = F_OK | R_OK | W_OK

let pwaVersion

if (process.argv.length >= 3) {
  // Use the first argument as a version
  pwaVersion = process.argv[2].toString()
} else {
  try {
    // No argument, try to find a version from git
    pwaVersion = execSync('git describe --tags --abbrev=0').toString()
  } catch (err) {
    console.error('No version provided and unable to retrieve git tag')
    throw err
  }
}

// Remove single leading v if it exists
pwaVersion = pwaVersion.trim().replace(/^v(.+)$/, '$1')

try {
  accessSync(packagePath, neededPermissions)
  accessSync(manifestPath, neededPermissions)
} catch (err) {
  console.error('Unable to access ./package.json and ./src/manifest.json')
  throw err
}

console.error(`Editing package.json version: '${pwaVersion}'`)
let packageText = readFileSync(packagePath).toString()
const packageJson = JSON.parse(packageText)
packageJson.version = pwaVersion
packageText = JSON.stringify(packageJson, null, 2)
writeFileSync(packagePath, packageText)

console.error(`Editing manifest.json version: '${pwaVersion}'`)
let manifestText = readFileSync(manifestPath).toString()
const manifestJson = JSON.parse(manifestText)
manifestJson.version = pwaVersion
manifestText = JSON.stringify(manifestJson, null, 2)
writeFileSync(manifestPath, manifestText)
