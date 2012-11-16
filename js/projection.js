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
    var fx  = wink.fx,
        log = wink.log;
    
    /**
     * @class Implements a projection effect navigation
     * 
     * This plugin allow you to implement easily a navigation by projection, a depth effect.<br />
     * Defined your sections with their depth values and an other for each children if you want.<br />
     * Use Javascript and/or CSS class name in your HTML for define each depth values of your HTML elements.<br />
     * Defined some callbacks for add effects during the navigation.
     * 
     * @param {object} properties The properties object
     * @param {string} properties.target the dom id container
     * @param {object} [properties.layers=[]] Define depth values of the HTML elements
     * @param {string} [properties.layers_prefix_class="depth"] Define the class name prefix for get the depth 
     * @param {integer}[properties.speed=10] Define the speed
     * @param {object} [properties.callbacks={}] Define callbacks for add customs effect or others process. (onStartSliding, onSliding, onEndSliding)
     * 
     * @requires wink.ux.gesture
     * 
     * @example
     * 
     *  new wink.plugins.Projection({
     *      target: 'wrapper',
     *      speed: 5,
     *      callbacks: {
     *          onStartSliding: function() { // TODO Something; },
     *          onSliding:      { context: window, method: 'func' },
     *          onEndSliding:   { context: window, method: 'func', args: ['toto', 'titi'] },
     *      },
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
     * @compatibility IOS 4, 5, 6
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
        
        wink.mixin(this, properties);
        
        this._target = wink.byId(this.target);
        
        this._perspective = 100;
        this._perspectiveOrigin = {
            x: '50%',
            y: '50%'
        };
        
        this._callbacks = {
            startSliding: null,
            sliding: null,
            endSliding: null
        };
        
        this._map = {};
        this._used = 0;
        
        this._timeout = null;
        this._fps = 1000/60;
        
        this._startPos = null;
        this._currPos = null;
        this._endPos = null;
        
        
        if(!this._validateProperties()) { 
            return false; 
        }
        
        this._initProperties();
        this._initDOM();
        this._initMap();
        this._initListeners();
        this._parseDOM();
        this._translateElements(this._currPos);
    };
    
    wink.plugins.Projection.prototype = 
    {
        /**
         * Move at the next pannel
         */
        move_forward: function() {
            if(!wink.isNull(this._timeout))
                return;
            
            this._startPos = this.layers[this._used].depth;
            var next = this.getNextPannel();
            this._endPos = this.layers[next].depth;
            
            if(wink.isCallback(this._callbacks.startSliding)) {
                wink.call(this._callbacks.startSliding, this._getArgs());
            }
            
            this._used = next;
            this._moveTo(this.layers[this._used].depth);
        },
        
        /**
         * Back to the previous pannel
         */
        move_backward: function() {
            if(!wink.isNull(this._timeout))
                return;
            
            this._startPos = this.layers[this._used].depth;
            var prev = this.getPreviousPanel();
            this._endPos = this.layers[prev].depth;
            
            if(wink.isCallback(this._callbacks.endSliding)) {
                wink.call(this._callbacks.endSliding, this._getArgs());
            }
            
            this._used = prev;
            this._moveTo(this.layers[this._used].depth);
        },
        
        /**
         * Set the perspective value.
         * This value is the far between the camera and the scene.
         * More this value is high and more the elements are near.
         * 
         * @param {integer} value
         */
        setPerspective: function(value) {
            this._perspective = value;
            this._initDOM();
        },
        
        /**
         * Set the vanishing point on the x axis
         * 
         * @param {string} value with the unit (%, em or px)
         */
        setPerspectiveOriginX: function(value) {
            this.setPerspectiveOrigin(value, this._perspectiveOrigin.y);
        },
        
        /**
         * Set the vanishing point on the y axis
         * 
         * @param {string} value with the unit (%, em or px)
         */
        setPerspectiveOriginY: function(value) {
            this.setPerspectiveOrigin(this._perspectiveOrigin.x, value);
        },
        
        /**
         * Set the vanishing point
         * 
         * @param {string} x value with the unit (%, em or px)
         * @param {string} y value with the unit (%, em or px)
         */
        setPerspectiveOrigin: function(x, y) {
            this._perspectiveOrigin.x = x;
            this._perspectiveOrigin.y = y;
            this._initDOM();
        },
        
        /**
         * Set the depth current value
         * 
         * @param {integer} value
         */
        setDepth: function(value) {
            this._currPos = value;
            this._translateElements(value);
        },
        
        /**
         * Returns the index of the current pannel (the pannel at the first plan).
         * The first index is 0, second 1, etc...
         * 
         * @return {integer}
         */
        getCurrentPanel: function() {
            return this._used;
        },
        
        /**
         * Returns the index of the next pannel (the pannel at the second plan)
         * The first index is 0, second 1, etc...
         * 
         * @return {integer}
         */
        getNextPannel: function() {
            var next = this._used + 1,
                max  = this.layers.length - 1;
            return next >  max ? max : next;
        },
        
        /**
         * Returns the index of the previous pannel (the first pannel behind the window)
         * The first index is 0, second 1, etc...
         * 
         * @return {integer}
         */
        getPreviousPanel: function() {
            var prev = this._used - 1;
            return prev < 0 ? 0 : prev;
        },
        
        /**
         * Return an object which will be used for the callback arguments
         * 
         * @return {object}
         */
        _getArgs: function() {
            return {
                'pannel': {
                    'next': this.getNextPannel(),
                    'current': this.getCurrentPanel(),
                    'prev': this.getPreviousPanel()
                },
                'depth': {
                    'start': this._startPos,
                    'current': this._currPos,
                    'end':  this._endPos
                }
            };
        },
        
        /**
         * Initializes properties from the user's parameters
         */
        _initProperties: function() {
            if(!wink.isSet(this.callbacks))
                return;
            
            var cbs = this.callbacks;
            if(wink.isCallback(cbs.onStartSliding))
                this._callbacks.startSliding = cbs.onStartSliding;
            
            if(wink.isCallback(cbs.onSliding))
                this._callbacks.sliding = cbs.onSliding;
            
            if(wink.isCallback(cbs.onEndSliding))
                this._callbacks.endSliding = cbs.onEndSliding;
        },
        
        /**
         * Checks if the user's parameters are correct
         * 
         * @return {boolean}
         */
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
                wink.log('[Error] - Projection - _validateProperties: '+error.message);
                return false;
            }
        },
        
        /**
         * Initializes the DOM properties
         */
        _initDOM: function() {
            fx.apply(this._target, {
                "transform-style": "preserve-3d",
                "perspective":  this._perspective,
                "perspective-origin": 
                    this._perspectiveOrigin.x + ' ' + 
                    this._perspectiveOrigin.y
            });
        },
        
        /**
         * Initializes an hashmap for create a relationship 
         * between the sections' id and the layers
         */
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
        
        /**
         * Parses the DOM for get depth values from the elements class name 
         */
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
                    fx.apply(layer.element, {
                        'transform-style': 'preserve-3d'
                    });
                    
                    // Start by the dephest element
                    if(this._currPos == null || this._currPos > layer.depth) {
                        this._currPos = layer.depth;
                    }
                }
                catch(error) {
                    wink.log('[Error] - Projection - _parseDOM: '+error.message);
                }
            }
            
            // Sort layer by depth
            this._sortLayers();
        },
        
        /**
         * Create layer from a DOM element and adds it to the layers tab
         * 
         * @param {HTMLElement} domNode
         * @return {object} layer
         */
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
        
        /**
         * Sort the layers tab according to the depth
         */
        _sortLayers: function() {
            this.layers.sort(function(a, b) {
                return a.depth - b.depth;
            });
        },
        
        /**
         * Initializes listeners
         */
        _initListeners: function() {
            wink.ux.gesture.listenTo(this._target, "enlargement", { context: this, method: "move_forward" }, { preventDefault: true });
            wink.ux.gesture.listenTo(this._target, "narrowing", { context: this, method: "move_backward" }, { preventDefault: true });
        },
        
        /**
         * Returns the depth value of an element from its class name
         * 
         * @return {integer}
         */
        _getDepthFromClass: function(className) {
            var pattern = eval('/'+this.layers_prefix_class+'((-)?[0-9]+)/');
            var result = className.match(pattern)[1];
            return parseInt(result);
        },
        
        /**
         * Translates elements on the z axis
         * 
         * @param {integer} depth
         */
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
        
        /**
         * Translates an element at a specific point on the z axis
         * 
         * @param {HTMLElement} elem
         * @param {integer} value
         */
        _translateTo: function(elem, value) {
            fx.setTransform(elem, 'translateZ('+value+'px)');
        },
        
        /**
         * Returns the next layer
         * 
         * @return {object}
         */
        _getNextLayer: function() {
            var next = this.getNextPannel();
            return this.layers[next];
        },
        
        /**
         * Returns the previous layer
         * 
         * @return {object}
         */
        _getPreviousLayer: function() {
            var prev = this.getPreviousPanel();
            return this.layers[prev];
        },
        
        /**
         * Stops the sliding event
         */
        _stopMove: function() {
            clearTimeout(this._timeout);
            this._timeout = null;
        },
        
        /**
         * Moves by sliding at a specific depth
         * 
         * @param {integer} depth
         */
        _moveTo: function(depth) 
        {
            if((this._currPos + this.speed) > depth
            && (this._currPos - this.speed) < depth)
            {
                this._translateElements(depth);
                this._stopMove();
                
                if(wink.isCallback(this._callbacks.endSliding)) {
                    wink.call(this._callbacks.endSliding, this._getArgs());
                }
            } 
            else 
            {
                if(this._currPos > depth) {
                    this._currPos -= this.speed;
                } else {
                    this._currPos += this.speed;
                }
                
                this._translateElements(this._currPos);
                
                if(wink.isCallback(this._callbacks.sliding)) {
                    wink.call(this._callbacks.sliding, this._getArgs());
                }
                
                this._timeout = setTimeout(wink.bind(this._moveTo, this), this._fps, depth);
            }
        }
    };
    
    return wink.plugins.Projection;
});


