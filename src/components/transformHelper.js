/* Helper for transforms */

var TransformHelper = {}

TransformHelper.handleOption = function(optionName, value, image) {
    
    if(value === undefined || value === null) {
        //Options don't have to be provided
        return image
    }

    let optionNameLower = optionName.toLowerCase()

    switch(optionNameLower) {
        case "placeholderquality":
        case "quality":
            isNumber(optionName, value)
            isGreaterThan(optionName, value, 0)
            return image.setQuality(value)
        case "placeholdermaxdimension":
        case "maxdimension":
            isNumber(optionName, value)
            isGreaterThan(optionName, value, 0)

            if(image.getWidth() >= image.getHeight()) {
                if(image.getWidth() > value) {
                    image = image.resizeWidth(value)
                }
            } else {
                if(image.getHeight() > value) {
                    image = image.resizeHeight(value)
                }
            }
            return image
        case "load":
            isLoadOption(value)
            return value
        case "grayscale":
            if(value) {
                image = image.grayscale()
            }
            return image
        default:
            throw new Error("Unknown option")
    }
}

function isNumber(optionName, value) {
    if(typeof value !== "number") {
        throw new Error(`'${optionName}' must be a number`)
    }
}

function isGreaterThan(optionName, value, comparison) {
    if(value <= comparison) {
        throw new Error(`'${optionName}' must be greater than ${comparison}`)
    }
}

function isLoadOption(value) {
    value = value.trim().toLowerCase()
    if(value !== "immediate" && value !== "lazy") {
        throw new Error("'load' must be 'immediate' or 'lazy'")
    }
}

export { TransformHelper }