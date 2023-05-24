from dataclasses import dataclass
from .doughnut_chart import DoughnutChart


# input data generator for hydronet delta arrow dashboard bar

@dataclass
class Doughnuts:
    """
    Create data for a bar with doughnut charts for a set of metrics
    breakout_by_metric -- a dict with breakouts for multiple categories to visualize in a doughnut chart,
                          one entry for each metric. The keys in the dict are used as labels for the individual charts.
     """
    breakout_by_metric: dict
    icons = dict(Area='area.png', Cost='dollar.png', Trees='tree.png', Sites='sites.png')

    def make_data(self):
        return map(lambda m: {dict(label=m, icon=self.icons[m], value=DoughnutChart(self.breakout_by_metric[m]), )},
                    self.metric_values.keys())