/*
 * Browser plugin wraps the root in a higher level component that's responsible
 * for observing and managing <ImageComponent /> components
 */

import React, { useEffect } from 'react'
import { ImageRegistryContext } from './components/imageRegistryContext'

export default options => ({
    Root: PreviousRoot => ({children}) => {
        return (<ObservableRoot>
                    <PreviousRoot>{children}</PreviousRoot>
                </ObservableRoot>)
    }
})

function ObservableRoot({children}) {

    //<ImageComponent /> components will register themselves and actions that can be taken
    //via ImageRegistryContext. This variable holds those registrations.
    let imageMap = new Map()

    //Set up observer for lazy loading
    let observer = configureObserver()

    var context = {
        register: function(imgRef, actions) {
            imageMap.set(imgRef.current, actions)
            if(observer !== undefined) {
               observer.observe(imgRef.current)
            }
        },
        setFeature: function(feature, active) {
            switch(feature) {
                case "responsive":
                    setResponsiveFeature()
                    break
            }
        }
    }

    return (<ImageRegistryContext.Provider value={context}>
                {children}
            </ImageRegistryContext.Provider>)


    function configureObserver() {
        let observer
        try {
            observer = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if(entry.isIntersecting) {
                        //Execute the setSrc function passed to this component via
                        //the image registry.
                        var setSrc = imageMap.get(entry.target).setSrc
                        setSrc()
                    }
                })
            })
        } catch {
        }
        
        return observer
    }

    function setResponsiveFeature() {
        useEffect(() => {
            if(document) {
                window.onresize = function() {
                    imageMap.forEach((value, key) => {
                        //The value of each key in the map is an object containing
                        //actions that can be taken.
                        value.setSrc()
                    })
                }
            }
        })
    }

}