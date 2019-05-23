/*
 *  Implements an <ImageComponent /> component for use with React. To utilize with an image ingested 
 *  via the transformation pipeline, set the img prop to the image returned in the route. All other
 *  props are passed to an underlying <img /> element for maximum compatibility with existing
 *  web pages.
 */

import React, { useState, useContext, useEffect, useRef } from 'react'

import {ImageRegistryContext} from './imageRegistryContext'

var ImageComponent = function({ img, ...rest }) {

    if(img === undefined || img === null) {
        return <img {...rest} />
    }

    if(img["_ReactStaticImage"] === undefined || img["_ReactStaticImage"] === null) {
        throw new Error("Property '_ReactStaticImage' not found.")
    }

    let imgRef = useRef()

    const [imageSrc, setImageSrc] = useState(null)
    
    let currentComponentState = useRef("none")
    let previouslyLoaded = useRef(false)

    //Handle img change
    let imageRef = useRef(img)

    if(imageRef.current !== null && imageRef.current !== img) {
        currentComponentState.current = "none"
        previouslyLoaded.current = true
        imageRef.current = img
    }
    
    setRegistry()
    if(currentComponentState.current === "none") {
        if(imgRef.current) {
            imgRef.current.style.visibility = "hidden"
        }

        currentComponentState.current = "placeholder"
    }

    useEffect(() => {
        
        if(currentComponentState.current === "placeholder") { 
            if(getLoadType() === "immediate" || (getLoadType() === "lazy" && previouslyLoaded.current)) {
                
                let intervals = 0
                let placeholderInterval = setInterval(() => {
                    if(currentComponentState.current === "placeholder_loaded") {
                        clearInterval(placeholderInterval)

                        let nextImage = getImage(imageRef.current)["data"]
                        currentComponentState.current = "loaded"
                        setImageSrc(nextImage)
                    }

                    if(intervals > 1000) {
                        clearInterval(placeholderInterval)
                    }

                    intervals++
                }, 10)

            } else {
                //Do nothing. Lazy load will be handled by intersection observer.
            } 
        }
    })


    function getLoadType() {
        let load = img["load"]
        if(load === undefined) {
            return "immediate"
        } else if(load === null) {
            return "immediate"
        } else if(load === "immediate") {
            return "immediate"
        } else {
            return "lazy"
        }
    }


    /**
     * setSrc is called externally
     */
    let setSrc = function() {
        let intervals = 0
        let placeholderInterval = setInterval(() => {
            if(currentComponentState.current === "placeholder_loaded") {
                clearInterval(placeholderInterval)

                let nextImage = getImage(imageRef.current)["data"]
                currentComponentState.current = "loaded"
                setImageSrc(nextImage)
            }

            if(intervals > 1000) {
                clearInterval(placeholderInterval)
            }

            intervals++
        }, 10)
    }
    
    function setRegistry() {
        const imageRegistry = useContext(ImageRegistryContext)
        useEffect(() => {
            imageRegistry.register(imgRef, { 
                //Provide the higher level component with the ability to set img src
                setSrc: setSrc })
        }, [])

        //Image includes functionality to switch src images client-side based on best
        //resolution match. The feature is disabled by default because it watches for
        //document size changes. If any image implements this feature, turn on the feature 
        //in the higher level component.
        if(img["responsive"]) {
            if(imageRegistry) { //necessary to prevent error on 'run build' from consuming application
                imageRegistry.setFeature("responsive", true)
            }
        }
    }

    let responsiveIndex = useRef()

    function getImage(img) {
        if(img["responsive"]) {
            //If the img has a responsive set of images
            var value = imgRef.current.width
            var dimension = "width"

            //Select a dimension to use to determine the best resolution image
            if(imgRef.current.height > imgRef.current.width) {
                dimension = "height"
                value = imgRef.current.height
            }

            //The responsive field on the image contains an array of images to use at certain
            //dimensions. Sort that array based on the dimension selected above.
            img["responsive"].sort((a, b) => {
                switch(dimension) {
                    case "width": return a.width - b.width
                    case "height": return a.height - b.height
                }
            })

            //Select the image to display based the image closest to the dimension being compared.
            let low = undefined
            let high = undefined
            let index = undefined

            for(let i = 0; i < img["responsive"].length; i++) {
                var responsiveValue = img["responsive"][i][dimension]

                if(responsiveValue >= value) {
                    //Compare the sizes in the responsive image set to the current width or height,
                    //as applicable, and determine the closest responsive image entries that are lower
                    //than the current value and higher than the current value
                    low = i - 1 >= 0 ? i - 1 : 0
                    high = i
                    break
                }
            }

            if(low !== undefined && high !== undefined) {
                //Determine whether the current value is closer to the lower responsive image entry
                //or the higher responsive image entry
                var diffLow = Math.abs(value - img["responsive"][low][dimension])
                var diffHigh = Math.abs(value - img["responsive"][high][dimension])
                index = low
                if(diffHigh < diffLow) {
                    index = high
                }
            }

            if(index === undefined) {
                //The size at which the img component is being displayed exceeds the available
                //responsive image sizes. Use the largest available image.
                index = img["responsive"].length - 1
            }

            //As the image component is resized, higher resolution images will be loaded. Don't
            //load lower resolution images once a higher resolution image has been loaded.
            let loadedIndex = responsiveIndex.current
            if(loadedIndex && loadedIndex > index) {
                index = loadedIndex
            } else {
                responsiveIndex.current = index
            }

            //Set the img component with the selected image
            return img["responsive"][index]      
        } else {
            return img["image"]
        }
    }

    if(rest.style === undefined) {
        rest.style = {}
    }

    let canvasRef = useRef()
    let placeholderDiv = useRef()

    useEffect(() => {

        if(currentComponentState.current === "loaded") {
            imgRef.current.style.visibility = null
        }

        if(currentComponentState.current === "placeholder") {

            /* The placeholder is one size. The target image is another. Resize the placeholder 
            to the target image size before loading it into the <img> component so that browsers 
            properly size the resulting placeholder. Trying to resize the placeholder to match
            the target size after loading the placeholder in the <img> component by modifying the
            <img> component produced too many inconsistencies. */

            let nextImage = getImage(imageRef.current)
            canvasRef.current.width = nextImage["width"]
            canvasRef.current.height = nextImage["height"]
            var drawingContext = canvasRef.current.getContext('2d')

            let resizedImg = new Image()
            let hasPlaceholder = true
            
            if(imageRef.current["placeholder"]) {
                resizedImg.src = imageRef.current["placeholder"]["data"]
            } else {
                hasPlaceholder = false
            }

            var resizeIntervals = 0
            var resizeInterval = setInterval(() => {

                if(resizedImg.complete || !hasPlaceholder) {
                    clearInterval(resizeInterval)

                    if(hasPlaceholder) {
                        drawingContext.drawImage(resizedImg, 0, 0, nextImage["width"], nextImage["height"])
                    } else {

                        //For compability with standard <img> components, load a blank placeholder image at
                        //the target size if the img does not have a placeholder.

                        drawingContext.fillStyle = "#FFFFFF"
                        drawingContext.fillRect(0, 0, nextImage["width"], nextImage["height"])
                    }

                    let resizedData = canvasRef.current.toDataURL("image/jpeg")
                    imgRef.current.src = resizedData
                  
                    var imgRefIntervals = 0
                    var imgRefInterval =  setInterval(() => {

                        if(imgRef.current.complete) {
                            imgRef.current.style.visibility = null
                            currentComponentState.current = "placeholder_loaded"
                            clearInterval(imgRefInterval)
                        }

                        if(imgRefIntervals > 1000) {
                            currentComponentState.current = "placeholder_loaded"
                            clearInterval(imgRefInterval)
                        }
                    }, 10)
                }

                if(resizeIntervals > 1000) {
                    currentComponentState.current = "placeholder_loaded"
                    clearInterval(resizeInterval)
                }

                resizeIntervals++
            }, 10) 
        }
    })

    if(rest.style === undefined) {
        rest.style = {}
    }

    if(currentComponentState.current === "placeholder") {
        rest.style.visibility = "hidden"
    }

    //Create an underlying <img /> component for the <ImageComponent />. Pass on unused props.
    return (<React.Fragment>
                <canvas ref={canvasRef} style={{display:"none"}}/>
                <img ref={imgRef} src={imageSrc} {...rest} />
            </React.Fragment>)
            
    
        
}

export { ImageComponent }