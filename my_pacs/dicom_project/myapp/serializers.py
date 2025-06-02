from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Patient, DoctorUpload, Center, UserProfile

class CenterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Center
        fields = '__all__'

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = '__all__'

class PatientSerializer(serializers.ModelSerializer):
    uploads = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = '__all__'

    def get_uploads(self, obj):
        uploads = DoctorUpload.objects.filter(patient=obj)
        return DoctorUploadSerializer(uploads, many=True).data

class DoctorUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorUpload
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ['id', 'username', 'profile']