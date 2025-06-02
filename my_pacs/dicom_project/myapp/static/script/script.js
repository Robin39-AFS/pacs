const baseUrl = 'http://127.0.0.1:8000';
let allStudies = [];
let token = localStorage.getItem('token');

async function fetchAndLoadStudies() {
  if (!token) {
    alert('Please log in first');
    window.location.href = 'login.html';
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/api/patients/`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch patients');
    const patients = await res.json();
    allStudies = patients.map(p => ({
      id: p.id,
      patientName: p.name,
      patientID: p.patient_id,
      age: p.age,
      sex: p.sex,
      bodyPart: p.body_part,
      modality: p.modality,
      center: p.center || 'Default',
      institute: p.institute_name || 'Unknown',
      scanDateTime: new Date(p.scan_datetime).toLocaleString(),
      status: p.uploads.length > 0 ? p.uploads[0].status : 'Not Assigned',
      reportedBy: p.reported_by || '',
      group: p.group || '',
      dicomFile: p.uploads.length > 0 ? p.uploads[0].dicom_file : '',
      reportPdf: p.uploads.length > 0 ? p.uploads[0].report_pdf : '',
      locked: p.locked
    }));

    const centerSelect = document.getElementById('center');
    const centers = [...new Set(allStudies.map(s => s.center))];
    centers.forEach(center => {
      const option = document.createElement('option');
      option.value = center;
      option.textContent = center;
      centerSelect.appendChild(option);
    });

    loadStudies(allStudies);
  } catch (err) {
    console.error('Error fetching studies:', err);
    alert('Error fetching studies');
  }
}

function loadStudies(data) {
  const tbody = document.getElementById('study-table-body');
  tbody.innerHTML = '';
  data.forEach((s, index) => {
    const timestamp = new Date().getTime();
    const dicomFileUrl = s.dicomFile ? `${s.dicomFile}?t=${timestamp}` : '';
    const reportLink = s.reportPdf ? `<a href="${s.reportPdf}?t=${timestamp}" target="_blank" style="color:#ff712f;">View</a>` : '—';
    const reportButton = s.reportPdf ? `<button class="action-btn" onclick="openReport('${s.reportPdf}?t=${timestamp}')">📝</button>` : '—';
    const tr = document.createElement('tr');
    if (s.locked) {
      tr.classList.add('emergency-case');
    }
    tr.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" data-patient-pk="${s.id}" /></td>
      <td><button class="action-btn" onclick="openViewer('${dicomFileUrl}')">📄</button></td>
      <td>${reportButton}</td>
      <td><button class="action-btn" onclick="openHistory('${s.patientID}')">📚</button></td>
      <td>${s.patientName}</td>
      <td>${s.patientID}</td>
      <td>${s.age}</td>
      <td>${s.sex}</td>
      <td>${s.bodyPart}</td>
      <td>${s.modality}</td>
      <td>${s.center}</td>
      <td>${s.institute}</td>
      <td>${s.scanDateTime}</td>
      <td>${s.status}</td>
      <td>${reportLink}</td>
      <td>${s.reportedBy}</td>
      <td>${s.group}</td>
    `;
    tbody.appendChild(tr);
  });

  const selectAll = document.getElementById('select-all');
  selectAll.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    const maxSelect = 20;
    checkboxes.forEach((cb, idx) => {
      if (idx < maxSelect) {
        cb.checked = selectAll.checked;
      }
    });
  });
}

document.getElementById('modality-all').addEventListener('change', (event) => {
  const isChecked = event.target.checked;
  document.querySelectorAll('.modality-checkbox').forEach(checkbox => {
    checkbox.checked = isChecked;
  });
});

function searchStudies() {
  const nameQ = document.getElementById('patient-name').value.toLowerCase();
  const idQ = document.getElementById('patient-id').value;
  const statusQ = document.getElementById('status').value;
  const centerQ = document.getElementById('center').value;
  const emergencyFilter = document.getElementById('emergency').checked;
  const selectedModalities = Array.from(document.querySelectorAll('.modality-checkbox:checked')).map(cb => cb.value);

  const filtered = allStudies.filter(s => {
    if (emergencyFilter && !s.locked) return false;
    if (statusQ !== 'All' && s.status !== statusQ) return false;
    if (centerQ !== 'ALL' && s.center !== centerQ) return false;
    if (nameQ && !s.patientName.toLowerCase().includes(nameQ)) return false;
    if (idQ && !s.patientID.includes(idQ)) return false;
    if (selectedModalities.length > 0 && !selectedModalities.includes(s.modality)) return false;
    return true;
  });
  loadStudies(filtered);
}

document.getElementById('assign-btn').addEventListener('click', async () => {
  const selectedOptions = Array.from(document.getElementById('assign-doctors').selectedOptions);
  const doctors = selectedOptions.map(option => option.value);
  if (!doctors.length) {
    return alert('Please select at least one doctor.');
  }
  const group = doctors.join(', ');
  const boxes = Array.from(document.querySelectorAll('.row-checkbox:checked'));
  if (!boxes.length) {
    return alert('No patients selected.');
  }
  const ids = boxes.map(cb => cb.dataset.patientPk);
  try {
    await Promise.all(
      ids.map(id =>
        fetch(`${baseUrl}/api/patients/${id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          },
          body: JSON.stringify({ group })
        })
      )
    );
    document.getElementById('assign-doctors').selectedIndex = -1;
    boxes.forEach(cb => cb.checked = false);
    await fetchAndLoadStudies();
    alert(`Assigned doctors to ${ids.length} patient(s).`);
  } catch (err) {
    console.error(err);
    alert('Error assigning; check console.');
  }
});

function openViewer(u) { u ? window.open(u, '_blank') : alert('No medical file'); }
function openReport(u) { u ? window.open(u, '_blank') : alert('No report available'); }
function openHistory(id) { alert(`Open history for patient ${id}`); }
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  window.location.href = 'login.html';
}

window.onload = fetchAndLoadStudies;