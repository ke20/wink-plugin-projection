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
    /**
     * @class Implements a projection effect navigation
     * 
     * This plugin allow you to implement easily a navigation by projection, a depth effect.<br />
     * Define your sections with their depth values and an other for each children if you want.<br />
     * Use Javascript and/or CSS class name in your HTML for define each depth values of your HTML elements.
     * 
     * @param {object} properties The properties object
     * @param {string} properties.target the dom id container
     * @param {object} [properties.layers=[]] Define depth values of the HTML elements
     * @param {string} [properties.layers_prefix_class="depth"] Define the class name prefix for get the depth 
     * @param {integer}[properties.speed=10] Define the speed
     * @param {object} [properties.callbacks={}] Define callbacks for add customs effect or others process. (startScrolling, scrolling, endScrolling)
     * 
     * @requires wink.ux.gesture
     * 
     * @example
     * 
     *  new wink.plugins.Projection({
     *      target: 'wrapper',
     *      speed: 5,
     *      layers: [
     *          {
     *              element: wink.byId('section1'),
     *              depth: 100,
     *              children: [
     *                  { element: wink.byId('section1').children[0], depth: 122 },
     *                  { element: wink.byId('section1').children[1], depth: 176 },
     *                  { element: wink.byId('section1').children[2], depth: 180 }
     *              ]
     *          },
     *          {
     *              element: wink.byId('section2'),
     *              depth: 300,
     *              children: [
     *                  { element: wink.byId('section2').children[0], depth: 315 },
     *                  { element: wink.byId('section2').children[1], depth: 355 }
     *              ]
     *          }
     *      ]
     *  });
     * 
     * @compatibility TODO
     * 
     * @see <a href="WINK_ROOT_URL/plugins/projection/test/test_projection_1.html" target="_blank">Test page</a>
     * 
     */
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
        
        /**
         * Callbacks available
         * 
         * @property callbacks
         * @type object
         */
        this.callbacks = {};
        this._cb_args = {
            current: 0,
            from: 0,
            to: 0
        };
        
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
        
        this._currPos = null;
        
        if(!this._validateProperties()) { 
            return false; }
        
        this._initProperties();
        this._initDOM();
        this._initMap();
        this._initListeners();
        this._parseDOM();
        this._translateElements(this._currPos);
    };
    
    wink.plugins.Projection.prototype = 
    {
        move_forward: function() {
            if(this._timeout != null)
                return;
            
            var layer = this._getNextLayer();
            this._cb_args.from = this._currPos;
            this._cb_args.to = layer.depth;
            wink.publish('/projection/event/scrolling/start', this._cb_args);
            
            this._moveTo(layer.depth);
        },
        
        move_backward: function() {
            if(this._timeout != null)
                return;
            
            var layer = this._getPreviousLayer();
            this._cb_args.from = this._currPos;
            this._cb_args.to = layer.depth;
            wink.publish('/projection/event/scrolling/start', this._cb_args);
            
            this._moveTo(layer.depth);
        },
        
        setPerspective: function(value) {
            this._perspective = value;
            this._initDOM();
        },
        
        setPerspectiveOriginX: function(value) {
            this.setPerspectiveOrigin(value, this._perspectiveOrigin.y);
        },
        
        setPerspectiveOriginY: function(value) {
            this.setPerspectiveOrigin(this._perspectiveOrigin.x, value);
        },
        
        setPerspectiveOrigin: function(x, y) {
            this._perspectiveOrigin.x = x;
            this._perspectiveOrigin.y = y;
            this._initDOM();
        },
        
        setDepth: function(value) {
            this._currPos = value;
            this._translateElements(value);
        },
    
        _initProperties: function() {
            var cbs = this.callbacks;
            if(wink.isSet(cbs.startScrolling) && wink.isCallback(cbs.startScrolling))
                wink.subscribe('/projection/event/scrolling/start', cbs.startScrolling);
            
            if(wink.isSet(cbs.scrolling) && wink.isCallback(cbs.scrolling))
                wink.subscribe('/projection/event/scrolling', cbs.scrolling);
            
            if(wink.isSet(cbs.endScrolling) && wink.isCallback(cbs.endScrolling))
                wink.subscribe('/projection/event/scrolling/end', cbs.endScrolling);
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
            var list_sections = wink.query('section', this._target),
                section = null,
                layer   = null;
            
            for(var i=0, l=list_sections.length; i < l; i++) 
            {
                try
                {
                    section = list_sections[i];
                    if(wink.isNull(section.id) || wink.trim(section.id).length == 0)
                        throw Error('The section '+(i+1)+' has not id, please set one');

                    layer = this.layers[this._map[section.id]];
                    if(!wink.isSet(layer)) {
                        layer = this._addLayerItemFromDom(section);
                    }
                    
                    // Keep the 3d context for each element
                    wink.fx.apply(layer.element, {
                        'transform-style': 'preserve-3d'
                    });

                    // Start by the dephest element
                    if(this._currPos == null 
                    || this._currPos > layer.depth) {
                        this._currPos = layer.depth;
                        this._cb_args.current = layer.depth;
                    }
                }
                catch(error) {
                    wink.log(error.message);
                }
            }
            
            this._sortLayers();
        },
        
        _addLayerItemFromDom: function(domNode) 
        {
            // Define layer structure
            var layer = { 
                children: [],
                depth: 0,
                element: domNode
            };

            // Check an existing class for get the depth
            var className = domNode.className;
            if(wink.isNull(className) || !className.match(this.layers_prefix_class))
                throw Error('The section "'+domNode.id+'" has no class with the depth prefix, please set one');
            layer.depth = this._getDepthFromClass(className);

            // Get children with their depths
            var children = domNode.children;
            for(var j=0, l2=children.length; j < l2; j++) 
            {
                // If no class name, get it from parent
                className = children[j].className;
                if(wink.isNull(className) || !className.match(this.layers_prefix_class))
                    className = domNode.className;

                layer.children.push({
                    depth: this._getDepthFromClass(className),
                    element: children[j]
                });
            }

            // Add layer to the map
            var key = this.layers.push(layer);
            this._map[domNode.id] = key;
            return layer;
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
        
        _moveTo: function(depth) 
        {
            if((this._currPos + this.speed) > depth
            && (this._currPos - this.speed) < depth) 
            {
                this._translateElements(depth);
                clearTimeout(this._timeout);
                this._timeout = null;
                
                wink.publish('/projection/event/scrolling/end');
            } 
            else 
            {
                if(this._currPos > depth)
                    this._currPos -= this.speed;
                else
                    this._currPos += this.speed;
                
                this._translateElements(this._currPos);
                
                this._cb_args.current = this._currPos;
                wink.publish('/projection/event/scrolling', this._cb_args);
                
                this._timeout = setTimeout(wink.bind(this._moveTo, this), this._fps, depth);
            }
        }
    };
    
    return wink.plugins.Projection;
});


