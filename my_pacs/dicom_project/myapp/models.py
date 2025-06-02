from django.db import models
from django.contrib.auth.models import User, Group

class Center(models.Model):
    name = models.CharField(max_length=100)
    institute_name = models.CharField(max_length=100, null=True, blank=True)
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True)
    is_default = models.BooleanField(default=True)  # Default or Pusher

    def __str__(self):
        return self.name

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True)
    center = models.ForeignKey(Center, on_delete=models.SET_NULL, null=True, blank=True)

class Patient(models.Model):
    name = models.CharField(max_length=255)
    patient_id = models.CharField(max_length=10, unique=True, blank=True)
    age = models.IntegerField()
    sex = models.CharField(max_length=1, choices=[('M', 'Male'), ('F', 'Female')])
    body_part = models.CharField(max_length=255)
    modality = models.CharField(max_length=255)
    center = models.CharField(max_length=255, blank=True)
    institute_name = models.CharField(max_length=255, blank=True)
    scan_datetime = models.DateTimeField()
    locked = models.BooleanField(default=False)
    group = models.CharField(max_length=255, blank=True)
    reported_by = models.CharField(max_length=255, blank=True)

    def save(self, *args, **kwargs):
        if not self.patient_id:
            last_patient = Patient.objects.order_by('-patient_id').first()
            if last_patient and last_patient.patient_id.isdigit():
                new_id = int(last_patient.patient_id) + 1
            else:
                new_id = 1001
            self.patient_id = str(new_id)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.patient_id})"

class DoctorUpload(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='uploads')
    dicom_file = models.FileField(upload_to='dicom_files/', blank=True, null=True)
    report_pdf = models.FileField(upload_to='reports/', blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[('Unreported', 'Unreported'), ('Reported', 'Reported')],
        default='Unreported'
    )

    def __str__(self):
        return f"Upload for {self.patient.name} at {self.uploaded_at}"