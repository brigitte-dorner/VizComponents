"""
    Generic tools for reporting on "progress"
    E.g., using a Bootstrap progress bar
"""
from dataclasses import dataclass
from typing import Union


@dataclass
class ProgressBar:
    """ Data for reporting progress on a single metric

    Use this in conjunction with the simple_progress template to define a simple progress bar,
    or wrap multiple ProgressBar instances inside Progress to define a stacked progress bar

    value -- headway towards the goal; can be a percentage or a straight-up metric, such as a count

    goal -- should be in same units as value, if given; may be omitted if the ProgressBar is part of a
            stacked bar and all categories in the stacked bar share the same goal

    title_template -- text shown on hover

    label_template -- text shown inside the bar

    sr_label_template -- text shown below the bar in reader view

    summary_template -- summary text shown below the bar

    show_summary -- determines whether a summary is shown for this bar

    css_class -- use this to define the color of the bar, and potentially other properties

    bar_scaling -- a value <= 1, gives the proportion of space this bar takes up in the bar widget
                   when the goal is reached; normally there would be no need to touch this
    """

    value: Union[int, float] = 0     # headway towards goal
    goal: Union[int, float] = 0     # definition of done
    title_template: str = 'Completed {self.value} of {self.goal}'  # show on hover
    label_template: str = '{self.pct}%'  # show inside bar
    sr_label_template: str = None  # shown for reader view only
    summary_template: str = None  # for summary text below the bar
    show_summary: bool = True
    css_class: str = 'progress-bar-success'
    bar_scaling = 1  # scaling factor for bar width - typically set by the Progress class if it needs to be changed

    def percent_complete(self):
        # if there is no goal, we are always at 100% complete
        return 100 if self.goal == 0 else 100*self.value/self.goal

    @property
    def pct(self):
        """ Percent complete rounded to nearest int """
        return round(self.percent_complete())

    @property
    def title(self):
        return self.title_template.format(self=self)

    @property
    def label(self):
        return self.label_template.format(self=self)

    @property
    def sr_label(self):
        return self.sr_label_template.format(self=self) if self.sr_label_template else self.title

    @property
    def summary(self):
        return self.summary_template.format(self=self) if self.summary_template else ''

    @property
    def p_width(self):
        # hold bar size constant at the 100% width once goal is exceeded
        b_width = 100 if self.goal > 0 and self.value > self.goal else self.percent_complete()
        return self.bar_scaling * b_width



class Progress(list):
    """ A progress bar, potentially stacked

    bars -- list of one or more progress bars
    goal -- if the bars all contribute to a shared goal, set this here
    summary_template -- template for summary text to be shown below bar if show_summary is set
    show_summary -- show a summary below the bar? If this is set, the summary shown will consist of
                    a concatenation of summaries for the individual bars, followed by the summary text
                    for the Progress as a whole
    summary_concat -- string used to concatenate summary texts
    """


    def __init__(self,
                 *bars: ProgressBar,
                 goal: Union[int, float] = None,
                 summary_template: str = '{self.value}/{self.goal}',  # show below bar if show_summary is set
                 show_summary: bool = True,
                 summary_concat=', '
                 ):
        super().__init__(bars)
        # goal should be passed as parameter in situations where all bars are populated from the same pool
        # (e.g., bars represent a series of stages the items in the pool progress through)
        self.shared_goal = not goal is None
        # if the bars are populated from separate pools, the total width of the progress bar needs to be calculated here
        # as the sum of the goals for the individual bars
        self.goal = goal if self.shared_goal else sum(bar.goal for bar in bars)
        self.value = sum(bar.value for bar in bars)
        for b in bars:
            if self.shared_goal:
                b.goal = self.goal  # propagate shared goal to individual bars
                if self.value == 0: b.bar_scaling = 0  # special case - all values are zero, no bars to be shown
                elif self.goal == 0: b.bar_scaling = b.value/self.value  # special case - only working with values, since there are no goals; bars will self-scale to 100 in this case
                elif self.value > self.goal:
                    # restrict the bar to a maximum width by scaling, since there would be an overflow otherwise
                    b.bar_scaling = self.goal/self.value
                    # conceptually, scaling by self.goal/self.value should do the trick here
                    # however, once individual bars exceed 100% of the shared goal this doesn't work any more,
                    # since the individual bar at that point caps its width at 100
                    # hence need to tweak the scaling to give the bar the full size
                    if b.value > self.goal and self.goal > 0:
                        b.bar_scaling = b.bar_scaling * b.value/self.goal
            else:             # set the width scalar on the individual bars so the total adds up to 100 if all goals are met
                # workaround for case when the goal is 0
                # we still want to show a bar in this case if there are values > 0,
                self.barsize = self.goal if self.goal > 0 else self.value
                if self.barsize > 0:
                    b.bar_scaling = b.goal / self.barsize

        self.show_summary = show_summary
        if show_summary:
            b_summary = summary_concat.join(b.summary for b in bars if (b.show_summary and len(b.summary) > 0))
            p_summary = summary_template.format(self=self)
            self.summary = summary_concat.join((b_summary, p_summary)) if ((len(b_summary) > 0) and (len(p_summary) > 0)) else b_summary if (len(b_summary) > 0) else p_summary

