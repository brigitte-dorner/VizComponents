from itertools import chain
from django.shortcuts import render
from django.templatetags.static import static
from viz_components.progress import *
from viz_components.bar_chart import BarChart
from viz_components.doughnut_chart import DoughnutChart
from viz_components.stacked_doughnut_chart import StackedDoughnutChart
from viz_components.arrow import Arrow


# progress bar test cases

def risks():
    return ProgressBar(value=230,
                       goal=400,
                       title_template='{self.value}/{self.goal} mitigated',
                       summary_template='{self.value} of {self.goal} risks mitigated',
                       css_class='viz-component-bg-blue', )


def heli_progress():
    return ProgressBar(value=320,
                       goal=500,
                       title_template='{self.value} of {self.goal} heli patrols',
                       summary_template='{self.value}/{self.goal} heli',
                       css_class='bg-success', )


def ground_progress():
    return ProgressBar(value=52,
                       goal=300,
                       title_template='{self.value} of {self.goal} ground patrols',
                       summary_template='{self.value}/{self.goal} ground',
                       css_class='bg-warning', )


def patrol_progress():
    return Progress(heli_progress(),
                    ground_progress(),
                    summary_template='{self.value}/{self.goal} total patrols completed', )


def planned():
    return ProgressBar(value=59,
                       title_template='{self.value} of {self.goal} in planning stage',
                       css_class='viz-component-bg-red', )


def scheduled():
    return ProgressBar(value=159,
                       title_template='{self.value} of {self.goal} scheduled',
                       css_class='viz-component-bg-yellow', )


def in_progress():
    return ProgressBar(value=80,
                       title_template='{self.value} of {self.goal} in progress',
                       css_class='viz-component-bg-blue', )


def completed():
    return ProgressBar(value=22,
                       title_template='{self.value} of {self.goal} completed',
                       summary_template='{self.value} of {self.goal} completed',
                       css_class='viz-component-bg-green', )


def proj_progress():
    return Progress(planned(), scheduled(), in_progress(), completed(),
                    goal=59 + 159 + 80 + 22,
                    summary_template='')


def simple_overflow_case():
    return ProgressBar(value=110, goal=100, summary_template='{self.value}/{self.goal} done')

def simple_zero_goal_case():
    return ProgressBar(value=1, goal=0, summary_template='{self.value}/{self.goal} done')

def overflow_case1():
    return Progress(ProgressBar(value=101,
                                goal=100,
                                css_class='viz-component-bg-red',
                                summary_template='bar1: {self.value}/{self.goal} done'),
                    ProgressBar(value=250,
                                goal=200,
                                css_class='viz-component-bg-green',
                                summary_template='bar2: {self.value}/{self.goal} done'),
                    ProgressBar(value=150,
                                goal=200,
                                css_class='viz-component-bg-yellow',
                                summary_template='bar3: {self.value}/{self.goal} done'),
                    summary_template='', )


def overflow_case2():
    return Progress(ProgressBar(value=101,
                                css_class='viz-component-bg-red',
                                summary_template='bar1: {self.value}/{self.goal} done'),
                    ProgressBar(value=250,
                                css_class='viz-component-bg-green',
                                summary_template='bar2: {self.value}/{self.goal} done'),
                    goal=200,
                    summary_template='', )

def zero_goal_case():
    return Progress(ProgressBar(value=101,
                                css_class='viz-component-bg-red',
                                summary_template='bar1: {self.value}/{self.goal} done'),
                    ProgressBar(value=250,
                                css_class='viz-component-bg-green',
                                summary_template='bar2: {self.value}/{self.goal} done'),
                    ProgressBar(value=0,
                                css_class='viz-component-bg-yellow',
                                summary_template='bar3: {self.value}/{self.goal} done'),
                    goal=0,
                    summary_template='', )

progress_bar_examples = dict(
    risks_progress=risks(),
    completed=completed(),
    patrol_progress=patrol_progress(),
    proj_progress=proj_progress(),
    simple_overflow=simple_overflow_case(),
    simple_zero_goal = simple_zero_goal_case(),
    overflow_case1=overflow_case1(),
    overflow_case2=overflow_case2(),
    zero_goal = zero_goal_case(),
    )


def progress_view(request):
    return render(request, 'test_progress.html', progress_bar_examples)


# doughnut chart test cases

doughnut_data_1 = DoughnutChart(chart_label='Sites',
                                data_labels=['corrective', 'ROW', 'ET'],
                                data_values=[50, 200, 170],
                                colors = ['red', 'green', 'blue'],
                                center_text=['420',
                                             {'text': 'Sites', 'color': 'red'},
                                             'Total'],
                                responsive=True, )

doughnut_data_2 = DoughnutChart(chart_label='Treatment Type',
                                data_labels=['corrective', 'ROW', 'ET'],
                                data_values=[50, 200, 170],
                                responsive=True,
                                colors = ['red', 'green', 'blue'],
                                )

doughnut_chart_examples = dict(doughnut_data_1=doughnut_data_1, doughnut_data_2=doughnut_data_2,)


def doughnut_view(request):
    return render(request, 'test_doughnut.html', doughnut_chart_examples)


# stacked doughnut chart test cases

sdoughnut_data_1 = StackedDoughnutChart(chart_label='Sites',
                                        data_labels=['MSR', 'non-MSR'],
                                        data_values={'ROW': [200, 120], 'ET': [500, 300]},
                                        colors=['#cc0000', '#ffc400'],
                                        summary_colors=['#99ccff', '#339966'],
                                        center_text=[{'text': '420', 'color': 'black',
                                                      'font': {'size': 20, 'weight': 'bold', }},
                                                     {'text': 'Sites', 'color': 'black'},
                                                     {'text': 'Total', 'color': 'black'}],
                                        border_width=5,
                                        responsive=True, )

sdoughnut_chart_examples = dict(sdoughnut_data_1=sdoughnut_data_1)


def stacked_doughnut_view(request):
    return render(request, 'test_stacked_doughnut.html', sdoughnut_chart_examples)


# bar chart test cases

bar_data = BarChart(y_labels=('Area', 'Trees', '$$'),
                    y_label_images=(static('img/area.png'),
                                    static('img/tree.png'),
                                    static('img/dollar.png')),
                    data=({'label': 'last year',
                           'backgroundColor': 'grey',
                           'data': (100, 90, 140), },
                          {'label': 'current',
                           'backgroundColor': 'rgb(180, 10, 50)',
                           'data': (80, 40, 50), }, ),
                    bar_labels={'last year': {'labels': ('1,200ha (2021)', '190 (2021)', '$4,300,450 (2021)'),
                                              'color': 'white'},
                                'current': {'labels': ('920ha', '80', '$1,220,650'),
                                            'color': 'white'}, })

bar_data_no_target = BarChart(y_labels=('Area', 'Trees', '$$'),
                              y_label_images=(static('img/area.png'),
                                              static('img/tree.png'),
                                              static('img/dollar.png')),
                              data=({'label': 'last year',
                                     'backgroundColor': 'grey',
                                     'data': (100, 90, 140), },
                                    {'label': 'current',
                                     'backgroundColor': 'rgb(180, 10, 50)',
                                     'data': (80, 40, 50), },),
                              bar_labels={'last year': {'labels': ('1,200ha (2021)', '190 (2021)', '$4,300,450 (2021)'),
                                                        'color': 'white'},
                                          'current': {'labels': ('920ha', '80', '$1,220,650'),
                                                      'color': 'white'}, },
                              show_target=False)

bar_data_no_images = BarChart(y_labels=('Area', 'Trees', '$$'),
                              data=({'label': 'last year',
                                     'backgroundColor': 'grey',
                                     'data': (100, 90, 80), },
                                    {'label': 'current',
                                     'backgroundColor': 'rgb(180, 10, 50)',
                                     'data': (80, 40, 50), }, ),
                              bar_labels={'last year': {'labels': ('1,200ha (2021)', '190 (2021)', '$4,300,450 (2021)'),
                                                        'color': 'white'},
                                          'current': {'labels': ('920ha', '80', '$1,220,650'),
                                                      'color': 'white'}, },)

bar_data_custom = BarChart(y_labels=('', '', ''),
                           y_label_images=(static('img/area.png'),
                                           static('img/tree.png'),
                                           static('img/dollar.png')),
                           data=({'label': 'last year',
                                  'backgroundColor': 'grey',
                                  'data': (100, 90, 140), },
                                 {'label': 'current',
                                  'backgroundColor': 'rgb(180, 10, 50)',
                                  'data': (80, 40, 50), }, ),
                           bar_labels={'last year': {'labels': ('1,200ha (2021)', '190 (2021)', '$4,300,450 (2021)'),
                                                     'color': 'white'},
                                       'current': {'labels': ('920ha', '80', '$1,220,650'),
                                                   'color': 'white'}, },
                           target_label='Plan')

bar_data_stacked = BarChart(y_labels=('Area', 'Trees', '$$'),
                            y_label_images=(static('img/area.png'),
                                            static('img/tree.png'),
                                            static('img/dollar.png')),
                            data=({'label': 'planned',
                                   'backgroundColor': 'grey',
                                   'data': (100, 90, 140), },
                                  {'label': 'in progress',
                                   'backgroundColor': 'blue',
                                   'data': (80, 5, 50), },
                                  {'label': 'complete',
                                   'backgroundColor': 'green',
                                   'data': (0, 40, 50), }, ),
                            bar_labels={'planned': {'labels': ('1,200ha', '190', '$4,300,450'),
                                                    'color': 'white'},
                                        'in progress': {'labels': ('920ha', '80', '$1,220,650'),
                                                        'color': 'white'},
                                        'complete': {'labels': ('20ha', '10', '$220,650'),
                                                     'color': 'white'},
                                        },
                            target_label='Plan',
                            stacked=True, )

bar_chart_examples = dict(bar_data1=bar_data, bar_data2=bar_data_no_target,
                          bar_data3=bar_data_custom, bar_data4=bar_data_no_images,
                          bar_data5=bar_data_stacked)


def bar_view(request):
    return render(request, 'test_barchart.html', bar_chart_examples)


#  arrow test cases

vals = [0, 1, -1, 5, -5, 10, 10, -10, 100, -100, 1000, -1000]
arrowds_center = dict(row1=[Arrow(val=vals[i]) for i in range(0, 6)],
                      row2=[Arrow(val=vals[i]) for i in range(6, 12)], )
arrowds_optimal = dict(row1=[Arrow(val=vals[i], align='optimal', min_font_size=10) for i in range(0, 6)],
                       row2=[Arrow(val=vals[i], align='optimal', min_font_size=10) for i in range(6, 12)], )

arrow_examples = dict(center=arrowds_center, optimal=arrowds_optimal)


def arrow_view(request):
    return render(request, 'test_arrow.html', arrow_examples, )


#  all widgets

all_examples = dict(chain(progress_bar_examples.items(),
                          bar_chart_examples.items(),
                          doughnut_chart_examples.items(),
                          sdoughnut_chart_examples.items(),
                          arrow_examples.items(), ), )


def test_all_view(request):
    return render(request, 'test_all.html', all_examples)


active_dashboard_bar_data = BarChart(y_labels=('Area', 'Trees', '$$'),
                                     y_label_images={'Area': static('img/area.png'),
                                                     'Trees': static('img/tree.png'),
                                                     '$$': static('img/dollar.png'), },
                                     data=({'label': 'last year',
                                            'backgroundColor': 'grey',
                                            'data': (100, 90, 140), },
                                           {'label': 'current',
                                            'backgroundColor': 'rgb(180, 10, 50)',
                                            'data': (80, 40, 50), }, ),
                                     bar_labels={'last year': {'labels': ('1,200ha (2021)', '190 (2021)', '$4,300,450 (2021)'),
                                                               'color': 'white'},
                                                 'current': {'labels': ('920ha', '80', '$1,220,650'),
                                                             'color': 'white'}, })

active_dashboard_data = dict(
    delta_area=Arrow(-10),
    delta_trees=Arrow(+20),
    delta_cost=Arrow(5),
)


def dashboard_active(request):
    return render(request, 'viz_components/dashboard_active.html', active_dashboard_data)
