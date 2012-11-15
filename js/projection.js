/*--------------------------------------------------------
 * Copyright (c) 2011, The Dojo Foundation
 * This software is distributed under the "Simplified BSD license",
 * the text of which is available at http://www.winktoolkit.org/licence.txt
 * or see the "license.txt" file for more details.
 *--------------------------------------------------------*/

/**
 * @fileOverview A plugin to add a parallax effect.
 * This effect gives an illusion of depth for the elements during the navigation.
 *  
 * @author Kevin AUVINET
 */
define(['../../../_amd/core', '../../../ux/gesture/js/gesture.js'], function(wink)
{   
    wink.plugins.Projection = function(properties) 
    {
        /**
         * Unique identifier
         * 
         * @property uId
         * @type integer
         */
        this.uId = wink.getUId();
        
        /**
         * An array of layers with their depth
         * 
         * @property layers
         * @type array
         */
        this.layers = [];
        
        /**
         * Define a prefix for get layer and this depth
         * 
         * @property layers_prefix_class
         * @type string
         * @default depth
         */
        this.layers_prefix_class = "depth";
        
        /**
         * Navigation speed
         * 
         * @property speed
         * @type integer
         */
        this.speed = 10;
        
        this._perspective = 100;
        this._perspectiveOrigin = {
            x: '50%',
            y: '50%'
        };
        
        wink.mixin(this, properties);
        
        this._target = wink.byId(this.target);
        
        this._map = {};
        this._used = 0;
        
        this._timeout = null;
        this._fps = 1000/60;
        
        this._depths = {
            current: null
        };
        
        if(!this._validateProperties()) { 
            return false; }
        
        this._initDOM();
        this._initMap();
        this._initListeners();
        this._parseDOM();
        this._translateElements(this._depths.current);
    };
    
    wink.plugins.Projection.prototype = 
    {
        move_forward: function() {
            if(this._timeout != null)
                return;

            var next = this._getNextLayer();
            this._moveTo(next.depth);
        },
        
        move_backward: function() {
            if(this._timeout != null)
                return;

            var prev = this._getPreviousLayer();
            this._moveTo(prev.depth);
        },
    
        _validateProperties: function() {
            try {
                if(!wink.isSet(this.target)) 
                    throw Error('Please define an existing dom node id for the target');
                if(!wink.isInteger(this.speed) || this.speed <= 0) 
                    throw Error('Please define a positive value for the speed');
                if(wink.trim(this.layers_prefix_class).length == 0) 
                    throw Error('Please define a prefix class for your layers');
                return true;
            } catch(error) {
                wink.log(error.message);
                return false;
            }
        },
        
        _initDOM: function() {
            wink.fx.apply(this._target, {
                "transform-style": "preserve-3d",
                "perspective":  this._perspective
            });
            
            this._target.style.webkitPerspectiveOriginX = this._perspectiveOrigin.x;
            this._target.style.webkitPerspectiveOriginY = this._perspectiveOrigin.y;
        },
        
        _initMap: function() 
        {
            var elem = null;
            for(var i=0, l=this.layers.length; i < l; i++) 
            {
                elem = this.layers[i].element;
                
                if(!wink.isSet(elem))
                    throw Error('An HTML element doesn\'t exist in the layers tab');
                if(!wink.isSet(elem.id) || wink.trim(elem.id).length == 0)
                    throw Error('Please define an id for each section tag used as layer');
                
                this._map[elem.id] = i;
            }
        },
        
        _parseDOM: function() 
        {
            var list_sections = wink.query('section', this._target);
            
            var section=null,
                className=null,  
                children=null,
                key=null;
            
            for(var i=0, l=list_sections.length; i < l; i++) 
            {
                try
                {
                    section = list_sections[i];
                    if(wink.isNull(section.id))
                        throw Error('The section '+(i+1)+' has not id, please set one');

                    var layer = this.layers[this._map[section.id]];
                    if(!wink.isSet(layer)) 
                    {
                        // Define layer structure
                        layer = { 
                            children: [],
                            depth: 0,
                            element: section
                        };
                        
                        // Check an existing class for get the depth
                        className = section.className;
                        if(wink.isNull(className) || !className.match(this.layers_prefix_class))
                            throw Error('The section "'+section.id+'" has no class with the depth prefix, please set one');
                        layer.depth = this._getDepthFromClass(className);
                        
                        // Get children with their depths
                        children = section.children;
                        for(var j=0, l2=children.length; j < l2; j++) {
                            className = children[j].className;
                            if(wink.isNull(className) || !className.match(this.layers_prefix_class))
                                className = section.className;

                            layer.children.push({
                                depth: this._getDepthFromClass(className),
                                element: children[j]
                            });
                        }

                        // Add layer to the map
                        key = this.layers.push(layer);
                        this._map[section.id] = key;
                    }

                    wink.fx.apply(layer.element, {
                        'transform-style': 'preserve-3d'
                    });

                    // Start by the dephest element
                    if(this._depths.current == null 
                    || this._depths.current > layer.depth)
                        this._depths.current = layer.depth;
                }
                catch(error) {
                    wink.log(error.message);
                }
            }
            
            this._sortLayers();
        },
        
        _sortLayers: function() {
            this.layers.sort(function(a, b) {
                return a.depth - b.depth;
            });
        },
        
        _initListeners: function() {
            if(wink.ua.isMobile) {
                wink.ux.gesture.listenTo(this._target, "enlargement", { context: this, method: "move_forward" }, { preventDefault: true });
                wink.ux.gesture.listenTo(this._target, "narrowing", { context: this, method: "move_backward" }, { preventDefault: true });
            } else {
                //FF doesn't recognize mousewheel as of FF3.x
                var _mousewheelevt=(/Firefox/i.test(navigator.userAgent))? 
                    "DOMMouseScroll" : "mousewheel";
                
                var func = function(e) {
                    e.preventDefault();
                    
                    if(e.wheelDeltaY > 0) { this.move_forward(); }
                    else
                    if(e.wheelDeltaY < 0) { this.move_backward(); }
                };
                
                if (document.attachEvent) //if IE (and Opera depending on user setting) 
                    document.attachEvent("on"+_mousewheelevt, wink.bind(func, this));
                else 
                if (document.addEventListener) //WC3 browsers
                    document.addEventListener(_mousewheelevt, wink.bind(func, this), false);
            }
        },
        
        _getDepthFromClass: function(className) {
            var pattern = eval('/'+this.layers_prefix_class+'((-)?[0-9]+)/');
            var result = className.match(pattern)[1];
            return parseInt(result);
        },
        
        _translateElements: function(depth) 
        {
            var layer = null,
                z_pos = 0;
            
            for(var i=0, l=this.layers.length; i < l; i++) {
                layer = this.layers[i];
                z_pos = parseInt(-layer.depth + depth);
                this._translateTo(layer.element, z_pos);
                
                for(var j=0, l2=layer.children.length; j < l2; j++) {
                    z_pos = parseInt(-layer.children[j].depth + depth);
                    this._translateTo(layer.children[j].element, z_pos);
                }
            }
        },
        
        _translateTo: function(elem, value) {
            elem.style.transform="translateZ(" + value + "px)";
            elem.style.webkitTransform="translateZ(" + value + "px)";
            elem.style.MozTransform="translateZ(" + value + "px)";
            elem.style.OTransform="translateZ(" + value + "px)";
        },
        
        _getNextLayer: function() {
            this._used += 1;
            if(this._used >= (this.layers.length - 1))
                this._used = (this.layers.length - 1);
            return this.layers[this._used];
        },
        
        _getPreviousLayer: function() {
            this._used -= 1;
            if(this._used < 0)
                this._used = 0;
            return this.layers[this._used];
        },
        
        _moveTo: function(depth) {
            if((this._depths.current + this.speed) > depth
            && (this._depths.current - this.speed) < depth) {
                this._translateElements(depth);
                clearTimeout(this._timeout);
                this._timeout = null;
            } else {
                if(this._depths.current > depth)
                    this._depths.current -= this.speed;
                else
                    this._depths.current += this.speed;

                this._translateElements(this._depths.current);
                this._timeout = setTimeout(wink.bind(this._moveTo, this), this._fps, depth);
            }
        }
    };
    
    return wink.plugins.Projection;
});


