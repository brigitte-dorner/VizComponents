
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

