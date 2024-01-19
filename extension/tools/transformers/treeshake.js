const { Transformer } = require('@parcel/plugin')

const allowed = require('../../package.json').messages

module.exports = new Transformer({
  async transform ({ asset }) {
    const messages = JSON.parse(await asset.getCode())

    // Remove all messages except ones used by the standard localization system
    for (const key in messages) {
      if (!allowed.includes(key)) {
        delete messages[key]
      }
    }

    asset.setCode(JSON.stringify(messages))
    asset.type = 'json'

    return [asset]
  }
})
