from dataclasses import dataclass, field
from json import dumps
from .color_mngmnt import make_color_pal
from .helpers import unique_id

# input data generator for the doughnut chart widget


@dataclass
class StackedDoughnutChart:
    """
    Use the DoughnutChart class for creating the supporting data structures for a stacked doughnut chart,
    i.e., a doughnut chart with two rings, where the inner ring represents an additional breakout
    into a summary grouping, i.e., each summary category has one data value for each primary category.


    data_labels -- the list of primary data categories to display

    data_values -- a dict, consisting of multiple lists of values, each associated with one of the primary categories;
                   the keys in the dict will be used as labels for the corresponding summary categories.

    chart_label -- the name or label of the chart (defaults to empty string)

    colors -- the colors to use for the primary categories;
              colors will be drawn from the default palette if none are provided here

    summary_colors -- the colors to use for the summary categories

    color_pal -- the name of the color palette to use;
                 defaults to the default palette defined in color_mngmnt.py
                 note that color_pal is ignored if colors are specified directly
                 in via colors

    center_text: text to appear in the center of the chart
                  center_text should be a list, with each entry corresponding to a line of text;
                  the lines may be given either as a simple text strings
                  or, if custom formatting is desired, the lines can also be specified
                  as a list of dicts of the form
                  {'text': <text to be shown>, ... formatting options such as font, color etc}
                  see https://github.com/FreedomRings/chartjs-plugin-doughnutlabel-v3
                  for more information on how to specify styling.
                  If a list of dict is given here, it will be converted to JSON
                  and passed on to the javascript doughnutlabel API without any processing.

    additional_data: anything specified here will be passed through to the chart 'data'.
                     See Chart.js documentation for available settings.
                     Anything set in additional_data will override defaults and entries to
                     chart data set through the DoughnutChart class, so caution is advised
                     when utilizing this attribute.

    additional_opts: anything specified here will be passed through to the chart 'options'.
                     See Chart.js documentation for available options.
                     As with additional_data, anything set in additional_opts will override defaults and options
                     set through the DoughnutChart class.

    canvas: unique id for the canvas the chart is to be drawn on (auto-generated if not supplied)
    """
    data_labels: list
    data_values: dict
    chart_label: str = ''
    colors: list = field(default_factory=lambda: [])
    summary_colors: list = field(default_factory=lambda: [])
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
        opts = {'responsive': self.responsive, }
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
            opts['plugins'].update({'doughnutLabel': {'labels': list(dl_data)},})
        # add other optional parameters and plugins here as needed
        opts.update(self.additional_opts)
        # return chart opts as JSON string
        return dumps(opts)

    def make_chart_data(self):
        n = len(list(self.data_values.values())[0])
        assert(len(self.data_labels) == n)
        m = len(self.data_values)
        colors_needed = m + n - (len(self.colors) + len(self.summary_colors))
        # if the user hasn't provided colors, choose them from an appropriate palette now
        if colors_needed > 0:
            colors = make_color_pal(colors_needed)
            if len(self.colors) == 0:
                self.colors = colors[slice(n)]
            if len(self.summary_colors) == 0:
                self.summary_colors = colors[slice(colors_needed - m, colors_needed)]

        # the colors associated with the summary categories as border color here,
        # to enforce the visual appearance of arcs being grouped by summary categories
        ds = {'label': '',
              'data': sum(self.data_values.values(), []),  # concat data values from all summary cats into one big list
              'backgroundColor': self.colors,
              'borderWidth': 5,
              'borderColor': sum(([c]*n for c in self.summary_colors), []),  # replicate each summary color n times
              'catLabels': self.data_labels * n, }

        summary_ds = {'label': '',
                      'data': list(map(sum, self.data_values.values())),
                      'backgroundColor': self.summary_colors,
                      'borderColor': self.summary_colors,
                      'catLabels': list(self.data_values.keys()), }

        chartdata = {'labels': self.data_labels,
                     'datasets': [ds, summary_ds], }
        chartdata.update(self.additional_data)  # merge in additional data, also gives the user the option to override
        # return chart data as JSON string
        return dumps(chartdata)
