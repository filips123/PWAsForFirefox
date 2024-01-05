const { Transformer } = require('@parcel/plugin')

module.exports = new Transformer({
  async transform ({ asset }) {
    asset.setCode('undefined')
    asset.type = 'raw'
    asset.sideEffects = false
    asset.isBundleSplittable = true
    asset.bundleBehavior = 'inline'
    return [asset]
  }
})
