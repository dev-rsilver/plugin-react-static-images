/*
 * Implements an Image object that can be imported into static.config.js 
 * to ingest and transform images.
 */

import path from 'path'
const fs = require('fs')
import { PluginOptions } from '../node.api'
const process = require('child_process')

var Images = function() { }

 /**
  * Get image(s) from files or folders.
  * @param source an object, or array of objects, consisting of the following:
  *               { type: "file", value: file_path }
  *               { type: "folder", value folder_path }
  * @param transformName    The name of a transform to utilize on the sources. Transform name
  *                         must be the name of a built-in transform, or the name of a transform
  *                         passed to the image plugin in static.config.js. Defaults to null,
  *                         which means no transforms will be applied.
  * @param opts Options related to the given transform.
  */
Images.get = async function(sources, transformName = null, opts = {}) {

    var ImageProcesses = []
    var NumProcesses = 4

    //Use a pool of child processes to speed up image transformation.
    configureImageProcesses()

    //If a single source is passed, turn it into an array
    if(!Array.isArray(sources)) {
        sources = [sources]
    }

    validateSources(sources)

    let transform = null

    if(transformName !== null) {

        if(PluginOptions.Transforms === undefined) {
            PluginOptions.Transforms = []
        }

        //Look for transform name on user-specified transforms first.
        transform = PluginOptions.Transforms.find((value) => value.name.trim().toLowerCase() === transformName)
        
        //If the transform is found in the user-supplied transforms, then assign the location.
        if(transform) {
            transform = path.resolve(transform.location)
        }

        if(transform === undefined || transform === null) {
            //If the transform wasn't found, then check for a built-in transform.
            switch(transformName) {
                case "builtin":
                    transform = path.join(__dirname, "built-in-transforms/builtin.js")
                    break
                default: throw new Error(`Transform with name '${transformName}' not found.`)
            }
        }
    }

    //Process images via a pool of forked processes for performance and then wait
    //for all images to be processed before continuing.

    let processed = 0
    var filesToProcess = 0
    var results = []

    var p = new Promise((resolve, reject) => {
        for(var i = 0; i < sources.length; i++) {
            let imageProcessIndex = i % NumProcesses
            const { type, value } = sources[i]

            switch(type) {

                case "folder":
                    //Resolve the folder path
                    value = path.resolve(value)

                    let supportedExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"]

                    var files = fs.readdirSync(value, { withFileTypes: true })

                    //User will expect that files are read in alphabetical order. Files are returned randomly from
                    //fs, so sort them. Files will also be handled asynchronously, so assign an id to each sorted
                    //file so that they can be reordered once they're returned by the transform processes.
                    
                    files.sort()

                    //Files are processed asynchronously. It's necessary to increase the filesToProcess variable
                    //before processing the files so that a race condition doesn't cause the code below to exit early.

                    files.forEach(file => {
                        if(file.isFile() && supportedExtensions.includes(path.extname(file.name).toLowerCase())) { 
                            filesToProcess++
                        }
                    })

                    var fileId = 0
                    files.forEach(file => {
                        if(file.isFile() && supportedExtensions.includes(path.extname(file.name).toLowerCase())) {
                            
                            var filePath = path.join(value, file.name)
                            
                            ImageProcesses[imageProcessIndex].send({
                                id: fileId, //assign a sequential id for re-ordering after processing
                                type: type,
                                value: filePath,
                                transform: transform,
                                transformOptions: opts,
                                outputRoot: PluginOptions.OutputRoot,
                                maxAssetSize: PluginOptions.MaxAssetSize
                            })
                            fileId++
                        }
                    })

                    break

                case "file":
                    //Resolve the file path
                    value = path.resolve(value)
                    
                    //Increase filesToProcess before calling send() below since send is asynchronous
                    filesToProcess++
                    
                    ImageProcesses[imageProcessIndex].send({
                        type: type,
                        value: value,
                        transform: transform,
                        transformOptions: opts,
                        outputRoot: PluginOptions.OutputRoot,
                        maxAssetSize: PluginOptions.MaxAssetSize
                    })
                    break

                default: throw new Error("Unknown type")
            }
        }
        
        if(filesToProcess <= 0) {
            resolve()
        }

        for(let i = 0; i < NumProcesses; i++) {
            ImageProcesses[i].on("message", (message) => {

                if(message.error) {
                    //Disconnect image processes
                    clearImageProcesses()
                    throw new Error("Build cancelled.")
                }
                
                results.push(message)

                processed++

                console.log(`Processed image ${processed} of ${filesToProcess}`)

                if(processed === filesToProcess) {
                    //Disconnect image processes
                    clearImageProcesses()

                    resolve()
                }
            })
        }
    })

    //Wait for the files to be handled
    await p

    //Results need to be sorted because they were handled asynchronously
    results.sort((a, b) => {
        return a.id - b.id
    })

    if(results.length === 1) {
        return results[0]
    }

    return results

    function configureImageProcesses() {
        
        if(ImageProcesses.length > 0) {
            //Don't set up more processes if they've already been set up
            return
        }

        for(let i = 0; i < NumProcesses; i++) {
            ImageProcesses.push(process.fork(__dirname + "/imageProcess.js"))
        }
    }

    function clearImageProcesses() {

        for(let j = 0; j < NumProcesses; j++) {
            ImageProcesses[j].disconnect()
        }

        ImageProcesses = []
    }


    function validateSources(sources) {
          for(let i = 0; i < sources.length; i++) {
            if(sources[i].value === undefined ||
               sources[i].value === null ||
               sources[i].value.trim().length <= 0) {
                   throw new Error("Value is not valid.")
            }

            switch(sources[i].type.trim().toLowerCase()) {
                case "folder":
                    let folderStat = fs.statSync(path.resolve(sources[i].value))
                    if(folderStat === undefined || !folderStat.isDirectory()) {
                        throw new Error(`Path '${sources[i].value}' does not exist or is not a folder.`)
                    }
                    break
                case "file":
                    hasImageExtension(sources[i].value)
                    let fileStat = fs.statSync(path.resolve(sources[i].value))
                    if(fileStat === undefined || !fileStat.isFile()) {
                        throw new Error(`Path '${sources[i].value}' does not exist or is not a file.`)
                    }
                    break
            }
        }

    }

    function hasImageExtension(str) {
        //Extensions can be compared in a case-insensitive manner because there aren't
        //different types of image files based on case sensitive extensions
        str = str.toLowerCase()

        let extensions = [".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"]
        let found = false
        for(let i = 0; i < extensions.length; i++) {
            if(str.endsWith(extensions[i].toLowerCase())) {
                found = true
                break
            }
        }
        
        if(!found) {
            throw new Error(`Source "${str}": Invalid image extension`)
        }
    }
 }

 export { Images }