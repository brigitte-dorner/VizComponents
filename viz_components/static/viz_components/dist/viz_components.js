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
            if ( options.length > 0 ) {
                yAxis._labelItems.forEach((dataCat, index) => {
                    //if (dataCat.label in options) { // options
                    if (options[index].length > 0) {
                        let image = new Image();
                        image.src = options[index];
                        const y = yAxis.getPixelForTick(index);
                         // yAxis.width conveniently seems to include the width of the text labels
                        // so putting the image just to the left of that seems to work fine
                        const xOffset = yAxis.width + image.width;
                        ctx.drawImage(image, xAxis.left - xOffset, y - Math.round(image.height / 2));
                    }
                });
            }
        }
    };

    // Define a chart.js plugin for adding text labels inside each horizontal bar.
    const addBarLabels = {
        id: 'barLabelPlugin',
        // note: need to use afterDatasetsDraw here.
        // If using afterDraw, the text labels will end up on top of everything, including the tooltips :(
        // (see https://stackoverflow.com/questions/40243518/charts-js-tooltip-overlapping-text-on-chart)
        afterDatasetsDraw(chart, args, options) {
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
                        let showText = true;
                        let textAnchor = ds.data[j].getCenterPoint();
                        if (barWidth > textWidth) { // label text fits into the bar - center it there
                            ctx.textAlign = "center";
                        } else { // text doesn't fit into the bar
                            textAnchor.x = ds.data[j].$context.element.x;
                            textAnchor.y = ds.data[j].$context.element.y;
                            if (chart.options.scales['y'].stacked) {
                                // if we are dealing with a stacked bar chart, only show text if it fits into the bar
                                showText = false;
                            } else {
                                console.log('showing text to right of bar');
                                // show text to the right of the bar
                                ctx.textAlign = "left";
                            }
                        }
                        ctx.textBaseline = "middle"; // vertical align to center of bar
                        ctx.fillStyle = options[dsName].color || options.color;
                        // todo: allow for font styling
                        if (showText && textWidth > 0) ctx.fillText(text, textAnchor.x, textAnchor.y);
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
            if (options['display']) {
                let ctx = chart.ctx;
                let ds = chart.getDatasetMeta(0); // dataset 0 is the target line
                const endPt = ds.data[0];
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom"; // vertical alignment
                ctx.fillStyle = 'black';
                // todo: font styling
                ctx.fillText(options['label'], endPt.x, endPt.y - 10);
            }
        },
    };

    // draw the bar chart on the canvas
    function draw(canvas) {
        const chartdata = JSON.parse(canvas.dataset.chartdata);
        let chartopts = JSON.parse(canvas.dataset.chartopts);
        // set up tooltip to show when hovering over a bar
        chartopts.plugins['tooltip'] = {
            'backgroundColor' : 'rgba(0, 0, 0, 1)',
            'callbacks': {
                'title': function(context) {
                    return ''; // title is y axis category (i.e., the metric) by default; don't show this
                },
                'label': function (context) {
                    // we want the type of bar here (e.g., 'current' or 'planned',
                    // followed by the text label shown inside the bar in brackets.
                    // the latter is handy because in stacked bar charts the label inside the bar
                    // sometimes won't be shown because of lack of space, so the tooltip is the only
                    // way for the user to get that information.
                    const ds = context.dataset.label; // this is the bar type
                   if (ds) {
                       // get the labels for this bar type; they are passed in through the barLabelPlugin.
                        const labels = context.chart.config.options.plugins['barLabelPlugin'][ds].labels;
                        // dataIndex is the numeric index on the y-axis (i.e., corresponding to the metric)
                        return ds + ' (' + labels[context.dataIndex] + ')';
                    } else {
                        return '';
                    }
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

    // Expose the module functionality
    module.exports = {
      draw: draw
    };
    // Hack:  add the exports directly to variable exposed by package.
    window.viz_components = window.viz_components || {};
    window.viz_components.bar_chart = module.exports;
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

// Expose the package functionality - this seems like a hack. should be able to use module.exports - see commented code
window.viz_components = window.viz_components || {};

require('./arrow.js');
require('./bar_chart.js');
require('./doughnut_chart.js');
require('./stacked_doughtnut_chart.js');

// Expose the package functionality - this is what the documentation says should work.
// module.exports = {
//   bar_chart: require('./arrow.js'),
// };
// window.viz_components = module.exports;

},{"./arrow.js":1,"./bar_chart.js":2,"./doughnut_chart.js":3,"./stacked_doughtnut_chart.js":4}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJ2aXpfY29tcG9uZW50cy9qcy9hcnJvdy5qcyIsInZpel9jb21wb25lbnRzL2pzL2Jhcl9jaGFydC5qcyIsInZpel9jb21wb25lbnRzL2pzL2RvdWdobnV0X2NoYXJ0LmpzIiwidml6X2NvbXBvbmVudHMvanMvc3RhY2tlZF9kb3VnaHRudXRfY2hhcnQuanMiLCJ2aXpfY29tcG9uZW50cy9qcy92aXpfY29tcG9uZW50cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuLy8gdGhpcyBldmVudExpc3RlbmVyIGNvbGxlY3RzIGFsbCB0aGUgY2FudmFzZXMgaW4gdGhlIERPTSB0aGF0IGFyZSBtYXJrZWQgYXMgJ2lzPWRlbHRhLWFycm93JyBhbmQgZHJhd3Ncbi8vIGFycm93cyBvbiB0aGVtIGFzIGRlZmluZWQgYnkgdGhlIGRhdGEtYXJyb3dkYXRhIGF0dHJpYnV0ZVxuICAgIC8vIGFkanVzdCBhIGNvb3JkaW5hdGUgZm9yIGNhbnZhcyByZXNvbHV0aW9uXG4gICAgZnVuY3Rpb24gaW5DYW52YXNDb29yZHMoY29vcmQsIGNhbnZhcykge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChwYXJzZUZsb2F0KGNhbnZhcy5kYXRhc2V0LmNhbnZhc3JlcykgKiBjb29yZClcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2V0IHVwIHRoZSBjYW52YXMgZm9yIGRyYXdpbmdcbiAgICAgKiBAcGFyYW0gY2FudmFzXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2V0dXAoY2FudmFzKSB7XG4gICAgICAgIC8vIGFkanVzdCBjYW52YXMgdG8gbWF0Y2ggZGltcyBvZiBzdXJyb3VuZGluZyBjb250YWluZXJcbiAgICAgICAgY2FudmFzLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgICAgICBjYW52YXMuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICAgICAgICBjYW52YXMud2lkdGggPSBpbkNhbnZhc0Nvb3JkcyhjYW52YXMub2Zmc2V0V2lkdGgsIGNhbnZhcyk7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSBpbkNhbnZhc0Nvb3JkcyhjYW52YXMub2Zmc2V0SGVpZ2h0LCBjYW52YXMpO1xuICAgICAgICByZXR1cm4gY2FudmFzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGdldCB0ZXh0IGRpbWVuc2lvbnMgZm9yIHRoZSBnaXZlbiB0ZXh0IHN0cmluZyBpbiBwaXhlbHNcbiAgICAgKiBAcGFyYW0gY3R4IDJkIGRyYXdpbmcgY29udGV4dCBmb3IgYSBjYW52YXNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCB0aGUgdGV4dCB0byBnZXQgdGhlIGJvdW5kaW5nIGJveCBmb3JcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZm9udFN6XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGZvbnRcbiAgICAgKiBAcmV0dXJucyB7e3dpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyfX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRUZXh0QmJveChjdHgsIHRleHQsIGZvbnRTeiwgZm9udCl7XG4gICAgICAgIGNvbnN0IG9sZEZvbnQgPSBjdHguZm9udDtcbiAgICAgICAgY3R4LmZvbnQgPSBmb250U3ogKyAncHggJyArIGZvbnQ7XG4gICAgICAgIGNvbnN0IHRleHRNZXRyaWNzID0gY3R4Lm1lYXN1cmVUZXh0KHRleHQpO1xuICAgICAgICBjdHguZm9udCA9IG9sZEZvbnQ7XG4gICAgICAgIGNvbnN0IHRXaWR0aCA9IHRleHRNZXRyaWNzLndpZHRoICsgMjtcbiAgICAgICAgY29uc3QgdEhlaWdodCA9IHRleHRNZXRyaWNzLmFjdHVhbEJvdW5kaW5nQm94QXNjZW50ICsgdGV4dE1ldHJpY3MuYWN0dWFsQm91bmRpbmdCb3hEZXNjZW50ICsgMjtcbiAgICAgICAgcmV0dXJuIHt3aWR0aDogdFdpZHRoLCBoZWlnaHQ6IHRIZWlnaHR9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGdldCBtb3VzZSBwb3NpdGlvbiBpbiBjYW52YXMgY29vcmRpbmF0ZXNcbiAgICAgKiBzZWUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTcxMzAzOTUvcmVhbC1tb3VzZS1wb3NpdGlvbi1pbi1jYW52YXNcbiAgICAgKiBAcGFyYW0gZSBtb3VzZSBldmVudFxuICAgICAqIEBwYXJhbSBjYW52YXMgdGhlIGh0bWwgY2FudmFzIG9uIHdoaWNoIHRoZSBtb3VzZSBldmVudCBvY2N1cnJlZFxuICAgICAqIEByZXR1cm5zIHt7eDogbnVtYmVyLCB5OiBudW1iZXJ9fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldE1vdXNlUG9zKGUsIGNhbnZhcyl7XG4gICAgICAgIGNvbnN0IHJlY3QgPSBjYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksIC8vIGFicy4gc2l6ZSBvZiBlbGVtZW50XG4gICAgICAgICAgICBzY2FsZVggPSBjYW52YXMud2lkdGggLyByZWN0LndpZHRoLCAgICAvLyByZWxhdGlvbnNoaXAgYml0bWFwIHZzLiBlbGVtZW50IGZvciB4XG4gICAgICAgICAgICBzY2FsZVkgPSBjYW52YXMuaGVpZ2h0IC8gcmVjdC5oZWlnaHQ7ICAvLyByZWxhdGlvbnNoaXAgYml0bWFwIHZzLiBlbGVtZW50IGZvciB5XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiAoZS5jbGllbnRYIC0gcmVjdC5sZWZ0KSAqIHNjYWxlWCwgICAvLyBzY2FsZSBtb3VzZSBjb29yZGluYXRlcyBhZnRlciB0aGV5IGhhdmVcbiAgICAgICAgICAgIHk6IChlLmNsaWVudFkgLSByZWN0LnRvcCkgKiBzY2FsZVkgICAgIC8vIGJlZW4gYWRqdXN0ZWQgdG8gYmUgcmVsYXRpdmUgdG8gZWxlbWVudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdGhlIHRyaWFuZ2xlIHRvIGJlIGRyYXduIG9uIHRoIGNhbnZhc1xuICAgICAqIEBwYXJhbSBwYXJtc1xuICAgICAqIEBwYXJhbSBjYW52YXNcbiAgICAgKiBAcmV0dXJucyB7e3dpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBzZXR1cCgpOiB2b2lkLCBkcmF3KCopOiB2b2lkLCBib3hGaXRzSW5zaWRlKCopOiBib29sZWFufX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB0cmlhbmdsZShwYXJtcywgY2FudmFzKSB7XG4gICAgICAgIC8qIGFzeW1wdG90aWMgbWF4IGhlaWdodCBvZiB0aGUgdHJpYW5nbGUgaW4gY2FudmFzIHBpeGVsczsgYXNzdW1lIHRoYXQgd2hlbiBiYXNlX2FsaWduIGlzIGNlbnRlcixcbiAgICAgICAgICAgdGhlIHRyaWFuZ2xlIGF0IGZ1bGwgc2l6ZSBzaG91bGQgZmlsbCBlaXRoZXIgdGhlIHRvcCBvciB0aGUgYm90dG9tIGhhbGYgb2YgdGhlIGNhbnZhcyxcbiAgICAgICAgICAgZGVwZW5kaW5nIG9uIHdoaWNoIHdheSBpdCBpcyBwb2ludGluZywgd2hlcmVhcyB3aXRoIGJhc2VfYWxpZ24gc2V0IHRvICdvcHRpbWFsJyxcbiAgICAgICAgICAgdGhlIHRyaWFuZ2xlIHNob3VsZCBiZSBhbGlnbmVkIHNvIHRoZSBkcmF3aW5nIGlzIGNlbnRlcmVkIGluc2lkZSB0aGUgY2FudmFzICAqL1xuICAgICAgICBjb25zdCBtYXhIdCA9IHBhcm1zLmJhc2VfYWxpZ24gPT09ICdjZW50ZXInID8gY2FudmFzLmhlaWdodCAvIDIgOiBjYW52YXMuaGVpZ2h0O1xuICAgICAgICBjb25zdCBzID0gTWF0aC5taW4oY2FudmFzLndpZHRoIC8gcGFybXMubWF4X3dpZHRoLCBtYXhIdCAvIHBhcm1zLm1heF9odCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogcyAqIHBhcm1zLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBzICogcGFybXMuaGVpZ2h0LFxuICAgICAgICAgICAgZGlyOiBwYXJtcy5kaXIsXG4gICAgICAgICAgICBib3hGaXRzSW5zaWRlKGJveCkgeyAvLyBjaGVjayB3aGV0aGVyIHRoZSBnaXZlbiBib3ggZml0cyBpbnNpZGUgdGhlIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgY29uc3QgdGFuVGhldGEgPSB0aGlzLmhlaWdodCAvICh0aGlzLndpZHRoIC8gMik7IC8vIGdldCBhbmdsZSBiZXR3ZWVuIGJhc2UgYW5kIHNpZGUgb2YgdHJpYW5nbGVcbiAgICAgICAgICAgICAgICAvLyB0aGUgc21hbGxlciB0cmlhbmdsZSBjcmVhdGVkIGJ5IGphbW1pbmcgYSBib3ggb2YgdGhlIGdpdmVuIGhlaWdodCBpbiB0aGUgbGVmdCBjb3JuZXIgb2YgdGhlIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgLy8gc2hhcmVzIHRoZSBzYW1lIGNvcm5lciwgYW5kIGhlbmNlIHRoZSBzYW1lIGFuZ2xlOyB1c2UgdGhpcyB0byBjYWxjIGxlbmd0aCBvZiB0cmlhbmdsZSBiYXNlXG4gICAgICAgICAgICAgICAgLy8gb3V0c2lkZSB0aGUgYm94LCB0aGVuIHVzZSB0aGlzIGxlbmd0aCB0byBjYWxjIHRoZSBtYXhpbXVtIHdpZHRoIG9mIHRoZSBib3ggb2YgdGhlIGdpdmVuIGhlaWdodFxuICAgICAgICAgICAgICAgIC8vIHRoYXQgd2lsbCBmaXQgaW5zaWRlIHRoZSB0cmlhbmdsZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRXaWR0aCA9IGJveC5oZWlnaHQgLyB0YW5UaGV0YTsgIC8vIGxlbmd0aCBvZiB0aGUgcGFydCBvZiB0aGUgdHJpYW5nbGUgYmFzZSB0aGF0J3Mgb3V0c2lkZSBib3hcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhCYm94V2lkdGggPSB0aGlzLndpZHRoIC0gKDIgKiBkV2lkdGgpOyAvLyBtYXhpbXVtIHdpZHRoIGJveCB0aGF0IHdpbGwgZml0IGluc2lkZSB0cmlhbmdsZVxuICAgICAgICAgICAgICAgIHJldHVybiBib3gud2lkdGggPD0gbWF4QmJveFdpZHRoXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZHJhdyhjdHgpIHtcbiAgICAgICAgICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICAgICAgY3R4Lm1vdmVUbygwLCAwKTtcbiAgICAgICAgICAgICAgICBjdHgubGluZVRvKHRoaXMud2lkdGgsIDApOyAvLyBiYXNlIG9mIHRyaWFuZ2xlIGlzIGFsd2F5cyB0aGUgc2FtZVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmhlaWdodCA9PT0gMCkgeyAgLy8gbm8gY2hhbmdlOiBqdXN0IGRyYXcgYXMgYSBmbGF0IGxpbmVcbiAgICAgICAgICAgICAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gcGFybXMuY29sb3JzLm5vX2NoYW5nZTtcbiAgICAgICAgICAgICAgICAgICAgY3R4LnN0cm9rZSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocGFybXMuZGlyID09PSAndXAnKSB7ICAgLy8gZHJhdyBhIGZpbGxlZCB0cmlhbmdsZSBwb2ludGluZyB1cFxuICAgICAgICAgICAgICAgICAgICBjdHgubGluZVRvKHRoaXMud2lkdGggLyAyLCAtdGhpcy5oZWlnaHQpOyAvLyB5IGNvb3JkaW5hdGVzIG9uIGNhbnZhcyBnbyB0b3AgdG8gYm90dG9tXG4gICAgICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSBwYXJtcy5jb2xvcnMudXA7XG4gICAgICAgICAgICAgICAgICAgIGN0eC5maWxsKClcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBkcmF3IGEgZmlsbGVkIHRyaWFuZ2xlIHBvaW50aW5nIGRvd25cbiAgICAgICAgICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLndpZHRoIC8gMiwgdGhpcy5oZWlnaHQpOyAvLyB5IGNvb3JkaW5hdGVzIG9uIGNhbnZhcyBnbyB0b3AgdG8gYm90dG9tXG4gICAgICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSBwYXJtcy5jb2xvcnMuZG93bjtcbiAgICAgICAgICAgICAgICAgICAgY3R4LmZpbGwoKTtcbiAgICAgICAgICAgICAgICB9fX1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0aGUgdGV4dCBsYWJlbCB0byBiZSBkcmF3biBpbnNpZGUgb3IgbmV4dCB0byB0aGUgdHJpYW5nbGVcbiAgICAgKiBAcGFyYW0gcGFybXNcbiAgICAgKiBAcmV0dXJucyB7e2dldFBhZGRlZEJCb3goKiwgbnVtYmVyPTApOiB7d2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXJ9LFxuICAgICAqICAgICAgICAgICAgZ2V0QkJveCgqLCBudW1iZXI9MCk6IHt3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcn0sXG4gICAgICogICAgICAgICAgICBvZmZzZXQ6IHtvdXRzaWRlOiBudW1iZXIsIGluc2lkZTogbnVtYmVyfSxcbiAgICAgKiAgICAgICAgICAgIHNldHVwKCopOiB0aGlzLFxuICAgICAqICAgICAgICAgICAgZ2V0TWF4Rml0Rm9udFN6KCopOiBudW1iZXIsXG4gICAgICogICAgICAgICAgICBkcmF3KCopOiB2b2lkLFxuICAgICAqICAgICAgICAgICAgaXNPdXRzaWRlOiBib29sIH19XG4gICAgICovXG4gICAgZnVuY3Rpb24gdGV4dExhYmVsKHBhcm1zKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBib3VuZGluZyBib3gsIGF0IGdpdmVuIGZvbnRfc3ogb3IgdGhpcy5mb250X3N6XG4gICAgICAgICAgICBnZXRCQm94KGN0eCwgZm9udFN6ID0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRUZXh0QmJveChjdHgsIHBhcm1zLnRleHQsIGZvbnRTeiA9IGZvbnRTeiA+IDAgPyBmb250U3ogOiB0aGlzLmZvbnRTeiwgcGFybXMuZm9udCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gYm91bmRpbmcgYm94IHdpdGggeS1vZmZzZXQgYW5kIGhvcml6b250YWwgcGFkZGluZyBpbmNsdWRlZFxuICAgICAgICAgICAgZ2V0UGFkZGVkQkJveChjdHgsIGZvbnRTeiA9IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYm94ID0gdGhpcy5nZXRCQm94KGN0eCwgZm9udFN6KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge3dpZHRoOiBiYm94LndpZHRoICsgdGhpcy5wYWRkaW5nLCBoZWlnaHQ6IGJib3guaGVpZ2h0ICsgdGhpcy5vZmZzZXQuaW5zaWRlfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyB0aGUgbWF4aW11bSBmb250IHNpemUgYXQgd2hpY2ggdGhlIGxhYmVsIHdpbGwgZml0IGluc2lkZSB0aGUgdHJpYW5nbGUgdFxuICAgICAgICAgICAgZ2V0TWF4Rml0Rm9udFN6KGN0eCwgdHJpYW5nbGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRyaWFuZ2xlLmJveEZpdHNJbnNpZGUodGhpcy5nZXRQYWRkZWRCQm94KGN0eCwgdGhpcy5taW5Gb250U3opKSkgcmV0dXJuIDA7XG4gICAgICAgICAgICAgICAgbGV0IGZvbnRTeiA9IDY7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHRyaWFuZ2xlLmJveEZpdHNJbnNpZGUodGhpcy5nZXRQYWRkZWRCQm94KGN0eCwgZm9udFN6KSkpIHsgZm9udFN6ID0gZm9udFN6ICsgMTsgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmb250U3ogLSAxO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIHNldCB1cCBsYWJlbFxuICAgICAgICAgICAgc2V0dXAoY3R4LCB0cmlhbmdsZSwgY2FudmFzKSB7XG4gICAgICAgICAgICAgICAgLy8gbGFiZWwgb2Zmc2V0cywgZm9yIGluc2lkZSBhbmQgb3V0c2lkZSBvZiB0cmlhbmdsZSByZXNwZWN0aXZlbHlcbiAgICAgICAgICAgICAgICB0aGlzLm9mZnNldCA9IHsgaW5zaWRlOiBNYXRoLnJvdW5kKHBhcm1zLm9mZnNldC5pbnNpZGUgKiB0cmlhbmdsZS5oZWlnaHQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRzaWRlOiBNYXRoLnJvdW5kKHBhcm1zLm9mZnNldC5vdXRzaWRlICogY2FudmFzLmhlaWdodCkgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBwYWRkaW5nIGFyb3VuZCBsYWJlbCBpbiBob3Jpem9udGFsIGRpcmVjdGlvbiwgYWRqdXN0IGZvciBvdmVyc2FtcGxpbmdcbiAgICAgICAgICAgICAgICB0aGlzLnBhZGRpbmcgPSBpbkNhbnZhc0Nvb3JkcyhwYXJtcy5wYWRkaW5nLCBjYW52YXMpO1xuICAgICAgICAgICAgICAgIC8vIG1pbmltdW0gYWNjZXB0YWJsZSBmb250IHNpemUsIGFkanVzdGVkIGZvciBvdmVyc2FtcGxpbmdcbiAgICAgICAgICAgICAgICB0aGlzLm1pbkZvbnRTeiA9IGluQ2FudmFzQ29vcmRzKHBhcm1zLm1pbl9mb250X3NpemUsIGNhbnZhcyk7XG4gICAgICAgICAgICAgICAgLy8gbWF4IGZvbnQgc2l6ZSB0aGF0IGZpdHMgaW5zaWRlIHRoZSB0cmlhbmdsZVxuICAgICAgICAgICAgICAgIGNvbnN0IG1heEZvbnRTeiA9IHRoaXMuZ2V0TWF4Rml0Rm9udFN6KGN0eCwgdHJpYW5nbGUpO1xuICAgICAgICAgICAgICAgIC8vIGRldGVybWluZSB3aGV0aGVyIGxhYmVsIHNob3VsZCBnbyBvdXRzaWRlIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgdGhpcy5pc091dHNpZGUgPSBtYXhGb250U3ogPCB0aGlzLm1pbkZvbnRTejtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yID0gdGhpcy5pc091dHNpZGUgPyBwYXJtcy5jb2xvcnMub3V0c2lkZSA6IHBhcm1zLmNvbG9ycy5pbnNpZGU7XG4gICAgICAgICAgICAgICAgdGhpcy5mb250U3ogPSB0aGlzLmlzT3V0c2lkZSA/IHRoaXMubWluRm9udFN6IDogbWF4Rm9udFN6O1xuICAgICAgICAgICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5nZXRCQm94KGN0eCwgdGhpcy5mb250U3opLmhlaWdodDtcbiAgICAgICAgICAgICAgICAgdGhpcy54ID0gdHJpYW5nbGUud2lkdGggLyAyO1xuICAgICAgICAgICAgICAgIC8vIHRoZSBsYWJlbCB5IHBvc2l0aW9uOiBpZGVhbGx5IGhvdmVyaW5nIGFib3ZlIHRoZSB0cmlhbmdsZSBiYXNlIGF0IHRoZSBnaXZlbiBwZXJjZW50YWdlIG9mIHQuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIC8vIGJ1dCBpZiBpdCBkb2Vzbid0IGZpdCBpbnRvIHRoZSB0cmlhbmdsZSwgcHV0IGl0IGFib3ZlIChvciBiZWxvdykgdGhlIHBlYWsgaW5zdGVhZC5cbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB0aGlzLmlzT3V0c2lkZSA/ICh0cmlhbmdsZS5oZWlnaHQgKyB0aGlzLm9mZnNldC5vdXRzaWRlKSA6IHRoaXMub2Zmc2V0Lmluc2lkZTtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB0cmlhbmdsZS5kaXIgPT09ICd1cCcgPyAtdGhpcy55IDogdGhpcy55OyAvLyBjYW52YXMgY29vcmRpbmF0ZXMgZ28gdG9wIHRvIGJvdHRvbSFcbiAgICAgICAgICAgICAgICB0aGlzLmJhc2VsaW5lID0gdHJpYW5nbGUuZGlyID09PSAnZG93bicgPyAndG9wJyA6ICdib3R0b20nO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIGRyYXcgdGhlIGxhYmVsXG4gICAgICAgICAgICBkcmF3KGN0eCkgeyAvLyBkcmF3IGxhYmVsIG9uIGNhbnZhcyBjb250ZXh0XG4gICAgICAgICAgICAgICAgY3R4LmZvbnQgPSB0aGlzLmZvbnRTeiArICdweCAnICsgcGFybXMuZm9udDtcbiAgICAgICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb2xvcjtcbiAgICAgICAgICAgICAgICBjdHgudGV4dEFsaWduID0gJ2NlbnRlcic7IC8vIGhvcml6b250YWwgdGV4dCBhbGlnblxuICAgICAgICAgICAgICAgIGN0eC50ZXh0QmFzZWxpbmUgPSB0aGlzLmJhc2VsaW5lO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsVGV4dChwYXJtcy50ZXh0LCB0aGlzLngsIHRoaXMueSk7IC8vIHkgY29vcmRpbmF0ZXMgb24gY2FudmFzIHJ1biB0b3AgdG8gYm90dG9tXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBkcmF3IHRoZSBhcnJvdyBvbiB0aGUgY2FudmFzXG4gICAgICogQHBhcmFtIGNhbnZhc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGRyYXcoY2FudmFzKXtcbiAgICAgICAgLy8gR2V0IHRoZSBjb250ZXh0IGZvciB0aGUgY2FudmFzXG4gICAgICAgIGxldCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgLy8gR2V0IHRoZSBjdXN0b20gZGF0YSBhdHRyaWJ1dGUgc3BlY2lmaWVkIGluIEhUTUxcbiAgICAgICAgY29uc3QgcGFybXMgPSBKU09OLnBhcnNlKGNhbnZhcy5kYXRhc2V0LmFycm93ZGF0YSk7XG4gICAgICAgIC8vIHNldCB1cCB0aGUgdHJpYW5nbGVcbiAgICAgICAgY29uc3QgdCA9IHRyaWFuZ2xlKHBhcm1zLCBjYW52YXMpO1xuICAgICAgICAvLyBzZXQgdXAgdGhlIHRleHQgbGFiZWxcbiAgICAgICAgY29uc3QgbCA9IHRleHRMYWJlbChwYXJtcy5sYWJlbCkuc2V0dXAoY3R4LCB0LCBjYW52YXMpO1xuXG4gICAgICAgIC8qKiogY3JlYXRlIHRoZSBkcmF3aW5nICoqKi9cbiAgICAgICAgLy8gdG90YWwgaGVpZ2h0IG9mIHRoZSBkcmF3aW5nLCBpbmNsdWRpbmcgc3BhY2UgbmVlZGVkIGZvciB0aGUgbGFiZWxcbiAgICAgICAgY29uc3QgZHJhd2luZ0h0ID0gdC5oZWlnaHQgKyAobC5pc091dHNpZGUgPyAobC5vZmZzZXQub3V0c2lkZSArIGwuaGVpZ2h0KSA6IDApO1xuICAgICAgICAvLyBvZmZzZXQgZm9yIGRyYXdpbmcgaW4geCBkaXJlY3Rpb246IGRpc3RyaWJ1dGUgd2hpdGUgc3BhY2UgZXZlbmx5IGFyb3VuZCB0aGUgdHJpYW5nbGVcbiAgICAgICAgY29uc3QgeG9mZnNldCA9IChjYW52YXMud2lkdGggLSB0LndpZHRoKSAvIDI7XG4gICAgICAgIC8vIG9mZnNldCBmb3IgZHJhd2luZyBpbiB5IGRpcmVjdGlvbjpcbiAgICAgICAgLy8gYmFzZV9hbGlnbiA9PSAnY2VudGVyJzogdHJpYW5nbGUgYmFzZSBzaG91bGQgYmUgY2VudGVyZWQgb24gdGhlIGNhbnZhc1xuICAgICAgICAvLyBiYXNlX2FsaWduID09ICdvcHRpbWFsJzogZHJhd2luZyBzaG91bGQgYmUgY2VudGVyZWQgb24gdGhlIGNhbnZhcyAob3B0aW1hbCB1c2Ugb2Ygc3BhY2UpXG4gICAgICAgIGNvbnN0IHlvZmZzZXQgPSBjYW52YXMuaGVpZ2h0IC8gMiArXG4gICAgICAgICAgICAocGFybXMuYmFzZV9hbGlnbiA9PT0gJ2NlbnRlcicgPyAwIDogKHBhcm1zLmRpciA9PT0gJ3VwJyA/IGRyYXdpbmdIdCAvIDIgOiAtZHJhd2luZ0h0IC8gMikpO1xuXG4gICAgICAgIGN0eC50cmFuc2xhdGUoeG9mZnNldCwgeW9mZnNldCk7XG4gICAgICAgIHQuZHJhdyhjdHgpOyAvLyBkcmF3IHRyaWFuZ2xlXG4gICAgICAgIGwuZHJhdyhjdHgpOyAvLyBkcmF3IGxhYmVsXG5cbiAgICAgICAgLyoqKiBzZXQgdXAgZHJhd2luZyBib3VuZGluZyBib3ggLSBuZWVkIHRoaXMgZm9yIHRvb2x0aXAgKioqL1xuICAgICAgICBjb25zdCB5bWF4ID0gcGFybXMuZGlyID09PSAndXAnID8gKGNhbnZhcy5oZWlnaHQgLyAyICsgeW9mZnNldCkgOiAoY2FudmFzLmhlaWdodCAvIDIgKyB5b2Zmc2V0ICsgZHJhd2luZ0h0KTtcbiAgICAgICAgY29uc3QgZHJhd2luZ0Jib3ggPSB7XG4gICAgICAgICAgICB4bWluOiB4b2Zmc2V0LFxuICAgICAgICAgICAgeG1heDogeG9mZnNldCArIHQud2lkdGgsXG4gICAgICAgICAgICB5bWluOiB5bWF4IC0gZHJhd2luZ0h0LFxuICAgICAgICAgICAgeW1heDogeW1heCxcbiAgICAgICAgICAgIGNvbnRhaW5zOiBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhtYXggPj0gcC54ICYmIHAueCA+PSB0aGlzLnhtaW4gJiYgdGhpcy55bWF4ID49IHAueSAmJiBwLnkgPj0gdGhpcy55bWluO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHRoZSB0b29sdGlwIGNvbnRlbnQgLSBub3Qgc3RyaWN0bHkgcGFydCBvZiBkcmF3aW5nLCBidXQgZG8gdGhpcyBoZXJlIGJlY2F1c2UgaXQgcmVxdWlyZXMgYWNjZXNzIHRvXG4gICAgICAgIC8vIHRoZSBhcnJvdyBwYXJhbWV0ZXJzXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNhbnZhcy5pZCArIFwidG9vbHRpcHRleHRcIikudGV4dENvbnRlbnQgPSBwYXJtcy50b29sdGlwO1xuXG4gICAgICAgIHJldHVybiBkcmF3aW5nQmJveDtcbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIGFycm93IGNhbnZhcyBlbGVtZW50c1xuICAgIGNvbnN0IGFycm93cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2NhbnZhc1tpcz1cImRlbHRhLWFycm93XCJdJyk7XG4gICAgYXJyb3dzLmZvckVhY2goKGFycm93KSA9PiB7XG4gICAgICAgIHNldHVwKGFycm93KTsgLy8gc2V0IHVwIGNhbnZhcyBsYXlvdXQgYmVmb3JlIGRyYXdpbmdcbiAgICAgICAgLy8gZHJhdyB0aGUgYXJyb3cgLSB0aGlzIHJldHVybnMgYSBib3VuZGluZyBib3ggZm9yIHRoZSBkcmF3aW5nXG4gICAgICAgIGFycm93LmRyYXdpbmdCYm94ID0gZHJhdyhhcnJvdyk7XG4gICAgICAgIC8vIExpc3RlbiBmb3IgbW91c2UgbW92ZXMgLSBzaG93IGNzcyB0b29sdGlwIHdoaWxlIG1vdXNlIG92ZXIgZHJhd2luZ1xuICAgICAgICBhcnJvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgLy8gbW91c2UgcG9zaXRpb24gaW4gY2FudmFzIGNvb3JkaW5hdGVzXG4gICAgICAgICAgICBjb25zdCBtb3VzZVBvcyA9IGdldE1vdXNlUG9zKGUsIHRoaXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhd2luZ0Jib3guY29udGFpbnMobW91c2VQb3MpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHR0aXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhcnJvdy5pZCArIFwidG9vbHRpcFwiKTtcbiAgICAgICAgICAgICAgICB0dGlwLnN0eWxlLnRvcCA9IE1hdGgucm91bmQobW91c2VQb3MueSAvIHRoaXMuZGF0YXNldC5jYW52YXNyZXMgLSB0dGlwLm9mZnNldEhlaWdodCkgKyAncHgnOyAvLyBtb3ZlIHRpcCBhYm92ZSBjdXJzb3JcbiAgICAgICAgICAgICAgICB0dGlwLnN0eWxlLmxlZnQgPSBNYXRoLnJvdW5kKG1vdXNlUG9zLnggLyB0aGlzLmRhdGFzZXQuY2FudmFzcmVzKSArICdweCc7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGhpcy5pZCArIFwidG9vbHRpcHRleHRcIikuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGhpcy5pZCArIFwidG9vbHRpcHRleHRcIikuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn0pO1xuXG4iLCIvLyB0aGlzIGV2ZW50TGlzdGVuZXIgY29sbGVjdHMgYWxsIHRoZSBjYW52YXNlcyBpbiB0aGUgRE9NIHRoYXQgYXJlIG1hcmtlZCBhcyAnaXM9YmFyLWNoYXJ0JyBhbmQgZHJhd3Ncbi8vIGJhciBjaGFydHMgYXMgZGVmaW5lZCBieSB0aGUgZGF0YS1jaGFydGRhdGEgYW5kIGRhdGEtY2hhcnRvcHRzIGF0dHJpYnV0ZXNcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuXG4gICAgLy8gRGVmaW5lIGEgY2hhcnQuanMgcGx1Z2luIGZvciBhZGRpbmcgYW4gaW1hZ2UgdG8gdGhlIGNhdGVnb3J5IGxhYmVscyBvbiB0aGUgeS1heGlzLlxuICAgIC8vIEltYWdlIHNvdXJjZSBpcyBzcGVjaWZpZWQgaW4gdGhlIG9wdGlvbnMgZm9yIHRoaXMgcGx1Z2luIGFzIGEgZGljdGlvbmFyeS5cbiAgICAvLyBUaGUga2V5cyBpbiB0aGlzIGRpY3Rpb25hcnkgYXJlIHRoZSBheGlzIGxhYmVscyBhc3NvY2lhdGVkIHdpdGggdGhlIGltYWdlcztcbiAgICAvLyBlLmcuIHNwZWNpZnkgJ0FyZWEnOiAnYXJlYS5wbmcnIHRvIGluZGljYXRlIHRoYXQgYXJlYS5wbmcgc2hvdWxkIGdvIHdpdGggdGhlICdBcmVhJyBsYWJlbC5cbiAgICBjb25zdCBhZGRDYXRlZ29yeUltYWdlcyA9IHtcbiAgICAgICAgaWQ6ICdsYWJlbEltYWdlc1BsdWdpbicsXG4gICAgICAgIGFmdGVyRHJhdyhjaGFydCwgYXJncywgb3B0aW9ucykge1xuICAgICAgICAgICAgbGV0IGN0eCA9IGNoYXJ0LmN0eDtcbiAgICAgICAgICAgIGNvbnN0IHhBeGlzID0gY2hhcnQuc2NhbGVzWyd4J107XG4gICAgICAgICAgICBjb25zdCB5QXhpcyA9IGNoYXJ0LnNjYWxlc1sneSddO1xuICAgICAgICAgICAgaWYgKCBvcHRpb25zLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICAgICAgeUF4aXMuX2xhYmVsSXRlbXMuZm9yRWFjaCgoZGF0YUNhdCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy9pZiAoZGF0YUNhdC5sYWJlbCBpbiBvcHRpb25zKSB7IC8vIG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnNbaW5kZXhdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBpbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2Uuc3JjID0gb3B0aW9uc1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB5ID0geUF4aXMuZ2V0UGl4ZWxGb3JUaWNrKGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5QXhpcy53aWR0aCBjb252ZW5pZW50bHkgc2VlbXMgdG8gaW5jbHVkZSB0aGUgd2lkdGggb2YgdGhlIHRleHQgbGFiZWxzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyBwdXR0aW5nIHRoZSBpbWFnZSBqdXN0IHRvIHRoZSBsZWZ0IG9mIHRoYXQgc2VlbXMgdG8gd29yayBmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB4T2Zmc2V0ID0geUF4aXMud2lkdGggKyBpbWFnZS53aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1hZ2UsIHhBeGlzLmxlZnQgLSB4T2Zmc2V0LCB5IC0gTWF0aC5yb3VuZChpbWFnZS5oZWlnaHQgLyAyKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBEZWZpbmUgYSBjaGFydC5qcyBwbHVnaW4gZm9yIGFkZGluZyB0ZXh0IGxhYmVscyBpbnNpZGUgZWFjaCBob3Jpem9udGFsIGJhci5cbiAgICBjb25zdCBhZGRCYXJMYWJlbHMgPSB7XG4gICAgICAgIGlkOiAnYmFyTGFiZWxQbHVnaW4nLFxuICAgICAgICAvLyBub3RlOiBuZWVkIHRvIHVzZSBhZnRlckRhdGFzZXRzRHJhdyBoZXJlLlxuICAgICAgICAvLyBJZiB1c2luZyBhZnRlckRyYXcsIHRoZSB0ZXh0IGxhYmVscyB3aWxsIGVuZCB1cCBvbiB0b3Agb2YgZXZlcnl0aGluZywgaW5jbHVkaW5nIHRoZSB0b29sdGlwcyA6KFxuICAgICAgICAvLyAoc2VlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQwMjQzNTE4L2NoYXJ0cy1qcy10b29sdGlwLW92ZXJsYXBwaW5nLXRleHQtb24tY2hhcnQpXG4gICAgICAgIGFmdGVyRGF0YXNldHNEcmF3KGNoYXJ0LCBhcmdzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBsZXQgY3R4ID0gY2hhcnQuY3R4O1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGFydC5kYXRhLmRhdGFzZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IGRzID0gY2hhcnQuZ2V0RGF0YXNldE1ldGEoaSk7IC8vIGdldCBtZXRhIGluZm8gZm9yIHRoaXMgZGF0YXNldFxuICAgICAgICAgICAgICAgIGlmIChkcy50eXBlID09PSBcImJhclwiKSB7IC8vIHNraXAgYW55IGxpbmUgZGF0YTsgb25seSBpbnRlcmVzdGVkIGluIHRoZSBiYXJzIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHNOYW1lID0gZHMubGFiZWw7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZHMuZGF0YS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9lYWNoIGRhdGFwb2ludCBpbiB0aGlzIGRhdGFzZXQgY29ycmVzcG9uZHMgdG8gYSBiYXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBuZWVkIHRvIGZpZ3VyZSBvdXQgdGhlIGRpbWVuc2lvbnMgb2YgdGhlIGJhciBhbmQgdGV4dCB0byBnbyBpbnRvIHRoZSBiYXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGVuIHB1dCB0aGUgdGV4dCBpbnRvIHRoZSBjZW50ZXIgb2YgdGhlIGJhciBpZiBpdCBmaXRzLCB0byB0aGUgcmlnaHQgb2YgdGhlIGJhciBpZiBub3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhcldpZHRoID0gZHMuZGF0YVtqXS4kY29udGV4dC5lbGVtZW50LndpZHRoO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IG9wdGlvbnNbZHNOYW1lXS5sYWJlbHNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0V2lkdGggPSBjdHgubWVhc3VyZVRleHQodGV4dCkud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgc2hvd1RleHQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRleHRBbmNob3IgPSBkcy5kYXRhW2pdLmdldENlbnRlclBvaW50KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFyV2lkdGggPiB0ZXh0V2lkdGgpIHsgLy8gbGFiZWwgdGV4dCBmaXRzIGludG8gdGhlIGJhciAtIGNlbnRlciBpdCB0aGVyZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN0eC50ZXh0QWxpZ24gPSBcImNlbnRlclwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gdGV4dCBkb2Vzbid0IGZpdCBpbnRvIHRoZSBiYXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QW5jaG9yLnggPSBkcy5kYXRhW2pdLiRjb250ZXh0LmVsZW1lbnQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QW5jaG9yLnkgPSBkcy5kYXRhW2pdLiRjb250ZXh0LmVsZW1lbnQueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hhcnQub3B0aW9ucy5zY2FsZXNbJ3knXS5zdGFja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHdlIGFyZSBkZWFsaW5nIHdpdGggYSBzdGFja2VkIGJhciBjaGFydCwgb25seSBzaG93IHRleHQgaWYgaXQgZml0cyBpbnRvIHRoZSBiYXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RleHQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2hvd2luZyB0ZXh0IHRvIHJpZ2h0IG9mIGJhcicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG93IHRleHQgdG8gdGhlIHJpZ2h0IG9mIHRoZSBiYXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3R4LnRleHRBbGlnbiA9IFwibGVmdFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC50ZXh0QmFzZWxpbmUgPSBcIm1pZGRsZVwiOyAvLyB2ZXJ0aWNhbCBhbGlnbiB0byBjZW50ZXIgb2YgYmFyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gb3B0aW9uc1tkc05hbWVdLmNvbG9yIHx8IG9wdGlvbnMuY29sb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2RvOiBhbGxvdyBmb3IgZm9udCBzdHlsaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hvd1RleHQgJiYgdGV4dFdpZHRoID4gMCkgY3R4LmZpbGxUZXh0KHRleHQsIHRleHRBbmNob3IueCwgdGV4dEFuY2hvci55KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZGVmYXVsdHM6IHtcbiAgICAgICAgICAgIGNvbG9yOiAnd2hpdGUnLCAvLyB1c2Ugd2hpdGUgdGV4dCBpZiBubyBjb2xvciBzcGVjaWZpZWQgYnkgdXNlclxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIERlZmluZSBhIGNoYXJ0LmpzIHBsdWdpbiBmb3IgYWRkaW5nIHRoZSB3b3JkICdUYXJnZXQnIGFib3ZlIHRoZSB0YXJnZXQgbGluZS5cbiAgICBjb25zdCBhZGRUYXJnZXRMYWJlbCA9IHtcbiAgICAgICAgaWQ6ICd0YXJnZXRMYWJlbFBsdWdpbicsXG4gICAgICAgIGFmdGVyRHJhdyhjaGFydCwgYXJncywgb3B0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnNbJ2Rpc3BsYXknXSkge1xuICAgICAgICAgICAgICAgIGxldCBjdHggPSBjaGFydC5jdHg7XG4gICAgICAgICAgICAgICAgbGV0IGRzID0gY2hhcnQuZ2V0RGF0YXNldE1ldGEoMCk7IC8vIGRhdGFzZXQgMCBpcyB0aGUgdGFyZ2V0IGxpbmVcbiAgICAgICAgICAgICAgICBjb25zdCBlbmRQdCA9IGRzLmRhdGFbMF07XG4gICAgICAgICAgICAgICAgY3R4LnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XG4gICAgICAgICAgICAgICAgY3R4LnRleHRCYXNlbGluZSA9IFwiYm90dG9tXCI7IC8vIHZlcnRpY2FsIGFsaWdubWVudFxuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSAnYmxhY2snO1xuICAgICAgICAgICAgICAgIC8vIHRvZG86IGZvbnQgc3R5bGluZ1xuICAgICAgICAgICAgICAgIGN0eC5maWxsVGV4dChvcHRpb25zWydsYWJlbCddLCBlbmRQdC54LCBlbmRQdC55IC0gMTApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBkcmF3IHRoZSBiYXIgY2hhcnQgb24gdGhlIGNhbnZhc1xuICAgIGZ1bmN0aW9uIGRyYXcoY2FudmFzKSB7XG4gICAgICAgIGNvbnN0IGNoYXJ0ZGF0YSA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuY2hhcnRkYXRhKTtcbiAgICAgICAgbGV0IGNoYXJ0b3B0cyA9IEpTT04ucGFyc2UoY2FudmFzLmRhdGFzZXQuY2hhcnRvcHRzKTtcbiAgICAgICAgLy8gc2V0IHVwIHRvb2x0aXAgdG8gc2hvdyB3aGVuIGhvdmVyaW5nIG92ZXIgYSBiYXJcbiAgICAgICAgY2hhcnRvcHRzLnBsdWdpbnNbJ3Rvb2x0aXAnXSA9IHtcbiAgICAgICAgICAgICdiYWNrZ3JvdW5kQ29sb3InIDogJ3JnYmEoMCwgMCwgMCwgMSknLFxuICAgICAgICAgICAgJ2NhbGxiYWNrcyc6IHtcbiAgICAgICAgICAgICAgICAndGl0bGUnOiBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnJzsgLy8gdGl0bGUgaXMgeSBheGlzIGNhdGVnb3J5IChpLmUuLCB0aGUgbWV0cmljKSBieSBkZWZhdWx0OyBkb24ndCBzaG93IHRoaXNcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdsYWJlbCc6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIHdhbnQgdGhlIHR5cGUgb2YgYmFyIGhlcmUgKGUuZy4sICdjdXJyZW50JyBvciAncGxhbm5lZCcsXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvbGxvd2VkIGJ5IHRoZSB0ZXh0IGxhYmVsIHNob3duIGluc2lkZSB0aGUgYmFyIGluIGJyYWNrZXRzLlxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgbGF0dGVyIGlzIGhhbmR5IGJlY2F1c2UgaW4gc3RhY2tlZCBiYXIgY2hhcnRzIHRoZSBsYWJlbCBpbnNpZGUgdGhlIGJhclxuICAgICAgICAgICAgICAgICAgICAvLyBzb21ldGltZXMgd29uJ3QgYmUgc2hvd24gYmVjYXVzZSBvZiBsYWNrIG9mIHNwYWNlLCBzbyB0aGUgdG9vbHRpcCBpcyB0aGUgb25seVxuICAgICAgICAgICAgICAgICAgICAvLyB3YXkgZm9yIHRoZSB1c2VyIHRvIGdldCB0aGF0IGluZm9ybWF0aW9uLlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcyA9IGNvbnRleHQuZGF0YXNldC5sYWJlbDsgLy8gdGhpcyBpcyB0aGUgYmFyIHR5cGVcbiAgICAgICAgICAgICAgICAgICBpZiAoZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IHRoZSBsYWJlbHMgZm9yIHRoaXMgYmFyIHR5cGU7IHRoZXkgYXJlIHBhc3NlZCBpbiB0aHJvdWdoIHRoZSBiYXJMYWJlbFBsdWdpbi5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhYmVscyA9IGNvbnRleHQuY2hhcnQuY29uZmlnLm9wdGlvbnMucGx1Z2luc1snYmFyTGFiZWxQbHVnaW4nXVtkc10ubGFiZWxzO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGF0YUluZGV4IGlzIHRoZSBudW1lcmljIGluZGV4IG9uIHRoZSB5LWF4aXMgKGkuZS4sIGNvcnJlc3BvbmRpbmcgdG8gdGhlIG1ldHJpYylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkcyArICcgKCcgKyBsYWJlbHNbY29udGV4dC5kYXRhSW5kZXhdICsgJyknO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgY2hhcnQgdXNpbmcgQ2hhcnQuanNcbiAgICAgICAgY29uc3QgY2hhcnQgPSBuZXcgQ2hhcnQoY2FudmFzLCB7XG4gICAgICAgICAgICB0eXBlOiAnYmFyJyxcbiAgICAgICAgICAgIGRhdGE6IGNoYXJ0ZGF0YSxcbiAgICAgICAgICAgIG9wdGlvbnM6IGNoYXJ0b3B0cyxcbiAgICAgICAgICAgIHBsdWdpbnM6IFthZGRDYXRlZ29yeUltYWdlcywgYWRkQmFyTGFiZWxzLCBhZGRUYXJnZXRMYWJlbF0sXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgYmFyIGNoYXJ0IGNhbnZhcyBlbGVtZW50c1xuICAgIGNvbnN0IGNoYXJ0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2NhbnZhc1tpcz1cImJhci1jaGFydFwiXScpO1xuICAgIGNoYXJ0cy5mb3JFYWNoKChjaGFydCkgPT4ge1xuICAgICAgICBkcmF3KGNoYXJ0KTtcbiAgICB9KTtcblxuICAgIC8vIEV4cG9zZSB0aGUgbW9kdWxlIGZ1bmN0aW9uYWxpdHlcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgIGRyYXc6IGRyYXdcbiAgICB9O1xuICAgIC8vIEhhY2s6ICBhZGQgdGhlIGV4cG9ydHMgZGlyZWN0bHkgdG8gdmFyaWFibGUgZXhwb3NlZCBieSBwYWNrYWdlLlxuICAgIHdpbmRvdy52aXpfY29tcG9uZW50cyA9IHdpbmRvdy52aXpfY29tcG9uZW50cyB8fCB7fTtcbiAgICB3aW5kb3cudml6X2NvbXBvbmVudHMuYmFyX2NoYXJ0ID0gbW9kdWxlLmV4cG9ydHM7XG59KTtcblxuXG4iLCIvLyB0aGlzIGV2ZW50TGlzdGVuZXIgY29sbGVjdHMgYWxsIHRoZSBjYW52YXNlcyBpbiB0aGUgRE9NIHRoYXQgYXJlIG1hcmtlZCBhcyAnaXM9ZG91Z2hudXQtY2hhcnQnIGFuZCBkcmF3c1xuLy8gZG91Z2hudXQgY2hhcnRzIGFzIGRlZmluZWQgYnkgdGhlIGRhdGEtY2hhcnRkYXRhIGFuZCBkYXRhLWNoYXJ0b3B0cyBhdHRyaWJ1dGVzXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG5cbiAgICAvLyBkcmF3IHRoZSBkb3VnaG51dCBjaGFydCBvbiB0aGUgY2FudmFzIHVzaW5nIGNoYXJ0LmpzXG4gICAgZnVuY3Rpb24gZHJhdyhjYW52YXMpIHtcbiAgICAgICAgY29uc3QgY2hhcnRkYXRhID0gSlNPTi5wYXJzZShjYW52YXMuZGF0YXNldC5jaGFydGRhdGEpO1xuICAgICAgICBsZXQgY2hhcnRvcHRzID0gSlNPTi5wYXJzZShjYW52YXMuZGF0YXNldC5jaGFydG9wdHMpO1xuICAgICAgICAvLyBhZGQgY2FsbGJhY2tzIGZvciBjdXN0b20gdG9vbHRpcCBmb3JtYXRzXG4gICAgICAgIGNoYXJ0b3B0cy5wbHVnaW5zWyd0b29sdGlwJ10gPSB7XG4gICAgICAgICAgICBjYWxsYmFja3M6IHtcbiAgICAgICAgICAgICAgICB0aXRsZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHRbMF0ubGFiZWw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBsYWJlbDogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHRvdGFsID0gMDtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kYXRhc2V0LmRhdGEubWFwKGUgPT4gdG90YWwgKz0gZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnICcgKyBjb250ZXh0LnBhcnNlZCArICcgKCcgKyBNYXRoLnJvdW5kKDEwMCAqIGNvbnRleHQucGFyc2VkIC8gdG90YWwpICsgJyUpJztcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBjaGFydCA9IG5ldyBDaGFydChjYW52YXMsIHt0eXBlOiAnZG91Z2hudXQnLCBkYXRhOiBjaGFydGRhdGEsIG9wdGlvbnM6IGNoYXJ0b3B0c30pO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgZG91Z2hudXQgY2hhcnQgY2FudmFzIGVsZW1lbnRzIGluIHRoZSBET01cbiAgICBjb25zdCBjaGFydHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdjYW52YXNbaXM9XCJkb3VnaG51dC1jaGFydFwiXScpO1xuICAgIGNoYXJ0cy5mb3JFYWNoKChjaGFydCkgPT4ge1xuICAgICAgICBkcmF3KGNoYXJ0KTtcbiAgICB9KTtcbn0pO1xuXG5cbiIsIi8vIHRoaXMgZXZlbnRMaXN0ZW5lciBjb2xsZWN0cyBhbGwgdGhlIGNhbnZhc2VzIGluIHRoZSBET00gdGhhdCBhcmUgbWFya2VkIGFzICdpcz1zdGFja2VkLWRvdWdobnV0LWNoYXJ0JyBhbmQgZHJhd3Ncbi8vIGRvdWdobnV0IGNoYXJ0cyBhcyBkZWZpbmVkIGJ5IHRoZSBkYXRhLWNoYXJ0ZGF0YSBhbmQgZGF0YS1jaGFydG9wdHMgYXR0cmlidXRlc1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgIC8vIGRyYXcgdGhlIGRvdWdobnV0IGNoYXJ0IG9uIHRoZSBjYW52YXMgdXNpbmcgY2hhcnQuanNcbiAgICBmdW5jdGlvbiBkcmF3KGNhbnZhcykge1xuICAgICAgICBjb25zdCBjaGFydGRhdGEgPSBKU09OLnBhcnNlKGNhbnZhcy5kYXRhc2V0LmNoYXJ0ZGF0YSk7XG4gICAgICAgIGxldCBjaGFydG9wdHMgPSBKU09OLnBhcnNlKGNhbnZhcy5kYXRhc2V0LmNoYXJ0b3B0cyk7XG4gICAgICAgIC8vIGFkZCBjYWxsYmFja3MgZm9yIGN1c3RvbSB0b29sdGlwIGZvcm1hdHMgaGVyZVxuICAgICAgICBjaGFydG9wdHMucGx1Z2luc1sndG9vbHRpcCddID0ge1xuICAgICAgICAgICAgY2FsbGJhY2tzOiB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb250ZXh0WzBdLmRhdGFzZXQuY2F0TGFiZWxzW2NvbnRleHRbMF0uZGF0YUluZGV4XTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGxhYmVsOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdG90YWwgPSAwO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRhdGFzZXQuZGF0YS5tYXAoZSA9PiB0b3RhbCArPSBlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcgJyArIGNvbnRleHQucGFyc2VkICsgJyAoJyArIE1hdGgucm91bmQoMTAwICogY29udGV4dC5wYXJzZWQgLyB0b3RhbCkgKyAnJSknO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGNoYXJ0ID0gbmV3IENoYXJ0KGNhbnZhcywge3R5cGU6ICdkb3VnaG51dCcsIGRhdGE6IGNoYXJ0ZGF0YSwgb3B0aW9uczogY2hhcnRvcHRzfSk7XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBkb3VnaG51dCBjaGFydCBjYW52YXMgZWxlbWVudHNcbiAgICBjb25zdCBjaGFydHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdjYW52YXNbaXM9XCJzdGFja2VkLWRvdWdobnV0LWNoYXJ0XCJdJyk7XG4gICAgY2hhcnRzLmZvckVhY2goKGNoYXJ0KSA9PiB7XG4gICAgICAgIGRyYXcoY2hhcnQpO1xuICAgIH0pO1xufSk7XG4iLCIvLyB0aGlzIHBhY2thZ2VzIHVwIGFsbCBiaXRzIGFuZCBwaWVjZXMgaW50byBhIHNpbmdsZSBqcyBmaWxlXG4vLyBjYW4gY29tZSBmcm9tIGxvY2FsIGRpciBvciBubXAgZGlyZWN0b3J5XG4vLyBpbnN0YWxsIGV4dGVybmFsIHNvdXJjZXMgdmlhIG5tcCwgaWRlYWxseSBmcm9tIG5vZGUsIGJ1dCBjYW4gcHVsbCBmcm9tIGdpdGh1YiBkaXJlY3RseSBpZiBuZWVkZWRcbi8vIHVzZSBicm93c2VyaWZ5LXNoaW0gdG8gZXhjbHVkZSBsYXJnZSBzaGFyZWQgY29tcG9uZW50cyBmcm9tIGRpc3QgYnVuZGxlXG4vLyBzZWUgcGFja2FnZS5qc29uIGluIGh5ZHJvbmV0L2NsaWVudC1zaWRlIGZvciBzYW1wbGUgYnVpbGQgcHJvY2VzcyB3aXRoIHNoaW1cbi8vdmFyIGNoYXJ0anMgPSByZXF1aXJlKCdjaGFydC5qcycpO1xuLy92YXIgRG91Z2hudXRMYWJlbCA9IHJlcXVpcmUoJ2NoYXJ0anMtcGx1Z2luLWRvdWdobnV0bGFiZWwtdjMnKTtcblxuLy8gRXhwb3NlIHRoZSBwYWNrYWdlIGZ1bmN0aW9uYWxpdHkgLSB0aGlzIHNlZW1zIGxpa2UgYSBoYWNrLiBzaG91bGQgYmUgYWJsZSB0byB1c2UgbW9kdWxlLmV4cG9ydHMgLSBzZWUgY29tbWVudGVkIGNvZGVcbndpbmRvdy52aXpfY29tcG9uZW50cyA9IHdpbmRvdy52aXpfY29tcG9uZW50cyB8fCB7fTtcblxucmVxdWlyZSgnLi9hcnJvdy5qcycpO1xucmVxdWlyZSgnLi9iYXJfY2hhcnQuanMnKTtcbnJlcXVpcmUoJy4vZG91Z2hudXRfY2hhcnQuanMnKTtcbnJlcXVpcmUoJy4vc3RhY2tlZF9kb3VnaHRudXRfY2hhcnQuanMnKTtcblxuLy8gRXhwb3NlIHRoZSBwYWNrYWdlIGZ1bmN0aW9uYWxpdHkgLSB0aGlzIGlzIHdoYXQgdGhlIGRvY3VtZW50YXRpb24gc2F5cyBzaG91bGQgd29yay5cbi8vIG1vZHVsZS5leHBvcnRzID0ge1xuLy8gICBiYXJfY2hhcnQ6IHJlcXVpcmUoJy4vYXJyb3cuanMnKSxcbi8vIH07XG4vLyB3aW5kb3cudml6X2NvbXBvbmVudHMgPSBtb2R1bGUuZXhwb3J0cztcbiJdfQ==
