const fs = require('fs')
import path from 'path'
import { Images } from './components/nodeImage'

export { Images }

var PluginOptions = {}

export default ({
    /**
     * Determines whether images are base64 encoded or utilized via url. Up to and 
     * including maxAssetSize, images will be base64 encoded and sent via route data.
     */
    maxAssetSize,
    /**
     * An array of transformation plugins consisting of:
     *      { name: "transform_name", location: path.resolve("path_to_transform") }
     */
    transforms
}) => {
    PluginOptions.MaxAssetSize = maxAssetSize || 100000

    PluginOptions.Transforms = transforms

    //Determines where files added to the transformation pipeline will be copied.
    PluginOptions.OutputRoot = null

    return {
        beforePrepareRoutes: (state) => {
            
            PluginOptions.OutputRoot = state.config.paths.DIST

            if(!PluginOptions.OutputRoot.endsWith("/")) {
                PluginOptions.OutputRoot += "/"
            }

            PluginOptions.OutputRoot += "static/"

            //The plugin will need access to the DIST folder early, so create
            //it if it doesn't exist
            if(!fs.existsSync(path.resolve(PluginOptions.OutputRoot))) {
                fs.mkdirSync(path.resolve(PluginOptions.OutputRoot), { recursive: true })
            }
        }
    }
}

export { PluginOptions }