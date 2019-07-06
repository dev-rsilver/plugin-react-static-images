import imageProcess from '../../dist/components/imageProcess'
import path from 'path'
const fs = require('fs')
import Jimp from 'jimp'

async function createJimpImage(width, height) {
    return await new Promise((resolve, reject) => {
        new Jimp(width, height, (error, image) => {
            resolve(image)
        })
    })
}

describe('non-existent', () => {

    test('non-existent transform', async () => {

        var nonExistentTransformPath = path.resolve("./src/components/built-in-transforms/builtin2.js")
    
        if(fs.existsSync(nonExistentTransformPath)) {
            throw new Error("Transform should not exist at the path.")
        }
        
        await expect(imageProcess({
            transform: nonExistentTransformPath,
            type: "file"
        })).rejects.toThrow("does not exist")
    })
    
    test('non-existent file read', async () => {
    
        //If a transform is provided, then imageProcess will attempt to read provided file
        //into a Jimp object. This test checks the result of reading a non-existent file via
        //Jimp. Expects that the file will simply be skipped in the test. When running in other 
        //than test mode, an error object will be sent to nodeImage.js which will then result
        //in the build process being cancelled.
    
        await imageProcess({
            id: 1,
            type: "file",
            value: "./tests/images/input/test1.jpg",
            outputRoot: "./test/images/output/",
            maxAssetSize: 10000,
            transform: path.resolve("./src/components/built-in-transforms/builtin.js"),
        })
    })
    
})

describe('process image via copy (no transform)', () => {

    let img
    let smallImg
    beforeAll(async () => {
        img = await createJimpImage(400, 400)

        smallImg = await createJimpImage(25, 25)
        let base64Data = await smallImg.getBase64Async("image/jpeg")

        fs.statSync = jest.fn((path) => {
            return {
                size: img.bitmap.data.length
            }
        })

        path.basename = jest.fn((path) => {
            return "test1.jpg"
        })

        path.extname = jest.fn((path) => {
            return ".jpg"
        })

        //In a copy operation, fs.readFileSync is utilized to return a base64 encoded string.
        //Skip the read operation and return the base64 encoded string.
        fs.readFileSync = jest.fn((path, options) => {
            //imageProcess already adds the "data:mime;base64," prefix, so remove it here so that
            //it's not added twice
            return base64Data.substring(23)
        })

        //In a copy operation, the copyFile operation moves the file to the output folder.
        //For testing, this operation shouldn't do anything.
        fs.copyFile = jest.fn((path, callback) => {
        })
    })

    test('process image via file copy', async () => {
      
        //ImageProcess does not validate the source input. Under normal circumstances, imageProcess
        //would be launched using fork and limited to a serializable message. For testing purposes,
        //since the exported function is called directly, an image will be provided.
    
        let result = await imageProcess({ 
            id: 1,
            type: "file",
            value: img,
            outputRoot: path.resolve("./test/images/output/"),
            maxAssetSize: 10000,
            transform: null //passing null results in a copy operation
        })
    
        //The image is large enough that a copy operation should result in a url.
        expect(result.image.data).toEqual("/static/test1.jpg")
    })

    test('process image via file copy base64', async () => {
        //ImageProcess does not validate the source input. Under normal circumstances, imageProcess
        //would be launched using fork and limited to a serializable message. For testing purposes,
        //since the exported function is called directly, an image will be provided.
    
        img.resize(25, 25)

        let result = await imageProcess({ 
            id: 1,
            type: "file",
            value: img,
            outputRoot: path.resolve("./test/images/output/"),
            maxAssetSize: 10000,
            transform: null //passing null results in a copy operation
        })

        let base64 = await img.getBase64Async("image/jpeg")
        img.resize(400, 400)
        
        //The image is small enough that a copy operation should result in a base64 data url.
        expect(result.image.data).toEqual(base64)
    })
})

describe('process image via transform', () => {
    
    beforeAll(() => {
        path.basename = jest.fn((path, extension) => {

            if(extension) {
                return "test1"
            }

            return "test1.jpg"
        })
    })

    test('process image via transform base64', async () => {

        //ImageProcess does not validate the source input. Under normal circumstances, imageProcess
        //would be launched using fork and limited to a serializable message. For testing purposes,
        //since the exported function is called directly, an image will be provided.
    
        let img = await createJimpImage(25, 25)

        //createJimpImage will be a png if not loaded from a file with a different mime type
        var base64 = await img.getBase64Async("image/png")
        
        let result = await imageProcess({ 
            id: 1,
            value: img,
            type: "file",
            outputRoot: path.resolve("./test/images/output/"),
            maxAssetSize: 10000,
            transform: path.resolve("./src/components/built-in-transforms/builtin.js"),
            transformOptions: {}
        })

        expect(result.image.data).toEqual(base64)
    })

    test('process image via transform', async () => {

        //ImageProcess does not validate the source input. Under normal circumstances, imageProcess
        //would be launched using fork and limited to a serializable message. For testing purposes,
        //since the exported function is called directly, an image will be provided.
    
        let img = await createJimpImage(400, 400)

        let result = await imageProcess({ 
            id: 1,
            type: "file",
            value: img,
            outputRoot: path.resolve("./test/images/output/"),
            maxAssetSize: 10000,
            transform: path.resolve("./src/components/built-in-transforms/builtin.js"),
            transformOptions: {}
        })

        expect(result.image.data).toMatch(/static\/test1.([a-zA-Z0-9]+).jpg/)
    })
})

