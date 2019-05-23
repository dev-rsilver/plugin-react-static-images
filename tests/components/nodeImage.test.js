
import { Images } from '../../dist/components/nodeImage'
import path from 'path'
const fs = require('fs')
import Jimp from 'jimp'
const process = require('child_process')

jest.mock('fs')
jest.mock('child_process')

async function createJimpImage(width, height) {
    return await new Promise((resolve, reject) => {
        new Jimp(width, height, (error, image) => {
            resolve(image)
        })
    })
}

var folderFiles = [
    { name: "test1.jpg", isFile: () => (true), isDirectory: () => (false) },
    { name: "test2.jpeg", isFile: () => (true), isDirectory: () => (false) },
    { name: "test3.png", isFile: () => (true), isDirectory: () => (false) },
    { name: "test4.bmp", isFile: () => (true), isDirectory: () => (false) },
    { name: "test5.tiff", isFile: () => (true), isDirectory: () => (false) },
    { name: "subdir", isFile: () => false, isDirectory: () => (true) }
]

beforeAll(() => {

    //Mock the root directory where files are output
    let nodeApi = require("../../dist/node.api")

    nodeApi.default = jest.fn(() => {
        nodeApi.PluginOptions.OutputRoot = path.resolve("./tests/output")
        
        //Simulate adding a custom transform
        nodeApi.PluginOptions.Transforms = [
            { name: "transform1", location: "./tests/custom-transforms/transform1.js" }
        ]
    })

    nodeApi.default()

    //Mock statSync to not require a real file or folder
    fs.statSync.mockImplementation((src) => {
        if(src.endsWith("doesnotexist") || src.endsWith("doesnotexist.jpg")) {
            //Simulate non-existent path
            return undefined
        }

        if(path.extname(src)) {
            return {
                isFile: function() { return true }
            }
        } else {
            return {
                isDirectory: function() { return true }
            }
        }
    })

    //Mock accessing a folder
    fs.readdirSync.mockReturnValue(folderFiles)

    //Mock fork so that a process isn't actually created
    var forkCallback = () => {}
    
    process.fork.mockReturnValue({
        send: function(message) {
            //Simulate process sending a message back
            setTimeout(() => {
                forkCallback({
                    //Send back the name of the image file
                    image: "static/" + path.basename(message.value)
                })
            }, 2000)
        },
        on: function(event, callback) {
            forkCallback = callback
        },
        disconnect: function() {
        }
    })
})

test('undefined folder value fails', async () => {
    await expect(Images.get({ type: "folder", value: undefined })).rejects.toThrow("Value is not valid")
})

test('null folder value fails', async () => {
    await expect(Images.get({ type: "folder", value: null })).rejects.toThrow("Value is not valid")
})

test('zero length folder value fails', async() => {
    await expect(Images.get({ type: "folder", value: "" })).rejects.toThrow("Value is not valid")
})

test('undefined file value fails', async () => {
    await expect(Images.get({ type: "file", value: undefined })).rejects.toThrow("Value is not valid")
})

test('null file value fails', async () => {
    await expect(Images.get({ type: "file", value: null })).rejects.toThrow("Value is not valid")
})

test('zero length file value fails', async () => {
    await expect(Images.get({ type: "file", value: "" })).rejects.toThrow("Value is not valid")
})

test('non-existent folder', async () => {
    //See fs.statSync mock above for value
    await expect(Images.get({ type: "folder", value: "doesnotexist" })).rejects.toThrow("does not exist or is not a folder")
})

test('non-existent file', async () => {
    await expect(Images.get({ type: "file", value:"doesnotexist.jpg" })).rejects.toThrow("does not exist or is not a file")
})

test('file extensions', async () => {
    let images = await Images.get([
        { type: "file", value: "test1.jpg" },
        { type: "file", value: "test2.jpeg" },
        { type: "file", value: "test3.png" },
        { type: "file", value: "test4.bmp" },
        { type: "file", value: "test5.tiff" }
    ])

    expect(images.length).toEqual(5)
})

test('file extension fails', async() => {
    await expect(Images.get({ type: "file", value: "test1.unknown_extension" })).rejects.toThrow("Invalid image extension")
})

test('processes image single object return value', async () => {
    //The file doesn't actually exist. See mocked functions above.
    let image = await Images.get({ type: "file", value: "./tests/test1.jpg" })
    expect(image).toEqual({ image: 'static/test1.jpg' })
})

test('processes images array return value', async () => {
    let images = await Images.get([{ type: "file", value: "./tests/test1.jpg" }, { type: "file", value: "./tests/test2.jpg" } ])
    expect(images.length).toEqual(2)
})

test('processes folder', async () => {
    //The provided folder doesn't actually exist. See mocked functions above.
    let images = await Images.get({ type: "folder", value: "./tests/images"})
    expect(images.length).toEqual(folderFiles.length - 1) //folderFiles contains a subdirectory, so subtract 1
})

test('transform', async() => {
    await Images.get({ type: "file", value: "./tests/test1.jpg" }, "builtin")
})

test('custom transform', async () => {
    //transform1 is added in beforeAll() above
    await Images.get({ type: "file", value: "./tests/test1.jpg" }, "transform1")
})

test('unknown transform', async () => {
    await expect(Images.get({ type: "file", value: "./tests/test1.jpg" }, "transform2")).rejects.toThrow("Transform with name")
})

test('no transforms', async () => {

    let nodeApi = require("../../dist/node.api")

    let originalDefault = nodeApi.default

    nodeApi.default = jest.fn(() => {
        nodeApi.PluginOptions = {}
    })

    nodeApi.default()

    await expect(Images.get({ type: "file", value: "./tests/test1.jpg" }, "transform1")).rejects.toThrow("Transform with name")

    nodeApi.default = originalDefault
    nodeApi.default()
})

test('no transforms, builtin', async () => {
    //Expect no transforms and a transformName of "builtin" to succeed

    let nodeApi = require("../../dist/node.api")

    let originalDefault = nodeApi.default

    nodeApi.default = jest.fn(() => {
        nodeApi.PluginOptions = {}
    })

    nodeApi.default()

    await expect(Images.get({ type: "file", value: "./tests/test1.jpg" }, "builtin")).resolves.toMatchObject({"image": "static/test1.jpg"})

    nodeApi.default = originalDefault
    nodeApi.default()
})