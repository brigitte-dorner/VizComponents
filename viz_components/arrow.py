from dataclasses import dataclass, field
from json import dumps
from .helpers import unique_id


# input data generator for the up/down arrow widget

@dataclass
class Arrow:
    """
    Create data for an arrow-shaped widget that visualizes change in a metric

     Dependencies: html canvas

     The widget shows an up arrow (i.e., a triangle) for increase, a down arrow for decrease.
     The size of the arrow is determined by the magnitude of change, which would usually be expressed as a percentage.
     Since small triangles would be hard to see, zero change is represented by a flat line.
     For increasing values of the metric, the triangle base stays the same initially, but the sides become
     progressively steeper, until the height of the triangle is equal to the width. Once this point is reached,
     the base ('width') of the triangle increases in step with increased height.

     Triangle height is scaled as a function of change in metric value based on the formula
     f(x) = x/(x+1)
     as the underlying asymptotic function.
     More specifically, an initial height is determined as
     f(val, half_way_pt) = abs(val)/half_way_pt/(abs(val)/half_way_pt+1)
     where val is the given change in the metric value to be visualized, and half_way_pt is a control point
     that determines how quickly the size of the triangle increases at low magnitudes of change.
     This initial height is used to set triangle width, and the actual height of the triangle
     is then calculated by scaling initial height by the desired height_to_width ratio.

     Triangle label:
     If the triangle label fits inside the triangle at the specified minimum font size, it is displayed
     inside the triangle at the maximum font size that still allows the label to fit comfortably inside.
     If the triangle is too small/flat to accommodate the label, the label is placed above the triangle instead.

     val -- the value to be visualized, typically a change in a metric expressed as % change, e.g., -5 for a 5% decrease

     half_way_pt -- use this to adjust, how quickly triangle size increases at the low end of the range
                    the lower the value of half_way_pt, the more resolution at the low end of the spectrum

     align -- how to align the base of th triangle with respect to the canvas;
              center: triangle base is centered on the canvas in vertical direction - best for side-by-side display
              optimal: triangle base is aligned with bottom of canvas for up-arrows, top of canvas for down-arrows
                       this is more space-efficient and better when arrows are shown as part of a larger table display

     ht_width_ratio - height-to-width ratio for the triangle shape; larger values result in steeper-sided triangles

     colors -- a dict with entries 'up', 'down', and 'no change'; specifies the colors for the arrow triangle.

     label -- the label to display; only set this to override the default, which is to show the value

     label_format -- format string to apply to val to generate the label

     min_font_size -- minimum font size to use; if the label at this font size doesn't fit inside the triangle
                      it will be placed above the triangle instead; if the label is shown inside the triangle,
                      it will be shown in the maximum font size that will fit inside

     font -- the font to use for the label

     label_colors -- a dict with entries 'inside' and 'outside' specifies text color for label when inside vs outside
                     of triangle

     label_offset -  a dict that gives the offset for the label, entries are
                     'inside' : offset in relation to the base of the triangle when the label is shown inside
                                    (specifies offset as a proportion of triangle height)
                     'outside' : offset in relation to the tip of the triangle when label is shown above triangle
                                     (specifies offset as a proportion of canvas height)

     label_padding -- horizontal padding around label when label is drawn inside the triangle (in pixels)

     tooltip -- 'auto' for automatic tooltips, '' for no tooltip, or custom string to override automatic generation
                note that tooltip is a css tooltip; use .arrow_tooltiptextstyle class to style

     canvas -- a unique id for the canvas that the widget is to be drawn on (auto-generated if not supplied)
     """
    val: int
    # triangle specs
    half_way_pt: int = 10
    align: str = 'center'
    ht_width_ratio: float = 0.5
    colors: dict = field(default_factory=lambda: {
        'up': '#008ad1',  # colour of the arrow when showing increase
        'down': '#666699',  # color of the arrow when showing decrease
        'no_change': 'black',  # color of the arrow when showing decrease
    })
    # label specs
    label: str = ''
    label_format: str = '%+d%%'
    min_font_size: int = 12
    font: str = "Arial"
    label_colors: dict = field(default_factory=lambda: {
        'inside': 'white',  # text color for label if inside arrow
        'outside': 'black',  # text color for label if above arrow
    })
    label_offset: dict = field(default_factory=lambda: {  # label offset
        'inside': 0.07,
        # offset from triangle base when label is inside the triangle, in units of triangle height
        'outside': 0.05,  # offset from top of triangle when label is above triangle, in units of canvas height
    })
    label_padding: int = 5
    # tooltip specs
    tooltip: str = 'auto'
    canvas: str = ''  # css id for the canvas

    @property
    def data(self):
        return self.make_data()

    @property
    def label_formatted(self):
        # if label is provided, let it override, otherwise apply formatting string
        return self.label if len(self.label) > 0 else self.label_format % self.val

    @property
    def tooltip_formatted(self):
        # if tooltip is 'auto', apply default formatting, otherwise let initial value override
        if self.tooltip != 'auto':
            return self.tooltip
        if self.val > 0:
            return str(self.val) + '% increase'
        elif self.val < 0:
            return str(-self.val) + '% decrease'
        else:  # self.val == 0
            return 'no change'

    @property
    def canvas_id(self):
        return self.canvas if len(self.canvas) > 0 else unique_id('viz-arrow-')

    def make_data(self):
        abs_val = abs(self.val)
        x = abs_val / self.half_way_pt
        max_ht = 100
        t_height = max_ht * (x / (x + 1))
        t_width = max_ht / 2 if (abs_val < self.half_way_pt) else t_height
        t_height = t_height * self.ht_width_ratio
        t_dir = 'up' if (self.val >= 0) else 'down'
        return dumps({'height': t_height,
                      'width': t_width,
                      'dir': t_dir,
                      'base_align': self.align,
                      'max_width': max_ht,
                      'max_ht': max_ht * self.ht_width_ratio,
                      'ht_width_ratio': self.ht_width_ratio,
                      'colors': self.colors,
                      'label': {
                          'text': self.label_formatted,
                          'min_font_size': self.min_font_size,
                          'font': self.font,
                          'offset': self.label_offset,
                          'padding': self.label_padding,
                          'colors': self.label_colors, },
                      'tooltip': self.tooltip_formatted, })
