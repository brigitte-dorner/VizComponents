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
