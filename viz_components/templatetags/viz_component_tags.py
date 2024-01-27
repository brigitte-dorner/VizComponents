from django import template
from django.template.loader import render_to_string

from viz_components.progress import Progress
from viz_components import DoughnutChart, StackedDoughnutChart

register = template.Library()


@register.inclusion_tag('viz_components/doughnut_chart.html')
def doughnut_chart(canvas_id, chartdata, chartopts):
    """
    Render the given DoughnutChart object
    Use an instance of the DoughnutChart class to generate the required canvas_id, chartdata, and chartopts objects.
    See doughnut_chart.py for details
    """
    return dict(canvas=canvas_id, chartdata=chartdata, chartopts=chartopts)


@register.inclusion_tag('viz_components/stacked_doughnut_chart.html')
def stacked_doughnut_chart(canvas_id, chartdata, chartopts):
    """
    Render the given StackedDoughnutChart object
    Use an instance of the StackedDoughnutChart to generate the required canvas_id, chartdata, and chartopts objects.
    See stacked_doughnut_chart.py for details
    """
    return dict(canvas=canvas_id, chartdata=chartdata, chartopts=chartopts)


@register.simple_tag
def render_doughnut_chart(chart):
    """ Render the doughnut chart based using the appropriate tag for its type """
    tag = 'stacked_doughnut_chart' if isinstance(chart, StackedDoughnutChart) else 'doughnut_chart'
    tmpl = template.Template(
        f'{{% load viz_component_tags %}}{{% {tag} chart.canvas_id chart.chartdata chart.chartopts %}}'
    )
    return tmpl.render(template.Context(dict(chart=chart)))


@register.inclusion_tag('viz_components/bar_chart.html')
def bar_chart(canvas_id, chartdata, chartopts):
    """
    Render the given BarChart object
    Use and instance of the BarChart class to generate the canvas_id, chartdata, and chartopts arguments
    See bar_chart.py for details
    """
    return dict(canvas=canvas_id, chartdata=chartdata, chartopts=chartopts)


@register.inclusion_tag('viz_components/arrow.html')
def arrow(canvas_id, data):
    """
    Render the arrow using the specs provided in arrow_data
    Use an instance of the Arrow class to generate the canvas_id and arrow_data object
    See arrow.py for details
    """
    return dict(canvas=canvas_id, data=data)


@register.inclusion_tag('viz_components/progress.html')
def progress_bar(*progress_bars, **kwargs):
    """
    Render one or more ProgressBar instances as Bootstrap progress bars
    progress_bars may be a list of ProgressBar instances in which case
    kwargs are passed directly through to Progress constructor - see that class for kw options
    OR a single pre-configured Progress element.
    See progress.py for details on usage of ProgressBar and Progress classes
    """
    progress = progress_bars[0] if len(progress_bars) == 1 and isinstance(progress_bars[0], Progress) \
        else Progress(*progress_bars, **kwargs)
    return dict(progress=progress)


@register.inclusion_tag('viz_components/simple_progress.html')
def simple_progress_bar(progress_bar):
    """
    Render one ProgressBar instance as a Bootstrap progress bar
    See progress.py for details on how to use the ProgressBar class
    """
    return dict(pg_bar=progress_bar)


@register.inclusion_tag('viz_components/delta_arrows.html')
def delta_arrows(arrow_data):
    """
    Render one ProgressBar instance as a Bootstrap progress bar
    See progress.py for details on how to use the ProgressBar class
    """
    return dict(data=arrow_data)


@register.inclusion_tag('viz_components/doughnuts.html')
def doughnuts(doughnut_data):
    """
    Render one ProgressBar instance as a Bootstrap progress bar
    See progress.py for details on how to use the ProgressBar class
    """
    return dict(data=doughnut_data)

