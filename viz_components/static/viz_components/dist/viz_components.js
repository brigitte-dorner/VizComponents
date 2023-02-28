(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

document.addEventListener("DOMContentLoaded", () => {
// this eventListener collects all the canvases in the DOM that are marked as 'is=delta-arrow' and draws
// arrows on them as defined by the data-arrowdata attribute
    // adjust a coordinate for canvas resolution
    function inCanvasCoords(coord, canvas) {
        return Math.round(parseFloat(canvas.dataset.canvasres) * coord)
    }
    /**
     * Set up the canvas for drawing
     * @param canvas
     */
    function setup(canvas) {
        // adjust canvas to match dims of surrounding container
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.width = inCanvasCoords(canvas.offsetWidth, canvas);
        canvas.height = inCanvasCoords(canvas.offsetHeight, canvas);
        return canvas;
    }

    /**
     * get text dimensions for the given text string in pixels
     * @param ctx 2d drawing context for a canvas
     * @param {string} text the text to get the bounding box for
     * @param {number} fontSz
     * @param {string} font
     * @returns {{width: number, height: number}}
     */
    function getTextBbox(ctx, text, fontSz, font){
        const oldFont = ctx.font;
        ctx.font = fontSz + 'px ' + font;
        const textMetrics = ctx.measureText(text);
        ctx.font = oldFont;
        const tWidth = textMetrics.width + 2;
        const tHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent + 2;
        return {width: tWidth, height: tHeight};
    }

    /**
     * get mouse position in canvas coordinates
     * see https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
     * @param e mouse event
     * @param canvas the html canvas on which the mouse event occurred
     * @returns {{x: number, y: number}}
     */
    function getMousePos(e, canvas){
        const rect = canvas.getBoundingClientRect(), // abs. size of element
            scaleX = canvas.width / rect.width,    // relationship bitmap vs. element for x
            scaleY = canvas.height / rect.height;  // relationship bitmap vs. element for y
        return {
            x: (e.clientX - rect.left) * scaleX,   // scale mouse coordinates after they have
            y: (e.clientY - rect.top) * scaleY     // been adjusted to be relative to element
        }
    }

    /**
     * the triangle to be drawn on th canvas
     * @param parms
     * @param canvas
     * @returns {{width: number, height: number, setup(): void, draw(*): void, boxFitsInside(*): boolean}}
     */
    function triangle(parms, canvas) {
        /* asymptotic max height of the triangle in canvas pixels; assume that when base_align is center,
           the triangle at full size should fill either the top or the bottom half of the canvas,
           depending on which way it is pointing, whereas with base_align set to 'optimal',
           the triangle should be aligned so the drawing is centered inside the canvas  */
        const maxHt = parms.base_align === 'center' ? canvas.height / 2 : canvas.height;
        const s = Math.min(canvas.width / parms.max_width, maxHt / parms.max_ht);
        return {
            width: s * parms.width,
            height: s * parms.height,
            dir: parms.dir,
            boxFitsInside(box) { // check whether the given box fits inside the triangle
                const tanTheta = this.height / (this.width / 2); // get angle between base and side of triangle
                // the smaller triangle created by jamming a box of the given height in the left corner of the triangle
                // shares the same corner, and hence the same angle; use this to calc length of triangle base
                // outside the box, then use this length to calc the maximum width of the box of the given height
                // that will fit inside the triangle
                const dWidth = box.height / tanTheta;  // length of the part of the triangle base that's outside box
                const maxBboxWidth = this.width - (2 * dWidth); // maximum width box that will fit inside triangle
                return box.width <= maxBboxWidth
            },
            draw(ctx) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(this.width, 0); // base of triangle is always the same
                if (this.height === 0) {  // no change: just draw as a flat line
                    ctx.strokeStyle = parms.colors.no_change;
                    ctx.stroke();
                } else if (parms.dir === 'up') {   // draw a filled triangle pointing up
                    ctx.lineTo(this.width / 2, -this.height); // y coordinates on canvas go top to bottom
                    ctx.fillStyle = parms.colors.up;
                    ctx.fill()
                } else { // draw a filled triangle pointing down
                    ctx.lineTo(this.width / 2, this.height); // y coordinates on canvas go top to bottom
                    ctx.fillStyle = parms.colors.down;
                    ctx.fill();
                }}}
    }

    /**
     * the text label to be drawn inside or next to the triangle
     * @param parms
     * @returns {{getPaddedBBox(*, number=0): {width: number, height: number},
     *            getBBox(*, number=0): {width: number, height: number},
     *            offset: {outside: number, inside: number},
     *            setup(*): this,
     *            getMaxFitFontSz(*): number,
     *            draw(*): void,
     *            isOutside: bool }}
     */
    function textLabel(parms) {
        return {
            // bounding box, at given font_sz or this.font_sz
            getBBox(ctx, fontSz = 0) {
                return getTextBbox(ctx, parms.text, fontSz = fontSz > 0 ? fontSz : this.fontSz, parms.font);
            },
            // bounding box with y-offset and horizontal padding included
            getPaddedBBox(ctx, fontSz = 0) {
                const bbox = this.getBBox(ctx, fontSz);
                return {width: bbox.width + this.padding, height: bbox.height + this.offset.inside};
            },
            // the maximum font size at which the label will fit inside the triangle t
            getMaxFitFontSz(ctx, triangle) {
                if (!triangle.boxFitsInside(this.getPaddedBBox(ctx, this.minFontSz))) return 0;
                let fontSz = 6;
                while (triangle.boxFitsInside(this.getPaddedBBox(ctx, fontSz))) { fontSz = fontSz + 1; }
                return fontSz - 1;
            },
            // set up label
            setup(ctx, triangle, canvas) {
                // label offsets, for inside and outside of triangle respectively
                this.offset = { inside: Math.round(parms.offset.inside * triangle.height),
                                outside: Math.round(parms.offset.outside * canvas.height) };
                               // padding around label in horizontal direction, adjust for oversampling
                this.padding = inCanvasCoords(parms.padding, canvas);
                // minimum acceptable font size, adjusted for oversampling
                this.minFontSz = inCanvasCoords(parms.min_font_size, canvas);
                // max font size that fits inside the triangle
                const maxFontSz = this.getMaxFitFontSz(ctx, triangle);
                // determine whether label should go outside triangle
                this.isOutside = maxFontSz < this.minFontSz;
                this.color = this.isOutside ? parms.colors.outside : parms.colors.inside;
                this.fontSz = this.isOutside ? this.minFontSz : maxFontSz;
                this.height = this.getBBox(ctx, this.fontSz).height;
                 this.x = triangle.width / 2;
                // the label y position: ideally hovering above the triangle base at the given percentage of t.height,
                // but if it doesn't fit into the triangle, put it above (or below) the peak instead.
                this.y = this.isOutside ? (triangle.height + this.offset.outside) : this.offset.inside;
                this.y = triangle.dir === 'up' ? -this.y : this.y; // canvas coordinates go top to bottom!
                this.baseline = triangle.dir === 'down' ? 'top' : 'bottom';
                return this;
            },
            // draw the label
            draw(ctx) { // draw label on canvas context
                ctx.font = this.fontSz + 'px ' + parms.font;
                ctx.fillStyle = this.color;
                ctx.textAlign = 'center'; // horizontal text align
                ctx.textBaseline = this.baseline;
                ctx.fillText(parms.text, this.x, this.y); // y coordinates on canvas run top to bottom
            }
        }
    }

    /**
     * draw the arrow on the canvas
     * @param canvas
     */
    function draw(canvas){
        // Get the context for the canvas
        let ctx = canvas.getContext('2d');
        // Get the custom data attribute specified in HTML
        const parms = JSON.parse(canvas.dataset.arrowdata);
        // set up the triangle
        const t = triangle(parms, canvas);
        // set up the text label
        const l = textLabel(parms.label).setup(ctx, t, canvas);

        /*** create the drawing ***/
        // total height of the drawing, including space needed for the label
        const drawingHt = t.height + (l.isOutside ? (l.offset.outside + l.height) : 0);
        // offset for drawing in x direction: distribute white space evenly around the triangle
        const xoffset = (canvas.width - t.width) / 2;
        // offset for drawing in y direction:
        // base_align == 'center': triangle base should be centered on the canvas
        // base_align == 'optimal': drawing should be centered on the canvas (optimal use of space)
        const yoffset = canvas.height / 2 +
            (parms.base_align === 'center' ? 0 : (parms.dir === 'up' ? drawingHt / 2 : -drawingHt / 2));

        ctx.translate(xoffset, yoffset);
        t.draw(ctx); // draw triangle
        l.draw(ctx); // draw label

        /*** set up drawing bounding box - need this for tooltip ***/
        const ymax = parms.dir === 'up' ? (canvas.height / 2 + yoffset) : (canvas.height / 2 + yoffset + drawingHt);
        const drawingBbox = {
            xmin: xoffset,
            xmax: xoffset + t.width,
            ymin: ymax - drawingHt,
            ymax: ymax,
            contains: function (p) {
                return this.xmax >= p.x && p.x >= this.xmin && this.ymax >= p.y && p.y >= this.ymin;
            }
        }

        // set the tooltip content - not strictly part of drawing, but do this here because it requires access to
        // the arrow parameters
        document.getElementById(canvas.id + "tooltiptext").textContent = parms.tooltip;

        return drawingBbox;
    }

    // Get the arrow canvas elements
    const arrows = document.querySelectorAll('canvas[is="delta-arrow"]');
    arrows.forEach((arrow) => {
        setup(arrow); // set up canvas layout before drawing
        // draw the arrow - this returns a bounding box for the drawing
        arrow.drawingBbox = draw(arrow);
        // Listen for mouse moves - show css tooltip while mouse over drawing
        arrow.addEventListener('mousemove', function (e) {
            // mouse position in canvas coordinates
            const mousePos = getMousePos(e, this);
            if (this.drawingBbox.contains(mousePos)) {
                let ttip = document.getElementById(arrow.id + "tooltip");
                ttip.style.top = Math.round(mousePos.y / this.dataset.canvasres - ttip.offsetHeight) + 'px'; // move tip above cursor
                ttip.style.left = Math.round(mousePos.x / this.dataset.canvasres) + 'px';
                document.getElementById(this.id + "tooltiptext").style.visibility = 'visible';
            } else {
                document.getElementById(this.id + "tooltiptext").style.visibility = 'hidden';
            }
        });
    });
});


},{}],2:[function(require,module,exports){
// this eventListener collects all the canvases in the DOM that are marked as 'is=bar-chart' and draws
// bar charts as defined by the data-chartdata and data-chartopts attributes
document.addEventListener("DOMContentLoaded", () => {

    // Define a chart.js plugin for adding an image to the category labels on the y-axis.
    // Image source is specified in the options for this plugin as a dictionary.
    // The keys in this dictionary are the axis labels associated with the images;
    // e.g. specify 'Area': 'area.png' to indicate that area.png should go with the 'Area' label.
    const addCategoryImages = {
        id: 'labelImagesPlugin',
        afterDraw(chart, args, options) {
            let ctx = chart.ctx;
            const xAxis = chart.scales['x'];
            const yAxis = chart.scales['y'];
            yAxis._labelItems.forEach((dataCat, index) => {
                if (dataCat.label in options) { // options
                    const y = yAxis.getPixelForTick(index);
                    let image = new Image();
                    image.src = options[dataCat.label];
                    // yAxis.width conveniently seems to include the width of the text labels
                    // so putting the image just to the left of that seems to work fine
                    const xOffset = yAxis.width + image.width;
                    ctx.drawImage(image, xAxis.left - xOffset, y - Math.round(image.height / 2));
                }
            });
        }
    };

    // Define a chart.js plugin for adding text labels inside each horizontal bar.
    const addBarLabels = {
        id: 'barLabelPlugin',
        afterDraw(chart, args, options) {
            let ctx = chart.ctx;
            for (let i = 0; i < chart.data.datasets.length; i++) {
                let ds = chart.getDatasetMeta(i); // get meta info for this dataset
                if (ds.type === "bar") { // skip any line data; only interested in the bars here
                    const dsName = ds.label;
                    for (let j = 0; j < ds.data.length; j++) {
                        //each datapoint in this dataset corresponds to a bar;
                        // need to figure out the dimensions of the bar and text to go into the bar;
                        // then put the text into the center of the bar if it fits, to the right of the bar if not
                        const barWidth = ds.data[j].$context.element.width;
                        const text = options[dsName].labels[j];
                        const textWidth = ctx.measureText(text).width;
                        let textAnchor = ds.data[j].getCenterPoint();
                        if (barWidth > textWidth) {
                            ctx.textAlign = "center";
                        } else {
                            textAnchor.x = ds.data[j].$context.element.x;
                            textAnchor.y = ds.data[j].$context.element.y;
                            ctx.textAlign = "left";
                        }
                        ctx.textBaseline = "middle"; // vertical align to center of bar
                        ctx.fillStyle = options[dsName].color || options.color;
                        // todo: allow for font styling
                        if (textWidth > 0) ctx.fillText(text, textAnchor.x, textAnchor.y);
                    }
                }
            }
        },
        defaults: {
            color: 'white', // use white text if no color specified by user
        }
    };

    // Define a chart.js plugin for adding the word 'Target' above the target line.
    const addTargetLabel = {
        id: 'targetLabelPlugin',
        afterDraw(chart, args, options) {
            let ctx = chart.ctx;
            let ds = chart.getDatasetMeta(0); // dataset 0 is the target line
            const endPt = ds.data[0];
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom"; // vertical alignment
            ctx.fillStyle = 'black';
            // todo: font styling
            ctx.fillText('Target', endPt.x, endPt.y - 10);
        },
    };

    // draw the bar chart on the canvas
    function draw(canvas) {
        const chartdata = JSON.parse(canvas.dataset.chartdata);
        let chartopts = JSON.parse(canvas.dataset.chartopts);
        // set up tooltip to show when hovering over a bar
        chartopts.plugins['tooltip'] = {
            'callbacks': {
                'label': function (context) {
                    // simplified tooltip for now, just show the type of dataset;
                    // todo: may want to add value as percentage here
                    return context.dataset.label || '';
                }
            }
        }
        // create the chart using Chart.js
        const chart = new Chart(canvas, {
            type: 'bar',
            data: chartdata,
            options: chartopts,
            plugins: [addCategoryImages, addBarLabels, addTargetLabel],
        });
    }

    // Get the bar chart canvas elements
    const charts = document.querySelectorAll('canvas[is="bar-chart"]');
    charts.forEach((chart) => {
        draw(chart);
    });
});



},{}],3:[function(require,module,exports){
// this eventListener collects all the canvases in the DOM that are marked as 'is=doughnut-chart' and draws
// doughnut charts as defined by the data-chartdata and data-chartopts attributes
document.addEventListener("DOMContentLoaded", () => {

    // draw the doughnut chart on the canvas using chart.js
    function draw(canvas) {
        const chartdata = JSON.parse(canvas.dataset.chartdata);
        let chartopts = JSON.parse(canvas.dataset.chartopts);
        // add callbacks for custom tooltip formats
        chartopts.plugins['tooltip'] = {
            callbacks: {
                title: function (context) {
                    return context[0].label;
                },
                label: function (context) {
                    let total = 0;
                    context.dataset.data.map(e => total += e);
                    return ' ' + context.parsed + ' (' + Math.round(100 * context.parsed / total) + '%)';
                },
            }
        };
        const chart = new Chart(canvas, {type: 'doughnut', data: chartdata, options: chartopts});
    }

    // Get the doughnut chart canvas elements in the DOM
    const charts = document.querySelectorAll('canvas[is="doughnut-chart"]');
    charts.forEach((chart) => {
        draw(chart);
    });
});



},{}],4:[function(require,module,exports){
// this eventListener collects all the canvases in the DOM that are marked as 'is=stacked-doughnut-chart' and draws
// doughnut charts as defined by the data-chartdata and data-chartopts attributes
document.addEventListener("DOMContentLoaded", () => {
    // draw the doughnut chart on the canvas using chart.js
    function draw(canvas) {
        const chartdata = JSON.parse(canvas.dataset.chartdata);
        let chartopts = JSON.parse(canvas.dataset.chartopts);
        // add callbacks for custom tooltip formats here
        chartopts.plugins['tooltip'] = {
            callbacks: {
                title: function (context) {
                    return context[0].dataset.catLabels[context[0].dataIndex];
                },
                label: function (context) {
                    let total = 0;
                    context.dataset.data.map(e => total += e);
                    return ' ' + context.parsed + ' (' + Math.round(100 * context.parsed / total) + '%)';
                },
            }
        };
        const chart = new Chart(canvas, {type: 'doughnut', data: chartdata, options: chartopts});
    }

    // Get the doughnut chart canvas elements
    const charts = document.querySelectorAll('canvas[is="stacked-doughnut-chart"]');
    charts.forEach((chart) => {
        draw(chart);
    });
});

},{}],5:[function(require,module,exports){
// this packages up all bits and pieces into a single js file
// can come from local dir or nmp directory
// install external sources via nmp, ideally from node, but can pull from github directly if needed
// use browserify-shim to exclude large shared components from dist bundle
// see package.json in hydronet/client-side for sample build process with shim
//var chartjs = require('chart.js');
//var DoughnutLabel = require('chartjs-plugin-doughnutlabel-v3');
require('./arrow.js');
require('./bar_chart.js');
require('./doughnut_chart.js');
require('./stacked_doughtnut_chart.js');

},{"./arrow.js":1,"./bar_chart.js":2,"./doughnut_chart.js":3,"./stacked_doughtnut_chart.js":4}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJ2aXpfY29tcG9uZW50cy9qcy9hcnJvdy5qcyIsInZpel9jb21wb25lbnRzL2pzL2Jhcl9jaGFydC5qcyIsInZpel9jb21wb25lbnRzL2pzL2RvdWdobnV0X2NoYXJ0LmpzIiwidml6X2NvbXBvbmVudHMvanMvc3RhY2tlZF9kb3VnaHRudXRfY2hhcnQuanMiLCJ2aXpfY29tcG9uZW50cy9qcy92aXpfY29tcG9uZW50cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4vLyB0aGlzIGV2ZW50TGlzdGVuZXIgY29sbGVjdHMgYWxsIHRoZSBjYW52YXNlcyBpbiB0aGUgRE9NIHRoYXQgYXJlIG1hcmtlZCBhcyAnaXM9ZGVsdGEtYXJyb3cnIGFuZCBkcmF3c1xuLy8gYXJyb3dzIG9uIHRoZW0gYXMgZGVmaW5lZCBieSB0aGUgZGF0YS1hcnJvd2RhdGEgYXR0cmlidXRlXG4gICAgLy8gYWRqdXN0IGEgY29vcmRpbmF0ZSBmb3IgY2FudmFzIHJlc29sdXRpb25cbiAgICBmdW5jdGlvbiBpbkNhbnZhc0Nvb3Jkcyhjb29yZCwgY2FudmFzKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnJvdW5kKHBhcnNlRmxvYXQoY2FudmFzLmRhdGFzZXQuY2FudmFzcmVzKSAqIGNvb3JkKVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZXQgdXAgdGhlIGNhbnZhcyBmb3IgZHJhd2luZ1xuICAgICAqIEBwYXJhbSBjYW52YXNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzZXR1cChjYW52YXMpIHtcbiAgICAgICAgLy8gYWRqdXN0IGNhbnZhcyB0byBtYXRjaCBkaW1zIG9mIHN1cnJvdW5kaW5nIGNvbnRhaW5lclxuICAgICAgICBjYW52YXMuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IGluQ2FudmFzQ29vcmRzKGNhbnZhcy5vZmZzZXRXaWR0aCwgY2FudmFzKTtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGluQ2FudmFzQ29vcmRzKGNhbnZhcy5vZmZzZXRIZWlnaHQsIGNhbnZhcyk7XG4gICAgICAgIHJldHVybiBjYW52YXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZ2V0IHRleHQgZGltZW5zaW9ucyBmb3IgdGhlIGdpdmVuIHRleHQgc3RyaW5nIGluIHBpeGVsc1xuICAgICAqIEBwYXJhbSBjdHggMmQgZHJhd2luZyBjb250ZXh0IGZvciBhIGNhbnZhc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IHRoZSB0ZXh0IHRvIGdldCB0aGUgYm91bmRpbmcgYm94IGZvclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmb250U3pcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZm9udFxuICAgICAqIEByZXR1cm5zIHt7d2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXJ9fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldFRleHRCYm94KGN0eCwgdGV4dCwgZm9udFN6LCBmb250KXtcbiAgICAgICAgY29uc3Qgb2xkRm9udCA9IGN0eC5mb250O1xuICAgICAgICBjdHguZm9udCA9IGZvbnRTeiArICdweCAnICsgZm9udDtcbiAgICAgICAgY29uc3QgdGV4dE1ldHJpY3MgPSBjdHgubWVhc3VyZVRleHQodGV4dCk7XG4gICAgICAgIGN0eC5mb250ID0gb2xkRm9udDtcbiAgICAgICAgY29uc3QgdFdpZHRoID0gdGV4dE1ldHJpY3Mud2lkdGggKyAyO1xuICAgICAgICBjb25zdCB0SGVpZ2h0ID0gdGV4dE1ldHJpY3MuYWN0dWFsQm91bmRpbmdCb3hBc2NlbnQgKyB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveERlc2NlbnQgKyAyO1xuICAgICAgICByZXR1cm4ge3dpZHRoOiB0V2lkdGgsIGhlaWdodDogdEhlaWdodH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZ2V0IG1vdXNlIHBvc2l0aW9uIGluIGNhbnZhcyBjb29yZGluYXRlc1xuICAgICAqIHNlZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNzEzMDM5NS9yZWFsLW1vdXNlLXBvc2l0aW9uLWluLWNhbnZhc1xuICAgICAqIEBwYXJhbSBlIG1vdXNlIGV2ZW50XG4gICAgICogQHBhcmFtIGNhbnZhcyB0aGUgaHRtbCBjYW52YXMgb24gd2hpY2ggdGhlIG1vdXNlIGV2ZW50IG9jY3VycmVkXG4gICAgICogQHJldHVybnMge3t4OiBudW1iZXIsIHk6IG51bWJlcn19XG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0TW91c2VQb3MoZSwgY2FudmFzKXtcbiAgICAgICAgY29uc3QgcmVjdCA9IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSwgLy8gYWJzLiBzaXplIG9mIGVsZW1lbnRcbiAgICAgICAgICAgIHNjYWxlWCA9IGNhbnZhcy53aWR0aCAvIHJlY3Qud2lkdGgsICAgIC8vIHJlbGF0aW9uc2hpcCBiaXRtYXAgdnMuIGVsZW1lbnQgZm9yIHhcbiAgICAgICAgICAgIHNjYWxlWSA9IGNhbnZhcy5oZWlnaHQgLyByZWN0LmhlaWdodDsgIC8vIHJlbGF0aW9uc2hpcCBiaXRtYXAgdnMuIGVsZW1lbnQgZm9yIHlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IChlLmNsaWVudFggLSByZWN0LmxlZnQpICogc2NhbGVYLCAgIC8vIHNjYWxlIG1vdXNlIGNvb3JkaW5hdGVzIGFmdGVyIHRoZXkgaGF2ZVxuICAgICAgICAgICAgeTogKGUuY2xpZW50WSAtIHJlY3QudG9wKSAqIHNjYWxlWSAgICAgLy8gYmVlbiBhZGp1c3RlZCB0byBiZSByZWxhdGl2ZSB0byBlbGVtZW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0aGUgdHJpYW5nbGUgdG8gYmUgZHJhd24gb24gdGggY2FudmFzXG4gICAgICogQHBhcmFtIHBhcm1zXG4gICAgICogQHBhcmFtIGNhbnZhc1xuICAgICAqIEByZXR1cm5zIHt7d2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHNldHVwKCk6IHZvaWQsIGRyYXcoKik6IHZvaWQsIGJveEZpdHNJbnNpZGUoKik6IGJvb2xlYW59fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRyaWFuZ2xlKHBhcm1zLCBjYW52YXMpIHtcbiAgICAgICAgLyogYXN5bXB0b3RpYyBtYXggaGVpZ2h0IG9mIHRoZSB0cmlhbmdsZSBpbiBjYW52YXMgcGl4ZWxzOyBhc3N1bWUgdGhhdCB3aGVuIGJhc2VfYWxpZ24gaXMgY2VudGVyLFxuICAgICAgICAgICB0aGUgdHJpYW5nbGUgYXQgZnVsbCBzaXplIHNob3VsZCBmaWxsIGVpdGhlciB0aGUgdG9wIG9yIHRoZSBib3R0b20gaGFsZiBvZiB0aGUgY2FudmFzLFxuICAgICAgICAgICBkZXBlbmRpbmcgb24gd2hpY2ggd2F5IGl0IGlzIHBvaW50aW5nLCB3aGVyZWFzIHdpdGggYmFzZV9hbGlnbiBzZXQgdG8gJ29wdGltYWwnLFxuICAgICAgICAgICB0aGUgdHJpYW5nbGUgc2hvdWxkIGJlIGFsaWduZWQgc28gdGhlIGRyYXdpbmcgaXMgY2VudGVyZWQgaW5zaWRlIHRoZSBjYW52YXMgICovXG4gICAgICAgIGNvbnN0IG1heEh0ID0gcGFybXMuYmFzZV9hbGlnbiA9PT0gJ2NlbnRlcicgPyBjYW52YXMuaGVpZ2h0IC8gMiA6IGNhbnZhcy5oZWlnaHQ7XG4gICAgICAgIGNvbnN0IHMgPSBNYXRoLm1pbihjYW52YXMud2lkdGggLyBwYXJtcy5tYXhfd2lkdGgsIG1heEh0IC8gcGFybXMubWF4X2h0KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHdpZHRoOiBzICogcGFybXMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHMgKiBwYXJtcy5oZWlnaHQsXG4gICAgICAgICAgICBkaXI6IHBhcm1zLmRpcixcbiAgICAgICAgICAgIGJveEZpdHNJbnNpZGUoYm94KSB7IC8vIGNoZWNrIHdoZXRoZXIgdGhlIGdpdmVuIGJveCBmaXRzIGluc2lkZSB0aGUgdHJpYW5nbGVcbiAgICAgICAgICAgICAgICBjb25zdCB0YW5UaGV0YSA9IHRoaXMuaGVpZ2h0IC8gKHRoaXMud2lkdGggLyAyKTsgLy8gZ2V0IGFuZ2xlIGJldHdlZW4gYmFzZSBhbmQgc2lkZSBvZiB0cmlhbmdsZVxuICAgICAgICAgICAgICAgIC8vIHRoZSBzbWFsbGVyIHRyaWFuZ2xlIGNyZWF0ZWQgYnkgamFtbWluZyBhIGJveCBvZiB0aGUgZ2l2ZW4gaGVpZ2h0IGluIHRoZSBsZWZ0IGNvcm5lciBvZiB0aGUgdHJpYW5nbGVcbiAgICAgICAgICAgICAgICAvLyBzaGFyZXMgdGhlIHNhbWUgY29ybmVyLCBhbmQgaGVuY2UgdGhlIHNhbWUgYW5nbGU7IHVzZSB0aGlzIHRvIGNhbGMgbGVuZ3RoIG9mIHRyaWFuZ2xlIGJhc2VcbiAgICAgICAgICAgICAgICAvLyBvdXRzaWRlIHRoZSBib3gsIHRoZW4gdXNlIHRoaXMgbGVuZ3RoIHRvIGNhbGMgdGhlIG1heGltdW0gd2lkdGggb2YgdGhlIGJveCBvZiB0aGUgZ2l2ZW4gaGVpZ2h0XG4gICAgICAgICAgICAgICAgLy8gdGhhdCB3aWxsIGZpdCBpbnNpZGUgdGhlIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgY29uc3QgZFdpZHRoID0gYm94LmhlaWdodCAvIHRhblRoZXRhOyAgLy8gbGVuZ3RoIG9mIHRoZSBwYXJ0IG9mIHRoZSB0cmlhbmdsZSBiYXNlIHRoYXQncyBvdXRzaWRlIGJveFxuICAgICAgICAgICAgICAgIGNvbnN0IG1heEJib3hXaWR0aCA9IHRoaXMud2lkdGggLSAoMiAqIGRXaWR0aCk7IC8vIG1heGltdW0gd2lkdGggYm94IHRoYXQgd2lsbCBmaXQgaW5zaWRlIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJveC53aWR0aCA8PSBtYXhCYm94V2lkdGhcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkcmF3KGN0eCkge1xuICAgICAgICAgICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgICAgICAgICBjdHgubW92ZVRvKDAsIDApO1xuICAgICAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy53aWR0aCwgMCk7IC8vIGJhc2Ugb2YgdHJpYW5nbGUgaXMgYWx3YXlzIHRoZSBzYW1lXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaGVpZ2h0ID09PSAwKSB7ICAvLyBubyBjaGFuZ2U6IGp1c3QgZHJhdyBhcyBhIGZsYXQgbGluZVxuICAgICAgICAgICAgICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSBwYXJtcy5jb2xvcnMubm9fY2hhbmdlO1xuICAgICAgICAgICAgICAgICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXJtcy5kaXIgPT09ICd1cCcpIHsgICAvLyBkcmF3IGEgZmlsbGVkIHRyaWFuZ2xlIHBvaW50aW5nIHVwXG4gICAgICAgICAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy53aWR0aCAvIDIsIC10aGlzLmhlaWdodCk7IC8vIHkgY29vcmRpbmF0ZXMgb24gY2FudmFzIGdvIHRvcCB0byBib3R0b21cbiAgICAgICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHBhcm1zLmNvbG9ycy51cDtcbiAgICAgICAgICAgICAgICAgICAgY3R4LmZpbGwoKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIGRyYXcgYSBmaWxsZWQgdHJpYW5nbGUgcG9pbnRpbmcgZG93blxuICAgICAgICAgICAgICAgICAgICBjdHgubGluZVRvKHRoaXMud2lkdGggLyAyLCB0aGlzLmhlaWdodCk7IC8vIHkgY29vcmRpbmF0ZXMgb24gY2FudmFzIGdvIHRvcCB0byBib3R0b21cbiAgICAgICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHBhcm1zLmNvbG9ycy5kb3duO1xuICAgICAgICAgICAgICAgICAgICBjdHguZmlsbCgpO1xuICAgICAgICAgICAgICAgIH19fVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHRoZSB0ZXh0IGxhYmVsIHRvIGJlIGRyYXduIGluc2lkZSBvciBuZXh0IHRvIHRoZSB0cmlhbmdsZVxuICAgICAqIEBwYXJhbSBwYXJtc1xuICAgICAqIEByZXR1cm5zIHt7Z2V0UGFkZGVkQkJveCgqLCBudW1iZXI9MCk6IHt3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcn0sXG4gICAgICogICAgICAgICAgICBnZXRCQm94KCosIG51bWJlcj0wKToge3dpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyfSxcbiAgICAgKiAgICAgICAgICAgIG9mZnNldDoge291dHNpZGU6IG51bWJlciwgaW5zaWRlOiBudW1iZXJ9LFxuICAgICAqICAgICAgICAgICAgc2V0dXAoKik6IHRoaXMsXG4gICAgICogICAgICAgICAgICBnZXRNYXhGaXRGb250U3ooKik6IG51bWJlcixcbiAgICAgKiAgICAgICAgICAgIGRyYXcoKik6IHZvaWQsXG4gICAgICogICAgICAgICAgICBpc091dHNpZGU6IGJvb2wgfX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB0ZXh0TGFiZWwocGFybXMpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8vIGJvdW5kaW5nIGJveCwgYXQgZ2l2ZW4gZm9udF9zeiBvciB0aGlzLmZvbnRfc3pcbiAgICAgICAgICAgIGdldEJCb3goY3R4LCBmb250U3ogPSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFRleHRCYm94KGN0eCwgcGFybXMudGV4dCwgZm9udFN6ID0gZm9udFN6ID4gMCA/IGZvbnRTeiA6IHRoaXMuZm9udFN6LCBwYXJtcy5mb250KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBib3VuZGluZyBib3ggd2l0aCB5LW9mZnNldCBhbmQgaG9yaXpvbnRhbCBwYWRkaW5nIGluY2x1ZGVkXG4gICAgICAgICAgICBnZXRQYWRkZWRCQm94KGN0eCwgZm9udFN6ID0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJib3ggPSB0aGlzLmdldEJCb3goY3R4LCBmb250U3opO1xuICAgICAgICAgICAgICAgIHJldHVybiB7d2lkdGg6IGJib3gud2lkdGggKyB0aGlzLnBhZGRpbmcsIGhlaWdodDogYmJveC5oZWlnaHQgKyB0aGlzLm9mZnNldC5pbnNpZGV9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIHRoZSBtYXhpbXVtIGZvbnQgc2l6ZSBhdCB3aGljaCB0aGUgbGFiZWwgd2lsbCBmaXQgaW5zaWRlIHRoZSB0cmlhbmdsZSB0XG4gICAgICAgICAgICBnZXRNYXhGaXRGb250U3ooY3R4LCB0cmlhbmdsZSkge1xuICAgICAgICAgICAgICAgIGlmICghdHJpYW5nbGUuYm94Rml0c0luc2lkZSh0aGlzLmdldFBhZGRlZEJCb3goY3R4LCB0aGlzLm1pbkZvbnRTeikpKSByZXR1cm4gMDtcbiAgICAgICAgICAgICAgICBsZXQgZm9udFN6ID0gNjtcbiAgICAgICAgICAgICAgICB3aGlsZSAodHJpYW5nbGUuYm94Rml0c0luc2lkZSh0aGlzLmdldFBhZGRlZEJCb3goY3R4LCBmb250U3opKSkgeyBmb250U3ogPSBmb250U3ogKyAxOyB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvbnRTeiAtIDE7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gc2V0IHVwIGxhYmVsXG4gICAgICAgICAgICBzZXR1cChjdHgsIHRyaWFuZ2xlLCBjYW52YXMpIHtcbiAgICAgICAgICAgICAgICAvLyBsYWJlbCBvZmZzZXRzLCBmb3IgaW5zaWRlIGFuZCBvdXRzaWRlIG9mIHRyaWFuZ2xlIHJlc3BlY3RpdmVseVxuICAgICAgICAgICAgICAgIHRoaXMub2Zmc2V0ID0geyBpbnNpZGU6IE1hdGgucm91bmQocGFybXMub2Zmc2V0Lmluc2lkZSAqIHRyaWFuZ2xlLmhlaWdodCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHNpZGU6IE1hdGgucm91bmQocGFybXMub2Zmc2V0Lm91dHNpZGUgKiBjYW52YXMuaGVpZ2h0KSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhZGRpbmcgYXJvdW5kIGxhYmVsIGluIGhvcml6b250YWwgZGlyZWN0aW9uLCBhZGp1c3QgZm9yIG92ZXJzYW1wbGluZ1xuICAgICAgICAgICAgICAgIHRoaXMucGFkZGluZyA9IGluQ2FudmFzQ29vcmRzKHBhcm1zLnBhZGRpbmcsIGNhbnZhcyk7XG4gICAgICAgICAgICAgICAgLy8gbWluaW11bSBhY2NlcHRhYmxlIGZvbnQgc2l6ZSwgYWRqdXN0ZWQgZm9yIG92ZXJzYW1wbGluZ1xuICAgICAgICAgICAgICAgIHRoaXMubWluRm9udFN6ID0gaW5DYW52YXNDb29yZHMocGFybXMubWluX2ZvbnRfc2l6ZSwgY2FudmFzKTtcbiAgICAgICAgICAgICAgICAvLyBtYXggZm9udCBzaXplIHRoYXQgZml0cyBpbnNpZGUgdGhlIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgY29uc3QgbWF4Rm9udFN6ID0gdGhpcy5nZXRNYXhGaXRGb250U3ooY3R4LCB0cmlhbmdsZSk7XG4gICAgICAgICAgICAgICAgLy8gZGV0ZXJtaW5lIHdoZXRoZXIgbGFiZWwgc2hvdWxkIGdvIG91dHNpZGUgdHJpYW5nbGVcbiAgICAgICAgICAgICAgICB0aGlzLmlzT3V0c2lkZSA9IG1heEZvbnRTeiA8IHRoaXMubWluRm9udFN6O1xuICAgICAgICAgICAgICAgIHRoaXMuY29sb3IgPSB0aGlzLmlzT3V0c2lkZSA/IHBhcm1zLmNvbG9ycy5vdXRzaWRlIDogcGFybXMuY29sb3JzLmluc2lkZTtcbiAgICAgICAgICAgICAgICB0aGlzLmZvbnRTeiA9IHRoaXMuaXNPdXRzaWRlID8gdGhpcy5taW5Gb250U3ogOiBtYXhGb250U3o7XG4gICAgICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLmdldEJCb3goY3R4LCB0aGlzLmZvbnRTeikuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICB0aGlzLnggPSB0cmlhbmdsZS53aWR0aCAvIDI7XG4gICAgICAgICAgICAgICAgLy8gdGhlIGxhYmVsIHkgcG9zaXRpb246IGlkZWFsbHkgaG92ZXJpbmcgYWJvdmUgdGhlIHRyaWFuZ2xlIGJhc2UgYXQgdGhlIGdpdmVuIHBlcmNlbnRhZ2Ugb2YgdC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGlmIGl0IGRvZXNuJ3QgZml0IGludG8gdGhlIHRyaWFuZ2xlLCBwdXQgaXQgYWJvdmUgKG9yIGJlbG93KSB0aGUgcGVhayBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgIHRoaXMueSA9IHRoaXMuaXNPdXRzaWRlID8gKHRyaWFuZ2xlLmhlaWdodCArIHRoaXMub2Zmc2V0Lm91dHNpZGUpIDogdGhpcy5vZmZzZXQuaW5zaWRlO1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IHRyaWFuZ2xlLmRpciA9PT0gJ3VwJyA/IC10aGlzLnkgOiB0aGlzLnk7IC8vIGNhbnZhcyBjb29yZGluYXRlcyBnbyB0b3AgdG8gYm90dG9tIVxuICAgICAgICAgICAgICAgIHRoaXMuYmFzZWxpbmUgPSB0cmlhbmdsZS5kaXIgPT09ICdkb3duJyA/ICd0b3AnIDogJ2JvdHRvbSc7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gZHJhdyB0aGUgbGFiZWxcbiAgICAgICAgICAgIGRyYXcoY3R4KSB7IC8vIGRyYXcgbGFiZWwgb24gY2FudmFzIGNvbnRleHRcbiAgICAgICAgICAgICAgICBjdHguZm9udCA9IHRoaXMuZm9udFN6ICsgJ3B4ICcgKyBwYXJtcy5mb250O1xuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmNvbG9yO1xuICAgICAgICAgICAgICAgIGN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJzsgLy8gaG9yaXpvbnRhbCB0ZXh0IGFsaWduXG4gICAgICAgICAgICAgICAgY3R4LnRleHRCYXNlbGluZSA9IHRoaXMuYmFzZWxpbmU7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxUZXh0KHBhcm1zLnRleHQsIHRoaXMueCwgdGhpcy55KTsgLy8geSBjb29yZGluYXRlcyBvbiBjYW52YXMgcnVuIHRvcCB0byBib3R0b21cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGRyYXcgdGhlIGFycm93IG9uIHRoZSBjYW52YXNcbiAgICAgKiBAcGFyYW0gY2FudmFzXG4gICAgICovXG4gICAgZnVuY3Rpb24gZHJhdyhjYW52YXMpe1xuICAgICAgICAvLyBHZXQgdGhlIGNvbnRleHQgZm9yIHRoZSBjYW52YXNcbiAgICAgICAgbGV0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICAvLyBHZXQgdGhlIGN1c3RvbSBkYXRhIGF0dHJpYnV0ZSBzcGVjaWZpZWQgaW4gSFRNTFxuICAgICAgICBjb25zdCBwYXJtcyA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuYXJyb3dkYXRhKTtcbiAgICAgICAgLy8gc2V0IHVwIHRoZSB0cmlhbmdsZVxuICAgICAgICBjb25zdCB0ID0gdHJpYW5nbGUocGFybXMsIGNhbnZhcyk7XG4gICAgICAgIC8vIHNldCB1cCB0aGUgdGV4dCBsYWJlbFxuICAgICAgICBjb25zdCBsID0gdGV4dExhYmVsKHBhcm1zLmxhYmVsKS5zZXR1cChjdHgsIHQsIGNhbnZhcyk7XG5cbiAgICAgICAgLyoqKiBjcmVhdGUgdGhlIGRyYXdpbmcgKioqL1xuICAgICAgICAvLyB0b3RhbCBoZWlnaHQgb2YgdGhlIGRyYXdpbmcsIGluY2x1ZGluZyBzcGFjZSBuZWVkZWQgZm9yIHRoZSBsYWJlbFxuICAgICAgICBjb25zdCBkcmF3aW5nSHQgPSB0LmhlaWdodCArIChsLmlzT3V0c2lkZSA/IChsLm9mZnNldC5vdXRzaWRlICsgbC5oZWlnaHQpIDogMCk7XG4gICAgICAgIC8vIG9mZnNldCBmb3IgZHJhd2luZyBpbiB4IGRpcmVjdGlvbjogZGlzdHJpYnV0ZSB3aGl0ZSBzcGFjZSBldmVubHkgYXJvdW5kIHRoZSB0cmlhbmdsZVxuICAgICAgICBjb25zdCB4b2Zmc2V0ID0gKGNhbnZhcy53aWR0aCAtIHQud2lkdGgpIC8gMjtcbiAgICAgICAgLy8gb2Zmc2V0IGZvciBkcmF3aW5nIGluIHkgZGlyZWN0aW9uOlxuICAgICAgICAvLyBiYXNlX2FsaWduID09ICdjZW50ZXInOiB0cmlhbmdsZSBiYXNlIHNob3VsZCBiZSBjZW50ZXJlZCBvbiB0aGUgY2FudmFzXG4gICAgICAgIC8vIGJhc2VfYWxpZ24gPT0gJ29wdGltYWwnOiBkcmF3aW5nIHNob3VsZCBiZSBjZW50ZXJlZCBvbiB0aGUgY2FudmFzIChvcHRpbWFsIHVzZSBvZiBzcGFjZSlcbiAgICAgICAgY29uc3QgeW9mZnNldCA9IGNhbnZhcy5oZWlnaHQgLyAyICtcbiAgICAgICAgICAgIChwYXJtcy5iYXNlX2FsaWduID09PSAnY2VudGVyJyA/IDAgOiAocGFybXMuZGlyID09PSAndXAnID8gZHJhd2luZ0h0IC8gMiA6IC1kcmF3aW5nSHQgLyAyKSk7XG5cbiAgICAgICAgY3R4LnRyYW5zbGF0ZSh4b2Zmc2V0LCB5b2Zmc2V0KTtcbiAgICAgICAgdC5kcmF3KGN0eCk7IC8vIGRyYXcgdHJpYW5nbGVcbiAgICAgICAgbC5kcmF3KGN0eCk7IC8vIGRyYXcgbGFiZWxcblxuICAgICAgICAvKioqIHNldCB1cCBkcmF3aW5nIGJvdW5kaW5nIGJveCAtIG5lZWQgdGhpcyBmb3IgdG9vbHRpcCAqKiovXG4gICAgICAgIGNvbnN0IHltYXggPSBwYXJtcy5kaXIgPT09ICd1cCcgPyAoY2FudmFzLmhlaWdodCAvIDIgKyB5b2Zmc2V0KSA6IChjYW52YXMuaGVpZ2h0IC8gMiArIHlvZmZzZXQgKyBkcmF3aW5nSHQpO1xuICAgICAgICBjb25zdCBkcmF3aW5nQmJveCA9IHtcbiAgICAgICAgICAgIHhtaW46IHhvZmZzZXQsXG4gICAgICAgICAgICB4bWF4OiB4b2Zmc2V0ICsgdC53aWR0aCxcbiAgICAgICAgICAgIHltaW46IHltYXggLSBkcmF3aW5nSHQsXG4gICAgICAgICAgICB5bWF4OiB5bWF4LFxuICAgICAgICAgICAgY29udGFpbnM6IGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueG1heCA+PSBwLnggJiYgcC54ID49IHRoaXMueG1pbiAmJiB0aGlzLnltYXggPj0gcC55ICYmIHAueSA+PSB0aGlzLnltaW47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGhlIHRvb2x0aXAgY29udGVudCAtIG5vdCBzdHJpY3RseSBwYXJ0IG9mIGRyYXdpbmcsIGJ1dCBkbyB0aGlzIGhlcmUgYmVjYXVzZSBpdCByZXF1aXJlcyBhY2Nlc3MgdG9cbiAgICAgICAgLy8gdGhlIGFycm93IHBhcmFtZXRlcnNcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY2FudmFzLmlkICsgXCJ0b29sdGlwdGV4dFwiKS50ZXh0Q29udGVudCA9IHBhcm1zLnRvb2x0aXA7XG5cbiAgICAgICAgcmV0dXJuIGRyYXdpbmdCYm94O1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgYXJyb3cgY2FudmFzIGVsZW1lbnRzXG4gICAgY29uc3QgYXJyb3dzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnY2FudmFzW2lzPVwiZGVsdGEtYXJyb3dcIl0nKTtcbiAgICBhcnJvd3MuZm9yRWFjaCgoYXJyb3cpID0+IHtcbiAgICAgICAgc2V0dXAoYXJyb3cpOyAvLyBzZXQgdXAgY2FudmFzIGxheW91dCBiZWZvcmUgZHJhd2luZ1xuICAgICAgICAvLyBkcmF3IHRoZSBhcnJvdyAtIHRoaXMgcmV0dXJucyBhIGJvdW5kaW5nIGJveCBmb3IgdGhlIGRyYXdpbmdcbiAgICAgICAgYXJyb3cuZHJhd2luZ0Jib3ggPSBkcmF3KGFycm93KTtcbiAgICAgICAgLy8gTGlzdGVuIGZvciBtb3VzZSBtb3ZlcyAtIHNob3cgY3NzIHRvb2x0aXAgd2hpbGUgbW91c2Ugb3ZlciBkcmF3aW5nXG4gICAgICAgIGFycm93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAvLyBtb3VzZSBwb3NpdGlvbiBpbiBjYW52YXMgY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIGNvbnN0IG1vdXNlUG9zID0gZ2V0TW91c2VQb3MoZSwgdGhpcyk7XG4gICAgICAgICAgICBpZiAodGhpcy5kcmF3aW5nQmJveC5jb250YWlucyhtb3VzZVBvcykpIHtcbiAgICAgICAgICAgICAgICBsZXQgdHRpcCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGFycm93LmlkICsgXCJ0b29sdGlwXCIpO1xuICAgICAgICAgICAgICAgIHR0aXAuc3R5bGUudG9wID0gTWF0aC5yb3VuZChtb3VzZVBvcy55IC8gdGhpcy5kYXRhc2V0LmNhbnZhc3JlcyAtIHR0aXAub2Zmc2V0SGVpZ2h0KSArICdweCc7IC8vIG1vdmUgdGlwIGFib3ZlIGN1cnNvclxuICAgICAgICAgICAgICAgIHR0aXAuc3R5bGUubGVmdCA9IE1hdGgucm91bmQobW91c2VQb3MueCAvIHRoaXMuZGF0YXNldC5jYW52YXNyZXMpICsgJ3B4JztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLmlkICsgXCJ0b29sdGlwdGV4dFwiKS5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLmlkICsgXCJ0b29sdGlwdGV4dFwiKS5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xufSk7XG5cbiIsIi8vIHRoaXMgZXZlbnRMaXN0ZW5lciBjb2xsZWN0cyBhbGwgdGhlIGNhbnZhc2VzIGluIHRoZSBET00gdGhhdCBhcmUgbWFya2VkIGFzICdpcz1iYXItY2hhcnQnIGFuZCBkcmF3c1xuLy8gYmFyIGNoYXJ0cyBhcyBkZWZpbmVkIGJ5IHRoZSBkYXRhLWNoYXJ0ZGF0YSBhbmQgZGF0YS1jaGFydG9wdHMgYXR0cmlidXRlc1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuXG4gICAgLy8gRGVmaW5lIGEgY2hhcnQuanMgcGx1Z2luIGZvciBhZGRpbmcgYW4gaW1hZ2UgdG8gdGhlIGNhdGVnb3J5IGxhYmVscyBvbiB0aGUgeS1heGlzLlxuICAgIC8vIEltYWdlIHNvdXJjZSBpcyBzcGVjaWZpZWQgaW4gdGhlIG9wdGlvbnMgZm9yIHRoaXMgcGx1Z2luIGFzIGEgZGljdGlvbmFyeS5cbiAgICAvLyBUaGUga2V5cyBpbiB0aGlzIGRpY3Rpb25hcnkgYXJlIHRoZSBheGlzIGxhYmVscyBhc3NvY2lhdGVkIHdpdGggdGhlIGltYWdlcztcbiAgICAvLyBlLmcuIHNwZWNpZnkgJ0FyZWEnOiAnYXJlYS5wbmcnIHRvIGluZGljYXRlIHRoYXQgYXJlYS5wbmcgc2hvdWxkIGdvIHdpdGggdGhlICdBcmVhJyBsYWJlbC5cbiAgICBjb25zdCBhZGRDYXRlZ29yeUltYWdlcyA9IHtcbiAgICAgICAgaWQ6ICdsYWJlbEltYWdlc1BsdWdpbicsXG4gICAgICAgIGFmdGVyRHJhdyhjaGFydCwgYXJncywgb3B0aW9ucykge1xuICAgICAgICAgICAgbGV0IGN0eCA9IGNoYXJ0LmN0eDtcbiAgICAgICAgICAgIGNvbnN0IHhBeGlzID0gY2hhcnQuc2NhbGVzWyd4J107XG4gICAgICAgICAgICBjb25zdCB5QXhpcyA9IGNoYXJ0LnNjYWxlc1sneSddO1xuICAgICAgICAgICAgeUF4aXMuX2xhYmVsSXRlbXMuZm9yRWFjaCgoZGF0YUNhdCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YUNhdC5sYWJlbCBpbiBvcHRpb25zKSB7IC8vIG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeSA9IHlBeGlzLmdldFBpeGVsRm9yVGljayhpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgICAgICAgICAgICAgICBpbWFnZS5zcmMgPSBvcHRpb25zW2RhdGFDYXQubGFiZWxdO1xuICAgICAgICAgICAgICAgICAgICAvLyB5QXhpcy53aWR0aCBjb252ZW5pZW50bHkgc2VlbXMgdG8gaW5jbHVkZSB0aGUgd2lkdGggb2YgdGhlIHRleHQgbGFiZWxzXG4gICAgICAgICAgICAgICAgICAgIC8vIHNvIHB1dHRpbmcgdGhlIGltYWdlIGp1c3QgdG8gdGhlIGxlZnQgb2YgdGhhdCBzZWVtcyB0byB3b3JrIGZpbmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeE9mZnNldCA9IHlBeGlzLndpZHRoICsgaW1hZ2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1hZ2UsIHhBeGlzLmxlZnQgLSB4T2Zmc2V0LCB5IC0gTWF0aC5yb3VuZChpbWFnZS5oZWlnaHQgLyAyKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gRGVmaW5lIGEgY2hhcnQuanMgcGx1Z2luIGZvciBhZGRpbmcgdGV4dCBsYWJlbHMgaW5zaWRlIGVhY2ggaG9yaXpvbnRhbCBiYXIuXG4gICAgY29uc3QgYWRkQmFyTGFiZWxzID0ge1xuICAgICAgICBpZDogJ2JhckxhYmVsUGx1Z2luJyxcbiAgICAgICAgYWZ0ZXJEcmF3KGNoYXJ0LCBhcmdzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBsZXQgY3R4ID0gY2hhcnQuY3R4O1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGFydC5kYXRhLmRhdGFzZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IGRzID0gY2hhcnQuZ2V0RGF0YXNldE1ldGEoaSk7IC8vIGdldCBtZXRhIGluZm8gZm9yIHRoaXMgZGF0YXNldFxuICAgICAgICAgICAgICAgIGlmIChkcy50eXBlID09PSBcImJhclwiKSB7IC8vIHNraXAgYW55IGxpbmUgZGF0YTsgb25seSBpbnRlcmVzdGVkIGluIHRoZSBiYXJzIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHNOYW1lID0gZHMubGFiZWw7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZHMuZGF0YS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9lYWNoIGRhdGFwb2ludCBpbiB0aGlzIGRhdGFzZXQgY29ycmVzcG9uZHMgdG8gYSBiYXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBuZWVkIHRvIGZpZ3VyZSBvdXQgdGhlIGRpbWVuc2lvbnMgb2YgdGhlIGJhciBhbmQgdGV4dCB0byBnbyBpbnRvIHRoZSBiYXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGVuIHB1dCB0aGUgdGV4dCBpbnRvIHRoZSBjZW50ZXIgb2YgdGhlIGJhciBpZiBpdCBmaXRzLCB0byB0aGUgcmlnaHQgb2YgdGhlIGJhciBpZiBub3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhcldpZHRoID0gZHMuZGF0YVtqXS4kY29udGV4dC5lbGVtZW50LndpZHRoO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IG9wdGlvbnNbZHNOYW1lXS5sYWJlbHNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0V2lkdGggPSBjdHgubWVhc3VyZVRleHQodGV4dCkud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGV4dEFuY2hvciA9IGRzLmRhdGFbal0uZ2V0Q2VudGVyUG9pbnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiYXJXaWR0aCA+IHRleHRXaWR0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QW5jaG9yLnggPSBkcy5kYXRhW2pdLiRjb250ZXh0LmVsZW1lbnQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QW5jaG9yLnkgPSBkcy5kYXRhW2pdLiRjb250ZXh0LmVsZW1lbnQueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdHgudGV4dEFsaWduID0gXCJsZWZ0XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgudGV4dEJhc2VsaW5lID0gXCJtaWRkbGVcIjsgLy8gdmVydGljYWwgYWxpZ24gdG8gY2VudGVyIG9mIGJhclxuICAgICAgICAgICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IG9wdGlvbnNbZHNOYW1lXS5jb2xvciB8fCBvcHRpb25zLmNvbG9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9kbzogYWxsb3cgZm9yIGZvbnQgc3R5bGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRleHRXaWR0aCA+IDApIGN0eC5maWxsVGV4dCh0ZXh0LCB0ZXh0QW5jaG9yLngsIHRleHRBbmNob3IueSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGRlZmF1bHRzOiB7XG4gICAgICAgICAgICBjb2xvcjogJ3doaXRlJywgLy8gdXNlIHdoaXRlIHRleHQgaWYgbm8gY29sb3Igc3BlY2lmaWVkIGJ5IHVzZXJcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBEZWZpbmUgYSBjaGFydC5qcyBwbHVnaW4gZm9yIGFkZGluZyB0aGUgd29yZCAnVGFyZ2V0JyBhYm92ZSB0aGUgdGFyZ2V0IGxpbmUuXG4gICAgY29uc3QgYWRkVGFyZ2V0TGFiZWwgPSB7XG4gICAgICAgIGlkOiAndGFyZ2V0TGFiZWxQbHVnaW4nLFxuICAgICAgICBhZnRlckRyYXcoY2hhcnQsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGxldCBjdHggPSBjaGFydC5jdHg7XG4gICAgICAgICAgICBsZXQgZHMgPSBjaGFydC5nZXREYXRhc2V0TWV0YSgwKTsgLy8gZGF0YXNldCAwIGlzIHRoZSB0YXJnZXQgbGluZVxuICAgICAgICAgICAgY29uc3QgZW5kUHQgPSBkcy5kYXRhWzBdO1xuICAgICAgICAgICAgY3R4LnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XG4gICAgICAgICAgICBjdHgudGV4dEJhc2VsaW5lID0gXCJib3R0b21cIjsgLy8gdmVydGljYWwgYWxpZ25tZW50XG4gICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gJ2JsYWNrJztcbiAgICAgICAgICAgIC8vIHRvZG86IGZvbnQgc3R5bGluZ1xuICAgICAgICAgICAgY3R4LmZpbGxUZXh0KCdUYXJnZXQnLCBlbmRQdC54LCBlbmRQdC55IC0gMTApO1xuICAgICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBkcmF3IHRoZSBiYXIgY2hhcnQgb24gdGhlIGNhbnZhc1xuICAgIGZ1bmN0aW9uIGRyYXcoY2FudmFzKSB7XG4gICAgICAgIGNvbnN0IGNoYXJ0ZGF0YSA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuY2hhcnRkYXRhKTtcbiAgICAgICAgbGV0IGNoYXJ0b3B0cyA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuY2hhcnRvcHRzKTtcbiAgICAgICAgLy8gc2V0IHVwIHRvb2x0aXAgdG8gc2hvdyB3aGVuIGhvdmVyaW5nIG92ZXIgYSBiYXJcbiAgICAgICAgY2hhcnRvcHRzLnBsdWdpbnNbJ3Rvb2x0aXAnXSA9IHtcbiAgICAgICAgICAgICdjYWxsYmFja3MnOiB7XG4gICAgICAgICAgICAgICAgJ2xhYmVsJzogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2ltcGxpZmllZCB0b29sdGlwIGZvciBub3csIGp1c3Qgc2hvdyB0aGUgdHlwZSBvZiBkYXRhc2V0O1xuICAgICAgICAgICAgICAgICAgICAvLyB0b2RvOiBtYXkgd2FudCB0byBhZGQgdmFsdWUgYXMgcGVyY2VudGFnZSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb250ZXh0LmRhdGFzZXQubGFiZWwgfHwgJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgY2hhcnQgdXNpbmcgQ2hhcnQuanNcbiAgICAgICAgY29uc3QgY2hhcnQgPSBuZXcgQ2hhcnQoY2FudmFzLCB7XG4gICAgICAgICAgICB0eXBlOiAnYmFyJyxcbiAgICAgICAgICAgIGRhdGE6IGNoYXJ0ZGF0YSxcbiAgICAgICAgICAgIG9wdGlvbnM6IGNoYXJ0b3B0cyxcbiAgICAgICAgICAgIHBsdWdpbnM6IFthZGRDYXRlZ29yeUltYWdlcywgYWRkQmFyTGFiZWxzLCBhZGRUYXJnZXRMYWJlbF0sXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgYmFyIGNoYXJ0IGNhbnZhcyBlbGVtZW50c1xuICAgIGNvbnN0IGNoYXJ0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2NhbnZhc1tpcz1cImJhci1jaGFydFwiXScpO1xuICAgIGNoYXJ0cy5mb3JFYWNoKChjaGFydCkgPT4ge1xuICAgICAgICBkcmF3KGNoYXJ0KTtcbiAgICB9KTtcbn0pO1xuXG5cbiIsIi8vIHRoaXMgZXZlbnRMaXN0ZW5lciBjb2xsZWN0cyBhbGwgdGhlIGNhbnZhc2VzIGluIHRoZSBET00gdGhhdCBhcmUgbWFya2VkIGFzICdpcz1kb3VnaG51dC1jaGFydCcgYW5kIGRyYXdzXG4vLyBkb3VnaG51dCBjaGFydHMgYXMgZGVmaW5lZCBieSB0aGUgZGF0YS1jaGFydGRhdGEgYW5kIGRhdGEtY2hhcnRvcHRzIGF0dHJpYnV0ZXNcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcblxuICAgIC8vIGRyYXcgdGhlIGRvdWdobnV0IGNoYXJ0IG9uIHRoZSBjYW52YXMgdXNpbmcgY2hhcnQuanNcbiAgICBmdW5jdGlvbiBkcmF3KGNhbnZhcykge1xuICAgICAgICBjb25zdCBjaGFydGRhdGEgPSBKU09OLnBhcnNlKGNhbnZhcy5kYXRhc2V0LmNoYXJ0ZGF0YSk7XG4gICAgICAgIGxldCBjaGFydG9wdHMgPSBKU09OLnBhcnNlKGNhbnZhcy5kYXRhc2V0LmNoYXJ0b3B0cyk7XG4gICAgICAgIC8vIGFkZCBjYWxsYmFja3MgZm9yIGN1c3RvbSB0b29sdGlwIGZvcm1hdHNcbiAgICAgICAgY2hhcnRvcHRzLnBsdWdpbnNbJ3Rvb2x0aXAnXSA9IHtcbiAgICAgICAgICAgIGNhbGxiYWNrczoge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dFswXS5sYWJlbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGxhYmVsOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdG90YWwgPSAwO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRhdGFzZXQuZGF0YS5tYXAoZSA9PiB0b3RhbCArPSBlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcgJyArIGNvbnRleHQucGFyc2VkICsgJyAoJyArIE1hdGgucm91bmQoMTAwICogY29udGV4dC5wYXJzZWQgLyB0b3RhbCkgKyAnJSknO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGNoYXJ0ID0gbmV3IENoYXJ0KGNhbnZhcywge3R5cGU6ICdkb3VnaG51dCcsIGRhdGE6IGNoYXJ0ZGF0YSwgb3B0aW9uczogY2hhcnRvcHRzfSk7XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBkb3VnaG51dCBjaGFydCBjYW52YXMgZWxlbWVudHMgaW4gdGhlIERPTVxuICAgIGNvbnN0IGNoYXJ0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2NhbnZhc1tpcz1cImRvdWdobnV0LWNoYXJ0XCJdJyk7XG4gICAgY2hhcnRzLmZvckVhY2goKGNoYXJ0KSA9PiB7XG4gICAgICAgIGRyYXcoY2hhcnQpO1xuICAgIH0pO1xufSk7XG5cblxuIiwiLy8gdGhpcyBldmVudExpc3RlbmVyIGNvbGxlY3RzIGFsbCB0aGUgY2FudmFzZXMgaW4gdGhlIERPTSB0aGF0IGFyZSBtYXJrZWQgYXMgJ2lzPXN0YWNrZWQtZG91Z2hudXQtY2hhcnQnIGFuZCBkcmF3c1xuLy8gZG91Z2hudXQgY2hhcnRzIGFzIGRlZmluZWQgYnkgdGhlIGRhdGEtY2hhcnRkYXRhIGFuZCBkYXRhLWNoYXJ0b3B0cyBhdHRyaWJ1dGVzXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgLy8gZHJhdyB0aGUgZG91Z2hudXQgY2hhcnQgb24gdGhlIGNhbnZhcyB1c2luZyBjaGFydC5qc1xuICAgIGZ1bmN0aW9uIGRyYXcoY2FudmFzKSB7XG4gICAgICAgIGNvbnN0IGNoYXJ0ZGF0YSA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuY2hhcnRkYXRhKTtcbiAgICAgICAgbGV0IGNoYXJ0b3B0cyA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuY2hhcnRvcHRzKTtcbiAgICAgICAgLy8gYWRkIGNhbGxiYWNrcyBmb3IgY3VzdG9tIHRvb2x0aXAgZm9ybWF0cyBoZXJlXG4gICAgICAgIGNoYXJ0b3B0cy5wbHVnaW5zWyd0b29sdGlwJ10gPSB7XG4gICAgICAgICAgICBjYWxsYmFja3M6IHtcbiAgICAgICAgICAgICAgICB0aXRsZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHRbMF0uZGF0YXNldC5jYXRMYWJlbHNbY29udGV4dFswXS5kYXRhSW5kZXhdO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbGFiZWw6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB0b3RhbCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZGF0YXNldC5kYXRhLm1hcChlID0+IHRvdGFsICs9IGUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJyAnICsgY29udGV4dC5wYXJzZWQgKyAnICgnICsgTWF0aC5yb3VuZCgxMDAgKiBjb250ZXh0LnBhcnNlZCAvIHRvdGFsKSArICclKSc7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgY2hhcnQgPSBuZXcgQ2hhcnQoY2FudmFzLCB7dHlwZTogJ2RvdWdobnV0JywgZGF0YTogY2hhcnRkYXRhLCBvcHRpb25zOiBjaGFydG9wdHN9KTtcbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIGRvdWdobnV0IGNoYXJ0IGNhbnZhcyBlbGVtZW50c1xuICAgIGNvbnN0IGNoYXJ0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2NhbnZhc1tpcz1cInN0YWNrZWQtZG91Z2hudXQtY2hhcnRcIl0nKTtcbiAgICBjaGFydHMuZm9yRWFjaCgoY2hhcnQpID0+IHtcbiAgICAgICAgZHJhdyhjaGFydCk7XG4gICAgfSk7XG59KTtcbiIsIi8vIHRoaXMgcGFja2FnZXMgdXAgYWxsIGJpdHMgYW5kIHBpZWNlcyBpbnRvIGEgc2luZ2xlIGpzIGZpbGVcbi8vIGNhbiBjb21lIGZyb20gbG9jYWwgZGlyIG9yIG5tcCBkaXJlY3Rvcnlcbi8vIGluc3RhbGwgZXh0ZXJuYWwgc291cmNlcyB2aWEgbm1wLCBpZGVhbGx5IGZyb20gbm9kZSwgYnV0IGNhbiBwdWxsIGZyb20gZ2l0aHViIGRpcmVjdGx5IGlmIG5lZWRlZFxuLy8gdXNlIGJyb3dzZXJpZnktc2hpbSB0byBleGNsdWRlIGxhcmdlIHNoYXJlZCBjb21wb25lbnRzIGZyb20gZGlzdCBidW5kbGVcbi8vIHNlZSBwYWNrYWdlLmpzb24gaW4gaHlkcm9uZXQvY2xpZW50LXNpZGUgZm9yIHNhbXBsZSBidWlsZCBwcm9jZXNzIHdpdGggc2hpbVxuLy92YXIgY2hhcnRqcyA9IHJlcXVpcmUoJ2NoYXJ0LmpzJyk7XG4vL3ZhciBEb3VnaG51dExhYmVsID0gcmVxdWlyZSgnY2hhcnRqcy1wbHVnaW4tZG91Z2hudXRsYWJlbC12MycpO1xucmVxdWlyZSgnLi9hcnJvdy5qcycpO1xucmVxdWlyZSgnLi9iYXJfY2hhcnQuanMnKTtcbnJlcXVpcmUoJy4vZG91Z2hudXRfY2hhcnQuanMnKTtcbnJlcXVpcmUoJy4vc3RhY2tlZF9kb3VnaHRudXRfY2hhcnQuanMnKTtcbiJdfQ==
