const { generateFonts } = require('@twbs/fantasticon')

const path = require('path')
const fs = require('fs')
const os = require('os')

const packageJson = require('../package.json')
const targetDir = path.join(__dirname, '../src/icons/')

const bootstrapSvgs = path.join(__dirname, '../node_modules/bootstrap-icons/icons/')
const selectedIcons = fs.mkdtempSync(path.join(os.tmpdir(), 'ffpwa-bootstrap-icons'))
const bootstrapCodepoints = require('bootstrap-icons/font/bootstrap-icons.json')
const selectedCodepoints = {}

async function generateIcons () {
  for (const icon of packageJson.icons) {
    await fs.promises.copyFile(path.join(bootstrapSvgs, `${icon}.svg`), path.join(selectedIcons, `${icon}.svg`))
    selectedCodepoints[icon] = bootstrapCodepoints[icon]
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  await generateFonts({
    name: 'bootstrap-icons',
    fontTypes: ['woff2'],
    assetTypes: ['css'],
    prefix: 'bi',
    selector: '.bi',
    codepoints: selectedCodepoints,
    inputDir: selectedIcons,
    outputDir: targetDir,
    templates: { css: path.join(__dirname, './_css.hbs') }
  })
}

generateIcons().finally(() => {
  fs.rmSync(selectedIcons, { recursive: true })
})
