
import { TransformHelper } from '../../dist/components/transformHelper'

test('tests unknown option', () => {
    expect(() => { TransformHelper.handleOption("z", 1, null) }).toThrow("Unknown option")
})

test('tests number option a number', () => {
    //handleOption will succeed up to the point the image (which is null in this test) is accessed
    expect(() => { TransformHelper.handleOption("placeholderQuality", 2, null) }).toThrow("Cannot read property 'setQuality' of null")
})

test('tests number option not a number', () => {
    expect(() => {
        TransformHelper.handleOption("placeholderQuality", "a", null)
    }).toThrow("must be a number")
})

test('tests number less than or equal to 0 fails', () => {
    expect(() => {
        TransformHelper.handleOption("placeholderQuality", 0, null)
    }).toThrow('must be greater than')

    expect(() => {
        TransformHelper.handleOption("placeholderQuality", -1, null)
    }).toThrow('must be greater than')
})

test('load option succeeds', () => {
    TransformHelper.handleOption("load", "lazy")
    TransformHelper.handleOption("load", "immediate")
})

test('load option fails', () => {
    expect(() => {
        TransformHelper.handleOption("load", "abc")
    }).toThrow()
})