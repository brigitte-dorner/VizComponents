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


