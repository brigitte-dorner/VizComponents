Several of the viz components defined here utilize Chart.js to do part or all of the work.
The general design principle for the viz components API is that widgets based on Chart.js take
the data structures required to parameterize Chart.js as parameters. Since there is a close match
between python and Javascript data types, the strategy adopted here is to generate the
equivalent of the data structures required by Chart.js in python, then dump to json for javascript import.

It is therefore possible, and may sometimes be the most straight-forward approach,
to build the appropriate Chart.js data structures from scratch in the view associated with a template that
utilizes oneof the viz components. However, chart.js datasets have a generic structure meant to fit different
chart types and aren't always intuitive to use. Python dataclasses are therefore defined here as a shortcut and
more intuitive interface for generating input data for widgets based on Chart.js.
Python dataclasses are also the easiest way to parameterize widgets created via other methods on the client side.

Typical usage within a django project would be to define the appropriate html template for the desired component, e.g.
define a template file <yourtemplate>.html:

{% load static %}
<!DOCTYPE html>
<html lang="en">
  <head>
    ...
     <!-- load style sheets, including ones that define custom viz-component styles ... -->
     <link rel="stylesheet" type="text/css" href="{% static 'css/style.css' %}"/>
  </head>
  <body>
    <!-- load any scripts needed for widget generation, e.g., the bar chart widget utilizes: -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="{% static 'js/chartjs-plugin-doughnutlabel.min.js' %}"></script>

    <!-- add template string for the viz component widget, e.g. to create a bar chart -->
    { % bar_chart barchart.canvas_id barchart.chartdata barchart.chartopts %}

  </body>
</html>

---

then create a view utilizing the corresponding dataclass generator to parameterize the widget, e.g.

from django.shortcuts import render
from viz_components.bar_chart import BarChart

def bar_view(request):
    chartdata = BarChart(canvas_id='barcanvas', .;...)
    return render(request, '<your template>.html', dict(barchart = chartdata,))
