from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet, DoctorUploadViewSet, CustomLoginView, UserViewSet, CenterViewSet

router = DefaultRouter()
router.register(r'patients', PatientViewSet)
router.register(r'uploads', DoctorUploadViewSet)
router.register(r'users', UserViewSet, basename='user')
router.register(r'centers', CenterViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('login/', CustomLoginView.as_view(), name='login'),
]