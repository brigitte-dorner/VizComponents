from dataclasses import dataclass, field
from json import dumps
from .color_mngmnt import make_color_pal
from .helpers import unique_id

# input data generator for the doughnut chart widget


@dataclass
class DoughnutChart:
    """
    Use the DoughnutChart class for creating the supporting data structures for a simple doughnut chart,
    i.e., a doughnut chart with a single ring

    data_labels -- the list of data categories to display;

    data_values -- the list of values associated with the categories;

    chart_label -- the name or label of the chart (defaults to empty string);

    colors -- the colors to use for the categories;
              colors will be drawn from the default palette if none are provided

    color_pal -- the name of the color palette to use;
                 defaults to the default palette defined in color_mngmnt.py
                 note that color_pal is ignored if colors are specified directly
                 in via colors

    center_text -- text to appear in the center of the chart
                   center_text should be a list, with each entry corresponding to a line of text;
                   the lines may be given either as a simple text strings
                   or, if custom formatting is desired, the lines can also be specified
                   as a list of dicts of the form
                   {'text': <text to be shown>, ... formatting options such as font, color etc}
                   see https://github.com/FreedomRings/chartjs-plugin-doughnutlabel-v3
                   for more information on how to specify styling.
                   If a list of dict is given here, it will be converted to JSON
                   and passed on to the javascript doughnutlabel API without any processing.

    additional_data -- anything specified here will be passed through to the chart 'data'.
                       See Chart.js documentation for available settings.
                       Anything set in additional_data will override defaults and entries to
                       chart data set through the DoughnutChart class, so caution is advised
                       when utilizing this attribute.

    additional_opts -- anything specified here will be passed through to the chart 'options'.
                       See Chart.js documentation for available options.
                       As with additional_data, anything set in additional_opts will override defaults and options
                       set through the DoughnutChart class.

    canvas -- unique id for the canvas the chart is to be drawn on (auto-generated if not supplied)
     """
    data_labels: list
    data_values: list
    chart_label: str = ''
    colors: list = field(default_factory=lambda: [])
    color_pal: str = ''
    center_text: list = field(default_factory=lambda: [])
    responsive: bool = False
    legend: bool = False
    title: bool = False
    additional_data: dict = field(default_factory=lambda: {})
    additional_opts: dict = field(default_factory=lambda: {})
    canvas: str = ''

    @property
    def canvas_id(self):
        """ Return canvas id, automatically generate if not supplied """
        return self.canvas if len(self.canvas) > 0 else unique_id('viz-doughnut-')

    @property
    def chartopts(self):
        return self.make_chart_opts()

    @property
    def chartdata(self):
        return self.make_chart_data()

    def make_chart_opts(self):
        opts = dict(responsive=self.responsive,)
        opts['plugins'] = {'legend': {'display': self.legend},
                           'title': {'display': self.title}}
        if len(self.center_text) > 0:
            # need to add the doughnutlabel plugin with appropriate parameters here
            # to show center text. First, create the doughnutlabel data from the
            # center_text list. The entries in the list represent lines of text.
            # If an entry is a simple string, we need to convert it to a dict with the
            # appropriate format for the doughnutlabel plugin.
            # If not, we can assume that the entry for the line is already in the
            # correct format for the plugin and just pass it through.
            dl_data = map(lambda l: {'text': l} if isinstance(l, str) else l, self.center_text)
            opts['plugins'].update({'doughnutLabel': {'labels': list(dl_data)}})
        # add other optional parameters and plugins here as needed
        opts.update(self.additional_opts)
        # return chart opts as JSON string
        return dumps(opts)

    def make_chart_data(self):
        n = len(self.data_values)
        assert(len(self.data_labels) == n)
        # if the user hasn't set colors, choose them from an appropriate palette now
        # otherwise ensure that the user has provided a long-enough list of colors
        if len(self.colors) == 0:
            self.colors = make_color_pal(n)
        else:
            assert(len(self.colors) >= n)
        chartdata = {'labels': self.data_labels,
                     'datasets': [{'label': self.chart_label,
                                   'data': self.data_values,
                                   'backgroundColor': self.colors, }, ], }
        chartdata.update(self.additional_data)  # merge in additional data, also gives the user the option to override
        # return chart data as JSON string
        return dumps(chartdata)
