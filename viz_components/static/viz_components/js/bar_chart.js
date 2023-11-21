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
});


