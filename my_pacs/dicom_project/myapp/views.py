from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated, BasePermission
from django.contrib.auth import authenticate
from django.contrib.auth.models import User, Group
from django.contrib.auth.hashers import make_password
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Patient, DoctorUpload, UserProfile, Center
from .serializers import PatientSerializer, DoctorUploadSerializer, UserSerializer, CenterSerializer
from rest_framework.decorators import action

class RoleBasedPermission(BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        profile = UserProfile.objects.filter(user=request.user).first()
        if not profile:
            return request.user.is_superuser
        return profile.role.name in self.allowed_roles

class AdminPermission(RoleBasedPermission):
    allowed_roles = ['Admin']

class DoctorPermission(RoleBasedPermission):
    allowed_roles = ['Doctor']

class SubAdminPermission(RoleBasedPermission):
    allowed_roles = ['SubAdmin']

class CenterPermission(RoleBasedPermission):
    allowed_roles = ['Center']

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def by_patient_id(self, request):
        patient_id = request.query_params.get('patient_id')
        if patient_id:
            patient = Patient.objects.filter(patient_id=patient_id).first()
            if patient:
                serializer = self.get_serializer(patient)
                return Response(serializer.data)
        return Response({"detail": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

class DoctorUploadViewSet(viewsets.ModelViewSet):
    queryset = DoctorUpload.objects.all()
    serializer_class = DoctorUploadSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, DoctorPermission | CenterPermission]  # Added CenterPermission

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        return queryset

@method_decorator(csrf_exempt, name='dispatch')
class CustomLoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            token, created = Token.objects.get_or_create(user=user)
            profile = UserProfile.objects.filter(user=user).first()
            role = profile.role.name if profile else ('Admin' if user.is_superuser else 'Unknown')
            redirect_url = "/"
            center_name = None
            institute_name = None
            if role == 'Admin':
                redirect_url = "/admin/"
            elif role == 'SubAdmin':
                redirect_url = "/static/index.html"
            elif role == 'Center':
                redirect_url = "/static/index.html"
                center = Center.objects.filter(user=user).first()
                center_name = center.name if center else None
                institute_name = center.institute_name if center else None
            elif role == 'Doctor':
                redirect_url = "/static/doctor.html"
            return Response({
                "token": token.key,
                "redirect": redirect_url,
                "role": role,
                "center_name": center_name,
                "institute_name": institute_name
            })
        return Response({"error": "Invalid credentials"}, status=401)

class UserViewSet(viewsets.ViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, AdminPermission]

    def list(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        role = request.data.get('role')
        center_id = request.data.get('center')

        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            username=username,
            password=make_password(password)
        )

        group = Group.objects.get(name=role)
        profile = UserProfile.objects.create(user=user, role=group)

        if role == 'Center' and center_id:
            center = Center.objects.get(id=center_id)
            profile.center = center
            profile.save()
            center.user = user
            center.save()

        return Response({"detail": "User created successfully"}, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
            user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

class CenterViewSet(viewsets.ModelViewSet):
    queryset = Center.objects.all()
    serializer_class = CenterSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, AdminPermission]