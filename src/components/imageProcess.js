/*
 * This file will be forked from nodeImage.js to process images.
 */
import Jimp from 'jimp'
import path from 'path'
const fs = require('fs')
import hashSum from 'hash-sum'
import { TransformableImage, TransformableImagesMap } from './transformableImage'

process.on("message", async (message) => {
    await imageProcess(message)
})

/**
 * Exported for testing purposes. Will typically be called as a result of receiving
 * a process message. 
 */
export default async function imageProcess(message) {

    //For performance, assumes that all inputs have already been validated and that
    //the existence of the source has been checked.

    var id = message.id

    var sourcePath = message.value

    let maxAssetSize = message.maxAssetSize

    let outputRoot = message.outputRoot

    let transform = null

    if(message.transform !== undefined && message.transform !== null) {

        //User can elect to not apply any transforms, but if the transform
        //is defined, then validate and load.

        if(!fs.existsSync(message.transform)) {
            throw new Error(`Transform '${message.transform}' does not exist.`)
        }

        transform = require(message.transform)

        if(transform.default === undefined || transform.default === null) {
            throw new Error("Transform must export a default function.")
        }

        if(typeof transform.default !== "function") {
            throw new Error("Transform must be a function.")
        }
    }

    var transformOptions = message.transformOptions

    var operations = [] //holds promises regarding file operations

    //For performance reasons, filesystem functions assume that the files they are accessing exist.

    if(transform === null) {
        //If no transform is selected, then simply copy the file.

        var result = {
            _ReactStaticImage: true,
            id: id,
            image: { data: await copyFile(outputRoot, sourcePath, operations, maxAssetSize) }
        }

        await Promise.all(operations)
        
        process.send(result)
        
        //Return for testing. Typical usage will receive a result via
        //process.send above.
        return result

    } else {
        var promise = Jimp.read(sourcePath).then(async (image) => {
            
            //Provide the image to the transform and obtain a result
            var result = transform.default({ image: new TransformableImage(image, path.basename(sourcePath)), options: transformOptions })
          
            /* For performance reasons, prefer direct conversions of images rather than a recursive function
            to traverse the result object and convert all images. */

            result._ReactStaticImage = true
            result.id = id

            if(result.image) {
                result.image = { data: await getUrlOrConvertToBase64(outputRoot, "image", result.image, operations, maxAssetSize), width: result.image.getWidth(), height: result.image.getHeight() }
            }

            if(result.placeholder) {
                //Set the filename of the placeholder so that the original image isn't overwritten.
                result.placeholder = result.placeholder.setFileName(result.placeholder.getFileName() + "_placeholder" + result.placeholder.getExtension())
                result.placeholder = { data: await getUrlOrConvertToBase64(outputRoot, "placeholder", result.placeholder, operations, maxAssetSize), width: result.placeholder.getWidth(), height: result.placeholder.getHeight() }
            }

            if(result.responsive) {
                var replacement = []
                for(let i = 0; i < result.responsive.length; i++) {
                    
                    //The responsive images are returned as an array of TransformableImages. The <Image /> component
                    //requires the responsive array to be in the form of objects containing an image, and the width
                    //and height of the image. Additionally, the file name of each responsive TransformableImage needs
                    //to be altered so that the original images aren't overwritten.
                    result.responsive[i] = result.responsive[i].setFileName(result.responsive[i].getFileName() + "_" + i + result.responsive[i].getExtension())
                    let img = await getUrlOrConvertToBase64(outputRoot, `responsive[${i}]`, result.responsive[i], operations, maxAssetSize)
                    replacement.push({ data: img, width: result.responsive[i].getWidth(), height: result.responsive[i].getHeight() })
                }

                result.responsive = replacement
            }

            await Promise.all(operations)
            
            process.send(result)
            
            //Return for testing. Typical usage will receive a result via
            //process.send above.
            return result
        
        }).catch((error) => { 
            console.log(`Warning: Processing image '${sourcePath}' produced an error: `, error)

            //Indicate that image transformation process should be halted.
            process.send({ error: true })
        })

        //Return for testing. Typical usage will receive a result via
        //process.send above.
        return await promise
    }


}

/**
  * Given a path, either copies the file and returns a url to reference it, or returns a 
  * base64 representation if the file is small enough (as determined by the plugin option, 
  * maxAssetSize).
  */
async function copyFile(outputRoot, src, operations, maxAssetSize) {
    var outputPath = path.join(outputRoot, path.basename(src))
   
    var imgSize = fs.statSync(src).size
   
    if(imgSize <= maxAssetSize) {
        var mime = null

        switch(path.extname(src).toLowerCase()) {
            case ".jpg":
            case ".jpeg":
                mime = "image/jpeg"
                break
            case ".png":
                mime = "image/png"
                break
            case ".bmp":
                mime = "image/bmp"
                break
            case ".tiff":
                mime = "image/tiff"
                break
            default:
                throw new Error(`Cannot convert file with extension type ${path.extname(src)} to base64.`)

        }
        
        var data = fs.readFileSync(src, { encoding: "base64", flag: "r" })
        
        return `data:${mime};base64,${data}`

    } else {
        //Copy the file
        operations.push(fs.copyFile(src, outputPath, () => { }))
        
        //This is a url, not a file, so do not resolve
        return "static/" + path.basename(src)
    }
}

 /**
  * Given a TransformableImage, either saves it to disk and returns a url to reference it,
  * or returns a base64 representation if the image is small enough (as determined by the
  * plugin option, maxAssetSize).
  */
 async function getUrlOrConvertToBase64(outputRoot, fieldName, transformableImage, operations, maxAssetSize) {
    
    if(typeof outputRoot !== "string") {
        throw new Error("outputRoot must be a string.")
    }

    if(!(transformableImage instanceof TransformableImage)) {
        throw new Error(`Object returned from transform has a field, '${fieldName}', that must be a TransformableImage`)
    }

    var imgSize = transformableImage.getSize()

    if(imgSize <= maxAssetSize) {
        let base64 = await transformableImage.toBase64()
        return base64
    } else {

        //Get the underlying image for the TransformableImage from the TransformableImageMap.
        //The underlying image is an implementation detail that is stored separately from 
        //TransformableImage so that users cannot access it in custom transforms.
        var img = TransformableImagesMap.get(transformableImage)

        //Generate a hash for caching. Utilize attributes of the image rather than the image itself
        //for performance reasons.

        var hashable = {
            outputFile: transformableImage.getFileName() + transformableImage.getExtension(),
            operations: transformableImage.getOperationsHistory(),
            width: transformableImage.getWidth(),
            height: transformableImage.getHeight(),
            size: transformableImage.getSize()
        }

        var hash = hashSum(hashable)

        var outputPath = path.join(outputRoot, transformableImage.getFileName() + "." + hash + transformableImage.getExtension())
       
        if(!outputPath.startsWith(path.normalize(outputRoot))) {
            throw new Error("Invalid output path. Path is outside root.")
        }

        if(process.env.NODE_ENV !== "test") {
            operations.push(img.writeAsync(outputPath))
        }

        //This is a url, not a file, so do not resolve
        return "static/" + transformableImage.getFileName() + "." + hash + transformableImage.getExtension()
    }

}
