
import Jimp from 'jimp'
import path from 'path'
import { TransformableImage } from '../../dist/components/transformableImage'

var fileName = "test.jpg"

async function createJimpImage() {
    return await new Promise((resolve, reject) => {
        new Jimp(400, 500, (error, image) => {
            resolve(image)
        })
    })
}

let jImg
beforeAll(async () => {
    jImg = await createJimpImage()
})

test('instantiation fails with incorrect image type', () => {
    expect(() => { new TransformableImage() }).toThrow('Unsupported image type')
})

test('instantiation fails if filename not provided', () => {
    expect(() => { new TransformableImage(jImg) }).toThrow("FileName must be provided")
})

test('instantiation succeeds', () => {
    new TransformableImage(jImg, fileName)
})

test('getSize', () => {
    var t = new TransformableImage(jImg, fileName)
    expect(t.getSize()).toBe(jImg.bitmap.data.length)
})

test('getWidth', () => {
    var t = new TransformableImage(jImg, fileName)
    expect(t.getWidth()).toBe(jImg.getWidth())
})

test('getHeight', () => {
    var t = new TransformableImage(jImg, fileName)
    expect(t.getHeight()).toBe(jImg.getHeight())
})

test('getFileName', () => {
    var t = new TransformableImage(jImg, fileName)
    expect(t.getFileName()).toEqual(path.basename(fileName, path.extname(fileName)))
})

test('getExtension', () => {
    var t = new TransformableImage(jImg, fileName)
    expect(t.getExtension()).toEqual(path.extname(fileName))
})

test('setFileName', () => {
    var t = new TransformableImage(jImg, fileName)
    t = t.setFileName("test2.jpg")
    expect(t.getFileName()).toEqual("test2")
})

test('ensure setFileName immutable', () => {
    var t = new TransformableImage(jImg, fileName)
    t.setFileName("test2.jpg")
    expect(t.getFileName()).toEqual("test")
})