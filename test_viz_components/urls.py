from django.urls import path

from . import views

urlpatterns = [
    path('progress/', views.progress_view),
    path('doughnut/', views.doughnut_view),
    path('stacked_doughnut/', views.stacked_doughnut_view),
    path('bar/', views.bar_view),
    path('arrow/', views.arrow_view),
    path('all/', views.test_all_view),
]
