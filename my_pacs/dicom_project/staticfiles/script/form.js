const baseUrl = 'http://127.0.0.1:8000';
let token = localStorage.getItem('token');

async function loadPatients() {
  if (!token) {
    alert('Please log in first');
    window.location.href = 'login.html';
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/api/patients/`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    const patients = await res.json();
    const patientSelect = document.getElementById('patient-id');
    patientSelect.innerHTML = '<option value="">— Add New Patient —</option>';
    patients.forEach(p => {
      const option = document.createElement('option');
      option.value = p.patient_id;
      option.textContent = `${p.name} (ID: ${p.patient_id})`;
      patientSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading patients:', err);
  }
}

document.getElementById('patient-id').addEventListener('change', (e) => {
  const patientId = e.target.value;
  const newPatientDetails = document.getElementById('new-patient-details');
  if (patientId) {
    newPatientDetails.style.display = 'none';
  } else {
    newPatientDetails.style.display = 'block';
  }
});

document.getElementById('patient-upload-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const msgEl = document.getElementById('form-message');
  const patientId = form.patient_id.value;
  const dicomFile = form.dicom_file.files[0];

  // Validate file type
  if (dicomFile && !dicomFile.name.endsWith('.dcm')) {
    msgEl.textContent = '❌ Please upload a .dcm file.';
    msgEl.className = 'error';
    return;
  }

  try {
    let patientPk;

    if (patientId) {
      const res = await fetch(`${baseUrl}/api/patients/by_patient_id/?patient_id=${patientId}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (!res.ok) throw new Error('Patient not found');
      const patient = await res.json();
      patientPk = patient.id;
    } else {
      const patientData = {
        name: form.name.value,
        age: form.age.value,
        sex: form.sex.value,
        body_part: form.body_part.value,
        modality: form.modality.value,
        center: form.center.value,
        institute_name: form.institute_name.value,
        scan_datetime: new Date(form.scan_datetime.value).toISOString(),
        locked: form.locked.checked
      };

      const patRes = await fetch(`${baseUrl}/api/patients/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify(patientData)
      });
      if (!patRes.ok) {
        const errorData = await patRes.json();
        throw new Error(errorData.detail || 'Patient creation failed');
      }
      const created = await patRes.json();
      patientPk = created.id;
    }

    const existingUploadsRes = await fetch(`${baseUrl}/api/uploads/?patient=${patientPk}`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    const existingUploads = await existingUploadsRes.json();

    let uploadId;
    let upRes;

    if (existingUploads.length > 0) {
      existingUploads.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
      uploadId = existingUploads[0].id;
      const uploadData = new FormData();
      uploadData.append('patient', patientPk);
      uploadData.append('dicom_file', form.dicom_file.files[0]);
      uploadData.append('status', 'Unreported');
      upRes = await fetch(`${baseUrl}/api/uploads/${uploadId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`
        },
        body: uploadData
      });
    } else {
      const uploadData = new FormData();
      uploadData.append('patient', patientPk);
      uploadData.append('dicom_file', form.dicom_file.files[0]);
      uploadData.append('status', 'Unreported');
      upRes = await fetch(`${baseUrl}/api/uploads/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`
        },
        body: uploadData
      });
    }

    if (!upRes.ok) throw new Error('Upload failed');

    msgEl.textContent = '✅ Patient & upload saved!';
    msgEl.className = 'success';
    form.reset();
    document.getElementById('new-patient-details').style.display = 'block';
    await loadPatients();
  } catch (err) {
    console.error('Error details:', err);
    msgEl.textContent = `❌ ${err.message}`;
    msgEl.className = 'error';
  }
});

window.onload = () => {
  const centerInput = document.querySelector('input[name="center"]');
  const instituteInput = document.querySelector('input[name="institute_name"]');
  centerInput.value = localStorage.getItem('center_name') || '';
  instituteInput.value = localStorage.getItem('institute_name') || '';
  loadPatients();
};