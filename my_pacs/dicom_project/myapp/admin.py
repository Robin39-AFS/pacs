# myapp/admin.py

from django.contrib import admin
from .models import UserProfile, Center, Patient, DoctorUpload

# Register the existing models
admin.site.register(Center)
admin.site.register(Patient)
admin.site.register(DoctorUpload)

# Register the UserProfile model to manage roles
admin.site.register(UserProfile)
