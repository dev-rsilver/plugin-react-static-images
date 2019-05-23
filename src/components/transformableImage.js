
import Jimp from 'jimp'
import path from 'path'

export var TransformableImagesMap = new WeakMap()

/**
 * TransformableImage provides an ability to alter images via transform plugins.
 */
export var TransformableImage = function(img, fileName) {
    
    if(!(img instanceof Jimp)) {
        throw new Error("Unsupported image type.")
    }

    if(fileName === undefined || fileName === null || fileName.trim().length <= 0) {
        throw new Error("FileName must be provided.")
    }

    let _img = img
    let _fileName = fileName

    //A history of operations that will, in part, be utilized to generate a
    //hash for the content.
    let _operationsHistory = []

    //TransformableImage acts as an interface for transformations. To hide the 
    //implementation details of the underlying img, add the img to a map for
    //internal access. Each immutable operation of a TransformableImage will
    //generate a new entry in the map.
    TransformableImagesMap.set(this, img)

    this.getFileName = function() {
        return path.basename(_fileName, path.extname(_fileName))
    }

    this.getExtension = function() {
        return path.extname(_fileName)
    }

    /**
     * Sets the filename. Primarily used when generating additional images so that
     * the original file is not overwritten.
     */
    this.setFileName = function(fileName) {
        _operationsHistory.push({ action: "setFileName", value: fileName })
        return new TransformableImage(_img, fileName)
    }

    /**
     * Turns image greyscale.
     */
    this.grayscale = function() {
        _operationsHistory.push({ action: "grAyscale" })
        return new TransformableImage(_img.clone().greyscale(), _fileName)
    }

    /**
     * Blurs image by specified pixels. Operation is intensive and should be used
     * minimally.
     */
    this.blur = function(px) {
        if(px === undefined || px === null) {
            throw new Error("blur: px must be provided")
        }

        _operationsHistory.push({ action: "blur", value: px })

        return new TransformableImage(_img.clone().blur(px), _fileName)
    }

    /**
     * Resizes width and forces a proportional height.
     */
    this.resizeWidth = function(width) {
        _operationsHistory.push({ action: "resizeWidth", value: width })
        return new TransformableImage(_img.clone().resize(width, Jimp.AUTO), _fileName)
    }

    /**
     * Resizes height and forces a proportional width.
     */
    this.resizeHeight = function(height) {
        _operationsHistory.push({ action: "resizeHeight", value: height })
        return new TransformableImage(_img.clone().resize(Jimp.AUTO, height), _fileName)
    }

    /**
     * Forces image to specified width and height, disregarding proportionality.
     */
    this.resize = function(width, height) {
        _operationsHistory.push({ action: "resize", value: [width, height] })
        return new TransformableImage(_img.clone().resize(width, height), _fileName)
    }

    /**
     * Scales the image by a specified amount.
     */
    this.scale = function(amount) {
        _operationsHistory.push({ action: "scale", value: amount })
        return new TransformableImage(_img.clone().scale(amount), _fileName)
    }

    this.toBase64 = async function() {
        return await _img.clone().getBase64Async(Jimp.AUTO)
    }

    /**
     * Returns the width of the image.
     */
    this.getWidth = function() {
        return _img.bitmap.width
    }

    /**
     * Returns the height of the image.
     */
    this.getHeight = function() {
        return _img.bitmap.height
    }

    /**
     * Gets the size of the image data.
     */
    this.getSize = function() {
        return _img.bitmap.data.length
    }

    /**
     * Sets quality (JPEG only).
     */
    this.setQuality = function(quality) {
        _operationsHistory.push({ action: "setQuality", value: quality })
        return new TransformableImage(_img.clone().quality(quality), _fileName)
    }

    this.getOperationsHistory = function() {
        return _operationsHistory
    }

}