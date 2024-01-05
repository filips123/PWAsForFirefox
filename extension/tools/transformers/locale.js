const { Transformer } = require('@parcel/plugin')
const json5 = require('json5')

module.exports = new Transformer({
  async transform ({ asset }) {
    const messages = json5.parse(await asset.getCode())

    for (const key in messages) {
      // Remove unnecessary message descriptions
      delete messages[key].description

      // Remove unnecessary placeholder examples
      for (const placeholder in messages[key].placeholders) delete messages[key].placeholders[placeholder].example
    }

    asset.setCode(JSON.stringify(messages))
    asset.type = 'json'

    return [asset]
  }
})
