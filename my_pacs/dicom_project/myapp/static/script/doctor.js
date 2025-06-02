const baseUrl = 'http://127.0.0.1:8000';
let allPatients = [];
let token = localStorage.getItem('token');

document.getElementById('doctor-name').addEventListener('change', async () => {
  const doctorName = document.getElementById('doctor-name').value;
  const patientListDiv = document.getElementById('patient-list');
  const patientTableBody = document.getElementById('patient-table-body');

  if (!doctorName) {
    patientListDiv.style.display = 'none';
    patientTableBody.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/patients/`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    const patients = await res.json();
    allPatients = patients.filter(p => 
      p.group && p.group.split(', ').includes(doctorName)
    );
    searchPatients();
  } catch (err) {
    console.error('Error fetching patients:', err);
    alert('Error fetching patients');
  }
});

document.getElementById('modality-all').addEventListener('change', (event) => {
  const isChecked = event.target.checked;
  document.querySelectorAll('.modality-checkbox').forEach(checkbox => {
    checkbox.checked = isChecked;
  });
});

function searchPatients() {
  const nameQ = document.getElementById('patient-name').value.toLowerCase();
  const idQ = document.getElementById('patient-id').value;
  const statusQ = document.getElementById('status').value;
  const centerQ = document.getElementById('center').value;
  const emergencyFilter = document.getElementById('emergency').checked;
  const selectedModalities = Array.from(document.querySelectorAll('.modality-checkbox:checked')).map(cb => cb.value);

  const filteredPatients = allPatients.filter(p => {
    const patient = {
      name: p.name,
      patient_id: p.patient_id,
      age: p.age,
      sex: p.sex,
      body_part: p.body_part,
      modality: p.modality,
      center: p.center || 'Default',
      institute_name: p.institute_name || 'Unknown',
      scan_datetime: new Date(p.scan_datetime).toLocaleString(),
      status: p.uploads.length > 0 ? p.uploads[0].status : 'Unreported',
      locked: p.locked
    };
    if (emergencyFilter && !patient.locked) return false;
    if (statusQ !== 'All' && patient.status !== statusQ) return false;
    if (centerQ !== 'ALL' && patient.center !== centerQ) return false;
    if (nameQ && !patient.name.toLowerCase().includes(nameQ)) return false;
    if (idQ && !patient.patient_id.includes(idQ)) return false;
    if (selectedModalities.length > 0 && !selectedModalities.includes(patient.modality)) return false;
    return true;
  });

  loadPatients(filteredPatients);
}

function loadPatients(data) {
  const patientListDiv = document.getElementById('patient-list');
  const patientTableBody = document.getElementById('patient-table-body');
  patientTableBody.innerHTML = '';
  data.forEach((p, index) => {
    const tr = document.createElement('tr');
    if (p.locked) tr.classList.add('emergency-case');
    const status = p.uploads.length > 0 ? p.uploads[0].status : 'Unreported';
    const timestamp = new Date().getTime();
    const dicomUrl = p.uploads.length > 0 && p.uploads[0].dicom_file 
      ? `${p.uploads[0].dicom_file}?t=${timestamp}` 
      : '';
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.patient_id}</td>
      <td>${p.age}</td>
      <td>${p.sex}</td>
      <td>${p.body_part}</td>
      <td>${p.modality}</td>
      <td>${p.center || 'Default'}</td>
      <td>${p.institute_name || 'Unknown'}</td>
      <td>${new Date(p.scan_datetime).toLocaleString()}</td>
      <td>
        <select class="status-select" data-id="${p.id}" data-upload-id="${p.uploads.length > 0 ? p.uploads[0].id : ''}">
          <option value="Unreported" ${status === 'Unreported' ? 'selected' : ''}>Unreported</option>
          <option value="Draft" ${status === 'Draft' ? 'selected' : ''}>Draft</option>
          <option value="Reviewed" ${status === 'Reviewed' ? 'selected' : ''}>Reviewed</option>
          <option value="Reported" ${status === 'Reported' ? 'selected' : ''}>Reported</option>
        </select>
      </td>
      <td>
        <button class="action-btn upload-btn" data-index="${index}">Upload Report</button>
        <input type="file" class="file-input" id="file-${index}" style="display:none;" accept="application/pdf">
      </td>
      <td>
        <button class="action-btn" onclick="openViewer('${dicomUrl}')" ${!dicomUrl ? 'disabled' : ''}>📄</button>
      </td>
    `;
    patientTableBody.appendChild(tr);
  });
  patientListDiv.style.display = 'block';

  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', updateStatus);
  });
  document.querySelectorAll('.upload-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`file-${btn.dataset.index}`).click();
    });
  });
  document.querySelectorAll('.file-input').forEach(input => {
    input.addEventListener('change', uploadReport);
  });
}

async function updateStatus(event) {
  const patientId = event.target.dataset.id;
  const uploadId = event.target.dataset.uploadId;
  const status = event.target.value;
  const backendStatus = (status === 'Reported') ? 'Reported' : 'Unreported';

  if (!uploadId) {
    alert('No upload exists for this patient');
    return;
  }

  try {
    const uploadData = new FormData();
    uploadData.append('status', backendStatus);
    const upRes = await fetch(`${baseUrl}/api/uploads/${uploadId}/`, {
      method: 'PATCH',
      headers: { 'Authorization': `Token ${token}` },
      body: uploadData,
    });
    if (!upRes.ok) throw new Error('Status update failed');
    alert('Status updated successfully');
  } catch (err) {
    console.error('Error updating status:', err);
    alert('Error updating status');
  }
}

async function uploadReport(event) {
  const file = event.target.files[0];
  const patientId = event.target.closest('tr').querySelector('.status-select').dataset.id;
  const uploadId = event.target.closest('tr').querySelector('.status-select').dataset.uploadId;
  const doctorName = document.getElementById('doctor-name').value;

  if (!file) return;
  if (!uploadId) {
    alert('No upload exists for this patient');
    return;
  }

  try {
    const uploadData = new FormData();
    uploadData.append('report_pdf', file);
    uploadData.append('status', 'Reported');
    const upRes = await fetch(`${baseUrl}/api/uploads/${uploadId}/`, {
      method: 'PATCH',
      headers: { 'Authorization': `Token ${token}` },
      body: uploadData,
    });
    if (!upRes.ok) throw new Error('Report upload failed');

    const patRes = await fetch(`${baseUrl}/api/patients/${patientId}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`
      },
      body: JSON.stringify({ reported_by: doctorName }),
    });
    if (!patRes.ok) throw new Error('Patient update failed');

    alert('Report uploaded successfully');
    document.getElementById('doctor-name').dispatchEvent(new Event('change'));
  } catch (err) {
    console.error('Error uploading report:', err);
    alert('Error uploading report');
  }
}

function openViewer(u) { 
  console.log('Opening viewer for URL:', u); 
  u ? window.open(u, '_blank') : alert('No medical file'); 
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  window.location.href = 'login.html';
}