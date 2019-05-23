import { TransformHelper } from "../transformHelper";

/**
 * Default transform that optionally creates a placeholder image, responsive image set
 * and enables lazy loading.
 * 
 * The following options can be set in Images.get():
 * 
 *      Options:
 *          usePlaceholder: true|false
 *          useResponsive: true|false
 *          load: "immediate"|"lazy"
 * 
 *          placeholderQuality:   1-100  The JPEG quality of the placeholder
 *          placeholderMaxDimension:  amount  The maximum number of pixels along the longest dimension
 *          quality: 1-100 The JPEG quality of the image
 *          maxDimension: amount The maximum number of pixels along the longest dimension
 * 
 *          grayscale true|false
 * 
 */

export default ({ image, options }) => {

    //Note that image operations are immutable and that order matters. For example, if the "image"
    //below is turned grayscale, then the "placeholder" will also be grayscale since it's created
    //from the image.

    image = TransformHelper.handleOption("maxDimension", options.maxDimension, image)
    image = TransformHelper.handleOption("quality", options.quality, image)

    image = TransformHelper.handleOption("grayscale", options.grayscale, image)

    let placeholder = undefined

    if(options.usePlaceholder) {
        placeholder = image.scale(0.07)
        placeholder = TransformHelper.handleOption("placeholderMaxDimension", options.placeholderMaxDimension, placeholder)
        placeholder = TransformHelper.handleOption("placeholderQuality", options.placeholderQuality, placeholder)
        placeholder = placeholder.blur(2) 
    }
    

    let responsive = undefined

    if(options.useResponsive) {
        responsive = [
            image.scale(0.3),
            image.scale(0.5),
            image.scale(0.7),
            image.scale(1.0)
        ]
    }

    return {
        image,
        placeholder,
        load: TransformHelper.handleOption("load", options.load),
        responsive
    }
}