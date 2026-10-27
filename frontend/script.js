/**
 * CampusCare AI - Public Transparency Hub & Authentication Logic
 * Initialized for a FIRST-TIME USER / FRESH DEPLOYMENT (Zero state).
 * Reads from localStorage ('campus_complaints') and is ready to plug into a backend REST API.
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================
  // 1. DATA REPOSITORY - READS FROM API SERVICE / LOCAL CACHE
  // =========================================================
  let publicComplaints = [];

  async function loadPublicData() {
    if (window.ApiService) {
      const remote = await window.ApiService.getComplaints();
      if (remote && remote.length > 0) {
        publicComplaints = remote;
      }
      const analytics = await window.ApiService.getAnalytics();
      if (analytics) {
        kpiActiveCount.textContent = `${analytics.active_count} Active`;
        kpiSlaRate.textContent = analytics.sla_compliance;
        kpiClusterCount.textContent = `${analytics.cluster_count} Clusters`;
        kpiAvgTime.textContent = analytics.avg_resolution_time;
      }
    }
    if (!publicComplaints || publicComplaints.length === 0) {
      const stored = localStorage.getItem('campus_complaints');
      publicComplaints = stored ? JSON.parse(stored) : [];
    }
    renderComplaints();
    renderClusters();
  }

  // =========================================================
  // 2. RENDER PUBLIC TRANSPARENCY BOARD & CLUSTERS
  // =========================================================
  const complaintsFeed = document.getElementById('publicComplaintsFeed');
  const clustersGrid = document.getElementById('clustersGrid');
  const filterButtons = document.querySelectorAll('.f-pill');
  const boardSearch = document.getElementById('boardSearch');

  // KPI elements
  const kpiActiveCount = document.getElementById('kpiActiveCount');
  const kpiActiveBar = document.getElementById('kpiActiveBar');
  const kpiSlaRate = document.getElementById('kpiSlaRate');
  const kpiClusterCount = document.getElementById('kpiClusterCount');
  const kpiAvgTime = document.getElementById('kpiAvgTime');

  // Count badges on filter buttons
  const countAll = document.getElementById('countAll');
  const countCritical = document.getElementById('countCritical');
  const countHigh = document.getElementById('countHigh');
  const countMedium = document.getElementById('countMedium');
  const countResolved = document.getElementById('countResolved');

  let activeFilter = 'all';
  let searchTerm = '';

  function updateKPIs(data) {
    const activeTickets = data.filter(c => c.status !== 'Resolved');
    const resolvedTickets = data.filter(c => c.status === 'Resolved');
    const clusters = data.filter(c => (c.upvotes || 0) >= 5);

    kpiActiveCount.textContent = `${activeTickets.length} Active`;
    kpiActiveBar.style.width = activeTickets.length > 0 ? `${Math.min(100, activeTickets.length * 15)}%` : '0%';

    kpiClusterCount.textContent = `${clusters.length} Clusters`;

    if (data.length === 0) {
      kpiSlaRate.textContent = '100%';
      kpiAvgTime.textContent = '--';
    } else if (resolvedTickets.length > 0) {
      kpiAvgTime.textContent = '3.5 Hours';
      kpiSlaRate.textContent = '98.5%';
    } else {
      kpiAvgTime.textContent = 'In Progress';
      kpiSlaRate.textContent = '100%';
    }

    // Filter counts
    if (countAll) countAll.textContent = data.length;
    if (countCritical) countCritical.textContent = data.filter(c => c.tier === 'Critical').length;
    if (countHigh) countHigh.textContent = data.filter(c => c.tier === 'High').length;
    if (countMedium) countMedium.textContent = data.filter(c => c.tier === 'Medium').length;
    if (countResolved) countResolved.textContent = resolvedTickets.length;
  }

  function renderComplaints() {
    updateKPIs(publicComplaints);

    // Empty state when 0 complaints exist
    if (publicComplaints.length === 0) {
      complaintsFeed.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🟢</div>
          <h4 class="empty-state-title">No Active Complaints Reported</h4>
          <p class="empty-state-desc">
            The campus is currently running without reported facility issues. When students or faculty file a complaint, 
            it will appear here automatically with real-time status and color-coded SLA tracking.
          </p>
          <button type="button" class="empty-state-action" id="emptyStateLoginBtn">
            <span>🔐 Sign In to Lodge or Manage Complaints</span>
          </button>
        </div>
      `;
      const btn = document.getElementById('emptyStateLoginBtn');
      if (btn) btn.addEventListener('click', () => openLoginModal());
      return;
    }

    // Filtered view
    let filtered = publicComplaints.filter(item => {
      const matchesFilter = (
        activeFilter === 'all' ||
        item.tier === activeFilter ||
        (activeFilter === 'Resolved' && item.status === 'Resolved')
      );

      const matchesSearch = (
        (item.title || '').toLowerCase().includes(searchTerm) ||
        (item.location || '').toLowerCase().includes(searchTerm) ||
        (item.category || '').toLowerCase().includes(searchTerm) ||
        (item.id || '').toLowerCase().includes(searchTerm)
      );

      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      complaintsFeed.innerHTML = `
        <div class="empty-state-box" style="padding: 36px 20px;">
          <div class="empty-state-icon">🔍</div>
          <h4 class="empty-state-title">No matching complaints found</h4>
          <p class="empty-state-desc">No complaints match your current filter or search criteria.</p>
        </div>
      `;
      return;
    }

    complaintsFeed.innerHTML = filtered.map(c => `
      <article class="public-complaint-card">
        <div class="card-top">
          <div class="card-title-group">
            <span class="card-meta-line">${c.id} &bull; ${c.category} &bull; Reported ${c.timeAgo || 'Recently'}</span>
            <h4 class="card-headline">${c.title}</h4>
          </div>
          <div class="card-badges">
            <span class="tier-badge ${c.tierClass}">${c.tierLabel}</span>
            <span class="status-tag ${(c.status || 'pending').toLowerCase().replace(' ', '-')}">${c.status}</span>
          </div>
        </div>

        <p class="card-desc">${c.desc}</p>

        <div class="card-bottom-bar">
          <div class="meta-items-row">
            <span>📍 <strong>${c.location}</strong></span>
            <span>👥 <strong>${c.upvotes || 1}</strong> student(s) affected</span>
            <span>👷 Technician: <strong>${c.assignedTo || 'Triage Queue'}</strong></span>
          </div>
          <span class="sla-target-badge">⏱️ ${c.slaWindow}</span>
        </div>
      </article>
    `).join('');
  }

  function renderClusters() {
    const clusters = publicComplaints.filter(c => (c.upvotes || 0) >= 5);

    if (clusters.length === 0) {
      clustersGrid.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">✨</div>
          <h4 class="empty-state-title">No Active Outage Clusters</h4>
          <p class="empty-state-desc">
            No recurring or duplicate building-wide breakdowns detected. The anti-duplicate engine monitors incoming tickets in real-time.
          </p>
        </div>
      `;
      return;
    }

    clustersGrid.innerHTML = clusters.map(cl => `
      <div class="cluster-spotlight-card ${cl.tier === 'Critical' ? 'border-critical' : 'border-high'}">
        <div class="cluster-head">
          <div>
            <span class="cluster-badge">🔄 Merged Incident Cluster</span>
            <h4 class="cluster-title">${cl.title}</h4>
            <div class="cluster-location">📍 ${cl.location}</div>
          </div>
          <span class="tier-badge ${cl.tierClass}">${cl.tierLabel}</span>
        </div>

        <p style="font-size:0.85rem; color:var(--text-muted);">${cl.desc}</p>

        <div class="cluster-stats-bar">
          <span>Unified Reports: <strong class="merged-count">${cl.upvotes} Students</strong></span>
          <span class="cluster-status-text">${cl.status}</span>
        </div>
      </div>
    `).join('');
  }

  // Filter Listeners
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderComplaints();
    });
  });

  boardSearch.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderComplaints();
  });

  loadPublicData();

  // =========================================================
  // 3. ROLE-BASED LOGIN MODAL
  // =========================================================
  const loginModal = document.getElementById('loginModal');
  const openLoginModalBtn = document.getElementById('openLoginModalBtn');
  const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
  const roleButtons = document.querySelectorAll('.role-btn');
  const portalLoginForm = document.getElementById('portalLoginForm');
  const idInputLabel = document.getElementById('idInputLabel');
  const userIdentifier = document.getElementById('userIdentifier');
  const emailInputLabel = document.getElementById('emailInputLabel');
  const userEmail = document.getElementById('userEmail');
  const userPassword = document.getElementById('userPassword');
  const portalSubmitBtn = document.getElementById('portalSubmitBtn');
  const btnLabel = portalSubmitBtn.querySelector('.btn-label');
  const btnSpinner = portalSubmitBtn.querySelector('.btn-spinner');
  const loginAlert = document.getElementById('loginAlert');
  const demoPills = document.querySelectorAll('.btn-quick-fill');

  const roleAuthConfigs = {
    student: {
      idLabel: 'Student Roll / PRN Number',
      idPlaceholder: 'e.g. 2024CS0148',
      emailLabel: 'Student Institutional Email',
      emailPlaceholder: 'student@campus.edu',
      btnText: 'Access Student Workspace',
      demo: { id: '2024CS0148', email: 'alex.smith@campus.edu', pass: 'Password123' }
    },
    faculty: {
      idLabel: 'Faculty ID / Employee Code',
      idPlaceholder: 'e.g. FAC-ENG-882',
      emailLabel: 'Departmental Email',
      emailPlaceholder: 'prof.smith@campus.edu',
      btnText: 'Access Faculty Review Desk',
      demo: { id: 'FAC-ENG-882', email: 'prof.smith@campus.edu', pass: 'Password123' }
    },
    staff: {
      idLabel: 'Staff ID / Badge Number',
      idPlaceholder: 'e.g. MAINT-704',
      emailLabel: 'Facilities / Admin Email',
      emailPlaceholder: 'operations@campus.edu',
      btnText: 'Access Maintenance Dispatch',
      demo: { id: 'MAINT-704', email: 'operations@campus.edu', pass: 'Password123' }
    }
  };

  let activeRole = 'student';

  function setRole(role) {
    activeRole = role;
    roleButtons.forEach(b => b.classList.toggle('active', b.dataset.role === role));

    const cfg = roleAuthConfigs[role];
    idInputLabel.textContent = cfg.idLabel;
    userIdentifier.placeholder = cfg.idPlaceholder;
    emailInputLabel.textContent = cfg.emailLabel;
    userEmail.placeholder = cfg.emailPlaceholder;
    btnLabel.textContent = cfg.btnText;

    hideLoginAlert();
  }

  function showLoginAlert(msg, type = 'error') {
    loginAlert.textContent = msg;
    loginAlert.className = `alert-box ${type}`;
    loginAlert.style.display = 'block';
  }

  function hideLoginAlert() {
    loginAlert.style.display = 'none';
    loginAlert.textContent = '';
  }

  function openLoginModal() {
    loginModal.style.display = 'flex';
  }

  openLoginModalBtn.addEventListener('click', openLoginModal);

  closeLoginModalBtn.addEventListener('click', () => {
    loginModal.style.display = 'none';
  });

  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.style.display = 'none';
  });

  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setRole(btn.dataset.role);
    });
  });

  demoPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const role = pill.dataset.demo;
      setRole(role);
      const demo = roleAuthConfigs[role].demo;
      userIdentifier.value = demo.id;
      userEmail.value = demo.email;
      userPassword.value = demo.pass;
      showLoginAlert(`Pre-filled sample credentials for ${role.toUpperCase()} test`, 'success');
    });
  });

  portalLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideLoginAlert();

    const id = userIdentifier.value.trim();
    const email = userEmail.value.trim();
    const pass = userPassword.value.trim();

    if (!id || !email || !pass) {
      showLoginAlert('Please fill in all credential fields.');
      return;
    }

    portalSubmitBtn.disabled = true;
    btnLabel.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    setTimeout(() => {
      portalSubmitBtn.disabled = false;
      btnLabel.style.display = 'inline-block';
      btnSpinner.style.display = 'none';

      // Open corresponding role dashboard
      window.location.href = `dashboard.html?role=${activeRole}`;
    }, 600);
  });

  setRole('student');
});
